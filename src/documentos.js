/**
 * Barra DOCUMENTOS — leitura da aba DOCUMENTOS (planilha CONSUMO_AGUA_YUKA).
 *
 * Fonte da verdade: Painel Qualidade → 📄 Documentos (Apps Script), que grava
 * na aba DOCUMENTOS (gid 1657679401). Aqui só lemos o CSV publicado, no mesmo
 * padrão de VALOR CONTAS (mesmo documento publicado 2PACX-…).
 *
 * Cabeçalho: ID | UNIDADE | DOCUMENTO | VENCIMENTO | STATUS | OBS | ATUALIZADO_EM
 *  - VENCIMENTO: texto yyyy-MM-dd (aceita também dd/mm/aaaa digitado à mão)
 *  - STATUS: '' | 'ISENTO' | 'SEM_ENTRADA'
 *
 * Datas: padrão Brasília. "Hoje" e a diferença em dias são calculados no fuso
 * America/Sao_Paulo; tudo que aparece na tela é dd/mm/aaaa.
 */

export const DOCUMENTOS_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQuFNjTMhQ3Z1QzmEXW6scCk4UkMTYRLBV0z6QSczCDZO4AyjaneybI1Xwj0LWBdNHiYf95TB6JbDHz/pub?gid=1657679401&single=true&output=csv';

export const DOCUMENTOS_CACHE_KEY = 'mamma_mia_documentos_cache_v1';
export const FUSO_BRASILIA = 'America/Sao_Paulo';
export const DICA_DATA_LOCAL = 'data só neste navegador — lance no Painel Qualidade';

// Os 7 documentos que existiam antes (chaves de settings.documentosVencimento).
// Usados só no fallback, quando a planilha nunca respondeu neste navegador.
export const DOCUMENTOS_LEGADOS = [
  { id: 'tcVigilancia', unidade: 'TC', documento: 'VIGILÂNCIA', label: 'TC - Vigilância' },
  { id: 'tcAvcb', unidade: 'TC', documento: 'AVCB', label: 'TC - AVCB' },
  { id: 'yukaVigilancia', unidade: 'YUKA', documento: 'VIGILÂNCIA', label: 'YUKA - Vigilância' },
  { id: 'yukaAvcb', unidade: 'YUKA', documento: 'AVCB', label: 'YUKA - AVCB' },
  // CD é isento de alvará da vigilância sanitária.
  { id: 'cdVigilancia', unidade: 'CD', documento: 'VIGILÂNCIA', label: 'CD - Vigilância', isento: true },
  { id: 'cdAvcb', unidade: 'CD', documento: 'AVCB', label: 'CD - AVCB' },
  { id: 'cdVre', unidade: 'CD', documento: 'VRE (CLI)', label: 'CD - VRE (CLI)' }
];

function chaveCabecalho(texto) {
  return String(texto || '')
    .replace(/^\uFEFF/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[\s_]+/g, '');
}

// CSV com aspas (inclusive "" escapado e vírgula/quebra de linha dentro do campo) e BOM.
export function parseCsvDocumentos(texto) {
  const s = String(texto || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const linhas = [];
  let linha = [];
  let campo = '';
  let dentroAspas = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (dentroAspas) {
      if (ch === '"' && s[i + 1] === '"') { campo += '"'; i++; }
      else if (ch === '"') { dentroAspas = false; }
      else { campo += ch; }
    } else if (ch === '"') {
      dentroAspas = true;
    } else if (ch === ',') {
      linha.push(campo.trim()); campo = '';
    } else if (ch === '\n') {
      linha.push(campo.trim()); campo = '';
      if (linha.some(c => c !== '')) linhas.push(linha);
      linha = [];
    } else {
      campo += ch;
    }
  }
  linha.push(campo.trim());
  if (linha.some(c => c !== '')) linhas.push(linha);
  return linhas;
}

function dataValida(ano, mes, dia) {
  if (!(ano >= 1900 && ano <= 2999 && mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31)) return false;
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  return d.getUTCFullYear() === ano && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
}

const dois = n => String(n).padStart(2, '0');

