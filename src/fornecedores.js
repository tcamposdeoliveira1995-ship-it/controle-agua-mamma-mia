/**
 * Bloco FORNECEDORES — lista de fornecedores com CONTATO, vinda do Painel Qualidade.
 *
 * Fonte da verdade: Painel Qualidade → 📇 Contatos Fornecedores (Apps Script).
 * Os dados completos ficam na planilha PRIVADA PQ_FORNECEDORES (nunca publicada).
 *
 * 1. Principal: GET no hub do Painel Qualidade (mesma implantação de
 *    AVISOS_EXEC_URL em main.js) → ?dados=fornecedores_contato, JSON
 *    { ok, fornecedores: [{ nome, empresa, contato, oQueFornece, ultimoPedido }] }.
 *    Aprovado pela Tita em 07/10/2026: "Control busca o contato do Painel, sem
 *    planilha publicada". O contato NUNCA vai para planilha publicada.
 * 2. Reserva (se o Painel falhar): CSV publicado da aba FORNECEDORES_PUB
 *    (gid 823031070), que só tem NOME | EMPRESA | O_QUE_FORNECE | ULTIMO_PEDIDO.
 *    O contato do último cache bom é mantido (casando nome + empresa).
 * 3. Sem nenhum dos dois: último cache bom; sem cache, o bloco fica escondido.
 *
 * Datas: o Painel manda ultimoPedido em dd/mm/aaaa; o CSV em yyyy-MM-dd.
 * Internamente tudo vira yyyy-MM-dd; na tela sempre dd/mm/aaaa; vazio = "—".
 * Todo texto é escapado antes de ir para o HTML.
 */
import { parseCsvDocumentos, normalizarVencimento } from './documentos.js';

export const FORNECEDORES_PUB_GID = 823031070;
export const FORNECEDORES_CSV_URL =
  `https://docs.google.com/spreadsheets/d/e/2PACX-1vQuFNjTMhQ3Z1QzmEXW6scCk4UkMTYRLBV0z6QSczCDZO4AyjaneybI1Xwj0LWBdNHiYf95TB6JbDHz/pub?gid=${FORNECEDORES_PUB_GID}&single=true&output=csv`;
// Mesma implantação do hub usada por AVISOS_EXEC_URL (src/main.js).
export const PAINEL_QUALIDADE_EXEC_URL =
  'https://script.google.com/macros/s/AKfycbw8SVtHjELPLVXkY6QGlSFpP-7P-53hjBg2wxMLoYL1a10Kt_Ce8qn1HhQnUmzz3kTW_Q/exec';
export const FORNECEDORES_CONTATO_URL = PAINEL_QUALIDADE_EXEC_URL + '?dados=fornecedores_contato';
export const FORNECEDORES_CACHE_KEY = 'mamma_mia_fornecedores_cache_v2';
const FORNECEDORES_CACHE_KEY_ANTIGA = 'mamma_mia_fornecedores_cache_v1';
const FORNECEDORES_ABERTO_KEY = 'mamma_mia_fornecedores_aberto_v1';

function chaveCabecalho(texto) {
  return String(texto || '')
    .replace(/^\uFEFF/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[\s_]+/g, '');
}

// "2026-10-01" → "01/10/2026"; vazio/inválido → "—" (nunca Date.toString()).
export function formatarUltimoPedido(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '').trim());
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '—';
}

const chaveOrdem = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const compararTexto = (a, b) => chaveOrdem(a).localeCompare(chaveOrdem(b), 'pt-BR', { sensitivity: 'base' });

// Sempre alfabético: nome, depois empresa (pt-BR, sem diferenciar maiúsculas/acentos).
export function ordenarFornecedores(lista) {
  return (lista || []).slice().sort((a, b) =>
    compararTexto(a.nome, b.nome) || compararTexto(a.empresa, b.empresa));
}

// CSV publicado: só os 4 campos públicos — lista branca (CONTATO do CSV nunca entra).
function soPublico(f) {
  return {
    nome: String(f.nome || '').trim(),
    empresa: String(f.empresa || '').trim(),
    oQueFornece: String(f.oQueFornece || '').trim(),
    ultimoPedido: normalizarVencimento(f.ultimoPedido) || ''
  };
}

