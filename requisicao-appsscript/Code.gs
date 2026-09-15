/**
 * FECHAR REQUISIÇÃO DE MATÉRIA-PRIMA E RECHEIOS — Mamma Mia
 * ---------------------------------------------------------------------
 * Web App em Apps Script com UMA função: dar baixa numa requisição que
 * já foi aberta pelo Google Forms (a abertura continua sendo feita pelo
 * Forms, sem mudança — só o fechamento ganha uma tela própria).
 *
 * Como instalar:
 * 1) Na planilha "BASE - REQUISIÇÃO MP E RECHEIOS", confirme a aba
 *    "REQUISIÇÃO DE MATÉRIA-PRIMA E RECHEIOS - MAMMA MIA CONTROL" (é a
 *    aba de respostas do Forms, com STATUS = ABERTO/CONCLUÍDO/
 *    PARCIALMENTE e a coluna REQUISICOES com o ID de cada requisição).
 * 2) Adicione 3 colunas novas no cabeçalho (linha 1) dessa mesma aba,
 *    com esses nomes exatos: "Entregue por", "Data de entrega",
 *    "Observações de entrega".
 * 3) Nessa MESMA planilha: Extensões > Apps Script > cole este arquivo
 *    e os 2 HTML ao lado (Menu.html, FecharRequisicao.html). Não é
 *    necessário mais o AbrirRequisicao.html nem a aba "FecharRequisicao"
 *    criada numa etapa anterior — pode apagar os dois, ou deixar sem
 *    uso, como preferir.
 * 4) Em Menu.html, troque a constante URL_FORMULARIO_ABRIR pelo link
 *    real do Google Forms de abertura, se for diferente do que já está.
 * 5) Configurações do projeto > Propriedades do script > adicione
 *    TELEGRAM_TOKEN e TELEGRAM_CHAT_ID.
 * 6) Implantar > Nova implantação > App da Web (Executar como: Eu;
 *    Quem pode acessar: Qualquer pessoa).
 */

var NOME_ABA_REQUISICOES = "REQUISIÇÃO DE MATÉRIA-PRIMA E RECHEIOS - MAMMA MIA CONTROL";

var STATUS_CONCLUIDO = "CONCLUÍDO";
var STATUS_PARCIAL = "PARCIALMENTE";
var STATUSES_VALIDOS_FECHAMENTO = [STATUS_CONCLUIDO, STATUS_PARCIAL];


/****************************************************
 * LOCALIZA COLUNAS PELO CABEÇALHO
 * Mesma filosofia defensiva do manutencao-appsscript:
 * nunca grava dado na coluna errada silenciosamente.
 ****************************************************/

function getColumnIndexByHeader(sheet, nomeCabecalho) {

  var cabecalhos = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0];

  for (var i = 0; i < cabecalhos.length; i++) {
    var atual = (cabecalhos[i] || "").toString().trim().toUpperCase();
    if (atual === nomeCabecalho.toUpperCase()) {
      return i + 1; // getRange usa índice 1-based
    }
  }

  throw new Error(
    "Coluna com cabeçalho \"" + nomeCabecalho + "\" não foi encontrada na planilha. " +
    "Verifique se o nome do cabeçalho na linha 1 não foi alterado ou removido."
  );
}

/**
 * Igual a getColumnIndexByHeader, mas por padrão (regex) em vez de nome
 * exato — usado só pra coluna de itens em texto livre, cujo cabeçalho
 * real no Forms tem instruções embutidas no título ("Preencha uma linha
 * para cada item...") que podem mudar de redação sem mudar de sentido.
 */
function getColumnIndexByPattern(sheet, padrao) {

  var cabecalhos = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0];

  for (var i = 0; i < cabecalhos.length; i++) {
    if (padrao.test((cabecalhos[i] || "").toString())) {
      return i + 1;
    }
  }

  throw new Error(
    "Nenhuma coluna bateu com o padrão " + padrao + ". " +
    "Verifique se o título da pergunta de itens no Forms não mudou de forma inesperada."
  );
}

