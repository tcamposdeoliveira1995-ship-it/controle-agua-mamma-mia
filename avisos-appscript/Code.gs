/**
 * PROJETO ÚNICO: registro de água via Telegram + mural de Avisos +
 * registro de Caminhão Pipa + Higienização de Motores + Kanban de
 * atividades (com cards diários gerados sozinhos a partir de Rotinas
 * cadastradas), todos vindos do Painel Qualidade
 * (painel-qualidade-appscript). Moram no mesmo projeto Apps Script
 * porque só existe 1 link (/exec) e 1 doPost por projeto — mesmo motivo
 * que já juntava água+avisos aqui antes. Ver
 * docs/superpowers/specs/2026-09-23-painel-qualidade-pipa-higienizacao-design.md
 * e docs/superpowers/specs/2026-10-01-painel-qualidade-kanban-design.md
 * no repo controle-agua-mamma-mia.
 *
 * O registro de água NÃO usa webhook do Telegram (ver "TELEGRAM VIA
 * POLLING" mais abaixo, e o motivo da troca) — então hoje o doPost
 * atende Avisos ({acao: "criar"|"editar"|"remover"}), Pipa
 * ({acao: "criar_pipa", ...}), Higienização de Motores
 * ({acao: "criar_higienizacao", ...}), Kanban ({acao: "criar_card"|
 * "editar_card"|"mover_card"|"excluir_card", ...}) e Rotinas — só o
 * CADASTRO do modelo ({acao: "criar_rotina"|"editar_rotina"|
 * "excluir_rotina", ...}); o card do dia em si é gerado sozinho dentro
 * de listarCards(), não por uma ação de doPost.
 *
 * planilhaId aponta pra planilha de água — é onde a aba "Respostas ao
 * formulário 1" (leituras), a aba "AVISOS" (mural) e a aba de Pipa
 * (mesma planilha, achada pelo gid) vivem. Higienização de Motores é
 * uma planilha DIFERENTE (HIGIENIZACAO_PLANILHA_ID abaixo), aberta à
 * parte pelo ID.
 */

// ================= CONFIG =================
function getConfig() {
  var props = PropertiesService.getScriptProperties();

  return {
    telegramToken: props.getProperty("TELEGRAM_TOKEN"),
    chatId: props.getProperty("TELEGRAM_CHAT_ID"),
    planilhaId: "1tixTJ74aaEo-EuCfTFl-efWOT7p-TIgN0su8NzX8aKw",
    nomeAba: "Respostas ao formulário 1",
    // Meta de consumo do ciclo, em m³, POR RELÓGIO (não somada entre os
    // 4) — configurável via Propriedades do Script (META_INDIVIDUAL_M3)
    // sem precisar mexer em código; 20 é só o valor padrão de hoje.
    metaIndividualM3: Number(props.getProperty("META_INDIVIDUAL_M3")) || 20,
    // Dia do mês em que o ciclo de faturamento começa (ex: 6 = todo dia
    // 6, até o dia 5 do mês seguinte). Também configurável via
    // Propriedade do Script.
    diaInicioCiclo: Number(props.getProperty("DIA_INICIO_CICLO")) || 6
  };
}

// ================= TELEGRAM =================
function enviarTelegram(msg) {
  var c = getConfig();

  var url = "https://api.telegram.org/bot" + c.telegramToken + "/sendMessage";

  UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({
      chat_id: c.chatId,
      text: msg
    })
  });
}

// ================= CONVERSÃO NUMÉRICA =================
function converterNumero(valor) {
  if (typeof valor === "string") {
    valor = valor.replace(/\./g, "").replace(",", ".");
  }
  return parseFloat(valor);
}

// ================= CONTROLE DE ALERTA =================
// Garante no máximo UM aviso de "já registrado hoje" por relógio por
// dia, não importa quantas vezes o doPost rodar de novo pra essa mesma
// leitura (reenvio do Telegram, fila represada, o que for) — em vez de
// tentar prever/bloquear cada motivo possível de reprocessamento, essa
// trava garante direto o que importa: a pessoa nunca vê o mesmo aviso
// duas vezes no mesmo dia. PropertiesService não expira sozinho, então
// a chave "vira" página sozinha no dia seguinte (chave inclui a data).
function jaEnviouHoje(relogio) {
  var props = PropertiesService.getScriptProperties();
  var hoje = Utilities.formatDate(new Date(), "GMT-3", "yyyy-MM-dd");
  var chave = "alerta_" + relogio + "_" + hoje;

  return props.getProperty(chave);
}

function marcarComoEnviado(relogio) {
  var props = PropertiesService.getScriptProperties();
  var hoje = Utilities.formatDate(new Date(), "GMT-3", "yyyy-MM-dd");
  var chave = "alerta_" + relogio + "_" + hoje;

  props.setProperty(chave, "true");
}

// (A trava contra reenvio de webhook — update_id em Cache/Properties —
// foi removida junto com o webhook em si; ver seção "TELEGRAM VIA
// POLLING" mais abaixo. getUpdates com offset correto nunca reentrega
// a mesma atualização duas vezes, então não precisa mais dessa trava.)

// ================= CICLO DE CONSUMO (alertas de 20/40/60/80%/meta) =================
// O ciclo de faturamento não é mês corrente — começa no dia
// c.diaInicioCiclo (hoje, dia 6) e vai até o dia anterior ao próximo
// início (dia 5). Ex: hoje é dia 15 → ciclo começou dia 6 deste mês.
// Hoje é dia 5 → ciclo começou dia 6 do mês PASSADO (ainda não virou).
function calcularInicioCiclo(dataReferencia, diaInicioCiclo) {
  var ano = dataReferencia.getFullYear();
  var mes = dataReferencia.getMonth();
  var dia = dataReferencia.getDate();
  if (dia >= diaInicioCiclo) {
    return new Date(ano, mes, diaInicioCiclo);
  }
  return new Date(ano, mes - 1, diaInicioCiclo);
}

// Consumo acumulado do relógio DENTRO do ciclo atual = leitura de agora
// menos a leitura "de referência" do início do ciclo. Essa referência é
// a última leitura registrada ANTES do início do ciclo (o valor do
// hidrômetro no fechamento do ciclo anterior); se o relógio não tem
// nenhuma leitura anterior a isso (ciclo novo em folha, sem histórico),
// usa a primeira leitura já dentro do ciclo — e o consumo começa em 0
// nessa primeira leitura, já que não dá pra saber o consumo antes dela.
function calcularConsumoCiclo(dados, colRelogio, colData, inicioCiclo, leituraAtual) {
  var baseline = null;

  for (var i = dados.length - 1; i >= 1; i--) {
    var celData = dados[i][colData - 1];
    var valor = dados[i][colRelogio - 1];
    if (!celData || valor === "" || valor == null) continue;
    if (new Date(celData) < inicioCiclo) {
      baseline = converterNumero(valor);
      break;
    }
  }

  if (baseline === null) {
    for (var j = 1; j < dados.length; j++) {
      var celData2 = dados[j][colData - 1];
      var valor2 = dados[j][colRelogio - 1];
      if (!celData2 || valor2 === "" || valor2 == null) continue;
      if (new Date(celData2) >= inicioCiclo) {
        baseline = converterNumero(valor2);
        break;
      }
    }
  }

  if (baseline === null) baseline = leituraAtual; // primeiríssima leitura desse relógio

  return leituraAtual - baseline;
}

// Compara o % do ciclo contra o maior limiar já alertado (guardado por
// relógio + data de início do ciclo, pra zerar sozinho quando o ciclo
// virar) e devolve o NOVO limiar cruzado (20/40/60/80/100) — ou null se
// nenhum limiar novo foi cruzado ainda. Evita alertar 20% de novo toda
// vez que o consumo segue subindo depois de já ter passado dos 20%.
function verificarLimiarCiclo(relogio, inicioCiclo, percentual) {
  var props = PropertiesService.getScriptProperties();
  var chave = "limiar_" + relogio + "_" + Utilities.formatDate(inicioCiclo, "GMT-3", "yyyy-MM-dd");
  var limiares = [100, 80, 60, 40, 20];
  var ultimoAlertado = Number(props.getProperty(chave)) || 0;

  for (var i = 0; i < limiares.length; i++) {
    if (percentual >= limiares[i] && limiares[i] > ultimoAlertado) {
      props.setProperty(chave, String(limiares[i]));
      return limiares[i];
    }
  }
  return null;
}