// Painel / cache: lista branca dos 5 campos (inclui contato).
function soCampos(f) {
  return { ...soPublico(f || {}), contato: String((f && f.contato) || '').trim() };
}

// JSON do ?dados=fornecedores_contato → lista ordenada. Resposta sem ok:true → erro.
export function parseFornecedoresContato(resultado) {
  if (!resultado || resultado.ok !== true || !Array.isArray(resultado.fornecedores)) {
    throw new Error((resultado && resultado.erro) || 'Resposta do Painel em formato inesperado');
  }
  const itens = resultado.fornecedores.map(soCampos).filter(f => f.nome || f.empresa);
  return ordenarFornecedores(itens);
}

const chaveFornecedor = f => chaveOrdem(f.nome) + '|' + chaveOrdem(f.empresa);

// Reserva sem contato: reaproveita o contato do último cache bom (mesmo nome + empresa).
export function mesclarContatos(itensSemContato, itensComContato) {
  const contatos = new Map((itensComContato || []).filter(f => f.contato).map(f => [chaveFornecedor(f), f.contato]));
  return (itensSemContato || []).map(f => ({ ...soCampos(f), contato: contatos.get(chaveFornecedor(f)) || '' }));
}

// Contato que é claramente só um telefone → número para link tel: (senão null).
export function telefoneParaLink(contato) {
  const s = String(contato || '').trim();
  if (!/^\+?[\d\s().-]+$/.test(s)) return null;
  const digitos = s.replace(/\D/g, '');
  if (digitos.length < 8 || digitos.length > 13) return null;
  return (s.startsWith('+') ? '+' : '') + digitos;
}

export function parseFornecedoresCsv(csv) {
  const texto = String(csv || '').replace(/^\uFEFF/, '');
  if (/^\s*</.test(texto) || /<!doctype html/i.test(texto.slice(0, 300))) {
    throw new Error('Resposta da planilha em formato inesperado');
  }
  const linhas = parseCsvDocumentos(texto);
  if (linhas.length === 0) return [];

  const cab = linhas[0].map(chaveCabecalho);
  const iNome = cab.indexOf('NOME'), iEmp = cab.indexOf('EMPRESA');
  const iOque = cab.indexOf('OQUEFORNECE'), iPed = cab.indexOf('ULTIMOPEDIDO');
  if (iNome < 0) throw new Error('Colunas da aba FORNECEDORES_PUB não reconhecidas');

  const itens = [];
  for (let i = 1; i < linhas.length; i++) {
    const cols = linhas[i];
    const item = soPublico({
      nome: cols[iNome],
      empresa: iEmp >= 0 ? cols[iEmp] : '',
      oQueFornece: iOque >= 0 ? cols[iOque] : '',
      ultimoPedido: iPed >= 0 ? cols[iPed] : ''
    });
    if (!item.nome && !item.empresa) continue;
    itens.push(item);
  }
  return ordenarFornecedores(itens);
}

export function lerCacheFornecedores() {
  try {
    const bruto = JSON.parse(localStorage.getItem(FORNECEDORES_CACHE_KEY));
    if (bruto && Array.isArray(bruto.itens)) return { ...bruto, itens: ordenarFornecedores(bruto.itens.map(soCampos)) };
  } catch (e) { /* cache corrompido: ignora */ }
  return null;
}

function salvarCacheFornecedores(itens, fonte) {
  try {
    localStorage.setItem(FORNECEDORES_CACHE_KEY, JSON.stringify({ itens: itens.map(soCampos), fonte, salvoEm: new Date().toISOString() }));
    localStorage.removeItem(FORNECEDORES_CACHE_KEY_ANTIGA);
  } catch (e) { /* sem espaço: segue sem cache */ }
}

// Só o CSV publicado (sem contato). Falha → lança.
export async function buscarFornecedoresPlanilha(fetchFn = fetch) {
  const resposta = await fetchFn(FORNECEDORES_CSV_URL, { cache: 'no-store' });
  if (!resposta.ok) throw new Error('HTTP ' + resposta.status);
  return parseFornecedoresCsv(await resposta.text());
}