// "2026-08-08", "2026-08-08T…" ou "08/08/2026" → "2026-08-08". Senão null.
export function normalizarVencimento(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/.exec(s);
  if (m) {
    const [a, me, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    return dataValida(a, me, d) ? `${a}-${dois(me)}-${dois(d)}` : null;
  }
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (m) {
    const [a, me, d] = [Number(m[3]), Number(m[2]), Number(m[1])];
    return dataValida(a, me, d) ? `${a}-${dois(me)}-${dois(d)}` : null;
  }
  return null;
}

// "2026-08-08" → "08/08/2026" (nunca Date.toString()).
export function formatarDataBr(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

// Data de hoje no horário de Brasília, "yyyy-MM-dd" (independe do fuso do aparelho).
export function hojeBrasiliaIso(agora = new Date()) {
  const partes = {};
  new Intl.DateTimeFormat('en-US', { timeZone: FUSO_BRASILIA, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(agora)
    .forEach(p => { partes[p.type] = p.value; });
  return `${partes.year}-${partes.month}-${partes.day}`;
}

// Dias de calendário entre hoje (Brasília) e o vencimento. Negativo = vencido.
export function diasAteVencimento(vencimentoIso, hojeIso = hojeBrasiliaIso()) {
  const v = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(vencimentoIso || ''));
  const h = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(hojeIso || ''));
  if (!v || !h) return null;
  const tv = Date.UTC(Number(v[1]), Number(v[2]) - 1, Number(v[3]));
  const th = Date.UTC(Number(h[1]), Number(h[2]) - 1, Number(h[3]));
  return Math.round((tv - th) / 86400000);
}

function rotuloDocumento(unidade, documento) {
  return `${unidade} - ${documento}`;
}

export function parseDocumentosCsv(csv) {
  const texto = String(csv || '').replace(/^\uFEFF/, '');
  if (/^\s*</.test(texto) || /<!doctype html/i.test(texto.slice(0, 300))) {
    throw new Error('Resposta da planilha em formato inesperado');
  }
  const linhas = parseCsvDocumentos(texto);
  if (linhas.length === 0) return [];

  const cab = linhas[0].map(chaveCabecalho);
  const idx = nome => cab.indexOf(nome);
  const iId = idx('ID'), iUni = idx('UNIDADE'), iDoc = idx('DOCUMENTO'), iVenc = idx('VENCIMENTO');
  const iStatus = idx('STATUS'), iObs = idx('OBS'), iAtu = idx('ATUALIZADOEM');
  if (iUni < 0 || iDoc < 0 || iVenc < 0) {
    throw new Error('Colunas da aba DOCUMENTOS não reconhecidas');
  }

  const itens = [];
  for (let i = 1; i < linhas.length; i++) {
    const cols = linhas[i];
    const unidade = String(cols[iUni] || '').trim();
    const documento = String(cols[iDoc] || '').trim();
    if (!unidade && !documento) continue;
    const status = iStatus >= 0 ? String(cols[iStatus] || '').trim().toUpperCase() : '';
    const isento = status === 'ISENTO';
    itens.push({
      id: iId >= 0 ? String(cols[iId] || '').trim() : '',
      unidade,
      documento,
      label: rotuloDocumento(unidade, documento),
      vencimento: isento ? null : normalizarVencimento(cols[iVenc]),
      status,
      isento,
      obs: iObs >= 0 ? String(cols[iObs] || '').trim() : '',
      atualizadoEm: iAtu >= 0 ? String(cols[iAtu] || '').trim() : ''
    });
  }
  return itens;
}

// Fallback antigo: monta os 7 itens a partir de settings.documentosVencimento.
export function itensDosSettings(docSettings) {
  const doc = docSettings || {};
  return DOCUMENTOS_LEGADOS.map(base => ({
    id: base.id,
    unidade: base.unidade,
    documento: base.documento,
    label: base.label,
    vencimento: base.isento ? null : normalizarVencimento(doc[base.id]),
    status: base.isento ? 'ISENTO' : '',
    isento: !!base.isento,
    obs: '',
    atualizadoEm: ''
  }));
}

/**
 * Regra para não perder dado: se a planilha está sem VENCIMENTO (e não é
 * ISENTO) mas este navegador tem uma data em settings.documentosVencimento[id],
 * mostra a data local com a dica DICA_DATA_LOCAL. Datas iguais ao padrão de
 * fábrica (DEFAULT_SETTINGS) são ignoradas — essas já foram para a planilha.
 */
export function mesclarComDatasLocais(itens, docLocal, docPadrao) {
  const local = docLocal || {};
  const padrao = docPadrao || {};
  return (itens || []).map(item => {
    if (item.isento || item.vencimento || !item.id) return { ...item, somenteLocal: false };
    const dataLocal = normalizarVencimento(local[item.id]);
    if (!dataLocal) return { ...item, somenteLocal: false };
    if (normalizarVencimento(padrao[item.id]) === dataLocal) return { ...item, somenteLocal: false };
    return { ...item, vencimento: dataLocal, somenteLocal: true };
  });
}

/**
 * Mesmas regras/limites/textos/classes de sempre:
 *  isento → "✅ Isento de alvará" (doc-vencimento-isento)
 *  sem data → "⚠️ SEM ENTRADA" (doc-vencimento-alerta)
 *  < 0 → "🔴 Vencido há N dias" (doc-vencimento-alerta)
 *  <= 30 → "Faltam N dias" (doc-vencimento-atencao)
 *  > 30 → "Faltam N dias" (doc-vencimento-ok)
 */
export function situacaoDocumento(item, hojeIso = hojeBrasiliaIso()) {
  if (item.isento) return { chipClass: 'doc-vencimento-isento', statusHtml: '✅ Isento de alvará' };
  const diffDias = diasAteVencimento(item.vencimento, hojeIso);
  if (diffDias === null) return { chipClass: 'doc-vencimento-alerta', statusHtml: '⚠️ SEM ENTRADA' };
  if (diffDias < 0) {
    const diasAtraso = Math.abs(diffDias);
    return { chipClass: 'doc-vencimento-alerta', statusHtml: `🔴 Vencido há ${diasAtraso} dia${diasAtraso === 1 ? '' : 's'}` };
  }
  if (diffDias <= 30) {
    return { chipClass: 'doc-vencimento-atencao', statusHtml: `Faltam ${diffDias} dia${diffDias === 1 ? '' : 's'}` };
  }
  return { chipClass: 'doc-vencimento-ok', statusHtml: `Faltam ${diffDias} dias` };
}

export function lerCacheDocumentos() {
  try {
    const bruto = JSON.parse(localStorage.getItem(DOCUMENTOS_CACHE_KEY));
    if (bruto && Array.isArray(bruto.itens)) return bruto;
  } catch (e) { /* cache corrompido: ignora */ }
  return null;
}

function salvarCacheDocumentos(itens) {
  try {
    localStorage.setItem(DOCUMENTOS_CACHE_KEY, JSON.stringify({ itens, salvoEm: new Date().toISOString() }));
  } catch (e) { /* sem espaço: segue sem cache */ }
}

// Busca o CSV publicado. Sucesso → grava cache. Falha → lança (quem chama usa cache/fallback).
export async function buscarDocumentosPlanilha(fetchFn = fetch) {
  const resposta = await fetchFn(DOCUMENTOS_CSV_URL, { cache: 'no-store' });
  if (!resposta.ok) throw new Error('HTTP ' + resposta.status);
  const itens = parseDocumentosCsv(await resposta.text());
  salvarCacheDocumentos(itens);
  return itens;
}

/**
 * Itens a exibir, em ordem de preferência:
 *  1. lista da planilha (memória) → 2. último cache bom → 3. settings antigos/padrões.
 * Em 1 e 2 aplica a regra de datas locais.
 */
export function documentosParaExibir(itensPlanilha, docLocal, docPadrao) {
  if (Array.isArray(itensPlanilha)) {
    return { fonte: 'planilha', itens: mesclarComDatasLocais(itensPlanilha, docLocal, docPadrao) };
  }
  const cache = lerCacheDocumentos();
  if (cache) {
    return { fonte: 'cache', itens: mesclarComDatasLocais(cache.itens, docLocal, docPadrao) };
  }
  return { fonte: 'local', itens: itensDosSettings(docLocal).map(i => ({ ...i, somenteLocal: false })) };
}
