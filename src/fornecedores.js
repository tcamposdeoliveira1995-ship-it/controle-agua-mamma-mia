/**
 * Bloco FORNECEDORES — leitura da aba FORNECEDORES_PUB (planilha CONSUMO_AGUA_YUKA).
 *
 * Fonte da verdade: Painel Qualidade → 📇 Contatos Fornecedores (Apps Script).
 * Os dados completos (com CONTATO) ficam numa planilha PRIVADA, nunca publicada.
 * Depois de cada salvar/excluir o Apps Script reescreve a aba FORNECEDORES_PUB
 * (gid 823031070) só com NOME | EMPRESA | O_QUE_FORNECE | ULTIMO_PEDIDO, em
 * ordem alfabética. Aqui só lemos esse CSV publicado (mesmo documento 2PACX-…
 * de DOCUMENTOS / VALOR CONTAS).
 *
 * PRIVACIDADE: o contato (telefone/e-mail) do fornecedor é dado de terceiro e
 * NUNCA aparece no Control. O parser só lê as 4 colunas acima — mesmo que uma
 * coluna CONTATO apareça por engano no CSV, ela é ignorada (nem vai pro cache).
 *
 * Datas: ULTIMO_PEDIDO é texto yyyy-MM-dd (aceita dd/mm/aaaa digitado à mão);
 * na tela sempre dd/mm/aaaa; vazio = "—".
 */
import { parseCsvDocumentos, normalizarVencimento } from './documentos.js';

export const FORNECEDORES_PUB_GID = 823031070;
export const FORNECEDORES_CSV_URL =
  `https://docs.google.com/spreadsheets/d/e/2PACX-1vQuFNjTMhQ3Z1QzmEXW6scCk4UkMTYRLBV0z6QSczCDZO4AyjaneybI1Xwj0LWBdNHiYf95TB6JbDHz/pub?gid=${FORNECEDORES_PUB_GID}&single=true&output=csv`;
export const FORNECEDORES_CACHE_KEY = 'mamma_mia_fornecedores_cache_v1';
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

// Só os 4 campos públicos — lista branca (CONTATO nunca entra).
function soPublico(f) {
  return {
    nome: String(f.nome || '').trim(),
    empresa: String(f.empresa || '').trim(),
    oQueFornece: String(f.oQueFornece || '').trim(),
    ultimoPedido: normalizarVencimento(f.ultimoPedido) || ''
  };
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
    if (bruto && Array.isArray(bruto.itens)) return { ...bruto, itens: ordenarFornecedores(bruto.itens.map(soPublico)) };
  } catch (e) { /* cache corrompido: ignora */ }
  return null;
}

function salvarCacheFornecedores(itens) {
  try {
    localStorage.setItem(FORNECEDORES_CACHE_KEY, JSON.stringify({ itens: itens.map(soPublico), salvoEm: new Date().toISOString() }));
  } catch (e) { /* sem espaço: segue sem cache */ }
}

// Busca o CSV publicado. Sucesso → grava cache. Falha → lança (quem chama usa o cache).
export async function buscarFornecedoresPlanilha(fetchFn = fetch) {
  const resposta = await fetchFn(FORNECEDORES_CSV_URL, { cache: 'no-store' });
  if (!resposta.ok) throw new Error('HTTP ' + resposta.status);
  const itens = parseFornecedoresCsv(await resposta.text());
  salvarCacheFornecedores(itens);
  return itens;
}

// 1. planilha (memória) → 2. último cache bom → 3. nada (bloco escondido).
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

export function htmlFornecedores(itens, aberto) {
  const chips = itens.map(f => {
    const pedido = formatarUltimoPedido(f.ultimoPedido);
    const dica = [f.nome, f.empresa, f.oQueFornece, `Último pedido: ${pedido}`].filter(Boolean).join(' — ');
    return `<div class="doc-vencimento-chip forn-chip" title="${escapar(dica)}">
      <span class="doc-vencimento-label">${escapar(f.nome || f.empresa)}</span>
      ${f.empresa && f.nome ? `<span class="forn-empresa">${escapar(f.empresa)}</span>` : ''}
      <span class="doc-vencimento-status forn-oque">${escapar(f.oQueFornece || '—')}</span>
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
    itensMemoria = await buscarFornecedoresPlanilha();
  } catch (err) {
    console.error('[FORNECEDORES] Falha ao ler aba FORNECEDORES_PUB — usando cache:', err);
  }
  renderFornecedores();
}
