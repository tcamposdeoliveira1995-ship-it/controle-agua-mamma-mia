/**
 * Leitura da aba VALOR CONTAS (planilha CONSUMO_AGUA_YUKA).
 * CSV publicado, no mesmo padrão do Caminhão Pipa: MES, RELOGIO, VALOR
 * e TOTAL_MES (também aceita "TOTAL MES"). Planilha só com cabeçalho
 * devolve lista vazia — não é erro.
 */

function chaveCabecalho(texto) {
  return String(texto || '')
    .replace(/^\uFEFF/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[\s_]+/g, '');
}

// Mesmo recorte de CSV do Pipa: aspas, vírgula dentro de campo e
// coluna em branco entre VALOR e TOTAL MES.
function parseCsv(texto) {
  const linhas = [];
  const rows = String(texto || '').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  for (const row of rows) {
    if (row.trim() === '') continue;
    const campos = [];
    let i = 0;
    while (i < row.length) {
      if (row[i] === '"') {
        let val = '';
        i++;
        while (i < row.length) {
          if (row[i] === '"' && row[i + 1] === '"') { val += '"'; i += 2; }
          else if (row[i] === '"') { i++; break; }
          else { val += row[i++]; }
        }
        campos.push(val.trim());
        if (row[i] === ',') i++;
      } else {
        let val = '';
        while (i < row.length && row[i] !== ',') val += row[i++];
        campos.push(val.trim());
        if (row[i] === ',') i++;
      }
    }
    linhas.push(campos);
  }
  return linhas;
}

// "1.234,56", "1234.56", "R$ 1.234,56" e "10,5". Vazio vira null.
export function parseValorReais(raw) {
  if (raw === null || raw === undefined) return null;
  let s = String(raw).trim();
  if (!s || s === '-' || s === '—') return null;
  s = s.replace(/R\$\s*/gi, '').replace(/\s/g, '');
  if (!s) return null;

  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  if (hasComma && hasDot) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (hasComma) {
    s = s.replace(',', '.');
  } else if (hasDot && /^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '');
  }

  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function parseContasAguaCsv(csv) {
  const texto = String(csv || '').replace(/^\uFEFF/, '');
  if (/^\s*</.test(texto) || /<!doctype html/i.test(texto.slice(0, 300))) {
    throw new Error('Resposta da planilha em formato inesperado');
  }

  const linhas = parseCsv(texto);
  if (linhas.length === 0) return [];

  const cab = linhas[0].map(chaveCabecalho);
  const idxMes = cab.indexOf('MES');
  const idxRelogio = cab.indexOf('RELOGIO');
  const idxValor = cab.indexOf('VALOR');
  const idxTotal = cab.indexOf('TOTALMES');
  if (idxMes < 0 || idxRelogio < 0 || idxValor < 0) {
    throw new Error('Colunas de VALOR CONTAS não reconhecidas');
  }

  const porChave = new Map();
  for (let i = 1; i < linhas.length; i++) {
    const cols = linhas[i];
    if (!cols || cols.every(c => !String(c || '').trim())) continue;
    const mes = String(cols[idxMes] || '').trim();
    const relogio = String(cols[idxRelogio] || '').trim();
    if (!mes || !relogio) continue;
    const valor = parseValorReais(cols[idxValor]);
    const totalMes = idxTotal >= 0 ? parseValorReais(cols[idxTotal]) : null;
    porChave.set(`${mes}|${relogio.toUpperCase()}`, { mes, relogio, valor, totalMes });
  }
  return Array.from(porChave.values());
}

// Ciclo "2026-09" (dia 7 a dia 6) -> competência "09/2026" da conta.
export function mesCompetenciaDoCiclo(cycleKey) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(cycleKey || ''));
  if (!m) return null;
  return `${m[2]}/${m[1]}`;
}

function chaveMes(mes) {
  const texto = String(mes || '').trim();
  const br = /^(\d{1,2})[\/\-.](\d{4})$/.exec(texto);
  if (br) return Number(br[2]) * 100 + Number(br[1]);
  const iso = /^(\d{4})-(\d{2})$/.exec(texto);
  if (iso) return Number(iso[1]) * 100 + Number(iso[2]);
  return 0;
}

export function agruparContasPorMes(contas) {
  const porMes = new Map();
  for (const conta of contas || []) {
    if (!porMes.has(conta.mes)) porMes.set(conta.mes, []);
    porMes.get(conta.mes).push(conta);
  }
  const grupos = [];
  for (const [mes, itens] of porMes) {
    const totais = itens.map(i => i.totalMes).filter(v => v !== null && v !== undefined && Number.isFinite(v));
    const temValor = itens.some(i => Number.isFinite(i.valor));
    const soma = itens.reduce((s, i) => s + (Number.isFinite(i.valor) ? i.valor : 0), 0);
    grupos.push({
      mes,
      itens,
      total: totais.length > 0 ? totais[totais.length - 1] : (temValor ? soma : null)
    });
  }
  grupos.sort((a, b) => chaveMes(b.mes) - chaveMes(a.mes));
  return grupos;
}

export function contaDoRelogio(contas, mes, relogio) {
  const alvo = String(relogio || '').trim().toUpperCase();
  const mesNorm = String(mes || '').trim();
  const achadas = (contas || []).filter(c => c.mes === mesNorm && String(c.relogio).trim().toUpperCase() === alvo);
  return achadas.length ? achadas[achadas.length - 1] : null;
}

export function formatarReais(valor) {
  if (valor === null || valor === undefined || !Number.isFinite(Number(valor))) return '—';
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