function obterMapaColunas(sheet) {
  return {
    timestamp: getColumnIndexByHeader(sheet, "Timestamp"),
    requisitante: getColumnIndexByHeader(sheet, "Nome do requisitante"),
    unidade: getColumnIndexByHeader(sheet, "Unidade solicitante"),
    setor: getColumnIndexByHeader(sheet, "Setor solicitante"),
    tipo: getColumnIndexByHeader(sheet, "Tipo de item requisitado"),
    itensLivre: getColumnIndexByPattern(sheet, /^Item requisitado\s*\/\s*Quantidade requisitada/i),
    quantidadeSolicitada: getColumnIndexByHeader(sheet, "Quantidade solicitada"),
    prioridade: getColumnIndexByHeader(sheet, "Prioridade"),
    finalidade: getColumnIndexByHeader(sheet, "Finalidade da requisição"),
    observacoes: getColumnIndexByHeader(sheet, "Observações"),
    status: getColumnIndexByHeader(sheet, "STATUS"),
    id: getColumnIndexByHeader(sheet, "REQUISICOES"),
    entreguePor: getColumnIndexByHeader(sheet, "Entregue por"),
    dataEntrega: getColumnIndexByHeader(sheet, "Data de entrega"),
    obsEntrega: getColumnIndexByHeader(sheet, "Observações de entrega"),
  };
}

function obterSheet() {
  var aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NOME_ABA_REQUISICOES);
  if (!aba) {
    throw new Error('Aba "' + NOME_ABA_REQUISICOES + '" não foi encontrada na planilha.');
  }
  return aba;
}


/****************************************************
 * TELEGRAM
 ****************************************************/

function enviarTelegram(mensagem) {

  if (!mensagem || String(mensagem).trim() === "") {
    throw new Error("Mensagem vazia.");
  }

  var propriedades = PropertiesService.getScriptProperties();
  var TELEGRAM_TOKEN = propriedades.getProperty("TELEGRAM_TOKEN");
  var CHAT_ID = propriedades.getProperty("TELEGRAM_CHAT_ID");

  if (!TELEGRAM_TOKEN) throw new Error("TELEGRAM_TOKEN não encontrado.");
  if (!CHAT_ID) throw new Error("TELEGRAM_CHAT_ID não encontrado.");

  var url = "https://api.telegram.org/bot" + TELEGRAM_TOKEN + "/sendMessage";

  var options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({ chat_id: CHAT_ID, text: mensagem }),
    muteHttpExceptions: true
  };

  var resposta = UrlFetchApp.fetch(url, options);
  Logger.log(resposta.getContentText());

}


/****************************************************
 * LISTAR REQUISIÇÕES EM ABERTO
 * "Em aberto" = STATUS diferente de CONCLUÍDO (cobre
 * ABERTO e PARCIALMENTE). Mais recente primeiro.
 ****************************************************/

function listarRequisicoesAbertas() {
  var sheet = obterSheet();
  var cols = obterMapaColunas(sheet);
  var dados = sheet.getDataRange().getValues();

  var abertas = [];
  for (var i = 1; i < dados.length; i++) {
    var linha = dados[i];
    var id = (linha[cols.id - 1] || "").toString().trim();
    var status = (linha[cols.status - 1] || "").toString().trim().toUpperCase();
    if (!id || status === STATUS_CONCLUIDO) continue;

    var itensTexto = (linha[cols.itensLivre - 1] || "").toString().trim();
    var quantidade = linha[cols.quantidadeSolicitada - 1];
    if (quantidade !== "" && quantidade !== null && quantidade !== undefined) {
      itensTexto += (itensTexto ? "\n" : "") + "Quantidade: " + quantidade;
    }

    abertas.push({
      id: id,
      requisitante: linha[cols.requisitante - 1],
      unidade: linha[cols.unidade - 1],
      setor: linha[cols.setor - 1],
      tipo: linha[cols.tipo - 1],
      itens: itensTexto,
      prioridade: (linha[cols.prioridade - 1] || "").toString().trim(),
      finalidade: linha[cols.finalidade - 1],
      observacoes: linha[cols.observacoes - 1],
      status: status,
    });
  }

  // Mais recente primeiro.
  abertas.reverse();

  return abertas;
}


