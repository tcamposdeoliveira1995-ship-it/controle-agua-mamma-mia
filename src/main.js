/**
 * src/main.js - Controlador Central (Versão 2.1)
 * Mamma Mia Control - Central de Alertas incluída
 */

import {
  initializeData, saveReadings, calculateConsumptions, getCycleStats,
  getAvailableCycles, compareCycles, parseCSV, formatDate,
  getAppSettings, saveAppSettings, checkDuplicateDayReading
} from './data.js';

import { renderTrendChart, renderComparisonChart } from './chart-setup.js';

import { exportToJSON, exportToCSV, exportToExcel, exportToPDF, syncGoogleSheetsFuture } from './integration.js';

import { initAuditoria } from './auditoria.js';
window.initAuditoria = initAuditoria;

// --- URLs CSV ---
const LIMPEZA_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRt3TOjpSYFl40nUJcPeL82B8SqmBpbomHDbPVK2rXcdPpuJ8M5QZgOlDQV1WFJl7371U7Ox7heooiv/pub?output=csv';
const MP_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTFEg4Bpk7evJs7NDYRCMBVWm5ZB6hQRD8SS_RwowjbNS_hI2kmtzH5ovhjYRpRssk0YH00yiCgoyCC/pub?gid=2077926267&single=true&output=csv';
const PERDAS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ0QXaxvuAAaF7XzQWayifLZIflDtS1psT3gNJTmkQ0BvPWbuKPttlJ6EAcE8Zv8IG_UlAbScrhD4Nb/pub?output=csv';
const OS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSyKnl6d4trSwtVru3JQIcoqb_h2gTHKBqn-3zXM1JW7MTzm_Xj01UJh62eDPDNEOYjisMWrGrWfFJt/pub?gid=1728678619&single=true&output=csv';
const INSUMOS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTxAviEilfLLSjTjSznB3EyWWtrHVp6ClhabTSuzu5gQh2aoYbLeYKKoH6CcfRPkBpelcOG9bU2a0b3/pub?output=csv';
const REFEICOES_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTrD-GbjBDnRbfpgiYcTd6W8wHcQMVE37hMs2l_a7xNvvFrZ0A1TydyWGRxI90AfTXa6Hbht2JvIbUK/pub?gid=1519326032&single=true&output=csv';
const AUSENCIAS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTrD-GbjBDnRbfpgiYcTd6W8wHcQMVE37hMs2l_a7xNvvFrZ0A1TydyWGRxI90AfTXa6Hbht2JvIbUK/pub?gid=632854171&single=true&output=csv';
const PRODUCAO_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTrD-GbjBDnRbfpgiYcTd6W8wHcQMVE37hMs2l_a7xNvvFrZ0A1TydyWGRxI90AfTXa6Hbht2JvIbUK/pub?gid=1492952412&single=true&output=csv';
const INSUMOS_EXEC_URL = 'https://script.google.com/macros/s/AKfycbxtrM875Sb92YmXJRQUyTTW1fYgEIyDYwg_D6FJqlQHcsyiPvg8frozc2nug8WbTJzM/exec';
const DEDETIZACAO_EXEC_URL = 'https://script.google.com/macros/s/AKfycbzboegVJXJT55v2iOPr51DvgHFRShIN-dLnZzhGdfpTh1pnohV92k9LiIn6M6jE9ekt/exec';

// --- SINCRONIZAÇÃO MÓDULO ÁGUA (gviz) ---
const AGUA_SPREADSHEET_ID = '1tixTJ74aaEo-EuCfTFl-efWOT7p-TIgN0su8NzX8aKw';
const AGUA_GID = '198559971';
const AGUA_GVIZ_URL = `https://docs.google.com/spreadsheets/d/${AGUA_SPREADSHEET_ID}/gviz/tq?tqx=out:json&gid=${AGUA_GID}`;

// --- ESTADO GLOBAL ---
let state = {
  readings: [],
  selectedCycleKey: '',
  currentTab: 'dashboard',
  filters: { meter: 'all' },
  alertasCache: null
};

// --- DOM ---
const DOM = {
  tabButtons: document.querySelectorAll('.tab-btn'),
  tabPanels: document.querySelectorAll('.tab-panel'),
  cycleSelect: document.getElementById('cycle-select'),
  filterMeter: document.getElementById('filter-meter-v2'),
  mainExecPeriodLabel: document.getElementById('main-exec-period-label'),
  mainExecMeta: document.getElementById('main-exec-meta'),
  mainExecConsumed: document.getElementById('main-exec-consumed'),
  mainExecBalance: document.getElementById('main-exec-balance'),
  mainExecPercent: document.getElementById('main-exec-percent'),
  mainExecDaysLeft: document.getElementById('main-exec-days-left'),
  mainExecProgressBar: document.getElementById('main-exec-progress-bar'),
  mainExecTodayMarker: document.getElementById('main-exec-today-marker'),
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
  comparadorBadgeV2: document.getElementById('comparador-badge-v2'),
  comparadorDetailsV2: document.getElementById('comparador-details-v2'),
  leakAlertBanner: document.getElementById('leak-alert-banner'),
  leakAlertDesc: document.getElementById('leak-alert-desc'),
  operationalAlertsPanel: document.getElementById('operational-alerts-panel'),
  operationalAlertsList: document.getElementById('operational-alerts-list'),
  metersCardsContainer: document.getElementById('hidrometros-cards-container-v2'),
  readingsTableBody: document.getElementById('readings-table-body-v2'),
  tableRecordCount: document.getElementById('table-record-count-v2'),
  trendChartCanvas: document.getElementById('trendChartV2'),
  comparisonChartCanvas: document.getElementById('comparisonChartV2'),
  btnOpenReadingModal: document.getElementById('btn-open-reading-modal-v2'),
  btnOpenCsvModal: document.getElementById('btn-open-csv-modal-v2'),
  btnGoogleSheetsImport: document.getElementById('btn-google-sheets-import'),
  btnExportPdf: document.getElementById('btn-export-pdf'),
  btnExportXlsx: document.getElementById('btn-export-xlsx'),
  btnExportCsv: document.getElementById('btn-export-csv'),
  btnExportJson: document.getElementById('btn-export-json'),
  modalReading: document.getElementById('modal-reading-v2'),
  btnCloseReadingModal: document.getElementById('btn-close-reading-modal-v2'),
  btnCancelReading: document.getElementById('btn-cancel-reading-v2'),
  formReading: document.getElementById('form-reading-v2'),
  inputMeter: document.getElementById('input-meter-v2'),
  inputIndex: document.getElementById('input-index-v2'),
  inputDate: document.getElementById('input-date-v2'),
  inputReset: document.getElementById('input-reset-v2'),
  lastReadingHelp: document.getElementById('last-reading-help-v2'),
  modalCsv: document.getElementById('modal-csv-v2'),
  btnCloseCsvModal: document.getElementById('btn-close-csv-modal-v2'),
  btnCloseCsvModalFooter: document.getElementById('btn-close-csv-modal-footer-v2'),
  csvDragZone: document.getElementById('csv-drag-zone-v2'),
  csvFileInput: document.getElementById('csv-file-input-v2'),
  csvErrorsContainer: document.getElementById('csv-errors-container-v2'),
  csvErrorsList: document.getElementById('csv-errors-list-v2'),
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
  dirExecTodayMarker: document.getElementById('dir-exec-today-marker'),
  dirKpiEconomy: document.getElementById('dir-kpi-economy'),
  dirKpiEconomySub: document.getElementById('dir-kpi-economy-sub'),
  dirKpiAlerts: document.getElementById('dir-kpi-alerts'),
  dirKpiAvgGeneral: document.getElementById('dir-kpi-avg-general'),
  dirRankingList: document.getElementById('dir-ranking-list'),
  dirTableSummary: document.getElementById('dir-table-summary'),
  historyCyclesTbody: document.getElementById('history-cycles-tbody'),
  compCycle1: document.getElementById('comp-cycle-1'),
  compCycle2: document.getElementById('comp-cycle-2'),
  btnRunCyclesComparison: document.getElementById('btn-run-cycles-comparison'),
  cyclesComparisonResults: document.getElementById('cycles-comparison-results'),
  compResultsTitle: document.getElementById('comp-results-title'),
  compResultsSub: document.getElementById('comp-results-sub'),
  compResultsBadge: document.getElementById('comp-results-badge'),
  compResultsTbody: document.getElementById('comp-results-tbody'),
  formAdminSettings: document.getElementById('form-admin-settings'),
  btnSaveAdminSettings: document.getElementById('btn-save-admin-settings'),
  adminMetaGlobal: document.getElementById('admin-meta-global'),
  adminMetaIndividual: document.getElementById('admin-meta-individual'),
  adminAlertThreshold: document.getElementById('admin-alert-threshold'),
  adminLeakThreshold: document.getElementById('admin-leak-threshold'),
  adminOsDiasAberta: document.getElementById('admin-os-dias-aberta'),
  adminOsDiasAguardando: document.getElementById('admin-os-dias-aguardando'),
  adminPerdasLimite: document.getElementById('admin-perdas-limite'),
  adminChecklistHoras: document.getElementById('admin-checklist-horas'),
  adminMetersList: document.getElementById('admin-meters-list'),
  adminDocTcVigilancia: document.getElementById('admin-doc-tc-vigilancia'),
  adminDocTcAvcb: document.getElementById('admin-doc-tc-avcb'),
  adminDocYukaVigilancia: document.getElementById('admin-doc-yuka-vigilancia'),
  adminDocYukaAvcb: document.getElementById('admin-doc-yuka-avcb'),
  adminDocCdVigilancia: document.getElementById('admin-doc-cd-vigilancia'),
  adminDocCdAvcb: document.getElementById('admin-doc-cd-avcb'),
  adminDocCdVre: document.getElementById('admin-doc-cd-vre'),
  toastContainer: document.getElementById('toast-container-v2')
};

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
  state.readings = initializeData();
  const totalAntes = state.readings.length;
  state.readings = state.readings.filter(r => !String(r.id).startsWith('mock-'));
  if (state.readings.length !== totalAntes) { saveReadings(state.readings); console.log(`[AGUA] Removidas ${totalAntes - state.readings.length} leitura(s) fictícia(s) de teste.`); }
  updateAppSelectors();
  resetReadingFormDate();
  switchTab(state.currentTab);
  renderDocumentosVencimentoBar();
  renderArmadilhasBar();
  initEventListeners();
  carregarDedetizacaoRemoto();
  if (typeof lucide !== 'undefined') lucide.createIcons();
});

// ================= SINCRONIZAÇÃO ÁGUA <-> PLANILHA =================

// Datas do gviz vêm como texto "Date(ano,mês,dia)" ou "Date(ano,mês,dia,h,m,s)"
// (mês já 0-indexado). Sem ambiguidade de formato regional.
function _aguaParseDataGviz(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'string') {
    const m = /^Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+),(\d+))?/.exec(v);
    if (m) {
      const ano = Number(m[1]), mes = Number(m[2]), dia = Number(m[3]);
      const hora = m[4] !== undefined ? Number(m[4]) : 12;
      const min = m[5] !== undefined ? Number(m[5]) : 0;
      const seg = m[6] !== undefined ? Number(m[6]) : 0;
      const data = new Date(ano, mes, dia, hora, min, seg);
      return isNaN(data.getTime()) ? null : data;
    }
  }
  return null;
}

// Busca as respostas do formulário (Form_Responses) na planilha e mescla no
// state.readings. O cálculo de consumo (calculateConsumptions) já trata por
// diferença sequencial entre leituras de um mesmo hidrômetro/coluna — então,
// mesmo que a SABESP troque o relógio e a numeração reinicie do zero, o app
// não gera consumo negativo: aquele dia específico fica com consumo 0 e a
// soma volta ao normal a partir da leitura seguinte.
async function sincronizarAguaComPlanilha() {
  try {
    const settings = getAppSettings();
    const response = await fetch(AGUA_GVIZ_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const texto = await response.text();

    const match = /setResponse\(([\s\S]*)\);?\s*$/.exec(texto.trim());
    if (!match) throw new Error('Resposta do Google em formato inesperado');
    const payload = JSON.parse(match[1]);
    if (payload.status === 'error') {
      throw new Error((payload.errors && payload.errors[0] && payload.errors[0].detailed_message) || 'Erro ao ler a planilha de Água');
    }

    const colunas = (payload.table.cols || []).map(c => (c.label || '').trim());
    const linhas = payload.table.rows || [];
    if (linhas.length === 0) return;

    const idxTimestamp = colunas.findIndex(c => /carimbo|timestamp/i.test(c));
    const meterColumns = {};
    Object.keys(settings.hydrometers).forEach(id => {
      const idx = colunas.findIndex(c => c.toUpperCase().includes(id.toUpperCase()));
      if (idx !== -1) meterColumns[id] = idx;
    });

    if (idxTimestamp === -1 || Object.keys(meterColumns).length === 0) {
      console.warn('[AGUA] Colunas não reconhecidas na planilha:', colunas);
      return;
    }

    const valorCelula = (linha, idx) => (idx >= 0 && linha.c && linha.c[idx]) ? linha.c[idx].v : null;

    const novasLeituras = [];
    linhas.forEach((linha, i) => {
      const data = _aguaParseDataGviz(valorCelula(linha, idxTimestamp));
      if (!data) return;
      Object.keys(meterColumns).forEach(meterId => {
        const raw = valorCelula(linha, meterColumns[meterId]);
        if (raw === null || raw === undefined || raw === '') return;
        const valor = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(',', '.'));
        if (isNaN(valor) || valor < 0) return;
        novasLeituras.push({
          id: `sheet-${meterId}-${data.getTime()}-${i}`,
          meterId,
          date: data.toISOString(),
          index: Number(valor.toFixed(3))
        });
      });
    });

    if (novasLeituras.length === 0) return;

    // Mantém no máximo uma leitura por hidrômetro por dia. Em caso de conflito,
    // a leitura vinda da planilha prevalece — exceto sobre leituras iniciais
    // (isInitial), que servem apenas de base histórica e devem ser preservadas.
    const mapa = new Map();
    (state.readings || []).forEach(r => {
      const rDate = new Date(r.date);
      const chave = `${r.meterId}-${rDate.getFullYear()}-${String(rDate.getMonth() + 1).padStart(2, '0')}-${String(rDate.getDate()).padStart(2, '0')}`;
      mapa.set(chave, r);
    });

    novasLeituras.sort((a, b) => new Date(a.date) - new Date(b.date));
    novasLeituras.forEach(r => {
      const rDate = new Date(r.date);
      const chave = `${r.meterId}-${rDate.getFullYear()}-${String(rDate.getMonth() + 1).padStart(2, '0')}-${String(rDate.getDate()).padStart(2, '0')}`;
      const existente = mapa.get(chave);
      if (existente && existente.isInitial) return;
      mapa.set(chave, r);
    });

    state.readings = Array.from(mapa.values()).sort((a, b) => new Date(b.date) - new Date(a.date));
    saveReadings(state.readings);
  } catch (err) {
    console.error('[AGUA] Falha ao sincronizar com a planilha:', err);
  }
}

// ================= DATAS IMPORTANTES (DOCUMENTOS) =================

function renderDocumentosVencimentoBar() {
  const container = document.getElementById('documentos-vencimento-bar');
  if (!container) return;

  const settings = getAppSettings();
  const doc = settings.documentosVencimento || {};
  const itens = [
    { label: 'TC - Vigilância', valor: doc.tcVigilancia },
    { label: 'TC - AVCB', valor: doc.tcAvcb },
    { label: 'YUKA - Vigilância', valor: doc.yukaVigilancia },
    { label: 'YUKA - AVCB', valor: doc.yukaAvcb },
    // CD é isento de alvará da vigilância sanitária — fixo no código, não depende do que está salvo.
    { label: 'CD - Vigilância', valor: doc.cdVigilancia, isento: true },
    { label: 'CD - AVCB', valor: doc.cdAvcb },
    { label: 'CD - VRE (CLI)', valor: doc.cdVre }
  ];

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const chipsDocumentos = itens.map(item => {
    if (item.isento) {
      return `<div class="doc-vencimento-chip doc-vencimento-isento">
        <span class="doc-vencimento-label">${item.label}</span>
        <span class="doc-vencimento-status">✅ Isento de alvará</span>
      </div>`;
    }
    if (!item.valor) {
      return `<div class="doc-vencimento-chip doc-vencimento-alerta">
        <span class="doc-vencimento-label">${item.label}</span>
        <span class="doc-vencimento-status">⚠️ SEM ENTRADA</span>
      </div>`;
    }
    const [ano, mes, dia] = item.valor.split('-').map(Number);
    const dataVenc = new Date(ano, mes - 1, dia);
    const diffDias = Math.ceil((dataVenc - hoje) / (1000 * 60 * 60 * 24));

    let statusHtml, chipClass;
    if (diffDias < 0) {
      const diasAtraso = Math.abs(diffDias);
      statusHtml = `🔴 Vencido há ${diasAtraso} dia${diasAtraso === 1 ? '' : 's'}`;
      chipClass = 'doc-vencimento-alerta';
    } else if (diffDias <= 30) {
      statusHtml = `Faltam ${diffDias} dia${diffDias === 1 ? '' : 's'}`;
      chipClass = 'doc-vencimento-atencao';
    } else {
      statusHtml = `Faltam ${diffDias} dias`;
      chipClass = 'doc-vencimento-ok';
    }
    return `<div class="doc-vencimento-chip ${chipClass}">
      <span class="doc-vencimento-label">${item.label}</span>
      <span class="doc-vencimento-status">${statusHtml}</span>
    </div>`;
  }).join('');

  const chipsDedetizacao = PRAGAS_TIPOS.DEDETIZACAO.unidades.map(unidade => _pragaChipHtml('DEDETIZACAO', unidade)).join('');

  container.innerHTML = `
    <div class="doc-vencimento-grupo">
      <div class="doc-vencimento-grupo-titulo"><i data-lucide="file-check"></i> Documentos</div>
      <div class="doc-vencimento-grupo-chips">${chipsDocumentos}</div>
    </div>
    <div class="doc-vencimento-grupo">
      <div class="doc-vencimento-grupo-titulo"><i data-lucide="bug-off"></i> Dedetização</div>
      <div class="doc-vencimento-grupo-chips">${chipsDedetizacao}</div>
    </div>`;

  _wirePragaChipClicks(container);
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ================= MÓDULO DEDETIZAÇÃO =================

const PRAGAS_CACHE_KEY = 'mamma_mia_pragas_cache_v1';
const PRAGAS_TIPOS = {
  DEDETIZACAO: { label: 'Dedetização', unidades: ['TC', 'YUKA', 'CD'], icon: 'bug-off', empresaLabel: 'Empresa Dedetizadora' },
  ARMADILHA_LUMINOSA: { label: 'Armadilha Luminosa', unidades: ['TC', 'YUKA'], icon: 'zap', empresaLabel: 'Empresa/Responsável pela Troca' }
};

function _getPragasCache() {
  try {
    return JSON.parse(localStorage.getItem(PRAGAS_CACHE_KEY)) || {};
  } catch (e) {
    return {};
  }
}

function _savePragasCache(registros) {
  localStorage.setItem(PRAGAS_CACHE_KEY, JSON.stringify(registros));
}

// Calcula o card com base na regra de período mensal:
// próxima ação prevista = dataRealizada + 30 dias.
function _pragaChipHtml(tipo, unidade) {
  const cache = _getPragasCache();
  const registro = (cache[tipo] || {})[unidade];
  const config = PRAGAS_TIPOS[tipo];
  const label = `${unidade} - ${config.label}`;

  if (!registro || !registro.dataRealizada) {
    return `<div class="doc-vencimento-chip doc-vencimento-alerta" data-praga-tipo="${tipo}" data-praga-unidade="${unidade}" style="cursor:pointer;" title="Clique para registrar">
      <span class="doc-vencimento-label">${label}</span>
      <span class="doc-vencimento-status">⚠️ SEM ENTRADA</span>
    </div>`;
  }

  const [ano, mes, dia] = registro.dataRealizada.split('-').map(Number);
  const dataRealizada = new Date(ano, mes - 1, dia);
  const proximaData = new Date(dataRealizada);
  proximaData.setDate(proximaData.getDate() + 30);

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const diffDias = Math.ceil((proximaData - hoje) / (1000 * 60 * 60 * 24));

  let statusHtml, chipClass;
  if (diffDias < 0) {
    const diasAtraso = Math.abs(diffDias);
    statusHtml = `🔴 Atrasada há ${diasAtraso} dia${diasAtraso === 1 ? '' : 's'}`;
    chipClass = 'doc-vencimento-alerta';
  } else if (diffDias <= 7) {
    statusHtml = `Faltam ${diffDias} dia${diffDias === 1 ? '' : 's'}`;
    chipClass = 'doc-vencimento-atencao';
  } else {
    statusHtml = `Faltam ${diffDias} dias`;
    chipClass = 'doc-vencimento-ok';
  }

  const tituloTip = `${registro.empresa || 'Não informado'} — realizada em ${formatDate(registro.dataRealizada)}. Clique para editar.`;

  return `<div class="doc-vencimento-chip ${chipClass}" data-praga-tipo="${tipo}" data-praga-unidade="${unidade}" style="cursor:pointer;" title="${tituloTip}">
    <span class="doc-vencimento-label">${label}</span>
    <span class="doc-vencimento-status">${statusHtml}</span>
  </div>`;
}

function _wirePragaChipClicks(container) {
  container.querySelectorAll('[data-praga-tipo]').forEach(chip => {
    chip.addEventListener('click', () => _abrirModalPraga(chip.getAttribute('data-praga-tipo'), chip.getAttribute('data-praga-unidade')));
  });
}

function renderArmadilhasBar() {
  const container = document.getElementById('armadilhas-vencimento-bar');
  if (!container) return;
  container.innerHTML = PRAGAS_TIPOS.ARMADILHA_LUMINOSA.unidades.map(unidade => _pragaChipHtml('ARMADILHA_LUMINOSA', unidade)).join('');
  _wirePragaChipClicks(container);
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function carregarDedetizacaoRemoto() {
  try {
    const resposta = await fetch(DEDETIZACAO_EXEC_URL, { cache: 'no-store' });
    const resultado = await resposta.json();
    if (!resultado.ok) throw new Error(resultado.erro || 'Erro desconhecido');
    _savePragasCache(resultado.registros || {});
    renderDocumentosVencimentoBar();
    renderArmadilhasBar();
    if (typeof lucide !== 'undefined') lucide.createIcons();
  } catch (erro) {
    console.error('[PRAGAS] Erro ao carregar:', erro);
  }
}

function _abrirModalPraga(tipo, unidade) {
  const modal = document.getElementById('modal-dedetizacao');
  if (!modal) return;

  const config = PRAGAS_TIPOS[tipo];
  const cache = _getPragasCache();
  const registro = (cache[tipo] || {})[unidade] || {};

  document.getElementById('dedetizacao-unidade').value = unidade;
  document.getElementById('dedetizacao-tipo').value = tipo;
  document.getElementById('dedetizacao-modal-titulo').innerHTML = `<i data-lucide="${config.icon}"></i> ${config.label} — ${unidade}`;
  document.getElementById('dedetizacao-empresa-label').textContent = config.empresaLabel;
  document.getElementById('dedetizacao-empresa').value = registro.empresa || '';
  document.getElementById('dedetizacao-data').value = registro.dataRealizada || '';
  document.getElementById('dedetizacao-certificado-input').value = '';

  const spanCertAtual = document.getElementById('dedetizacao-certificado-atual');
  spanCertAtual.innerHTML = registro.certificadoUrl
    ? `<a href="${registro.certificadoUrl}" target="_blank" rel="noopener">📄 Ver certificado atual (${registro.certificadoNome || 'arquivo'})</a>`
    : 'Nenhum certificado anexado ainda.';

  openModal(modal);
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function _fecharModalDedetizacao() {
  const modal = document.getElementById('modal-dedetizacao');
  if (modal) closeModal(modal);
}

function _lerArquivoComoBase64(arquivo) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = (e) => resolve(e.target.result);
    leitor.onerror = reject;
    leitor.readAsDataURL(arquivo);
  });
}

