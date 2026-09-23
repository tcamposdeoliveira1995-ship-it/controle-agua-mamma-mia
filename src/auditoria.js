// =============================================================================
// MÓDULO: AUDITORIA DE HIGIENIZAÇÃO ESTRUTURAL - YUKA
// Mamma Mia Control - By Thalita Campos - Processos e Automações
//
// Só leitura — desde a migração pro Painel Qualidade (ver
// docs/superpowers/specs/2026-09-23-painel-qualidade-auditoria-design.md),
// registrar uma auditoria nova (checklist, não conformidade, assinatura)
// é feito na tela própria do Painel Qualidade
// (painel-qualidade-appscript/Auditoria.html), que fala com o mesmo
// APPS_SCRIPT_URL direto. Este arquivo mantém só a leitura: o histórico
// em nuvem (compartilhado, vindo do backend) e o histórico local que já
// existia neste navegador ANTES da migração (registros feitos por aqui
// não desaparecem — só não crescem mais, os novos entram pelo Painel
// Qualidade, que tem seu próprio histórico local).
// =============================================================================

const AUDITORIA_ESTRUTURA = [
  { id: 'producao_pisos', area: 'Área de Produção', subarea: 'Pisos', icone: '🏭', itens: [
    { id: 'piso_limpo', label: 'Piso limpo' },
    { id: 'piso_sem_residuos', label: 'Sem resíduos' },
    { id: 'piso_sem_agua', label: 'Sem acúmulo de água' },
  ]},
  { id: 'producao_estruturas', area: 'Área de Produção', subarea: 'Estruturas', icone: '🏗️', itens: [
    { id: 'est_paredes', label: 'Paredes' },
    { id: 'est_rodapes', label: 'Rodapés' },
    { id: 'est_porta_vaivem', label: 'Porta Vai e Vem' },
    { id: 'est_porta_elevador', label: 'Porta do Elevador' },
    { id: 'est_janelas', label: 'Janelas' },
    { id: 'est_vidros', label: 'Vidros' },
    { id: 'est_batentes', label: 'Batentes' },
    { id: 'est_interruptores', label: 'Interruptores' },
    { id: 'est_macanetas', label: 'Maçanetas' },
  ]},
  { id: 'producao_lixeiras', area: 'Área de Produção', subarea: 'Lixeiras', icone: '🗑️', itens: [
    { id: 'lix_higienizadas', label: 'Higienizadas' },
    { id: 'lix_saco_novo', label: 'Com saco novo' },
    { id: 'lix_fechadas', label: 'Fechadas corretamente' },
  ]},
  { id: 'producao_dispenser', area: 'Área de Produção', subarea: 'Dispenser', icone: '🧴', itens: [
    { id: 'disp_sabonete', label: 'Sabonete abastecido' },
    { id: 'disp_papel', label: 'Papel toalha abastecido' },
    { id: 'disp_alcool', label: 'Álcool disponível' },
  ]},
  { id: 'dml', area: 'DML', subarea: 'Depósito de Material de Limpeza', icone: '🧹', itens: [
    { id: 'dml_organizado', label: 'Ambiente organizado' },
    { id: 'dml_identificados', label: 'Produtos identificados' },
    { id: 'dml_armazenados', label: 'Materiais armazenados corretamente' },
    { id: 'dml_baldes', label: 'Baldes limpos' },
    { id: 'dml_rodos', label: 'Rodos organizados' },
    { id: 'dml_vassouras', label: 'Vassouras organizadas' },
    { id: 'dml_panos', label: 'Panos separados corretamente' },
  ]},
  { id: 'sanitarios', area: 'Sanitários', subarea: 'Sanitários', icone: '🚻', itens: [
    { id: 'san_piso', label: 'Piso' },
    { id: 'san_sanitarios', label: 'Sanitários' },
    { id: 'san_pia', label: 'Pia' },
    { id: 'san_espelhos', label: 'Espelhos' },
    { id: 'san_dispenser', label: 'Dispenser' },
    { id: 'san_lixeiras', label: 'Lixeiras' },
    { id: 'san_organizacao', label: 'Organização geral' },
  ]},
  { id: 'area_externa', area: 'Área Externa', subarea: 'Área Externa', icone: '🏢', itens: [
    { id: 'ext_entrada', label: 'Entrada' },
    { id: 'ext_calcada', label: 'Calçada' },
    { id: 'ext_circulacao', label: 'Área de circulação' },
    { id: 'ext_lixeira', label: 'Lixeira externa' },
    { id: 'ext_carga_descarga', label: 'Área de carga e descarga' },
  ]},
  { id: 'corredores', area: 'Corredores e Áreas Comuns', subarea: 'Corredores e Áreas Comuns', icone: '🚶', itens: [
    { id: 'cor_piso', label: 'Piso' },
    { id: 'cor_portas', label: 'Portas' },
    { id: 'cor_corrimaos', label: 'Corrimãos (quando houver)' },
    { id: 'cor_organizacao', label: 'Organização' },
    { id: 'cor_limpeza', label: 'Limpeza geral' },
  ]},
  { id: 'higienizacao_formas', area: 'Higienização de Formas', subarea: 'Higienização de Formas', icone: '🧽', itens: [
    { id: 'hf_lavadora', label: 'Lavadora Contínua GIFE LC15EPRO' },
    { id: 'hf_tanque', label: 'Tanque de Imersão GIFE 11350' },
    { id: 'hf_pia', label: 'Pia' },
    { id: 'hf_container', label: 'Container de Formas' },
    { id: 'hf_bancada', label: 'Bancada' },
    { id: 'hf_chao_paredes_janelas', label: 'Chão, Paredes e Janelas' },
  ]},
];

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyxTb1JgVX5o8_jD6xKXocb_tJb7lPQdo5c5aN9woB7es4FUthUcsQabYrZJ7est3cp/exec';
const LOGO_URL = '/logo-mamma-mia.jpg';