// ================= REGISTRO DE LEITURA (webhook do Telegram) =================
// A aba (Respostas ao formulário 1) tem 1 LINHA POR DIA, com 1 COLUNA
// por relógio (cabeçalho = o próprio código do relógio, ex:
// "Y21T156506") — não é 1 linha por leitura. Então "RELOGIO VALOR"
// funciona assim: acha (ou cria) a linha de hoje, e preenche a coluna
// daquele relógio nela. Duas leituras de relógios diferentes no mesmo
// dia caem na mesma linha, cada uma na sua coluna.
// Aceita uma ou várias linhas na mesma mensagem — "RELOGIO VALOR" por
// linha (ex: os 4 relógios de uma vez, um por linha). Cada linha é
// tratada de forma independente (erro numa não trava as outras), e no
// final manda 1 mensagem só, resumindo o que aconteceu com cada uma.
function processarRegistroTelegram(dadosTelegram) {
  var c = getConfig();
  var msg = dadosTelegram.message.text;

  var linhas = msg.split("\n")
    .map(function (linha) { return linha.trim(); })
    .filter(function (linha) { return linha; });

  if (linhas.length === 0) {
    enviarTelegram("❌ Envie no formato:\nRELOGIO VALOR\n(pode mandar vários, um por linha)");
    return;
  }

  var planilha = SpreadsheetApp.openById(c.planilhaId);
  var sheet = planilha.getSheetByName(c.nomeAba);
  var mapa = mapaColunas(sheet);
  var colData = colunaObrigatoria(mapa, c.nomeAba, "Carimbo de data/hora");

  var dados = sheet.getDataRange().getValues();
  var agora = new Date();
  var hoje = Utilities.formatDate(agora, "GMT-3", "dd/MM/yyyy");
  var inicioCiclo = calcularInicioCiclo(agora, c.diaInicioCiclo);

  // Acha a linha de hoje uma vez só — se nenhuma leitura desta mensagem
  // precisar criar linha nova, essa variável nunca é usada pra isso.
  var linhaHoje = -1;
  for (var i = dados.length - 1; i >= 1; i--) {
    var celData = dados[i][colData - 1];
    if (!celData) continue;
    var dataFormatada = Utilities.formatDate(new Date(celData), "GMT-3", "dd/MM/yyyy");
    if (dataFormatada === hoje) {
      linhaHoje = i + 1; // +1 porque getRange é 1-based
      break;
    }
  }

  var resultados = [];

  linhas.forEach(function (linha) {
    var partes = linha.split(" ").filter(function (p) { return p; });
    if (partes.length < 2) {
      resultados.push("❓ \"" + linha + "\" — formato inválido, esperado RELOGIO VALOR");
      return;
    }

    var relogio = partes[0];
    var leituraAtual = converterNumero(partes[1]);
    var colRelogio = mapa[relogio.toUpperCase()];

    if (!colRelogio) {
      resultados.push("❌ " + relogio + " — relógio não encontrado nos cabeçalhos da aba");
      return;
    }

    // 🔒 já tem valor nessa coluna, na linha de hoje?
    if (linhaHoje !== -1) {
      var valorExistente = dados[linhaHoje - 1][colRelogio - 1];
      if (valorExistente !== "" && valorExistente != null) {
        // Só avisa a PRIMEIRA vez que isso acontece nesse relógio nesse
        // dia — reprocessamentos seguintes (reenvio do Telegram, etc.)
        // ficam mudos, pra nunca repetir o mesmo aviso pra quem recebe.
        if (!jaEnviouHoje(relogio)) {
          resultados.push("⚠️ " + relogio + " — já registrado hoje");
          marcarComoEnviado(relogio);
        }
        return;
      }
    }

    // 🔍 última leitura desse relógio (linha anterior com valor na mesma coluna)
    var ultimaLeitura = 0;
    for (var j = dados.length - 1; j >= 1; j--) {
      var valor = dados[j][colRelogio - 1];
      if (valor !== "" && valor != null) {
        ultimaLeitura = converterNumero(valor);
        break;
      }
    }
    var consumo = leituraAtual - ultimaLeitura;

    // 💾 salva — preenche a linha de hoje (criando se ainda não existir)
    if (linhaHoje === -1) {
      var novaLinha = new Array(sheet.getLastColumn()).fill("");
      novaLinha[colData - 1] = new Date();
      sheet.appendRow(novaLinha);
      linhaHoje = sheet.getLastRow();
      dados.push(novaLinha);
    }
    sheet.getRange(linhaHoje, colRelogio).setValue(leituraAtual);
    dados[linhaHoje - 1][colRelogio - 1] = leituraAtual; // reflete no snapshot em memória, pra "última leitura" das próximas linhas desta mesma mensagem já enxergar isto se repetido

    resultados.push("✅ " + relogio + " — " + ultimaLeitura + " → " + leituraAtual + " (consumo " + consumo + ")");

    // 📊 alerta de 20/40/60/80%/meta atingida do ciclo (do dia diaInicioCiclo até o próximo)
    var consumoCiclo = calcularConsumoCiclo(dados, colRelogio, colData, inicioCiclo, leituraAtual);
    var percentualCiclo = (consumoCiclo / c.metaIndividualM3) * 100;
    var limiarCruzado = verificarLimiarCiclo(relogio, inicioCiclo, percentualCiclo);
    if (limiarCruzado) {
      var dataInicioTexto = Utilities.formatDate(inicioCiclo, "GMT-3", "dd/MM");
      if (limiarCruzado >= 100) {
        resultados.push(
          "🚨 " + relogio + " — META DO CICLO ATINGIDA: " + consumoCiclo.toFixed(1) +
          "m³ de " + c.metaIndividualM3 + "m³ (ciclo desde " + dataInicioTexto + ")"
        );
      } else {
        resultados.push(
          "⚠️ " + relogio + " — " + limiarCruzado + "% da meta do ciclo (" +
          consumoCiclo.toFixed(1) + "m³ de " + c.metaIndividualM3 + "m³, desde " + dataInicioTexto + ")"
        );
      }
    }
  });

  // Todas as linhas foram "já registrado hoje" repetido (já avisado antes
  // hoje) — fica mudo em vez de mandar uma mensagem vazia ou reavisar.
  if (resultados.length === 0) return;

  enviarTelegram(resultados.join("\n"));
}

// ================= AVISOS (mural de post-its do painel) =================
// Aba AVISOS, na mesma planilha de água (colunas: ID | TEXTO |
// CRIADO_EM | ATUALIZADO_EM). Editar/criar/remover chamado direto do
// painel (mammamia-control.vercel.app) via fetch nesse mesmo /exec.

var ABA_AVISOS = "AVISOS";

function mapaColunas(sheet) {
  var cabecalhos = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var mapa = {};
  for (var i = 0; i < cabecalhos.length; i++) {
    var nome = (cabecalhos[i] || "").toString().trim().toUpperCase();
    if (nome) mapa[nome] = i + 1;
  }
  return mapa;
}

function colunaObrigatoria(mapa, nomeAba, nomeColuna) {
  var indice = mapa[nomeColuna.toUpperCase()];
  if (!indice) {
    throw new Error(
      'Coluna "' + nomeColuna + '" não encontrada na aba "' + nomeAba + '". ' +
      "Verifique se o cabeçalho na linha 1 não foi alterado ou removido."
    );
  }
  return indice;
}

function obterAbaAvisos() {
  var aba = SpreadsheetApp.openById(getConfig().planilhaId).getSheetByName(ABA_AVISOS);
  if (!aba) {
    throw new Error('Aba "' + ABA_AVISOS + '" não foi encontrada na planilha.');
  }
  return aba;
}

function respostaJson(objeto) {
  return ContentService
    .createTextOutput(JSON.stringify(objeto))
    .setMimeType(ContentService.MimeType.JSON);
}

function listarAvisos() {
  var aba = obterAbaAvisos();
  var mapa = mapaColunas(aba);
  var colId = colunaObrigatoria(mapa, ABA_AVISOS, "ID");
  var colTexto = colunaObrigatoria(mapa, ABA_AVISOS, "TEXTO");

  var dados = aba.getDataRange().getValues();
  var avisos = [];
  for (var i = 1; i < dados.length; i++) {
    var texto = (dados[i][colTexto - 1] || "").toString().trim();
    if (!texto) continue;
    avisos.push({
      id: (dados[i][colId - 1] || "").toString().trim(),
      texto: texto,
    });
  }
  return { ok: true, avisos: avisos };
}

function criarAviso(texto) {
  texto = (texto || "").toString().trim();
  if (!texto) throw new Error("Digite o texto do aviso.");

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var aba = obterAbaAvisos();
    var mapa = mapaColunas(aba);
    var colId = colunaObrigatoria(mapa, ABA_AVISOS, "ID");
    var colTexto = colunaObrigatoria(mapa, ABA_AVISOS, "TEXTO");
    var colCriado = mapa["CRIADO_EM"];

    var id = Utilities.getUuid();
    var linha = new Array(aba.getLastColumn()).fill("");
    linha[colId - 1] = id;
    linha[colTexto - 1] = texto;
    if (colCriado) linha[colCriado - 1] = new Date();
    aba.appendRow(linha);

    return { ok: true, id: id };
  } finally {
    lock.releaseLock();
  }
}

function editarAviso(id, texto) {
  id = (id || "").toString().trim();
  texto = (texto || "").toString().trim();
  if (!id) throw new Error("Aviso não identificado.");
  if (!texto) throw new Error("Digite o texto do aviso.");

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var aba = obterAbaAvisos();
    var mapa = mapaColunas(aba);
    var colId = colunaObrigatoria(mapa, ABA_AVISOS, "ID");
    var colTexto = colunaObrigatoria(mapa, ABA_AVISOS, "TEXTO");
    var colAtualizado = mapa["ATUALIZADO_EM"];

    var dados = aba.getDataRange().getValues();
    for (var i = 1; i < dados.length; i++) {
      if ((dados[i][colId - 1] || "").toString().trim() === id) {
        aba.getRange(i + 1, colTexto).setValue(texto);
        if (colAtualizado) aba.getRange(i + 1, colAtualizado).setValue(new Date());
        return { ok: true };
      }
    }
    throw new Error("Aviso não encontrado.");
  } finally {
    lock.releaseLock();
  }
}

function removerAviso(id) {
  id = (id || "").toString().trim();
  if (!id) throw new Error("Aviso não identificado.");

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var aba = obterAbaAvisos();
    var mapa = mapaColunas(aba);
    var colId = colunaObrigatoria(mapa, ABA_AVISOS, "ID");

    var dados = aba.getDataRange().getValues();
    for (var i = dados.length - 1; i >= 1; i--) {
      if ((dados[i][colId - 1] || "").toString().trim() === id) {
        aba.deleteRow(i + 1);
        return { ok: true };
      }
    }
    throw new Error("Aviso não encontrado.");
  } finally {
    lock.releaseLock();
  }
}

