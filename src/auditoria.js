// =============================================================================
// MÓDULO: AUDITORIA DE HIGIENIZAÇÃO ESTRUTURAL - YUKA
// Mamma Mia Control - By Thalita Campos - Processos e Automações
// =============================================================================

// ─── ESTRUTURA DE CHECKLIST ───────────────────────────────────────────────────

const AUDITORIA_ESTRUTURA = [
  {
    id: 'producao_pisos',
    area: 'Área de Produção',
    subarea: 'Pisos',
    icone: '🏭',
    itens: [
      { id: 'piso_limpo', label: 'Piso limpo' },
      { id: 'piso_sem_residuos', label: 'Sem resíduos' },
      { id: 'piso_sem_agua', label: 'Sem acúmulo de água' },
    ]
  },
  {
    id: 'producao_estruturas',
    area: 'Área de Produção',
    subarea: 'Estruturas',
    icone: '🏗️',
    itens: [
      { id: 'est_paredes', label: 'Paredes' },
      { id: 'est_rodapes', label: 'Rodapés' },
      { id: 'est_porta_vaivem', label: 'Porta Vai e Vem' },
      { id: 'est_porta_elevador', label: 'Porta do Elevador' },
      { id: 'est_janelas', label: 'Janelas' },
      { id: 'est_vidros', label: 'Vidros' },
      { id: 'est_batentes', label: 'Batentes' },
      { id: 'est_interruptores', label: 'Interruptores' },
      { id: 'est_macanetas', label: 'Maçanetas' },
    ]
  },
  {
    id: 'producao_lixeiras',
    area: 'Área de Produção',
    subarea: 'Lixeiras',
    icone: '🗑️',
    itens: [
      { id: 'lix_higienizadas', label: 'Higienizadas' },
      { id: 'lix_saco_novo', label: 'Com saco novo' },
      { id: 'lix_fechadas', label: 'Fechadas corretamente' },
    ]
  },
  {
    id: 'producao_dispenser',
    area: 'Área de Produção',
    subarea: 'Dispenser',
    icone: '🧴',
    itens: [
      { id: 'disp_sabonete', label: 'Sabonete abastecido' },
      { id: 'disp_papel', label: 'Papel toalha abastecido' },
      { id: 'disp_alcool', label: 'Álcool disponível' },
    ]
  },
  {
    id: 'dml',
    area: 'DML',
    subarea: 'Depósito de Material de Limpeza',
    icone: '🧹',
    itens: [
      { id: 'dml_organizado', label: 'Ambiente organizado' },
      { id: 'dml_identificados', label: 'Produtos identificados' },
      { id: 'dml_armazenados', label: 'Materiais armazenados corretamente' },
      { id: 'dml_baldes', label: 'Baldes limpos' },
      { id: 'dml_rodos', label: 'Rodos organizados' },
      { id: 'dml_vassouras', label: 'Vassouras organizadas' },
      { id: 'dml_panos', label: 'Panos separados corretamente' },
    ]
  },
  {
    id: 'sanitarios',
    area: 'Sanitários',
    subarea: 'Sanitários',
    icone: '🚻',
    itens: [
      { id: 'san_piso', label: 'Piso' },
      { id: 'san_sanitarios', label: 'Sanitários' },
      { id: 'san_pia', label: 'Pia' },
      { id: 'san_espelhos', label: 'Espelhos' },
      { id: 'san_dispenser', label: 'Dispenser' },
      { id: 'san_lixeiras', label: 'Lixeiras' },
      { id: 'san_organizacao', label: 'Organização geral' },
    ]
  },
  {
    id: 'area_externa',
    area: 'Área Externa',
    subarea: 'Área Externa',
    icone: '🏢',
    itens: [
      { id: 'ext_entrada', label: 'Entrada' },
      { id: 'ext_calcada', label: 'Calçada' },
      { id: 'ext_circulacao', label: 'Área de circulação' },
      { id: 'ext_lixeira', label: 'Lixeira externa' },
      { id: 'ext_carga_descarga', label: 'Área de carga e descarga' },
    ]
  },
  {
    id: 'corredores',
    area: 'Corredores e Áreas Comuns',
    subarea: 'Corredores e Áreas Comuns',
    icone: '🚶',
    itens: [
      { id: 'cor_piso', label: 'Piso' },
      { id: 'cor_portas', label: 'Portas' },
      { id: 'cor_corrimaos', label: 'Corrimãos (quando houver)' },
      { id: 'cor_organizacao', label: 'Organização' },
      { id: 'cor_limpeza', label: 'Limpeza geral' },
    ]
  },
];

// ─── STATE ────────────────────────────────────────────────────────────────────

let auditoriaState = {
  respostas: {},       // itemId -> 'conforme' | 'nao_conforme' | null
  naoConformidades: {}, // itemId -> { descricao, foto (base64), criticidade, acao, gerarOS }
  assinatura: null,    // base64 da assinatura digital
  dadosHeader: {
    turno: '',
    auditor: '',
  },
  historico: [],       // auditorias salvas no localStorage
  modoVisualizacao: false, // true quando abre histórico
};

// ─── INICIALIZAÇÃO ────────────────────────────────────────────────────────────

export function initAuditoria() {
  const container = document.getElementById('tab-content-auditoria');
  if (container) container.innerHTML = '';
  carregarHistorico();
  auditoriaState.respostas = {};
  auditoriaState.naoConformidades = {};
  auditoriaState.assinatura = null;
  
  // Garantir que sempre abre no formulário, nunca no histórico
  const secHist = document.getElementById('auditoria-historico-section');
  const secForm = document.getElementById('auditoria-formulario-section');
  if (secHist) secHist.style.display = 'none';
  if (secForm) secForm.style.display = '';
  renderTabAuditoria();
}

function carregarHistorico() {
  try {
    const salvo = localStorage.getItem('auditoria_historico_yuka');
    if (salvo) auditoriaState.historico = JSON.parse(salvo);
  } catch (e) {
    auditoriaState.historico = [];
  }
}

function salvarHistorico() {
  try {
    localStorage.setItem('auditoria_historico_yuka', JSON.stringify(auditoriaState.historico));
  } catch (e) {
    console.error('Erro ao salvar histórico de auditorias:', e);
  }
}

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyxTb1JgVX5o8_jD6xKXocb_tJb7lPQdo5c5aN9woB7es4FUthUcsQabYrZJ7est3cp/exec';