async function _submeterFormDedetizacao(e) {
  e.preventDefault();
  const btnSalvar = document.getElementById('btn-save-dedetizacao');
  const tipo = document.getElementById('dedetizacao-tipo').value || 'DEDETIZACAO';
  const unidade = document.getElementById('dedetizacao-unidade').value;
  const empresa = document.getElementById('dedetizacao-empresa').value.trim();
  const dataRealizada = document.getElementById('dedetizacao-data').value;
  const arquivoInput = document.getElementById('dedetizacao-certificado-input');
  const arquivo = arquivoInput.files && arquivoInput.files[0];

  if (!empresa || !dataRealizada) { showToast('Preencha empresa e data realizada.', 'error'); return; }

  const textoOriginal = btnSalvar.textContent;
  btnSalvar.disabled = true;
  btnSalvar.textContent = 'Salvando...';

  try {
    const payload = { tipo, unidade, empresa, dataRealizada, registradoPor: 'Thalita Campos' };
    if (arquivo) {
      payload.certificadoBase64 = await _lerArquivoComoBase64(arquivo);
      payload.certificadoNome = arquivo.name;
    }

    const resposta = await fetch(DEDETIZACAO_EXEC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    const resultado = await resposta.json();
    if (!resultado.ok) throw new Error(resultado.erro || 'Erro desconhecido');

    showToast(`${PRAGAS_TIPOS[tipo].label} de ${unidade} registrada!`, 'success');
    _fecharModalDedetizacao();
    await carregarDedetizacaoRemoto();
  } catch (erro) {
    console.error('[PRAGAS] Erro ao salvar:', erro);
    showToast('Erro ao salvar: ' + erro.message, 'error');
  } finally {
    btnSalvar.disabled = false;
    btnSalvar.textContent = textoOriginal;
  }
}

// ================= REFRESH GERAL =================

function refreshApp() {
  // Abas independentes de ciclo — executar antes do guard
  if (state.currentTab === 'pipa') { carregarPipa(); if (typeof lucide !== 'undefined') lucide.createIcons(); return; }

  if (state.currentTab === 'higienizacao') { carregarHigienizacao(); if (typeof lucide !== 'undefined') lucide.createIcons(); return; }

  if (state.currentTab === 'insumos') { carregarInsumos(); if (typeof lucide !== 'undefined') lucide.createIcons(); return; }

  if (state.currentTab === 'auditoria') { setTimeout(() => { initAuditoria(); if (typeof lucide !== 'undefined') lucide.createIcons(); }, 50); return; }

  if (state.currentTab === 'refeicoes') { carregarRefeicoes(); if (typeof lucide !== 'undefined') lucide.createIcons(); return; }

  // O ciclo "real" de hoje é sempre calculado pela data atual (regra: vira todo dia 7),
  // não apenas pelas leituras já lançadas. Isso evita o painel ficar "preso" no ciclo
  // anterior quando ainda não há nenhuma leitura lançada no ciclo novo.
  const currentRealCycleKey = getCycleStats(state.readings, 'current').cycleKey;
  const availableCycles = getAvailableCycles(state.readings);
  if (!availableCycles.includes(currentRealCycleKey)) availableCycles.unshift(currentRealCycleKey);
  if (!state.selectedCycleKey || !availableCycles.includes(state.selectedCycleKey)) {
    state.selectedCycleKey = currentRealCycleKey;
  }
  if (!state.selectedCycleKey) return;

  const stats = getCycleStats(state.readings, state.selectedCycleKey);
  const currentIndex = availableCycles.indexOf(state.selectedCycleKey);
  const prevCycleKey = currentIndex !== -1 && currentIndex < availableCycles.length - 1 ? availableCycles[currentIndex + 1] : null;
  let prevStats = null;
  if (prevCycleKey) prevStats = getCycleStats(state.readings, prevCycleKey);

  if (state.currentTab === 'dashboard') renderDashboardTab(stats, prevStats);
  else if (state.currentTab === 'os') carregarOS();
  else if (state.currentTab === 'perdas') carregarPerdas();
  else if (state.currentTab === 'requisicoes') carregarRequisicoes();
  else if (state.currentTab === 'central') carregarCentralOperacional();
  else if (state.currentTab === 'alertas') carregarAlertas();
  else if (state.currentTab === 'configuracoes') renderConfiguracoesTab();

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ================= CENTRAL DE ALERTAS =================

/**
 * Calcula todos os alertas do sistema agregando Água, OS, Perdas e Operação.
 * Retorna array de objetos { prioridade, categoria, mensagem, data }
 */
async function calcularAlertas() {
  const alertas = [];
  const settings = getAppSettings();
  const hoje = new Date();

  // --- ÁGUA ---
  try {
    const stats = getCycleStats(state.readings, state.selectedCycleKey || 'current');
    Object.values(stats.meters).forEach(m => {
      if (m.consumption > m.limit) {
        alertas.push({ prioridade: 'critico', categoria: 'agua', mensagem: `Hidrômetro ${m.alias} (${m.id}): consumo ${m.consumption.toFixed(2)} m³ excedeu a meta de ${m.limit} m³.`, data: hoje.toISOString() });
      } else if (m.status === 'warning') {
        alertas.push({ prioridade: 'atencao', categoria: 'agua', mensagem: `Hidrômetro ${m.alias} (${m.id}): consumo ${m.consumption.toFixed(2)} m³ próximo da meta (${m.percentUsed}% utilizado).`, data: hoje.toISOString() });
      }
      if (m.hasLeak) {
        alertas.push({ prioridade: 'critico', categoria: 'agua', mensagem: `Hidrômetro ${m.alias} (${m.id}): possível vazamento detectado (pico diário acima de ${settings.leakThreshold} m³).`, data: hoje.toISOString() });
      }
      if (m.projection > m.limit && m.status !== 'danger') {
        alertas.push({ prioridade: 'atencao', categoria: 'agua', mensagem: `Hidrômetro ${m.alias} (${m.id}): projeção de fechamento (${m.projection.toFixed(2)} m³) excederá a meta.`, data: hoje.toISOString() });
      }
    });
  } catch (e) {
    console.warn('Alertas Água: erro ao calcular', e);
  }

  // --- OS ---
  try {
    const response = await fetch(OS_CSV_URL);
    const csv = await response.text();
    const linhas = parseCSVLinhas(csv);

const cabecalho = linhas[0];

const registros = [];

for (let i = 1; i < linhas.length; i++) {

  const cols = linhas[i];

  if (cols.every(c => !c || !c.trim())) continue;

  const registro = {};

  cabecalho.forEach((nomeCol, idx) => {

    registro[nomeCol.trim()] =
      (cols[idx] || '').trim();

  });

  registros.push(registro);

}
    
    const indiceStatus = cabecalho.findIndex(c => c.trim().replace(/"/g, '').toUpperCase() === 'STATUS');
    const indicePrioridade = cabecalho.findIndex(c => c.trim().replace(/"/g, '').toUpperCase() === 'PRIORIDADE');
    const indiceOS = cabecalho.findIndex(c => c.trim().replace(/"/g, '').toUpperCase() === 'OS');
    const indiceData = cabecalho.findIndex(c => c.trim().replace(/"/g, '').toUpperCase().includes('DATA'));

    for (let i = 1; i < linhas.length; i++) {
      const colunas = linhas[i].split(',');
      const status = (colunas[indiceStatus] || '').trim().replace(/"/g, '').toUpperCase();
      const prioridade = (colunas[indicePrioridade] || '').trim().replace(/"/g, '').toUpperCase();
      const osNum = (colunas[indiceOS] || '').replace(/"/g, '');
      const dataAbertura = indiceData >= 0 ? (colunas[indiceData] || '').replace(/"/g, '').trim() : '';

      if (!status) continue;

      // Calcula dias em aberto
      let diasAberta = 0;
      if (dataAbertura) {
        const parts = dataAbertura.split('/');
        if (parts.length === 3) {
          const dtAberta = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
          if (!isNaN(dtAberta.getTime())) {
            diasAberta = Math.floor((hoje - dtAberta) / (1000 * 60 * 60 * 24));
          }
        }
      }

      if (status === 'ABERTO') {
        if (prioridade === 'CRÍTICA' || prioridade === 'CRITICA') {
          alertas.push({ prioridade: 'critico', categoria: 'os', mensagem: `OS ${osNum}: prioridade CRÍTICA em aberto${diasAberta > 0 ? ` há ${diasAberta} dias` : ''}.`, data: hoje.toISOString() });
        } else if (diasAberta >= settings.alertOsDiasAberta) {
          alertas.push({ prioridade: 'critico', categoria: 'os', mensagem: `OS ${osNum}: aberta há ${diasAberta} dias (limite: ${settings.alertOsDiasAberta} dias).`, data: hoje.toISOString() });
        }
      } else if (status === 'AGUARDANDO PEÇA') {
        if (diasAberta >= settings.alertOsDiasAguardando) {
          alertas.push({ prioridade: 'atencao', categoria: 'os', mensagem: `OS ${osNum}: aguardando peça há ${diasAberta} dias (limite: ${settings.alertOsDiasAguardando} dias).`, data: hoje.toISOString() });
        }
      }
    }
  } catch (e) {
    console.warn('Alertas OS: erro ao buscar CSV', e);
    alertas.push({ prioridade: 'informativo', categoria: 'os', mensagem: 'Não foi possível verificar OS no momento. Verifique a conexão.', data: hoje.toISOString() });
  }

  // --- PERDAS ---
  try {
    const response = await fetch(PERDAS_CSV_URL);
    const csv = await response.text();
    const linhas = csv.split('\n').filter(l => l.trim());
    const totalPerdas = linhas.length - 1;
    const limite = settings.alertPerdasLimite;

    // Referência: média de registros (simplificado: comparamos com um total de 30 registros como base)
    // Na prática, totalPerdas é contagem total acumulada, não só do mês. Usamos o limite% como nº máximo aceitável.
    // Lógica: se totalPerdas > limite (como número absoluto configurável), alerta.
    if (totalPerdas > limite) {
      const excesso = totalPerdas - limite;
      alertas.push({ prioridade: 'critico', categoria: 'perdas', mensagem: `Perdas: ${totalPerdas} registros totais excedem o limite configurado de ${limite} (excesso: ${excesso}).`, data: hoje.toISOString() });
    } else if (totalPerdas > limite * 0.7) {
      alertas.push({ prioridade: 'atencao', categoria: 'perdas', mensagem: `Perdas: ${totalPerdas} registros totais estão em ${Math.round((totalPerdas / limite) * 100)}% do limite configurado (${limite}).`, data: hoje.toISOString() });
    } else {
      alertas.push({ prioridade: 'informativo', categoria: 'perdas', mensagem: `Perdas: ${totalPerdas} registros totais dentro do limite (${limite}).`, data: hoje.toISOString() });
    }
  } catch (e) {
    console.warn('Alertas Perdas: erro ao buscar CSV', e);
    alertas.push({ prioridade: 'informativo', categoria: 'perdas', mensagem: 'Não foi possível verificar Perdas no momento. Verifique a conexão.', data: hoje.toISOString() });
  }

  // --- OPERAÇÃO (placeholder — checklists são Google Forms externos sem dados acessíveis) ---
  // Quando a planilha de respostas estiver disponível, substituir este bloco pela leitura real.
  alertas.push({
    prioridade: 'informativo',
    categoria: 'operacao',
    mensagem: `Checklists operacionais: monitoramento automático não disponível (Google Forms externos). Parâmetro configurado: ${settings.alertChecklistHoras}h sem preenchimento = alerta. Expansão futura prevista.`,
    data: hoje.toISOString()
  });

  // ---- EXPANSÃO FUTURA (código pronto, comentado) ----
  // async function sendTelegramAlertFuture(alerta) { /* chamar API Telegram Bot */ }
  // async function sendWhatsAppAlertFuture(alerta) { /* chamar API WhatsApp Business */ }
  // async function sendPushNotificationFuture(alerta) { /* chamar Push API */ }
  // async function sendEmailAlertFuture(alerta) { /* chamar serviço de e-mail */ }

  return alertas;
}

async function carregarAlertas() {
  const container = document.getElementById('alertas-conteudo');
  if (!container) return;

  // KPI cards loading
  ['alerta-kpi-total', 'alerta-kpi-critico', 'alerta-kpi-atencao', 'alerta-kpi-info'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '...';
  });

  container.innerHTML = `<div style="text-align:center; padding: 2rem; color: var(--text-muted);"><i data-lucide="loader-2" style="animation: spin 1s linear infinite;"></i> Calculando alertas...</div>`;
  if (typeof lucide !== 'undefined') lucide.createIcons();

  let alertas = [];
  try {
    alertas = await calcularAlertas();
    state.alertasCache = alertas;
  } catch (e) {
    container.innerHTML = `<p style="color:var(--color-red); padding:1rem;">Erro ao calcular alertas: ${e.message}</p>`;
    return;
  }

  renderizarAlertas(alertas);
}

function renderizarAlertas(alertas, filtroPrioridade = 'todos', filtroCategoria = 'todos') {
  const criticos = alertas.filter(a => a.prioridade === 'critico');
  const atencao = alertas.filter(a => a.prioridade === 'atencao');
  const informativos = alertas.filter(a => a.prioridade === 'informativo');

  // Atualiza KPIs
  const kpiTotal = document.getElementById('alerta-kpi-total');
  const kpiCritico = document.getElementById('alerta-kpi-critico');
  const kpiAtencao = document.getElementById('alerta-kpi-atencao');
  const kpiInfo = document.getElementById('alerta-kpi-info');
  if (kpiTotal) kpiTotal.textContent = alertas.length;
  if (kpiCritico) kpiCritico.textContent = criticos.length;
  if (kpiAtencao) kpiAtencao.textContent = atencao.length;
  if (kpiInfo) kpiInfo.textContent = informativos.length;

  // Filtra para a tabela
  let filtrados = alertas;
  if (filtroPrioridade !== 'todos') filtrados = filtrados.filter(a => a.prioridade === filtroPrioridade);
  if (filtroCategoria !== 'todos') filtrados = filtrados.filter(a => a.categoria === filtroCategoria);

  const container = document.getElementById('alertas-conteudo');
  if (!container) return;

  // Cards de resumo (Críticos e Atenção)
  const resumoCriticos = criticos.slice(0, 5);
  const resumoAtencao = atencao.slice(0, 5);

  const iconePorCategoria = { agua: 'droplets', os: 'wrench', perdas: 'trending-down', operacao: 'clipboard-check' };

  container.innerHTML = `
    <!-- Cards de resumo -->
    <div class="alerta-resumo-grid">
      <div class="alerta-card alerta-card-critico">
        <div class="alerta-card-header">
          <i data-lucide="alert-octagon"></i>
          <span>🔴 Críticos (${criticos.length})</span>
        </div>
        ${resumoCriticos.length === 0 ? '<p class="alerta-empty">Nenhum alerta crítico</p>' : resumoCriticos.map(a => `
          <div class="alerta-item">
            <i data-lucide="${iconePorCategoria[a.categoria] || 'alert-circle'}" style="width:13px;height:13px;flex-shrink:0;"></i>
            <span>${a.mensagem}</span>
          </div>
        `).join('')}
        ${criticos.length > 5 ? `<p style="font-size:0.75rem;color:var(--text-muted);margin-top:0.5rem;">+${criticos.length - 5} outros críticos na tabela abaixo.</p>` : ''}
      </div>
      <div class="alerta-card alerta-card-atencao">
        <div class="alerta-card-header">
          <i data-lucide="alert-triangle"></i>
          <span>🟡 Atenção (${atencao.length})</span>
        </div>
        ${resumoAtencao.length === 0 ? '<p class="alerta-empty">Nenhum alerta de atenção</p>' : resumoAtencao.map(a => `
          <div class="alerta-item">
            <i data-lucide="${iconePorCategoria[a.categoria] || 'alert-circle'}" style="width:13px;height:13px;flex-shrink:0;"></i>
            <span>${a.mensagem}</span>
          </div>
        `).join('')}
        ${atencao.length > 5 ? `<p style="font-size:0.75rem;color:var(--text-muted);margin-top:0.5rem;">+${atencao.length - 5} outros na tabela abaixo.</p>` : ''}
      </div>
    </div>

    <!-- Tabela completa com filtros -->
    <div class="panel-card" style="margin-top:1.5rem;">
      <div class="panel-header" style="flex-wrap:wrap; gap:0.5rem;">
        <h3 style="font-size:1rem;">📋 Todos os Alertas</h3>
        <div style="display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center;">
          <select id="alerta-filtro-prioridade" class="filter-select" style="font-size:0.8rem;">
            <option value="todos">Todas as Prioridades</option>
            <option value="critico">🔴 Crítico</option>
            <option value="atencao">🟡 Atenção</option>
            <option value="informativo">🟢 Informativo</option>
          </select>
          <select id="alerta-filtro-categoria" class="filter-select" style="font-size:0.8rem;">
            <option value="todos">Todas as Categorias</option>
            <option value="agua">💧 Água</option>
            <option value="os">🔧 OS</option>
            <option value="perdas">📉 Perdas</option>
            <option value="operacao">📋 Operação</option>
          </select>
          <button id="btn-atualizar-alertas" class="btn btn-secondary" style="font-size:0.8rem; padding:0.35rem 0.75rem;">
            <i data-lucide="refresh-cw" style="width:13px;height:13px;"></i> Atualizar
          </button>
        </div>
      </div>

      <div class="table-responsive" style="margin-top:1rem;">
        <table class="modern-table">
          <thead>
            <tr>
              <th style="width:110px;">Prioridade</th>
              <th style="width:100px;">Categoria</th>
              <th>Mensagem</th>
              <th style="width:120px;">Data</th>
            </tr>
          </thead>
          <tbody id="alerta-tabela-body">
            ${filtrados.length === 0 ? '<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:2rem;">Nenhum alerta encontrado para os filtros selecionados.</td></tr>' :
              filtrados.map(a => {
                const badgeClass = a.prioridade === 'critico' ? 'badge-alerta-critico' : (a.prioridade === 'atencao' ? 'badge-alerta-atencao' : 'badge-alerta-info');
                const emoji = a.prioridade === 'critico' ? '🔴' : (a.prioridade === 'atencao' ? '🟡' : '🟢');
                const catLabel = { agua: '💧 Água', os: '🔧 OS', perdas: '📉 Perdas', operacao: '📋 Operação' }[a.categoria] || a.categoria;
                return `<tr>
                  <td><span class="${badgeClass}">${emoji} ${a.prioridade.charAt(0).toUpperCase() + a.prioridade.slice(1)}</span></td>
                  <td><span class="badge-categoria">${catLabel}</span></td>
                  <td style="font-size:0.85rem;">${a.mensagem}</td>
                  <td style="font-size:0.78rem; color:var(--text-muted);">${formatDate(a.data, true)}</td>
                </tr>`;
              }).join('')}
          </tbody>
        </table>
      </div>

      <p style="font-size:0.75rem; color:var(--text-muted); margin-top:1rem; padding-top:0.75rem; border-top:1px solid var(--card-border);">
        💡 Expansão futura: envio automático via Telegram, WhatsApp, Push e E-mail para alertas críticos.
      </p>
    </div>
  `;

  // Listeners dos filtros da tabela
  const filtroPrioEl = document.getElementById('alerta-filtro-prioridade');
  const filtroCatEl = document.getElementById('alerta-filtro-categoria');
  const btnAtualizar = document.getElementById('btn-atualizar-alertas');

  if (filtroPrioEl) filtroPrioEl.value = filtroPrioridade;
  if (filtroCatEl) filtroCatEl.value = filtroCategoria;

  if (filtroPrioEl) filtroPrioEl.addEventListener('change', () => renderizarAlertas(state.alertasCache || [], filtroPrioEl.value, filtroCatEl?.value || 'todos'));
  if (filtroCatEl) filtroCatEl.addEventListener('change', () => renderizarAlertas(state.alertasCache || [], filtroPrioEl?.value || 'todos', filtroCatEl.value));
  if (btnAtualizar) btnAtualizar.addEventListener('click', () => { state.alertasCache = null; carregarAlertas(); });

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ================= ABA DASHBOARD =================

function getExpectedPercentToday(stats) {
  if (typeof stats.expectedPercentToday === 'number' && !isNaN(stats.expectedPercentToday)) return stats.expectedPercentToday;
  if (!stats.totalDays) return 0;
  return Math.min(100, Number(((stats.elapsedDays / stats.totalDays) * 100).toFixed(1)));
}

function renderDashboardTab(stats, prevStats) {
  const settings = getAppSettings();
  DOM.mainExecPeriodLabel.textContent = `${formatDate(stats.startDate)} a ${formatDate(stats.endDate)}`;
  DOM.mainExecMeta.innerHTML = `${stats.metaGlobal.toFixed(2)} <span class="exec-unit">m³</span>`;
  DOM.mainExecConsumed.innerHTML = `${stats.totalConsumption.toFixed(2)} <span class="exec-unit">m³</span>`;
  const isGlobalEconomy = stats.globalBalance >= 0;
  DOM.mainExecBalance.textContent = `${stats.globalBalance.toFixed(2)} m³`;
  DOM.mainExecBalance.className = isGlobalEconomy ? 'exec-val text-glow-green' : 'exec-val text-glow-red';
  DOM.mainExecPercent.textContent = `${stats.globalPercentUsed}%`;
  DOM.mainExecDaysLeft.innerHTML = `${stats.remainingDays} <span class="exec-unit">dias</span>`;
  DOM.mainExecProgressBar.style.width = `${Math.min(100, stats.globalPercentUsed)}%`;
  if (DOM.mainExecTodayMarker) {
    const expectedPercentToday = getExpectedPercentToday(stats);
    DOM.mainExecTodayMarker.style.left = `${expectedPercentToday}%`;
    DOM.mainExecTodayMarker.title = `Ritmo esperado hoje: ${expectedPercentToday}% (${stats.elapsedDays}/${stats.totalDays} dias do ciclo)`;
  }
  if (stats.totalConsumption > stats.metaGlobal) DOM.mainExecProgressBar.style.background = 'var(--grad-danger)';
  else if (stats.totalConsumption > (stats.metaGlobal * (settings.alertThreshold / 100))) DOM.mainExecProgressBar.style.background = 'var(--grad-warning)';
  else DOM.mainExecProgressBar.style.background = 'var(--grad-primary)';

  DOM.valAlertsV2.textContent = stats.alertMetersCount;
  if (stats.alertMetersCount > 0) { DOM.valAlertsV2.parentElement.style.color = 'var(--color-red)'; DOM.valAlertsSubtextV2.innerHTML = `<span class="pulse-red"></span> Contém hidrômetro crítico`; }
  else { DOM.valAlertsV2.parentElement.style.color = 'var(--color-green)'; DOM.valAlertsSubtextV2.textContent = 'Consumos sob controle'; }

  DOM.valAvgGeneral.innerHTML = `${stats.generalDailyAverage.toFixed(2)} <span class="unit">m³/d</span>`;
  DOM.valHighestConsumer.textContent = stats.highestConsumer.name;
  DOM.valHighestConsumerSub.textContent = `Consumido: ${stats.highestConsumer.consumption.toFixed(2)} m³`;
  DOM.valLowestConsumer.textContent = stats.lowestConsumer.name;
  DOM.valLowestConsumerSub.textContent = `Consumido: ${stats.lowestConsumer.consumption.toFixed(2)} m³`;
  DOM.valProjGlobal.innerHTML = `${stats.totalProjection.toFixed(2)} <span class="unit">m³</span>`;
  if (stats.totalProjection > stats.metaGlobal) DOM.valProjGlobalSub.innerHTML = `<span class="badge-alert" style="padding:1px 4px; font-size:0.75rem;">Excederá limite</span>`;
  else DOM.valProjGlobalSub.textContent = 'Dentro da meta projetada';
  DOM.valEconomyProjected.innerHTML = `${Math.max(0, stats.projectedEconomy).toFixed(2)} <span class="unit">m³</span>`;
  DOM.valEconomyProjectedSub.textContent = stats.projectedEconomy >= 0 ? 'Economia prevista' : 'Nenhuma economia prevista';

  if (prevStats) {
    const comp = compareCycles(state.readings, stats.cycleKey, prevStats.cycleKey);
    DOM.comparadorDetailsV2.textContent = `Consumo Atual: ${stats.totalConsumption.toFixed(2)} m³ | Anterior: ${prevStats.totalConsumption.toFixed(2)} m³`;
    if (comp.isEconomy) { DOM.comparadorBadgeV2.className = 'comparador-resultado economia'; DOM.comparadorBadgeV2.innerHTML = `<i data-lucide="arrow-down"></i>Economia de ${comp.diff.toFixed(2)} m³ (-${comp.percentDiff}%)`; }
    else { DOM.comparadorBadgeV2.className = 'comparador-resultado aumento'; DOM.comparadorBadgeV2.innerHTML = `<i data-lucide="arrow-up"></i>Aumento de ${comp.diff.toFixed(2)} m³ (+${comp.percentDiff}%)`; }
  } else {
    DOM.comparadorDetailsV2.textContent = 'Sem dados do ciclo anterior para comparação.';
    DOM.comparadorBadgeV2.className = 'comparador-resultado economia';
    DOM.comparadorBadgeV2.innerHTML = 'Primeiro Ciclo';
  }

  let hasGlobalLeak = false; let allOperationalAlerts = [];
  Object.keys(stats.meters).forEach(id => {
    const m = stats.meters[id];
    if (m.hasLeak) hasGlobalLeak = true;
    if (m.operationalAlerts.length > 0) allOperationalAlerts.push({ id, alias: m.alias, alerts: m.operationalAlerts });
  });

  if (hasGlobalLeak) {
    DOM.leakAlertBanner.style.display = 'flex';
    const leakMeters = Object.values(stats.meters).filter(m => m.hasLeak).map(m => m.alias || m.id).join(', ');
    DOM.leakAlertDesc.textContent = `Pico anômalo diário detectado em: ${leakMeters}. Limiar: >${settings.leakThreshold} m³/dia.`;
  } else { DOM.leakAlertBanner.style.display = 'none'; }

  if (allOperationalAlerts.length > 0) {
    DOM.operationalAlertsPanel.style.display = 'block';
    DOM.operationalAlertsList.innerHTML = '';
    allOperationalAlerts.forEach(item => {
      item.alerts.forEach(alertText => {
        const box = document.createElement('div');
        box.className = alertText.includes('Vazamento') ? 'alert-item-box danger' : 'alert-item-box';
        box.innerHTML = `<i data-lucide="${alertText.includes('Vazamento') ? 'droplet-off' : 'alert-triangle'}" style="width:14px; height:14px; flex-shrink:0;"></i><span><strong>${item.id} (${item.alias})</strong>: ${alertText}</span>`;
        DOM.operationalAlertsList.appendChild(box);
      });
    });
  } else { DOM.operationalAlertsPanel.style.display = 'none'; }

  renderIndividualMeterCards(stats);
  const processedReadings = calculateConsumptions(state.readings);
  renderTrendChart(DOM.trendChartCanvas, stats, processedReadings);
  renderComparisonChart(DOM.comparisonChartCanvas, stats, prevStats);
}

function renderIndividualMeterCards(stats) {
  DOM.metersCardsContainer.innerHTML = '';
  const settings = getAppSettings();
  Object.keys(settings.hydrometers).forEach(id => {
    const m = stats.meters[id];
    if (!m) return;
    let statusClass = 'badge-success', statusText = 'Normal', cardGlow = '', barGradient = 'linear-gradient(90deg, #3b82f6 0%, #10b981 100%)';
    if (m.status === 'danger') { statusClass = 'badge-alert'; statusText = 'Excedido'; cardGlow = 'border-color: rgba(239, 68, 68, 0.4); box-shadow: 0 10px 25px rgba(239, 68, 68, 0.08);'; barGradient = 'var(--grad-danger)'; }
    else if (m.status === 'warning') { statusClass = 'badge-warning'; statusText = 'Atenção'; cardGlow = 'border-color: rgba(245, 158, 11, 0.4);'; barGradient = 'var(--grad-warning)'; }
    let textFaltam = '', faltamClass = 'success';
    if (m.balance >= 0) { textFaltam = `🎯 Faltam ${m.balance.toFixed(2)} m³ para meta`; faltamClass = m.balance < (m.limit * 0.25) ? 'warning' : 'success'; }
    else { textFaltam = `🎯 Limite excedido em ${Math.abs(m.balance).toFixed(2)} m³`; faltamClass = 'danger'; }
    let dailyDotClass = 'success', dailyStatusTitle = 'Abaixo da meta esperada';
    if (m.dailyGoalStatus === 'danger') { dailyDotClass = 'danger'; dailyStatusTitle = 'Acima da meta esperada'; }
    else if (m.dailyGoalStatus === 'warning') { dailyDotClass = 'warning'; dailyStatusTitle = 'Próximo da meta esperada'; }
    const card = document.createElement('div');
    card.className = 'hidrometro-card'; card.style = cardGlow;
    card.innerHTML = `
      <div class="card-header-meter">
        <div class="meter-alias-row">
          <span class="meter-alias" id="card-alias-${id}">${m.alias}</span>
          <button class="btn-edit-alias no-print" data-id="${id}" title="Alterar apelido"><i data-lucide="edit-3"></i></button>
        </div>
        <span class="${statusClass}">${statusText}</span>
      </div>
      <div class="meter-id-label" title="Nº de série: ${id}">${id}</div>
      <div class="faltam-indicator-tag ${faltamClass}">${textFaltam}</div>
      <div class="progress-container">
        <div class="progress-label-row">
          <span>${m.consumption.toFixed(2)} m³</span>
          <span style="color: var(--text-muted);">Meta: ${m.limit} m³</span>
        </div>
        <div class="progress-track">
          <div class="progress-bar" style="width: ${Math.min(100, m.percentUsed)}%; background: ${barGradient};"></div>
          <div class="progress-marker" style="left: ${settings.alertThreshold}%;" title="Aviso (${settings.alertThreshold}%)"></div>
          <div class="today-marker" style="left: ${getExpectedPercentToday(stats)}%;" title="Ritmo esperado hoje: ${getExpectedPercentToday(stats)}% (${stats.elapsedDays}/${stats.totalDays} dias do ciclo)"></div>
        </div>
      </div>
      <div class="meter-stats-list">
        <div class="stat-item"><span class="stat-label">Meta Diária Esperada</span><span class="stat-val meta-diaria-val" title="${dailyStatusTitle}"><span class="daily-status-dot ${dailyDotClass}"></span>${m.dailyGoal.toFixed(3)} m³</span></div>
        <div class="stat-item"><span class="stat-label">Consumo Médio Real</span><span class="stat-val">${m.dailyAverage.toFixed(3)} m³</span></div>
        <div class="stat-item full-width" style="border-top: 1px dashed rgba(255,255,255,0.05); padding-top: 0.5rem; margin-top: 0.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span class="stat-label">Projeção Fechamento</span>
            <span class="stat-val" style="font-weight: 700; color: ${m.projection > m.limit ? 'var(--color-red)' : 'var(--text-primary)'};">${m.projection.toFixed(2)} m³</span>
          </div>
        </div>
      </div>`;
    DOM.metersCardsContainer.appendChild(card);
  });
  DOM.metersCardsContainer.querySelectorAll('.btn-edit-alias').forEach(btn => {
    btn.addEventListener('click', (e) => { const id = e.currentTarget.getAttribute('data-id'); editHydrometerAlias(id); });
  });
}

// ================= ABA DIRETORIA =================

function renderDiretoriaTab(stats, prevStats) {
  DOM.dirEmissionDate.textContent = formatDate(new Date(), true);
  DOM.dirCycleLabel.textContent = stats.label;
  DOM.dirExecPeriod.textContent = `${formatDate(stats.startDate)} a ${formatDate(stats.endDate)}`;
  DOM.dirExecConsumed.textContent = `${stats.totalConsumption.toFixed(2)} m³`;
  DOM.dirExecMetaVal.textContent = `${stats.metaGlobal.toFixed(2)} m³`;
  const isGlobalEconomy = stats.globalBalance >= 0;
  DOM.dirExecBalance.textContent = `${stats.globalBalance.toFixed(2)} m³`;
  DOM.dirExecBalance.className = isGlobalEconomy ? 'exec-val text-glow-green' : 'exec-val text-glow-red';
  DOM.dirExecBalanceSub.textContent = isGlobalEconomy ? 'Dentro do limite global combinado' : 'Meta global ultrapassada';
  DOM.dirExecProjection.textContent = `${stats.totalProjection.toFixed(2)} m³`;
  DOM.dirExecProjectionSub.textContent = stats.totalProjection > stats.metaGlobal ? 'Possível excesso ao fechar o ciclo' : 'Projeção dentro do esperado';
  DOM.dirExecProgressBar.style.width = `${Math.min(100, stats.globalPercentUsed)}%`;
  if (DOM.dirExecTodayMarker) {
    const expectedPercentToday = getExpectedPercentToday(stats);
    DOM.dirExecTodayMarker.style.left = `${expectedPercentToday}%`;
    DOM.dirExecTodayMarker.title = `Ritmo esperado hoje: ${expectedPercentToday}% (${stats.elapsedDays}/${stats.totalDays} dias do ciclo)`;
  }
  if (prevStats) {
    const comp = compareCycles(state.readings, stats.cycleKey, prevStats.cycleKey);
    DOM.dirKpiEconomy.textContent = `${comp.diff.toFixed(2)} m³`;
    DOM.dirKpiEconomySub.textContent = comp.isEconomy ? `Economia de -${comp.percentDiff}%` : `Aumento de +${comp.percentDiff}%`;
    DOM.dirKpiEconomy.style.color = comp.isEconomy ? 'var(--color-green)' : 'var(--color-red)';
  } else { DOM.dirKpiEconomy.textContent = '0.00 m³'; DOM.dirKpiEconomySub.textContent = 'Primeiro Ciclo'; }
  DOM.dirKpiAlerts.textContent = `${stats.alertMetersCount} / 4`;
  DOM.dirKpiAvgGeneral.textContent = `${stats.generalDailyAverage.toFixed(2)} m³/d`;
  DOM.dirRankingList.innerHTML = '';
  stats.ranking.forEach(r => {
    let medal = '🥉';
    if (r.position === 1) medal = '🥇';
    else if (r.position === 2) medal = '🥈';
    const div = document.createElement('div');
    div.className = 'ranking-item';
    div.innerHTML = `<div class="ranking-left"><div class="ranking-position">${r.position}</div><div class="ranking-details"><span class="ranking-name">${r.name.split(' & ')[0]} ${medal}</span><span class="ranking-alias">${r.id} (${r.alias})</span></div></div><div class="ranking-value"><span>${r.consumption.toFixed(2)} m³</span><div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 500;">${r.percentUsed}% da meta</div></div>`;
    DOM.dirRankingList.appendChild(div);
  });
  DOM.dirTableSummary.innerHTML = '';
  Object.keys(stats.meters).forEach(id => {
    const m = stats.meters[id];
    const indicatorColor = m.status === 'danger' ? 'var(--color-red)' : (m.status === 'warning' ? 'var(--color-orange)' : 'var(--color-green)');
    const indicatorText = m.status === 'danger' ? 'Excedido' : (m.status === 'warning' ? 'Atenção' : 'Normal');
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${id}</td><td style="font-weight:600;">${m.alias}</td><td style="font-weight:700;">${m.consumption.toFixed(2)} m³</td><td>${m.limit} m³</td><td><span style="color: ${indicatorColor}; font-weight:700;">${indicatorText}</span></td>`;
    DOM.dirTableSummary.appendChild(tr);
  });
}

// ================= ABA CICLOS =================

function renderCyclesTab(cycles) {
  DOM.historyCyclesTbody.innerHTML = '';
  if (cycles.length === 0) { DOM.historyCyclesTbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:2rem;">Nenhum ciclo registrado.</td></tr>'; return; }
  cycles.forEach((c, index) => {
    const stats = getCycleStats(state.readings, c);
    let economyText = '0.00 m³';
    if (index < cycles.length - 1) { const prevC = cycles[index + 1]; const comp = compareCycles(state.readings, c, prevC); const sign = comp.isEconomy ? '-' : '+'; economyText = `${sign}${comp.diff.toFixed(2)} m³ (${sign}${comp.percentDiff}%)`; }
    else economyText = 'Leitura Base';
    const tr = document.createElement('tr');
    tr.innerHTML = `<td style="font-weight: 700; color: var(--color-blue);">${stats.label}</td><td style="font-weight: 600;">${stats.totalConsumption.toFixed(2)} m³</td><td>${stats.metaGlobal} m³</td><td style="color: ${economyText.includes('-') ? 'var(--color-green)' : (economyText.includes('+') ? 'var(--color-red)' : 'inherit')};">${economyText}</td><td style="text-align:center;">${stats.alertMetersCount} / 4</td><td><span class="${stats.globalStatus === 'danger' ? 'badge-alert' : (stats.globalStatus === 'warning' ? 'badge-warning' : 'badge-success')}">${stats.globalStatus === 'danger' ? 'Excedida' : (stats.globalStatus === 'warning' ? 'Alerta' : 'Abaixo da Meta')}</span></td>`;
    DOM.historyCyclesTbody.appendChild(tr);
  });
  DOM.compCycle1.innerHTML = ''; DOM.compCycle2.innerHTML = '';
  cycles.forEach(c => {
    const stats = getCycleStats(state.readings, c);
    const opt1 = document.createElement('option'); opt1.value = c; opt1.textContent = stats.label; DOM.compCycle1.appendChild(opt1);
    const opt2 = document.createElement('option'); opt2.value = c; opt2.textContent = stats.label; DOM.compCycle2.appendChild(opt2);
  });
  if (cycles.length > 1) DOM.compCycle2.value = cycles[1];
}

// ================= ABA CONFIGURAÇÕES =================

function renderConfiguracoesTab() {
  const settings = getAppSettings();
  DOM.adminMetaGlobal.value = settings.metaGlobal;
  DOM.adminMetaIndividual.value = settings.metaIndividual;
  DOM.adminAlertThreshold.value = settings.alertThreshold;
  DOM.adminLeakThreshold.value = settings.leakThreshold;
  if (DOM.adminOsDiasAberta) DOM.adminOsDiasAberta.value = settings.alertOsDiasAberta;
  if (DOM.adminOsDiasAguardando) DOM.adminOsDiasAguardando.value = settings.alertOsDiasAguardando;
  if (DOM.adminPerdasLimite) DOM.adminPerdasLimite.value = settings.alertPerdasLimite;
  if (DOM.adminChecklistHoras) DOM.adminChecklistHoras.value = settings.alertChecklistHoras;

  const doc = settings.documentosVencimento || {};
  if (DOM.adminDocTcVigilancia) DOM.adminDocTcVigilancia.value = doc.tcVigilancia || '';
  if (DOM.adminDocTcAvcb) DOM.adminDocTcAvcb.value = doc.tcAvcb || '';
  if (DOM.adminDocYukaVigilancia) DOM.adminDocYukaVigilancia.value = doc.yukaVigilancia || '';
  if (DOM.adminDocYukaAvcb) DOM.adminDocYukaAvcb.value = doc.yukaAvcb || '';
  if (DOM.adminDocCdVigilancia) DOM.adminDocCdVigilancia.value = doc.cdVigilancia || '';
  if (DOM.adminDocCdAvcb) DOM.adminDocCdAvcb.value = doc.cdAvcb || '';
  if (DOM.adminDocCdVre) DOM.adminDocCdVre.value = doc.cdVre || '';

  DOM.adminMetersList.innerHTML = '';
  Object.keys(settings.hydrometers).forEach(id => {
    const h = settings.hydrometers[id];
    const div = document.createElement('div'); div.className = 'meter-config-item';
    div.innerHTML = `<div class="meter-config-header"><h4>${id}</h4><span>${h.name}</span></div><div class="form-group" style="margin-bottom: 0;"><label class="form-label" style="font-size:0.75rem;">Apelido</label><input type="text" class="form-control admin-meter-alias-input" data-id="${id}" value="${h.alias}" required></div><div class="form-group" style="margin-bottom: 0;"><label class="form-label" style="font-size:0.75rem;">Cor do Indicador</label><input type="color" class="form-control" data-id="${id}" value="${h.color}" style="height:38px; padding:2px; cursor:pointer;" required></div>`;
    DOM.adminMetersList.appendChild(div);
  });

  populateMetersSelectInputs();
  renderReadingsTable();
}

// ================= TABELA DE LEITURAS =================

function renderReadingsTable() {
  const meterFilter = state.filters.meter;
  const cycleFilter = state.selectedCycleKey;
  const processed = calculateConsumptions(state.readings);
  const settings = getAppSettings();
  const filtered = processed.filter(r => {
    if (meterFilter !== 'all' && r.meterId !== meterFilter) return false;
    if (cycleFilter) { const info = getCycleStats(state.readings, cycleFilter); const rDate = new Date(r.date); if (rDate < info.startDate || rDate > info.endDate) return false; }
    return true;
  });
  DOM.tableRecordCount.textContent = `${filtered.length} registro(s) no ciclo`;
  DOM.readingsTableBody.innerHTML = '';
  if (filtered.length === 0) { DOM.readingsTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 2rem;">Nenhum lançamento encontrado para os filtros selecionados neste ciclo.</td></tr>`; return; }
  filtered.forEach(r => {
    const meterInfo = settings.hydrometers[r.meterId] || { alias: 'Desconhecido', color: '#6b7280', name: 'N/A' };
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${formatDate(r.date, true)}</td><td><span class="cell-indicator" style="background-color: ${meterInfo.color};"></span><span class="cell-meter"><span class="cell-meter-name">${meterInfo.name.split(' & ')[0]}</span><span class="cell-meter-id">${r.meterId} (${meterInfo.alias})</span></span></td><td style="font-weight: 500;">${r.index.toLocaleString('pt-BR', { minimumFractionDigits: 3 })} m³</td><td style="font-weight: 600;">${r.isInitial ? '<span style="color: var(--text-muted); font-size: 0.8rem; font-weight: normal;">Leitura Inicial</span>' : `+${r.consumption.toLocaleString('pt-BR', { minimumFractionDigits: 3 })} m³`}</td><td>${!r.isInitial ? `<button class="btn btn-danger btn-icon-only btn-delete-reading-v2" data-id="${r.id}" title="Excluir Leitura" type="button"><i data-lucide="x" style="width: 14px; height: 14px;"></i></button>` : '<span style="color: var(--text-muted); font-size: 0.8rem;">-</span>'}</td>`;
    DOM.readingsTableBody.appendChild(tr);
  });
  DOM.readingsTableBody.querySelectorAll('.btn-delete-reading-v2').forEach(btn => {
    btn.addEventListener('click', (e) => { const id = e.currentTarget.getAttribute('data-id'); deleteReading(id); });
  });
}

// ================= EVENTOS =================

function initEventListeners() {
  DOM.tabButtons.forEach(btn => { btn.addEventListener('click', (e) => { const tab = e.currentTarget.getAttribute('data-tab'); switchTab(tab); }); });
  if (DOM.cycleSelect) { DOM.cycleSelect.addEventListener('change', (e) => { state.selectedCycleKey = e.target.value; refreshApp(); }); }
  if (DOM.filterMeter) { DOM.filterMeter.addEventListener('change', (e) => { state.filters.meter = e.target.value; renderReadingsTable(); if (typeof lucide !== 'undefined') lucide.createIcons(); }); }
  if (DOM.btnOpenReadingModal) { DOM.btnOpenReadingModal.addEventListener('click', () => { resetReadingFormDate(); updateLastReadingHelp(); openModal(DOM.modalReading); }); }
  if (DOM.btnCloseReadingModal) DOM.btnCloseReadingModal.addEventListener('click', () => { closeModal(DOM.modalReading); DOM.formReading.reset(); });
  if (DOM.btnCancelReading) DOM.btnCancelReading.addEventListener('click', () => { closeModal(DOM.modalReading); DOM.formReading.reset(); });
  if (DOM.inputMeter) DOM.inputMeter.addEventListener('change', updateLastReadingHelp);
  if (DOM.inputReset) DOM.inputReset.addEventListener('change', () => { if (DOM.inputReset.checked) { DOM.inputIndex.removeAttribute('min'); DOM.inputIndex.placeholder = 'Ex: 0.000 (nova leitura do relógio trocado)'; } else { updateLastReadingHelp(); } });
  if (DOM.formReading) { DOM.formReading.addEventListener('submit', (e) => { e.preventDefault(); submitReadingForm(); }); }
  if (DOM.btnOpenCsvModal) { DOM.btnOpenCsvModal.addEventListener('click', () => { DOM.csvErrorsContainer.style.display = 'none'; DOM.csvFileInput.value = ''; openModal(DOM.modalCsv); }); }
  if (DOM.btnCloseCsvModal) DOM.btnCloseCsvModal.addEventListener('click', () => closeModal(DOM.modalCsv));
  if (DOM.btnCloseCsvModalFooter) DOM.btnCloseCsvModalFooter.addEventListener('click', () => closeModal(DOM.modalCsv));
  if (DOM.csvDragZone && DOM.csvFileInput) {
    DOM.csvDragZone.addEventListener('click', () => DOM.csvFileInput.click());
    DOM.csvFileInput.addEventListener('change', handleCsvFileSelect);
    DOM.csvDragZone.addEventListener('dragover', (e) => { e.preventDefault(); DOM.csvDragZone.classList.add('dragover'); });
    DOM.csvDragZone.addEventListener('dragleave', () => { DOM.csvDragZone.classList.remove('dragover'); });
    DOM.csvDragZone.addEventListener('drop', (e) => { e.preventDefault(); DOM.csvDragZone.classList.remove('dragover'); if (e.dataTransfer.files.length > 0) processCsvFile(e.dataTransfer.files[0]); });
  }
  if (DOM.btnGoogleSheetsImport) { DOM.btnGoogleSheetsImport.addEventListener('click', () => { alert('Funcionalidade em desenvolvimento.'); syncGoogleSheetsFuture(state.readings); }); }
  DOM.btnExportPdf.addEventListener('click', () => {
    showToast('Gerando relatório PDF...', 'info');
    const stats = getCycleStats(state.readings, state.selectedCycleKey);
    const availableCycles = getAvailableCycles(state.readings);
    const currentIndex = availableCycles.indexOf(state.selectedCycleKey);
    const prevCycleKey = currentIndex !== -1 && currentIndex < availableCycles.length - 1 ? availableCycles[currentIndex + 1] : null;
    const comparison = compareCycles(state.readings, stats.cycleKey, prevCycleKey);
    exportToPDF(stats, comparison, DOM.trendChartCanvas, DOM.comparisonChartCanvas);
  });
  DOM.btnExportXlsx.addEventListener('click', () => { try { exportToExcel(state.readings); showToast('Planilha Excel (.xlsx) baixada!', 'success'); } catch (e) { showToast(e.message, 'error'); } });
  DOM.btnExportCsv.addEventListener('click', () => { exportToCSV(state.readings); showToast('Arquivo CSV baixado!', 'success'); });
  DOM.btnExportJson.addEventListener('click', () => { exportToJSON(state.readings); showToast('Backup JSON baixado!', 'success'); });
  if (DOM.btnPrintPresentation) DOM.btnPrintPresentation.addEventListener('click', () => { window.print(); });
  if (DOM.btnRunCyclesComparison) DOM.btnRunCyclesComparison.addEventListener('click', runCyclesComparison);
  if (DOM.btnSaveAdminSettings) DOM.btnSaveAdminSettings.addEventListener('click', submitAdminSettings);

  const reqFormToggle = document.getElementById('formularios-requisicoes-toggle');
  const reqFormMenu = document.getElementById('formularios-requisicoes-menu');
  if (reqFormToggle && reqFormMenu) {
    reqFormToggle.addEventListener('click', (e) => { e.stopPropagation(); reqFormMenu.style.display = reqFormMenu.style.display === 'none' ? 'block' : 'none'; });
    document.addEventListener('click', (e) => { if (!reqFormMenu.contains(e.target) && e.target !== reqFormToggle) reqFormMenu.style.display = 'none'; });
  }

  const exportToggle = document.getElementById('btn-export-toggle');
  const exportMenu = document.getElementById('export-actions-menu');
  if (exportToggle && exportMenu) {
    exportToggle.addEventListener('click', (e) => { e.stopPropagation(); exportMenu.style.display = exportMenu.style.display === 'none' ? 'block' : 'none'; });
    exportMenu.addEventListener('click', (e) => { if (e.target.closest('button')) exportMenu.style.display = 'none'; });
    document.addEventListener('click', (e) => { if (!exportMenu.contains(e.target) && e.target !== exportToggle) exportMenu.style.display = 'none'; });
  }

  const osFilterStatus = document.getElementById('os-filter-status');
  if (osFilterStatus) osFilterStatus.addEventListener('change', () => { carregarOS(); });
  const osFilterPrioridade = document.getElementById('os-filter-prioridade');
  if (osFilterPrioridade) osFilterPrioridade.addEventListener('change', () => { carregarOS(); });

  const btnCloseDedetizacao = document.getElementById('btn-close-dedetizacao-modal');
  if (btnCloseDedetizacao) btnCloseDedetizacao.addEventListener('click', _fecharModalDedetizacao);
  const btnCancelDedetizacao = document.getElementById('btn-cancel-dedetizacao');
  if (btnCancelDedetizacao) btnCancelDedetizacao.addEventListener('click', _fecharModalDedetizacao);
  const formDedetizacao = document.getElementById('form-dedetizacao');
  if (formDedetizacao) formDedetizacao.addEventListener('submit', _submeterFormDedetizacao);
}

function switchTab(tabName) {
  state.currentTab = tabName;
  DOM.tabButtons.forEach(btn => { btn.getAttribute('data-tab') === tabName ? btn.classList.add('active') : btn.classList.remove('active'); });
  DOM.tabPanels.forEach(panel => { panel.getAttribute('id') === `tab-content-${tabName}` ? panel.classList.add('active') : panel.classList.remove('active'); });
  if (tabName === 'configuracoes') populateMetersSelectInputs();
  refreshApp();
  if (tabName === 'dashboard') {
    sincronizarAguaComPlanilha().then(() => { if (state.currentTab === 'dashboard') refreshApp(); });
  }
}

function openModal(modal) { modal.classList.add('active'); modal.setAttribute('aria-hidden', 'false'); }
function closeModal(modal) { modal.classList.remove('active'); modal.setAttribute('aria-hidden', 'true'); }

function resetReadingFormDate() {
  const now = new Date();
  DOM.inputDate.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function populateMetersSelectInputs() {
  const settings = getAppSettings();
  DOM.inputMeter.innerHTML = '';
  Object.keys(settings.hydrometers).forEach(id => {
    const h = settings.hydrometers[id];
    const option = document.createElement('option'); option.value = id; option.textContent = `${id} - ${h.name} (${h.alias})`;
    DOM.inputMeter.appendChild(option);
  });
  if (DOM.filterMeter) {
    const previousValue = DOM.filterMeter.value || state.filters.meter || 'all';
    DOM.filterMeter.innerHTML = '<option value="all">Todos</option>';
    Object.keys(settings.hydrometers).forEach(id => {
      const h = settings.hydrometers[id];
      const option = document.createElement('option'); option.value = id; option.textContent = `${id} (${h.alias})`;
      DOM.filterMeter.appendChild(option);
    });
    DOM.filterMeter.value = previousValue;
    if (DOM.filterMeter.value !== previousValue) DOM.filterMeter.value = 'all';
  }
}

function updateLastReadingHelp() {
  const meterId = DOM.inputMeter.value;
  if (!meterId) return;
  const meterReadings = state.readings.filter(r => r.meterId === meterId).sort((a, b) => new Date(b.date) - new Date(a.date));
  if (meterReadings.length > 0) {
    const last = meterReadings[0];
    DOM.lastReadingHelp.textContent = `Última leitura: ${last.index.toLocaleString('pt-BR')} m³ em ${formatDate(last.date, true)}`;
    DOM.inputIndex.min = last.index; DOM.inputIndex.placeholder = `Mínimo: ${last.index.toFixed(3)}`;
  } else { DOM.lastReadingHelp.textContent = 'Sem leituras registradas.'; DOM.inputIndex.removeAttribute('min'); DOM.inputIndex.placeholder = 'Ex: 100.000'; }
}

function submitReadingForm() {
  const meterId = DOM.inputMeter.value; const index = parseFloat(DOM.inputIndex.value); const dateStr = DOM.inputDate.value;
  if (isNaN(index) || index < 0) { showToast('Leitura acumulada inválida.', 'error'); return; }
  const newDate = new Date(dateStr);
  if (isNaN(newDate.getTime())) { showToast('Data e hora inválidas.', 'error'); return; }
  if (checkDuplicateDayReading(state.readings, meterId, newDate)) { showToast(`Bloqueado: O hidrômetro ${meterId} já possui uma leitura registrada para o dia civil ${formatDate(newDate)}. Limite de 1 por dia.`, 'error'); return; }
  const isReset = !!(DOM.inputReset && DOM.inputReset.checked);
  const previousReading = state.readings.filter(r => r.meterId === meterId && new Date(r.date) < newDate).sort((a, b) => new Date(b.date) - new Date(a.date))[0];
  if (!isReset && previousReading && index < previousReading.index) { showToast(`Erro: Leitura (${index} m³) menor que o registro anterior (${previousReading.index} m³) do dia ${formatDate(previousReading.date, true)}.`, 'error'); return; }
  const nextReading = state.readings.filter(r => r.meterId === meterId && new Date(r.date) > newDate).sort((a, b) => new Date(a.date) - new Date(b.date))[0];
  if (!isReset && nextReading && index > nextReading.index) { showToast(`Erro: Leitura (${index} m³) maior que o registro posterior (${nextReading.index} m³) do dia ${formatDate(nextReading.date, true)}.`, 'error'); return; }
  const newReading = { id: `reading-${meterId}-${newDate.getTime()}-${Math.floor(Math.random() * 1000)}`, meterId, date: newDate.toISOString(), index: Number(index.toFixed(3)), ...(isReset ? { isInitial: true } : {}) };
  state.readings.push(newReading); state.readings.sort((a, b) => new Date(b.date) - new Date(a.date));
  saveReadings(state.readings); updateAppSelectors(); refreshApp();
  closeModal(DOM.modalReading); DOM.formReading.reset(); showToast('Leitura adicionada com sucesso!', 'success');
}

function deleteReading(id) {
  if (confirm('Tem certeza que deseja excluir esta leitura? O consumo será recalculado.')) {
    state.readings = state.readings.filter(r => r.id !== id);
    saveReadings(state.readings); updateAppSelectors(); refreshApp(); showToast('Leitura excluída.', 'success');
  }
}

function editHydrometerAlias(id) {
  const settings = getAppSettings(); const h = settings.hydrometers[id]; if (!h) return;
  const newAlias = prompt(`Digite o novo apelido para o Hidrômetro ${id} (Atual: ${h.alias}):`, h.alias);
  if (newAlias === null) return;
  const cleanAlias = newAlias.trim().toUpperCase();
  if (!cleanAlias) { alert('Apelido não pode ser vazio!'); return; }
  h.alias = cleanAlias; saveAppSettings(settings); updateAppSelectors(); refreshApp();
  showToast(`Apelido do hidrômetro ${id} atualizado para "${cleanAlias}".`, 'success');
}

// ================= CSV IMPORTER =================

function handleCsvFileSelect(e) { if (e.target.files.length > 0) processCsvFile(e.target.files[0]); }

function processCsvFile(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    const csvText = e.target.result;
    try {
      const result = parseCSV(csvText, state.readings);
      state.readings = result.mergedReadings; saveReadings(state.readings);
      updateAppSelectors(); refreshApp();
      let msg = `${result.importedCount} novas leituras importadas.`;
      if (result.overwrittenCount > 0) msg += ` ${result.overwrittenCount} leituras diárias atualizadas para o valor mais recente.`;
      showToast(msg, 'success');
      if (result.errorsCount > 0) {
        DOM.csvErrorsContainer.style.display = 'block'; DOM.csvErrorsList.innerHTML = '';
        result.errors.forEach(err => { const li = document.createElement('li'); li.textContent = err; DOM.csvErrorsList.appendChild(li); });
        showToast(`Importação com ${result.errorsCount} inconsistências ignoradas.`, 'warning');
      } else { DOM.csvErrorsContainer.style.display = 'none'; closeModal(DOM.modalCsv); }
    } catch (err) { showToast(err.message, 'error'); }
  };
  reader.onerror = () => { showToast('Falha na leitura do arquivo CSV.', 'error'); };
  reader.readAsText(file);
}

// ================= COMPARAÇÃO HISTÓRICA =================

function runCyclesComparison() {
  const cycleA = DOM.compCycle1.value; const cycleB = DOM.compCycle2.value;
  if (cycleA === cycleB) { showToast('Selecione dois ciclos diferentes para comparar.', 'warning'); return; }
  const comparison = compareCycles(state.readings, cycleA, cycleB);
  DOM.cyclesComparisonResults.style.display = 'block';
  DOM.compResultsTitle.textContent = `Balanço Geral: Ciclo ${comparison.currentLabel} vs. Ciclo ${comparison.prevLabel}`;
  if (comparison.isEconomy) { DOM.compResultsBadge.className = 'comparador-resultado economia'; DOM.compResultsBadge.innerHTML = `<i data-lucide="arrow-down"></i>Economia de ${comparison.diff.toFixed(2)} m³ (-${comparison.percentDiff}%)`; DOM.compResultsSub.textContent = `O consumo geral caiu de ${comparison.prevConsumption.toFixed(2)} m³ para ${comparison.currentConsumption.toFixed(2)} m³.`; }
  else { DOM.compResultsBadge.className = 'comparador-resultado aumento'; DOM.compResultsBadge.innerHTML = `<i data-lucide="arrow-up"></i>Aumento de ${comparison.diff.toFixed(2)} m³ (+${comparison.percentDiff}%)`; DOM.compResultsSub.textContent = `O consumo geral subiu de ${comparison.prevConsumption.toFixed(2)} m³ para ${comparison.currentConsumption.toFixed(2)} m³.`; }
  DOM.compResultsTbody.innerHTML = '';
  const settings = getAppSettings();
  Object.keys(settings.hydrometers).forEach(id => {
    const compMeter = comparison.meters[id]; if (!compMeter) return;
    const meterInfo = settings.hydrometers[id];
    const economyStatusClass = compMeter.isEconomy ? 'badge-success' : 'badge-alert';
    const economyStatusText = compMeter.isEconomy ? `Economia (-${Math.abs(compMeter.percentDiff)}%)` : `Aumento (+${Math.abs(compMeter.percentDiff)}%)`;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td style="font-family:monospace;">${id}</td><td style="font-weight:600;">${meterInfo.alias}</td><td>${compMeter.current.toFixed(3)} m³</td><td>${compMeter.previous.toFixed(3)} m³</td><td style="font-weight:700; color: ${compMeter.isEconomy ? 'var(--color-green)' : 'var(--color-red)'}">${compMeter.diff > 0 ? '+' : ''}${compMeter.diff.toFixed(3)} m³</td><td><span class="${economyStatusClass}">${economyStatusText}</span></td>`;
    DOM.compResultsTbody.appendChild(tr);
  });
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ================= SALVAR CONFIGURAÇÕES =================

function submitAdminSettings() {
  const settings = getAppSettings();
  const metaGlobal = parseFloat(DOM.adminMetaGlobal.value);
  const metaIndividual = parseFloat(DOM.adminMetaIndividual.value);
  const alertThreshold = parseInt(DOM.adminAlertThreshold.value);
  const leakThreshold = parseFloat(DOM.adminLeakThreshold.value);
  const alertOsDiasAberta = parseInt(DOM.adminOsDiasAberta?.value || settings.alertOsDiasAberta);
  const alertOsDiasAguardando = parseInt(DOM.adminOsDiasAguardando?.value || settings.alertOsDiasAguardando);
  const alertPerdasLimite = parseInt(DOM.adminPerdasLimite?.value || settings.alertPerdasLimite);
  const alertChecklistHoras = parseInt(DOM.adminChecklistHoras?.value || settings.alertChecklistHoras);

  if (isNaN(metaGlobal) || metaGlobal <= 0 || isNaN(metaIndividual) || metaIndividual <= 0) { showToast('Valores de metas devem ser maiores que zero.', 'error'); return; }
  if (isNaN(alertThreshold) || alertThreshold < 50 || alertThreshold > 100) { showToast('O percentual de alerta deve estar entre 50% e 100%.', 'error'); return; }
  if (isNaN(leakThreshold) || leakThreshold <= 0) { showToast('O limite de vazamento diário deve ser maior que zero.', 'error'); return; }

  settings.metaGlobal = metaGlobal; settings.metaIndividual = metaIndividual;
  settings.alertThreshold = alertThreshold; settings.leakThreshold = leakThreshold;
  settings.alertOsDiasAberta = alertOsDiasAberta; settings.alertOsDiasAguardando = alertOsDiasAguardando;
  settings.alertPerdasLimite = alertPerdasLimite; settings.alertChecklistHoras = alertChecklistHoras;

  settings.documentosVencimento = {
    tcVigilancia: DOM.adminDocTcVigilancia?.value || null,
    tcAvcb: DOM.adminDocTcAvcb?.value || null,
    yukaVigilancia: DOM.adminDocYukaVigilancia?.value || null,
    yukaAvcb: DOM.adminDocYukaAvcb?.value || null,
    // CD é isento de alvará da vigilância sanitária: campo fica sempre bloqueado/sem data,
    // a flag é fixada aqui (não vem de input) para não depender do que já está salvo no navegador.
    cdVigilancia: null,
    cdVigilanciaIsento: true,
    cdAvcb: DOM.adminDocCdAvcb?.value || null,
    cdVre: DOM.adminDocCdVre?.value || null
  };

  const aliasInputs = DOM.adminMetersList.querySelectorAll('.admin-meter-alias-input');
  aliasInputs.forEach(input => { const id = input.getAttribute('data-id'); const aliasValue = input.value.trim().toUpperCase(); if (aliasValue && settings.hydrometers[id]) settings.hydrometers[id].alias = aliasValue; });
  const colorInputs = DOM.adminMetersList.querySelectorAll('input[type="color"]');
  colorInputs.forEach(input => { const id = input.getAttribute('data-id'); const colorValue = input.value; if (colorValue && settings.hydrometers[id]) settings.hydrometers[id].color = colorValue; });

  saveAppSettings(settings);
  // Invalida cache de alertas para recalcular com novos parâmetros
  state.alertasCache = null;
  updateAppSelectors(); refreshApp();
  renderDocumentosVencimentoBar();
  showToast('Configurações salvas e aplicadas com sucesso!', 'success');
}

// ================= MÓDULO REQUISIÇÕES =================

function carregarRequisicoes() {
  const btnLimpeza = document.getElementById('btn-limpeza');
  const btnMP = document.getElementById('btn-mp');
  const conteudo = document.getElementById('requisicoes-conteudo');
  if (!conteudo) return;

  if (btnLimpeza) {
    btnLimpeza.onclick = async () => {
      try {
        conteudo.innerHTML = `<div class="panel-header"><h2>🧹 Limpeza e EPI</h2></div><p>Carregando requisições...</p>`;
        const response = await fetch(LIMPEZA_CSV_URL);
        const csv = await response.text();
        const linhas = parseCSVLinhas(csv);
        if (linhas.length < 2) { conteudo.innerHTML = `<div class="panel-header"><h2>🧹 Limpeza e EPI</h2></div><p>Nenhuma requisição encontrada.</p>`; return; }

        const cabecalho = linhas[0].map(c => c.trim());
        const campos = _reqDetectarCampos(cabecalho);

        const registros = [];
        for (let i = 1; i < linhas.length; i++) {
          const cols = linhas[i];
          if (cols.every(c => !c || !c.trim())) continue;
          const registro = {};
          cabecalho.forEach((nomeCol, idx) => { registro[nomeCol] = (cols[idx] || '').trim(); });
          registros.push(registro);
        }

        renderTabelaRequisicoesLimpeza(campos, registros, conteudo);

      } catch (erro) { console.error(erro); conteudo.innerHTML = `<div class="panel-header"><h2>🧹 Limpeza e EPI</h2></div><p>Erro ao carregar requisições.</p>`; }
    };
  }

  if (btnMP) {
    btnMP.onclick = async () => {
      try {
        conteudo.innerHTML = `<div class="panel-header"><h2>🥩 MP e Recheios</h2></div><p>Carregando...</p>`;
        const response = await fetch(MP_CSV_URL);
        const csv = await response.text();
        const linhas = parseCSVLinhas(csv);
        if (linhas.length < 2) { conteudo.innerHTML = `<div class="panel-header"><h2>🥩 MP e Recheios</h2></div><p>Nenhuma requisição encontrada.</p>`; return; }

        const cabecalho = linhas[0];
        const CAMPOS_FIXOS_MP = ['Timestamp', 'Nome do requisitante', 'Unidade solicitante', 'Setor solicitante', 'Tipo de item requisitado', 'Prioridade', 'Finalidade da requisição', 'Observações', 'STATUS', 'REQUISICOES'];
        const colunasProduto = cabecalho.filter(c => !CAMPOS_FIXOS_MP.includes(c.trim()));

        const registros = [];
        for (let i = 1; i < linhas.length; i++) {
          const cols = linhas[i];
          if (cols.every(c => !c || !c.trim())) continue;
          const registro = {};
          cabecalho.forEach((nomeCol, idx) => { registro[nomeCol.trim()] = (cols[idx] || '').trim(); });
          registros.push(registro);
        }

        renderTabelaRequisicoesMP(cabecalho, colunasProduto, registros, conteudo);

      } catch (erro) { console.error(erro); conteudo.innerHTML = `<div class="panel-header"><h2>🥩 MP e Recheios</h2></div><p>Erro ao carregar dados.</p>`; }
    };
  }
}

// Parser de CSV que respeita aspas, vírgulas e quebras de linha dentro de campos (célula do
// Google Sheets com texto em várias linhas vira um campo só entre aspas, como manda o padrão
// CSV). Processa o texto inteiro caractere a caractere em vez de quebrar por linha primeiro —
// se quebrasse por linha antes, uma célula multi-linha cortaria o CSV no meio e bagunçaria
// todas as linhas seguintes.
function parseCSVLinhas(csvText) {
  const linhas = [];
  let campos = [];
  let atual = '';
  let dentroAspas = false;
  const texto = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < texto.length; i++) {
    const char = texto[i];
    if (dentroAspas) {
      if (char === '"') {
        if (texto[i + 1] === '"') { atual += '"'; i++; } // aspas duplas escapadas ("" dentro do campo)
        else { dentroAspas = false; }
      } else {
        atual += char;
      }
      continue;
    }
    if (char === '"') { dentroAspas = true; }
    else if (char === ',') { campos.push(atual); atual = ''; }
    else if (char === '\n') { campos.push(atual); atual = ''; linhas.push(campos); campos = []; }
    else { atual += char; }
  }
  // Última linha, caso o texto não termine com quebra de linha
  if (atual !== '' || campos.length > 0) { campos.push(atual); linhas.push(campos); }

  return linhas.filter(l => !(l.length === 1 && l[0] === ''));
}

// Converte um Timestamp do Google Sheets/Forms (geralmente mm/dd/yyyy hh:mm:ss
// ou variações) para o formato brasileiro dd/mm/yyyy hh:mm. Mantém o texto
// original se não conseguir interpretar como data válida.
function formatarTimestampBR(valorOriginal) {
  if (!valorOriginal || !valorOriginal.trim()) return '-';

  const texto = valorOriginal.trim();

  // Tenta separar "data" de "hora", caso existam ambos
  const partes = texto.split(' ');
  const partedata = partes[0];
  const partehora = partes.length > 1 ? partes.slice(1).join(' ') : '';

  // Espera algo como m/d/yyyy ou mm/dd/yyyy
  const match = partedata.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (!match) return texto; // não reconheceu o padrão, devolve como veio

  const mes = match[1].padStart(2, '0');
  const dia = match[2].padStart(2, '0');
  const ano = match[3];

  const dataFormatada = `${dia}/${mes}/${ano}`;

  return partehora ? `${dataFormatada} ${partehora}` : dataFormatada;
}

function renderTabelaRequisicoesMP(cabecalho, colunasProduto, registros, conteudo) {
  const empresas = new Set();
  registros.forEach(r => { const u = (r['Unidade solicitante'] || '').toUpperCase(); if (u) empresas.add(u); });
  const empresasOrdenadas = ['TODOS', ...Array.from(empresas).sort()];

  function getItensDoRegistro(registro) {
    const itens = [];
    colunasProduto.forEach(produto => {
      const valor = registro[produto.trim()];
      if (valor && valor !== '0') itens.push(`${produto.trim()}: ${valor}`);
    });
    return itens;
  }

  function filtrarRegistros(filtro) {
    if (filtro === 'TODOS') return registros;
    return registros.filter(r => (r['Unidade solicitante'] || '').toUpperCase() === filtro);
  }

  function getLinhasTabela(filtro) {
    const filtrados = filtrarRegistros(filtro);
    return filtrados.map((r, idx) => {
      const itens = getItensDoRegistro(r);
      const itensTexto = itens.length > 0 ? itens.join(' • ') : '<span style="color:var(--text-muted);">Nenhum item</span>';
      return `<tr>
        <td style="font-size:0.8rem;">${formatarTimestampBR(r['Timestamp'])}</td>
        <td>${r['Nome do requisitante'] || '-'}</td>
        <td>${r['Unidade solicitante'] || '-'}</td>
        <td>${r['Setor solicitante'] || '-'}</td>
        <td>${r['Prioridade'] || '-'}</td>
        <td>${r['STATUS'] || '-'}</td>
        <td style="font-size:0.78rem; max-width:320px;">${itensTexto}</td>
      </tr>`;
    }).join('');
  }

  conteudo.innerHTML = `
    <div class="panel-header">
      <h2>🥩 MP e Recheios</h2>
      <button id="btn-pdf-req-mp" class="btn btn-primary" style="font-size:0.82rem;">
        <i data-lucide="file-text"></i> Gerar PDF
      </button>
    </div>

    <div style="display:flex; align-items:center; gap:1rem; margin-bottom:1rem; flex-wrap:wrap;">
      <div class="filter-group">
        <label class="form-label" style="margin-bottom:0;">🏢 Empresa:</label>
        <select id="filtro-empresa-mp" class="filter-select">
          ${empresasOrdenadas.map(e => `<option value="${e}">${e === 'TODOS' ? 'Todas as empresas' : e}</option>`).join('')}
        </select>
      </div>
      <span id="mp-contagem" style="font-size:0.85rem; color:var(--text-muted);">${registros.length} registro(s)</span>
    </div>

    <div class="dashboard-grid" style="margin-bottom:1rem;">
      ${Array.from(empresas).sort().map(e => `
        <div class="kpi-card"><div class="kpi-label">🏢 ${e}</div><div class="kpi-value">${filtrarRegistros(e).length}</div></div>`).join('')}
      <div class="kpi-card"><div class="kpi-label">📋 Total</div><div class="kpi-value">${registros.length}</div></div>
    </div>

    <div class="table-responsive">
      <table class="modern-table">
        <thead><tr><th>Data/Hora</th><th>Requisitante</th><th>Unidade</th><th>Setor</th><th>Prioridade</th><th>Status</th><th>Itens</th></tr></thead>
        <tbody id="mp-tabela-body">${getLinhasTabela('TODOS')}</tbody>
      </table>
    </div>`;

  if (typeof lucide !== 'undefined') lucide.createIcons();

  const selectEmpresa = document.getElementById('filtro-empresa-mp');
  const tabelaBody = document.getElementById('mp-tabela-body');
  const contagem = document.getElementById('mp-contagem');

  selectEmpresa?.addEventListener('change', () => {
    const filtro = selectEmpresa.value;
    tabelaBody.innerHTML = getLinhasTabela(filtro);
    contagem.textContent = `${filtrarRegistros(filtro).length} registro(s)`;
  });

  document.getElementById('btn-pdf-req-mp')?.addEventListener('click', () => {
    const filtro = selectEmpresa?.value || 'TODOS';
    const registrosFiltrados = filtrarRegistros(filtro);
    const labelEmpresa = filtro === 'TODOS' ? 'Todas as empresas' : filtro;
    gerarPDFRequisicaoMP(registrosFiltrados, colunasProduto, labelEmpresa);
  });
}

function gerarPDFRequisicaoMP(registros, colunasProduto, labelEmpresa) {
  const agora = new Date().toLocaleString('pt-BR');

  function getItensDoRegistro(registro) {
    const itens = [];
    colunasProduto.forEach(produto => {
      const valor = registro[produto.trim()];
      if (valor && valor !== '0') itens.push(`${produto.trim()}: ${valor}`);
    });
    return itens;
  }

  const blocosRequisicao = registros.map((r, idx) => {
    const itens = getItensDoRegistro(r);
    return `
      <div style="background:#f9f5f0;border:1px solid #e8ddd0;border-radius:8px;padding:12px;margin-bottom:10px;">
        <div style="font-weight:700;font-size:12px;margin-bottom:6px;color:#4b433c;">
          #${idx + 1} — ${r['Nome do requisitante'] || '-'} | ${r['Unidade solicitante'] || '-'} | ${r['Setor solicitante'] || '-'} | ${formatarTimestampBR(r['Timestamp'])}
        </div>
        <div style="font-size:11px;color:#7b6f63;margin-bottom:4px;">Prioridade: ${r['Prioridade'] || '-'} | Status: ${r['STATUS'] || '-'} | Finalidade: ${r['Finalidade da requisição'] || '-'}</div>
        ${itens.length > 0
          ? `<div style="font-size:11px;color:#5a4e45;line-height:1.8;">${itens.join(' &nbsp;•&nbsp; ')}</div>`
          : `<div style="font-size:11px;color:#a09284;font-style:italic;">Nenhum item informado.</div>`}
      </div>`;
  }).join('');

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:820px;margin:0 auto;padding:28px;background:#fff;color:#4b433c;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #b79b6c;padding-bottom:14px;margin-bottom:20px;">
        <div>
          <h1 style="margin:0;font-size:20px;font-weight:800;color:#4b433c;">Mamma Mia Control</h1>
          <p style="margin:4px 0 0;font-size:13px;color:#8a8570;">🥩 Requisição de MP e Recheios</p>
          <p style="margin:2px 0 0;font-size:12px;color:#b79b6c;font-weight:600;">Empresa: ${labelEmpresa}</p>
        </div>
        <div style="text-align:right;font-size:11px;color:#a09284;">
          <div>Emitido em:</div>
          <div style="font-weight:600;color:#4b433c;">${agora}</div>
        </div>
      </div>

      <div style="background:#f9f5f0;border:1px solid #e8ddd0;border-radius:8px;padding:12px;text-align:center;margin-bottom:20px;display:inline-block;min-width:140px;">
        <div style="font-size:10px;color:#8a8570;font-weight:600;text-transform:uppercase;">Total de Requisições</div>
        <div style="font-size:24px;font-weight:800;color:#4b433c;">${registros.length}</div>
      </div>

      <h2 style="font-size:13px;font-weight:700;color:#4b433c;margin-bottom:10px;border-left:3px solid #b79b6c;padding-left:8px;">
        Detalhes por Requisição
      </h2>
      ${blocosRequisicao}

      <div style="margin-top:24px;padding-top:12px;border-top:1px solid #e8ddd0;font-size:10px;color:#a09284;text-align:center;">
        Mamma Mia Control — Gestão Inteligente de Operações • © 2026 Mamma Mia Salgados
      </div>
    </div>`;

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:900px;height:600px;border:none;';
  document.body.appendChild(iframe);
  iframe.contentDocument.open();
  iframe.contentDocument.write(html);
  iframe.contentDocument.close();
  setTimeout(() => {
    iframe.contentWindow.print();
    setTimeout(() => document.body.removeChild(iframe), 1000);
  }, 400);
}

// Detecta os campos de metadados (Timestamp, Responsável, Unidade, Setor, Status, ID) de um
// formulário de requisição pelo nome da coluna, em vez de depender de nomes fixos — assim o
// código se adapta caso a planilha mude o texto exato de algum cabeçalho. Todas as colunas que
// não forem identificadas como metadado são tratadas como itens requisitados.
function _reqDetectarCampos(cabecalho) {
  const norm = c => c.trim().toUpperCase();
  const encontrar = (...termos) => cabecalho.find(c => termos.some(t => norm(c).includes(t))) || '';
  const timestamp = encontrar('CARIMBO', 'TIMESTAMP');
  const responsavel = encontrar('RESPONS', 'REQUISITANTE', 'NOME');
  const unidade = encontrar('UNIDADE', 'EMPRESA');
  const setor = encontrar('SETOR');
  const status = cabecalho.find(c => norm(c) === 'STATUS') || encontrar('STATUS');
  // Comparação exata (não substring) para não confundir com colunas de item que também
  // contenham a palavra "requisição", como "Outra requisição (EPIs, utensílios, insumos, etc)".
  const idRequisicao = cabecalho.find(c => norm(c) === 'REQUISICOES' || norm(c) === 'REQUISIÇÕES') || '';
  const metadados = [timestamp, responsavel, unidade, setor, status, idRequisicao].filter(Boolean);
  const colunasItens = cabecalho.filter(c => !metadados.includes(c));
  return { timestamp, responsavel, unidade, setor, status, idRequisicao, colunasItens };
}

function renderTabelaRequisicoesLimpeza(campos, registros, conteudo) {
  const { timestamp, responsavel, unidade, setor, status, colunasItens } = campos;
  const unidades = new Set();
  registros.forEach(r => { const u = (r[unidade] || '').toUpperCase(); if (u) unidades.add(u); });
  const unidadesOrdenadas = ['TODOS', ...Array.from(unidades).sort()];

  function getItensDoRegistro(registro) {
    const itens = [];
    colunasItens.forEach(coluna => {
      const valor = registro[coluna];
      if (valor && valor !== '0') itens.push(`${coluna}: ${valor}`);
    });
    return itens;
  }

  function filtrarRegistros(filtro) {
    if (filtro === 'TODOS') return registros;
    return registros.filter(r => (r[unidade] || '').toUpperCase() === filtro);
  }

  function getLinhasTabela(filtro) {
    const filtrados = filtrarRegistros(filtro);
    return filtrados.map(r => {
      const itens = getItensDoRegistro(r);
      const itensTexto = itens.length > 0 ? itens.join(' • ') : '<span style="color:var(--text-muted);">Nenhum item</span>';
      return `<tr>
        <td style="font-size:0.8rem;">${formatarTimestampBR(r[timestamp])}</td>
        <td>${r[responsavel] || '-'}</td>
        <td>${r[unidade] || '-'}</td>
        <td>${r[setor] || '-'}</td>
        <td>${r[status] || '-'}</td>
        <td style="font-size:0.78rem; max-width:320px;">${itensTexto}</td>
      </tr>`;
    }).join('');
  }

  conteudo.innerHTML = `
    <div class="panel-header">
      <h2>🧹 Limpeza e EPI</h2>
      <button id="btn-pdf-req-limpeza" class="btn btn-primary" style="font-size:0.82rem;">
        <i data-lucide="file-text"></i> Gerar PDF
      </button>
    </div>

    <div style="display:flex; align-items:center; gap:1rem; margin-bottom:1rem; flex-wrap:wrap;">
      <div class="filter-group">
        <label class="form-label" style="margin-bottom:0;">🏢 Unidade:</label>
        <select id="filtro-unidade-limpeza" class="filter-select">
          ${unidadesOrdenadas.map(u => `<option value="${u}">${u === 'TODOS' ? 'Todas as unidades' : u}</option>`).join('')}
        </select>
      </div>
      <span id="limpeza-contagem" style="font-size:0.85rem; color:var(--text-muted);">${registros.length} registro(s)</span>
    </div>

    <div class="dashboard-grid" style="margin-bottom:1rem;">
      ${Array.from(unidades).sort().map(u => `
        <div class="kpi-card"><div class="kpi-label">🏢 ${u}</div><div class="kpi-value">${filtrarRegistros(u).length}</div></div>`).join('')}
      <div class="kpi-card"><div class="kpi-label">📋 Total</div><div class="kpi-value">${registros.length}</div></div>
    </div>

    <div class="table-responsive">
      <table class="modern-table">
        <thead><tr><th>Data/Hora</th><th>Responsável</th><th>Unidade</th><th>Setor</th><th>Status</th><th>Itens</th></tr></thead>
        <tbody id="limpeza-tabela-body">${getLinhasTabela('TODOS')}</tbody>
      </table>
    </div>`;

  if (typeof lucide !== 'undefined') lucide.createIcons();

  const selectUnidade = document.getElementById('filtro-unidade-limpeza');
  const tabelaBody = document.getElementById('limpeza-tabela-body');
  const contagem = document.getElementById('limpeza-contagem');

  selectUnidade?.addEventListener('change', () => {
    const filtro = selectUnidade.value;
    tabelaBody.innerHTML = getLinhasTabela(filtro);
    contagem.textContent = `${filtrarRegistros(filtro).length} registro(s)`;
  });

  document.getElementById('btn-pdf-req-limpeza')?.addEventListener('click', () => {
    const filtro = selectUnidade?.value || 'TODOS';
    const registrosFiltrados = filtrarRegistros(filtro);
    const labelUnidade = filtro === 'TODOS' ? 'Todas as unidades' : filtro;
    gerarPDFRequisicaoLimpeza(registrosFiltrados, campos, labelUnidade);
  });
}

function gerarPDFRequisicaoLimpeza(registros, campos, labelUnidade) {
  const { timestamp, responsavel, unidade, setor, status, colunasItens } = campos;
  const agora = new Date().toLocaleString('pt-BR');

  function getItensDoRegistro(registro) {
    const itens = [];
    colunasItens.forEach(coluna => {
      const valor = registro[coluna];
      if (valor && valor !== '0') itens.push(`${coluna}: ${valor}`);
    });
    return itens;
  }

  const blocosRequisicao = registros.map((r, idx) => {
    const itens = getItensDoRegistro(r);
    return `
      <div style="background:#f9f5f0;border:1px solid #e8ddd0;border-radius:8px;padding:12px;margin-bottom:10px;">
        <div style="font-weight:700;font-size:12px;margin-bottom:6px;color:#4b433c;">
          #${idx + 1} — ${r[responsavel] || '-'} | ${r[unidade] || '-'} | ${r[setor] || '-'} | ${formatarTimestampBR(r[timestamp])}
        </div>
        <div style="font-size:11px;color:#7b6f63;margin-bottom:4px;">Status: ${r[status] || '-'}</div>
        ${itens.length > 0
          ? `<div style="font-size:11px;color:#5a4e45;line-height:1.8;">${itens.join(' &nbsp;•&nbsp; ')}</div>`
          : `<div style="font-size:11px;color:#a09284;font-style:italic;">Nenhum item informado.</div>`}
      </div>`;
  }).join('');

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:820px;margin:0 auto;padding:28px;background:#fff;color:#4b433c;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #b79b6c;padding-bottom:14px;margin-bottom:20px;">
        <div>
          <h1 style="margin:0;font-size:20px;font-weight:800;color:#4b433c;">Mamma Mia Control</h1>
          <p style="margin:4px 0 0;font-size:13px;color:#8a8570;">🧹 Requisição de Limpeza e EPI</p>
          <p style="margin:2px 0 0;font-size:12px;color:#b79b6c;font-weight:600;">Unidade: ${labelUnidade}</p>
        </div>
        <div style="text-align:right;font-size:11px;color:#a09284;">
          <div>Emitido em:</div>
          <div style="font-weight:600;color:#4b433c;">${agora}</div>
        </div>
      </div>

      <div style="background:#f9f5f0;border:1px solid #e8ddd0;border-radius:8px;padding:12px;text-align:center;margin-bottom:20px;display:inline-block;min-width:140px;">
        <div style="font-size:10px;color:#8a8570;font-weight:600;text-transform:uppercase;">Total de Requisições</div>
        <div style="font-size:24px;font-weight:800;color:#4b433c;">${registros.length}</div>
      </div>

      <h2 style="font-size:13px;font-weight:700;color:#4b433c;margin-bottom:10px;border-left:3px solid #b79b6c;padding-left:8px;">
        Detalhes por Requisição
      </h2>
      ${blocosRequisicao}

      <div style="margin-top:24px;padding-top:12px;border-top:1px solid #e8ddd0;font-size:10px;color:#a09284;text-align:center;">
        Mamma Mia Control — Gestão Inteligente de Operações • © 2026 Mamma Mia Salgados
      </div>
    </div>`;

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:900px;height:600px;border:none;';
  document.body.appendChild(iframe);
  iframe.contentDocument.open();
  iframe.contentDocument.write(html);
  iframe.contentDocument.close();
  setTimeout(() => {
    iframe.contentWindow.print();
    setTimeout(() => document.body.removeChild(iframe), 1000);
  }, 400);
}

function updateAppSelectors() { console.log('updateAppSelectors executado'); }

// ================= MÓDULO PERDAS =================

// Converte o Timestamp bruto da planilha de Registro de Perdas (dd/mm/yyyy hh:mm:ss,
// locale pt-BR — confirmado na própria planilha) em objeto Date.
// Retorna null se não conseguir interpretar o valor.
function _perdasParseTimestamp(valorOriginal) {
  if (!valorOriginal || !valorOriginal.trim()) return null;
  const texto = valorOriginal.trim();
  const partes = texto.split(' ');
  const matchData = partes[0].match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!matchData) return null;
  const [, diaStr, mesStr, anoStr] = matchData;
  const [hh = '0', mm = '0', ss = '0'] = (partes[1] || '').split(':');
  const data = new Date(
    parseInt(anoStr, 10), parseInt(mesStr, 10) - 1, parseInt(diaStr, 10),
    parseInt(hh, 10) || 0, parseInt(mm, 10) || 0, parseInt(ss, 10) || 0
  );
  return isNaN(data.getTime()) ? null : data;
}

// Chave "yyyy-mm" usada para agrupar registros de Perdas por mês.
function _perdasChaveMes(data) { return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`; }

// Filtra registros de Perdas pelo período selecionado no painel.
function _perdasFiltrarPorPeriodo(registros, periodo) {
  if (periodo === 'TODOS') return registros;
  const agora = new Date();
  const chaveAtual = _perdasChaveMes(agora);
  const mesPassado = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);
  const chaveAlvo = periodo === 'MES_PASSADO' ? _perdasChaveMes(mesPassado) : chaveAtual;
  return registros.filter(r => r.data && _perdasChaveMes(r.data) === chaveAlvo);
}

function _perdasFormatarDataHora(data) {
  const p = n => String(n).padStart(2, '0');
  return `${p(data.getDate())}/${p(data.getMonth() + 1)}/${data.getFullYear()} ${p(data.getHours())}:${p(data.getMinutes())}`;
}

// Normaliza texto livre da planilha (trim + maiúsculas) para que a mesma pessoa/produto/
// motivo digitado com capitalização diferente ("alex" vs "ALEX") não vire entradas
// separadas nos rankings e na tabela.
function _perdasNormalizar(texto, fallback) {
  const limpo = (texto || '').trim().toUpperCase();
  return limpo || fallback;
}

const PERDAS_PERIODO_LABEL = { TODOS: 'Tudo', MES_ATUAL: 'Este mês', MES_PASSADO: 'Mês passado' };

function _perdasGerarPDF(registros, kpis, periodoLabel) {
  const agora = new Date().toLocaleString('pt-BR');
  const linhas = registros.map(r => `
    <tr>
      <td style="font-size:10px;white-space:nowrap;">${r.data ? _perdasFormatarDataHora(r.data) : '-'}</td>
      <td style="font-size:10px;">${r.responsavel}</td>
      <td style="font-size:10px;">${r.setor}</td>
      <td style="font-size:10px;">${r.produto}</td>
      <td style="font-size:10px;text-align:right;">${r.quantidade}</td>
      <td style="font-size:10px;">${r.motivo}</td>
    </tr>`).join('');

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:820px;margin:0 auto;padding:28px;background:#fff;color:#4b433c;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #b79b6c;padding-bottom:14px;margin-bottom:20px;">
        <div>
          <h1 style="margin:0;font-size:20px;font-weight:800;color:#4b433c;">Mamma Mia Control</h1>
          <p style="margin:4px 0 0;font-size:13px;color:#8a8570;">📉 Gestão de Perdas YUKA</p>
          <p style="margin:2px 0 0;font-size:12px;color:#b79b6c;font-weight:600;">Período: ${periodoLabel}</p>
        </div>
        <div style="text-align:right;font-size:11px;color:#a09284;">
          <div>Emitido em:</div>
          <div style="font-weight:600;color:#4b433c;">${agora}</div>
        </div>
      </div>

      <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:20px;">
        ${kpis.map(k => `
          <div style="background:#f9f5f0;border:1px solid #e8ddd0;border-radius:8px;padding:10px 14px;min-width:130px;">
            <div style="font-size:9px;color:#8a8570;font-weight:600;text-transform:uppercase;">${k.label}</div>
            <div style="font-size:18px;font-weight:800;color:#4b433c;">${k.valor}</div>
          </div>`).join('')}
      </div>

      <h2 style="font-size:13px;font-weight:700;color:#4b433c;margin-bottom:10px;border-left:3px solid #b79b6c;padding-left:8px;">
        Histórico (${registros.length} registro(s))
      </h2>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#f3ede3;">
            <th style="font-size:10px;text-align:left;padding:6px;">Data/Hora</th>
            <th style="font-size:10px;text-align:left;padding:6px;">Responsável</th>
            <th style="font-size:10px;text-align:left;padding:6px;">Setor</th>
            <th style="font-size:10px;text-align:left;padding:6px;">Produto</th>
            <th style="font-size:10px;text-align:right;padding:6px;">Qtd.</th>
            <th style="font-size:10px;text-align:left;padding:6px;">Motivo</th>
          </tr>
        </thead>
        <tbody>${linhas}</tbody>
      </table>

      <div style="margin-top:24px;padding-top:12px;border-top:1px solid #e8ddd0;font-size:10px;color:#a09284;text-align:center;">
        Mamma Mia Control — Gestão Inteligente de Operações • © 2026 Mamma Mia Salgados
      </div>
    </div>`;

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:900px;height:600px;border:none;';
  document.body.appendChild(iframe);
  iframe.contentDocument.open();
  iframe.contentDocument.write(html);
  iframe.contentDocument.close();
  setTimeout(() => {
    iframe.contentWindow.print();
    setTimeout(() => document.body.removeChild(iframe), 1000);
  }, 400);
}

async function carregarPerdas() {
  try {
    const response = await fetch(PERDAS_CSV_URL);
    const csv = await response.text();
    const linhas = parseCSVLinhas(csv);
    const conteudo = document.getElementById('perdas-conteudo');
    if (!conteudo) return;
    if (linhas.length < 2) {
      conteudo.innerHTML = `<div class="panel-header"><h2>📉 Gestão de Perdas YUKA</h2></div><p>Nenhum registro de perda encontrado.</p>`;
      return;
    }

    // Cabeçalho: localiza colunas de Timestamp, Responsável e Detalhamento pelo nome;
    // demais colunas seguem o layout fixo já utilizado pela planilha de Registro de Perdas.
    const cabecalho = linhas[0].map(c => c.trim().toUpperCase());
    const idxTimestampCab = cabecalho.findIndex(c => c.includes('CARIMBO') || c.includes('TIMESTAMP'));
    const idxRespCab = cabecalho.findIndex(c => c.includes('RESPONS') || c.includes('NOME'));
    const idxDetalheCab = cabecalho.findIndex(c => c.includes('DETALHAMENTO') || c.includes('DETALHE'));
    const idxTimestamp = idxTimestampCab >= 0 ? idxTimestampCab : 0;
    const idxResp = idxRespCab >= 0 ? idxRespCab : 1;
    const idxDetalhe = idxDetalheCab >= 0 ? idxDetalheCab : 8;

    const dados = linhas.slice(1).filter(colunas => colunas.some(c => c.trim() !== ''));

    const registros = dados.map(colunas => ({
      data: _perdasParseTimestamp(colunas[idxTimestamp]),
      responsavel: _perdasNormalizar(colunas[idxResp], '-'),
      setor: _perdasNormalizar(colunas[4], 'OUTRO'),
      produto: _perdasNormalizar(colunas[5], 'SEM PRODUTO'),
      quantidade: parseFloat((colunas[6] || '').replace(',', '.')) || 0,
      motivo: _perdasNormalizar(colunas[7], 'OUTRO'),
      detalhe: (colunas[idxDetalhe] || '').trim(),
    }));

    let periodoAtual = 'TODOS';
    let linhasVisiveis = 25;
    const PAGINA_TAMANHO = 25;

    function renderizar() {
      const registrosPeriodo = _perdasFiltrarPorPeriodo(registros, periodoAtual);

      const motivos = {}; const produtos = {}; const setores = {}; const responsaveis = {};
      let totalQuantidade = 0;
      registrosPeriodo.forEach(r => {
        motivos[r.motivo] = (motivos[r.motivo] || 0) + r.quantidade;
        produtos[r.produto] = (produtos[r.produto] || 0) + r.quantidade;
        setores[r.setor] = (setores[r.setor] || 0) + r.quantidade;
        responsaveis[r.responsavel] = (responsaveis[r.responsavel] || 0) + r.quantidade;
        totalQuantidade += r.quantidade;
      });
      const rankingMotivos = Object.entries(motivos).sort((a, b) => b[1] - a[1]);
      const rankingProdutos = Object.entries(produtos).sort((a, b) => b[1] - a[1]);
      const rankingSetores = Object.entries(setores).sort((a, b) => b[1] - a[1]);
      const rankingResponsaveis = Object.entries(responsaveis).sort((a, b) => b[1] - a[1]);
      const maiorMotivo = rankingMotivos[0]?.[0] || '-';
      const produtoMaisPerdido = rankingProdutos[0]?.[0] || '-';
      const setor = rankingSetores[0]?.[0] || '-';
      const labelsMotivos = rankingMotivos.slice(0, 10).map(item => item[0]);
      const valoresMotivos = rankingMotivos.slice(0, 10).map(item => item[1]);
      const labelsProdutos = rankingProdutos.slice(0, 10).map(item => item[0]);
      const valoresProdutos = rankingProdutos.slice(0, 10).map(item => item[1]);
      const labelsResponsaveis = rankingResponsaveis.slice(0, 10).map(item => item[0]);
      const valoresResponsaveis = rankingResponsaveis.slice(0, 10).map(item => item[1]);

      // Último registro: agrupa todas as perdas lançadas no dia mais recente dentro do
      // período selecionado (cobre tanto um único apontamento quanto vários produtos no mesmo dia).
      let ultimoRegistroHtml = '';
      const comData = registrosPeriodo.filter(r => r.data);
      if (comData.length > 0) {
        const dataMaisRecente = comData.reduce((max, r) => (r.data > max ? r.data : max), comData[0].data);
        const chaveDia = d => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        const itensDoDia = comData.filter(r => chaveDia(r.data) === chaveDia(dataMaisRecente));
        const dataFormatada = dataMaisRecente.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        const responsaveisDia = [...new Set(itensDoDia.map(r => r.responsavel).filter(r => r && r !== '-'))];
        const respTexto = responsaveisDia.join(', ') || '-';
        const itensHtml = itensDoDia.map(r => `
          <div class="ranking-item" style="align-items:flex-start;">
            <span>${r.produto}${r.detalhe ? `<br><span style="font-size:0.75rem;color:var(--text-muted);">${r.detalhe}</span>` : ''}</span>
            <span>${r.quantidade}</span>
          </div>`).join('');
        ultimoRegistroHtml = `
        <div class="panel-card" style="margin-bottom:20px;">
          <h3>🕒 Último Registro</h3>
          <p style="margin:8px 0 12px;color:var(--text-secondary);">
            <strong style="color:var(--text-primary);">${dataFormatada}</strong> — Resp.: <strong style="color:var(--text-primary);">${respTexto}</strong>
          </p>
          <div class="ranking-list">${itensHtml}</div>
        </div>`;
      }

      // Limite configurável (Configurações > Alertas > Perdas) aplicado ao período selecionado.
      const limite = getAppSettings().alertPerdasLimite || 0;
      const percentualLimite = limite > 0 ? Math.round((registrosPeriodo.length / limite) * 100) : 0;
      const corLimite = percentualLimite >= 100 ? 'var(--color-red)' : percentualLimite >= 70 ? 'var(--color-orange)' : 'var(--color-green)';

      // Tabela histórica: mais recentes primeiro; a busca de texto filtra por
      // produto, responsável, setor e motivo dentro do período já selecionado.
      function registrosFiltradosTabela() {
        const termoNorm = (document.getElementById('busca-perdas')?.value || '').trim().toUpperCase();
        return (termoNorm
          ? registrosPeriodo.filter(r => `${r.produto} ${r.responsavel} ${r.setor} ${r.motivo}`.toUpperCase().includes(termoNorm))
          : registrosPeriodo
        ).slice().sort((a, b) => (b.data?.getTime() || 0) - (a.data?.getTime() || 0));
      }

      function atualizarTabela(resetPaginacao) {
        if (resetPaginacao) linhasVisiveis = PAGINA_TAMANHO;
        const filtrados = registrosFiltradosTabela();
        const visiveis = filtrados.slice(0, linhasVisiveis);
        const tbody = document.getElementById('perdas-tabela-body');
        const rodape = document.getElementById('perdas-tabela-rodape');
        if (tbody) {
          tbody.innerHTML = visiveis.length === 0
            ? `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);">Nenhum registro encontrado.</td></tr>`
            : visiveis.map(r => `
              <tr>
                <td style="font-size:0.8rem;white-space:nowrap;">${r.data ? _perdasFormatarDataHora(r.data) : '-'}</td>
                <td>${r.responsavel}</td>
                <td>${r.setor}</td>
                <td>${r.produto}</td>
                <td style="text-align:right;">${r.quantidade}</td>
                <td>${r.motivo}</td>
                <td style="font-size:0.8rem;color:var(--text-secondary);max-width:260px;">${r.detalhe || '-'}</td>
              </tr>`).join('');
        }
        if (rodape) {
          const restantes = filtrados.length - visiveis.length;
          rodape.innerHTML = `
            <span style="font-size:0.8rem;color:var(--text-muted);">${visiveis.length} de ${filtrados.length} registro(s)</span>
            ${restantes > 0 ? `<button id="btn-carregar-mais-perdas" class="btn btn-secondary" style="font-size:0.82rem;">Carregar mais (${restantes} restante${restantes > 1 ? 's' : ''})</button>` : ''}`;
          document.getElementById('btn-carregar-mais-perdas')?.addEventListener('click', () => {
            linhasVisiveis += PAGINA_TAMANHO;
            atualizarTabela(false);
          });
        }
      }

      conteudo.innerHTML = `
        <div class="panel-header">
          <h2>📉 Gestão de Perdas YUKA</h2>
          <button id="btn-pdf-perdas" class="btn btn-primary" style="font-size:0.82rem;">
            <i data-lucide="file-text"></i> Gerar PDF
          </button>
        </div>

        <div class="filter-group" style="margin-bottom:1rem;">
          <label class="form-label" style="margin-bottom:0;">📅 Período:</label>
          <select id="filtro-periodo-perdas" class="filter-select">
            <option value="TODOS" ${periodoAtual === 'TODOS' ? 'selected' : ''}>Tudo</option>
            <option value="MES_ATUAL" ${periodoAtual === 'MES_ATUAL' ? 'selected' : ''}>Este mês</option>
            <option value="MES_PASSADO" ${periodoAtual === 'MES_PASSADO' ? 'selected' : ''}>Mês passado</option>
          </select>
        </div>

        <div class="dashboard-grid">
          <div class="kpi-card"><div class="kpi-label">📦 REGISTROS</div><div class="kpi-value">${registrosPeriodo.length}</div></div>
          <div class="kpi-card"><div class="kpi-label">🧮 TOTAL PERDIDO</div><div class="kpi-value">${totalQuantidade.toLocaleString('pt-BR')}</div><div class="kpi-subtext">kg / unidades</div></div>
          <div class="kpi-card"><div class="kpi-label">⚠️ MAIOR MOTIVO</div><div class="kpi-value">${maiorMotivo}</div></div>
          <div class="kpi-card"><div class="kpi-label">🥟 PRODUTO TOP</div><div class="kpi-value">${produtoMaisPerdido}</div></div>
          <div class="kpi-card"><div class="kpi-label">🏭 SETOR COM MAIS PERDAS</div><div class="kpi-value">${setor}</div></div>
        </div>

        ${limite > 0 ? `
        <div class="panel-card" style="margin-bottom:20px;">
          <div class="progress-label-row">
            <span>🎯 Limite de Perdas (${PERDAS_PERIODO_LABEL[periodoAtual]})</span>
            <span style="color:var(--text-muted);">${registrosPeriodo.length} / ${limite} registros (${percentualLimite}%)</span>
          </div>
          <div class="progress-track">
            <div class="progress-bar" style="width:${Math.min(100, percentualLimite)}%;background:${corLimite};"></div>
          </div>
        </div>` : ''}

        ${ultimoRegistroHtml}

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:16px;margin-bottom:20px;">
          <div class="panel-card"><h3>🚨 Perdas por Motivo</h3><div class="chart-wrapper"><canvas id="graficoMotivos"></canvas></div></div>
          <div class="panel-card"><h3>🏆 Ranking de Produtos Perdidos</h3><div class="chart-wrapper"><canvas id="graficoProdutos"></canvas></div></div>
          <div class="panel-card"><h3>👤 Perdas por Responsável</h3><div class="chart-wrapper"><canvas id="graficoResponsaveis"></canvas></div></div>
        </div>

        <div class="panel-card">
          <h3>📋 Histórico de Perdas</h3>
          <div style="margin:12px 0;">
            <input type="text" id="busca-perdas" class="form-control" placeholder="Buscar por produto, responsável, setor ou motivo..." style="max-width:420px;">
          </div>
          <div class="table-responsive">
            <table class="modern-table">
              <thead><tr><th>Data/Hora</th><th>Responsável</th><th>Setor</th><th>Produto</th><th style="text-align:right;">Qtd.</th><th>Motivo</th><th>Detalhamento</th></tr></thead>
              <tbody id="perdas-tabela-body"></tbody>
            </table>
          </div>
          <div id="perdas-tabela-rodape" style="display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-top:12px;flex-wrap:wrap;"></div>
        </div>`;

      if (typeof lucide !== 'undefined') lucide.createIcons();

      const ctxMotivos = document.getElementById('graficoMotivos');
      if (ctxMotivos) new Chart(ctxMotivos, { type: 'bar', data: { labels: labelsMotivos, datasets: [{ label: 'Perdas', data: valoresMotivos }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false } });
      const ctxProdutos = document.getElementById('graficoProdutos');
      if (ctxProdutos) new Chart(ctxProdutos, { type: 'bar', data: { labels: labelsProdutos, datasets: [{ label: 'Perdas', data: valoresProdutos }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false } });
      const ctxResponsaveis = document.getElementById('graficoResponsaveis');
      if (ctxResponsaveis) new Chart(ctxResponsaveis, { type: 'bar', data: { labels: labelsResponsaveis, datasets: [{ label: 'Perdas', data: valoresResponsaveis }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false } });

      atualizarTabela(true);

      document.getElementById('filtro-periodo-perdas')?.addEventListener('change', e => {
        periodoAtual = e.target.value;
        renderizar();
      });
      document.getElementById('busca-perdas')?.addEventListener('input', () => atualizarTabela(true));
      document.getElementById('btn-pdf-perdas')?.addEventListener('click', () => {
        const kpis = [
          { label: 'Registros', valor: registrosPeriodo.length },
          { label: 'Total Perdido', valor: totalQuantidade.toLocaleString('pt-BR') },
          { label: 'Maior Motivo', valor: maiorMotivo },
          { label: 'Produto Top', valor: produtoMaisPerdido },
          { label: 'Setor com mais perdas', valor: setor },
        ];
        _perdasGerarPDF(registrosFiltradosTabela(), kpis, PERDAS_PERIODO_LABEL[periodoAtual]);
      });
    }

    renderizar();
  } catch (erro) { console.error(erro); }
}
let canalAtual = null;
const filtrosCentral = {

  dataInicial: '',

  dataFinal: '',

  unidade: 'TODOS',

  status: 'TODOS'

};
const mensagensPorCanal = {
  "Geral Operacional": [],
  "Diretoria": [],
  "TC": [],
  "YUKA": [],
  "CD": []
};
// ================= MÓDULO CENTRAL OPERACIONAL =================

async function carregarCentralOperacional() {

try {

const conteudo = document.getElementById('central-conteudo');

if (!conteudo) return;

const response = await fetch(MP_CSV_URL);
const csv = await response.text();

const linhas = parseCSVLinhas(csv);

if (linhas.length < 2) {
  conteudo.innerHTML = `
    <div class="panel-card">
      <h3>📡 Central Operacional</h3>
      <p>Nenhuma requisição encontrada.</p>
    </div>
  `;
  return;
}

const cabecalho = linhas[0];
const registros = [];

for (let i = 1; i < linhas.length; i++) {

  const cols = linhas[i];

  if (cols.every(c => !c || !c.trim())) continue;

  const registro = {};

  cabecalho.forEach((nomeCol, idx) => {
    registro[nomeCol.trim()] = (cols[idx] || '').trim();
  });

  registros.push(registro);
}

const aguardando = registros.filter(r =>
  ['ABERTO', 'AGUARDANDO'].includes(
    (r['STATUS'] || '').toUpperCase()
  )
).length;

const separacao = registros.filter(r =>
  (r['STATUS'] || '').toUpperCase() === 'EM SEPARAÇÃO'
).length;

const concluido = registros.filter(r =>
  (r['STATUS'] || '').toUpperCase() === 'CONCLUÍDO'
).length;

const cancelado = registros.filter(r =>
  (r['STATUS'] || '').toUpperCase() === 'CANCELADO'
).length;

conteudo.innerHTML = `

  <div class="dashboard-grid">

    <div class="kpi-card">
      <div class="kpi-value">${aguardando}</div>
      <div class="kpi-label">🟡 AGUARDANDO</div>
    </div>

    <div class="kpi-card">
      <div class="kpi-value">${separacao}</div>
      <div class="kpi-label">🔵 EM SEPARAÇÃO</div>
    </div>

    <div class="kpi-card">
      <div class="kpi-value">${concluido}</div>
      <div class="kpi-label">🟢 CONCLUÍDO</div>
    </div>

    <div class="kpi-card">
      <div class="kpi-value">${cancelado}</div>
      <div class="kpi-label">🔴 CANCELADO</div>
    </div>

  </div>

  <section class="panel-card">

  <div class="panel-header">
    <h2>📦 Requisições</h2>
  </div>

  <p>
    Total de requisições:
    <strong>${registros.length}</strong>
  </p>

  <div
    style="
      display:flex;
      gap:10px;
      flex-wrap:wrap;
      margin-top:15px;
      align-items:center;
    "
  >

    <input
      type="date"
      id="filtro-data-inicial"
      value="${filtrosCentral.dataInicial}"
    >

    <input
      type="date"
      id="filtro-data-final"
      value="${filtrosCentral.dataFinal}"
    >

    <button
      class="btn btn-primary"
      id="btn-filtrar-central"
    >
      🔍 Filtrar
    </button>
<button
  class="btn btn-secondary"
  id="btn-pdf-central"
>
  📄 PDF
</button>
  </div>

</section>

  </section>

  <section class="panel-card" style="margin-top:20px;">

    <div class="panel-header">
      <h2>💬 Central Operacional</h2>
    </div>

    <div style="display:flex; gap:20px; min-height:350px;">

      <div style="
        width:220px;
        border-right:1px solid rgba(255,255,255,.1);
        padding-right:15px;
      ">

        <button class="btn btn-secondary canal-btn" data-canal="Geral Operacional">
          # Geral Operacional
        </button>

        <button class="btn btn-secondary canal-btn" data-canal="Diretoria">
          # Diretoria
        </button>

        <button class="btn btn-secondary canal-btn" data-canal="TC">
          # TC
        </button>

        <button class="btn btn-secondary canal-btn" data-canal="YUKA">
          # YUKA
        </button>

        <button class="btn btn-secondary canal-btn" data-canal="CD">
          # CD
        </button>

      </div>

      <div id="chat-conversa" style="flex:1;">

        <h3>📦 Central de Requisições</h3>

        <p style="color:var(--text-muted);">
          Selecione uma unidade para acompanhar as requisições.
        </p>

      </div>

    </div>

  </section>

`;

document.querySelectorAll('.canal-btn').forEach(btn => {

  btn.addEventListener('click', () => {

    abrirCanal(btn.dataset.canal);

  });

});
  const btnFiltro =
  document.getElementById('btn-filtrar-central');

if (btnFiltro) {

  btnFiltro.addEventListener('click', () => {

    filtrosCentral.dataInicial =
      document.getElementById('filtro-data-inicial')?.value || '';

    filtrosCentral.dataFinal =
      document.getElementById('filtro-data-final')?.value || '';

    console.log('Filtros:', filtrosCentral);

    if (canalAtual) {

      abrirCanal(canalAtual);

    }

  });

}
  const btnPdf =
  document.getElementById('btn-pdf-central');

if (btnPdf) {

  btnPdf.addEventListener('click', () => {

    gerarRelatorioCentral();

  });

}
} catch (erro) {

console.error(erro);

const conteudo = document.getElementById('central-conteudo');

if (conteudo) {
  conteudo.innerHTML = `
    <div class="panel-card">
      <h3>📡 Central Operacional</h3>
      <p>Erro ao carregar dados.</p>
    </div>
  `;
}

}

}

async function abrirCanal(canal) {

  canalAtual = canal;

  const conversa = document.getElementById('chat-conversa');

  if (!conversa) return;

  let titulo = '';

  switch(canal){

    case 'GERAL':
      titulo = '📦 Geral Operacional';
      break;

    case 'TC':
      titulo = '🏭 Requisições TC';
      break;

    case 'YUKA':
      titulo = '🥐 Requisições YUKA';
      break;

    case 'CD':
      titulo = '🚚 Requisições CD';
      break;

    default:
      titulo = `📦 ${canal}`;
  }

  conversa.innerHTML = `
    <h3>${titulo}</h3>
    <p style="color:var(--text-muted);">
      Carregando requisições...
    </p>
  `;

  await carregarRequisicoesCentral(canal);

}

async function carregarRequisicoesCentral(canal) {

  const conversa = document.getElementById('chat-conversa');

  try {

    const response = await fetch(MP_CSV_URL);

    const csv = await response.text();

    const linhas = parseCSVLinhas(csv);

    if (linhas.length < 2) {

      conversa.innerHTML = `
        <h3>📦 Requisições</h3>
        <p>Nenhuma requisição encontrada.</p>
      `;

      return;
    }

    const cabecalho = linhas[0];

    const registros = [];

    for (let i = 1; i < linhas.length; i++) {

      const cols = linhas[i];

      if (cols.every(c => !c || !c.trim())) continue;

      const registro = {};

      cabecalho.forEach((nomeCol, idx) => {

        registro[nomeCol.trim()] =
          (cols[idx] || '').trim();

      });

      registros.push(registro);

    }

    let filtradas = registros;

    if (canal !== 'GERAL') {

      filtradas = registros.filter(r =>

        (r['Unidade solicitante'] || '')
          .toUpperCase()
          .trim() === canal

      );

    }
if (
  filtrosCentral.dataInicial ||
  filtrosCentral.dataFinal
) {

  filtradas = filtradas.filter(req => {

    const dataTexto =
      req['Timestamp'];
console.log('DATA CSV:', dataTexto);
    if (!dataTexto) return false;

    const partes = dataTexto.split('/');

const dataReq = new Date(
  Number(partes[2]),
  Number(partes[1]) - 1,
  Number(partes[0])
);
console.log('DATA JS:', dataReq);
    if (
      filtrosCentral.dataInicial &&
      dataReq <
      new Date(filtrosCentral.dataInicial)
    ) {
      return false;
    }

    if (
      filtrosCentral.dataFinal
    ) {

      const dataFinal =
        new Date(filtrosCentral.dataFinal);

      dataFinal.setHours(
        23,
        59,
        59,
        999
      );

      if (dataReq > dataFinal) {
        return false;
      }

    }

    return true;

  });

}
    filtradas.sort((a,b) => {

      return (b['REQUISICOES'] || '')
        .localeCompare(a['REQUISICOES'] || '');

    });

    let html = `
      <h3>📦 ${canal}</h3>

      <p style="margin-bottom:20px;">
        Total: <strong>${filtradas.length}</strong>
      </p>
    `;

    filtradas.forEach(req => {

      const status =
        req['STATUS'] || 'AGUARDANDO';

      let cor = '#f59e0b';

      if(status === 'EM SEPARAÇÃO')
        cor = '#3b82f6';

      if(status === 'CONCLUÍDO')
        cor = '#22c55e';

      if(status === 'CANCELADO')
        cor = '#ef4444';

      html += `

        <div class="req-card">

          <div class="req-header">

            <strong>
              ${req['REQUISICOES'] || '-'}
            </strong>

          </div>

          <div>
            👤 ${req['Nome do requisitante'] || '-'}
          </div>

          <div>
            📍 ${req['Setor solicitante'] || '-'}
          </div>

          <div
            style="
              margin-top:8px;
              font-weight:700;
              color:${cor};
            "
          >
            ${status}
          </div>

<div class="req-acoes" style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap;">

  <button
    onclick="atualizarStatusCentral('${req['REQUISICOES']}', 'EM SEPARAÇÃO')"
  >
    ⚙️ EM SEPARAÇÃO
  </button>

  <button
    onclick="atualizarStatusCentral('${req['REQUISICOES']}', 'CONCLUÍDO')"
  >
    ✅ CONCLUÍDO
  </button>

  <button
    onclick="atualizarStatusCentral('${req['REQUISICOES']}', 'CANCELADO')"
  >
    ❌ CANCELAR
  </button>

</div>

        </div>

      `;

    });

    conversa.innerHTML = html;

  } catch (erro) {

    console.error(erro);

    conversa.innerHTML = `
      <h3>Erro</h3>
      <p>Não foi possível carregar as requisições.</p>
    `;

  }

}

async function atualizarStatusCentral(rq, status) {

  try {

    const url =
      'https://script.google.com/macros/s/AKfycby-80t2GWkm9ZFjgEh93mkCzUHBJpKKFXFSvqvT9Scx3SbhC94iUxG_hN55BsyNrEaEGA/exec';

    const resposta = await fetch(
      `${url}?rq=${encodeURIComponent(rq)}&status=${encodeURIComponent(status)}`
    );

    const dados = await resposta.json();

    console.log(dados);

    if (dados.sucesso) {

      alert(`✅ ${rq} atualizada para ${status}`);

      abrirCanal(canalAtual);

    } else {

      alert('❌ Não foi possível atualizar.');

    }

  } catch (erro) {

    console.error(erro);

    alert('❌ Erro ao atualizar status.');

  }

}
window.atualizarStatusCentral = atualizarStatusCentral;
async function gerarRelatorioCentral() {

  const janela = window.open('', '_blank');

  const response = await fetch(MP_CSV_URL);

  const csv = await response.text();
  const linhas = parseCSVLinhas(csv);

const cabecalho = linhas[0];

const registros = [];

for (let i = 1; i < linhas.length; i++) {

  const cols = linhas[i];

  if (cols.every(c => !c || !c.trim())) continue;

  const registro = {};

  cabecalho.forEach((nomeCol, idx) => {

    registro[nomeCol.trim()] =
      (cols[idx] || '').trim();

  });

  registros.push(registro);

}

  console.log(csv.substring(0, 300));
janela.document.write(`

<h1>Mamma Mia Control</h1>

<h2>📦 Central Operacional</h2>

<p>
Período:
${filtrosCentral.dataInicial || 'Não informado'}
até
${filtrosCentral.dataFinal || 'Não informado'}
</p>

<p>
Emitido em:
${new Date().toLocaleString('pt-BR')}
</p>

<hr>

`);
  registros.forEach(req => {

  janela.document.write(`

    <div style="
      border:1px solid #ccc;
      padding:10px;
      margin-bottom:10px;
      border-radius:8px;
    ">

      <strong>
        ${req['REQUISICOES'] || '-'}
      </strong>

      <br>

      👤 ${req['Nome do requisitante'] || '-'}

      <br>

      🏭 ${req['Unidade solicitante'] || '-'}

      <br>

      📍 ${req['Setor solicitante'] || '-'}

      <br>

      Status:
      ${req['STATUS'] || '-'}

    </div>

  `);

});
janela.document.close();

}
// ================= MÓDULO OS =================

// Converte "dd/mm/aaaa" ou "dd/mm/aaaa hh:mm" em uma chave "aaaammddhhmm" que
// ordena corretamente como texto (mais recente > mais antiga). Retorna '' se
// não reconhecer o formato, para nunca quebrar a ordenação por causa de um
// valor inesperado — nesse caso o registro cai para o fim da lista ordenada.
function _osChaveOrdenacaoData(dataBruta) {
  const m = (dataBruta || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (!m) return '';
  const [, dia, mes, ano, hh = '00', mm = '00'] = m;
  return `${ano}${mes.padStart(2, '0')}${dia.padStart(2, '0')}${hh.padStart(2, '0')}${mm.padStart(2, '0')}`;
}

async function carregarOS() {
  try {
    const response = await fetch(OS_CSV_URL);
    const csv = await response.text();
    const linhas = parseCSVLinhas(csv);
    if (linhas.length < 1) return;
    const cabecalho = linhas[0].map(col => col.trim().replace(/"/g, '').toUpperCase());

    const indiceStatus = cabecalho.findIndex(col => col === 'STATUS');
    const indicePrioridade = cabecalho.findIndex(col => col === 'PRIORIDADE');
    const indiceOS = cabecalho.findIndex(col => col === 'OS');
    // Cabeçalho real da planilha é "Setor" (confirmado direto no Apps Script da
    // OS), não "Unidade" — o código antigo procurava um nome que não existia.
    const indiceSetor = cabecalho.findIndex(col => col === 'SETOR');
    const indiceEquipamento = cabecalho.findIndex(col => col === 'EQUIPAMENTO OU LOCAL AFETADO');
    const indicePDF = cabecalho.findIndex(col => col === 'PDF_OS');
    // Coluna de data é opcional: se não existir na planilha, a tabela mantém a
    // ordem original em vez de tentar ordenar por algo que não existe.
    const indiceData = cabecalho.findIndex(col => col.includes('DATA') || col.includes('CARIMBO') || col.includes('TIMESTAMP'));

    const tableBody = document.getElementById('os-table-body');
    const filtroStatus = document.getElementById('os-filter-status')?.value || 'TODOS';
    const filtroPrioridade = document.getElementById('os-filter-prioridade')?.value || 'TODOS';

    let abertas = 0, emAndamento = 0, aguardando = 0, concluidas = 0, criticas = 0, altas = 0, medias = 0, baixas = 0;
    const registros = [];

    for (let i = 1; i < linhas.length; i++) {
      const colunas = linhas[i];
      if (!colunas || colunas.every(c => c.trim() === '')) continue;
      const status = (colunas[indiceStatus] || '').trim().replace(/"/g, '').toUpperCase();
      const prioridade = (colunas[indicePrioridade] || '').trim().replace(/"/g, '').toUpperCase();
      const os = (colunas[indiceOS] || '').replace(/"/g, '');
      const setor = (colunas[indiceSetor] || '').replace(/"/g, '');
      const equipamento = (colunas[indiceEquipamento] || '').replace(/"/g, '');
      const pdf = (colunas[indicePDF] || '').replace(/"/g, '');
      const dataBruta = indiceData >= 0 ? (colunas[indiceData] || '').replace(/"/g, '').trim() : '';

      if (status === 'ABERTO') {
        abertas++;
        if (prioridade === 'CRÍTICA' || prioridade === 'CRITICA') criticas++;
        else if (prioridade === 'ALTA') altas++;
        else if (prioridade === 'MÉDIA' || prioridade === 'MEDIA') medias++;
        else if (prioridade === 'BAIXA') baixas++;
      }
      // "Em Análise"/"Em Execução" são os status reais usados pelo Trello (ver
      // moverCard no Apps Script) — não existe "Em Andamento" na planilha, é só
      // o rótulo que o card do dashboard usa pra agrupar os dois.
      if (status === 'EM ANÁLISE' || status === 'EM ANALISE' || status === 'EM EXECUÇÃO' || status === 'EM EXECUCAO') emAndamento++;
      if (status === 'AGUARDANDO PEÇA') aguardando++;
      if (status === 'CONCLUÍDO' || status === 'CONCLUIDO') concluidas++;

      registros.push({ os, status, prioridade, setor, equipamento, pdf, chaveData: _osChaveOrdenacaoData(dataBruta) });
    }

    // Mais recentes primeiro quando há coluna de data reconhecida; senão, mantém a ordem da planilha.
    if (indiceData >= 0) registros.sort((a, b) => b.chaveData.localeCompare(a.chaveData));

    if (tableBody) {
      const visiveis = registros.filter(r =>
        (filtroStatus === 'TODOS' || r.status === filtroStatus) &&
        (filtroPrioridade === 'TODOS' || r.prioridade === filtroPrioridade)
      );
      tableBody.innerHTML = visiveis.length === 0
        ? `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);">Nenhuma OS encontrada.</td></tr>`
        : visiveis.map(r => `<tr><td>${r.os}</td><td>${r.status}</td><td>${r.prioridade}</td><td>${r.setor}</td><td>${r.equipamento}</td><td>${r.pdf ? `<a href="${r.pdf}" target="_blank">📄 Abrir</a>` : '-'}</td></tr>`).join('');
    }

    const openCard = document.getElementById('os-open-count'); if (openCard) openCard.textContent = abertas;
    const progressCard = document.getElementById('os-progress-count'); if (progressCard) progressCard.textContent = emAndamento;
    const waitingCard = document.getElementById('os-parts-count'); if (waitingCard) waitingCard.textContent = aguardando;
    const closedCard = document.getElementById('os-closed-count'); if (closedCard) closedCard.textContent = concluidas;
    const criticalCard = document.getElementById('os-critical-count'); if (criticalCard) criticalCard.textContent = criticas;
    const highCard = document.getElementById('os-high-count'); if (highCard) highCard.textContent = altas;
    const mediumCard = document.getElementById('os-medium-count'); if (mediumCard) mediumCard.textContent = medias;
    const lowCard = document.getElementById('os-low-count'); if (lowCard) lowCard.textContent = baixas;
  } catch (error) { console.error('Erro ao carregar OS:', error); }
}

// ================= MÓDULO CAMINHÃO PIPA =================

const PIPA_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQuFNjTMhQ3Z1QzmEXW6scCk4UkMTYRLBV0z6QSczCDZO4AyjaneybI1Xwj0LWBdNHiYf95TB6JbDHz/pub?gid=1113385596&single=true&output=csv';

let _pipaHistoricoCompleto = [];

function _parseCSVRobusto(texto) {
  const linhas = [];
  const rows = texto.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
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
async function carregarPipa() {
  const ultimoConteudo = document.getElementById('pipa-ultimo-conteudo');
  const historicoBody  = document.getElementById('pipa-historico-body');
  const filtroPlaca    = document.getElementById('pipa-filtro-placa');
  const countEl        = document.getElementById('pipa-historico-count');

  if (ultimoConteudo) ultimoConteudo.innerHTML = '<p style="color:var(--text-muted);">Carregando...</p>';
  if (historicoBody)  historicoBody.innerHTML  = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);">Carregando...</td></tr>';

  try {
    console.log('[PIPA] Iniciando fetch...');
    const response = await fetch(PIPA_CSV_URL, { cache: 'no-store' });
    console.log('[PIPA] Status:', response.status);
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const csv = await response.text();
    console.log('[PIPA] CSV recebido, chars:', csv.length, '| inicio:', csv.substring(0, 150));

    const linhas = _parseCSVRobusto(csv);
    console.log('[PIPA] Linhas parsed:', linhas.length, '| cab:', linhas[0]);

    if (linhas.length < 2) {
      if (ultimoConteudo) ultimoConteudo.innerHTML = '<p style="color:var(--text-muted);">Nenhum dado encontrado.</p>';
      if (historicoBody)  historicoBody.innerHTML  = '<tr><td colspan="7" style="text-align:center;">Nenhum registro.</td></tr>';
      return;
    }

    const cab = linhas[0].map(c => c.toUpperCase());

    const idxPedido    = cab.findIndex(c => c.includes('PEDIDO'));
    const idxReq       = cab.findIndex(c => c.includes('REQUISITADA') || c.includes('QTD_REQ'));
    const idxRec       = cab.findIndex(c => c.includes('RECEBIDA')    || c.includes('QTD_REC'));
    const idxPlaca     = cab.findIndex(c => c.includes('PLACA'));
    const idxRelInicio = cab.findIndex(c => c.includes('INCIO') || c.includes('INICIO') || c.includes('INÍCIO'));
    const idxRelFim    = cab.findIndex(c => c.includes('FIM'));
    const idxRecibo    = cab.findIndex(c => c.includes('RECIBO') || c.includes('Nº') || c.includes('NR') || c.includes('NUM'));

    console.log('[PIPA] Indices:', {idxPedido, idxReq, idxRec, idxPlaca, idxRelInicio, idxRelFim, idxRecibo});

    const registros = [];
    for (let i = 1; i < linhas.length; i++) {
      const cols = linhas[i];
      if (cols.every(c => c === '')) continue;
      registros.push({
        pedido:      idxPedido    >= 0 ? (cols[idxPedido]    || '-') : (cols[0] || '-'),
        requisitada: idxReq       >= 0 ? (cols[idxReq]       || '-') : (cols[1] || '-'),
        recebida:    idxRec       >= 0 ? (cols[idxRec]       || '-') : (cols[2] || '-'),
        placa:       idxPlaca     >= 0 ? (cols[idxPlaca]     || '-') : (cols[3] || '-'),
        relInicio:   idxRelInicio >= 0 ? (cols[idxRelInicio] || '-') : (cols[4] || '-'),
        relFim:      idxRelFim    >= 0 ? (cols[idxRelFim]    || '-') : (cols[5] || '-'),
        recibo:      idxRecibo    >= 0 ? (cols[idxRecibo]    || '-') : (cols[6] || '-'),
      });
    }

    console.log('[PIPA] Registros:', registros.length, '| primeiro:', registros[0]);
    _pipaHistoricoCompleto = registros;

    // --- Último abastecimento ---
    const ultimo = registros[registros.length - 1];
    if (ultimoConteudo && ultimo) {
      ultimoConteudo.innerHTML = `
        <div class="dashboard-grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:1rem;">
          <div class="kpi-card" style="text-align:center;"><div class="kpi-label">📅 Pedido</div><div class="kpi-value" style="font-size:1.1rem;">${ultimo.pedido}</div></div>
          <div class="kpi-card" style="text-align:center;"><div class="kpi-label">📦 Qtd. Requisitada</div><div class="kpi-value" style="font-size:1.1rem;">${ultimo.requisitada}</div></div>
          <div class="kpi-card" style="text-align:center;"><div class="kpi-label">✅ Qtd. Recebida</div><div class="kpi-value" style="font-size:1.1rem;color:var(--color-green);">${ultimo.recebida}</div></div>
          <div class="kpi-card" style="text-align:center;"><div class="kpi-label">🚚 Placa</div><div class="kpi-value" style="font-size:1.1rem;">${ultimo.placa}</div></div>
          <div class="kpi-card" style="text-align:center;"><div class="kpi-label">🕐 Relógio Início</div><div class="kpi-value" style="font-size:1.1rem;">${ultimo.relInicio}</div></div>
          <div class="kpi-card" style="text-align:center;"><div class="kpi-label">🕓 Relógio Fim</div><div class="kpi-value" style="font-size:1.1rem;">${ultimo.relFim}</div></div>
          <div class="kpi-card" style="text-align:center;"><div class="kpi-label">🧾 Nº Recibo</div><div class="kpi-value" style="font-size:1.1rem;">${ultimo.recibo}</div></div>
        </div>`;
    } else if (ultimoConteudo) {
      ultimoConteudo.innerHTML = '<p style="color:var(--text-muted);">Nenhum registro encontrado.</p>';
    }

    // --- Placas no select ---
    if (filtroPlaca) {
      const placas = [...new Set(registros.map(r => r.placa).filter(p => p && p !== '-'))].sort();
      const valorAtual = filtroPlaca.value;
      filtroPlaca.innerHTML = '<option value="">Todas as placas</option>';
      placas.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p; opt.textContent = p;
        if (p === valorAtual) opt.selected = true;
        filtroPlaca.appendChild(opt);
      });
    }

    _renderizarHistoricoPipa(registros, countEl, historicoBody);

    // --- Eventos (registra só uma vez) ---
    const btnFiltrar   = document.getElementById('btn-pipa-filtrar');
    const btnLimpar    = document.getElementById('btn-pipa-limpar');
    const btnAtualizar = document.getElementById('btn-atualizar-pipa');

    if (btnFiltrar && !btnFiltrar._pipaEvt) {
      btnFiltrar._pipaEvt = true;
      btnFiltrar.addEventListener('click', () => {
        const placa = document.getElementById('pipa-filtro-placa')?.value || '';
        const de    = document.getElementById('pipa-filtro-de')?.value   || '';
        const ate   = document.getElementById('pipa-filtro-ate')?.value  || '';
        let f = _pipaHistoricoCompleto;
        if (placa) f = f.filter(r => r.placa === placa);
        if (de)    f = f.filter(r => _pipaParseData(r.pedido) >= new Date(de));
        if (ate)   f = f.filter(r => _pipaParseData(r.pedido) <= new Date(ate + 'T23:59:59'));
        _renderizarHistoricoPipa(f,
          document.getElementById('pipa-historico-count'),
          document.getElementById('pipa-historico-body'));
      });
    }
    if (btnLimpar && !btnLimpar._pipaEvt) {
      btnLimpar._pipaEvt = true;
      btnLimpar.addEventListener('click', () => {
        ['pipa-filtro-placa','pipa-filtro-de','pipa-filtro-ate'].forEach(id => {
          const el = document.getElementById(id); if (el) el.value = '';
        });
        _renderizarHistoricoPipa(_pipaHistoricoCompleto,
          document.getElementById('pipa-historico-count'),
          document.getElementById('pipa-historico-body'));
      });
    }
    if (btnAtualizar && !btnAtualizar._pipaEvt) {
      btnAtualizar._pipaEvt = true;
      btnAtualizar.addEventListener('click', () => {
        ['btn-pipa-filtrar','btn-pipa-limpar','btn-atualizar-pipa'].forEach(id => {
          const el = document.getElementById(id); if (el) delete el._pipaEvt;
        });
        carregarPipa();
        showToast('Dados do Caminhão Pipa atualizados!', 'success');
      });
    }

  } catch (erro) {
    console.error('[PIPA] Erro:', erro);
    const msg = 'Erro: ' + erro.message;
    if (ultimoConteudo) ultimoConteudo.innerHTML = `<p style="color:var(--color-red);">${msg}</p>`;
    if (historicoBody)  historicoBody.innerHTML  = `<tr><td colspan="7" style="text-align:center;color:var(--color-red);">${msg}</td></tr>`;
  }
}

function _renderizarHistoricoPipa(registros, countEl, historicoBody) {
  if (countEl) countEl.textContent = registros.length + ' registro(s) encontrado(s)';
  if (!historicoBody) return;
  if (registros.length === 0) {
    historicoBody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);">Nenhum registro encontrado.</td></tr>';
    return;
  }
  historicoBody.innerHTML = registros.map(r => `
    <tr>
      <td>${r.pedido}</td>
      <td>${r.requisitada}</td>
      <td>${r.recebida}</td>
      <td><strong>${r.placa}</strong></td>
      <td>${r.relInicio}</td>
      <td>${r.relFim}</td>
      <td>${r.recibo}</td>
    </tr>`).join('');
}

function _pipaParseData(str) {
  if (!str || str === '-') return new Date(0);
  if (str.includes('/')) { const [d,m,y] = str.split('/'); return new Date(`${y}-${m}-${d}`); }
  return new Date(str);
}


// ================= MÓDULO HIGIENIZAÇÃO DE MOTORES =================

const HIGIENIZACAO_SPREADSHEET_ID = '1whesPHLd83XkPRTWwrktJRvlfKk_CkCyxj_8ioSnk6A';
const HIGIENIZACAO_GID = '1973720702';
const HIGIENIZACAO_GVIZ_URL =
  `https://docs.google.com/spreadsheets/d/${HIGIENIZACAO_SPREADSHEET_ID}/gviz/tq?tqx=out:json&gid=${HIGIENIZACAO_GID}`;

const HIGIENIZACAO_UNIDADES = ['Yuka', 'Tc', 'Cd'];

// Enquanto uma unidade não tem nenhuma resposta registrada no formulário,
// a contagem de dias parte dessa data-base (definida manualmente).
const HIGIENIZACAO_DATA_BASE = new Date(2026, 5, 1); // 01/06/2026

let _higienizacaoHistoricoCompleto = [];

function _higienizacaoAnoValido(data) {
  if (!data) return false;
  const ano = data.getFullYear();
  return ano >= 2023 && ano <= 2035;
}

// Valores de data/hora do gviz vêm como texto tipo "Date(2026,6,2)" (ano, mês
// já 0-indexado, dia) ou "Date(2026,6,2,15,20,0)" com hora — nunca ambíguo,
// então não depende de nenhuma formatação regional da planilha.
function _higienizacaoParseDataGviz(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'string') {
    const m = /^Date\((\d+),(\d+),(\d+)/.exec(v);
    if (m) {
      const ano = Number(m[1]), mes = Number(m[2]), dia = Number(m[3]);
      const data = new Date(ano, mes, dia);
      return isNaN(data.getTime()) ? null : data;
    }
  }
  return null;
}

function _higienizacaoFormatarDataBR(data) {
  if (!data) return '-';
  const dia = String(data.getDate()).padStart(2, '0');
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  return `${dia}/${mes}/${data.getFullYear()}`;
}

function _higienizacaoNormalizarUnidade(raw) {
  const u = (raw || '').toUpperCase();
  if (u.includes('YUKA')) return 'Yuka';
  if (u.includes('TC')) return 'Tc';
  if (u.includes('CD')) return 'Cd';
  return raw || '-';
}

function _higienizacaoUltimoMarco(hoje) {
  const ano = hoje.getFullYear(), mes = hoje.getMonth(), dia = hoje.getDate();
  if (dia >= 15) return new Date(ano, mes, 15);
  return new Date(ano, mes, 1);
}

function _higienizacaoCalcularStatus(registrosUnidade) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const ordenados = registrosUnidade
    .filter(r => r.data)
    .sort((a, b) => b.data.getTime() - a.data.getTime());

  let ultimo = ordenados[0] || null;
  let semRegistro = false;

  if (!ultimo) {
    // Nenhuma resposta ainda no formulário: conta a partir da data-base
    ultimo = { data: HIGIENIZACAO_DATA_BASE, responsavel: '-', dataStr: '01/06/2026' };
    semRegistro = true;
  }

  const marco = _higienizacaoUltimoMarco(hoje);
  const diasDesde = Math.floor((hoje.getTime() - ultimo.data.getTime()) / (1000 * 60 * 60 * 24));
  const atrasado = ultimo.data.getTime() < marco.getTime();

  return { ultimo, diasDesde, atrasado, semRegistro };
}

async function carregarHigienizacao() {
  const statusConteudo = document.getElementById('higienizacao-status-conteudo');
  const historicoBody  = document.getElementById('higienizacao-historico-body');
  const filtroUnidade  = document.getElementById('higienizacao-filtro-unidade');
  const countEl        = document.getElementById('higienizacao-historico-count');

  if (statusConteudo) statusConteudo.innerHTML = '<p style="color:var(--text-muted);">Carregando...</p>';
  if (historicoBody)  historicoBody.innerHTML  = '<tr><td colspan="3" style="text-align:center;color:var(--text-muted);">Carregando...</td></tr>';

  try {
    console.log('[HIGIENIZACAO] Iniciando fetch (gviz)...');
    const response = await fetch(HIGIENIZACAO_GVIZ_URL, { cache: 'no-store' });
    console.log('[HIGIENIZACAO] Status:', response.status);
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const texto = await response.text();

    const match = /setResponse\(([\s\S]*)\);?\s*$/.exec(texto.trim());
    if (!match) throw new Error('Resposta do Google em formato inesperado');
    const payload = JSON.parse(match[1]);

    if (payload.status === 'error') {
      throw new Error((payload.errors && payload.errors[0] && payload.errors[0].detailed_message) || 'Erro ao ler a planilha');
    }

    const colunas = (payload.table.cols || []).map(c => (c.label || '').toUpperCase());
    const linhasDados = payload.table.rows || [];
    console.log('[HIGIENIZACAO] Linhas parsed:', linhasDados.length, '| colunas:', colunas);

    if (linhasDados.length === 0) {
      if (statusConteudo) statusConteudo.innerHTML = '<p style="color:var(--text-muted);">Nenhum dado encontrado.</p>';
      if (historicoBody)  historicoBody.innerHTML  = '<tr><td colspan="3" style="text-align:center;">Nenhum registro.</td></tr>';
      return;
    }

    const idxTimestamp = colunas.findIndex(c => c.includes('TIMESTAMP') || c.includes('CARIMBO'));
    const idxData       = colunas.findIndex(c => c.includes('HIGIENIZ'));
    const idxResp        = colunas.findIndex(c => c.includes('RESPONS'));
    const idxUnidade      = colunas.findIndex(c => c.includes('UNIDADE'));

    console.log('[HIGIENIZACAO] Indices:', { idxTimestamp, idxData, idxResp, idxUnidade });

    const valorCelula = (linha, idx) => {
      if (idx < 0 || !linha.c || !linha.c[idx]) return null;
      return linha.c[idx].v;
    };

    const registros = [];
    for (const linha of linhasDados) {
      const dataPrincipal = _higienizacaoParseDataGviz(valorCelula(linha, idxData));
      const dataTimestamp = _higienizacaoParseDataGviz(valorCelula(linha, idxTimestamp));

      let data = _higienizacaoAnoValido(dataPrincipal) ? dataPrincipal : null;
      if (!data && _higienizacaoAnoValido(dataTimestamp)) {
        data = dataTimestamp;
      }

      const unidadeBruta = valorCelula(linha, idxUnidade);
      const unidadeNormalizada = _higienizacaoNormalizarUnidade(unidadeBruta);
      if (!HIGIENIZACAO_UNIDADES.includes(unidadeNormalizada)) {
        console.warn('[HIGIENIZACAO] Unidade não reconhecida:', unidadeBruta);
      }

      const respBruto = valorCelula(linha, idxResp);

      registros.push({
        dataStr:    _higienizacaoFormatarDataBR(data),
        data:       data,
        responsavel: respBruto || '-',
        unidade:    unidadeNormalizada,
      });
    }

    console.log('[HIGIENIZACAO] Registros:', registros.length, '| primeiro:', registros[0]);
    _higienizacaoHistoricoCompleto = registros;

    // --- Cards de status por unidade ---
    if (statusConteudo) {
      statusConteudo.innerHTML = `
        <div class="dashboard-grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1rem;">
          ${HIGIENIZACAO_UNIDADES.map(unidade => {
            const regsUnidade = registros.filter(r => r.unidade === unidade);
            const { ultimo, diasDesde, atrasado, semRegistro } = _higienizacaoCalcularStatus(regsUnidade);
            const corStatus = atrasado ? 'var(--color-red)' : 'var(--color-green)';
            const textoStatus = atrasado ? '🔴 Atrasado' : '🟢 Em dia';
            const dataFormatada = ultimo.data.toLocaleDateString('pt-BR');
            const diasTexto = `${diasDesde} dia(s) atrás`;
            const rotuloData = semRegistro ? '📅 Sem registro — contando desde' : '📅 Última';
            return `
              <div class="kpi-card" style="text-align:left;">
                <div class="kpi-label" style="font-size:1rem;font-weight:600;">${unidade}</div>
                <div style="margin:0.5rem 0;font-size:0.9rem;color:${corStatus};font-weight:600;">${textoStatus}</div>
                <div style="font-size:0.85rem;color:var(--text-muted);">${rotuloData}: ${dataFormatada}</div>
                <div style="font-size:0.85rem;color:var(--text-muted);">⏱️ ${diasTexto}</div>
                <div style="font-size:0.85rem;color:var(--text-muted);">👤 ${semRegistro ? '-' : ultimo.responsavel}</div>
              </div>`;
          }).join('')}
        </div>`;
    }

    // --- Unidades no select ---
    if (filtroUnidade) {
      const valorAtual = filtroUnidade.value;
      filtroUnidade.innerHTML = '<option value="">Todas as unidades</option>';
      HIGIENIZACAO_UNIDADES.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u; opt.textContent = u;
        if (u === valorAtual) opt.selected = true;
        filtroUnidade.appendChild(opt);
      });
    }

    _renderizarHistoricoHigienizacao(
      [...registros].sort((a, b) => (b.data?.getTime() || 0) - (a.data?.getTime() || 0)),
      countEl, historicoBody
    );

    // --- Eventos (registra só uma vez) ---
    const btnFiltrar   = document.getElementById('btn-higienizacao-filtrar');
    const btnLimpar    = document.getElementById('btn-higienizacao-limpar');
    const btnAtualizar = document.getElementById('btn-atualizar-higienizacao');

    if (btnFiltrar && !btnFiltrar._higEvt) {
      btnFiltrar._higEvt = true;
      btnFiltrar.addEventListener('click', () => {
        const unidade = document.getElementById('higienizacao-filtro-unidade')?.value || '';
        const de      = document.getElementById('higienizacao-filtro-de')?.value      || '';
        const ate     = document.getElementById('higienizacao-filtro-ate')?.value     || '';
        let f = _higienizacaoHistoricoCompleto;
        if (unidade) f = f.filter(r => r.unidade === unidade);
        if (de)      f = f.filter(r => r.data && r.data >= new Date(de));
        if (ate)     f = f.filter(r => r.data && r.data <= new Date(ate + 'T23:59:59'));
        _renderizarHistoricoHigienizacao(
          [...f].sort((a, b) => (b.data?.getTime() || 0) - (a.data?.getTime() || 0)),
          document.getElementById('higienizacao-historico-count'),
          document.getElementById('higienizacao-historico-body'));
      });
    }
    if (btnLimpar && !btnLimpar._higEvt) {
      btnLimpar._higEvt = true;
      btnLimpar.addEventListener('click', () => {
        ['higienizacao-filtro-unidade', 'higienizacao-filtro-de', 'higienizacao-filtro-ate'].forEach(id => {
          const el = document.getElementById(id); if (el) el.value = '';
        });
        _renderizarHistoricoHigienizacao(
          [..._higienizacaoHistoricoCompleto].sort((a, b) => (b.data?.getTime() || 0) - (a.data?.getTime() || 0)),
          document.getElementById('higienizacao-historico-count'),
          document.getElementById('higienizacao-historico-body'));
      });
    }
    if (btnAtualizar && !btnAtualizar._higEvt) {
      btnAtualizar._higEvt = true;
      btnAtualizar.addEventListener('click', () => {
        ['btn-higienizacao-filtrar', 'btn-higienizacao-limpar', 'btn-atualizar-higienizacao'].forEach(id => {
          const el = document.getElementById(id); if (el) delete el._higEvt;
        });
        carregarHigienizacao();
        showToast('Dados de Higienização atualizados!', 'success');
      });
    }

  } catch (erro) {
    console.error('[HIGIENIZACAO] Erro:', erro);
    const msg = 'Erro: ' + erro.message;
    if (statusConteudo) statusConteudo.innerHTML = `<p style="color:var(--color-red);">${msg}</p>`;
    if (historicoBody)  historicoBody.innerHTML  = `<tr><td colspan="3" style="text-align:center;color:var(--color-red);">${msg}</td></tr>`;
  }
}

function _renderizarHistoricoHigienizacao(registros, countEl, historicoBody) {
  if (countEl) countEl.textContent = registros.length + ' registro(s) encontrado(s)';
  if (!historicoBody) return;
  if (registros.length === 0) {
    historicoBody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--text-muted);">Nenhum registro encontrado.</td></tr>';
    return;
  }
  historicoBody.innerHTML = registros.map(r => `
    <tr>
      <td>${r.data ? r.data.toLocaleDateString('pt-BR') : r.dataStr}</td>
      <td>${r.responsavel}</td>
      <td><strong>${r.unidade}</strong></td>
    </tr>`).join('');
}


// ================= MÓDULO REFEIÇÕES =================
// Lê a aba REFEICOES do módulo Refeitório (repo separado refeitorio-mamma-mia,
// planilha "CONTROLE DE REFEICOES"), publicada como CSV. Mostra, pra data
// escolhida, o total de almoços registrados e a quebra por horário (Almoço 1,
// 2, 3...) — lida dinamicamente dos próprios dados, sem fixar quantos
// horários existem. Café não entra na contagem (não é usado na prática).

async function carregarRefeicoes() {
  const conteudo = document.getElementById('refeicoes-conteudo');
  const inputData = document.getElementById('refeicoes-filtro-data');
  if (!conteudo || !inputData) return;

  conteudo.innerHTML = '<p style="color:var(--text-muted);">Carregando...</p>';

  try {
    const [respostaRefeicoes, respostaAusencias] = await Promise.all([
      fetch(REFEICOES_CSV_URL, { cache: 'no-store' }),
      fetch(AUSENCIAS_CSV_URL, { cache: 'no-store' }),
    ]);
    if (!respostaRefeicoes.ok) throw new Error('HTTP ' + respostaRefeicoes.status);
    if (!respostaAusencias.ok) throw new Error('HTTP ' + respostaAusencias.status);

    const linhasRefeicoes = parseCSVLinhas(await respostaRefeicoes.text());
    const linhasAusencias = parseCSVLinhas(await respostaAusencias.text());

    // Produção busca à parte, com seu próprio try/catch: o gid ainda não
    // está configurado (ver TODO em PRODUCAO_CSV_URL), então uma falha aqui
    // não pode derrubar Refeições/Ausências, que já funcionam.
    let linhasProducao = [];
    try {
      const respostaProducao = await fetch(PRODUCAO_CSV_URL, { cache: 'no-store' });
      if (respostaProducao.ok) linhasProducao = parseCSVLinhas(await respostaProducao.text());
    } catch (erroProducao) {
      console.warn('[REFEICOES] Produção não carregada (gid ainda não configurado?)', erroProducao);
    }

    let registros = [];
    if (linhasRefeicoes.length >= 2) {
      const cabecalho = linhasRefeicoes[0].map(c => c.trim().toUpperCase());
      const idxData = cabecalho.findIndex(c => c === 'DATA');
      const idxRefeicao = cabecalho.findIndex(c => c.includes('REFEICAO') || c.includes('REFEIÇÃO'));

      // Conta quem tem "ALMOÇO" no nome da refeição (registro antigo, feito
      // pelo Totem) OU refeição em branco (registro novo, feito pela tela de
      // Lista de Presença — não distingue Almoço 1/2/3/4, só "comeu nesse
      // dia"). Café continua de fora, não é usado na prática.
      registros = linhasRefeicoes.slice(1)
        .filter(cols => cols.some(c => c.trim() !== ''))
        .map(cols => ({
          data: (cols[idxData] || '').trim(),
          refeicao: (cols[idxRefeicao] || '').trim(),
        }))
        .filter(r => {
          const nome = r.refeicao.toUpperCase();
          return nome === '' || nome.includes('ALMOÇO') || nome.includes('ALMOCO');
        });
    }

    let ausencias = [];
    if (linhasAusencias.length >= 2) {
      const cabecalhoAus = linhasAusencias[0].map(c => c.trim().toUpperCase());
      const idxNome = cabecalhoAus.findIndex(c => c === 'NOME');
      const idxTipo = cabecalhoAus.findIndex(c => c === 'TIPO');
      const idxInicio = cabecalhoAus.findIndex(c => c.includes('INICIO') || c.includes('INÍCIO'));
      const idxFim = cabecalhoAus.findIndex(c => c.includes('FIM'));

      ausencias = linhasAusencias.slice(1)
        .filter(cols => cols.some(c => c.trim() !== ''))
        .map(cols => ({
          nome: (cols[idxNome] || '').trim(),
          tipo: (cols[idxTipo] || '').trim(),
          dataInicio: (cols[idxInicio] || '').trim(),
          dataFim: (cols[idxFim] || '').trim(),
        }))
        .filter(a => a.nome);

      // Mais recente primeiro — mais útil pra conferir os últimos lançamentos.
      ausencias.sort((a, b) => converterDataBRParaOrdenacao(b.dataInicio) - converterDataBRParaOrdenacao(a.dataInicio));
    }

    let producao = [];
    if (linhasProducao.length >= 2) {
      const cabecalhoProd = linhasProducao[0].map(c => c.trim().toUpperCase());
      const idxDataProd = cabecalhoProd.findIndex(c => c === 'DATA');
      const idxItem = cabecalhoProd.findIndex(c => c === 'ITEM');
      const idxKgProduzido = cabecalhoProd.findIndex(c => c.includes('KG_PRODUZIDO') || c.includes('KGPRODUZIDO'));
      const idxKgSobra = cabecalhoProd.findIndex(c => c.includes('KG_SOBRA') || c.includes('KGSOBRA'));
      // Colunas opcionais — só existem depois que o usuário adicionar KG_CRU/
      // RENDIMENTO_REAL/PERDA_KG em PRODUCAO (ver spec da Fase 2). idx = -1
      // até lá, e os valores ficam 0/null sem quebrar a tabela.
      const idxKgCru = cabecalhoProd.findIndex(c => c.includes('KG_CRU') || c.includes('KGCRU'));
      const idxPerdaKg = cabecalhoProd.findIndex(c => c.includes('PERDA_KG') || c.includes('PERDAKG'));

      producao = linhasProducao.slice(1)
        .filter(cols => cols.some(c => c.trim() !== ''))
        .map(cols => ({
          data: (cols[idxDataProd] || '').trim(),
          item: (cols[idxItem] || '').trim(),
          kgProduzido: Number((cols[idxKgProduzido] || '0').replace(',', '.')) || 0,
          kgSobra: Number((cols[idxKgSobra] || '0').replace(',', '.')) || 0,
          kgCru: idxKgCru === -1 ? 0 : Number((cols[idxKgCru] || '0').replace(',', '.')) || 0,
          perdaKg: idxPerdaKg === -1 || !cols[idxPerdaKg] ? null : Number(cols[idxPerdaKg].replace(',', '.')),
        }))
        .filter(p => p.item);
    }

    function converterDataBRParaOrdenacao(dataBR) {
      const partes = (dataBR || '').split('/');
      if (partes.length !== 3) return 0;
      return new Date(Number(partes[2]), Number(partes[1]) - 1, Number(partes[0])).getTime();
    }

    function dataInputParaBR(valorIso) {
      const [ano, mes, dia] = valorIso.split('-');
      return `${dia}/${mes}/${ano}`;
    }

    function linhaTabelaAusencia(a) {
      const periodo = a.tipo === 'Férias' && a.dataFim && a.dataFim !== a.dataInicio
        ? `${a.dataInicio} até ${a.dataFim}`
        : a.dataInicio;
      return `<tr><td>${a.nome}</td><td>${a.tipo}</td><td>${periodo}</td></tr>`;
    }

    function renderizar() {
      if (!inputData.value) {
        const hoje = new Date();
        inputData.value = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
      }
      const dataSelecionadaBR = dataInputParaBR(inputData.value);
      const doDia = registros.filter(r => r.data === dataSelecionadaBR);

      const porHorario = {};
      doDia.forEach(r => { porHorario[r.refeicao] = (porHorario[r.refeicao] || 0) + 1; });
      const horarios = Object.keys(porHorario).sort();

      const cardsHorarios = horarios.length
        ? horarios.map(h => `<div class="kpi-card"><div class="kpi-label">🍽️ ${h}</div><div class="kpi-value">${porHorario[h]}</div></div>`).join('')
        : '';

      const linhasAusenciasHtml = ausencias.length
        ? ausencias.map(linhaTabelaAusencia).join('')
        : '<tr><td colspan="3" style="color:var(--text-muted);">Nenhuma ausência lançada.</td></tr>';

      // Soma produzido/sobra/cru/perda por categoria do dia selecionado —
      // pode haver mais de um envio da cozinheira no mesmo dia pra mesma
      // categoria. Perda só soma quando pelo menos um envio trouxe o valor
      // calculado (coluna PERDA_KG ainda não existe pra quem não atualizou
      // a planilha — nesse caso fica "-", não 0, pra não parecer "sem perda").
      const producaoDoDia = producao.filter(p => p.data === dataSelecionadaBR);
      const porCategoria = {};
      producaoDoDia.forEach(p => {
        if (!porCategoria[p.item]) porCategoria[p.item] = { produzido: 0, sobra: 0, cru: 0, perda: 0, temPerda: false };
        porCategoria[p.item].produzido += p.kgProduzido;
        porCategoria[p.item].sobra += p.kgSobra;
        porCategoria[p.item].cru += p.kgCru;
        if (p.perdaKg !== null) {
          porCategoria[p.item].perda += p.perdaKg;
          porCategoria[p.item].temPerda = true;
        }
      });
      const categorias = Object.keys(porCategoria).sort();
      const linhasProducaoHtml = categorias.length
        ? categorias.map(c => {
            const d = porCategoria[c];
            const cru = d.cru > 0 ? `${d.cru.toFixed(1)} kg` : '-';
            const rendimento = d.cru > 0 ? `${((d.produzido / d.cru) * 100).toFixed(0)}%` : '-';
            const perda = d.temPerda ? `${d.perda.toFixed(2)} kg` : '-';
            return `<tr><td>${c}</td><td>${cru}</td><td>${d.produzido.toFixed(1)} kg</td><td>${d.sobra.toFixed(1)} kg</td><td>${rendimento}</td><td>${perda}</td></tr>`;
          }).join('')
        : '<tr><td colspan="6" style="color:var(--text-muted);">Nenhuma produção registrada nesse dia.</td></tr>';

      conteudo.innerHTML = `
        <div class="dashboard-grid" style="margin-bottom:1rem;">
          <div class="kpi-card"><div class="kpi-label">👥 TOTAL DO DIA</div><div class="kpi-value">${doDia.length}</div></div>
        </div>
        ${horarios.length
          ? `<div class="dashboard-grid">${cardsHorarios}</div>`
          : (doDia.length === 0 ? '<p style="color:var(--text-muted);">Nenhum almoço registrado nesse dia.</p>' : '')}

        <div class="panel-header" style="margin-top:1.8rem;"><h3>🍲 Produção do dia</h3></div>
        <div class="table-responsive">
          <table class="modern-table">
            <thead><tr><th>Categoria</th><th>Cru</th><th>Produzido</th><th>Sobra</th><th>Rendimento</th><th>Perda</th></tr></thead>
            <tbody>${linhasProducaoHtml}</tbody>
          </table>
        </div>

        <div class="panel-header" style="margin-top:1.8rem;"><h3>📋 Ausências (faltas e férias)</h3></div>
        <div class="table-responsive">
          <table class="modern-table">
            <thead><tr><th>Nome</th><th>Tipo</th><th>Data</th></tr></thead>
            <tbody>${linhasAusenciasHtml}</tbody>
          </table>
        </div>
      `;
    }

    if (!inputData._refEvt) {
      inputData._refEvt = true;
      inputData.addEventListener('change', renderizar);
    }

    renderizar();
  } catch (erro) {
    console.error('[REFEICOES]', erro);
    conteudo.innerHTML = '<p style="color:var(--text-muted);">Não foi possível carregar os dados de refeições.</p>';
  }
}

// ================= MÓDULO INSUMOS CRÍTICOS =================

async function carregarInsumos() {
  const conteudo = document.getElementById('insumos-conteudo');
  if (conteudo) conteudo.innerHTML = '<p style="color:var(--text-muted);">Carregando...</p>';

  try {
    console.log('[INSUMOS] Iniciando fetch (CSV)...');
    const response = await fetch(INSUMOS_CSV_URL, { cache: 'no-store' });
    console.log('[INSUMOS] Status:', response.status);
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const csv = await response.text();

    const linhas = parseCSVLinhas(csv);
    if (linhas.length < 2) {
      if (conteudo) conteudo.innerHTML = '<p style="color:var(--text-muted);">Nenhum insumo cadastrado.</p>';
      return;
    }

    const cabecalho = linhas[0].map(h => h.trim().toUpperCase());
    const idxItem = cabecalho.findIndex(c => c.includes('ITEM'));
    const idxQtd  = cabecalho.findIndex(c => c.includes('QUANTIDADEATUAL'));
    const idxMin  = cabecalho.findIndex(c => c.includes('ALERTAMINIMO'));
    const idxUnid = cabecalho.findIndex(c => c.includes('UNIDADEMEDIDA'));
    const idxData = cabecalho.findIndex(c => c.includes('ULTIMAATUALIZACAO'));
    const idxPor  = cabecalho.findIndex(c => c.includes('ATUALIZADOPOR'));

    const itens = [];
    for (let i = 1; i < linhas.length; i++) {
      const cols = linhas[i];
      if (cols.every(c => !c || !c.trim())) continue;
      const item = (cols[idxItem] || '').trim();
      if (!item) continue;
      itens.push({
        item,
        quantidadeAtual: Number((cols[idxQtd] || '0').trim().replace(',', '.')) || 0,
        alertaMinimo: Number((cols[idxMin] || '0').trim().replace(',', '.')) || 0,
        unidadeMedida: (cols[idxUnid] || '').trim() || '-',
        ultimaAtualizacao: (cols[idxData] || '').trim() || '-',
        atualizadoPor: (cols[idxPor] || '').trim() || '-'
      });
    }

    console.log('[INSUMOS] Itens parsed:', itens.length);
    _renderizarInsumos(itens, conteudo);

    const btnAtualizar = document.getElementById('btn-atualizar-insumos');
    if (btnAtualizar && !btnAtualizar._insEvt) {
      btnAtualizar._insEvt = true;
      btnAtualizar.addEventListener('click', () => {
        carregarInsumos();
        showToast('Dados de Insumos Críticos atualizados!', 'success');
      });
    }

  } catch (erro) {
    console.error('[INSUMOS] Erro:', erro);
    if (conteudo) conteudo.innerHTML = `<p style="color:var(--color-red);">Erro ao carregar: ${erro.message}</p>`;
  }
}

function _renderizarInsumos(itens, conteudo) {
  if (!conteudo) return;
  if (itens.length === 0) {
    conteudo.innerHTML = '<p style="color:var(--text-muted);">Nenhum insumo cadastrado.</p>';
    return;
  }

  conteudo.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1rem;">
      ${itens.map((it, idx) => {
        const critico = it.quantidadeAtual <= it.alertaMinimo;
        const cor = critico ? 'var(--color-red)' : 'var(--color-green)';
        return `
        <div class="kpi-card" style="border-left:3px solid ${cor};">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.5rem;">
            <strong style="font-size:0.95rem;">${it.item}</strong>
            ${critico ? '<span style="font-size:0.7rem;background:rgba(192,122,108,0.15);color:var(--color-red);padding:0.15rem 0.5rem;border-radius:999px;white-space:nowrap;">ALERTA</span>' : ''}
          </div>
          <div style="margin-top:0.5rem;font-size:1.6rem;font-weight:600;color:${cor};">
            ${it.quantidadeAtual} <span style="font-size:0.85rem;color:var(--text-muted);font-weight:500;">${it.unidadeMedida}</span>
          </div>
          <div class="kpi-subtext">Mínimo: ${it.alertaMinimo} ${it.unidadeMedida}</div>
          <div class="kpi-subtext">Atualizado: ${it.ultimaAtualizacao} — ${it.atualizadoPor}</div>
          <div style="display:flex;gap:0.4rem;margin-top:0.75rem;">
            <input type="number" id="insumo-input-${idx}" value="${it.quantidadeAtual}" min="0" step="1" style="flex:1;padding:0.35rem 0.5rem;font-size:0.85rem;border-radius:var(--border-radius-sm);border:1px solid var(--card-border);background:rgba(255,255,255,0.6);">
            <button class="btn btn-sm btn-secondary" data-insumo-item="${it.item}" data-insumo-idx="${idx}">Salvar</button>
          </div>
        </div>`;
      }).join('')}
    </div>`;

  conteudo.querySelectorAll('[data-insumo-item]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = btn.getAttribute('data-insumo-idx');
      const item = btn.getAttribute('data-insumo-item');
      const input = document.getElementById(`insumo-input-${idx}`);
      const novaQuantidade = Number(input.value);
      if (isNaN(novaQuantidade) || novaQuantidade < 0) { showToast('Quantidade inválida.', 'error'); return; }
      _salvarQuantidadeInsumo(item, novaQuantidade, btn);
    });
  });
}

async function _salvarQuantidadeInsumo(item, novaQuantidade, btn) {
  const textoOriginal = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Salvando...';
  try {
    const resposta = await fetch(INSUMOS_EXEC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ item, novaQuantidade, atualizadoPor: 'Thalita Campos' })
    });
    const resultado = await resposta.json();
    if (!resultado.ok) throw new Error(resultado.erro || 'Erro desconhecido');
    showToast(`${item} atualizado para ${novaQuantidade}!`, 'success');
    carregarInsumos();
  } catch (erro) {
    console.error('[INSUMOS] Erro ao salvar:', erro);
    showToast('Erro ao salvar: ' + erro.message, 'error');
    btn.disabled = false;
    btn.textContent = textoOriginal;
  }
}


// ================= TOAST =================

function showToast(message, type = 'info') {
  const toast = document.createElement('div'); toast.className = `toast ${type}`;
  let icon = 'info';
  if (type === 'success') icon = 'check-circle';
  if (type === 'error') icon = 'x-circle';
  if (type === 'warning') icon = 'alert-circle';
  toast.innerHTML = `<i data-lucide="${icon}"></i><span>${message}</span>`;
  DOM.toastContainer.appendChild(toast);
  if (typeof lucide !== 'undefined') lucide.createIcons();
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s forwards reverse ease-out';
    toast.addEventListener('animationend', () => { toast.remove(); });
  }, 4500);
}
