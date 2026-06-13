/**
 * src/integration.js - Exportações e Integrações Futuras (Versão 2.0)
 * Controle de Consumo de Água - Mamma Mia
 */

import { getAppSettings, formatDate } from './data.js';

/**
 * --- PREPARAÇÃO PARA INTEGRAÇÕES FUTURAS (FASE 3) ---
 */

export function syncGoogleSheetsFuture(readings) {
  console.log('Integração futura com Google Sheets ativada. Leituras prontas para sincronização:', readings.length);
  // Placeholder para futuras conexões de API (OAuth2 e Sheets v4 API)
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ success: true, message: 'Google Sheets sync ready.' });
    }, 500);
  });
}

export function sendTelegramAlertFuture(meterId, alertType, message) {
  console.log(`[Telegram Alert Hook] Para Hidrômetro: ${meterId} | Tipo: ${alertType} | Msg: ${message}`);
  // Placeholder para envio via Bot API do Telegram (fetch para api.telegram.org)
}

export function pushPowerBIFuture(readings) {
  console.log('Power BI Push Hook ativado. Prontos para empurrar dados estruturados.', readings.length);
  // Placeholder para conexão com Power BI Streaming Datasets
}

/**
 * --- SISTEMA DE EXPORTAÇÕES (FASE 1) ---
 */

/**
 * Exporta para arquivo JSON
 */
export function exportToJSON(readings) {
  const dataStr = JSON.stringify(readings, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  triggerDownload(blob, `mamma_mia_agua_backup_${getFormattedDateISO()}.json`);
}

/**
 * Exporta para arquivo CSV
 */
export function exportToCSV(readings) {
  const settings = getAppSettings();
  let csvContent = '\uFEFF'; // BOM para Excel abrir acentos em UTF-8 corretamente
  
  // Cabeçalhos do CSV
  csvContent += 'Data;Hidrômetro;Apelido;Leitura Acumulada (m³);Consumo Período (m³);Inicial\r\n';
  
  // Como as leituras estão ordenadas mais recentes primeiro, recalculamos consumos
  // para garantir consistência no relatório
  const sorted = [...readings].sort((a, b) => new Date(a.date) - new Date(b.date));
  const lastIndices = {};
  
  const rows = sorted.map(r => {
    const meterId = r.meterId;
    const meterInfo = settings.hydrometers[meterId] || { alias: 'N/A' };
    let consumption = 0;
    
    if (r.isInitial) {
      consumption = 0;
    } else if (lastIndices[meterId] !== undefined) {
      consumption = Number((r.index - lastIndices[meterId]).toFixed(3));
    }
    
    lastIndices[meterId] = r.index;
    
    const dateFormatted = formatDate(r.date, true);
    
    return `"${dateFormatted}";"${meterId}";"${meterInfo.alias}";${r.index.toString().replace('.', ',')};${consumption.toString().replace('.', ',')};${r.isInitial ? 'Sim' : 'Não'}`;
  });
  
  csvContent += rows.reverse().join('\r\n'); // Mais recente primeiro
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, `mamma_mia_agua_leituras_${getFormattedDateISO()}.csv`);
}

/**
 * Exporta para Excel (.xlsx) usando a biblioteca SheetJS (XLSX) via CDN
 */
