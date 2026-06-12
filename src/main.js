/**
 * src/main.js - Controlador Central (Versão 2.0)
 * Controle de Consumo de Água - Mamma Mia
 */

import { 
  initializeData, 
  saveReadings, 
  calculateConsumptions, 
  getCycleStats, 
  getAvailableCycles, 
  compareCycles,
  parseCSV,
  formatDate,
  getAppSettings,
  saveAppSettings,
  checkDuplicateDayReading
} from './data.js';

import { 
  renderTrendChart, 
  renderComparisonChart 
} from './chart-setup.js';

import {
  exportToJSON,
  exportToCSV,
  exportToExcel,
  exportToPDF,
  syncGoogleSheetsFuture
} from './integration.js';

// --- ESTADO GLOBAL ---
let state = {
  readings: [],
  selectedCycleKey: '', // Ciclo geral ativo
  currentTab: 'dashboard',
  filters: {
    meter: 'all'
  }
};

// --- ELEMENTOS DO DOM ---
const DOM = {
  // Tabs
  tabButtons: document.querySelectorAll('.tab-btn'),
  tabPanels: document.querySelectorAll('.tab-panel'),
  
  // Header / Seletores
  cycleSelect: document.getElementById('cycle-select'),
  filterMeter: document.getElementById('filter-meter-v2'),
  
  // Card Executivo Principal (Topo)
  mainExecPeriodLabel: document.getElementById('main-exec-period-label'),
  mainExecMeta: document.getElementById('main-exec-meta'),
  mainExecConsumed: document.getElementById('main-exec-consumed'),
  mainExecBalance: document.getElementById('main-exec-balance'),
  mainExecPercent: document.getElementById('main-exec-percent'),
  mainExecDaysLeft: document.getElementById('main-exec-days-left'),
  mainExecProgressBar: document.getElementById('main-exec-progress-bar'),
  
  // KPIs Expandidos
  valAlertsV2: document.getElementById('val-alerts-v2'),
  valAlertsSubtextV2: document.getElementById('val-alerts-subtext-v2'),
  valAvgGeneral: document.getElementById('val-avg-general'),
  valHighestConsumer: document.getElementById('val-highest-consumer'),
  valHighestConsumerSub: document.getElementById('val-highest-consumer-sub'),
  valLowestConsumer: document.getElementById('val-lowest-consumer'),
  valLowestConsumerSub: document.getElementById('val-lowest-consumer-sub'),
  valProjGlobal: document.getElementById('val-proj-global'),
  valProjGlobalSub: document.getElementById('val-proj-global-sub'),
  valEconomyProjected: document.getElementById('val-economy-projected'),
  valEconomyProjectedSub: document.getElementById('val-economy-projected-sub'),
  
  // Comparativo e Vazamento
  comparadorBadgeV2: document.getElementById('comparador-badge-v2'),
  comparadorDetailsV2: document.getElementById('comparador-details-v2'),
  leakAlertBanner: document.getElementById('leak-alert-banner'),
  leakAlertDesc: document.getElementById('leak-alert-desc'),
  
  // Alertas Operacionais
  operationalAlertsPanel: document.getElementById('operational-alerts-panel'),
  operationalAlertsList: document.getElementById('operational-alerts-list'),
  
  // Containers
  metersCardsContainer: document.getElementById('hidrometros-cards-container-v2'),
  readingsTableBody: document.getElementById('readings-table-body-v2'),
  tableRecordCount: document.getElementById('table-record-count-v2'),
  
  // Gráficos
  trendChartCanvas: document.getElementById('trendChartV2'),
  comparisonChartCanvas: document.getElementById('comparisonChartV2'),
  
  // Botões e Ações
  btnOpenReadingModal: document.getElementById('btn-open-reading-modal-v2'),
  btnOpenCsvModal: document.getElementById('btn-open-csv-modal-v2'),
  btnGoogleSheetsImport: document.getElementById('btn-google-sheets-import'),
  
  btnExportPdf: document.getElementById('btn-export-pdf'),
  btnExportXlsx: document.getElementById('btn-export-xlsx'),
  btnExportCsv: document.getElementById('btn-export-csv'),
  btnExportJson: document.getElementById('btn-export-json'),
  
  // Modais Leituras
  modalReading: document.getElementById('modal-reading-v2'),
  btnCloseReadingModal: document.getElementById('btn-close-reading-modal-v2'),
  btnCancelReading: document.getElementById('btn-cancel-reading-v2'),
  formReading: document.getElementById('form-reading-v2'),
  inputMeter: document.getElementById('input-meter-v2'),
  inputIndex: document.getElementById('input-index-v2'),
  inputDate: document.getElementById('input-date-v2'),
  lastReadingHelp: document.getElementById('last-reading-help-v2'),
  
  // Modais CSV
  modalCsv: document.getElementById('modal-csv-v2'),
  btnCloseCsvModal: document.getElementById('btn-close-csv-modal-v2'),
  btnCloseCsvModalFooter: document.getElementById('btn-close-csv-modal-footer-v2'),
  csvDragZone: document.getElementById('csv-drag-zone-v2'),
  csvFileInput: document.getElementById('csv-file-input-v2'),
  csvErrorsContainer: document.getElementById('csv-errors-container-v2'),
  csvErrorsList: document.getElementById('csv-errors-list-v2'),
  
  // --- ABA 2: MODO DIRETORIA ---
  btnPrintPresentation: document.getElementById('btn-print-presentation'),
  dirEmissionDate: document.getElementById('dir-emission-date'),
  dirCycleLabel: document.getElementById('dir-cycle-label'),
  dirExecPeriod: document.getElementById('dir-exec-period'),
  dirExecConsumed: document.getElementById('dir-exec-consumed'),
  dirExecMetaVal: document.getElementById('dir-exec-meta-val'),
  dirExecBalance: document.getElementById('dir-exec-balance'),
  dirExecBalanceSub: document.getElementById('dir-exec-balance-sub'),
  dirExecProjection: document.getElementById('dir-exec-projection'),
  dirExecProjectionSub: document.getElementById('dir-exec-projection-sub'),
  dirExecProgressBar: document.getElementById('dir-exec-progress-bar'),
  dirKpiEconomy: document.getElementById('dir-kpi-economy'),
  dirKpiEconomySub: document.getElementById('dir-kpi-economy-sub'),
  dirKpiAlerts: document.getElementById('dir-kpi-alerts'),
  dirKpiAvgGeneral: document.getElementById('dir-kpi-avg-general'),
  dirRankingList: document.getElementById('dir-ranking-list'),
  dirTableSummary: document.getElementById('dir-table-summary'),
  
  // --- ABA 3: HISTÓRICO DE CICLOS ---
  historyCyclesTbody: document.getElementById('history-cycles-tbody'),
  compCycle1: document.getElementById('comp-cycle-1'),
  compCycle2: document.getElementById('comp-cycle-2'),
  btnRunCyclesComparison: document.getElementById('btn-run-cycles-comparison'),
  cyclesComparisonResults: document.getElementById('cycles-comparison-results'),
  compResultsTitle: document.getElementById('comp-results-title'),
  compResultsSub: document.getElementById('comp-results-sub'),
  compResultsBadge: document.getElementById('comp-results-badge'),
  compResultsTbody: document.getElementById('comp-results-tbody'),
  
  // --- ABA 4: CONFIGURAÇÕES ---
  formAdminSettings: document.getElementById('form-admin-settings'),
  btnSaveAdminSettings: document.getElementById('btn-save-admin-settings'),
  adminMetaGlobal: document.getElementById('admin-meta-global'),
  adminMetaIndividual: document.getElementById('admin-meta-individual'),
  adminAlertThreshold: document.getElementById('admin-alert-threshold'),
  adminLeakThreshold: document.getElementById('admin-leak-threshold'),
  adminMetersList: document.getElementById('admin-meters-list'),
  
  toastContainer: document.getElementById('toast-container-v2')
};

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
  state.readings = initializeData();
  
  // Preenche filtros e seletores
  updateAppSelectors();
  resetReadingFormDate();
  
  // Carrega as abas e views
  switchTab(state.currentTab);
  initEventListeners();
  
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
});

