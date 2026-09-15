/**
 * REQUISIÇÃO DE MATÉRIA-PRIMA E RECHEIOS — Mamma Mia
 * ---------------------------------------------------------------------
 * App próprio (Web App em Apps Script), substituindo o Google Forms.
 * Duas telas, no mesmo padrão do manutencao-appsscript (Menu / Abrir /
 * Fechar):
 *   - Abrir Requisição: formulário próprio com o catálogo de produtos.
 *   - Fechar Requisição: lista as requisições em aberto e dá baixa.
 *
 * Como instalar:
 * 1) Crie uma planilha nova e cole na linha 1, nesta ordem, os
 *    cabeçalhos: Timestamp, ID, STATUS, Nome do requisitante, Unidade
 *    solicitante, Setor solicitante, Tipo de item requisitado, Itens
 *    solicitados, Finalidade da requisição, Documento, Entregue por,
 *    Data de entrega, Observações de entrega.
 * 2) Extensões > Apps Script > cole este arquivo e os 3 HTML ao lado.
 * 3) Configurações do projeto > Propriedades do script > adicione
 *    TELEGRAM_TOKEN e TELEGRAM_CHAT_ID.
 * 4) Implantar > Nova implantação > App da Web (Executar como: Eu;
 *    Quem pode acessar: Qualquer pessoa).
 */

/****************************************************
 * CATÁLOGO DE PRODUTOS, agrupado por categoria (usado
 * pela tela de Abrir Requisição para montar o seletor).
 ****************************************************/

const CATALOGO = {

  "Matéria-prima": [
    "Apresuntado (PÇ)", "Achocolatado (KG)", "Açucar (FD)", "Amido podium (PCT)",
    "Amido (P.Q.R) (PCT)", "Antimofo (PCT)", "Azeitona (BD)", "Café (PCT)",
    "Calabresa (KG)", "Chocolate bisnaga (KG)", "Corante gema (L)", "Creme culinário (L)",
    "Farinha 101 (PCT)", "Farinha ciabatta (FD)", "Farinha italiano (FD)", "Fermento (UNI)",
    "Flocos de batata (PCT)", "Dourador (CX)", "Gergelim (PCT)", "Gluten (PCT)",
    "Hamburger crú (KG)", "Leite (L)", "Leite em pó (KG)", "Margarina balde (BL)",
    "Margarina qually (KG)", "Margarina ricca (CX)", "Mortadela (PÇ)", "Óleo (GL)",
    "Orégano (UNI)", "Ovo (PCT)", "Peito de frango (PÇ)", "Peito de peru (PÇ)", "Provolone (PÇ)",
    "Queijo meia cura (CX)", "Queijo minas (PÇ)", "Queijo mussarela fatiar (PÇ)",
    "Queijo parmesão triturado (PCT)", "Queijo prato (PÇ)", "Requeijao coronata (UNI)",
    "Requeijao tirolez (UNI)", "Requeijao top milk (UNI)", "Ricota (UNI)", "Sal (FD)",
    "Salame (PÇ)", "Suco em pó (UNI)", "Requeijao catupiry (UNI)",
    "Mix dadinho (PCT)", "MELHORADOR (CX)", "Essência de Manteiga (CX)", "Goiabada (BD)",
    "MIX FD 750 (CX)", "AMACIANTE ESFIHA (CX)"
  ],

  "Recheio": [
    "TOMATE IN NATURA (CX)", "SALSA PICADA (PCT)", "CEBOLA PICADA (PCT)",
    "MOLHO DE TOMATE (PCT)", "BACON TRITURADO (PCT)", "BROCOLIS (PCT)",
    "FRANGO (KG)", "PROTEÍNA CALABRESA (PCT)", "PROTEÍNA FRANGO (PCT)",
    "CARNE MOIDA (KG)", "CARNE LOUCA (KG)", "MOLHO CHEDDAR (PCT)"
  ],

  "Embalagens/Descartáveis": [
    "BOBINA FLOW PACK (RL)", "STRESH (RL)", "CAIXA PEQUENA (UNI)", "CAIXA GRANDE (UNI)",
    "ETIQUETA (CX)", "DUREX (FD)", "EMBALAGEM 34X45 (PCT)", "EMBALAGEM 40X60  (PCT)",
    "Caixa de empada (UN)"
  ]

};