// ================= PIPA (mesma planilha de água, aba achada pelo gid) =================
// Aba achada pelo ID interno (gid) em vez do nome, porque abrir por
// nome exigiria saber o texto exato da aba — o gid já é conhecido (é o
// mesmo usado no link de leitura CSV do Mamma Mia Control) e nunca
// muda mesmo que a aba seja renomeada.

var PIPA_GID = 1113385596;

function obterAbaPorGid(planilha, gid) {
  var abas = planilha.getSheets().filter(function (s) { return s.getSheetId() === gid; });
  if (abas.length === 0) {
    throw new Error("Aba (gid " + gid + ") não encontrada na planilha.");
  }
  return abas[0];
}

// Acha coluna pelo cabeçalho contendo qualquer um dos trechos dados
// (mesma lógica de match "contains" já usada na leitura do Mamma Mia
// Control) — assim não depende de saber o texto exato do cabeçalho.
function colunaPorTrecho(mapa, trechos) {
  var chaves = Object.keys(mapa);
  for (var t = 0; t < trechos.length; t++) {
    for (var i = 0; i < chaves.length; i++) {
      if (chaves[i].indexOf(trechos[t]) !== -1) return mapa[chaves[i]];
    }
  }
  return 0;
}

function registrarPipa(dados) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var planilha = SpreadsheetApp.openById(getConfig().planilhaId);
    var aba = obterAbaPorGid(planilha, PIPA_GID);
    var mapa = mapaColunas(aba);

    var colPedido = colunaPorTrecho(mapa, ["PEDIDO"]);
    var colReq = colunaPorTrecho(mapa, ["REQUISITADA", "QTD_REQ"]);
    var colRec = colunaPorTrecho(mapa, ["RECEBIDA", "QTD_REC"]);
    var colPlaca = colunaPorTrecho(mapa, ["PLACA"]);
    var colInicio = colunaPorTrecho(mapa, ["INCIO", "INICIO", "INÍCIO"]);
    var colFim = colunaPorTrecho(mapa, ["FIM"]);
    var colRecibo = colunaPorTrecho(mapa, ["RECIBO", "Nº", "NR", "NUM"]);

    if (!colPedido || !colReq || !colRec || !colPlaca || !colInicio || !colFim || !colRecibo) {
      throw new Error("Não encontrei todas as colunas esperadas na aba de Pipa. Verifique os cabeçalhos da planilha.");
    }

    var linha = new Array(aba.getLastColumn()).fill("");
    linha[colPedido - 1] = dados.pedido ? new Date(dados.pedido + "T00:00:00") : "";
    linha[colReq - 1] = dados.requisitada;
    linha[colRec - 1] = dados.recebida;
    linha[colPlaca - 1] = dados.placa;
    linha[colInicio - 1] = dados.relInicio;
    linha[colFim - 1] = dados.relFim;
    linha[colRecibo - 1] = dados.recibo;
    aba.appendRow(linha);

    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

// ================= HIGIENIZAÇÃO DE MOTORES (planilha própria) =================

var HIGIENIZACAO_PLANILHA_ID = "1whesPHLd83XkPRTWwrktJRvlfKk_CkCyxj_8ioSnk6A";
var HIGIENIZACAO_GID = 1973720702;

function registrarHigienizacao(dados) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var planilha = SpreadsheetApp.openById(HIGIENIZACAO_PLANILHA_ID);
    var aba = obterAbaPorGid(planilha, HIGIENIZACAO_GID);
    var mapa = mapaColunas(aba);

    var colTimestamp = colunaPorTrecho(mapa, ["TIMESTAMP", "CARIMBO"]);
    var colData = colunaPorTrecho(mapa, ["HIGIENIZ"]);
    var colResp = colunaPorTrecho(mapa, ["RESPONS"]);
    var colUnidade = colunaPorTrecho(mapa, ["UNIDADE"]);

    if (!colData || !colResp || !colUnidade) {
      throw new Error("Não encontrei todas as colunas esperadas na aba de Higienização. Verifique os cabeçalhos da planilha.");
    }

    var linha = new Array(aba.getLastColumn()).fill("");
    if (colTimestamp) linha[colTimestamp - 1] = new Date();
    linha[colData - 1] = dados.dataHigienizacao ? new Date(dados.dataHigienizacao + "T00:00:00") : "";
    linha[colResp - 1] = dados.responsavel;
    linha[colUnidade - 1] = dados.unidade;
    aba.appendRow(linha);

    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

// ================= KANBAN (quadro de atividades do painel) =================
// Aba KANBAN, na mesma planilha de água (colunas: ID | TITULO |
// DESCRICAO | COLUNA | ETIQUETA | ORDEM | CRIADO_EM | ATUALIZADO_EM).
// Quadro geral de atividades do dia a dia — INDEPENDENTE do Trello real
// de Ordens de Serviço (manutencao-appsscript), que continua existindo à
// parte. Colunas fixas (ver KANBAN_COLUNAS); ORDEM é a posição do card
// dentro da coluna (inteiro, não precisa ser sequencial sem buracos —
// só a ordem relativa importa pra ordenar). Ver
// docs/superpowers/specs/2026-10-01-painel-qualidade-kanban-design.md.

var ABA_KANBAN = "KANBAN";
var KANBAN_COLUNAS = ["A Fazer", "Em Andamento", "Concluído"];

function obterAbaKanban() {
  var aba = SpreadsheetApp.openById(getConfig().planilhaId).getSheetByName(ABA_KANBAN);
  if (!aba) {
    throw new Error('Aba "' + ABA_KANBAN + '" não foi encontrada na planilha.');
  }
  return aba;
}

function listarCards() {
  // Garante que os cards de rotina de hoje já existem antes de listar —
  // ver gerarCardsRotinasDoDia() na seção ROTINAS, mais abaixo.
  gerarCardsRotinasDoDia();

  var aba = obterAbaKanban();
  var mapa = mapaColunas(aba);
  var colId = colunaObrigatoria(mapa, ABA_KANBAN, "ID");
  var colTitulo = colunaObrigatoria(mapa, ABA_KANBAN, "TITULO");
  var colDescricao = colunaObrigatoria(mapa, ABA_KANBAN, "DESCRICAO");
  var colColuna = colunaObrigatoria(mapa, ABA_KANBAN, "COLUNA");
  var colEtiqueta = colunaObrigatoria(mapa, ABA_KANBAN, "ETIQUETA");
  var colOrdem = colunaObrigatoria(mapa, ABA_KANBAN, "ORDEM");
  // Opcional — ver gerarCardsRotinasDoDia(). Exposto aqui só pra o
  // front-end marcar visualmente quais cards vieram de uma rotina.
  var colRotinaId = mapa["ROTINA_ID"];

  var dados = aba.getDataRange().getValues();
  var cards = [];
  for (var i = 1; i < dados.length; i++) {
    var titulo = (dados[i][colTitulo - 1] || "").toString().trim();
    if (!titulo) continue;
    cards.push({
      id: (dados[i][colId - 1] || "").toString().trim(),
      titulo: titulo,
      descricao: (dados[i][colDescricao - 1] || "").toString().trim(),
      coluna: (dados[i][colColuna - 1] || "").toString().trim() || KANBAN_COLUNAS[0],
      etiqueta: (dados[i][colEtiqueta - 1] || "").toString().trim(),
      ordem: Number(dados[i][colOrdem - 1]) || 0,
      rotinaId: colRotinaId ? (dados[i][colRotinaId - 1] || "").toString().trim() : "",
    });
  }
  // Ordenado aqui (não confia só na ordem das linhas na planilha) — o
  // front-end já recebe pronto pra desenhar cada coluna sem reordenar.
  cards.sort(function (a, b) { return a.ordem - b.ordem; });
  return { ok: true, cards: cards };
}

function criarCard(titulo, descricao, etiqueta) {
  titulo = (titulo || "").toString().trim();
  if (!titulo) throw new Error("Digite o título do card.");

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var aba = obterAbaKanban();
    var mapa = mapaColunas(aba);
    var colId = colunaObrigatoria(mapa, ABA_KANBAN, "ID");
    var colTitulo = colunaObrigatoria(mapa, ABA_KANBAN, "TITULO");
    var colDescricao = colunaObrigatoria(mapa, ABA_KANBAN, "DESCRICAO");
    var colColuna = colunaObrigatoria(mapa, ABA_KANBAN, "COLUNA");
    var colEtiqueta = colunaObrigatoria(mapa, ABA_KANBAN, "ETIQUETA");
    var colOrdem = colunaObrigatoria(mapa, ABA_KANBAN, "ORDEM");
    var colCriado = mapa["CRIADO_EM"];

    // Novo card sempre entra no fim da 1ª coluna (A Fazer) — ordem =
    // maior ordem já usada nessa coluna + 1.
    var dados = aba.getDataRange().getValues();
    var maiorOrdem = -1;
    for (var i = 1; i < dados.length; i++) {
      if ((dados[i][colColuna - 1] || "").toString().trim() === KANBAN_COLUNAS[0]) {
        maiorOrdem = Math.max(maiorOrdem, Number(dados[i][colOrdem - 1]) || 0);
      }
    }

    var id = Utilities.getUuid();
    var linha = new Array(aba.getLastColumn()).fill("");
    linha[colId - 1] = id;
    linha[colTitulo - 1] = titulo;
    linha[colDescricao - 1] = (descricao || "").toString().trim();
    linha[colColuna - 1] = KANBAN_COLUNAS[0];
    linha[colEtiqueta - 1] = (etiqueta || "").toString().trim();
    linha[colOrdem - 1] = maiorOrdem + 1;
    if (colCriado) linha[colCriado - 1] = new Date();
    aba.appendRow(linha);

    return { ok: true, id: id };
  } finally {
    lock.releaseLock();
  }
}