// --- RENDERIZADORES GERAIS ---

function refreshApp() {
  const availableCycles = getAvailableCycles(state.readings);
  
  if (!state.selectedCycleKey || !availableCycles.includes(state.selectedCycleKey)) {
    state.selectedCycleKey = availableCycles[0] || '';
  }

  if (!state.selectedCycleKey) return;

  const stats = getCycleStats(state.readings, state.selectedCycleKey);
  
  // Acha o ciclo anterior para comparativos
  const currentIndex = availableCycles.indexOf(state.selectedCycleKey);
  const prevCycleKey = currentIndex !== -1 && currentIndex < availableCycles.length - 1
    ? availableCycles[currentIndex + 1]
    : null;
    
  let prevStats = null;
  if (prevCycleKey) {
    prevStats = getCycleStats(state.readings, prevCycleKey);
  }

  // Renderiza conforme a aba ativa para economizar recursos e evitar erros
if (state.currentTab === 'dashboard') {
  renderDashboardTab(stats, prevStats);

} else if (state.currentTab === 'os') {
  carregarOS();

} else if (state.currentTab === 'perdas') {
  // futuro módulo perdas

} else if (state.currentTab === 'requisicoes') {
  // futuro módulo requisições

} else if (state.currentTab === 'configuracoes') {
  renderConfiguracoesTab();
}

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

/**
 * Atualiza dropdowns de ciclo do header e histórico
 */
function updateAppSelectors() {
  const cycles = getAvailableCycles(state.readings);
  
  DOM.cycleSelect.innerHTML = '';
  cycles.forEach(c => {
    const option = document.createElement('option');
    option.value = c;
    const stats = getCycleStats(state.readings, c);
    option.textContent = stats.label;
    DOM.cycleSelect.appendChild(option);
  });

  DOM.filterMeter.innerHTML = '<option value="all">Todos os Hidrômetros</option>';
  const settings = getAppSettings();
  Object.keys(settings.hydrometers).forEach(id => {
    const h = settings.hydrometers[id];
    const option = document.createElement('option');
    option.value = id;
    option.textContent = `${id} (${h.alias})`;
    DOM.filterMeter.appendChild(option);
  });

  if (state.selectedCycleKey) {
    DOM.cycleSelect.value = state.selectedCycleKey;
  }
}

// ================= RENDERIZADORES DE ABAS =================

/**
 * ABA 1: Painel Operacional Principal
 */
function renderDashboardTab(stats, prevStats) {
  const settings = getAppSettings();
  
  // 1. Preenche o Card Executivo Principal de Metas
  DOM.mainExecPeriodLabel.textContent = `${formatDate(stats.startDate)} a ${formatDate(stats.endDate)}`;
  DOM.mainExecMeta.innerHTML = `${stats.metaGlobal.toFixed(2)} <span class="exec-unit">m³</span>`;
  DOM.mainExecConsumed.innerHTML = `${stats.totalConsumption.toFixed(2)} <span class="exec-unit">m³</span>`;
  
  const isGlobalEconomy = stats.globalBalance >= 0;
  DOM.mainExecBalance.textContent = `${stats.globalBalance.toFixed(2)} m³`;
  if (isGlobalEconomy) {
    DOM.mainExecBalance.className = 'exec-val text-glow-green';
  } else {
    DOM.mainExecBalance.className = 'exec-val text-glow-red';
  }
  
  DOM.mainExecPercent.textContent = `${stats.globalPercentUsed}%`;
  DOM.mainExecDaysLeft.innerHTML = `${stats.remainingDays} <span class="exec-unit">dias</span>`;
  DOM.mainExecProgressBar.style.width = `${Math.min(100, stats.globalPercentUsed)}%`;
  
  if (stats.totalConsumption > stats.metaGlobal) {
    DOM.mainExecProgressBar.style.background = 'var(--grad-danger)';
  } else if (stats.totalConsumption > (stats.metaGlobal * (settings.alertThreshold / 100))) {
    DOM.mainExecProgressBar.style.background = 'var(--grad-warning)';
  } else {
    DOM.mainExecProgressBar.style.background = 'var(--grad-primary)';
  }

  // 2. Preenche os KPIs Expandidos
  DOM.valAlertsV2.textContent = stats.alertMetersCount;
  if (stats.alertMetersCount > 0) {
    DOM.valAlertsV2.parentElement.style.color = 'var(--color-red)';
    DOM.valAlertsSubtextV2.innerHTML = `<span class="pulse-red"></span> Contém hidrômetro crítico`;
  } else {
    DOM.valAlertsV2.parentElement.style.color = 'var(--color-green)';
    DOM.valAlertsSubtextV2.textContent = 'Consumos sob controle';
  }

  DOM.valAvgGeneral.innerHTML = `${stats.generalDailyAverage.toFixed(2)} <span class="unit">m³/d</span>`;
  
  DOM.valHighestConsumer.textContent = stats.highestConsumer.name;
  DOM.valHighestConsumerSub.textContent = `Consumido: ${stats.highestConsumer.consumption.toFixed(2)} m³`;
  
  DOM.valLowestConsumer.textContent = stats.lowestConsumer.name;
  DOM.valLowestConsumerSub.textContent = `Consumido: ${stats.lowestConsumer.consumption.toFixed(2)} m³`;
  
  DOM.valProjGlobal.innerHTML = `${stats.totalProjection.toFixed(2)} <span class="unit">m³</span>`;
  if (stats.totalProjection > stats.metaGlobal) {
    DOM.valProjGlobalSub.innerHTML = `<span class="badge-alert" style="padding:1px 4px; font-size:0.75rem;">Excederá limite</span>`;
  } else {
    DOM.valProjGlobalSub.textContent = 'Dentro da meta projetada';
  }

  DOM.valEconomyProjected.innerHTML = `${Math.max(0, stats.projectedEconomy).toFixed(2)} <span class="unit">m³</span>`;
  DOM.valEconomyProjectedSub.textContent = stats.projectedEconomy >= 0 ? 'Economia prevista' : 'Nenhuma economia prevista';

  // 3. Comparativo com Ciclo Anterior
  if (prevStats) {
    const comp = compareCycles(state.readings, stats.cycleKey, prevStats.cycleKey);
    DOM.comparadorDetailsV2.textContent = `Consumo Atual: ${stats.totalConsumption.toFixed(2)} m³ | Anterior: ${prevStats.totalConsumption.toFixed(2)} m³`;
    
    if (comp.isEconomy) {
      DOM.comparadorBadgeV2.className = 'comparador-resultado economia';
      DOM.comparadorBadgeV2.innerHTML = `<i data-lucide="arrow-down"></i>Economia de ${comp.diff.toFixed(2)} m³ (-${comp.percentDiff}%)`;
    } else {
      DOM.comparadorBadgeV2.className = 'comparador-resultado aumento';
      DOM.comparadorBadgeV2.innerHTML = `<i data-lucide="arrow-up"></i>Aumento de ${comp.diff.toFixed(2)} m³ (+${comp.percentDiff}%)`;
    }
  } else {
    DOM.comparadorDetailsV2.textContent = 'Sem dados do ciclo anterior para comparação.';
    DOM.comparadorBadgeV2.className = 'comparador-resultado economia';
    DOM.comparadorBadgeV2.innerHTML = 'Primeiro Ciclo';
  }

  // 4. Detecção de Vazamentos e Alertas Operacionais
  let hasGlobalLeak = false;
  let allOperationalAlerts = [];
  
  Object.keys(stats.meters).forEach(id => {
    const m = stats.meters[id];
    if (m.hasLeak) {
      hasGlobalLeak = true;
    }
    if (m.operationalAlerts.length > 0) {
      allOperationalAlerts.push({ id, alias: m.alias, alerts: m.operationalAlerts });
    }
  });

  if (hasGlobalLeak) {
    DOM.leakAlertBanner.style.display = 'flex';
    // Acha o hidrômetro com vazamento
    const leakMeters = Object.values(stats.meters).filter(m => m.hasLeak).map(m => m.alias || m.id).join(', ');
    DOM.leakAlertDesc.textContent = `Pico anômalo diário detectado em: ${leakMeters}. Limiar: >${settings.leakThreshold} m³/dia.`;
  } else {
    DOM.leakAlertBanner.style.display = 'none';
  }

  // Alertas Operacionais (Fase 2)
  if (allOperationalAlerts.length > 0) {
    DOM.operationalAlertsPanel.style.display = 'block';
    DOM.operationalAlertsList.innerHTML = '';
    
    allOperationalAlerts.forEach(item => {
      item.alerts.forEach(alertText => {
        const box = document.createElement('div');
        box.className = alertText.includes('Vazamento') ? 'alert-item-box danger' : 'alert-item-box';
        box.innerHTML = `
          <i data-lucide="${alertText.includes('Vazamento') ? 'droplet-off' : 'alert-triangle'}" style="width:14px; height:14px; flex-shrink:0;"></i>
          <span><strong>${item.id} (${item.alias})</strong>: ${alertText}</span>
        `;
        DOM.operationalAlertsList.appendChild(box);
      });
    });
  } else {
    DOM.operationalAlertsPanel.style.display = 'none';
  }

  // 5. Grid de Cards dos Hidrômetros (Fase 1)
  renderIndividualMeterCards(stats);

  // 6. Atualiza Gráficos interativos
  const processedReadings = calculateConsumptions(state.readings);
  renderTrendChart(DOM.trendChartCanvas, stats, processedReadings);
  renderComparisonChart(DOM.comparisonChartCanvas, stats, prevStats);
}

/**
 * Renderiza os cards individuais de hidrômetros
 */
function renderIndividualMeterCards(stats) {
  DOM.metersCardsContainer.innerHTML = '';
  const settings = getAppSettings();
  
  Object.keys(settings.hydrometers).forEach(id => {
    const m = stats.meters[id];
    if (!m) return;
    
    // Status visual
    let statusClass = 'badge-success';
    let statusText = 'Normal';
    let cardGlow = '';
    let barGradient = 'linear-gradient(90deg, #3b82f6 0%, #10b981 100%)';
    
    if (m.status === 'danger') {
      statusClass = 'badge-alert';
      statusText = 'Excedido';
      cardGlow = 'border-color: rgba(239, 68, 68, 0.4); box-shadow: 0 10px 25px rgba(239, 68, 68, 0.08);';
      barGradient = 'var(--grad-danger)';
    } else if (m.status === 'warning') {
      statusClass = 'badge-warning';
      statusText = 'Atenção';
      cardGlow = 'border-color: rgba(245, 158, 11, 0.4);';
      barGradient = 'var(--grad-warning)';
    }

    // Faltam X m³
    let textFaltam = '';
    let faltamClass = 'success';
    if (m.balance >= 0) {
      textFaltam = `🎯 Faltam ${m.balance.toFixed(2)} m³ para meta`;
      faltamClass = m.balance < (m.limit * 0.25) ? 'warning' : 'success';
    } else {
      textFaltam = `🎯 Limite excedido em ${Math.abs(m.balance).toFixed(2)} m³`;
      faltamClass = 'danger';
    }

    // Semáforo Diário
    let dailyDotClass = 'success';
    let dailyStatusTitle = 'Abaixo da meta esperada';
    if (m.dailyGoalStatus === 'danger') {
      dailyDotClass = 'danger';
      dailyStatusTitle = 'Acima da meta esperada';
    } else if (m.dailyGoalStatus === 'warning') {
      dailyDotClass = 'warning';
      dailyStatusTitle = 'Próximo da meta esperada';
    }

    const card = document.createElement('div');
    card.className = 'hidrometro-card';
    card.style = cardGlow;
    card.innerHTML = `
      <div class="card-header-meter">
        <div class="meter-alias-row">
          <span class="meter-alias" id="card-alias-${id}">${m.alias}</span>
          <button class="btn-edit-alias no-print" data-id="${id}" title="Alterar apelido">
            <i data-lucide="edit-3"></i>
          </button>
        </div>
        <span class="${statusClass}">${statusText}</span>
      </div>
      <div class="meter-title-block">
        <h3 title="${m.name}">${m.name.split(' & ')[0]}</h3>
        <span class="meter-id-label">${id}</span>
      </div>

      <div class="faltam-indicator-tag ${faltamClass}">
        ${textFaltam}
      </div>

      <div class="progress-container">
        <div class="progress-label-row">
          <span>${m.consumption.toFixed(2)} m³</span>
          <span style="color: var(--text-muted);">Meta: ${m.limit} m³</span>
        </div>
        <div class="progress-track">
          <div class="progress-bar" style="width: ${Math.min(100, m.percentUsed)}%; background: ${barGradient};"></div>
          <div class="progress-marker" style="left: ${settings.alertThreshold}%;" title="Aviso (${settings.alertThreshold}%)"></div>
        </div>
      </div>

      <div class="meter-stats-list">
        <div class="stat-item">
          <span class="stat-label">Meta Diária Esperada</span>
          <span class="stat-val meta-diaria-val" title="${dailyStatusTitle}">
            <span class="daily-status-dot ${dailyDotClass}"></span>
            ${m.dailyGoal.toFixed(3)} m³
          </span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Consumo Médio Real</span>
          <span class="stat-val">${m.dailyAverage.toFixed(3)} m³</span>
        </div>
        <div class="stat-item full-width" style="border-top: 1px dashed rgba(255,255,255,0.05); padding-top: 0.5rem; margin-top: 0.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span class="stat-label">Projeção Fechamento</span>
            <span class="stat-val" style="font-weight: 700; color: ${m.projection > m.limit ? 'var(--color-red)' : 'var(--text-primary)'};">
              ${m.projection.toFixed(2)} m³
            </span>
          </div>
        </div>
      </div>
    `;

    DOM.metersCardsContainer.appendChild(card);
  });

  // Listener para editar apelidos inline (Fase 1/2)
  DOM.metersCardsContainer.querySelectorAll('.btn-edit-alias').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      editHydrometerAlias(id);
    });
  });
}

