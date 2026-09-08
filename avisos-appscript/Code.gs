/**
 * PROJETO ÚNICO: registro de água via Telegram + mural de Avisos do
 * painel (mammamia-control.vercel.app). Os dois moram no mesmo projeto
 * Apps Script porque só existe 1 link (/exec) e 1 doPost por projeto —
 * então o doPost, lá embaixo, decide sozinho qual dos dois é, pelo
 * formato do corpo recebido.
 *
 * planilhaId aponta pra planilha de água — é onde tanto a aba "Dados"
 * (leituras) quanto a aba "AVISOS" (mural) vivem.
 */

// Link publicado (/exec) desse Web App — o mesmo que está em
// AVISOS_EXEC_URL no painel (src/main.js). Fixo aqui de propósito:
// ScriptApp.getService().getUrl() devolve o link /dev (só funciona
// logado no navegador, não pro Telegram) quando a função roda
// manualmente pelo editor — então não dá pra confiar nele pra
// registrar o webhook. Se um dia fizer uma "Nova implantação" (não
// "Nova versão") e o link mudar, atualiza aqui E no painel.
var URL_EXEC_PUBLICADA = "https://script.google.com/macros/s/AKfycbzHvvPZzBDSB730gShVCl7CPQb23h37w8k8B-cY8n1RI-NkBJzp0eUP5m-rbtj3nGdwpw/exec";