export function exportToExcel(readings) {
  if (typeof XLSX === 'undefined') {
    throw new Error('A biblioteca SheetJS (XLSX) não foi carregada. Verifique sua conexão à internet.');
  }

  const settings = getAppSettings();
  
  // 1. Cria aba de Leituras Individuais
  const sorted = [...readings].sort((a, b) => new Date(b.date) - new Date(a.date)); // Mais recente primeiro
  const lastIndices = {};
  
  // Ordena crescente temporariamente para o cálculo do consumo acumulado
  const sortedAsc = [...readings].sort((a, b) => new Date(a.date) - new Date(b.date));
  const consumptionMap = {};
  
  sortedAsc.forEach(r => {
    const meterId = r.meterId;
    let consumption = 0;
    if (r.isInitial) {
      consumption = 0;
    } else if (lastIndices[meterId] !== undefined) {
      consumption = Number((r.index - lastIndices[meterId]).toFixed(3));
    }
    lastIndices[meterId] = r.index;
    consumptionMap[r.id] = consumption;
  });

  const wsDataReadings = sorted.map(r => {
    const meterInfo = settings.hydrometers[r.meterId] || { alias: 'N/A', name: 'N/A' };
    return {
      'Data e Hora': formatDate(r.date, true),
      'ID Hidrômetro': r.meterId,
      'Apelido': meterInfo.alias,
      'Localização': meterInfo.name,
      'Leitura Acumulada (m³)': r.index,
      'Consumo no Período (m³)': consumptionMap[r.id],
      'Tipo de Registro': r.isInitial ? 'Inicial (Partida)' : 'Lançamento Diário'
    };
  });

  const wb = XLSX.utils.book_new();
  const wsReadings = XLSX.utils.json_to_sheet(wsDataReadings);
  
  // Auto-ajusta largura das colunas
  const wscols = [
    {wch: 20}, // Data
    {wch: 15}, // ID
    {wch: 12}, // Apelido
    {wch: 28}, // Localização
    {wch: 22}, // Leitura
    {wch: 22}, // Consumo
    {wch: 20}  // Tipo
  ];
  wsReadings['!cols'] = wscols;
  
  XLSX.utils.book_append_sheet(wb, wsReadings, 'Histórico de Leituras');

  // 2. Cria aba de Resumo Administrativo dos Hidrômetros
  const wsDataSummary = Object.keys(settings.hydrometers).map(id => {
    const info = settings.hydrometers[id];
    
    // Calcula consumo total histórico
    const meterReadings = readings.filter(r => r.meterId === id && !r.isInitial);
    const totalConsumed = meterReadings.reduce((sum, r) => {
      // Encontra a leitura imediatamente anterior para calcular o consumo real desse período
      const sortedMeter = readings.filter(x => x.meterId === id).sort((a,b) => new Date(a.date) - new Date(b.date));
      const idx = sortedMeter.findIndex(x => x.id === r.id);
      if (idx > 0) {
        return sum + (r.index - sortedMeter[idx-1].index);
      }
      return sum;
    }, 0);

    return {
      'ID Hidrômetro': id,
      'Apelido': info.alias,
      'Nome Cadastrado': info.name,
      'Unidade': info.unit || 'YUKA',
      'Meta Individual (m³)': settings.metaIndividual,
      'Total Consumido Acumulado (m³)': Number(totalConsumed.toFixed(3)),
      'Registros Totais': readings.filter(r => r.meterId === id).length
    };
  });

  const wsSummary = XLSX.utils.json_to_sheet(wsDataSummary);
  wsSummary['!cols'] = [
    {wch: 15}, {wch: 12}, {wch: 28}, {wch: 12}, {wch: 20}, {wch: 28}, {wch: 15}
  ];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumo Hidrômetros');

  // Grava o arquivo XLSX
  XLSX.writeFile(wb, `mamma_mia_agua_relatorio_${getFormattedDateISO()}.xlsx`);
}

/**
 * Exporta um PDF Executivo Formatado contendo Logo, KPIs, Dados dos Hidrômetros e Gráficos ativos
 */