let _state = {
  historico: [],
  historicoSheets: [],
  historicoFiltrado: [],
};

// =============================================================================
// ENTRY POINT
// =============================================================================

export function initAuditoria() {
  _state.historicoSheets = [];
  _state.historicoFiltrado = [];
  try {
    const salvo = localStorage.getItem('auditoria_historico_yuka');
    _state.historico = salvo ? JSON.parse(salvo) : [];
  } catch(e) { _state.historico = []; }
  _renderTudo();
}

// =============================================================================
// RENDER PRINCIPAL
// =============================================================================

function _renderTudo() {
  const container = document.getElementById('tab-content-auditoria');
  if (!container) return;
  container.innerHTML = `
    <div class="panel-card" style="margin-bottom:1.5rem; border-left:4px solid var(--color-green);">
      <div class="panel-header">
        <div>
          <h2 style="font-size:1.3rem;">🧼 Auditoria de Higienização Estrutural</h2>
          <p style="color:var(--text-muted); font-size:0.85rem; margin-top:0.25rem;">Unidade YUKA — só leitura, novas auditorias são feitas no Painel Qualidade.</p>
        </div>
      </div>
    </div>
    <div id="aud-secao-historico">
      <div style="padding:2rem; text-align:center; color:var(--text-muted);">⏳ Carregando...</div>
    </div>

    <div id="aud-modal-ver" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:1000; align-items:center; justify-content:center; padding:1rem; backdrop-filter:blur(4px);">
      <div class="modal-content" style="max-width:700px; max-height:90vh; overflow-y:auto;">
        <div class="modal-header">
          <h3>📋 Detalhes da Auditoria</h3>
          <button id="aud-btn-fechar-ver" class="modal-close" type="button">&times;</button>
        </div>
        <div id="aud-modal-ver-conteudo"></div>
        <div class="modal-footer">
          <button id="aud-btn-imprimir" class="btn btn-secondary" type="button"><i data-lucide="printer"></i> Imprimir PDF</button>
          <button id="aud-btn-fechar-ver2" class="btn btn-primary" type="button">Fechar</button>
        </div>
      </div>
    </div>
  `;
  if (window.lucide) window.lucide.createIcons();
  document.getElementById('aud-btn-fechar-ver')?.addEventListener('click', _fecharVer);
  document.getElementById('aud-btn-fechar-ver2')?.addEventListener('click', _fecharVer);
  document.getElementById('aud-btn-imprimir')?.addEventListener('click', () => {
    const id = document.getElementById('aud-modal-ver-conteudo')?.dataset.audId;
    if (id) {
      const aud = _state.historico.find(a => a.id === id);
      if (aud) { _fecharVer(); _gerarPDFAuditoria(aud); return; }
    }
    window.print();
  });
  _carregarHistoricoNuvem();
}

async function _carregarHistoricoNuvem() {
  try {
    const resp = await fetch(APPS_SCRIPT_URL);
    const dados = await resp.json();
    _state.historicoSheets = Array.isArray(dados) ? dados : [];
    _state.historicoFiltrado = _state.historicoSheets;
  } catch(e) {
    _state.historicoSheets = [];
    _state.historicoFiltrado = [];
  }
  const secHist = document.getElementById('aud-secao-historico');
  if (secHist) secHist.innerHTML = _renderHistorico() + _renderHistoricoSheets();
  _bindEventosHistorico();
  if (window.lucide) window.lucide.createIcons();
}

// =============================================================================
// HISTÓRICO LOCAL (registros feitos neste navegador antes da migração —
// não recebe registros novos, esses ficam no Painel Qualidade)
// =============================================================================