/**
 * ABA 2: Modo Apresentação Diretoria
 */
function renderDiretoriaTab(stats, prevStats) {
  DOM.dirEmissionDate.textContent = formatDate(new Date(), true);
  DOM.dirCycleLabel.textContent = stats.label;
  DOM.dirExecPeriod.textContent = `${formatDate(stats.startDate)} a ${formatDate(stats.endDate)}`;
  DOM.dirExecConsumed.textContent = `${stats.totalConsumption.toFixed(2)} m³`;
  DOM.dirExecMetaVal.textContent = `${stats.metaGlobal.toFixed(2)} m³`;

  const isGlobalEconomy = stats.globalBalance >= 0;
  DOM.dirExecBalance.textContent = `${stats.globalBalance.toFixed(2)} m³`;
  if (isGlobalEconomy) {
    DOM.dirExecBalance.className = 'exec-val text-glow-green';
    DOM.dirExecBalanceSub.textContent = 'Dentro do limite global combinado';
  } else {
    DOM.dirExecBalance.className = 'exec-val text-glow-red';
    DOM.dirExecBalanceSub.textContent = 'Meta global ultrapassada';
  }

  DOM.dirExecProjection.textContent = `${stats.totalProjection.toFixed(2)} m³`;
  DOM.dirExecProjectionSub.textContent = stats.totalProjection > stats.metaGlobal 
    ? 'Possível excesso ao fechar o ciclo'
    : 'Projeção dentro do esperado';

  DOM.dirExecProgressBar.style.width = `${Math.min(100, stats.globalPercentUsed)}%`;
  
  if (prevStats) {
    const comp = compareCycles(state.readings, stats.cycleKey, prevStats.cycleKey);
    DOM.dirKpiEconomy.textContent = `${comp.diff.toFixed(2)} m³`;
    DOM.dirKpiEconomySub.textContent = comp.isEconomy ? `Economia de -${comp.percentDiff}%` : `Aumento de +${comp.percentDiff}%`;
    DOM.dirKpiEconomy.style.color = comp.isEconomy ? 'var(--color-green)' : 'var(--color-red)';
  } else {
    DOM.dirKpiEconomy.textContent = '0.00 m³';
    DOM.dirKpiEconomySub.textContent = 'Primeiro Ciclo';
  }

  DOM.dirKpiAlerts.textContent = `${stats.alertMetersCount} / 4`;
  DOM.dirKpiAvgGeneral.textContent = `${stats.generalDailyAverage.toFixed(2)} m³/d`;

  // Ranking de Performance (Fase 2)
  DOM.dirRankingList.innerHTML = '';
  stats.ranking.forEach(r => {
    let medal = '🥉';
    if (r.position === 1) medal = '🥇';
    else if (r.position === 2) medal = '🥈';
    
    const div = document.createElement('div');
    div.className = 'ranking-item';
    div.innerHTML = `
      <div class="ranking-left">
        <div class="ranking-position">${r.position}</div>
        <div class="ranking-details">
          <span class="ranking-name">${r.name.split(' & ')[0]} ${medal}</span>
          <span class="ranking-alias">${r.id} (${r.alias})</span>
        </div>
      </div>
      <div class="ranking-value">
        <span>${r.consumption.toFixed(2)} m³</span>
        <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 500;">${r.percentUsed}% da meta</div>
      </div>
    `;
    DOM.dirRankingList.appendChild(div);
  });

  // Tabela compacta de hidrômetros
  DOM.dirTableSummary.innerHTML = '';
  Object.keys(stats.meters).forEach(id => {
    const m = stats.meters[id];
    const indicatorColor = m.status === 'danger' ? 'var(--color-red)' : (m.status === 'warning' ? 'var(--color-orange)' : 'var(--color-green)');
    const indicatorText = m.status === 'danger' ? 'Excedido' : (m.status === 'warning' ? 'Atenção' : 'Normal');

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${id}</td>
      <td style="font-weight:600;">${m.alias}</td>
      <td style="font-weight:700;">${m.consumption.toFixed(2)} m³</td>
      <td>${m.limit} m³</td>
      <td><span style="color: ${indicatorColor}; font-weight:700;">${indicatorText}</span></td>
    `;
    DOM.dirTableSummary.appendChild(tr);
  });
}

/**
 * ABA 3: Histórico de Ciclos Fechados e Comparador
 */
function renderCyclesTab(cycles) {
  // 1. Tabela de ciclos fechados (Fase 2)
  DOM.historyCyclesTbody.innerHTML = '';
  
  if (cycles.length === 0) {
    DOM.historyCyclesTbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:2rem;">Nenhum ciclo registrado.</td></tr>';
    return;
  }

  cycles.forEach((c, index) => {
    const stats = getCycleStats(state.readings, c);
    
    // Acha economia
    let economyText = '0.00 m³';
    if (index < cycles.length - 1) {
      const prevC = cycles[index + 1];
      const comp = compareCycles(state.readings, c, prevC);
      const sign = comp.isEconomy ? '-' : '+';
      economyText = `${sign}${comp.diff.toFixed(2)} m³ (${sign}${comp.percentDiff}%)`;
    } else {
      economyText = 'Leitura Base';
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-weight: 700; color: var(--color-blue);">${stats.label}</td>
      <td style="font-weight: 600;">${stats.totalConsumption.toFixed(2)} m³</td>
      <td>${stats.metaGlobal} m³</td>
      <td style="color: ${economyText.includes('-') ? 'var(--color-green)' : (economyText.includes('+') ? 'var(--color-red)' : 'inherit')};">${economyText}</td>
      <td style="text-align:center;">${stats.alertMetersCount} / 4</td>
      <td>
        <span class="${stats.globalStatus === 'danger' ? 'badge-alert' : (stats.globalStatus === 'warning' ? 'badge-warning' : 'badge-success')}">
          ${stats.globalStatus === 'danger' ? 'Excedida' : (stats.globalStatus === 'warning' ? 'Alerta' : 'Abaixo da Meta')}
        </span>
      </td>
    `;
    DOM.historyCyclesTbody.appendChild(tr);
  });

  // 2. Popula os seletores do comparador de períodos
  DOM.compCycle1.innerHTML = '';
  DOM.compCycle2.innerHTML = '';
  cycles.forEach(c => {
    const stats = getCycleStats(state.readings, c);
    
    const opt1 = document.createElement('option');
    opt1.value = c;
    opt1.textContent = stats.label;
    DOM.compCycle1.appendChild(opt1);

    const opt2 = document.createElement('option');
    opt2.value = c;
    opt2.textContent = stats.label;
    DOM.compCycle2.appendChild(opt2);
  });

  if (cycles.length > 1) {
    DOM.compCycle2.value = cycles[1]; // Seta o segundo como default
  }
}