function editarCard(id, titulo, descricao, etiqueta) {
  id = (id || "").toString().trim();
  titulo = (titulo || "").toString().trim();
  if (!id) throw new Error("Card não identificado.");
  if (!titulo) throw new Error("Digite o título do card.");

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var aba = obterAbaKanban();
    var mapa = mapaColunas(aba);
    var colId = colunaObrigatoria(mapa, ABA_KANBAN, "ID");
    var colTitulo = colunaObrigatoria(mapa, ABA_KANBAN, "TITULO");
    var colDescricao = colunaObrigatoria(mapa, ABA_KANBAN, "DESCRICAO");
    var colEtiqueta = colunaObrigatoria(mapa, ABA_KANBAN, "ETIQUETA");
    var colAtualizado = mapa["ATUALIZADO_EM"];

    var dados = aba.getDataRange().getValues();
    for (var i = 1; i < dados.length; i++) {
      if ((dados[i][colId - 1] || "").toString().trim() === id) {
        aba.getRange(i + 1, colTitulo).setValue(titulo);
        aba.getRange(i + 1, colDescricao).setValue((descricao || "").toString().trim());
        aba.getRange(i + 1, colEtiqueta).setValue((etiqueta || "").toString().trim());
        if (colAtualizado) aba.getRange(i + 1, colAtualizado).setValue(new Date());
        return { ok: true };
      }
    }
    throw new Error("Card não encontrado.");
  } finally {
    lock.releaseLock();
  }
}

// Move um card pra outra coluna (ou reordena dentro da mesma) — recebe a
// ORDEM FINAL INTEIRA da coluna de destino (array de IDs, na ordem que
// devem aparecer) e grava ORDEM = índice de cada um nesse array. A
// coluna de ORIGEM não precisa ser reenviada nem reordenada: os cards
// que sobraram lá mantêm seus valores de ORDEM antigos, que já bastam
// pra manter a ordem relativa entre eles (não precisa ser sequencial
// sem buracos, só a ordem relativa importa pra ordenar).
function moverCard(id, coluna, ordemIds) {
  id = (id || "").toString().trim();
  coluna = (coluna || "").toString().trim();
  if (!id) throw new Error("Card não identificado.");
  if (KANBAN_COLUNAS.indexOf(coluna) === -1) throw new Error("Coluna inválida: " + coluna);
  if (!ordemIds || !ordemIds.length) throw new Error("Ordem da coluna não informada.");

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var aba = obterAbaKanban();
    var mapa = mapaColunas(aba);
    var colId = colunaObrigatoria(mapa, ABA_KANBAN, "ID");
    var colColuna = colunaObrigatoria(mapa, ABA_KANBAN, "COLUNA");
    var colOrdem = colunaObrigatoria(mapa, ABA_KANBAN, "ORDEM");
    var colAtualizado = mapa["ATUALIZADO_EM"];

    var dados = aba.getDataRange().getValues();
    var linhaPorId = {};
    for (var i = 1; i < dados.length; i++) {
      var idLinha = (dados[i][colId - 1] || "").toString().trim();
      if (idLinha) linhaPorId[idLinha] = i + 1; // +1 porque getRange é 1-based
    }

    if (!linhaPorId[id]) throw new Error("Card não encontrado.");
    aba.getRange(linhaPorId[id], colColuna).setValue(coluna);
    if (colAtualizado) aba.getRange(linhaPorId[id], colAtualizado).setValue(new Date());

    ordemIds.forEach(function (idCard, indice) {
      var linha = linhaPorId[(idCard || "").toString().trim()];
      if (linha) aba.getRange(linha, colOrdem).setValue(indice);
    });

    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

function excluirCard(id) {
  id = (id || "").toString().trim();
  if (!id) throw new Error("Card não identificado.");

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var aba = obterAbaKanban();
    var mapa = mapaColunas(aba);
    var colId = colunaObrigatoria(mapa, ABA_KANBAN, "ID");

    var dados = aba.getDataRange().getValues();
    for (var i = dados.length - 1; i >= 1; i--) {
      if ((dados[i][colId - 1] || "").toString().trim() === id) {
        aba.deleteRow(i + 1);
        return { ok: true };
      }
    }
    throw new Error("Card não encontrado.");
  } finally {
    lock.releaseLock();
  }
}

// ================= ROTINAS (modelo das atividades do Kanban) =================
// ROTINAS: ID | TEXTO | HORARIO | ORDEM | ATIVA | CRIADO_EM | FREQUENCIA
// | DIA_SEMANA | DIA_MES | REFERENCIA_QUINZENAL — a lista fixa de
// atividades recorrentes (ex.: "Leitura da Água", "Refeitório"),
// cadastrada pela própria usuária na tela, não por mim no código.
// ATIVA=false em vez de apagar a linha (exclusão pela tela é "soft
// delete") — preserva o vínculo dos cards já gerados no Kanban (campo
// ROTINA_ID lá) que apontam pro ID dessa rotina, mesmo removida da
// lista. Cada rotina ativa é só um MODELO — quem representa "feita" ou
// não é o card de verdade no Kanban, gerado/resetado sozinho por
// gerarCardsRotinasDoDia(), logo abaixo. FREQUENCIA/DIA_SEMANA/DIA_MES/
// REFERENCIA_QUINZENAL são colunas OPCIONAIS — sem elas, toda rotina é
// DIARIA (comportamento de antes). Ver
// docs/superpowers/specs/2026-10-01-painel-qualidade-rotinas-design.md
// e docs/superpowers/specs/2026-10-05-painel-qualidade-rotinas-frequencia-design.md.

var ABA_ROTINAS = "ROTINAS";

function obterAbaRotinas() {
  var aba = SpreadsheetApp.openById(getConfig().planilhaId).getSheetByName(ABA_ROTINAS);
  if (!aba) {
    throw new Error('Aba "' + ABA_ROTINAS + '" não foi encontrada na planilha.');
  }
  return aba;
}

function hojeFormatado() {
  return Utilities.formatDate(new Date(), "GMT-3", "dd/MM/yyyy");
}

// Lê uma célula que DEVERIA ser uma data em "dd/MM/yyyy" de volta como
// essa mesma string — mesmo que o Sheets tenha convertido sozinho o
// texto escrito em Date na hora de gravar (ele faz isso com qualquer
// string que pareça uma data, mesmo escrita via appendRow/setValue, não
// só digitada à mão; "02/10/2026" bate o padrão e vira Date). Sem isso,
// comparar o texto original ("02/10/2026") com o que volta da planilha
// (um objeto Date, cujo toString() não bate com nada) nunca dá igual —
// foi exatamente o bug que gerava um card novo por rotina a cada vez
// que o Kanban era aberto, em vez de reconhecer o de hoje já existente.
function paraDataBR(valorCelula) {
  if (Object.prototype.toString.call(valorCelula) === "[object Date]") {
    return Utilities.formatDate(valorCelula, "GMT-3", "dd/MM/yyyy");
  }
  return (valorCelula || "").toString().trim();
}

// ---- Cálculo de frequência (Diária/Semanal/Quinzenal/Mensal) ----
// Ver docs/superpowers/specs/2026-10-05-painel-qualidade-rotinas-frequencia-design.md.

function somenteData_(data) {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate());
}

function parseDataBR_(dataBR) {
  var partes = (dataBR || "").split("/");
  if (partes.length !== 3) return null;
  return new Date(Number(partes[2]), Number(partes[1]) - 1, Number(partes[0]));
}

// Menor data >= apartirDe cujo dia da semana é diaSemana (0=domingo...6=sábado).
function proximaDataComDiaSemana_(apartirDe, diaSemana) {
  var d = somenteData_(apartirDe);
  for (var i = 0; i < 7; i++) {
    if (d.getDay() === diaSemana) return d;
    d.setDate(d.getDate() + 1);
  }
  return d; // nunca deveria chegar aqui (7 dias cobre a semana toda)
}

// Menor data >= apartirDe cujo dia do mês é diaMes — se o mês não tiver
// esse dia (ex.: 31 em abril), cai no último dia do mês.
function proximaDataComDiaMes_(apartirDe, diaMes) {
  var d = somenteData_(apartirDe);
  for (var i = 0; i < 62; i++) {
    var ultimoDiaDoMes = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    var diaEfetivo = Math.min(diaMes, ultimoDiaDoMes);
    if (d.getDate() === diaEfetivo) return d;
    d.setDate(d.getDate() + 1);
  }
  return d; // não deveria chegar aqui (62 dias cobre 2 meses cheios)
}

// Menor data >= apartirDe que seja a referência (1ª ocorrência,
// calculada na criação da rotina) + um múltiplo de 14 dias — nunca pula
// de 7 em 7, só de 14 em 14, a partir da âncora.
function proximaDataQuinzenal_(apartirDe, referencia) {
  var d = somenteData_(referencia);
  var alvo = somenteData_(apartirDe);
  while (d < alvo) {
    d.setDate(d.getDate() + 14);
  }
  return d;
}

// Devolve a próxima data (>= apartirDe) em que a rotina deveria gerar/
// resetar o card dela, conforme a frequência. DIARIA (ou frequência
// vazia/desconhecida — compatível com rotina antiga, de antes dessa
// coluna existir): toda data serve.
function proximaOcorrenciaRotina_(rotina, apartirDe) {
  if (rotina.frequencia === "SEMANAL") return proximaDataComDiaSemana_(apartirDe, rotina.diaSemana);
  if (rotina.frequencia === "QUINZENAL") return proximaDataQuinzenal_(apartirDe, rotina.referenciaQuinzenal || apartirDe);
  if (rotina.frequencia === "MENSAL") return proximaDataComDiaMes_(apartirDe, rotina.diaMes);
  return somenteData_(apartirDe);
}