function _renderHistorico() {
  if (_state.historico.length === 0) {
    return `<div class="panel-card" style="text-align:center; padding:3rem 1rem; margin-bottom:1.5rem;">
      <div style="font-size:3rem; margin-bottom:1rem;">📋</div>
      <h3 style="color:var(--text-muted);">Nenhuma auditoria local registrada</h3>
    </div>`;
  }
  const lista = [..._state.historico].reverse();
  const icones = { aprovado: '✅', ressalvas: '⚠️', reprovado: '❌' };
  const turnos = [...new Set(lista.map(a => a.turno).filter(Boolean))];
  const rows = lista.map(a => {
    const nc = Object.keys(a.naoConformidades || {}).length;
    const altas = Object.values(a.naoConformidades || {}).filter(n => n.criticidade === 'alta').length;
    return `<tr class="aud-hist-row"
      data-turno="${a.turno || ''}"
      data-data="${a.data || ''}"
      data-nc="${nc}"
      data-resultado="${a.resultado || ''}">
      <td>${a.dataHora || '—'}</td>
      <td>${a.turno || '—'}</td>
      <td>${a.auditor || '—'}</td>
      <td style="text-align:center;">${nc}${altas > 0 ? ` <span style="color:var(--color-red);font-size:0.75rem;">(${altas} alta${altas > 1 ? 's' : ''})</span>` : ''}</td>
      <td style="text-align:center; font-size:1.1rem;">${icones[a.resultado] || '—'}</td>
      <td style="text-align:center; display:flex; gap:0.25rem; justify-content:center;">
        <button class="btn btn-secondary aud-btn-ver" data-id="${a.id}" style="padding:0.3rem 0.7rem; font-size:0.8rem;"><i data-lucide="eye" style="width:14px;height:14px;"></i> Ver</button>
        <button class="btn btn-primary aud-btn-pdf-local" data-id="${a.id}" style="padding:0.3rem 0.7rem; font-size:0.8rem;"><i data-lucide="file-text" style="width:14px;height:14px;"></i> PDF</button>
      </td>
    </tr>`;
  }).join('');
  return `<div class="panel-card" style="margin-bottom:1.5rem;">
    <div class="panel-header" style="margin-bottom:1rem;">
      <h3>📋 Histórico Local Recente (YUKA)</h3>
      <span style="color:var(--text-muted); font-size:0.85rem;">${lista.length} registros</span>
    </div>
    <div style="display:flex; gap:0.75rem; flex-wrap:wrap; align-items:flex-end; margin-bottom:1rem;">
      <div class="form-group" style="margin:0; flex:1; min-width:140px;">
        <label class="form-label" style="font-size:0.8rem;">Data inicial</label>
        <input type="date" id="aud-local-filtro-de" class="form-control" style="font-size:0.85rem;">
      </div>
      <div class="form-group" style="margin:0; flex:1; min-width:140px;">
        <label class="form-label" style="font-size:0.8rem;">Data final</label>
        <input type="date" id="aud-local-filtro-ate" class="form-control" style="font-size:0.85rem;">
      </div>
      <div class="form-group" style="margin:0; flex:1; min-width:140px;">
        <label class="form-label" style="font-size:0.8rem;">Turno</label>
        <select id="aud-local-filtro-turno" class="form-control" style="font-size:0.85rem;">
          <option value="">Todos</option>
          ${turnos.map(t => `<option value="${t}">${t}</option>`).join('')}
        </select>
      </div>
      <div class="form-group" style="margin:0; flex:1; min-width:120px;">
        <label class="form-label" style="font-size:0.8rem;">Com N/C</label>
        <select id="aud-local-filtro-nc" class="form-control" style="font-size:0.85rem;">
          <option value="">Todas</option>
          <option value="sim">Com N/C</option>
          <option value="nao">Sem N/C</option>
        </select>
      </div>
      <button id="aud-local-btn-filtrar" class="btn btn-secondary" type="button" style="font-size:0.85rem; white-space:nowrap;"><i data-lucide="filter"></i> Filtrar</button>
      <button id="aud-local-btn-pdf" class="btn btn-primary" type="button" style="font-size:0.85rem; white-space:nowrap;"><i data-lucide="file-text"></i> Gerar PDF</button>
    </div>
    <div style="overflow-x:auto;">
      <table class="modern-table" id="aud-local-tabela">
        <thead><tr>
          <th>Data/Hora</th><th>Turno</th><th>Auditor</th>
          <th style="text-align:center;">N/C</th>
          <th style="text-align:center;">Resultado</th>
          <th style="text-align:center;">Ações</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>`;
}

// =============================================================================
// HISTÓRICO NUVEM
// =============================================================================

function _renderHistoricoSheets() {
  const lista = _state.historicoSheets || [];
  if (lista.length === 0) {
    return `<div class="panel-card" style="text-align:center; padding:3rem 1rem; margin-bottom:1.5rem;">
      <div style="font-size:3rem; margin-bottom:1rem;">☁️</div>
      <h3 style="color:var(--text-muted);">Nenhuma auditoria em nuvem registrada ainda</h3>
    </div>`;
  }
  const turnos = [...new Set(lista.map(a => a['Turno'] || a['turno']).filter(Boolean))];
  return `<div class="panel-card" style="margin-bottom:1.5rem;">
    <div class="panel-header" style="margin-bottom:1rem;">
      <h3>☁️ Histórico em Nuvem (Google Sheets)</h3>
      <span style="color:var(--text-muted); font-size:0.85rem;">${lista.length} registros</span>
    </div>
    <div style="display:flex; gap:0.75rem; flex-wrap:wrap; align-items:flex-end; margin-bottom:1rem;">
      <div class="form-group" style="margin:0; flex:1; min-width:140px;">
        <label class="form-label" style="font-size:0.8rem;">Data inicial</label>
        <input type="date" id="aud-filtro-de" class="form-control" style="font-size:0.85rem;">
      </div>
      <div class="form-group" style="margin:0; flex:1; min-width:140px;">
        <label class="form-label" style="font-size:0.8rem;">Data final</label>
        <input type="date" id="aud-filtro-ate" class="form-control" style="font-size:0.85rem;">
      </div>
      <div class="form-group" style="margin:0; flex:1; min-width:140px;">
        <label class="form-label" style="font-size:0.8rem;">Turno</label>
        <select id="aud-filtro-turno" class="form-control" style="font-size:0.85rem;">
          <option value="">Todos</option>
          ${turnos.map(t => `<option value="${t}">${t}</option>`).join('')}
        </select>
      </div>
      <button id="aud-btn-filtrar" class="btn btn-secondary" type="button" style="font-size:0.85rem; white-space:nowrap;"><i data-lucide="filter"></i> Filtrar</button>
      <button id="aud-btn-pdf-historico" class="btn btn-primary" type="button" style="font-size:0.85rem; white-space:nowrap;"><i data-lucide="file-text"></i> Gerar PDF</button>
    </div>
    <div id="aud-tabela-nuvem" style="overflow-x:auto;">
      ${_renderTabelaNuvem(lista)}
    </div>
  </div>`;
}