/**
 * ABA 4: Tela de Configurações Administrativas
 */
function renderConfiguracoesTab() {
  const settings = getAppSettings();
  
  DOM.adminMetaGlobal.value = settings.metaGlobal;
  DOM.adminMetaIndividual.value = settings.metaIndividual;
  DOM.adminAlertThreshold.value = settings.alertThreshold;
  DOM.adminLeakThreshold.value = settings.leakThreshold;

  // Lista os hidrômetros para edição (Apelidos e cores)
  DOM.adminMetersList.innerHTML = '';
  Object.keys(settings.hydrometers).forEach(id => {
    const h = settings.hydrometers[id];
    
    const div = document.createElement('div');
    div.className = 'meter-config-item';
    div.innerHTML = `
      <div class="meter-config-header">
        <h4>${id}</h4>
        <span>${h.name}</span>
      </div>
      <div class="form-group" style="margin-bottom: 0;">
        <label class="form-label" style="font-size:0.75rem;">Apelido</label>
        <input type="text" class="form-control admin-meter-alias-input" data-id="${id}" value="${h.alias}" required>
      </div>
      <div class="form-group" style="margin-bottom: 0;">
        <label class="form-label" style="font-size:0.75rem;">Cor do Indicador</label>
        <input type="color" class="form-control" data-id="${id}" value="${h.color}" style="height:38px; padding:2px; cursor:pointer;" required>
      </div>
    `;
    DOM.adminMetersList.appendChild(div);
  });
}