// Lista as rotinas ativas, já ordenadas (com horário definido primeiro,
// da mais cedo pra mais tarde; sem horário, no fim, na ordem de
// criação) — usada tanto por listarRotinas() (tela de cadastro) quanto
// por gerarCardsRotinasDoDia() (geração dos cards do dia).
function listarRotinasAtivas() {
  var aba = obterAbaRotinas();
  var mapa = mapaColunas(aba);
  var colId = colunaObrigatoria(mapa, ABA_ROTINAS, "ID");
  var colTexto = colunaObrigatoria(mapa, ABA_ROTINAS, "TEXTO");
  var colOrdem = colunaObrigatoria(mapa, ABA_ROTINAS, "ORDEM");
  var colAtiva = colunaObrigatoria(mapa, ABA_ROTINAS, "ATIVA");
  // Opcional — só existe depois que a coluna HORARIO for criada na
  // planilha (ver install-instructions do Code.gs do Painel Qualidade).
  // Sem ela, toda rotina entra sem horário, sem quebrar nada.
  var colHorario = mapa["HORARIO"];
  // Opcionais também — frequência (ver proximaOcorrenciaRotina_ acima).
  // Sem essas colunas, toda rotina é tratada como DIARIA (compatível com
  // o que já existia antes dessa funcionalidade).
  var colFrequencia = mapa["FREQUENCIA"];
  var colDiaSemana = mapa["DIA_SEMANA"];
  var colDiaMes = mapa["DIA_MES"];
  var colReferenciaQuinzenal = mapa["REFERENCIA_QUINZENAL"];

  var dados = aba.getDataRange().getValues();
  var rotinas = [];
  for (var i = 1; i < dados.length; i++) {
    var texto = (dados[i][colTexto - 1] || "").toString().trim();
    if (!texto) continue;
    if (dados[i][colAtiva - 1] === false) continue; // ATIVA só é false quando explicitamente desmarcada (excluída)

    var valorDiaSemana = colDiaSemana ? dados[i][colDiaSemana - 1] : "";
    var valorDiaMes = colDiaMes ? dados[i][colDiaMes - 1] : "";
    var frequencia = colFrequencia ? (dados[i][colFrequencia - 1] || "").toString().trim().toUpperCase() : "";

    rotinas.push({
      id: (dados[i][colId - 1] || "").toString().trim(),
      texto: texto,
      horario: colHorario ? (dados[i][colHorario - 1] || "").toString().trim() : "",
      ordem: Number(dados[i][colOrdem - 1]) || 0,
      frequencia: frequencia || "DIARIA",
      diaSemana: (valorDiaSemana !== "" && valorDiaSemana != null) ? Number(valorDiaSemana) : null,
      diaMes: (valorDiaMes !== "" && valorDiaMes != null) ? Number(valorDiaMes) : null,
      referenciaQuinzenal: colReferenciaQuinzenal ? parseDataBR_(paraDataBR(dados[i][colReferenciaQuinzenal - 1])) : null,
    });
  }
  rotinas.sort(function (a, b) {
    if (a.horario && b.horario) return a.horario.localeCompare(b.horario);
    if (a.horario && !b.horario) return -1;
    if (!a.horario && b.horario) return 1;
    return a.ordem - b.ordem;
  });
  return rotinas;
}

function listarRotinas() {
  return { ok: true, rotinas: listarRotinasAtivas() };
}

var FREQUENCIAS_VALIDAS = ["DIARIA", "SEMANAL", "QUINZENAL", "MENSAL"];

function criarRotina(texto, horario, frequencia, diaSemana, diaMes) {
  texto = (texto || "").toString().trim();
  if (!texto) throw new Error("Digite o nome da rotina.");
  frequencia = (frequencia || "DIARIA").toString().trim().toUpperCase();
  if (FREQUENCIAS_VALIDAS.indexOf(frequencia) === -1) frequencia = "DIARIA";

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var aba = obterAbaRotinas();
    var mapa = mapaColunas(aba);
    var colId = colunaObrigatoria(mapa, ABA_ROTINAS, "ID");
    var colTexto = colunaObrigatoria(mapa, ABA_ROTINAS, "TEXTO");
    var colOrdem = colunaObrigatoria(mapa, ABA_ROTINAS, "ORDEM");
    var colAtiva = colunaObrigatoria(mapa, ABA_ROTINAS, "ATIVA");
    var colCriado = mapa["CRIADO_EM"];
    var colHorario = mapa["HORARIO"];
    var colFrequencia = mapa["FREQUENCIA"];
    var colDiaSemana = mapa["DIA_SEMANA"];
    var colDiaMes = mapa["DIA_MES"];
    var colReferenciaQuinzenal = mapa["REFERENCIA_QUINZENAL"];

    var dados = aba.getDataRange().getValues();
    var maiorOrdem = -1;
    for (var i = 1; i < dados.length; i++) {
      maiorOrdem = Math.max(maiorOrdem, Number(dados[i][colOrdem - 1]) || 0);
    }

    var id = Utilities.getUuid();
    var linha = new Array(aba.getLastColumn()).fill("");
    linha[colId - 1] = id;
    linha[colTexto - 1] = texto;
    linha[colOrdem - 1] = maiorOrdem + 1;
    linha[colAtiva - 1] = true;
    if (colCriado) linha[colCriado - 1] = new Date();
    if (colHorario) linha[colHorario - 1] = (horario || "").toString().trim();
    if (colFrequencia) linha[colFrequencia - 1] = frequencia;
    if (colDiaSemana && (frequencia === "SEMANAL" || frequencia === "QUINZENAL")) {
      linha[colDiaSemana - 1] = Number(diaSemana) || 0;
    }
    if (colDiaMes && frequencia === "MENSAL") {
      linha[colDiaMes - 1] = Number(diaMes) || 1;
    }
    aba.appendRow(linha);

    // Quinzenal precisa de uma data-âncora (1ª ocorrência), calculada 1
    // vez só na criação — a próxima data daquele dia da semana a partir
    // de hoje — pra saber dali em diante quais semanas contam (pula de
    // 14 em 14 dias a partir dela, nunca de 7 em 7).
    if (colReferenciaQuinzenal && frequencia === "QUINZENAL") {
      var referencia = proximaDataComDiaSemana_(new Date(), Number(diaSemana) || 0);
      aba.getRange(aba.getLastRow(), colReferenciaQuinzenal)
        .setNumberFormat("@")
        .setValue(Utilities.formatDate(referencia, "GMT-3", "dd/MM/yyyy"));
    }

    return { ok: true, id: id };
  } finally {
    lock.releaseLock();
  }
}

function editarRotina(id, texto, horario, frequencia, diaSemana, diaMes) {
  id = (id || "").toString().trim();
  texto = (texto || "").toString().trim();
  if (!id) throw new Error("Rotina não identificada.");
  if (!texto) throw new Error("Digite o nome da rotina.");
  frequencia = (frequencia || "DIARIA").toString().trim().toUpperCase();
  if (FREQUENCIAS_VALIDAS.indexOf(frequencia) === -1) frequencia = "DIARIA";

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var aba = obterAbaRotinas();
    var mapa = mapaColunas(aba);
    var colId = colunaObrigatoria(mapa, ABA_ROTINAS, "ID");
    var colTexto = colunaObrigatoria(mapa, ABA_ROTINAS, "TEXTO");
    var colHorario = mapa["HORARIO"];
    var colFrequencia = mapa["FREQUENCIA"];
    var colDiaSemana = mapa["DIA_SEMANA"];
    var colDiaMes = mapa["DIA_MES"];
    var colReferenciaQuinzenal = mapa["REFERENCIA_QUINZENAL"];

    var dados = aba.getDataRange().getValues();
    for (var i = 1; i < dados.length; i++) {
      if ((dados[i][colId - 1] || "").toString().trim() === id) {
        var linha = i + 1;
        aba.getRange(linha, colTexto).setValue(texto);
        if (colHorario) aba.getRange(linha, colHorario).setValue((horario || "").toString().trim());
        if (colFrequencia) aba.getRange(linha, colFrequencia).setValue(frequencia);
        if (colDiaSemana) {
          aba.getRange(linha, colDiaSemana).setValue(
            (frequencia === "SEMANAL" || frequencia === "QUINZENAL") ? (Number(diaSemana) || 0) : ""
          );
        }
        if (colDiaMes) {
          aba.getRange(linha, colDiaMes).setValue(frequencia === "MENSAL" ? (Number(diaMes) || 1) : "");
        }
        // Recalcula a âncora quinzenal sempre que salva como QUINZENAL
        // (mesmo se já era antes) — mais simples do que tentar detectar
        // se precisa ou não recalcular, e o efeito pra usuária é só a
        // contagem de semana reiniciar a partir de hoje quando ela edita.
        if (colReferenciaQuinzenal) {
          if (frequencia === "QUINZENAL") {
            var referencia = proximaDataComDiaSemana_(new Date(), Number(diaSemana) || 0);
            aba.getRange(linha, colReferenciaQuinzenal)
              .setNumberFormat("@")
              .setValue(Utilities.formatDate(referencia, "GMT-3", "dd/MM/yyyy"));
          } else {
            aba.getRange(linha, colReferenciaQuinzenal).setValue("");
          }
        }
        return { ok: true };
      }
    }
    throw new Error("Rotina não encontrada.");
  } finally {
    lock.releaseLock();
  }
}