async function enviarParaSheets(registro) {
  try {
    await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(registro)
    });
  } catch (err) {
    console.error('Erro ao enviar auditoria para Sheets:', err);
  }
}

// ─── RENDER PRINCIPAL ─────────────────────────────────────────────────────────

function renderTabAuditoria() {
  const container = document.getElementById('tab-content-auditoria');
  if (!container) return;

  const agora = new Date();
  const dataFormatada = agora.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  const horaFormatada = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  container.innerHTML = `
    <!-- HEADER DA AUDITORIA -->
    <div class="panel-card" style="margin-bottom:1.5rem; border-left: 4px solid var(--color-green);">
      <div class="panel-header" style="flex-wrap:wrap; gap:1rem;">
        <div>
          <h2 style="font-size:1.3rem; display:flex; align-items:center; gap:0.5rem;">
            🧼 Auditoria de Higienização Estrutural
          </h2>
          <p style="color:var(--text-muted); font-size:0.85rem; margin-top:0.25rem;">
            Unidade YUKA · ${dataFormatada} · ${horaFormatada}
          </p>
          <p style="color:var(--color-orange); font-size:0.8rem; margin-top:0.25rem; font-style:italic;">
            ⚠️ Este módulo não contempla higienização de equipamentos e utensílios de produção (responsabilidade dos manipuladores - POP).
          </p>
        </div>
        <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-left:auto;">
          <button id="btn-historico-auditoria" class="btn btn-secondary" type="button">
            <i data-lucide="history"></i> Histórico
          </button>
          <button id="btn-nova-auditoria" class="btn btn-primary" type="button" style="display:none;">
            <i data-lucide="plus"></i> Nova Auditoria
          </button>
        </div>
      </div>
    </div>

    <!-- HISTÓRICO (oculto por padrão) -->
    <div id="auditoria-historico-section" style="display:none;">
      ${renderHistoricoHTML()}
    </div>

    <!-- FORMULÁRIO DA AUDITORIA -->
    <div id="auditoria-formulario-section">

      <!-- DADOS DO CABEÇALHO -->
      <div class="panel-card" style="margin-bottom:1.5rem;">
        <div class="panel-header"><h3>📋 Informações da Auditoria</h3></div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-top:1rem;">
          <div class="form-group">
            <label class="form-label">Turno <span style="color:var(--color-red);">*</span></label>
            <select id="auditoria-turno" class="form-control" required>
              <option value="">Selecione o turno</option>
              <option value="Matutino">Matutino</option>
              <option value="Vespertino">Vespertino</option>
              <option value="Noturno">Noturno</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Nome do Auditor <span style="color:var(--color-red);">*</span></label>
            <input type="text" id="auditoria-auditor" class="form-control" placeholder="Nome completo do auditor" required>
          </div>
        </div>
      </div>

      <!-- CHECKLIST POR ÁREA -->
      <div id="auditoria-checklist-wrapper">
        ${renderChecklistHTML()}
      </div>

      <!-- NÃO CONFORMIDADES RESUMO -->
      <div class="panel-card" id="auditoria-nc-resumo" style="margin-bottom:1.5rem; display:none;">
        <div class="panel-header">
          <h3 style="color:var(--color-red);">⚠️ Não Conformidades Registradas</h3>
          <span id="auditoria-nc-count" style="background:var(--color-red); color:white; border-radius:20px; padding:2px 10px; font-size:0.8rem; font-weight:700;">0</span>
        </div>
        <div id="auditoria-nc-lista" style="margin-top:1rem;"></div>
      </div>

      <!-- OBSERVAÇÕES GERAIS -->
      <div class="panel-card" style="margin-bottom:1.5rem;">
        <div class="panel-header"><h3>📝 Observações Gerais</h3></div>
        <textarea id="auditoria-observacoes" class="form-control" rows="4"
          placeholder="Campo livre para registros adicionais, situações não previstas no checklist..."
          style="resize:vertical; margin-top:1rem;"></textarea>
      </div>

      <!-- RESULTADO DA AUDITORIA -->
      <div class="panel-card" style="margin-bottom:1.5rem;">
        <div class="panel-header"><h3>🏆 Resultado da Auditoria</h3></div>
        <p style="color:var(--text-muted); font-size:0.85rem; margin: 0.75rem 0;">
          Calculado automaticamente com base nos itens avaliados.
        </p>
        <div id="auditoria-resultado-display" style="display:flex; gap:1rem; flex-wrap:wrap; margin-top:1rem;">
          <div class="resultado-opcao" data-resultado="aprovado" style="flex:1; min-width:180px; padding:1.25rem; border-radius:var(--border-radius-md); border:2px solid var(--card-border); text-align:center; cursor:default; opacity:0.4; transition:all 0.3s;">
            <div style="font-size:2rem;">✅</div>
            <div style="font-weight:700; margin-top:0.5rem;">Aprovado</div>
            <div style="font-size:0.8rem; color:var(--text-muted);">0 não conformidades</div>
          </div>
          <div class="resultado-opcao" data-resultado="ressalvas" style="flex:1; min-width:180px; padding:1.25rem; border-radius:var(--border-radius-md); border:2px solid var(--card-border); text-align:center; cursor:default; opacity:0.4; transition:all 0.3s;">
            <div style="font-size:2rem;">⚠️</div>
            <div style="font-weight:700; margin-top:0.5rem;">Aprovado com Ressalvas</div>
            <div style="font-size:0.8rem; color:var(--text-muted);">1-3 não conformidades baixas/médias</div>
          </div>
          <div class="resultado-opcao" data-resultado="reprovado" style="flex:1; min-width:180px; padding:1.25rem; border-radius:var(--border-radius-md); border:2px solid var(--card-border); text-align:center; cursor:default; opacity:0.4; transition:all 0.3s;">
            <div style="font-size:2rem;">❌</div>
            <div style="font-weight:700; margin-top:0.5rem;">Reprovado</div>
            <div style="font-size:0.8rem; color:var(--text-muted);">NC alta ou 4+ não conformidades</div>
          </div>
        </div>
      </div>

      <!-- ASSINATURA DIGITAL -->
      <div class="panel-card" style="margin-bottom:1.5rem;">
        <div class="panel-header">
          <h3>✍️ Assinatura Digital do Auditor</h3>
          <button id="btn-limpar-assinatura" class="btn btn-secondary" type="button" style="font-size:0.8rem; padding:0.4rem 0.8rem;">
            <i data-lucide="eraser"></i> Limpar
          </button>
        </div>
        <p style="color:var(--text-muted); font-size:0.82rem; margin:0.75rem 0 0.5rem;">
          Assine no campo abaixo usando o mouse ou toque na tela.
        </p>
        <canvas id="auditoria-assinatura-canvas"
          style="width:100%; height:160px; border:2px dashed var(--card-border); border-radius:var(--border-radius-md); background:rgba(255,255,255,0.6); cursor:crosshair; touch-action:none; display:block;">
        </canvas>
        <p id="assinatura-status" style="color:var(--text-muted); font-size:0.78rem; margin-top:0.4rem; text-align:center;">
          Área de assinatura vazia
        </p>
      </div>

      <!-- BOTÃO FINALIZAR -->
      <div style="display:flex; justify-content:flex-end; gap:1rem; margin-bottom:2rem; flex-wrap:wrap;">
        <button id="btn-limpar-auditoria" class="btn btn-secondary" type="button">
          <i data-lucide="rotate-ccw"></i> Limpar Formulário
        </button>
        <button id="btn-finalizar-auditoria" class="btn btn-primary" type="button" style="font-size:1rem; padding:0.85rem 2rem;">
          <i data-lucide="check-circle"></i> Finalizar e Registrar Auditoria
        </button>
      </div>

    </div>

    <!-- MODAL: NÃO CONFORMIDADE -->
    ${renderModalNaoConformidadeHTML()}

    <!-- MODAL: VISUALIZAR AUDITORIA HISTÓRICO -->
    ${renderModalVisualizarAuditoriaHTML()}
  `;

  // Ativar ícones lucide nos novos elementos
  if (window.lucide) window.lucide.createIcons();

  // Garantir que abre sempre no formulário
  const secHist = document.getElementById('auditoria-historico-section');
  const secForm = document.getElementById('auditoria-formulario-section');
  const btnNova = document.getElementById('btn-nova-auditoria');
  const btnHist = document.getElementById('btn-historico-auditoria');
  if (secHist) secHist.style.display = 'none';
  if (secForm) secForm.style.display = '';
  if (btnNova) btnNova.style.display = 'none';
  if (btnHist) btnHist.innerHTML = '<i data-lucide="history"></i> Histórico';

  // Bind de eventos
  bindEventosAuditoria();
  bindAssinaturaCanvas();
  }