function _renderTabelaNuvem(lista) {
  const icones = { aprovado: '✅', ressalvas: '⚠️', reprovado: '❌' };
  if (lista.length === 0) {
    return `<p style="color:var(--text-muted); text-align:center; padding:1.5rem;">Nenhum registro encontrado.</p>`;
  }
  const rows = lista.map(a => {
    const dataHora = a['Data/Hora'] || a['dataHora'] || '—';
    const turno = a['Turno'] || a['turno'] || '—';
    const auditor = a['Auditor'] || a['auditor'] || '—';
    const nc = a['Não Conformes'] !== undefined ? a['Não Conformes'] : 0;
    const res = String(a['Resultado'] || a['resultado'] || '').toLowerCase().trim();
    return `<tr>
      <td>${dataHora}</td><td>${turno}</td><td>${auditor}</td>
      <td style="text-align:center;">${nc}</td>
      <td style="text-align:center; font-size:1.1rem;">${icones[res] || '—'}</td>
    </tr>`;
  }).join('');
  return `<table class="modern-table">
    <thead><tr>
      <th>Data/Hora</th><th>Turno</th><th>Auditor</th>
      <th style="text-align:center;">N/C</th>
      <th style="text-align:center;">Resultado</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

// =============================================================================
// BIND EVENTOS DO HISTÓRICO
// =============================================================================

function _bindEventosHistorico() {
  document.querySelectorAll('.aud-btn-ver').forEach(b => {
    b.addEventListener('click', () => {
      const aud = _state.historico.find(a => a.id === b.dataset.id);
      if (aud) _abrirVer(aud);
    });
  });
  document.querySelectorAll('.aud-btn-pdf-local').forEach(b => {
    b.addEventListener('click', () => {
      const aud = _state.historico.find(a => a.id === b.dataset.id);
      if (aud) _gerarPDFAuditoria(aud);
    });
  });

  document.getElementById('aud-local-btn-filtrar')?.addEventListener('click', () => {
    const de = document.getElementById('aud-local-filtro-de')?.value;
    const ate = document.getElementById('aud-local-filtro-ate')?.value;
    const turno = document.getElementById('aud-local-filtro-turno')?.value;
    const nc = document.getElementById('aud-local-filtro-nc')?.value;
    document.querySelectorAll('.aud-hist-row').forEach(row => {
      let mostrar = true;
      if (de && row.dataset.data) {
        const partes = row.dataset.data.split('/');
        if (partes.length === 3) {
          const dataRow = new Date(`${partes[2]}-${partes[1]}-${partes[0]}`);
          if (dataRow < new Date(de)) mostrar = false;
        }
      }
      if (ate && row.dataset.data) {
        const partes = row.dataset.data.split('/');
        if (partes.length === 3) {
          const dataRow = new Date(`${partes[2]}-${partes[1]}-${partes[0]}`);
          const fim = new Date(ate); fim.setHours(23,59,59,999);
          if (dataRow > fim) mostrar = false;
        }
      }
      if (turno && row.dataset.turno !== turno) mostrar = false;
      if (nc === 'sim' && Number(row.dataset.nc) === 0) mostrar = false;
      if (nc === 'nao' && Number(row.dataset.nc) > 0) mostrar = false;
      row.style.display = mostrar ? '' : 'none';
    });
  });

  document.getElementById('aud-local-btn-pdf')?.addEventListener('click', () => {
    const de = document.getElementById('aud-local-filtro-de')?.value;
    const ate = document.getElementById('aud-local-filtro-ate')?.value;
    const turno = document.getElementById('aud-local-filtro-turno')?.value;
    const nc = document.getElementById('aud-local-filtro-nc')?.value;
    let lista = [..._state.historico].reverse();
    if (de) lista = lista.filter(a => {
      const partes = (a.data || '').split('/');
      if (partes.length < 3) return true;
      return new Date(`${partes[2]}-${partes[1]}-${partes[0]}`) >= new Date(de);
    });
    if (ate) lista = lista.filter(a => {
      const partes = (a.data || '').split('/');
      if (partes.length < 3) return true;
      const fim = new Date(ate); fim.setHours(23,59,59,999);
      return new Date(`${partes[2]}-${partes[1]}-${partes[0]}`) <= fim;
    });
    if (turno) lista = lista.filter(a => a.turno === turno);
    if (nc === 'sim') lista = lista.filter(a => Object.keys(a.naoConformidades || {}).length > 0);
    if (nc === 'nao') lista = lista.filter(a => Object.keys(a.naoConformidades || {}).length === 0);
    _gerarPDFResumoLocal(lista);
  });

  document.getElementById('aud-btn-filtrar')?.addEventListener('click', () => {
    const de = document.getElementById('aud-filtro-de')?.value;
    const ate = document.getElementById('aud-filtro-ate')?.value;
    const turno = document.getElementById('aud-filtro-turno')?.value;
    let lista = _state.historicoSheets || [];
    if (de) lista = lista.filter(a => { const dt = _parseData(a['Data/Hora'] || ''); return dt && dt >= new Date(de); });
    if (ate) lista = lista.filter(a => { const dt = _parseData(a['Data/Hora'] || ''); const fim = new Date(ate); fim.setHours(23,59,59,999); return dt && dt <= fim; });
    if (turno) lista = lista.filter(a => (a['Turno'] || '') === turno);
    _state.historicoFiltrado = lista;
    const tabela = document.getElementById('aud-tabela-nuvem');
    if (tabela) tabela.innerHTML = _renderTabelaNuvem(lista);
  });

  document.getElementById('aud-btn-pdf-historico')?.addEventListener('click', () => {
    const lista = _state.historicoFiltrado.length > 0 ? _state.historicoFiltrado : _state.historicoSheets;
    _gerarPDFResumo(lista);
  });
}

// =============================================================================
// MODAL VER
// =============================================================================

function _abrirVer(auditoria) {
  const modal = document.getElementById('aud-modal-ver');
  const cont = document.getElementById('aud-modal-ver-conteudo');
  if (!modal || !cont) return;
  cont.dataset.audId = auditoria.id;
  const labels = { aprovado: '✅ Aprovado', ressalvas: '⚠️ Aprovado com Ressalvas', reprovado: '❌ Reprovado' };
  const ncs = auditoria.naoConformidades || {};
  const ncIds = Object.keys(ncs);
  const ic = { baixa: '🟢', media: '🟡', alta: '🔴' };
  let ncsHTML = ncIds.length === 0
    ? '<p style="color:var(--color-green);">Nenhuma não conformidade registrada.</p>'
    : ncIds.map(id => {
        const nc = ncs[id];
        let label = id;
        for (const sec of AUDITORIA_ESTRUTURA) {
          const f = sec.itens.find(i => i.id === id);
          if (f) { label = `${sec.subarea} → ${f.label}`; break; }
        }
        return `<div style="border:1px solid var(--card-border); border-radius:var(--border-radius-sm); padding:0.75rem; margin-bottom:0.75rem; background:rgba(192,122,108,0.06);">
          <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.4rem; flex-wrap:wrap;">
            <span>${ic[nc.criticidade] || '⚠️'}</span><strong>${label}</strong>
            ${nc.gerarOS ? '<span style="background:var(--color-blue);color:white;font-size:0.72rem;border-radius:10px;padding:1px 7px;">OS Gerada</span>' : ''}
          </div>
          <p style="font-size:0.85rem; color:var(--text-secondary);"><strong>Ocorrência:</strong> ${nc.descricao}</p>
          <p style="font-size:0.85rem; color:var(--text-secondary);"><strong>Ação corretiva:</strong> ${nc.acao}</p>
          ${nc.foto ? `<img src="${nc.foto}" style="max-width:100%; max-height:180px; border-radius:var(--border-radius-sm); margin-top:0.5rem; border:1px solid var(--card-border);" alt="Foto">` : ''}
        </div>`;
      }).join('');
  cont.innerHTML = `<div style="padding:0.5rem 0;">
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; margin-bottom:1.5rem;">
      <div><strong>Unidade:</strong> ${auditoria.unidade || 'YUKA'}</div>
      <div><strong>Data/Hora:</strong> ${auditoria.dataHora}</div>
      <div><strong>Turno:</strong> ${auditoria.turno}</div>
      <div><strong>Auditor:</strong> ${auditoria.auditor}</div>
      <div><strong>Resultado:</strong> ${labels[auditoria.resultado] || '—'}</div>
      <div><strong>Não Conformidades:</strong> ${ncIds.length}</div>
    </div>
    ${auditoria.observacoes ? `<div style="margin-bottom:1.5rem;"><strong>Observações:</strong><p style="margin-top:0.4rem;color:var(--text-secondary);">${auditoria.observacoes}</p></div>` : ''}
    <div style="margin-bottom:1.5rem;"><h4 style="margin-bottom:0.75rem;">⚠️ Não Conformidades</h4>${ncsHTML}</div>
    ${auditoria.assinatura ? `<div><h4 style="margin-bottom:0.5rem;">✍️ Assinatura do Auditor</h4><img src="${auditoria.assinatura}" style="max-width:100%; border:1px solid var(--card-border); border-radius:var(--border-radius-sm); background:white; padding:0.5rem;" alt="Assinatura"></div>` : ''}
  </div>`;
  modal.style.display = 'flex';
  if (window.lucide) window.lucide.createIcons();
}

function _fecharVer() {
  const modal = document.getElementById('aud-modal-ver');
  if (modal) modal.style.display = 'none';
}

// =============================================================================
// PDF INDIVIDUAL
// =============================================================================

function _gerarPDFAuditoria(registro) {
  const agora = new Date().toLocaleString('pt-BR');
  const labelRes = { aprovado: '✅ Aprovado', ressalvas: '⚠️ Aprovado com Ressalvas', reprovado: '❌ Reprovado' };
  const corRes = { aprovado: '#5c7a4e', ressalvas: '#b07a2a', reprovado: '#c0402a' };
  const icNC = { baixa: '🟢 Baixa', media: '🟡 Média', alta: '🔴 Alta' };
  const ncs = registro.naoConformidades || {};
  const ncIds = Object.keys(ncs);
  const total = AUDITORIA_ESTRUTURA.reduce((acc, sec) => acc + sec.itens.length, 0);
  const conformes = Object.values(registro.respostas || {}).filter(v => v === 'conforme').length;
  const naoConformes = Object.values(registro.respostas || {}).filter(v => v === 'nao_conforme').length;
  const naoAvaliados = total - conformes - naoConformes;

  const ncsHTML = ncIds.length === 0
    ? `<p style="color:#5c7a4e;font-size:13px;padding:12px;background:#f0f7ec;border-radius:8px;border-left:4px solid #5c7a4e;">✅ Nenhuma não conformidade registrada nesta auditoria.</p>`
    : ncIds.map((id, idx) => {
        const nc = ncs[id];
        let label = id;
        for (const sec of AUDITORIA_ESTRUTURA) {
          const f = sec.itens.find(i => i.id === id);
          if (f) { label = `${sec.subarea} → ${f.label}`; break; }
        }
        const corCrit = { baixa: '#5c7a4e', media: '#b07a2a', alta: '#c0402a' }[nc.criticidade] || '#4b433c';
        return `<div style="border:1px solid #e0d8d0;border-radius:8px;padding:16px;margin-bottom:14px;background:#faf8f5;page-break-inside:avoid;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid #e0d8d0;">
            <strong style="font-size:13px;color:#4b433c;">NC #${idx+1} — ${label}</strong>
            <span style="font-size:12px;font-weight:700;color:${corCrit};">${icNC[nc.criticidade] || nc.criticidade}</span>
          </div>
          <p style="font-size:12px;color:#5a4e45;margin:0 0 6px;"><strong>Ocorrência:</strong> ${nc.descricao}</p>
          <p style="font-size:12px;color:#5a4e45;margin:0 0 8px;"><strong>Ação corretiva:</strong> ${nc.acao}</p>
          ${nc.gerarOS ? '<span style="font-size:11px;background:#3b82f6;color:white;border-radius:10px;padding:2px 8px;display:inline-block;margin-bottom:8px;">🔧 OS Gerada</span>' : ''}
          ${nc.foto ? `<div style="margin-top:10px;text-align:center;"><img src="${nc.foto}" style="max-width:100%;max-height:260px;border-radius:6px;border:1px solid #e0d8d0;"></div>` : ''}
        </div>`;
      }).join('');

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:Arial,sans-serif; max-width:820px; margin:0 auto; padding:32px; background:#fff; color:#4b433c; }
  @media print { body { padding:16px; } .no-print { display:none !important; } }
  h1 { font-size:22px; font-weight:800; color:#4b433c; }
  h2 { font-size:15px; font-weight:700; color:#4b433c; margin-bottom:12px; padding-bottom:6px; border-bottom:2px solid #e0d8d0; }
  .kpi { background:#faf8f5; border:1px solid #e0d8d0; border-radius:8px; padding:14px; text-align:center; }
  .kpi-label { font-size:10px; color:#8a8570; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:4px; }
  .kpi-value { font-size:26px; font-weight:800; }
  .section { margin-bottom:24px; }
</style>
</head><body>
  <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #b79b6c;padding-bottom:16px;margin-bottom:24px;">
    <div style="display:flex;align-items:center;gap:16px;">
      <img src="${LOGO_URL}" style="height:56px;object-fit:contain;" onerror="this.style.display='none'">
      <div>
        <h1>Mamma Mia Control</h1>
        <p style="font-size:13px;color:#8a8570;margin-top:2px;">🧼 Auditoria de Higienização Estrutural — ${registro.unidade || 'YUKA'}</p>
      </div>
    </div>
    <div style="text-align:right;font-size:11px;color:#a09284;">
      <div>Emitido em:</div>
      <div style="font-weight:700;color:#4b433c;margin-top:2px;">${agora}</div>
      <div style="margin-top:4px;font-size:13px;font-weight:700;color:${corRes[registro.resultado] || '#4b433c'};">${labelRes[registro.resultado] || '—'}</div>
    </div>
  </div>
  <div class="section">
    <h2>📋 Informações da Auditoria</h2>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:13px;">
      <div><strong>ID:</strong> ${registro.id}</div>
      <div><strong>Data/Hora:</strong> ${registro.dataHora}</div>
      <div><strong>Turno:</strong> ${registro.turno}</div>
      <div><strong>Auditor:</strong> ${registro.auditor}</div>
      <div><strong>Unidade:</strong> ${registro.unidade || 'YUKA'}</div>
      <div><strong>Resultado:</strong> <span style="font-weight:700;color:${corRes[registro.resultado] || '#4b433c'};">${labelRes[registro.resultado] || '—'}</span></div>
    </div>
  </div>
  <div class="section">
    <h2>📊 Resumo dos Itens</h2>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;">
      <div class="kpi"><div class="kpi-label">Total Itens</div><div class="kpi-value" style="color:#4b433c;">${total}</div></div>
      <div class="kpi"><div class="kpi-label">Conformes</div><div class="kpi-value" style="color:#5c7a4e;">${conformes}</div></div>
      <div class="kpi"><div class="kpi-label">Não Conformes</div><div class="kpi-value" style="color:#c0402a;">${naoConformes}</div></div>
      <div class="kpi"><div class="kpi-label">Não Avaliados</div><div class="kpi-value" style="color:#8a8570;">${naoAvaliados}</div></div>
    </div>
  </div>
  ${registro.observacoes ? `<div class="section"><h2>📝 Observações</h2><p style="font-size:13px;color:#5a4e45;line-height:1.6;">${registro.observacoes}</p></div>` : ''}
  <div class="section">
    <h2>⚠️ Não Conformidades (${ncIds.length})</h2>
    ${ncsHTML}
  </div>
  ${registro.assinatura ? `<div class="section" style="page-break-inside:avoid;">
    <h2>✍️ Assinatura do Auditor</h2>
    <div style="border:1px solid #e0d8d0;border-radius:8px;padding:16px;background:#fff;display:inline-block;">
      <img src="${registro.assinatura}" style="max-width:280px;max-height:100px;display:block;">
      <p style="font-size:11px;color:#8a8570;margin-top:8px;">${registro.auditor} — ${registro.dataHora}</p>
    </div>
  </div>` : ''}
  <div style="margin-top:32px;padding-top:12px;border-top:1px solid #e0d8d0;font-size:10px;color:#a09284;text-align:center;">
    Mamma Mia Control — Gestão Inteligente de Operações • © 2026 Mamma Mia Salgados — By Thalita Campos
  </div>
  <div class="no-print" style="text-align:center;margin-top:24px;">
    <button onclick="window.print()" style="background:#b79b6c;color:white;border:none;border-radius:8px;padding:12px 32px;font-size:15px;cursor:pointer;font-weight:700;">🖨️ Imprimir / Salvar PDF</button>
  </div>
</body></html>`;

  const janela = window.open('', '_blank');
  janela.document.write(html);
  janela.document.close();
}