// Painel Qualidade (com contato). Falha → lança.
export async function buscarFornecedoresPainel(fetchFn = fetch) {
  const resposta = await fetchFn(FORNECEDORES_CONTATO_URL, { cache: 'no-store' });
  if (!resposta.ok) throw new Error('HTTP ' + resposta.status);
  const texto = await resposta.text();
  let resultado;
  try { resultado = JSON.parse(texto); } catch (e) { throw new Error('Resposta do Painel não é JSON'); }
  return parseFornecedoresContato(resultado);
}

// 1. Painel (com contato) → 2. CSV publicado (contato do cache, se houver). Sucesso → grava cache.
// Os dois falharam → lança (quem chama usa o cache).
export async function buscarFornecedores(fetchFn = fetch) {
  try {
    const itens = await buscarFornecedoresPainel(fetchFn);
    salvarCacheFornecedores(itens, 'painel');
    return itens;
  } catch (errPainel) {
    console.warn('[FORNECEDORES] Painel Qualidade indisponível — usando FORNECEDORES_PUB (sem contato):', errPainel);
    const cache = lerCacheFornecedores();
    const itens = ordenarFornecedores(mesclarContatos(await buscarFornecedoresPlanilha(fetchFn), cache ? cache.itens : []));
    salvarCacheFornecedores(itens, 'planilha');
    return itens;
  }
}

// 1. lista buscada agora (memória) → 2. último cache bom → 3. nada (bloco escondido).
export function fornecedoresParaExibir(itensPlanilha) {
  if (Array.isArray(itensPlanilha)) return { fonte: 'planilha', itens: ordenarFornecedores(itensPlanilha) };
  const cache = lerCacheFornecedores();
  if (cache) return { fonte: 'cache', itens: cache.itens };
  return { fonte: 'nenhuma', itens: [] };
}

function escapar(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function htmlContato(contato) {
  const texto = String(contato || '').trim();
  if (!texto) return '—';
  const tel = telefoneParaLink(texto);
  return tel ? `<a href="tel:${escapar(tel)}">${escapar(texto)}</a>` : escapar(texto);
}

export function htmlFornecedores(itens, aberto) {
  const chips = itens.map(f => {
    const pedido = formatarUltimoPedido(f.ultimoPedido);
    const dica = [f.nome, f.empresa, f.oQueFornece, f.contato ? `Contato: ${f.contato}` : '', `Último pedido: ${pedido}`].filter(Boolean).join(' — ');
    return `<div class="doc-vencimento-chip forn-chip" title="${escapar(dica)}">
      <span class="doc-vencimento-label">${escapar(f.nome || f.empresa)}</span>
      ${f.empresa && f.nome ? `<span class="forn-empresa">${escapar(f.empresa)}</span>` : ''}
      <span class="doc-vencimento-status forn-oque">${escapar(f.oQueFornece || '—')}</span>
      <span class="forn-contato">Contato: ${htmlContato(f.contato)}</span>
      <span class="doc-vencimento-dica forn-pedido">Último pedido: ${escapar(pedido)}</span>
    </div>`;
  }).join('');
  return `<details class="forn-grupo"${aberto ? ' open' : ''}>
      <summary class="doc-vencimento-grupo-titulo"><i data-lucide="contact"></i> Fornecedores (${itens.length})</summary>
      <div class="doc-vencimento-grupo-chips">${chips}</div>
    </details>`;
}

let itensMemoria = null;

export function renderFornecedores(container = document.getElementById('fornecedores-bar')) {
  if (!container) return;
  const { itens } = fornecedoresParaExibir(itensMemoria);
  if (!itens.length) {
    container.hidden = true;
    container.innerHTML = '';
    return;
  }
  let aberto = false;
  try { aberto = localStorage.getItem(FORNECEDORES_ABERTO_KEY) === '1'; } catch (e) { /* sem storage */ }
  container.innerHTML = htmlFornecedores(itens, aberto);
  container.hidden = false;
  const det = container.querySelector('details');
  if (det) {
    det.addEventListener('toggle', () => {
      try { localStorage.setItem(FORNECEDORES_ABERTO_KEY, det.open ? '1' : '0'); } catch (e) { /* sem storage */ }
    });
  }
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

export async function carregarFornecedores() {
  renderFornecedores(); // mostra o cache na hora
  try {
    itensMemoria = await buscarFornecedores();
  } catch (err) {
    console.error('[FORNECEDORES] Falha no Painel e na aba FORNECEDORES_PUB — usando cache:', err);
  }
  renderFornecedores();
}