// ================= TABELA HISTÓRICO DE LEITURAS (ABAS) =================

function renderReadingsTable() {
  const meterFilter = state.filters.meter;
  const cycleFilter = state.selectedCycleKey;

  const processed = calculateConsumptions(state.readings);
  const settings = getAppSettings();

  const filtered = processed.filter(r => {
    if (meterFilter !== 'all' && r.meterId !== meterFilter) return false;
    
    if (cycleFilter) {
      const info = getCycleStats(state.readings, cycleFilter);
      const rDate = new Date(r.date);
      if (rDate < info.startDate || rDate > info.endDate) return false;
    }

    return true;
  });

  DOM.tableRecordCount.textContent = `${filtered.length} registro(s) no ciclo`;

  DOM.readingsTableBody.innerHTML = '';

  if (filtered.length === 0) {
    DOM.readingsTableBody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 2rem;">
          Nenhum lançamento encontrado para os filtros selecionados neste ciclo.
        </td>
      </tr>
    `;
    return;
  }

  filtered.forEach(r => {
    const meterInfo = settings.hydrometers[r.meterId] || { alias: 'Desconhecido', color: '#6b7280', name: 'N/A' };
    
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${formatDate(r.date, true)}</td>
      <td>
        <span class="cell-indicator" style="background-color: ${meterInfo.color};"></span>
        <span class="cell-meter">
          <span class="cell-meter-name">${meterInfo.name.split(' & ')[0]}</span>
          <span class="cell-meter-id">${r.meterId} (${meterInfo.alias})</span>
        </span>
      </td>
      <td style="font-weight: 500;">${r.index.toLocaleString('pt-BR', { minimumFractionDigits: 3 })} m³</td>
      <td style="font-weight: 600;">
        ${r.isInitial 
          ? '<span style="color: var(--text-muted); font-size: 0.8rem; font-weight: normal;">Leitura Inicial</span>' 
          : `+${r.consumption.toLocaleString('pt-BR', { minimumFractionDigits: 3 })} m³`}
      </td>
      <td>
        ${!r.isInitial ? `
          <button class="btn btn-danger btn-icon-only btn-delete-reading-v2" data-id="${r.id}" title="Excluir Leitura" type="button">
            <i data-lucide="x" style="width: 14px; height: 14px;"></i>
          </button>
        ` : '<span style="color: var(--text-muted); font-size: 0.8rem;">-</span>'}
      </td>
    `;
    
    DOM.readingsTableBody.appendChild(tr);
  });

  // Action listeners para exclusão
  DOM.readingsTableBody.querySelectorAll('.btn-delete-reading-v2').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      deleteReading(id);
    });
  });
}