var OPCOES_UNIDADE = ["TC", "YUKA", "DS"];
var OPCOES_SETOR = ["Produção", "Cozinha", "Limpeza", "Manutenção", "Outro"];
var OPCOES_TIPO_ITEM = ["Matéria-prima", "Recheio", "Embalagens/Descartáveis", "Outro"];

var STATUS_SOLICITADO = "Solicitado";
var STATUS_ENTREGUE = "Entregue";

// Mesmo logo já usado pelos outros apps internos da Mamma Mia.
var LOGO_ID = "1mBHCppmwzj65IlT7kCKXInhSV-ltqE3I";


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

function obterMapaColunas(sheet) {
  return {
    timestamp: getColumnIndexByHeader(sheet, "Timestamp"),
    id: getColumnIndexByHeader(sheet, "ID"),
    status: getColumnIndexByHeader(sheet, "STATUS"),
    requisitante: getColumnIndexByHeader(sheet, "Nome do requisitante"),
    unidade: getColumnIndexByHeader(sheet, "Unidade solicitante"),
    setor: getColumnIndexByHeader(sheet, "Setor solicitante"),
    tipo: getColumnIndexByHeader(sheet, "Tipo de item requisitado"),
    itens: getColumnIndexByHeader(sheet, "Itens solicitados"),
    finalidade: getColumnIndexByHeader(sheet, "Finalidade da requisição"),
    documento: getColumnIndexByHeader(sheet, "Documento"),
    entreguePor: getColumnIndexByHeader(sheet, "Entregue por"),
    dataEntrega: getColumnIndexByHeader(sheet, "Data de entrega"),
    obsEntrega: getColumnIndexByHeader(sheet, "Observações de entrega"),
  };
}

function obterSheet() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
}


/****************************************************
 * DADOS PARA A TELA DE ABERTURA
 * Chamado pelo cliente via google.script.run — evita
 * duplicar o catálogo/opções em HTML e Code.gs.
 ****************************************************/

function obterDadosAberturaRequisicao() {
  return {
    catalogo: CATALOGO,
    opcoesUnidade: OPCOES_UNIDADE,
    opcoesSetor: OPCOES_SETOR,
    opcoesTipoItem: OPCOES_TIPO_ITEM,
  };
}


/****************************************************
 * GERA ID SEQUENCIAL (RQ-AAAAMMDD-NNN)
 ****************************************************/

function gerarIDRequisicao() {

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {

    var propriedades = PropertiesService.getScriptProperties();

    var hoje = Utilities.formatDate(new Date(), "GMT-3", "yyyyMMdd");

    var chaveData = "DATA_CONTADOR_REQUISICAO";
    var chaveContador = "CONTADOR_REQUISICAO";

    var dataSalva = propriedades.getProperty(chaveData);

    var contador = Number(propriedades.getProperty(chaveContador) || 0);

    if (dataSalva !== hoje) {
      contador = 1;
      propriedades.setProperty(chaveData, hoje);
    } else {
      contador++;
    }

    propriedades.setProperty(chaveContador, String(contador));

    var numero = String(contador).padStart(3, "0");

    return "RQ-" + hoje + "-" + numero;

  } finally {
    lock.releaseLock();
  }

}


/****************************************************
 * DOCUMENTO DA REQUISIÇÃO
 ****************************************************/