// ================= CONFIG =================
function getConfig() {
  var props = PropertiesService.getScriptProperties();

  return {
    telegramToken: props.getProperty("TELEGRAM_TOKEN"),
    chatId: props.getProperty("TELEGRAM_CHAT_ID"),
    planilhaId: "1tixTJ74aaEo-EuCfTFl-efWOT7p-TIgN0su8NzX8aKw",
    nomeAba: "dados"
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

// ================= VERIFICA DUPLICIDADE =================
function jaRegistradoHoje(sheet, relogio) {
  var dados = sheet.getDataRange().getValues();
  var hoje = Utilities.formatDate(new Date(), "GMT-3", "dd/MM/yyyy");

  for (var i = dados.length - 1; i > 0; i--) {
    var data = Utilities.formatDate(new Date(dados[i][0]), "GMT-3", "dd/MM/yyyy");

    if (dados[i][1] == relogio && data == hoje) {
      return true;
    }
  }

  return false;
}

// ================= BUSCA ÚLTIMA LEITURA =================
function buscarUltimaLeitura(sheet, relogio) {
  var dados = sheet.getDataRange().getValues();

  for (var i = dados.length - 1; i > 0; i--) {
    if (dados[i][1] == relogio) {
      return dados[i][2];
    }
  }

  return null;
}

// ================= REGISTRO DE LEITURA (webhook do Telegram) =================
// Mesma lógica de sempre, só que extraída pra uma função própria — o
// doPost lá embaixo chama essa aqui quando reconhece que é uma
// mensagem do Telegram, não mais o código direto dentro do doPost.
function processarRegistroTelegram(dadosTelegram) {
  var c = getConfig();
  var msg = dadosTelegram.message.text;

  // Esperado: RELÓGIO VALOR
  var partes = msg.split(" ");

  if (partes.length < 2) {
    enviarTelegram("❌ Envie no formato:\nRELOGIO VALOR");
    return;
  }

  var relogio = partes[0];
  var leituraAtual = converterNumero(partes[1]);

  var planilha = SpreadsheetApp.openById(c.planilhaId);
  var sheet = planilha.getSheetByName(c.nomeAba);

  // 🔒 BLOQUEIO DE DUPLICIDADE
  if (jaRegistradoHoje(sheet, relogio)) {

    if (!jaEnviouHoje(relogio)) {
      enviarTelegram("⚠️ RELÓGIO " + relogio + " JÁ REGISTRADO HOJE");
      marcarComoEnviado(relogio);
    }

    return;
  }

  // 🔍 BUSCA ÚLTIMA LEITURA
  var ultimaLeituraRaw = buscarUltimaLeitura(sheet, relogio);
  var ultimaLeitura = ultimaLeituraRaw ? converterNumero(ultimaLeituraRaw) : 0;

  var consumo = leituraAtual - ultimaLeitura;

  // 💾 SALVA NA PLANILHA
  sheet.appendRow([
    new Date(),
    relogio,
    leituraAtual,
    consumo
  ]);

  // 📲 RESPOSTA TELEGRAM
  var resposta = "✅ Registro recebido\n\n";
  resposta += "Relógio: " + relogio + "\n";
  resposta += "Anterior: " + ultimaLeitura + "\n";
  resposta += "Atual: " + leituraAtual + "\n";
  resposta += "Consumo: " + consumo;

  enviarTelegram(resposta);
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

function colunaObrigatoria(mapa, nomeColuna) {
  var indice = mapa[nomeColuna.toUpperCase()];
  if (!indice) {
    throw new Error(
      'Coluna "' + nomeColuna + '" não encontrada na aba "' + ABA_AVISOS + '". ' +
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
  var colId = colunaObrigatoria(mapa, "ID");
  var colTexto = colunaObrigatoria(mapa, "TEXTO");

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
    var colId = colunaObrigatoria(mapa, "ID");
    var colTexto = colunaObrigatoria(mapa, "TEXTO");
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
    var colId = colunaObrigatoria(mapa, "ID");
    var colTexto = colunaObrigatoria(mapa, "TEXTO");
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
    var colId = colunaObrigatoria(mapa, "ID");

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

// ================= DIAGNÓSTICO DO TELEGRAM (rodar manualmente) =================
// Duas funções pra rodar direto no editor (▶ Executar, escolhendo o
// nome da função no menu ao lado do botão) — sem precisar mandar
// mensagem nenhuma pro bot. Isolam os dois motivos mais prováveis do
// bot não responder: token/chat ID errados, ou o Telegram nem sabendo
// pra onde mandar as mensagens (webhook desatualizado).

/**
 * 1) Roda esta primeiro. Manda uma mensagem de teste direto (sem
 * passar pelo Telegram nem pelo webhook). Chegou no seu Telegram? O
 * TELEGRAM_TOKEN e TELEGRAM_CHAT_ID (Configurações do projeto >
 * Propriedades do script) estão certos. Não chegou / deu erro na
 * execução? É isso que precisa corrigir primeiro — confere se essas
 * duas propriedades existem *nesse* projeto (elas não vêm sozinhas de
 * um projeto antigo, são por projeto).
 */
function testarTelegram() {
  enviarTelegram("🧪 Teste de conexão — se você recebeu isso, o token e o chat ID estão certos.");
}

/**
 * 2) Roda esta depois que testarTelegram funcionar. Registra (ou
 * corrige) o webhook do Telegram pra apontar pro link /exec publicado
 * (URL_EXEC_PUBLICADA acima) — é isso que faz o Telegram saber que deve
 * mandar as mensagens que você digita pro bot pra cá. Precisa rodar de
 * novo toda vez que uma "Nova implantação" (não "Nova versão") gerar um
 * link /exec diferente do anterior (e aí também precisa atualizar
 * URL_EXEC_PUBLICADA aqui em cima e AVISOS_EXEC_URL no painel).
 */
function registrarWebhookTelegram() {
  var c = getConfig();
  var urlAtual = URL_EXEC_PUBLICADA;
  var url = "https://api.telegram.org/bot" + c.telegramToken + "/setWebhook?url=" + encodeURIComponent(urlAtual);
  var resposta = UrlFetchApp.fetch(url);
  Logger.log(resposta.getContentText());
  enviarTelegram("🔗 Webhook registrado pra:\n" + urlAtual);
}

// ================= ROTEAMENTO DO WEB APP =================

/** GET — só usado pelo painel, pra listar os avisos. */
function doGet(e) {
  try {
    return respostaJson(listarAvisos());
  } catch (erro) {
    return respostaJson({ ok: false, erro: erro.message });
  }
}

/**
 * Um projeto Apps Script só pode ter 1 doPost — esse aqui atende dois
 * usos que antes eram (indevidamente) dois doPost em conflito: o
 * webhook do Telegram (registro de leitura do relógio de água) e as
 * ações do mural de Avisos do painel. Distingue pelo formato do corpo:
 * webhook do Telegram manda {message: {...}}; o painel manda
 * {acao: "criar"|"editar"|"remover", ...}.
 */
function doPost(e) {
  var dados = JSON.parse(e.postData.contents);

  if (dados.message) {
    // Nunca deixa um erro aqui passar em silêncio de novo — se algo
    // quebrar (aba errada, planilha sem permissão, etc.), pelo menos
    // chega um aviso no Telegram em vez de nada.
    try {
      processarRegistroTelegram(dados);
    } catch (erro) {
      Logger.log("Erro no registro de água: " + erro);
      try {
        enviarTelegram("⚠️ Erro ao registrar: " + erro.message);
      } catch (erroTelegram) {
        Logger.log("Nem o aviso de erro foi enviado: " + erroTelegram);
      }
    }
    return ContentService.createTextOutput("ok");
  }

  try {
    if (dados.acao === "criar") return respostaJson(criarAviso(dados.texto));
    if (dados.acao === "editar") return respostaJson(editarAviso(dados.id, dados.texto));
    if (dados.acao === "remover") return respostaJson(removerAviso(dados.id));
    throw new Error("Ação inválida: " + dados.acao);
  } catch (erro) {
    return respostaJson({ ok: false, erro: erro.message });
  }
}