export function exportToPDF(cycleStats, comparisonStats, trendChartCanvas, comparisonChartCanvas) {
  if (typeof html2pdf === 'undefined') {
    // Fallback para impressão nativa caso a CDN falhe ou esteja sem internet
    window.print();
    return;
  }

  // Captura as imagens dos gráficos em Base64
  let trendImgSrc = '';
  let compImgSrc = '';
  
  try {
    if (trendChartCanvas) {
      trendImgSrc = trendChartCanvas.toDataURL('image/png');
    }
    if (comparisonChartCanvas) {
      compImgSrc = comparisonChartCanvas.toDataURL('image/png');
    }
  } catch (e) {
    console.error('Erro ao converter gráficos para imagem:', e);
  }

  const settings = getAppSettings();
  const emissionDate = formatDate(new Date(), true);

  // Cria um elemento temporário com a estrutura e estilo do PDF
  const element = document.createElement('div');
  element.style.padding = '30px';
  element.style.color = '#111827';
  element.style.background = '#ffffff';
  element.style.fontFamily = "'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
  element.style.fontSize = '12px';
  element.style.lineHeight = '1.4';

  // Cabeçalho da Empresa
  let headerHtml = `
    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #3b82f6; padding-bottom: 15px; margin-bottom: 20px;">
      <div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 24px;">🇮🇹</span>
          <h1 style="font-size: 20px; font-weight: 800; color: #1e3a8a; margin: 0; text-transform: uppercase; letter-spacing: -0.5px;">Mamma Mia</h1>
        </div>
        <p style="font-size: 10px; color: #4b5563; margin: 2px 0 0 0; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600;">Mamma Mia Control - Gestão de Consumo de Água</p>
      </div>
      <div style="text-align: right;">
        <h2 style="font-size: 11px; color: #1f2937; margin: 0; font-weight: 700;">RELATÓRIO EXECUATIVO DE CONSUMO</h2>
        <p style="font-size: 9px; color: #6b7280; margin: 2px 0 0 0;">Emitido em: ${emissionDate}</p>
        <p style="font-size: 10px; color: #2563eb; margin: 2px 0 0 0; font-weight: 700;">Ciclo Analisado: ${cycleStats.label}</p>
      </div>
    </div>
  `;

  // Resumo de Metas do Ciclo (Card Executivo)
  const isEconomy = cycleStats.globalBalance >= 0;
  const saldoColor = isEconomy ? '#10b981' : '#ef4444';
  
  let statsHtml = `
    <h3 style="font-size: 13px; font-weight: 700; color: #1e3a8a; margin-top: 0; margin-bottom: 10px; text-transform: uppercase;">1. Resumo Executivo do Ciclo</h3>
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 25px;">
      <div style="border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px; background: #f9fafb; text-align: center;">
        <p style="margin: 0; font-size: 9px; color: #6b7280; font-weight: 600; text-transform: uppercase;">Consumo Total</p>
        <p style="margin: 4px 0 0 0; font-size: 18px; font-weight: 700; color: #111827;">${cycleStats.totalConsumption.toFixed(2)} <span style="font-size: 11px; font-weight: 500;">m³</span></p>
        <p style="margin: 2px 0 0 0; font-size: 8px; color: #9ca3af;">Meta Global: ${settings.metaGlobal} m³</p>
      </div>
      <div style="border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px; background: #f9fafb; text-align: center;">
        <p style="margin: 0; font-size: 9px; color: #6b7280; font-weight: 600; text-transform: uppercase;">Saldo Restante</p>
        <p style="margin: 4px 0 0 0; font-size: 18px; font-weight: 700; color: ${saldoColor};">${cycleStats.globalBalance.toFixed(2)} <span style="font-size: 11px; font-weight: 500;">m³</span></p>
        <p style="margin: 2px 0 0 0; font-size: 8px; color: #9ca3af;">${isEconomy ? 'Dentro da meta' : 'Meta excedida'}</p>
      </div>
      <div style="border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px; background: #f9fafb; text-align: center;">
        <p style="margin: 0; font-size: 9px; color: #6b7280; font-weight: 600; text-transform: uppercase;">% Limite Utilizado</p>
        <p style="margin: 4px 0 0 0; font-size: 18px; font-weight: 700; color: #111827;">${cycleStats.globalPercentUsed}%</p>
        <div style="background: #e5e7eb; height: 3px; border-radius: 1px; margin: 4px auto 0 auto; width: 60px;">
          <div style="background: #3b82f6; height: 100%; width: ${Math.min(100, cycleStats.globalPercentUsed)}%;"></div>
        </div>
      </div>
      <div style="border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px; background: #f9fafb; text-align: center;">
        <p style="margin: 0; font-size: 9px; color: #6b7280; font-weight: 600; text-transform: uppercase;">Projeção do Ciclo</p>
        <p style="margin: 4px 0 0 0; font-size: 18px; font-weight: 700; color: #111827;">${cycleStats.totalProjection.toFixed(2)} <span style="font-size: 11px; font-weight: 500;">m³</span></p>
        <p style="margin: 2px 0 0 0; font-size: 8px; color: #9ca3af;">Projeção diária média</p>
      </div>
    </div>
  `;

  // Tabela Consolidada de Hidrômetros
  let tableRows = '';
  Object.keys(settings.hydrometers).forEach(id => {
    const m = cycleStats.meters[id];
    const indicatorColor = m.status === 'danger' ? '#ef4444' : (m.status === 'warning' ? '#f59e0b' : '#10b981');
    const indicatorText = m.status === 'danger' ? 'Excedido' : (m.status === 'warning' ? 'Alerta' : 'Normal');
    
    // Cálculo do indicador Faltam X m³ para Meta
    const textFaltam = m.balance >= 0 
      ? `Faltam ${m.balance.toFixed(2)} m³`
      : `Excedeu em ${Math.abs(m.balance).toFixed(2)} m³`;

    tableRows += `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 8px 5px; font-weight: 600; font-family: monospace;">${id}</td>
        <td style="padding: 8px 5px;">${m.alias}</td>
        <td style="padding: 8px 5px;">${m.name.split(' & ')[0]}</td>
        <td style="padding: 8px 5px; font-weight: 700; text-align: right;">${m.consumption.toFixed(3)} m³</td>
        <td style="padding: 8px 5px; text-align: right;">${m.limit} m³</td>
        <td style="padding: 8px 5px; font-weight: 600; text-align: right; color: ${m.balance >= 0 ? '#10b981' : '#ef4444'}">${textFaltam}</td>
        <td style="padding: 8px 5px; text-align: right;">${m.dailyAverage.toFixed(3)} m³/d</td>
        <td style="padding: 8px 5px; font-weight: 700; text-align: right; color: ${m.projection > m.limit ? '#ef4444' : '#111827'}">${m.projection.toFixed(2)} m³</td>
        <td style="padding: 8px 5px; text-align: center;"><span style="background: ${indicatorColor}15; color: ${indicatorColor}; border: 1px solid ${indicatorColor}30; padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 9px; text-transform: uppercase;">${indicatorText}</span></td>
      </tr>
    `;
  });

  let tableHtml = `
    <h3 style="font-size: 13px; font-weight: 700; color: #1e3a8a; margin-top: 0; margin-bottom: 10px; text-transform: uppercase;">2. Detalhamento por Hidrômetro</h3>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 10.5px;">
      <thead>
        <tr style="background: #f3f4f6; border-bottom: 2px solid #d1d5db; font-weight: 700; text-align: left;">
          <th style="padding: 8px 5px;">Hidrômetro</th>
          <th style="padding: 8px 5px;">Apelido</th>
          <th style="padding: 8px 5px;">Área / Localização</th>
          <th style="padding: 8px 5px; text-align: right;">Consumido</th>
          <th style="padding: 8px 5px; text-align: right;">Meta</th>
          <th style="padding: 8px 5px; text-align: right;">Saldo</th>
          <th style="padding: 8px 5px; text-align: right;">Média Diária</th>
          <th style="padding: 8px 5px; text-align: right;">Projeção</th>
          <th style="padding: 8px 5px; text-align: center;">Status</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>
  `;

  // Comparação com ciclo anterior
  let compHtml = '';
  if (comparisonStats && comparisonStats.prevLabel !== 'N/A') {
    const compLabel = comparisonStats.isEconomy ? 'Economia no Ciclo' : 'Aumento no Consumo';
    const compColor = comparisonStats.isEconomy ? '#10b981' : '#ef4444';
    const compSign = comparisonStats.isEconomy ? '-' : '+';
    
    compHtml = `
      <h3 style="font-size: 13px; font-weight: 700; color: #1e3a8a; margin-top: 0; margin-bottom: 10px; text-transform: uppercase;">3. Comparativo de Consumo entre Períodos</h3>
      <div style="display: flex; gap: 15px; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; margin-bottom: 25px; background: #fafafa;">
        <div style="flex: 1; text-align: center; border-right: 1px dashed #d1d5db;">
          <span style="font-size: 9px; color: #6b7280; font-weight: 600; text-transform: uppercase;">Ciclo Anterior (${comparisonStats.prevLabel})</span>
          <p style="margin: 4px 0 0 0; font-size: 15px; font-weight: 700;">${comparisonStats.prevConsumption.toFixed(3)} m³</p>
        </div>
        <div style="flex: 1; text-align: center; border-right: 1px dashed #d1d5db;">
          <span style="font-size: 9px; color: #6b7280; font-weight: 600; text-transform: uppercase;">Ciclo Atual (${comparisonStats.currentLabel})</span>
          <p style="margin: 4px 0 0 0; font-size: 15px; font-weight: 700;">${comparisonStats.currentConsumption.toFixed(3)} m³</p>
        </div>
        <div style="flex: 1.2; text-align: center;">
          <span style="font-size: 9px; color: #6b7280; font-weight: 600; text-transform: uppercase;">Variação (Economia / Aumento)</span>
          <p style="margin: 4px 0 0 0; font-size: 15px; font-weight: 700; color: ${compColor};">
            ${compSign}${comparisonStats.diff.toFixed(3)} m³ (${compSign}${comparisonStats.percentDiff}%)
          </p>
        </div>
      </div>
    `;
  }

  // Gráficos como Imagem no PDF
  let chartsHtml = '';
  if (trendImgSrc || compImgSrc) {
    chartsHtml = `
      <div style="page-break-before: always; padding-top: 15px;"></div>
      ${headerHtml}
      <h3 style="font-size: 13px; font-weight: 700; color: #1e3a8a; margin-top: 0; margin-bottom: 15px; text-transform: uppercase;">4. Análise Gráfica de Tendência</h3>
      <div style="display: flex; flex-direction: column; gap: 20px;">
        ${trendImgSrc ? `
          <div style="text-align: center; border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px;">
            <p style="margin: 0 0 8px 0; font-size: 10px; color: #4b5563; font-weight: 600; text-align: left;">Curva de Consumo Acumulado Diário no Ciclo (m³)</p>
            <img src="${trendImgSrc}" style="width: 100%; max-height: 250px; object-fit: contain;">
          </div>
        ` : ''}
        ${compImgSrc ? `
          <div style="text-align: center; border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px; margin-top: 10px;">
            <p style="margin: 0 0 8px 0; font-size: 10px; color: #4b5563; font-weight: 600; text-align: left;">Comparativo de Volumes Totais por Canal (m³)</p>
            <img src="${compImgSrc}" style="width: 100%; max-height: 180px; object-fit: contain;">
          </div>
        ` : ''}
      </div>
    `;
  }

  // Rodapé do PDF
  let footerHtmlText = `
    <div style="border-top: 1px solid #d1d5db; padding-top: 10px; margin-top: 30px; display: flex; justify-content: space-between; font-size: 8px; color: #9ca3af; font-weight: 500;">
      <span>Mamma Mia Water System v2.0 - Relatório Operacional Automatizado</span>
      <span>Página 1 de 2</span>
    </div>
  `;

  element.innerHTML = `
    ${headerHtml}
    ${statsHtml}
    ${tableHtml}
    ${compHtml}
    ${footerHtmlText}
    ${chartsHtml}
  `;

  console.log('CONTEÚDO DO ELEMENT:', element.innerHTML.length, element.innerHTML.substring(0, 500));
  // IMPORTANTE: precisa estar no DOM para o html2canvas renderizar corretamente
  element.style.position = 'absolute';
  element.style.top = '0';
  element.style.left = '-9999px';
  element.style.width = '210mm';
  document.body.appendChild(element);

  // Configurações do html2pdf.js
  const opt = {
    margin: 10,
    filename: `mamma_mia_relatorio_agua_${cycleStats.cycleKey}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };
 
  // Executa e gera o PDF, depois remove o elemento temporário
  html2pdf().from(element).set(opt).save().then(() => {
    document.body.removeChild(element);
  }).catch((err) => {
    console.error('Erro ao gerar PDF:', err);
    document.body.removeChild(element);
  });
}

/**
 * Auxiliares
 */
function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function getFormattedDateISO() {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}