// Exclusão "soft" (ATIVA=false) em vez de apagar a linha — preserva o
// vínculo dos cards já gerados no Kanban, que referenciam o ID dessa
// rotina em ROTINA_ID. Rotina excluída simplesmente para de gerar card
// novo a partir de amanhã; os cards já existentes continuam intactos.
function excluirRotina(id) {
  id = (id || "").toString().trim();
  if (!id) throw new Error("Rotina não identificada.");

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var aba = obterAbaRotinas();
    var mapa = mapaColunas(aba);
    var colId = colunaObrigatoria(mapa, ABA_ROTINAS, "ID");
    var colAtiva = colunaObrigatoria(mapa, ABA_ROTINAS, "ATIVA");

    var dados = aba.getDataRange().getValues();
    for (var i = 1; i < dados.length; i++) {
      if ((dados[i][colId - 1] || "").toString().trim() === id) {
        aba.getRange(i + 1, colAtiva).setValue(false);
        return { ok: true };
      }
    }
    throw new Error("Rotina não encontrada.");
  } finally {
    lock.releaseLock();
  }
}

// Garante que toda rotina ativa tenha HOJE o seu card em "A Fazer" no
// Kanban — chamada sempre que o Kanban é aberto (dentro de
// listarCards(), logo acima), não por nenhum gatilho/trigger agendado:
// assim não depende de configurar nada à parte, nem do script
// "acordar" sozinho um dia que a usuária não abrir o painel.
//
// IMPORTANTE — cada rotina tem NO MÁXIMO 1 card no Kanban, nunca um
// por dia: a versão anterior desta função só CRIAVA um card novo
// quando não achava um já marcado com a data de hoje, mas nunca
// "reaproveitava"/resetava os cards de dias anteriores — então toda
// rotina foi acumulando um card por dia (um em "A Fazer" sempre que a
// usuária não movia no mesmo dia, outro em "Concluído" a cada dia que
// movia), parecendo duplicação. Corrigido em 2026-10-05: agora, pra
// cada rotina, existe só 1 linha no KANBAN. Se a última vez que ela foi
// marcada (DATA_ROTINA) não é hoje, a linha é RESETADA pra "A Fazer"
// (não importa se estava em Concluído, Em Andamento, ou ainda em "A
// Fazer" de um dia anterior) e a data é atualizada pra hoje. Se já foi
// marcada hoje, não mexe — fica onde a usuária colocou. Ver
// consolidarCardsRotinaUnica() logo abaixo, que corrige de uma vez as
// linhas duplicadas que esse bug antigo já tinha criado. ROTINA_ID/
// DATA_ROTINA são colunas opcionais no KANBAN — sem elas, esta função
// simplesmente não faz nada, sem derrubar o resto do Kanban.
function gerarCardsRotinasDoDia() {
  var rotinas = listarRotinasAtivas();
  if (!rotinas.length) return;

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var aba = obterAbaKanban();
    var mapa = mapaColunas(aba);
    var colRotinaId = mapa["ROTINA_ID"];
    var colDataRotina = mapa["DATA_ROTINA"];
    if (!colRotinaId || !colDataRotina) return;

    var colId = colunaObrigatoria(mapa, ABA_KANBAN, "ID");
    var colTitulo = colunaObrigatoria(mapa, ABA_KANBAN, "TITULO");
    var colColuna = colunaObrigatoria(mapa, ABA_KANBAN, "COLUNA");
    var colOrdem = colunaObrigatoria(mapa, ABA_KANBAN, "ORDEM");
    var colCriado = mapa["CRIADO_EM"];
    var colAtualizado = mapa["ATUALIZADO_EM"];

    var hoje = hojeFormatado();
    var hojeData = somenteData_(new Date());
    var dados = aba.getDataRange().getValues();

    // Linha (1-based na planilha) da única linha existente de cada
    // rotina, se houver.
    var linhaPorRotina = {};
    var maiorOrdemAFazer = -1;
    for (var i = 1; i < dados.length; i++) {
      var rotinaIdLinha = (dados[i][colRotinaId - 1] || "").toString().trim();
      if (rotinaIdLinha) linhaPorRotina[rotinaIdLinha] = i + 1;
      if ((dados[i][colColuna - 1] || "").toString().trim() === KANBAN_COLUNAS[0]) {
        maiorOrdemAFazer = Math.max(maiorOrdemAFazer, Number(dados[i][colOrdem - 1]) || 0);
      }
    }

    rotinas.forEach(function (rotina) {
      var numLinha = linhaPorRotina[rotina.id];

      if (!numLinha) {
        // Rotina nova, nunca gerou card — só cria se hoje já é (ou já
        // passou) o dia da 1ª ocorrência dela. Uma rotina semanal/
        // quinzenal/mensal cadastrada hoje pode só aparecer no Quadro
        // dias depois, no dia certo (diária sempre cria na hora, já que
        // toda data é dia de ocorrência pra ela).
        var primeiraOcorrencia = proximaOcorrenciaRotina_(rotina, hojeData);
        if (primeiraOcorrencia > hojeData) return;

        maiorOrdemAFazer++;
        var linha = new Array(aba.getLastColumn()).fill("");
        linha[colId - 1] = Utilities.getUuid();
        linha[colTitulo - 1] = rotina.texto;
        linha[colColuna - 1] = KANBAN_COLUNAS[0];
        linha[colOrdem - 1] = maiorOrdemAFazer;
        linha[colRotinaId - 1] = rotina.id;
        linha[colDataRotina - 1] = hoje;
        if (colCriado) linha[colCriado - 1] = new Date();
        aba.appendRow(linha);
        // Força a célula de DATA_ROTINA a ficar como texto puro — sem
        // isso, o Sheets converte "02/10/2026" sozinho pra Date na hora
        // de gravar (mesmo escrito por appendRow, não só digitado à
        // mão), o que quebraria a comparação da PRÓXIMA chamada antes
        // mesmo de paraDataBR() entrar em ação.
        aba.getRange(aba.getLastRow(), colDataRotina).setNumberFormat("@").setValue(hoje);
        return;
      }

      var dataLinha = paraDataBR(dados[numLinha - 1][colDataRotina - 1]);
      if (dataLinha === hoje) return; // já tratada hoje — não mexe, fica onde a usuária colocou

      // Checa se hoje já é (ou passou) a próxima ocorrência esperada
      // depois da última vez que essa rotina foi tratada — não só "hoje
      // é exatamente o dia X", pra pegar o caso de a usuária abrir o
      // Painel um ou mais dias depois do dia certo (rotina semanal cujo
      // dia passou enquanto o Painel ficou fechado, por exemplo):
      // resetar na primeira vez que abrir depois, em vez de só no
      // próximo dia certo (que só viria na semana seguinte).
      var ultimaData = dataLinha ? parseDataBR_(dataLinha) : hojeData;
      var diaSeguinte = new Date(ultimaData.getFullYear(), ultimaData.getMonth(), ultimaData.getDate() + 1);
      var proximaOcorrencia = proximaOcorrenciaRotina_(rotina, diaSeguinte);
      if (proximaOcorrencia > hojeData) return; // ainda não chegou o dia de resetar

      // Chegou o dia (ou passou) — reseta pra "A Fazer", não importa
      // onde estava (Concluído, Em Andamento, ou ainda em "A Fazer" de
      // um dia anterior que não foi mexido).
      maiorOrdemAFazer++;
      aba.getRange(numLinha, colColuna).setValue(KANBAN_COLUNAS[0]);
      aba.getRange(numLinha, colOrdem).setValue(maiorOrdemAFazer);
      aba.getRange(numLinha, colDataRotina).setNumberFormat("@").setValue(hoje);
      if (colAtualizado) aba.getRange(numLinha, colAtualizado).setValue(new Date());
    });
  } finally {
    lock.releaseLock();
  }
}

/**
 * EXECUTAR 1 VEZ SÓ, manualmente, pelo editor do Apps Script (selecionar
 * esta função no menu "Selecionar função" e clicar em ▶ Executar) —
 * corrige o acúmulo de cards que o comportamento antigo de
 * gerarCardsRotinasDoDia() causou: ela criava uma linha NOVA toda vez
 * que não achava uma de hoje, mas nunca reaproveitava/apagava as de
 * dias anteriores, então cada rotina foi juntando um card por dia (em
 * "A Fazer" todo dia que não era movida, e mais um em "Concluído" a
 * cada dia que era) — a usuária via isso como "duplicação".
 *
 * Pra cada ROTINA_ID com mais de 1 linha, mantém só a de DATA_ROTINA
 * mais recente e apaga as outras. Não mexe em cards criados manualmente
 * (sem ROTINA_ID). Depois de rodar esta função, a abertura seguinte do
 * Kanban (gerarCardsRotinasDoDia(), já corrigida) reseta sozinha pra "A
 * Fazer" qualquer linha restante cuja data não seja hoje — não precisa
 * fazer isso aqui também. Rodar de novo não tem problema (idempotente:
 * sem linha duplicada, não apaga nada).
 */
