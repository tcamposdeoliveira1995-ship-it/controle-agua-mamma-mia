// =============================================================================
// MÓDULO: AUDITORIA DE HIGIENIZAÇÃO ESTRUTURAL - YUKA
// Mamma Mia Control - By Thalita Campos - Processos e Automações
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
];

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyxTb1JgVX5o8_jD6xKXocb_tJb7lPQdo5c5aN9woB7es4FUthUcsQabYrZJ7est3cp/exec';

let _state = {
  respostas: {},
  naoConformidades: {},
  assinatura: null,
  historico: [],
  historicoAberto: false,
};

let _ncItemIdPendente = null;

// ─── ENTRY POINT ─────────────────────────────────────────────────────────────

export function initAuditoria() {
  _state.respostas = {};
  _state.naoConformidades = {};
  _state.assinatura = null;
  _state.historicoAberto = false;

  try {
    const salvo = localStorage.getItem('auditoria_historico_yuka');
    _state.historico = salvo ? JSON.parse(salvo) : [];
  } catch(e) { _state.historico = []; }

  _renderTudo();
}

// ─── RENDER PRINCIPAL ─────────────────────────────────────────────────────────

function _renderTudo() {
  const container = document.getElementById('tab-content-auditoria');
  if (!container) return;

  const agora = new Date();
  const dataFmt = agora.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  const horaFmt = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  container.innerHTML = `
    <div class="panel-card" style="margin-bottom:1.5rem; border-left:4px solid var(--color-green);">
      <div class="panel-header" style="flex-wrap:wrap; gap:1rem;">
        <div>
          <h2 style="font-size:1.3rem;">🧼 Auditoria de Higienização Estrutural</h2>
          <p style="color:var(--text-muted); font-size:0.85rem; margin-top:0.25rem;">Unidade YUKA · ${dataFmt} · ${horaFmt}</p>
          <p style="color:var(--color-orange); font-size:0.8rem; margin-top:0.25rem; font-style:italic;">⚠️ Este módulo não contempla higienização de equipamentos e utensílios de produção (responsabilidade dos manipuladores - POP).</p>
        </div>
        <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-left:auto;">
          <button id="aud-btn-historico" class="btn btn-secondary" type="button">
            <i data-lucide="history"></i> Histórico
          </button>
          <button id="aud-btn-nova" class="btn btn-primary" type="button" style="display:none;">
            <i data-lucide="plus"></i> Nova Auditoria
          </button>
        </div>
      </div>
    </div>

    <div id="aud-secao-historico" style="display:none;"></div>

    <div id="aud-secao-formulario">
      <div class="panel-card" style="margin-bottom:1.5rem;">
        <div class="panel-header"><h3>📋 Informações da Auditoria</h3></div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-top:1rem;">
          <div class="form-group">
            <label class="form-label">Turno <span style="color:var(--color-red);">*</span></label>
            <select id="aud-turno" class="form-control" required>
              <option value="">Selecione o turno</option>
              <option value="Matutino">Matutino</option>
              <option value="Vespertino">Vespertino</option>
              <option value="Noturno">Noturno</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Nome do Auditor <span style="color:var(--color-red);">*</span></label>
            <input type="text" id="aud-auditor" class="form-control" placeholder="Nome completo do auditor" required>
          </div>
        </div>
      </div>

      <div id="aud-checklist">${_renderChecklist()}</div>

      <div class="panel-card" id="aud-nc-resumo" style="margin-bottom:1.5rem; display:none;">
        <div class="panel-header">
          <h3 style="color:var(--color-red);">⚠️ Não Conformidades Registradas</h3>
          <span id="aud-nc-count" style="background:var(--color-red); color:white; border-radius:20px; padding:2px 10px; font-size:0.8rem; font-weight:700;">0</span>
        </div>
        <div id="aud-nc-lista" style="margin-top:1rem;"></div>
      </div>

      <div class="panel-card" style="margin-bottom:1.5rem;">
        <div class="panel-header"><h3>📝 Observações Gerais</h3></div>
        <textarea id="aud-observacoes" class="form-control" rows="4" placeholder="Campo livre para registros adicionais..." style="resize:vertical; margin-top:1rem;"></textarea>
      </div>

      <div class="panel-card" style="margin-bottom:1.5rem;">
        <div class="panel-header"><h3>🏆 Resultado da Auditoria</h3></div>
        <p style="color:var(--text-muted); font-size:0.85rem; margin:0.75rem 0;">Calculado automaticamente com base nos itens avaliados.</p>
        <div id="aud-resultado" style="display:flex; gap:1rem; flex-wrap:wrap; margin-top:1rem;">
          <div class="resultado-opcao" data-resultado="aprovado" style="flex:1; min-width:180px; padding:1.25rem; border-radius:var(--border-radius-md); border:2px solid var(--card-border); text-align:center; opacity:0.4; transition:all 0.3s;">
            <div style="font-size:2rem;">✅</div>
            <div style="font-weight:700; margin-top:0.5rem;">Aprovado</div>
            <div style="font-size:0.8rem; color:var(--text-muted);">0 não conformidades</div>
          </div>
          <div class="resultado-opcao" data-resultado="ressalvas" style="flex:1; min-width:180px; padding:1.25rem; border-radius:var(--border-radius-md); border:2px solid var(--card-border); text-align:center; opacity:0.4; transition:all 0.3s;">
            <div style="font-size:2rem;">⚠️</div>
            <div style="font-weight:700; margin-top:0.5rem;">Aprovado com Ressalvas</div>
            <div style="font-size:0.8rem; color:var(--text-muted);">1-3 não conformidades baixas/médias</div>
          </div>
          <div class="resultado-opcao" data-resultado="reprovado" style="flex:1; min-width:180px; padding:1.25rem; border-radius:var(--border-radius-md); border:2px solid var(--card-border); text-align:center; opacity:0.4; transition:all 0.3s;">
            <div style="font-size:2rem;">❌</div>
            <div style="font-weight:700; margin-top:0.5rem;">Reprovado</div>
            <div style="font-size:0.8rem; color:var(--text-muted);">NC alta ou 4+ não conformidades</div>
          </div>
        </div>
      </div>

      <div class="panel-card" style="margin-bottom:1.5rem;">
        <div class="panel-header">
          <h3>✍️ Assinatura Digital do Auditor</h3>
          <button id="aud-btn-limpar-assinatura" class="btn btn-secondary" type="button" style="font-size:0.8rem; padding:0.4rem 0.8rem;"><i data-lucide="eraser"></i> Limpar</button>
        </div>
        <p style="color:var(--text-muted); font-size:0.82rem; margin:0.75rem 0 0.5rem;">Assine no campo abaixo usando o mouse ou toque na tela.</p>
        <canvas id="aud-assinatura-canvas" style="width:100%; height:160px; border:2px dashed var(--card-border); border-radius:var(--border-radius-md); background:rgba(255,255,255,0.6); cursor:crosshair; touch-action:none; display:block;"></canvas>
        <p id="aud-assinatura-status" style="color:var(--text-muted); font-size:0.78rem; margin-top:0.4rem; text-align:center;">Área de assinatura vazia</p>
      </div>

      <div style="display:flex; justify-content:flex-end; gap:1rem; margin-bottom:2rem; flex-wrap:wrap;">
        <button id="aud-btn-limpar" class="btn btn-secondary" type="button"><i data-lucide="rotate-ccw"></i> Limpar Formulário</button>
        <button id="aud-btn-finalizar" class="btn btn-primary" type="button" style="font-size:1rem; padding:0.85rem 2rem;"><i data-lucide="check-circle"></i> Finalizar e Registrar Auditoria</button>
      </div>
    </div>

    <div id="aud-modal-nc" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:1000; align-items:center; justify-content:center; padding:1rem; backdrop-filter:blur(4px);">
      <div class="modal-content" style="max-width:560px; max-height:90vh; overflow-y:auto;">
        <div class="modal-header">
          <h3>⚠️ Registrar Não Conformidade</h3>
          <button id="aud-btn-fechar-nc" class="modal-close" type="button">&times;</button>
        </div>
        <div style="padding:0.5rem 0;">
          <p id="aud-nc-label" style="font-weight:600; color:var(--text-primary); margin-bottom:1.25rem; padding:0.75rem; background:rgba(192,122,108,0.1); border-radius:var(--border-radius-sm); border-left:3px solid var(--color-red);"></p>
          <div class="form-group" style="margin-bottom:1rem;">
            <label class="form-label">Descrição da ocorrência <span style="color:var(--color-red);">*</span></label>
            <textarea id="aud-nc-descricao" class="form-control" rows="3" placeholder="Descreva o problema encontrado..." style="resize:vertical;"></textarea>
          </div>
          <div class="form-group" style="margin-bottom:1rem;">
            <label class="form-label">Foto da ocorrência <span style="color:var(--color-red);">*</span></label>
            <div id="aud-nc-foto-drop" style="border:2px dashed var(--card-border); border-radius:var(--border-radius-md); padding:1.5rem; text-align:center; cursor:pointer; background:rgba(255,255,255,0.4);">
              <div style="font-size:1.5rem; margin-bottom:0.5rem;">📷</div>
              <p style="color:var(--text-muted); font-size:0.85rem;">Clique para selecionar ou arraste uma foto</p>
              <input type="file" id="aud-nc-foto-input" accept="image/*" capture="environment" style="display:none;">
            </div>
            <div id="aud-nc-foto-preview" style="display:none; margin-top:0.75rem; text-align:center; position:relative;">
              <img id="aud-nc-foto-img" style="max-width:100%; max-height:200px; border-radius:var(--border-radius-md); border:1px solid var(--card-border);" alt="Preview">
              <button id="aud-nc-foto-remover" type="button" style="position:absolute; top:4px; right:4px; background:var(--color-red); color:white; border:none; border-radius:50%; width:24px; height:24px; cursor:pointer;">✕</button>
            </div>
          </div>
          <div class="form-group" style="margin-bottom:1rem;">
            <label class="form-label">Grau de criticidade <span style="color:var(--color-red);">*</span></label>
            <div style="display:flex; gap:0.75rem; margin-top:0.5rem; flex-wrap:wrap;">
              <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer; padding:0.5rem 1rem; border-radius:var(--border-radius-sm); border:2px solid var(--color-green); font-weight:600; font-size:0.85rem; color:var(--color-green);">
                <input type="radio" name="aud-nc-criticidade" value="baixa"> 🟢 Baixa
              </label>
              <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer; padding:0.5rem 1rem; border-radius:var(--border-radius-sm); border:2px solid var(--color-orange); font-weight:600; font-size:0.85rem; color:var(--color-orange);">
                <input type="radio" name="aud-nc-criticidade" value="media"> 🟡 Média
              </label>
              <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer; padding:0.5rem 1rem; border-radius:var(--border-radius-sm); border:2px solid var(--color-red); font-weight:600; font-size:0.85rem; color:var(--color-red);">
                <input type="radio" name="aud-nc-criticidade" value="alta"> 🔴 Alta
              </label>
            </div>
          </div>
          <div class="form-group" style="margin-bottom:1rem;">
            <label class="form-label">Ação corretiva imediata <span style="color:var(--color-red);">*</span></label>
            <textarea id="aud-nc-acao" class="form-control" rows="2" placeholder="Qual ação foi ou será tomada imediatamente?" style="resize:vertical;"></textarea>
          </div>
          <div class="form-group" style="margin-bottom:1rem;">
            <label style="display:flex; align-items:center; gap:0.75rem; cursor:pointer;">
              <input type="checkbox" id="aud-nc-gerar-os" style="width:18px; height:18px; cursor:pointer;">
              <span style="font-weight:600; color:var(--text-primary);">🔧 Gerar Ordem de Serviço (ocorrência estrutural)</span>
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button id="aud-btn-cancelar-nc" class="btn btn-secondary" type="button">Cancelar</button>
          <button id="aud-btn-salvar-nc" class="btn btn-primary" type="button">Salvar Não Conformidade</button>
        </div>
      </div>
    </div>

    <div id="aud-modal-ver" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:1000; align-items:center; justify-content:center; padding:1rem; backdrop-filter:blur(4px);">
      <div class="modal-content" style="max-width:700px; max-height:90vh; overflow-y:auto;">
        <div class="modal-header">
          <h3>📋 Detalhes da Auditoria</h3>
          <button id="aud-btn-fechar-ver" class="modal-close" type="button">&times;</button>
        </div>
        <div id="aud-modal-ver-conteudo"></div>
        <div class="modal-footer">
          <button id="aud-btn-imprimir" class="btn btn-secondary" type="button"><i data-lucide="printer"></i> Imprimir</button>
          <button id="aud-btn-fechar-ver2" class="btn btn-primary" type="button">Fechar</button>
        </div>
      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();
  _bindEventos();
  _bindCanvas();
}

// ─── CHECKLIST ────────────────────────────────────────────────────────────────

function _renderChecklist() {
  const areas = {};
  AUDITORIA_ESTRUTURA.forEach(sec => {
    if (!areas[sec.area]) areas[sec.area] = [];
    areas[sec.area].push(sec);
  });

  let html = '';
  for (const [area, secoes] of Object.entries(areas)) {
    html += `<div class="panel-card" style="margin-bottom:1.5rem;">
      <div class="panel-header" style="margin-bottom:1rem;">
        <h3>${secoes[0].icone} ${area}</h3>
        <div style="display:flex; gap:0.5rem; font-size:0.75rem;">
          <span class="aud-area-conf" data-area="${area}" style="color:var(--color-green); font-weight:700;">0 ✅</span>
          <span style="color:var(--text-muted);">/</span>
          <span class="aud-area-total" data-area="${area}" style="color:var(--text-muted);">0 itens</span>
        </div>
      </div>
      <div style="display:flex; flex-direction:column; gap:1.25rem;">`;

    secoes.forEach(sec => {
      if (sec.subarea !== sec.area) {
        html += `<p style="font-size:0.8rem; font-weight:700; text-transform:uppercase; color:var(--text-muted); letter-spacing:0.05em; margin-bottom:0.25rem;">${sec.subarea}</p>`;
      }
      html += `<div style="display:flex; flex-direction:column; gap:0.5rem;">`;
      sec.itens.forEach(item => {
        html += `<div class="aud-item" data-id="${item.id}" data-area="${area}" style="display:flex; align-items:center; justify-content:space-between; padding:0.75rem 1rem; background:rgba(255,255,255,0.5); border-radius:var(--border-radius-md); border:1px solid var(--card-border); gap:1rem; flex-wrap:wrap; transition:background 0.2s;">
          <span style="font-size:0.9rem; color:var(--text-primary); flex:1;">${item.label}</span>
          <div style="display:flex; gap:0.5rem; flex-shrink:0;">
            <button class="aud-btn-conf" data-id="${item.id}" type="button" style="padding:0.4rem 0.9rem; border-radius:var(--border-radius-sm); border:2px solid var(--color-green); background:transparent; color:var(--color-green); font-size:0.8rem; font-weight:700; cursor:pointer; transition:all 0.2s;">✅ Conforme</button>
            <button class="aud-btn-nc" data-id="${item.id}" type="button" style="padding:0.4rem 0.9rem; border-radius:var(--border-radius-sm); border:2px solid var(--color-red); background:transparent; color:var(--color-red); font-size:0.8rem; font-weight:700; cursor:pointer; transition:all 0.2s;">❌ N/C</button>
          </div>
        </div>`;
      });
      html += `</div>`;
    });
    html += `</div></div>`;
  }
  return html;
}

// ─── HISTÓRICO ────────────────────────────────────────────────────────────────

function _renderHistorico() {
  if (_state.historico.length === 0) {
    return `<div class="panel-card" style="text-align:center; padding:3rem 1rem; margin-bottom:1.5rem;">
      <div style="font-size:3rem; margin-bottom:1rem;">📋</div>
      <h3 style="color:var(--text-muted);">Nenhuma auditoria registrada ainda</h3>
      <p style="color:var(--text-muted); font-size:0.85rem; margin-top:0.5rem;">Preencha e finalize a auditoria para que ela apareça aqui.</p>
    </div>`;
  }

  const lista = [..._state.historico].reverse();
  const icones = { aprovado: '✅', ressalvas: '⚠️', reprovado: '❌' };

  const rows = lista.map(a => {
    const nc = Object.keys(a.naoConformidades || {}).length;
    const altas = Object.values(a.naoConformidades || {}).filter(n => n.criticidade === 'alta').length;
    return `<tr>
      <td>${a.dataHora || '—'}</td>
      <td>${a.turno || '—'}</td>
      <td>${a.auditor || '—'}</td>
      <td style="text-align:center;">${nc}${altas > 0 ? ` <span style="color:var(--color-red);font-size:0.75rem;">(${altas} alta${altas > 1 ? 's' : ''})</span>` : ''}</td>
      <td style="text-align:center; font-size:1.1rem;">${icones[a.resultado] || '—'}</td>
      <td style="text-align:center;">
        <button class="btn btn-secondary aud-btn-ver" data-id="${a.id}" style="padding:0.3rem 0.7rem; font-size:0.8rem;"><i data-lucide="eye" style="width:14px;height:14px;"></i> Ver</button>
      </td>
    </tr>`;
  }).join('');

  return `<div class="panel-card" style="margin-bottom:1.5rem;">
    <div class="panel-header" style="margin-bottom:1rem;">
      <h3>📋 Histórico de Auditorias - YUKA</h3>
      <span style="color:var(--text-muted); font-size:0.85rem;">${lista.length} registros</span>
    </div>
    <div style="overflow-x:auto;">
      <table class="modern-table">
        <thead><tr>
          <th>Data/Hora</th><th>Turno</th><th>Auditor</th>
          <th style="text-align:center;">Não Conformidades</th>
          <th style="text-align:center;">Resultado</th>
          <th style="text-align:center;">Ações</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>`;
}

// ─── BIND EVENTOS ─────────────────────────────────────────────────────────────

function _bindEventos() {
  // Checklist
  document.querySelectorAll('.aud-btn-conf').forEach(btn => {
    btn.addEventListener('click', () => _check(btn.dataset.id, 'conforme'));
  });
  document.querySelectorAll('.aud-btn-nc').forEach(btn => {
    btn.addEventListener('click', () => _check(btn.dataset.id, 'nao_conforme'));
  });

  // Histórico toggle
  document.getElementById('aud-btn-historico')?.addEventListener('click', () => {
    _state.historicoAberto = !_state.historicoAberto;
    const secHist = document.getElementById('aud-secao-historico');
    const secForm = document.getElementById('aud-secao-formulario');
    const btnNova = document.getElementById('aud-btn-nova');
    const btnHist = document.getElementById('aud-btn-historico');
    if (_state.historicoAberto) {
      secHist.innerHTML = _renderHistorico();
      secHist.style.display = '';
      secForm.style.display = 'none';
      btnNova.style.display = '';
      if (btnHist) btnHist.innerHTML = '<i data-lucide="x"></i> Fechar Histórico';
      document.querySelectorAll('.aud-btn-ver').forEach(b => {
        b.addEventListener('click', () => {
          const aud = _state.historico.find(a => a.id === b.dataset.id);
          if (aud) _abrirVer(aud);
        });
      });
    } else {
      secHist.style.display = 'none';
      secForm.style.display = '';
      btnNova.style.display = 'none';
      if (btnHist) btnHist.innerHTML = '<i data-lucide="history"></i> Histórico';
    }
    if (window.lucide) window.lucide.createIcons();
  });

  // Nova auditoria
  document.getElementById('aud-btn-nova')?.addEventListener('click', () => {
    _state.historicoAberto = false;
    document.getElementById('aud-secao-historico').style.display = 'none';
    document.getElementById('aud-secao-formulario').style.display = '';
    document.getElementById('aud-btn-nova').style.display = 'none';
    const btnHist = document.getElementById('aud-btn-historico');
    if (btnHist) btnHist.innerHTML = '<i data-lucide="history"></i> Histórico';
    if (window.lucide) window.lucide.createIcons();
  });

  // Modal NC
  document.getElementById('aud-btn-fechar-nc')?.addEventListener('click', _fecharNC);
  document.getElementById('aud-btn-cancelar-nc')?.addEventListener('click', _fecharNC);
  document.getElementById('aud-btn-salvar-nc')?.addEventListener('click', _salvarNC);

  // Foto
  const fotoDrop = document.getElementById('aud-nc-foto-drop');
  const fotoInput = document.getElementById('aud-nc-foto-input');
  if (fotoDrop && fotoInput) {
    fotoDrop.addEventListener('click', () => fotoInput.click());
    fotoDrop.addEventListener('dragover', e => { e.preventDefault(); fotoDrop.style.borderColor = 'var(--color-blue)'; });
    fotoDrop.addEventListener('dragleave', () => { fotoDrop.style.borderColor = 'var(--card-border)'; });
    fotoDrop.addEventListener('drop', e => { e.preventDefault(); fotoDrop.style.borderColor = 'var(--card-border)'; const f = e.dataTransfer.files[0]; if (f && f.type.startsWith('image/')) _processarFoto(f); });
    fotoInput.addEventListener('change', e => { const f = e.target.files[0]; if (f) _processarFoto(f); });
  }
  document.getElementById('aud-nc-foto-remover')?.addEventListener('click', () => {
    document.getElementById('aud-nc-foto-input').value = '';
    document.getElementById('aud-nc-foto-preview').style.display = 'none';
    document.getElementById('aud-nc-foto-drop').style.display = '';
    window._audFotoBase64 = null;
  });

  // Limpar formulário
  document.getElementById('aud-btn-limpar')?.addEventListener('click', () => {
    if (confirm('Tem certeza que deseja limpar todo o formulário?')) {
      _state.respostas = {};
      _state.naoConformidades = {};
      _state.assinatura = null;
      _renderTudo();
      _toast('Formulário limpo.', 'info');
    }
  });

  // Finalizar
  document.getElementById('aud-btn-finalizar')?.addEventListener('click', _finalizar);

  // Modal ver
  document.getElementById('aud-btn-fechar-ver')?.addEventListener('click', _fecharVer);
  document.getElementById('aud-btn-fechar-ver2')?.addEventListener('click', _fecharVer);
  document.getElementById('aud-btn-imprimir')?.addEventListener('click', () => window.print());
}

// ─── LÓGICA DE CHECK ─────────────────────────────────────────────────────────

function _check(itemId, tipo) {
  if (_state.respostas[itemId] === tipo) {
    delete _state.respostas[itemId];
    delete _state.naoConformidades[itemId];
    _visualizarItem(itemId, null);
  } else {
    _state.respostas[itemId] = tipo;
    if (tipo === 'nao_conforme') {
      delete _state.naoConformidades[itemId];
      _abrirNC(itemId);
    } else {
      delete _state.naoConformidades[itemId];
    }
    _visualizarItem(itemId, tipo);
  }
  _atualizarResultado();
  _atualizarContadores();
  _atualizarResumoNCs();
}

function _visualizarItem(itemId, tipo) {
  const el = document.querySelector(`.aud-item[data-id="${itemId}"]`);
  if (!el) return;
  const btnC = el.querySelector('.aud-btn-conf');
  const btnN = el.querySelector('.aud-btn-nc');
  if (btnC) { btnC.style.background = 'transparent'; btnC.style.color = 'var(--color-green)'; }
  if (btnN) { btnN.style.background = 'transparent'; btnN.style.color = 'var(--color-red)'; }
  el.style.background = 'rgba(255,255,255,0.5)';
  if (tipo === 'conforme') {
    if (btnC) { btnC.style.background = 'var(--color-green)'; btnC.style.color = 'white'; }
    el.style.background = 'rgba(143,155,114,0.12)';
  } else if (tipo === 'nao_conforme') {
    if (btnN) { btnN.style.background = 'var(--color-red)'; btnN.style.color = 'white'; }
    el.style.background = 'rgba(192,122,108,0.12)';
  }
}

function _atualizarContadores() {
  const mapa = {};
  AUDITORIA_ESTRUTURA.forEach(sec => {
    sec.itens.forEach(item => {
      if (!mapa[sec.area]) mapa[sec.area] = { total: 0, conf: 0 };
      mapa[sec.area].total++;
      if (_state.respostas[item.id] === 'conforme') mapa[sec.area].conf++;
    });
  });
  for (const [area, c] of Object.entries(mapa)) {
    const elC = document.querySelector(`.aud-area-conf[data-area="${area}"]`);
    const elT = document.querySelector(`.aud-area-total[data-area="${area}"]`);
    if (elC) elC.textContent = `${c.conf} ✅`;
    if (elT) elT.textContent = `${c.total} itens`;
  }
}

function _atualizarResumoNCs() {
  const resumo = document.getElementById('aud-nc-resumo');
  const lista = document.getElementById('aud-nc-lista');
  const count = document.getElementById('aud-nc-count');
  const ncs = _state.naoConformidades;
  const ids = Object.keys(ncs);
  if (!resumo || !lista) return;
  if (ids.length === 0) { resumo.style.display = 'none'; return; }
  resumo.style.display = '';
  if (count) count.textContent = ids.length;
  const ic = { baixa: '🟢', media: '🟡', alta: '🔴' };
  lista.innerHTML = ids.map(id => {
    const nc = ncs[id];
    let label = id;
    for (const sec of AUDITORIA_ESTRUTURA) {
      const f = sec.itens.find(i => i.id === id);
      if (f) { label = `${sec.subarea} → ${f.label}`; break; }
    }
    return `<div style="padding:0.75rem 1rem; border-radius:var(--border-radius-sm); border:1px solid var(--card-border); margin-bottom:0.5rem; background:rgba(192,122,108,0.08);">
      <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
        <span>${ic[nc.criticidade] || '⚠️'}</span>
        <strong style="font-size:0.9rem;">${label}</strong>
        ${nc.gerarOS ? '<span style="font-size:0.75rem; background:var(--color-blue); color:white; border-radius:10px; padding:1px 7px;">OS</span>' : ''}
      </div>
      <p style="color:var(--text-secondary); font-size:0.82rem; margin-top:0.3rem;">${nc.descricao}</p>
    </div>`;
  }).join('');
}

function _calcularResultado() {
  const ncs = Object.values(_state.naoConformidades);
  if (ncs.filter(n => n.criticidade === 'alta').length > 0 || ncs.length >= 4) return 'reprovado';
  if (ncs.length > 0) return 'ressalvas';
  return 'aprovado';
}

function _atualizarResultado() {
  const res = _calcularResultado();
  const cores = { aprovado: 'var(--color-green)', ressalvas: 'var(--color-orange)', reprovado: 'var(--color-red)' };
  document.querySelectorAll('.resultado-opcao').forEach(el => {
    const r = el.dataset.resultado;
    if (r === res) {
      el.style.opacity = '1'; el.style.borderColor = cores[r]; el.style.boxShadow = `0 0 0 2px ${cores[r]}40`;
    } else {
      el.style.opacity = '0.35'; el.style.borderColor = 'var(--card-border)'; el.style.boxShadow = 'none';
    }
  });
}

// ─── MODAL NC ─────────────────────────────────────────────────────────────────

function _abrirNC(itemId) {
  _ncItemIdPendente = itemId;
  let label = itemId;
  for (const sec of AUDITORIA_ESTRUTURA) {
    const f = sec.itens.find(i => i.id === itemId);
    if (f) { label = `${sec.icone} ${sec.subarea} → ${f.label}`; break; }
  }
  document.getElementById('aud-nc-label').textContent = label;
  document.getElementById('aud-nc-descricao').value = '';
  document.getElementById('aud-nc-acao').value = '';
  document.getElementById('aud-nc-gerar-os').checked = false;
  document.querySelectorAll('input[name="aud-nc-criticidade"]').forEach(r => r.checked = false);
  document.getElementById('aud-nc-foto-input').value = '';
  document.getElementById('aud-nc-foto-preview').style.display = 'none';
  document.getElementById('aud-nc-foto-drop').style.display = '';
  window._audFotoBase64 = null;
  const nc = _state.naoConformidades[itemId];
  if (nc) {
    document.getElementById('aud-nc-descricao').value = nc.descricao || '';
    document.getElementById('aud-nc-acao').value = nc.acao || '';
    document.getElementById('aud-nc-gerar-os').checked = !!nc.gerarOS;
    const radio = document.querySelector(`input[name="aud-nc-criticidade"][value="${nc.criticidade}"]`);
    if (radio) radio.checked = true;
    if (nc.foto) {
      window._audFotoBase64 = nc.foto;
      document.getElementById('aud-nc-foto-img').src = nc.foto;
      document.getElementById('aud-nc-foto-preview').style.display = '';
      document.getElementById('aud-nc-foto-drop').style.display = 'none';
    }
  }
  const modal = document.getElementById('aud-modal-nc');
  if (modal) { modal.style.display = 'flex'; }
}

function _fecharNC() {
  const modal = document.getElementById('aud-modal-nc');
  if (modal) modal.style.display = 'none';
  if (_ncItemIdPendente && !_state.naoConformidades[_ncItemIdPendente]) {
    delete _state.respostas[_ncItemIdPendente];
    _visualizarItem(_ncItemIdPendente, null);
    _atualizarResultado();
    _atualizarContadores();
  }
  _ncItemIdPendente = null;
}

function _salvarNC() {
  if (!_ncItemIdPendente) return;
  const descricao = document.getElementById('aud-nc-descricao').value.trim();
  const acao = document.getElementById('aud-nc-acao').value.trim();
  const radio = document.querySelector('input[name="aud-nc-criticidade"]:checked');
  const gerarOS = document.getElementById('aud-nc-gerar-os').checked;
  if (!descricao) { _toast('Informe a descrição da ocorrência.', 'error'); return; }
  if (!window._audFotoBase64) { _toast('A foto é obrigatória para não conformidades.', 'error'); return; }
  if (!radio) { _toast('Selecione o grau de criticidade.', 'error'); return; }
  if (!acao) { _toast('Informe a ação corretiva imediata.', 'error'); return; }
  _state.naoConformidades[_ncItemIdPendente] = { descricao, foto: window._audFotoBase64, criticidade: radio.value, acao, gerarOS };
  const modal = document.getElementById('aud-modal-nc');
  if (modal) modal.style.display = 'none';
  _ncItemIdPendente = null;
  _atualizarResumoNCs();
  _atualizarResultado();
  _toast('Não conformidade registrada.', 'success');
}

function _processarFoto(file) {
  const reader = new FileReader();
  reader.onload = e => {
    window._audFotoBase64 = e.target.result;
    const img = document.getElementById('aud-nc-foto-img');
    if (img) img.src = e.target.result;
    document.getElementById('aud-nc-foto-preview').style.display = '';
    document.getElementById('aud-nc-foto-drop').style.display = 'none';
  };
  reader.readAsDataURL(file);
}

// ─── CANVAS ───────────────────────────────────────────────────────────────────

function _bindCanvas() {
  const canvas = document.getElementById('aud-assinatura-canvas');
  if (!canvas) return;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = canvas.offsetWidth * ratio;
  canvas.height = canvas.offsetHeight * ratio;
  const ctx = canvas.getContext('2d');
  ctx.scale(ratio, ratio);
  ctx.strokeStyle = '#4b433c'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  let desenhando = false;
  function pos(e) {
    const r = canvas.getBoundingClientRect();
    if (e.touches) return { x: e.touches[0].clientX - r.left, y: e.touches[0].clientY - r.top };
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  canvas.addEventListener('mousedown', e => { e.preventDefault(); desenhando = true; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); });
  canvas.addEventListener('mousemove', e => { if (!desenhando) return; e.preventDefault(); const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); _marcarAssinatura(); });
  canvas.addEventListener('mouseup', () => { desenhando = false; _salvarAssinatura(canvas); });
  canvas.addEventListener('mouseleave', () => { desenhando = false; _salvarAssinatura(canvas); });
  canvas.addEventListener('touchstart', e => { e.preventDefault(); desenhando = true; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); }, { passive: false });
  canvas.addEventListener('touchmove', e => { if (!desenhando) return; e.preventDefault(); const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); _marcarAssinatura(); }, { passive: false });
  canvas.addEventListener('touchend', () => { desenhando = false; _salvarAssinatura(canvas); });
  document.getElementById('aud-btn-limpar-assinatura')?.addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    _state.assinatura = null;
    const st = document.getElementById('aud-assinatura-status');
    if (st) { st.textContent = 'Área de assinatura vazia'; st.style.color = 'var(--text-muted)'; }
  });
}

function _marcarAssinatura() {
  const st = document.getElementById('aud-assinatura-status');
  if (st) { st.textContent = 'Assinatura capturada ✅'; st.style.color = 'var(--color-green)'; }
}

function _salvarAssinatura(canvas) {
  _state.assinatura = canvas.toDataURL('image/png');
}

// ─── FINALIZAR ────────────────────────────────────────────────────────────────

function _finalizar() {
  const turno = document.getElementById('aud-turno')?.value;
  const auditor = document.getElementById('aud-auditor')?.value.trim();
  if (!turno) { _toast('Selecione o turno.', 'error'); return; }
  if (!auditor) { _toast('Informe o nome do auditor.', 'error'); return; }
  const total = AUDITORIA_ESTRUTURA.reduce((acc, sec) => acc + sec.itens.length, 0);
  const avaliados = Object.keys(_state.respostas).length;
  if (avaliados < total) {
    if (!confirm(`Ainda há ${total - avaliados} item(ns) sem avaliação. Deseja finalizar mesmo assim?`)) return;
  }
  if (!_state.assinatura) {
    if (!confirm('A assinatura digital não foi capturada. Deseja finalizar sem assinatura?')) return;
  }
  const resultado = _calcularResultado();
  const agora = new Date();
  const registro = {
    id: `AUD-${Date.now()}`,
    dataHora: agora.toLocaleString('pt-BR'),
    data: agora.toLocaleDateString('pt-BR'),
    hora: agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    turno, auditor, unidade: 'YUKA',
    respostas: { ..._state.respostas },
    naoConformidades: { ..._state.naoConformidades },
    observacoes: document.getElementById('aud-observacoes')?.value || '',
    resultado,
    assinatura: _state.assinatura,
  };
  _state.historico.push(registro);
  try { localStorage.setItem('auditoria_historico_yuka', JSON.stringify(_state.historico)); } catch(e) {}
  _enviarSheets(registro);
  const labels = { aprovado: '✅ Aprovado', ressalvas: '⚠️ Aprovado com Ressalvas', reprovado: '❌ Reprovado' };
  _toast(`Auditoria registrada! Resultado: ${labels[resultado]}`, 'success', 5000);
  _state.respostas = {};
  _state.naoConformidades = {};
  _state.assinatura = null;
  _state.historicoAberto = false;
  _renderTudo();
}

// ─── MODAL VER ────────────────────────────────────────────────────────────────

function _abrirVer(auditoria) {
  const modal = document.getElementById('aud-modal-ver');
  const cont = document.getElementById('aud-modal-ver-conteudo');
  if (!modal || !cont) return;
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

// ─── SHEETS ───────────────────────────────────────────────────────────────────

async function _enviarSheets(registro) {
  try {
    await fetch(APPS_SCRIPT_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(registro) });
  } catch(e) { console.error('Erro ao enviar para Sheets:', e); }
}

// ─── TOAST ────────────────────────────────────────────────────────────────────

function _toast(msg, tipo = 'info', duracao = 3500) {
  const cores = { success: 'var(--color-green)', error: 'var(--color-red)', info: 'var(--color-blue)', warning: 'var(--color-orange)' };
  const toast = document.createElement('div');
  toast.style.cssText = `position:fixed; bottom:1.5rem; right:1.5rem; z-index:99999; background:var(--card-bg); border:1px solid ${cores[tipo]}; border-left:4px solid ${cores[tipo]}; border-radius:var(--border-radius-md); padding:0.9rem 1.25rem; box-shadow:0 8px 24px rgba(0,0,0,0.12); max-width:360px; font-family:var(--font-main); font-size:0.9rem; color:var(--text-primary);`;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), duracao);
}