// ─── RENDER CHECKLIST HTML ────────────────────────────────────────────────────

function renderChecklistHTML() {
  // Agrupar por área
  const areas = {};
  AUDITORIA_ESTRUTURA.forEach(sec => {
    if (!areas[sec.area]) areas[sec.area] = [];
    areas[sec.area].push(sec);
  });

  let html = '';
  for (const [area, secoes] of Object.entries(areas)) {
    html += `
      <div class="panel-card" style="margin-bottom:1.5rem;">
        <div class="panel-header" style="margin-bottom:1rem;">
          <h3>${secoes[0].icone} ${area}</h3>
          <div style="display:flex; gap:0.5rem; font-size:0.75rem;">
            <span class="area-count-conforme" data-area="${area}" style="color:var(--color-green); font-weight:700;">0 ✅</span>
            <span style="color:var(--text-muted);">/</span>
            <span class="area-count-total" data-area="${area}" style="color:var(--text-muted);">0 itens</span>
          </div>
        </div>
        <div style="display:flex; flex-direction:column; gap:1.25rem;">
    `;

    secoes.forEach(sec => {
      if (sec.subarea !== sec.area) {
        html += `<p style="font-size:0.8rem; font-weight:700; text-transform:uppercase; color:var(--text-muted); letter-spacing:0.05em; margin-bottom:0.25rem;">${sec.subarea}</p>`;
      }
      html += `<div style="display:flex; flex-direction:column; gap:0.5rem;">`;
      sec.itens.forEach(item => {
        html += `
          <div class="auditoria-item" data-item-id="${item.id}" data-area="${area}"
               style="display:flex; align-items:center; justify-content:space-between; padding:0.75rem 1rem; background:rgba(255,255,255,0.5); border-radius:var(--border-radius-md); border:1px solid var(--card-border); gap:1rem; flex-wrap:wrap;">
            <span style="font-size:0.9rem; color:var(--text-primary); flex:1;">${item.label}</span>
            <div style="display:flex; gap:0.5rem; flex-shrink:0;">
              <button class="btn-check conforme" data-item="${item.id}" type="button"
                style="padding:0.4rem 0.9rem; border-radius:var(--border-radius-sm); border:2px solid var(--color-green); background:transparent; color:var(--color-green); font-size:0.8rem; font-weight:700; cursor:pointer; transition:all 0.2s;">
                ✅ Conforme
              </button>
              <button class="btn-check nao-conforme" data-item="${item.id}" type="button"
                style="padding:0.4rem 0.9rem; border-radius:var(--border-radius-sm); border:2px solid var(--color-red); background:transparent; color:var(--color-red); font-size:0.8rem; font-weight:700; cursor:pointer; transition:all 0.2s;">
                ❌ N/C
              </button>
            </div>
          </div>
        `;
      });
      html += `</div>`;
    });

    html += `</div></div>`;
  }

  return html;
}

// ─── RENDER MODAL NÃO CONFORMIDADE ────────────────────────────────────────────