function consolidarCardsRotinaUnica() {
  var aba = obterAbaKanban();
  var mapa = mapaColunas(aba);
  var colRotinaId = mapa["ROTINA_ID"];
  var colDataRotina = mapa["DATA_ROTINA"];
  if (!colRotinaId || !colDataRotina) {
    Logger.log("Colunas ROTINA_ID/DATA_ROTINA não encontradas na aba KANBAN — nada a consolidar.");
    return;
  }

  var dados = aba.getDataRange().getValues();
  var porRotina = {}; // rotinaId -> lista de { linha (1-based), data }
  for (var i = 1; i < dados.length; i++) {
    var rotinaIdLinha = (dados[i][colRotinaId - 1] || "").toString().trim();
    if (!rotinaIdLinha) continue;
    if (!porRotina[rotinaIdLinha]) porRotina[rotinaIdLinha] = [];
    porRotina[rotinaIdLinha].push({
      linha: i + 1,
      data: paraDataBR(dados[i][colDataRotina - 1]),
    });
  }

  var linhasParaApagar = [];
  Object.keys(porRotina).forEach(function (rotinaId) {
    var linhas = porRotina[rotinaId];
    if (linhas.length <= 1) return;
    linhas.sort(function (a, b) { return chaveOrdenavelDataBR_(b.data) - chaveOrdenavelDataBR_(a.data); });
    for (var j = 1; j < linhas.length; j++) {
      linhasParaApagar.push(linhas[j].linha);
    }
  });

  // De baixo pra cima — apagar de cima pra baixo bagunçaria os números
  // de linha dos itens seguintes da própria lista.
  linhasParaApagar.sort(function (a, b) { return b - a; });
  linhasParaApagar.forEach(function (linha) { aba.deleteRow(linha); });

  Logger.log(linhasParaApagar.length + " card(s) duplicado(s) de rotina removido(s).");
}

// "dd/MM/yyyy" -> número yyyyMMdd, só pra poder comparar/ordenar datas
// gravadas como texto. Data vazia/mal-formada conta como a mais antiga.
function chaveOrdenavelDataBR_(dataBR) {
  var partes = (dataBR || "").split("/");
  if (partes.length !== 3) return 0;
  return Number(partes[2] + partes[1] + partes[0]);
}

// ================= VALOR DAS CONTAS (por relógio, por mês) =================
// Aba VALOR CONTAS, na mesma planilha de água (cabeçalho: MES | RELOGIO
// | VALOR | | TOTAL MES — com uma coluna em branco entre VALOR e TOTAL
// MES, exatamente como a usuária já criou). Lançamento manual: a
// usuária digita o valor da conta de cada relógio quando ela chega,
// pela tela "💧 Valor das Contas" do Painel Qualidade — não é calculado
// a partir do consumo (tarifa com taxa fixa/faixa de preço não dá pra
// calcular certo só multiplicando m³ × preço). MES é sempre "MM/yyyy"
// (ex.: "10/2026") — é por competência (mês da conta), não pela data em
// que foi lançada. TOTAL MES é preenchido sozinho pelo código (soma de
// todos os relógios daquele MES), repetido em toda linha daquele mês —
// não depende de fórmula manual na planilha. Ver
// docs/superpowers/specs/2026-10-05-painel-qualidade-valor-contas-design.md.

var ABA_VALOR_CONTAS = "VALOR CONTAS";

function obterAbaValorContas() {
  var aba = SpreadsheetApp.openById(getConfig().planilhaId).getSheetByName(ABA_VALOR_CONTAS);
  if (!aba) {
    throw new Error('Aba "' + ABA_VALOR_CONTAS + '" não foi encontrada na planilha.');
  }
  return aba;
}

// Lista os códigos dos relógios dinamicamente, pelos cabeçalhos da aba
// de leituras (todas as colunas, exceto a de data) — mesma ideia já
// usada em processarRegistroTelegram pra achar a coluna de 1 relógio,
// só que aqui devolve a lista inteira, pro formulário montar o seletor
// sem precisar cadastrar relógio nenhum no código.
function listarRelogios() {
  var c = getConfig();
  var sheet = SpreadsheetApp.openById(c.planilhaId).getSheetByName(c.nomeAba);
  var cabecalhos = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var relogios = [];
  for (var i = 0; i < cabecalhos.length; i++) {
    var nome = (cabecalhos[i] || "").toString().trim();
    if (!nome || nome.toUpperCase() === "CARIMBO DE DATA/HORA") continue;
    relogios.push(nome);
  }
  return { ok: true, relogios: relogios };
}

// "MM/yyyy" -> número yyyyMM, só pra poder comparar/ordenar meses
// gravados como texto.
function chaveOrdenavelMes_(mesStr) {
  var partes = (mesStr || "").split("/");
  if (partes.length !== 2) return 0;
  var mm = partes[0].length === 1 ? "0" + partes[0] : partes[0];
  return Number(partes[1] + mm);
}

function listarContasAgua() {
  var aba = obterAbaValorContas();
  var mapa = mapaColunas(aba);
  var colMes = colunaObrigatoria(mapa, ABA_VALOR_CONTAS, "MES");
  var colRelogio = colunaObrigatoria(mapa, ABA_VALOR_CONTAS, "RELOGIO");
  var colValor = colunaObrigatoria(mapa, ABA_VALOR_CONTAS, "VALOR");
  var colTotalMes = mapa["TOTAL MES"];

  var dados = aba.getDataRange().getValues();
  var contas = [];
  for (var i = 1; i < dados.length; i++) {
    var mes = (dados[i][colMes - 1] || "").toString().trim();
    var relogio = (dados[i][colRelogio - 1] || "").toString().trim();
    if (!mes || !relogio) continue;
    contas.push({
      mes: mes,
      relogio: relogio,
      valor: Number(dados[i][colValor - 1]) || 0,
      totalMes: colTotalMes ? (Number(dados[i][colTotalMes - 1]) || 0) : null,
    });
  }
  // Mais recente primeiro.
  contas.sort(function (a, b) { return chaveOrdenavelMes_(b.mes) - chaveOrdenavelMes_(a.mes); });
  return { ok: true, contas: contas };
}

// Upsert por MES+RELOGIO — lançar de novo o mesmo mês/relógio corrige o
// valor em vez de duplicar linha (não precisa apagar nada na mão pra
// corrigir um valor digitado errado).
function registrarContaAgua(mes, relogio, valor) {
  mes = (mes || "").toString().trim();
  relogio = (relogio || "").toString().trim();
  valor = Number(valor);
  if (!mes) throw new Error("Informe o mês da conta.");
  if (!relogio) throw new Error("Selecione o relógio.");
  if (!valor || valor <= 0) throw new Error("Informe um valor válido.");

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var aba = obterAbaValorContas();
    var mapa = mapaColunas(aba);
    var colMes = colunaObrigatoria(mapa, ABA_VALOR_CONTAS, "MES");
    var colRelogio = colunaObrigatoria(mapa, ABA_VALOR_CONTAS, "RELOGIO");
    var colValor = colunaObrigatoria(mapa, ABA_VALOR_CONTAS, "VALOR");
    var colTotalMes = mapa["TOTAL MES"];

    var dados = aba.getDataRange().getValues();

    var linhaExistente = -1;
    for (var i = 1; i < dados.length; i++) {
      var mesLinha = (dados[i][colMes - 1] || "").toString().trim();
      var relogioLinha = (dados[i][colRelogio - 1] || "").toString().trim();
      if (mesLinha === mes && relogioLinha === relogio) {
        linhaExistente = i + 1;
        break;
      }
    }

    if (linhaExistente !== -1) {
      aba.getRange(linhaExistente, colValor).setValue(valor);
    } else {
      var linha = new Array(aba.getLastColumn()).fill("");
      linha[colMes - 1] = mes;
      linha[colRelogio - 1] = relogio;
      linha[colValor - 1] = valor;
      aba.appendRow(linha);
    }

    // Recalcula e grava o TOTAL MES (soma de todos os relógios daquele
    // mês) em toda linha desse mês — mantém as linhas já existentes em
    // dia, não só a que acabou de ser lançada agora.
    if (colTotalMes) {
      var dadosAtualizados = aba.getDataRange().getValues();
      var total = 0;
      var linhasDoMes = [];
      for (var j = 1; j < dadosAtualizados.length; j++) {
        var mesLinhaJ = (dadosAtualizados[j][colMes - 1] || "").toString().trim();
        if (mesLinhaJ !== mes) continue;
        linhasDoMes.push(j + 1);
        total += Number(dadosAtualizados[j][colValor - 1]) || 0;
      }
      linhasDoMes.forEach(function (numLinha) {
        aba.getRange(numLinha, colTotalMes).setValue(total);
      });
    }

    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

// ================= TELEGRAM VIA POLLING (não usa mais webhook) =================
// Por que a troca: o Apps Script, por natureza da plataforma, responde
// chamadas externas com um redirecionamento (302) antes de servir o
// conteúdo — e o Telegram não segue redirecionamento quando entrega
// mensagem pra um webhook. Isso é estrutural (não é erro de
// implantação: já confirmamos "Quem pode acessar: Qualquer pessoa"
// certo) — o Telegram registrava a entrega como falha (mesmo quando o
// nosso código rodava certinho por trás) e represava numa fila que
// precisava ser limpa manualmente, sempre voltando a entupir.
//
// A troca: em vez do Telegram EMPURRAR mensagem pro nosso link
// (webhook — lado problemático), o próprio Apps Script passa a BUSCAR
// mensagens novas a cada 1 minuto (polling, getUpdates). Quem inicia a
// chamada passa a ser sempre o nosso lado — o mesmo caminho que
// enviarTelegram() já usa há muito tempo sem esse problema — então o
// 302 deixa de ser um problema estrutural.

/**
 * 1) Roda esta primeiro. Manda uma mensagem de teste direto (sem
 * depender do polling nem de nada do Telegram receber). Chegou no seu
 * Telegram? O TELEGRAM_TOKEN e TELEGRAM_CHAT_ID (Configurações do
 * projeto > Propriedades do script) estão certos.
 */
function testarTelegram() {
  enviarTelegram("🧪 Teste de conexão — se você recebeu isso, o token e o chat ID estão certos.");
}

/**
 * 2) Roda esta UMA VEZ pra migrar do webhook antigo pro polling novo:
 * desliga o webhook (se ainda tiver algum registrado — getUpdates não
 * funciona com webhook ativo) e liga a checagem automática a cada 1
 * minuto. Depois disso não precisa rodar de novo, nem quando fizer uma
 * implantação nova — o polling não depende do link /exec mudar.
 */
function configurarPollingTelegram() {
  var c = getConfig();

  var urlRemover = "https://api.telegram.org/bot" + c.telegramToken + "/deleteWebhook?drop_pending_updates=true";
  var respRemover = UrlFetchApp.fetch(urlRemover);
  Logger.log("deleteWebhook: " + respRemover.getContentText());

  // Remove qualquer trigger antigo dessa função, pra rodar essa
  // configuração de novo não duplicar o agendamento (ficaria checando
  // 2x por minuto, processando tudo em dobro).
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "verificarMensagensTelegram") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("verificarMensagensTelegram").timeBased().everyMinutes(1).create();

  enviarTelegram("⏱️ Checagem automática configurada — o bot agora busca mensagens novas a cada 1 minuto, sem depender de webhook. Não precisa mais rodar nenhuma função de fila/webhook.");
}