// ================= CONTROLADORES DE EVENTOS E LOGICAS =================

function initEventListeners() {
  // Tab Switching
  DOM.tabButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tab = e.currentTarget.getAttribute('data-tab');
      switchTab(tab);
    });
  });

  // Header Selector Change
  DOM.cycleSelect.addEventListener('change', (e) => {
    state.selectedCycleKey = e.target.value;
    refreshApp();
  });

  // Filtros Histórico
  DOM.filterMeter.addEventListener('change', (e) => {
    state.filters.meter = e.target.value;
    renderReadingsTable();
    if (typeof lucide !== 'undefined') lucide.createIcons();
  });

  // Nova Leitura Modal controls
  DOM.btnOpenReadingModal.addEventListener('click', () => {
    resetReadingFormDate();
    updateLastReadingHelp();
    openModal(DOM.modalReading);
  });
  DOM.btnCloseReadingModal.addEventListener('click', () => closeModal(DOM.modalReading));
  DOM.btnCancelReading.addEventListener('click', () => closeModal(DOM.modalReading));
  DOM.inputMeter.addEventListener('change', updateLastReadingHelp);

  DOM.formReading.addEventListener('submit', (e) => {
    e.preventDefault();
    submitReadingForm();
  });

  // CSV Modal controls
  DOM.btnOpenCsvModal.addEventListener('click', () => {
    DOM.csvErrorsContainer.style.display = 'none';
    DOM.csvFileInput.value = '';
    openModal(DOM.modalCsv);
  });
  DOM.btnCloseCsvModal.addEventListener('click', () => closeModal(DOM.modalCsv));
  DOM.btnCloseCsvModalFooter.addEventListener('click', () => closeModal(DOM.modalCsv));
  
  DOM.csvDragZone.addEventListener('click', () => DOM.csvFileInput.click());
  DOM.csvFileInput.addEventListener('change', handleCsvFileSelect);
  DOM.csvDragZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    DOM.csvDragZone.classList.add('dragover');
  });
  DOM.csvDragZone.addEventListener('dragleave', () => DOM.csvDragZone.classList.remove('dragover'));
  DOM.csvDragZone.addEventListener('drop', (e) => {
    e.preventDefault();
    DOM.csvDragZone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      processCsvFile(e.dataTransfer.files[0]);
    }
  });

  // Integração Google Sheets Mock
  DOM.btnGoogleSheetsImport.addEventListener('click', () => {
    alert('Funcionalidade em desenvolvimento.');
    syncGoogleSheetsFuture(state.readings);
  });

  // Exportadores
  DOM.btnExportPdf.addEventListener('click', () => {
    showToast('Gerando relatório PDF...', 'info');
    const stats = getCycleStats(state.readings, state.selectedCycleKey);
    
    const availableCycles = getAvailableCycles(state.readings);
    const currentIndex = availableCycles.indexOf(state.selectedCycleKey);
    const prevCycleKey = currentIndex !== -1 && currentIndex < availableCycles.length - 1
      ? availableCycles[currentIndex + 1]
      : null;
    const comparison = compareCycles(state.readings, stats.cycleKey, prevCycleKey);

    exportToPDF(stats, comparison, DOM.trendChartCanvas, DOM.comparisonChartCanvas);
  });
  
  DOM.btnExportXlsx.addEventListener('click', () => {
    try {
      exportToExcel(state.readings);
      showToast('Planilha Excel (.xlsx) baixada!', 'success');
    } catch (e) {
      showToast(e.message, 'error');
    }
  });

  DOM.btnExportCsv.addEventListener('click', () => {
    exportToCSV(state.readings);
    showToast('Arquivo CSV baixado!', 'success');
  });

  DOM.btnExportJson.addEventListener('click', () => {
    exportToJSON(state.readings);
    showToast('Backup JSON baixado!', 'success');
  });

  // Modo Diretoria Print / Save PDF
  DOM.btnPrintPresentation.addEventListener('click', () => {
    window.print();
  });

  // Comparador de Períodos
  DOM.btnRunCyclesComparison.addEventListener('click', runCyclesComparison);

  // Configurações Salvar
  DOM.btnSaveAdminSettings.addEventListener('click', submitAdminSettings);
}

/**
 * Controla navegação entre abas
 */