function renderModalNaoConformidadeHTML() {
  return `
    <div id="modal-nc-auditoria" class="modal-overlay" style="display:none;" aria-hidden="true" role="dialog">
      <div class="modal-content" style="max-width:560px;">
        <div class="modal-header">
          <h3>⚠️ Registrar Não Conformidade</h3>
          <button id="btn-fechar-modal-nc" class="modal-close" type="button">&times;</button>
        </div>
        <div style="padding:0.5rem 0;">
          <p id="modal-nc-item-label" style="font-weight:600; color:var(--text-primary); margin-bottom:1.25rem; padding:0.75rem; background:rgba(192,122,108,0.1); border-radius:var(--border-radius-sm); border-left:3px solid var(--color-red);"></p>

          <div class="form-group" style="margin-bottom:1rem;">
            <label class="form-label">Descrição da ocorrência <span style="color:var(--color-red);">*</span></label>
            <textarea id="nc-descricao" class="form-control" rows="3" placeholder="Descreva o problema encontrado..." style="resize:vertical;"></textarea>
          </div>

          <div class="form-group" style="margin-bottom:1rem;">
            <label class="form-label">Foto da ocorrência <span style="color:var(--color-red);">*</span></label>
            <div id="nc-foto-drop" style="border:2px dashed var(--card-border); border-radius:var(--border-radius-md); padding:1.5rem; text-align:center; cursor:pointer; transition:all 0.2s; background:rgba(255,255,255,0.4);">
              <div style="font-size:1.5rem; margin-bottom:0.5rem;">📷</div>
              <p style="color:var(--text-muted); font-size:0.85rem;">Clique para selecionar ou arraste uma foto</p>
              <input type="file" id="nc-foto-input" accept="image/*" capture="environment" style="display:none;">
            </div>
            <div id="nc-foto-preview" style="display:none; margin-top:0.75rem; text-align:center; position:relative;">
              <img id="nc-foto-img" style="max-width:100%; max-height:200px; border-radius:var(--border-radius-md); border:1px solid var(--card-border);" alt="Preview da foto">
              <button id="nc-foto-remover" type="button" style="position:absolute; top:4px; right:4px; background:var(--color-red); color:white; border:none; border-radius:50%; width:24px; height:24px; cursor:pointer; font-size:0.8rem; display:flex; align-items:center; justify-content:center;">✕</button>
            </div>
          </div>

          <div class="form-group" style="margin-bottom:1rem;">
            <label class="form-label">Grau de criticidade <span style="color:var(--color-red);">*</span></label>
            <div style="display:flex; gap:0.75rem; margin-top:0.5rem; flex-wrap:wrap;">
              <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer; padding:0.5rem 1rem; border-radius:var(--border-radius-sm); border:2px solid var(--color-green); font-weight:600; font-size:0.85rem; color:var(--color-green);">
                <input type="radio" name="nc-criticidade" value="baixa" style="accent-color:var(--color-green);"> 🟢 Baixa
              </label>
              <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer; padding:0.5rem 1rem; border-radius:var(--border-radius-sm); border:2px solid var(--color-orange); font-weight:600; font-size:0.85rem; color:var(--color-orange);">
                <input type="radio" name="nc-criticidade" value="media" style="accent-color:var(--color-orange);"> 🟡 Média
              </label>
              <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer; padding:0.5rem 1rem; border-radius:var(--border-radius-sm); border:2px solid var(--color-red); font-weight:600; font-size:0.85rem; color:var(--color-red);">
                <input type="radio" name="nc-criticidade" value="alta" style="accent-color:var(--color-red);"> 🔴 Alta
              </label>
            </div>
          </div>

          <div class="form-group" style="margin-bottom:1rem;">
            <label class="form-label">Ação corretiva imediata <span style="color:var(--color-red);">*</span></label>
            <textarea id="nc-acao" class="form-control" rows="2" placeholder="Qual ação foi ou será tomada imediatamente?" style="resize:vertical;"></textarea>
          </div>

          <div class="form-group" style="margin-bottom:1rem;">
            <label style="display:flex; align-items:center; gap:0.75rem; cursor:pointer;">
              <input type="checkbox" id="nc-gerar-os" style="width:18px; height:18px; accent-color:var(--color-blue); cursor:pointer;">
              <span style="font-weight:600; color:var(--text-primary);">🔧 Gerar Ordem de Serviço (ocorrência estrutural)</span>
            </label>
            <p style="color:var(--text-muted); font-size:0.8rem; margin-top:0.25rem; margin-left:2rem;">
              Marque quando o problema exigir reparo ou intervenção de manutenção.
            </p>
          </div>
        </div>
        <div class="modal-footer">
          <button id="btn-cancelar-nc" class="btn btn-secondary" type="button">Cancelar</button>
          <button id="btn-salvar-nc" class="btn btn-primary" type="button">Salvar Não Conformidade</button>
        </div>
      </div>
    </div>
  `;
}

// ─── RENDER MODAL VISUALIZAR AUDITORIA ────────────────────────────────────────

function renderModalVisualizarAuditoriaHTML() {
  return `
    <div id="modal-visualizar-auditoria" class="modal-overlay" style="display:none;" aria-hidden="true" role="dialog">
      <div class="modal-content" style="max-width:700px; max-height:90vh; overflow-y:auto;">
        <div class="modal-header">
          <h3>📋 Detalhes da Auditoria</h3>
          <button id="btn-fechar-modal-visualizar" class="modal-close" type="button">&times;</button>
        </div>
        <div id="modal-visualizar-conteudo"></div>
        <div class="modal-footer">
          <button id="btn-imprimir-auditoria" class="btn btn-secondary" type="button">
            <i data-lucide="printer"></i> Imprimir
          </button>
          <button id="btn-fechar-modal-visualizar-footer" class="btn btn-primary" type="button">Fechar</button>
        </div>
      </div>
    </div>
  `;
}

// ─── RENDER HISTÓRICO ─────────────────────────────────────────────────────────