/**
 * 3) Não precisa rodar manualmente — é chamada sozinha, a cada 1
 * minuto, pelo trigger criado em configurarPollingTelegram(). Busca as
 * mensagens novas desde a última checagem (offset guardado em
 * TELEGRAM_OFFSET) e processa cada uma. getUpdates com offset correto
 * nunca reentrega a mesma atualização duas vezes — diferente do
 * webhook, não precisa de nenhuma trava extra contra reenvio.
 */
function verificarMensagensTelegram() {
  var c = getConfig();
  var props = PropertiesService.getScriptProperties();
  var offset = Number(props.getProperty("TELEGRAM_OFFSET")) || 0;

  var url = "https://api.telegram.org/bot" + c.telegramToken + "/getUpdates?timeout=0&offset=" + offset;
  var resposta = UrlFetchApp.fetch(url);
  var dados = JSON.parse(resposta.getContentText());
  if (!dados.ok || !dados.result || dados.result.length === 0) return;

  dados.result.forEach(function (update) {
    if (update.message) {
      // Nunca deixa um erro aqui passar em silêncio — se algo quebrar
      // (aba errada, planilha sem permissão, etc.), pelo menos chega
      // um aviso no Telegram em vez de nada.
      try {
        processarRegistroTelegram(update);
      } catch (erro) {
        Logger.log("Erro no registro de água: " + erro);
        try {
          enviarTelegram("⚠️ Erro ao registrar: " + erro.message);
        } catch (erroTelegram) {
          Logger.log("Nem o aviso de erro foi enviado: " + erroTelegram);
        }
      }
    }
    // Sempre avança o offset, mesmo pra atualizações que não são
    // mensagem de texto (ex.: um /start, sticker...) — senão o
    // getUpdates fica preso reentregando pra sempre a mesma atualização
    // que nunca é tratada.
    offset = update.update_id + 1;
  });

  props.setProperty("TELEGRAM_OFFSET", String(offset));
}

// ================= ROTEAMENTO DO WEB APP =================

/**
 * GET — rotas de TELA primeiro (HTML, abertas de dentro do Menu do
 * Painel Qualidade, cada uma com ALLOWALL pra poder ficar no iframe —
 * ver docs/superpowers/specs/2026-10-02-painel-qualidade-shell-iframe-design.md),
 * senão rotas de DADO (JSON, usadas pelos fetch() de dentro de cada
 * tela). CONSERTO 05/10/2026: esse doGet só tinha as rotas de dado —
 * faltava a parte de tela (Menu/Insumos/Auditoria/Dedetizacao/Avisos/
 * Pipa/Higienizacao/Kanban), o que derrubou o Menu inteiro assim que
 * esse arquivo foi reimplantado hoje. As duas partes moram no MESMO
 * doGet porque só existe 1 por projeto — ver comentário no topo do
 * arquivo. Sem parâmetro nenhum (nem tela nem dados), mantém o
 * comportamento antigo: devolve os avisos em JSON (Avisos.html sempre
 * buscou essa URL assim).
 */
function doGet(e) {
  var tela = e.parameter.tela;
  if (tela === "insumos") {
    return HtmlService.createHtmlOutputFromFile("Insumos")
      .setTitle("Insumos Críticos — Mamma Mia")
      .addMetaTag("viewport", "width=device-width, initial-scale=1")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  if (tela === "auditoria") {
    return HtmlService.createHtmlOutputFromFile("Auditoria")
      .setTitle("Auditoria — Mamma Mia")
      .addMetaTag("viewport", "width=device-width, initial-scale=1")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  if (tela === "dedetizacao") {
    return HtmlService.createHtmlOutputFromFile("Dedetizacao")
      .setTitle("Dedetização — Mamma Mia")
      .addMetaTag("viewport", "width=device-width, initial-scale=1")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  if (tela === "avisos") {
    return HtmlService.createHtmlOutputFromFile("Avisos")
      .setTitle("Avisos — Mamma Mia")
      .addMetaTag("viewport", "width=device-width, initial-scale=1")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  if (tela === "pipa") {
    return HtmlService.createHtmlOutputFromFile("Pipa")
      .setTitle("Caminhão Pipa — Mamma Mia")
      .addMetaTag("viewport", "width=device-width, initial-scale=1")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  if (tela === "higienizacao") {
    return HtmlService.createHtmlOutputFromFile("Higienizacao")
      .setTitle("Higienização de Motores — Mamma Mia")
      .addMetaTag("viewport", "width=device-width, initial-scale=1")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  if (tela === "kanban") {
    return HtmlService.createHtmlOutputFromFile("Kanban")
      .setTitle("Kanban de Atividades — Mamma Mia")
      .addMetaTag("viewport", "width=device-width, initial-scale=1")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  if (tela === "contas") {
    return HtmlService.createHtmlOutputFromFile("ContasAgua")
      .setTitle("Valor das Contas — Mamma Mia")
      .addMetaTag("viewport", "width=device-width, initial-scale=1")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  if (!tela && e.parameter.dados == null) {
    return HtmlService.createHtmlOutputFromFile("Menu")
      .setTitle("Painel Qualidade — Mamma Mia")
      .addMetaTag("viewport", "width=device-width, initial-scale=1");
  }

  try {
    if (e.parameter.dados === "kanban") return respostaJson(listarCards());
    if (e.parameter.dados === "rotinas") return respostaJson(listarRotinas());
    if (e.parameter.dados === "relogios") return respostaJson(listarRelogios());
    if (e.parameter.dados === "contas_agua") return respostaJson(listarContasAgua());
    return respostaJson(listarAvisos());
  } catch (erro) {
    return respostaJson({ ok: false, erro: erro.message });
  }
}

/**
 * O registro de água não usa mais webhook do Telegram (ver "TELEGRAM
 * VIA POLLING" acima) — então doPost hoje atende Avisos
 * ({acao: "criar"|"editar"|"remover", ...}), Pipa
 * ({acao: "criar_pipa", pedido, requisitada, recebida, placa,
 * relInicio, relFim, recibo}), Higienização de Motores
 * ({acao: "criar_higienizacao", dataHigienizacao, responsavel, unidade}),
 * Kanban ({acao: "criar_card"|"editar_card"|"excluir_card"|"mover_card",
 * ...}), o CADASTRO de Rotinas ({acao: "criar_rotina"|"editar_rotina"|
 * "excluir_rotina", ...}) e Valor das Contas
 * ({acao: "registrar_conta_agua", mes, relogio, valor}) — o card do dia
 * em si é gerado sozinho dentro de listarCards() (doGet), não por uma
 * ação aqui.
 */
function doPost(e) {
  var dados = JSON.parse(e.postData.contents);

  try {
    if (dados.acao === "criar") return respostaJson(criarAviso(dados.texto));
    if (dados.acao === "editar") return respostaJson(editarAviso(dados.id, dados.texto));
    if (dados.acao === "remover") return respostaJson(removerAviso(dados.id));
    if (dados.acao === "criar_pipa") return respostaJson(registrarPipa(dados));
    if (dados.acao === "criar_higienizacao") return respostaJson(registrarHigienizacao(dados));
    if (dados.acao === "criar_card") return respostaJson(criarCard(dados.titulo, dados.descricao, dados.etiqueta));
    if (dados.acao === "editar_card") return respostaJson(editarCard(dados.id, dados.titulo, dados.descricao, dados.etiqueta));
    if (dados.acao === "mover_card") return respostaJson(moverCard(dados.id, dados.coluna, dados.ordemIds));
    if (dados.acao === "excluir_card") return respostaJson(excluirCard(dados.id));
    if (dados.acao === "criar_rotina") return respostaJson(criarRotina(dados.texto, dados.horario, dados.frequencia, dados.diaSemana, dados.diaMes));
    if (dados.acao === "editar_rotina") return respostaJson(editarRotina(dados.id, dados.texto, dados.horario, dados.frequencia, dados.diaSemana, dados.diaMes));
    if (dados.acao === "excluir_rotina") return respostaJson(excluirRotina(dados.id));
    if (dados.acao === "registrar_conta_agua") return respostaJson(registrarContaAgua(dados.mes, dados.relogio, dados.valor));
    throw new Error("Ação inválida: " + dados.acao);
  } catch (erro) {
    return respostaJson({ ok: false, erro: erro.message });
  }
}