function criarDocumentoRequisicao(dados, idRequisicao, linhasItens) {

  var nomeArquivo = idRequisicao + " - REQUISICAO";
  var doc = DocumentApp.create(nomeArquivo);
  var body = doc.getBody();

  var logo = DriveApp.getFileById(LOGO_ID).getBlob();
  var paragrafoLogo = body.appendParagraph("");
  paragrafoLogo.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  var imagem = paragrafoLogo.appendInlineImage(logo);
  imagem.setWidth(120);
  imagem.setHeight(120);

  var titulo = body.appendParagraph("REQUISIÇÃO OPERACIONAL");
  titulo.setHeading(DocumentApp.ParagraphHeading.HEADING1);
  titulo.setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  body.appendParagraph("ID: " + idRequisicao);
  body.appendParagraph("Data: " + Utilities.formatDate(new Date(), "America/Sao_Paulo", "dd/MM/yyyy HH:mm"));
  body.appendParagraph("");

  body.appendParagraph("Requisitante: " + (dados.requisitante || ""));
  body.appendParagraph("Unidade solicitante: " + (dados.unidade || ""));
  body.appendParagraph("Setor: " + (dados.setor || ""));
  body.appendParagraph("");

  body.appendParagraph("Tipo: " + (dados.tipo || ""));
  body.appendParagraph("Itens solicitados:");

  if (linhasItens.length === 0) {
    body.appendParagraph("Nenhum item informado.");
  } else {
    linhasItens.forEach(function (linha) {
      body.appendParagraph("• " + linha);
    });
  }

  body.appendParagraph("");
  body.appendParagraph("Finalidade: " + (dados.finalidade || ""));
  body.appendParagraph("");

  body.appendParagraph("Status: " + STATUS_SOLICITADO);

  doc.saveAndClose();

  var arquivo = DriveApp.getFileById(doc.getId());
  arquivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return arquivo.getUrl();

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
 * ABRIR REQUISIÇÃO
 * dados = {
 *   requisitante, unidade, setor, tipo, finalidade,
 *   itens: [{ produto: "Farinha 101 (PCT)", quantidade: "5" }, ...]
 * }
 ****************************************************/

function abrirRequisicao(dados) {
  dados = dados || {};

  var requisitante = (dados.requisitante || "").toString().trim();
  var unidade = (dados.unidade || "").toString().trim();
  var setor = (dados.setor || "").toString().trim();
  var tipo = (dados.tipo || "").toString().trim();
  var finalidade = (dados.finalidade || "").toString().trim();
  var itens = Array.isArray(dados.itens) ? dados.itens : [];

  var CAMPOS_OBRIGATORIOS = [
    [requisitante, "Nome do requisitante"],
    [unidade, "Unidade solicitante"],
    [setor, "Setor solicitante"],
    [tipo, "Tipo de item requisitado"],
    [finalidade, "Finalidade da requisição"],
  ];
  for (var i = 0; i < CAMPOS_OBRIGATORIOS.length; i++) {
    if (!CAMPOS_OBRIGATORIOS[i][0]) {
      throw new Error('Preencha o campo "' + CAMPOS_OBRIGATORIOS[i][1] + '" antes de enviar.');
    }
  }

  var linhasItens = itens
    .filter(function (item) {
      return item && item.produto && Number(item.quantidade) > 0;
    })
    .map(function (item) {
      return item.produto + ": " + item.quantidade;
    });

  if (linhasItens.length === 0) {
    throw new Error("Selecione ao menos um item com quantidade maior que zero.");
  }

  var idRequisicao = gerarIDRequisicao();

  var sheet = obterSheet();
  var cols = obterMapaColunas(sheet);

  var linha = new Array(sheet.getLastColumn()).fill("");
  linha[cols.timestamp - 1] = new Date();
  linha[cols.id - 1] = idRequisicao;
  linha[cols.status - 1] = STATUS_SOLICITADO;
  linha[cols.requisitante - 1] = requisitante;
  linha[cols.unidade - 1] = unidade;
  linha[cols.setor - 1] = setor;
  linha[cols.tipo - 1] = tipo;
  linha[cols.itens - 1] = linhasItens.join("\n");
  linha[cols.finalidade - 1] = finalidade;

  sheet.appendRow(linha);
  var linhaNova = sheet.getLastRow();

  var linkDocumento = "";
  try {
    linkDocumento = criarDocumentoRequisicao(
      { requisitante: requisitante, unidade: unidade, setor: setor, tipo: tipo, finalidade: finalidade },
      idRequisicao,
      linhasItens
    );
    sheet.getRange(linhaNova, cols.documento).setValue(linkDocumento);
  } catch (erroDoc) {
    Logger.log("Falha ao gerar o documento da requisição " + idRequisicao + ": " + erroDoc);
  }

  try {
    var mensagem =
      "📦 NOVA REQUISIÇÃO OPERACIONAL\n\n" +
      "🆔 " + idRequisicao + "\n\n" +
      "👤 Requisitante: " + requisitante + "\n" +
      "🏭 Unidade solicitante: " + unidade + "\n" +
      "📍 Setor: " + setor + "\n\n" +
      "📋 Tipo: " + tipo + "\n\n" +
      "📦 Itens solicitados (" + linhasItens.length + "):\n" + linhasItens.join("\n") + "\n\n" +
      "🎯 Finalidade: " + finalidade + "\n\n" +
      "📄 Documento da requisição:\n" + (linkDocumento || "Documento pendente de geração") + "\n\n" +
      "🤖 Mamma Mia Operações";

    enviarTelegram(mensagem);
  } catch (erroTelegram) {
    Logger.log("Falha ao avisar no Telegram sobre a requisição " + idRequisicao + ": " + erroTelegram);
  }

  return { ok: true, id: idRequisicao };
}


/****************************************************
 * FECHAR REQUISIÇÃO
 ****************************************************/

function listarRequisicoesAbertas() {
  var sheet = obterSheet();
  var cols = obterMapaColunas(sheet);
  var dados = sheet.getDataRange().getValues();

  var abertas = [];
  for (var i = 1; i < dados.length; i++) {
    var linha = dados[i];
    var id = linha[cols.id - 1];
    var status = (linha[cols.status - 1] || "").toString().trim();
    if (!id || status === STATUS_ENTREGUE) continue;

    abertas.push({
      id: id,
      requisitante: linha[cols.requisitante - 1],
      unidade: linha[cols.unidade - 1],
      setor: linha[cols.setor - 1],
      tipo: linha[cols.tipo - 1],
      itens: (linha[cols.itens - 1] || "").toString(),
      finalidade: linha[cols.finalidade - 1],
    });
  }

  // Mais recente primeiro.
  abertas.reverse();

  return abertas;
}

function fecharRequisicao(id, entreguePor, observacoes) {
  id = (id || "").toString().trim();
  entreguePor = (entreguePor || "").toString().trim();
  observacoes = (observacoes || "").toString().trim();

  if (!id) throw new Error("Selecione uma requisição.");
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

  var statusAtual = (sheet.getRange(linhaEncontrada, cols.status).getValue() || "").toString().trim();
  if (statusAtual === STATUS_ENTREGUE) {
    throw new Error("Essa requisição já foi entregue por outra pessoa.");
  }

  var agora = new Date();
  sheet.getRange(linhaEncontrada, cols.status).setValue(STATUS_ENTREGUE);
  sheet.getRange(linhaEncontrada, cols.entreguePor).setValue(entreguePor);
  sheet.getRange(linhaEncontrada, cols.dataEntrega).setValue(agora);
  sheet.getRange(linhaEncontrada, cols.obsEntrega).setValue(observacoes);

  try {
    var mensagem =
      "✅ REQUISIÇÃO ENTREGUE\n\n" +
      "🆔 " + id + "\n" +
      "👤 Entregue por: " + entreguePor + "\n" +
      "🕒 " + Utilities.formatDate(agora, "America/Sao_Paulo", "dd/MM/yyyy HH:mm") +
      (observacoes ? "\n📝 Observações: " + observacoes : "");

    enviarTelegram(mensagem);
  } catch (erroTelegram) {
    Logger.log("Falha ao avisar no Telegram sobre a entrega da requisição " + id + ": " + erroTelegram);
  }

  return { ok: true, id: id };
}


/****************************************************
 * ROTEAMENTO DO WEB APP
 ****************************************************/

function doGet(e) {
  var tela = e && e.parameter && e.parameter.tela;

  if (tela === "abrir") {
    return HtmlService
      .createHtmlOutputFromFile("AbrirRequisicao")
      .setTitle("Abrir Requisição — Mamma Mia")
      .addMetaTag("viewport", "width=device-width, initial-scale=1");
  }

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