// =============================================================================
// PDF RESUMO LOCAL
// =============================================================================

function _gerarPDFResumoLocal(lista) {
  if (!lista || lista.length === 0) { _toast('Nenhum registro para gerar PDF.', 'warning'); return; }
  const agora = new Date().toLocaleString('pt-BR');
  const icones = { aprovado: '✅', ressalvas: '⚠️', reprovado: '❌' };
  const blocos = lista.map((a, idx) => {
    const nc = Object.keys(a.naoConformidades || {}).length;
    const altas = Object.values(a.naoConformidades || {}).filter(n => n.criticidade === 'alta').length;
    const total = AUDITORIA_ESTRUTURA.reduce((acc, sec) => acc + sec.itens.length, 0);
    const conformes = Object.values(a.respostas || {}).filter(v => v === 'conforme').length;
    const res = a.resultado || '';
    return `<div style="border:1px solid #e0d8d0;border-radius:8px;padding:16px;margin-bottom:16px;background:#faf8f5;page-break-inside:avoid;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid #e0d8d0;">
        <div>
          <strong style="font-size:13px;color:#4b433c;">#${idx+1} — ${a.dataHora || '—'}</strong><br>
          <span style="font-size:12px;color:#7b6f63;">Turno: ${a.turno || '—'} | Auditor: ${a.auditor || '—'}</span>
        </div>
        <div style="font-size:20px;">${icones[res] || '—'}</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px;">
        <div style="background:#fff;border:1px solid #e0d8d0;border-radius:6px;padding:8px;text-align:center;">
          <div style="font-size:10px;color:#8a8570;text-transform:uppercase;">Conformes</div>
          <div style="font-size:18px;font-weight:700;color:#5c7a4e;">${conformes}</div>
        </div>
        <div style="background:#fff;border:1px solid #e0d8d0;border-radius:6px;padding:8px;text-align:center;">
          <div style="font-size:10px;color:#8a8570;text-transform:uppercase;">N/C Total</div>
          <div style="font-size:18px;font-weight:700;color:#c0402a;">${nc}</div>
        </div>
        <div style="background:#fff;border:1px solid #e0d8d0;border-radius:6px;padding:8px;text-align:center;">
          <div style="font-size:10px;color:#8a8570;text-transform:uppercase;">N/C Altas</div>
          <div style="font-size:18px;font-weight:700;color:#c0402a;">${altas}</div>
        </div>
        <div style="background:#fff;border:1px solid #e0d8d0;border-radius:6px;padding:8px;text-align:center;">
          <div style="font-size:10px;color:#8a8570;text-transform:uppercase;">Total Itens</div>
          <div style="font-size:18px;font-weight:700;color:#4b433c;">${total}</div>
        </div>
      </div>
      ${a.observacoes ? `<p style="font-size:11px;color:#7b6f63;margin:0;"><strong>Observações:</strong> ${a.observacoes}</p>` : ''}
    </div>`;
  }).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <style>body{font-family:Arial,sans-serif;max-width:820px;margin:0 auto;padding:28px;background:#fff;color:#4b433c;}@media print{body{padding:0;}.no-print{display:none;}}</style>
  </head><body>
  <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #b79b6c;padding-bottom:14px;margin-bottom:20px;">
    <div style="display:flex;align-items:center;gap:16px;">
      <img src="${LOGO_URL}" style="height:48px;object-fit:contain;" onerror="this.style.display='none'">
      <div>
        <h1 style="font-size:20px;font-weight:800;margin:0;">Mamma Mia Control</h1>
        <p style="font-size:13px;color:#8a8570;margin:2px 0 0;">🧼 Relatório de Auditorias — YUKA</p>
      </div>
    </div>
    <div style="text-align:right;font-size:11px;color:#a09284;">
      <div>Emitido em: <strong style="color:#4b433c;">${agora}</strong></div>
      <div style="margin-top:4px;">${lista.length} auditoria(s)</div>
    </div>
  </div>
  ${blocos}
  <div style="margin-top:24px;padding-top:12px;border-top:1px solid #e0d8d0;font-size:10px;color:#a09284;text-align:center;">
    Mamma Mia Control — Gestão Inteligente de Operações • © 2026 Mamma Mia Salgados
  </div>
  <div class="no-print" style="text-align:center;margin-top:24px;">
    <button onclick="window.print()" style="background:#b79b6c;color:white;border:none;border-radius:8px;padding:12px 32px;font-size:15px;cursor:pointer;font-weight:700;">🖨️ Imprimir / Salvar PDF</button>
  </div>
  </body></html>`;

  const janela = window.open('', '_blank');
  janela.document.write(html);
  janela.document.close();
}

// =============================================================================
// PDF RESUMO NUVEM
// =============================================================================

function _gerarPDFResumo(lista) {
  if (!lista || lista.length === 0) { _toast('Nenhum registro para gerar PDF.', 'warning'); return; }
  const agora = new Date().toLocaleString('pt-BR');
  const icones = { aprovado: '✅', ressalvas: '⚠️', reprovado: '❌' };
  const blocos = lista.map((a, idx) => {
    const dataHora = a['Data/Hora'] || '—';
    const turno = a['Turno'] || '—';
    const auditor = a['Auditor'] || '—';
    const nc = a['Não Conformes'] || 0;
    const res = String(a['Resultado'] || '').toLowerCase().trim();
    const obs = a['Observações'] || '';
    const ncAltas = a['NC - Altas'] || 0;
    const conformes = a['Conformes'] || 0;
    // 48 = total de itens do checklist (AUDITORIA_ESTRUTURA) — fallback só
    // usado quando a linha da planilha não traz "Total Itens" preenchido.
    const total = a['Total Itens'] || 48;
    return `<div style="border:1px solid #e0d8d0;border-radius:8px;padding:16px;margin-bottom:16px;background:#faf8f5;page-break-inside:avoid;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid #e0d8d0;">
        <div>
          <strong style="font-size:13px;color:#4b433c;">#${idx+1} — ${dataHora}</strong><br>
          <span style="font-size:12px;color:#7b6f63;">Turno: ${turno} | Auditor: ${auditor}</span>
        </div>
        <div style="font-size:20px;">${icones[res] || '—'}</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px;">
        <div style="background:#fff;border:1px solid #e0d8d0;border-radius:6px;padding:8px;text-align:center;">
          <div style="font-size:10px;color:#8a8570;text-transform:uppercase;">Conformes</div>
          <div style="font-size:18px;font-weight:700;color:#5c7a4e;">${conformes}</div>
        </div>
        <div style="background:#fff;border:1px solid #e0d8d0;border-radius:6px;padding:8px;text-align:center;">
          <div style="font-size:10px;color:#8a8570;text-transform:uppercase;">N/C Total</div>
          <div style="font-size:18px;font-weight:700;color:#c0402a;">${nc}</div>
        </div>
        <div style="background:#fff;border:1px solid #e0d8d0;border-radius:6px;padding:8px;text-align:center;">
          <div style="font-size:10px;color:#8a8570;text-transform:uppercase;">N/C Altas</div>
          <div style="font-size:18px;font-weight:700;color:#c0402a;">${ncAltas}</div>
        </div>
        <div style="background:#fff;border:1px solid #e0d8d0;border-radius:6px;padding:8px;text-align:center;">
          <div style="font-size:10px;color:#8a8570;text-transform:uppercase;">Total Itens</div>
          <div style="font-size:18px;font-weight:700;color:#4b433c;">${total}</div>
        </div>
      </div>
      ${obs ? `<p style="font-size:11px;color:#7b6f63;margin:0;"><strong>Observações:</strong> ${obs}</p>` : ''}
    </div>`;
  }).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <style>body{font-family:Arial,sans-serif;max-width:820px;margin:0 auto;padding:28px;background:#fff;color:#4b433c;}@media print{body{padding:0;}.no-print{display:none;}}</style>
  </head><body>
  <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #b79b6c;padding-bottom:14px;margin-bottom:20px;">
    <div style="display:flex;align-items:center;gap:16px;">
      <img src="${LOGO_URL}" style="height:48px;object-fit:contain;" onerror="this.style.display='none'">
      <div>
        <h1 style="font-size:20px;font-weight:800;margin:0;">Mamma Mia Control</h1>
        <p style="font-size:13px;color:#8a8570;margin:2px 0 0;">🧼 Relatório de Auditorias de Higienização — YUKA</p>
      </div>
    </div>
    <div style="text-align:right;font-size:11px;color:#a09284;">
      <div>Emitido em: <strong style="color:#4b433c;">${agora}</strong></div>
      <div style="margin-top:4px;">${lista.length} auditoria(s)</div>
    </div>
  </div>
  ${blocos}
  <div style="margin-top:24px;padding-top:12px;border-top:1px solid #e0d8d0;font-size:10px;color:#a09284;text-align:center;">
    Mamma Mia Control — Gestão Inteligente de Operações • © 2026 Mamma Mia Salgados
  </div>
  <div class="no-print" style="text-align:center;margin-top:24px;">
    <button onclick="window.print()" style="background:#b79b6c;color:white;border:none;border-radius:8px;padding:12px 32px;font-size:15px;cursor:pointer;font-weight:700;">🖨️ Imprimir / Salvar PDF</button>
  </div>
  </body></html>`;

  const janela = window.open('', '_blank');
  janela.document.write(html);
  janela.document.close();
}

// =============================================================================
// UTILS
// =============================================================================

function _parseData(str) {
  if (!str) return null;
  const partes = str.split(', ');
  const dateParts = (partes[0] || '').split('/');
  if (dateParts.length < 3) return null;
  return new Date(`${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`);
}

function _toast(msg, tipo = 'info', duracao = 3500) {
  const cores = { success: 'var(--color-green)', error: 'var(--color-red)', info: 'var(--color-blue)', warning: 'var(--color-orange)' };
  const toast = document.createElement('div');
  toast.style.cssText = `position:fixed;bottom:1.5rem;right:1.5rem;z-index:99999;background:var(--card-bg);border:1px solid ${cores[tipo]};border-left:4px solid ${cores[tipo]};border-radius:var(--border-radius-md);padding:0.9rem 1.25rem;box-shadow:0 8px 24px rgba(0,0,0,0.12);max-width:360px;font-family:var(--font-main);font-size:0.9rem;color:var(--text-primary);`;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), duracao);
}