function switchTab(tabName) {
  state.currentTab = tabName;
  
  DOM.tabButtons.forEach(btn => {
    if (btn.getAttribute('data-tab') === tabName) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  DOM.tabPanels.forEach(panel => {
    if (panel.getAttribute('id') === `tab-content-${tabName}`) {
      panel.classList.add('active');
    } else {
      panel.classList.remove('active');
    }
  });

  // Se for configurações, preenche inputs de hidrômetros antes de carregar
  if (tabName === 'configuracoes') {
    populateMetersSelectInputs();
  }

  refreshApp();
}

function openModal(modal) {
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
}

function closeModal(modal) {
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
}

/**
 * Reseta data/hora padrão do formulário para o tempo atual do contexto
 */
function resetReadingFormDate() {
  const now = new Date('2026-06-11T15:23:00');
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  
  DOM.inputDate.value = `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

/**
 * Popula os seletores de hidrômetro dinamicamente com base nas configurações
 */
function populateMetersSelectInputs() {
  const settings = getAppSettings();
  
  DOM.inputMeter.innerHTML = '';
  Object.keys(settings.hydrometers).forEach(id => {
    const h = settings.hydrometers[id];
    const option = document.createElement('option');
    option.value = id;
    option.textContent = `${id} - ${h.name} (${h.alias})`;
    DOM.inputMeter.appendChild(option);
  });
}

/**
 * Auxiliar para atualizar ajuda no lançamento manual
 */
function updateLastReadingHelp() {
  const meterId = DOM.inputMeter.value;
  if (!meterId) return;

  const meterReadings = state.readings
    .filter(r => r.meterId === meterId)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  if (meterReadings.length > 0) {
    const last = meterReadings[0];
    DOM.lastReadingHelp.textContent = `Última leitura: ${last.index.toLocaleString('pt-BR')} m³ em ${formatDate(last.date, true)}`;
    DOM.inputIndex.min = last.index;
    DOM.inputIndex.placeholder = `Mínimo: ${last.index.toFixed(3)}`;
  } else {
    DOM.lastReadingHelp.textContent = 'Sem leituras registradas.';
    DOM.inputIndex.removeAttribute('min');
    DOM.inputIndex.placeholder = 'Ex: 100.000';
  }
}

/**
 * Submissão de Lançamento Manual (Fase 1)
 */
function submitReadingForm() {
  const meterId = DOM.inputMeter.value;
  const index = parseFloat(DOM.inputIndex.value);
  const dateStr = DOM.inputDate.value;
  
  if (isNaN(index) || index < 0) {
    showToast('Leitura acumulada inválida.', 'error');
    return;
  }

  const newDate = new Date(dateStr);
  if (isNaN(newDate.getTime())) {
    showToast('Data e hora inválidas.', 'error');
    return;
  }

  // --- REGRA OBRIGATÓRIA: 1 Leitura por dia civil ---
  if (checkDuplicateDayReading(state.readings, meterId, newDate)) {
    showToast(`Bloqueado: O hidrômetro ${meterId} já possui uma leitura registrada para o dia civil ${formatDate(newDate)}. Limite de 1 por dia.`, 'error');
    return;
  }

  // Validação de Sequência
  const previousReading = state.readings
    .filter(r => r.meterId === meterId && new Date(r.date) < newDate)
    .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

  if (previousReading && index < previousReading.index) {
    showToast(`Erro: Leitura (${index} m³) menor que o registro anterior (${previousReading.index} m³) do dia ${formatDate(previousReading.date, true)}.`, 'error');
    return;
  }

  const nextReading = state.readings
    .filter(r => r.meterId === meterId && new Date(r.date) > newDate)
    .sort((a, b) => new Date(a.date) - new Date(b.date))[0];

  if (nextReading && index > nextReading.index) {
    showToast(`Erro: Leitura (${index} m³) maior que o registro posterior (${nextReading.index} m³) do dia ${formatDate(nextReading.date, true)}.`, 'error');
    return;
  }

  // Grava Leitura
  const newReading = {
    id: `reading-${meterId}-${newDate.getTime()}-${Math.floor(Math.random() * 1000)}`,
    meterId,
    date: newDate.toISOString(),
    index: Number(index.toFixed(3))
  };

  state.readings.push(newReading);
  state.readings.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  saveReadings(state.readings);
  updateAppSelectors();
  refreshApp();
  
  closeModal(DOM.modalReading);
  DOM.formReading.reset();
  showToast('Leitura adicionada com sucesso!', 'success');
}

/**
 * Exclui uma leitura
 */
function deleteReading(id) {
  if (confirm('Tem certeza que deseja excluir esta leitura? O consumo será recalculado.')) {
    state.readings = state.readings.filter(r => r.id !== id);
    saveReadings(state.readings);
    updateAppSelectors();
    refreshApp();
    showToast('Leitura excluída.', 'success');
  }
}

/**
 * Edição inline rápida do apelido (Fase 1/2)
 */
function editHydrometerAlias(id) {
  const settings = getAppSettings();
  const h = settings.hydrometers[id];
  if (!h) return;

  const newAlias = prompt(`Digite o novo apelido para o Hidrômetro ${id} (Atual: ${h.alias}):`, h.alias);
  if (newAlias === null) return; // Cancelado

  const cleanAlias = newAlias.trim().toUpperCase();
  if (!cleanAlias) {
    alert('Apelido não pode ser vazio!');
    return;
  }

  h.alias = cleanAlias;
  saveAppSettings(settings);
  updateAppSelectors();
  refreshApp();
  showToast(`Apelido do hidrômetro ${id} atualizado para "${cleanAlias}".`, 'success');
}

// ================= PLANILHAS CSV IMPORTER =================

function handleCsvFileSelect(e) {
  if (e.target.files.length > 0) {
    processCsvFile(e.target.files[0]);
  }
}

function processCsvFile(file) {
  const reader = new FileReader();
  
  reader.onload = function(e) {
    const csvText = e.target.result;
    
    try {
      const result = parseCSV(csvText, state.readings);
      
      state.readings = result.mergedReadings;
      saveReadings(state.readings);
      
      updateAppSelectors();
      refreshApp();
      
      let msg = `${result.importedCount} novas leituras importadas.`;
      if (result.overwrittenCount > 0) {
        msg += ` ${result.overwrittenCount} leituras diárias atualizadas para o valor mais recente.`;
      }
      showToast(msg, 'success');
      
      if (result.errorsCount > 0) {
        DOM.csvErrorsContainer.style.display = 'block';
        DOM.csvErrorsList.innerHTML = '';
        result.errors.forEach(err => {
          const li = document.createElement('li');
          li.textContent = err;
          DOM.csvErrorsList.appendChild(li);
        });
        showToast(`Importação com ${result.errorsCount} inconsistências ignoradas.`, 'warning');
      } else {
        DOM.csvErrorsContainer.style.display = 'none';
        closeModal(DOM.modalCsv);
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  reader.onerror = () => {
    showToast('Falha na leitura do arquivo CSV.', 'error');
  };

  reader.readAsText(file);
}

// ================= ABA 3: COMPARAÇÃO HISTÓRICA DETALHADA =================

function runCyclesComparison() {
  const cycleA = DOM.compCycle1.value;
  const cycleB = DOM.compCycle2.value;

  if (cycleA === cycleB) {
    showToast('Selecione dois ciclos diferentes para comparar.', 'warning');
    return;
  }

  const comparison = compareCycles(state.readings, cycleA, cycleB);
  
  DOM.cyclesComparisonResults.style.display = 'block';
  DOM.compResultsTitle.textContent = `Balanço Geral: Ciclo ${comparison.currentLabel} vs. Ciclo ${comparison.prevLabel}`;
  
  const diffVal = comparison.diff;
  const percentVal = comparison.percentDiff;

  if (comparison.isEconomy) {
    DOM.compResultsBadge.className = 'comparador-resultado economia';
    DOM.compResultsBadge.innerHTML = `<i data-lucide="arrow-down"></i>Economia de ${diffVal.toFixed(2)} m³ (-${percentVal}%)`;
    DOM.compResultsSub.textContent = `O consumo geral caiu de ${comparison.prevConsumption.toFixed(2)} m³ para ${comparison.currentConsumption.toFixed(2)} m³.`;
  } else {
    DOM.compResultsBadge.className = 'comparador-resultado aumento';
    DOM.compResultsBadge.innerHTML = `<i data-lucide="arrow-up"></i>Aumento de ${diffVal.toFixed(2)} m³ (+${percentVal}%)`;
    DOM.compResultsSub.textContent = `O consumo geral subiu de ${comparison.prevConsumption.toFixed(2)} m³ para ${comparison.currentConsumption.toFixed(2)} m³.`;
  }

  // Tabela detalhada por hidrômetro
  DOM.compResultsTbody.innerHTML = '';
  const settings = getAppSettings();
  
  Object.keys(settings.hydrometers).forEach(id => {
    const compMeter = comparison.meters[id];
    if (!compMeter) return;

    const meterInfo = settings.hydrometers[id];
    const economyStatusClass = compMeter.isEconomy ? 'badge-success' : 'badge-alert';
    const economyStatusText = compMeter.isEconomy ? `Economia (-${Math.abs(compMeter.percentDiff)}%)` : `Aumento (+${Math.abs(compMeter.percentDiff)}%)`;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-family:monospace;">${id}</td>
      <td style="font-weight:600;">${meterInfo.alias}</td>
      <td>${compMeter.current.toFixed(3)} m³</td>
      <td>${compMeter.previous.toFixed(3)} m³</td>
      <td style="font-weight:700; color: ${compMeter.isEconomy ? 'var(--color-green)' : 'var(--color-red)'}">
        ${compMeter.diff > 0 ? '+' : ''}${compMeter.diff.toFixed(3)} m³
      </td>
      <td><span class="${economyStatusClass}">${economyStatusText}</span></td>
    `;
    DOM.compResultsTbody.appendChild(tr);
  });

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

// ================= ABA 4: CONFIGURAÇÕES ADMINISTRATIVAS =================

function submitAdminSettings() {
  const settings = getAppSettings();
  
  const metaGlobal = parseFloat(DOM.adminMetaGlobal.value);
  const metaIndividual = parseFloat(DOM.adminMetaIndividual.value);
  const alertThreshold = parseInt(DOM.adminAlertThreshold.value);
  const leakThreshold = parseFloat(DOM.adminLeakThreshold.value);

  if (isNaN(metaGlobal) || metaGlobal <= 0 || isNaN(metaIndividual) || metaIndividual <= 0) {
    showToast('Valores de metas devem ser maiores que zero.', 'error');
    return;
  }
  
  if (isNaN(alertThreshold) || alertThreshold < 50 || alertThreshold > 100) {
    showToast('O percentual de alerta de atenção deve estar entre 50% e 100%.', 'error');
    return;
  }

  if (isNaN(leakThreshold) || leakThreshold <= 0) {
    showToast('O limite de vazamento diário deve ser maior que zero.', 'error');
    return;
  }

  // Atualiza configurações globais
  settings.metaGlobal = metaGlobal;
  settings.metaIndividual = metaIndividual;
  settings.alertThreshold = alertThreshold;
  settings.leakThreshold = leakThreshold;

  // Atualiza apelidos e cores dos hidrômetros da lista
  const aliasInputs = DOM.adminMetersList.querySelectorAll('.admin-meter-alias-input');
  aliasInputs.forEach(input => {
    const id = input.getAttribute('data-id');
    const aliasValue = input.value.trim().toUpperCase();
    if (aliasValue && settings.hydrometers[id]) {
      settings.hydrometers[id].alias = aliasValue;
    }
  });

  const colorInputs = DOM.adminMetersList.querySelectorAll('input[type="color"]');
  colorInputs.forEach(input => {
    const id = input.getAttribute('data-id');
    const colorValue = input.value;
    if (colorValue && settings.hydrometers[id]) {
      settings.hydrometers[id].color = colorValue;
    }
  });

  saveAppSettings(settings);
  updateAppSelectors();
  refreshApp();
  
  showToast('Configurações salvas e aplicadas com sucesso!', 'success');
}

// ================= MÓDULO OS =================

const OS_CSV_URL =
'https://docs.google.com/spreadsheets/d/e/2PACX-1vSyKnl6d4trSwtVru3JQIcoqb_h2gTHKBqn-3zXM1JW7MTzm_Xj01UJh62eDPDNEOYjisMWrGrWfFJt/pub?gid=1728678619&single=true&output=csv';

async function carregarOS() {

  try {

    const response = await fetch(OS_CSV_URL);
    const csv = await response.text();

    const linhas = csv.split('\n');

    const cabecalho = linhas[0].split(',');

    const indiceStatus = cabecalho.findIndex(col =>
      col.trim().replace(/"/g, '').toUpperCase() === 'STATUS'
    );

    console.log('Indice STATUS:', indiceStatus);

    let abertas = 0;
    let aguardando = 0;
    let concluidas = 0;

    for (let i = 1; i < linhas.length; i++) {

      const colunas = linhas[i].split(',');

      const status = (
        colunas[indiceStatus] || ''
      ).trim().replace(/"/g, '').toUpperCase();

      if (status === 'ABERTO') abertas++;

      if (status === 'AGUARDANDO PEÇA') aguardando++;

      if (
        status === 'CONCLUÍDO' ||
        status === 'CONCLUIDO'
      ) {
        concluidas++;
      }
    }

    const openCard = document.getElementById('os-open-count');
    const waitingCard = document.getElementById('os-waiting-count');
    const closedCard = document.getElementById('os-closed-count');

    if (openCard) openCard.textContent = abertas;
    if (waitingCard) waitingCard.textContent = aguardando;
    if (closedCard) closedCard.textContent = concluidas;

    console.log('OS Abertas:', abertas);
    console.log('OS Aguardando:', aguardando);
    console.log('OS Concluidas:', concluidas);

  } catch (error) {

    console.error('Erro ao carregar OS:', error);

  }

}// ================= NOTIFICAÇÕES TOAST (V2.0) =================

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = 'info';
  if (type === 'success') icon = 'check-circle';
  if (type === 'error') icon = 'x-circle';
  if (type === 'warning') icon = 'alert-circle';
  
  toast.innerHTML = `
    <i data-lucide="${icon}"></i>
    <span>${message}</span>
  `;
  
  DOM.toastContainer.appendChild(toast);
  
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s forwards reverse ease-out';
    toast.addEventListener('animationend', () => {
      toast.remove();
    });
  }, 4500);
}