function renderHistoricoHTML() {
  if (auditoriaState.historico.length === 0) {
    return `
      <div class="panel-card" style="text-align:center; padding:3rem 1rem; margin-bottom:1.5rem;">
        <div style="font-size:3rem; margin-bottom:1rem;">📋</div>
        <h3 style="color:var(--text-muted);">Nenhuma auditoria registrada ainda</h3>
        <p style="color:var(--text-muted); font-size:0.85rem; margin-top:0.5rem;">
          Preencha e finalize a auditoria para que ela apareça aqui.
        </p>
      </div>
    `;
  }

  const historico = [...auditoriaState.historico].reverse();

  let rows = historico.map(a => {
    const resultadoIcon = { aprovado: '✅', ressalvas: '⚠️', reprovado: '❌' }[a.resultado] || '—';
    const ncCount = Object.keys(a.naoConformidades || {}).length;
    const ncAltas = Object.values(a.naoConformidades || {}).filter(nc => nc.criticidade === 'alta').length;
    return `
      <tr>
        <td>${a.dataHora || '—'}</td>
        <td>${a.turno || '—'}</td>
        <td>${a.auditor || '—'}</td>
        <td style="text-align:center;">${ncCount} ${ncAltas > 0 ? `<span style="color:var(--color-red);font-size:0.75rem;">(${ncAltas} alta${ncAltas > 1 ? 's' : ''})</span>` : ''}</td>
        <td style="text-align:center; font-size:1.1rem;">${resultadoIcon}</td>
        <td style="text-align:center;">
          <button class="btn btn-secondary btn-visualizar-auditoria" data-id="${a.id}"
            style="padding:0.3rem 0.7rem; font-size:0.8rem;">
            <i data-lucide="eye" style="width:14px;height:14px;"></i> Ver
          </button>
        </td>
      </tr>
    `;
  }).join('');

  return `
    <div class="panel-card" style="margin-bottom:1.5rem;">
      <div class="panel-header" style="margin-bottom:1rem;">
        <h3>📋 Histórico de Auditorias - YUKA</h3>
        <span style="color:var(--text-muted); font-size:0.85rem;">${historico.length} registros</span>
      </div>
      <div style="overflow-x:auto;">
        <table class="modern-table">
          <thead>
            <tr>
              <th>Data/Hora</th>
              <th>Turno</th>
              <th>Auditor</th>
              <th style="text-align:center;">Não Conformidades</th>
              <th style="text-align:center;">Resultado</th>
              <th style="text-align:center;">Ações</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
}

// ─── BIND EVENTOS ─────────────────────────────────────────────────────────────

function bindEventosAuditoria() {

  // Botões conforme / não conforme
  document.querySelectorAll('.btn-check').forEach(btn => {
    btn.addEventListener('click', () => {
      const itemId = btn.dataset.item;
      const tipo = btn.classList.contains('conforme') ? 'conforme' : 'nao_conforme';
      handleCheckItem(itemId, tipo, btn);
    });
  });

  // Histórico toggle
  const btnHistorico = document.getElementById('btn-historico-auditoria');
  if (btnHistorico) {
    btnHistorico.addEventListener('click', () => {
      const secHist = document.getElementById('auditoria-historico-section');
      const secForm = document.getElementById('auditoria-formulario-section');
      const btnNova = document.getElementById('btn-nova-auditoria');
      const visivel = secHist.style.display !== 'none';
      if (visivel) {
        secHist.style.display = 'none';
        secForm.style.display = '';
        btnNova.style.display = 'none';
        btnHistorico.innerHTML = '<i data-lucide="history"></i> Histórico';
      } else {
        secHist.innerHTML = renderHistoricoHTML();
        secHist.style.display = '';
        secForm.style.display = 'none';
        btnNova.style.display = '';
        btnHistorico.innerHTML = '<i data-lucide="x"></i> Fechar Histórico';
        bindBotoesHistorico();
        if (window.lucide) window.lucide.createIcons();
      }
    });
  }

  // Botão nova auditoria
  const btnNova = document.getElementById('btn-nova-auditoria');
  if (btnNova) {
    btnNova.addEventListener('click', () => {
      document.getElementById('auditoria-historico-section').style.display = 'none';
      document.getElementById('auditoria-formulario-section').style.display = '';
      btnNova.style.display = 'none';
      document.getElementById('btn-historico-auditoria').innerHTML = '<i data-lucide="history"></i> Histórico';
      if (window.lucide) window.lucide.createIcons();
    });
  }

  // Fechar modal NC
  document.getElementById('btn-fechar-modal-nc')?.addEventListener('click', fecharModalNC);
  document.getElementById('btn-cancelar-nc')?.addEventListener('click', fecharModalNC);

  // Salvar NC
  document.getElementById('btn-salvar-nc')?.addEventListener('click', salvarNaoConformidade);

  // Foto NC
  const fotoDrop = document.getElementById('nc-foto-drop');
  const fotoInput = document.getElementById('nc-foto-input');
  if (fotoDrop && fotoInput) {
    fotoDrop.addEventListener('click', () => fotoInput.click());
    fotoDrop.addEventListener('dragover', e => { e.preventDefault(); fotoDrop.style.borderColor = 'var(--color-blue)'; });
    fotoDrop.addEventListener('dragleave', () => { fotoDrop.style.borderColor = 'var(--card-border)'; });
    fotoDrop.addEventListener('drop', e => {
      e.preventDefault();
      fotoDrop.style.borderColor = 'var(--card-border)';
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) processarFotoNC(file);
    });
    fotoInput.addEventListener('change', e => {
      const file = e.target.files[0];
      if (file) processarFotoNC(file);
    });
  }

  // Remover foto
  document.getElementById('nc-foto-remover')?.addEventListener('click', () => {
    document.getElementById('nc-foto-input').value = '';
    document.getElementById('nc-foto-preview').style.display = 'none';
    document.getElementById('nc-foto-drop').style.display = '';
    window._ncFotoBase64 = null;
  });

  // Limpar formulário
  document.getElementById('btn-limpar-auditoria')?.addEventListener('click', () => {
    if (confirm('Tem certeza que deseja limpar todo o formulário? Os dados não salvos serão perdidos.')) {
      auditoriaState.respostas = {};
      auditoriaState.naoConformidades = {};
      auditoriaState.assinatura = null;
      renderTabAuditoria();
      showToastAuditoria('Formulário limpo.', 'info');
    }
  });

  // Finalizar auditoria
  document.getElementById('btn-finalizar-auditoria')?.addEventListener('click', finalizarAuditoria);

  // Fechar modal visualizar
  document.getElementById('btn-fechar-modal-visualizar')?.addEventListener('click', fecharModalVisualizar);
  document.getElementById('btn-fechar-modal-visualizar-footer')?.addEventListener('click', fecharModalVisualizar);
  document.getElementById('btn-imprimir-auditoria')?.addEventListener('click', () => window.print());
}

function bindBotoesHistorico() {
  document.querySelectorAll('.btn-visualizar-auditoria').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const auditoria = auditoriaState.historico.find(a => a.id === id);
      if (auditoria) abrirModalVisualizar(auditoria);
    });
  });
}

// ─── LÓGICA DE CHECAGEM ────────────────────────────────────────────────────────

let _ncItemIdPendente = null;

function handleCheckItem(itemId, tipo, btn) {
  const jaEra = auditoriaState.respostas[itemId];

  // Toggle: clicar no mesmo botão desmarca
  if (jaEra === tipo) {
    delete auditoriaState.respostas[itemId];
    delete auditoriaState.naoConformidades[itemId];
    atualizarVisualizacaoItem(itemId, null);
    atualizarResultado();
    atualizarContadoresArea();
    return;
  }

  auditoriaState.respostas[itemId] = tipo;

  if (tipo === 'nao_conforme') {
    // Remove NC anterior se estava conforme
    delete auditoriaState.naoConformidades[itemId];
    abrirModalNC(itemId);
  } else {
    // Era nao_conforme antes → remove NC
    delete auditoriaState.naoConformidades[itemId];
  }

  atualizarVisualizacaoItem(itemId, tipo);
  atualizarResultado();
  atualizarContadoresArea();
  atualizarResumoNCs();
}

function atualizarVisualizacaoItem(itemId, tipo) {
  const itemEl = document.querySelector(`.auditoria-item[data-item-id="${itemId}"]`);
  if (!itemEl) return;

  const btnConf = itemEl.querySelector('.btn-check.conforme');
  const btnNC = itemEl.querySelector('.btn-check.nao-conforme');

  // Reset
  if (btnConf) { btnConf.style.background = 'transparent'; btnConf.style.color = 'var(--color-green)'; }
  if (btnNC) { btnNC.style.background = 'transparent'; btnNC.style.color = 'var(--color-red)'; }
  itemEl.style.background = 'rgba(255,255,255,0.5)';

  if (tipo === 'conforme') {
    if (btnConf) { btnConf.style.background = 'var(--color-green)'; btnConf.style.color = 'white'; }
    itemEl.style.background = 'rgba(143,155,114,0.12)';
  } else if (tipo === 'nao_conforme') {
    if (btnNC) { btnNC.style.background = 'var(--color-red)'; btnNC.style.color = 'white'; }
    itemEl.style.background = 'rgba(192,122,108,0.12)';
  }
}

function atualizarContadoresArea() {
  const areaMap = {};
  AUDITORIA_ESTRUTURA.forEach(sec => {
    sec.itens.forEach(item => {
      if (!areaMap[sec.area]) areaMap[sec.area] = { total: 0, conforme: 0 };
      areaMap[sec.area].total++;
      if (auditoriaState.respostas[item.id] === 'conforme') areaMap[sec.area].conforme++;
    });
  });

  for (const [area, counts] of Object.entries(areaMap)) {
    const elConf = document.querySelector(`.area-count-conforme[data-area="${area}"]`);
    const elTotal = document.querySelector(`.area-count-total[data-area="${area}"]`);
    if (elConf) elConf.textContent = `${counts.conforme} ✅`;
    if (elTotal) elTotal.textContent = `${counts.total} itens`;
  }
}

// ─── MODAL NC ─────────────────────────────────────────────────────────────────

function abrirModalNC(itemId) {
  _ncItemIdPendente = itemId;

  // Buscar label do item
  let label = itemId;
  for (const sec of AUDITORIA_ESTRUTURA) {
    const found = sec.itens.find(i => i.id === itemId);
    if (found) { label = `${sec.icone} ${sec.subarea} → ${found.label}`; break; }
  }

  const modal = document.getElementById('modal-nc-auditoria');
  if (!modal) return;

  // Resetar campos
  document.getElementById('modal-nc-item-label').textContent = label;
  document.getElementById('nc-descricao').value = '';
  document.getElementById('nc-acao').value = '';
  document.getElementById('nc-gerar-os').checked = false;
  document.querySelectorAll('input[name="nc-criticidade"]').forEach(r => r.checked = false);
  document.getElementById('nc-foto-input').value = '';
  document.getElementById('nc-foto-preview').style.display = 'none';
  document.getElementById('nc-foto-drop').style.display = '';
  window._ncFotoBase64 = null;

  // Pre-preencher se já existia NC
  const nc = auditoriaState.naoConformidades[itemId];
  if (nc) {
    document.getElementById('nc-descricao').value = nc.descricao || '';
    document.getElementById('nc-acao').value = nc.acao || '';
    document.getElementById('nc-gerar-os').checked = !!nc.gerarOS;
    const radio = document.querySelector(`input[name="nc-criticidade"][value="${nc.criticidade}"]`);
    if (radio) radio.checked = true;
    if (nc.foto) {
      window._ncFotoBase64 = nc.foto;
      document.getElementById('nc-foto-img').src = nc.foto;
      document.getElementById('nc-foto-preview').style.display = '';
      document.getElementById('nc-foto-drop').style.display = 'none';
    }
  }

  modal.style.display = 'flex';
  modal.setAttribute('aria-hidden', 'false');
}

function fecharModalNC() {
  const modal = document.getElementById('modal-nc-auditoria');
  if (modal) { modal.style.display = 'none'; modal.setAttribute('aria-hidden', 'true'); }

  // Se fechou sem salvar e o item não tinha NC anterior → volta para null
  if (_ncItemIdPendente && !auditoriaState.naoConformidades[_ncItemIdPendente]) {
    delete auditoriaState.respostas[_ncItemIdPendente];
    atualizarVisualizacaoItem(_ncItemIdPendente, null);
    atualizarResultado();
    atualizarContadoresArea();
  }
  _ncItemIdPendente = null;
}

function salvarNaoConformidade() {
  if (!_ncItemIdPendente) return;

  const descricao = document.getElementById('nc-descricao').value.trim();
  const acao = document.getElementById('nc-acao').value.trim();
  const criticidadeRadio = document.querySelector('input[name="nc-criticidade"]:checked');
  const gerarOS = document.getElementById('nc-gerar-os').checked;

  if (!descricao) { showToastAuditoria('Informe a descrição da ocorrência.', 'error'); return; }
  if (!window._ncFotoBase64) { showToastAuditoria('A foto é obrigatória para não conformidades.', 'error'); return; }
  if (!criticidadeRadio) { showToastAuditoria('Selecione o grau de criticidade.', 'error'); return; }
  if (!acao) { showToastAuditoria('Informe a ação corretiva imediata.', 'error'); return; }

  auditoriaState.naoConformidades[_ncItemIdPendente] = {
    descricao,
    foto: window._ncFotoBase64,
    criticidade: criticidadeRadio.value,
    acao,
    gerarOS,
  };

  fecharModalNC();
  atualizarResumoNCs();
  atualizarResultado();
  showToastAuditoria('Não conformidade registrada.', 'success');
  _ncItemIdPendente = null;
}

function processarFotoNC(file) {
  const reader = new FileReader();
  reader.onload = e => {
    window._ncFotoBase64 = e.target.result;
    const img = document.getElementById('nc-foto-img');
    const preview = document.getElementById('nc-foto-preview');
    const drop = document.getElementById('nc-foto-drop');
    if (img) img.src = e.target.result;
    if (preview) preview.style.display = '';
    if (drop) drop.style.display = 'none';
  };
  reader.readAsDataURL(file);
}

// ─── RESUMO NCs ───────────────────────────────────────────────────────────────

function atualizarResumoNCs() {
  const resumo = document.getElementById('auditoria-nc-resumo');
  const lista = document.getElementById('auditoria-nc-lista');
  const count = document.getElementById('auditoria-nc-count');
  const ncs = auditoriaState.naoConformidades;
  const ids = Object.keys(ncs);

  if (!resumo || !lista) return;

  if (ids.length === 0) {
    resumo.style.display = 'none';
    return;
  }

  resumo.style.display = '';
  if (count) count.textContent = ids.length;

  const critIcone = { baixa: '🟢', media: '🟡', alta: '🔴' };
  lista.innerHTML = ids.map(itemId => {
    const nc = ncs[itemId];
    let label = itemId;
    for (const sec of AUDITORIA_ESTRUTURA) {
      const found = sec.itens.find(i => i.id === itemId);
      if (found) { label = `${sec.subarea} → ${found.label}`; break; }
    }
    return `
      <div style="padding:0.75rem 1rem; border-radius:var(--border-radius-sm); border:1px solid var(--card-border); margin-bottom:0.5rem; background:rgba(192,122,108,0.08);">
        <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
          <span>${critIcone[nc.criticidade] || '⚠️'}</span>
          <strong style="font-size:0.9rem;">${label}</strong>
          ${nc.gerarOS ? '<span style="font-size:0.75rem; background:var(--color-blue); color:white; border-radius:10px; padding:1px 7px;">OS</span>' : ''}
        </div>
        <p style="color:var(--text-secondary); font-size:0.82rem; margin-top:0.3rem;">${nc.descricao}</p>
      </div>
    `;
  }).join('');
}

// ─── RESULTADO AUTOMÁTICO ─────────────────────────────────────────────────────

function calcularResultado() {
  const ncs = Object.values(auditoriaState.naoConformidades);
  const ncAltas = ncs.filter(nc => nc.criticidade === 'alta').length;
  if (ncAltas > 0 || ncs.length >= 4) return 'reprovado';
  if (ncs.length > 0) return 'ressalvas';
  return 'aprovado';
}

function atualizarResultado() {
  const resultado = calcularResultado();
  const opcoes = document.querySelectorAll('.resultado-opcao');
  const corMap = { aprovado: 'var(--color-green)', ressalvas: 'var(--color-orange)', reprovado: 'var(--color-red)' };

  opcoes.forEach(el => {
    const r = el.dataset.resultado;
    if (r === resultado) {
      el.style.opacity = '1';
      el.style.borderColor = corMap[r];
      el.style.background = `rgba(0,0,0,0.04)`;
      el.style.boxShadow = `0 0 0 2px ${corMap[r]}40`;
    } else {
      el.style.opacity = '0.35';
      el.style.borderColor = 'var(--card-border)';
      el.style.background = 'transparent';
      el.style.boxShadow = 'none';
    }
  });

  return resultado;
}

// ─── ASSINATURA CANVAS ────────────────────────────────────────────────────────

function bindAssinaturaCanvas() {
  const canvas = document.getElementById('auditoria-assinatura-canvas');
  if (!canvas) return;

  // Ajustar tamanho real do canvas ao tamanho CSS
  function resizeCanvas() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    const ctx = canvas.getContext('2d');
    ctx.scale(ratio, ratio);
  }
  resizeCanvas();

  const ctx = canvas.getContext('2d');
  ctx.strokeStyle = '#4b433c';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  let desenhandoAssinatura = false;
  let temAssinatura = false;

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    if (e.touches) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function iniciar(e) {
    e.preventDefault();
    desenhandoAssinatura = true;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }

  function desenhar(e) {
    if (!desenhandoAssinatura) return;
    e.preventDefault();
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    temAssinatura = true;
    document.getElementById('assinatura-status').textContent = 'Assinatura capturada ✅';
    document.getElementById('assinatura-status').style.color = 'var(--color-green)';
  }

  function parar() {
    if (desenhandoAssinatura) {
      desenhandoAssinatura = false;
      auditoriaState.assinatura = canvas.toDataURL('image/png');
    }
  }

  canvas.addEventListener('mousedown', iniciar);
  canvas.addEventListener('mousemove', desenhar);
  canvas.addEventListener('mouseup', parar);
  canvas.addEventListener('mouseleave', parar);
  canvas.addEventListener('touchstart', iniciar, { passive: false });
  canvas.addEventListener('touchmove', desenhar, { passive: false });
  canvas.addEventListener('touchend', parar);

  // Limpar assinatura
  document.getElementById('btn-limpar-assinatura')?.addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    auditoriaState.assinatura = null;
    temAssinatura = false;
    document.getElementById('assinatura-status').textContent = 'Área de assinatura vazia';
    document.getElementById('assinatura-status').style.color = 'var(--text-muted)';
  });
}

// ─── FINALIZAR AUDITORIA ──────────────────────────────────────────────────────

function finalizarAuditoria() {
  const turno = document.getElementById('auditoria-turno').value;
  const auditor = document.getElementById('auditoria-auditor').value.trim();

  if (!turno) { showToastAuditoria('Selecione o turno.', 'error'); return; }
  if (!auditor) { showToastAuditoria('Informe o nome do auditor.', 'error'); return; }

  // Verificar se todos os itens foram avaliados
  const totalItens = AUDITORIA_ESTRUTURA.reduce((acc, sec) => acc + sec.itens.length, 0);
  const avaliados = Object.keys(auditoriaState.respostas).length;

  if (avaliados < totalItens) {
    const restantes = totalItens - avaliados;
    if (!confirm(`Ainda há ${restantes} item(ns) sem avaliação. Deseja finalizar mesmo assim?`)) return;
  }

  if (!auditoriaState.assinatura) {
    if (!confirm('A assinatura digital não foi capturada. Deseja finalizar sem assinatura?')) return;
  }

  const resultado = calcularResultado();
  const agora = new Date();
  const dataHora = agora.toLocaleString('pt-BR');

  const registro = {
    id: `AUD-${Date.now()}`,
    dataHora,
    data: agora.toLocaleDateString('pt-BR'),
    hora: agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    turno,
    auditor,
    unidade: 'YUKA',
    respostas: { ...auditoriaState.respostas },
    naoConformidades: { ...auditoriaState.naoConformidades },
    observacoes: document.getElementById('auditoria-observacoes')?.value || '',
    resultado,
    assinatura: auditoriaState.assinatura,
  };

  auditoriaState.historico.push(registro);
  salvarHistorico();
  enviarParaSheets(registro);

  // Limpar estado
  auditoriaState.respostas = {};
  auditoriaState.naoConformidades = {};
  auditoriaState.assinatura = null;

  // Mostrar confirmação
  const resultadoLabel = { aprovado: '✅ Aprovado', ressalvas: '⚠️ Aprovado com Ressalvas', reprovado: '❌ Reprovado' }[resultado];
  showToastAuditoria(`Auditoria registrada com sucesso! Resultado: ${resultadoLabel}`, 'success', 5000);

  // Mostrar no histórico
  setTimeout(() => {
    document.getElementById('btn-historico-auditoria')?.click();
    document.getElementById('btn-historico-auditoria')?.click(); // toggle para abrir
  }, 300);

  renderTabAuditoria();
}

// ─── MODAL VISUALIZAR AUDITORIA ────────────────────────────────────────────────

function abrirModalVisualizar(auditoria) {
  const modal = document.getElementById('modal-visualizar-auditoria');
  const conteudo = document.getElementById('modal-visualizar-conteudo');
  if (!modal || !conteudo) return;

  const resultadoLabel = { aprovado: '✅ Aprovado', ressalvas: '⚠️ Aprovado com Ressalvas', reprovado: '❌ Reprovado' }[auditoria.resultado] || '—';
  const ncs = auditoria.naoConformidades || {};
  const ncIds = Object.keys(ncs);
  const critIcone = { baixa: '🟢', media: '🟡', alta: '🔴' };

  let ncsHTML = '';
  if (ncIds.length === 0) {
    ncsHTML = '<p style="color:var(--color-green);">Nenhuma não conformidade registrada.</p>';
  } else {
    ncsHTML = ncIds.map(itemId => {
      const nc = ncs[itemId];
      let label = itemId;
      for (const sec of AUDITORIA_ESTRUTURA) {
        const found = sec.itens.find(i => i.id === itemId);
        if (found) { label = `${sec.subarea} → ${found.label}`; break; }
      }
      return `
        <div style="border:1px solid var(--card-border); border-radius:var(--border-radius-sm); padding:0.75rem; margin-bottom:0.75rem; background:rgba(192,122,108,0.06);">
          <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.4rem; flex-wrap:wrap;">
            <span>${critIcone[nc.criticidade] || '⚠️'}</span>
            <strong>${label}</strong>
            ${nc.gerarOS ? '<span style="background:var(--color-blue);color:white;font-size:0.72rem;border-radius:10px;padding:1px 7px;">OS Gerada</span>' : ''}
          </div>
          <p style="font-size:0.85rem; color:var(--text-secondary);"><strong>Ocorrência:</strong> ${nc.descricao}</p>
          <p style="font-size:0.85rem; color:var(--text-secondary);"><strong>Ação corretiva:</strong> ${nc.acao}</p>
          ${nc.foto ? `<img src="${nc.foto}" style="max-width:100%; max-height:180px; border-radius:var(--border-radius-sm); margin-top:0.5rem; border:1px solid var(--card-border);" alt="Foto da NC">` : ''}
        </div>
      `;
    }).join('');
  }

  conteudo.innerHTML = `
    <div style="padding:0.5rem 0;">
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; margin-bottom:1.5rem;">
        <div><strong>Unidade:</strong> ${auditoria.unidade || 'YUKA'}</div>
        <div><strong>Data/Hora:</strong> ${auditoria.dataHora}</div>
        <div><strong>Turno:</strong> ${auditoria.turno}</div>
        <div><strong>Auditor:</strong> ${auditoria.auditor}</div>
        <div><strong>Resultado:</strong> ${resultadoLabel}</div>
        <div><strong>Não Conformidades:</strong> ${ncIds.length}</div>
      </div>

      ${auditoria.observacoes ? `<div style="margin-bottom:1.5rem;"><strong>Observações:</strong><p style="margin-top:0.4rem;color:var(--text-secondary);">${auditoria.observacoes}</p></div>` : ''}

      <div style="margin-bottom:1.5rem;">
        <h4 style="margin-bottom:0.75rem;">⚠️ Não Conformidades</h4>
        ${ncsHTML}
      </div>

      ${auditoria.assinatura ? `
        <div>
          <h4 style="margin-bottom:0.5rem;">✍️ Assinatura do Auditor</h4>
          <img src="${auditoria.assinatura}" style="max-width:100%; border:1px solid var(--card-border); border-radius:var(--border-radius-sm); background:white; padding:0.5rem;" alt="Assinatura">
        </div>
      ` : ''}
    </div>
  `;

  modal.style.display = 'flex';
  modal.setAttribute('aria-hidden', 'false');
}

function fecharModalVisualizar() {
  const modal = document.getElementById('modal-visualizar-auditoria');
  if (modal) { modal.style.display = 'none'; modal.setAttribute('aria-hidden', 'true'); }
}

// ─── TOAST ────────────────────────────────────────────────────────────────────

function showToastAuditoria(msg, tipo = 'info', duracao = 3500) {
  // Reutiliza o container de toast já existente no sistema
  const container = document.getElementById('toast-container-v2') || document.body;
  const toast = document.createElement('div');
  const cores = { success: 'var(--color-green)', error: 'var(--color-red)', info: 'var(--color-blue)', warning: 'var(--color-orange)' };
  toast.style.cssText = `
    position:fixed; bottom:1.5rem; right:1.5rem; z-index:99999;
    background:var(--card-bg); border:1px solid ${cores[tipo] || cores.info};
    border-left:4px solid ${cores[tipo] || cores.info};
    border-radius:var(--border-radius-md); padding:0.9rem 1.25rem;
    box-shadow:0 8px 24px rgba(0,0,0,0.12); max-width:360px;
    font-family:var(--font-main); font-size:0.9rem; color:var(--text-primary);
    animation:fadeIn 0.25s ease;
  `;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), duracao);
}