/****************************************************
 * FECHAR (DAR BAIXA) NUMA REQUISIÇÃO
 * statusFinal: "CONCLUÍDO" (entrega total) ou
 * "PARCIALMENTE" (entrega parcial) — os dois status já
 * usados manualmente hoje nessa mesma planilha.
 ****************************************************/

function fecharRequisicao(id, statusFinal, entreguePor, observacoesEntrega) {
  id = (id || "").toString().trim();
  statusFinal = (statusFinal || "").toString().trim().toUpperCase();
  entreguePor = (entreguePor || "").toString().trim();
  observacoesEntrega = (observacoesEntrega || "").toString().trim();

  if (!id) throw new Error("Selecione uma requisição.");
  if (STATUSES_VALIDOS_FECHAMENTO.indexOf(statusFinal) === -1) {
    throw new Error("Status inválido: " + statusFinal);
  }
  if (!entreguePor) throw new Error("Informe quem está entregando os itens.");

  var sheet = obterSheet();
  var cols = obterMapaColunas(sheet);
  var dados = sheet.getDataRange().getValues();

  var linhaEncontrada = -1;
  for (var i = 1; i < dados.length; i++) {
    if ((dados[i][cols.id - 1] || "").toString().trim() === id) {
      linhaEncontrada = i + 1; // +1 porque getRange é 1-based
      break;
    }
  }
  if (linhaEncontrada === -1) throw new Error("Requisição não encontrada: " + id);

  var statusAtual = (sheet.getRange(linhaEncontrada, cols.status).getValue() || "").toString().trim().toUpperCase();
  if (statusAtual === STATUS_CONCLUIDO) {
    throw new Error("Essa requisição já foi concluída por outra pessoa.");
  }

  var agora = new Date();
  sheet.getRange(linhaEncontrada, cols.status).setValue(statusFinal);
  sheet.getRange(linhaEncontrada, cols.entreguePor).setValue(entreguePor);
  sheet.getRange(linhaEncontrada, cols.dataEntrega).setValue(agora);
  sheet.getRange(linhaEncontrada, cols.obsEntrega).setValue(observacoesEntrega);

  try {
    var mensagem =
      (statusFinal === STATUS_CONCLUIDO ? "✅ REQUISIÇÃO CONCLUÍDA" : "🟡 REQUISIÇÃO ENTREGUE PARCIALMENTE") + "\n\n" +
      "🆔 " + id + "\n" +
      "👤 Entregue por: " + entreguePor + "\n" +
      "🕒 " + Utilities.formatDate(agora, "America/Sao_Paulo", "dd/MM/yyyy HH:mm") +
      (observacoesEntrega ? "\n📝 Observações: " + observacoesEntrega : "");

    enviarTelegram(mensagem);
  } catch (erroTelegram) {
    Logger.log("Falha ao avisar no Telegram sobre a baixa da requisição " + id + ": " + erroTelegram);
  }

  return { ok: true, id: id, status: statusFinal };
}


/****************************************************
 * ROTEAMENTO DO WEB APP
 * ".../exec" → Menu.html (2 cards: Abrir, que aponta
 * pro Google Forms, e Fechar, que abre a tela abaixo).
 * ".../exec?tela=fechar" → FecharRequisicao.html.
 ****************************************************/

function doGet(e) {
  var tela = e && e.parameter && e.parameter.tela;

  if (tela === "fechar") {
    return HtmlService
      .createHtmlOutputFromFile("FecharRequisicao")
      .setTitle("Fechar Requisição — Mamma Mia")
      .addMetaTag("viewport", "width=device-width, initial-scale=1");
  }

  return HtmlService
    .createHtmlOutputFromFile("Menu")
    .setTitle("Requisição MP e Recheios — Mamma Mia")
    .addMetaTag("viewport", "width=device-width, initial-scale=1");
}
