/**
 * CÓDIGO COMPLETO — Manutenção Mamma Mia
 * ---------------------------------------------------------------------
 * Este arquivo é a versão CONSOLIDADA e final de tudo que já foi
 * construído (abertura de OS pelo Forms/página nova, fechamento de OS
 * pela equipe de manutenção, Trello, Telegram, PDFs). Ele substitui
 * TODO o seu Code.gs atual — não é mais uma "adição em camadas".
 *
 * Como instalar:
 * 1) Abra o Apps Script já vinculado à planilha (Extensões > Apps Script).
 * 2) Abra o seu Code.gs, selecione tudo (Ctrl/Cmd+A) e apague.
 * 3) Cole o conteúdo deste arquivo inteiro no lugar.
 * 4) Confirme que existe uma aba chamada "Manutenção" com os nomes dos
 *    técnicos na coluna A (você já tem essa, criada numa etapa anterior).
 * 5) Confirme que existe um arquivo HTML chamado "Index" (tela de fechar
 *    OS) e crie um novo arquivo HTML chamado "AbrirOS" (tela de abrir OS)
 *    — cole o conteúdo de AbrirOS.html nele.
 * 6) Implantar > Gerenciar implantações > ✏️ (editar) > Nova versão >
 *    Implantar — publica no MESMO link que a equipe já usa.
 *      - Fechar OS: <esse link>
 *      - Abrir OS:  <esse link>?tela=abrir
 */

/**
 * Localiza o índice (1-based, como usado por getRange) de uma coluna pelo
 * nome do cabeçalho na primeira linha da planilha. Isso evita o problema de
 * depender de um número de coluna fixo, que quebra silenciosamente sempre
 * que alguém insere ou remove uma coluna na planilha (ex: quando uma nova
 * pergunta é adicionada no meio do Google Form).
 * Lança erro claro se o cabeçalho não for encontrado, em vez de gravar
 * dados na coluna errada sem avisar.
 */
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
 * Monta um mapa com o índice de coluna (1-based) de cada campo usado no
 * sistema, todos localizados pelo cabeçalho. Chame uma vez por execução
 * (não dentro de loops) e reutilize o resultado.
 *
 * IMPORTANTE: os nomes abaixo devem bater exatamente com a linha 1 da
 * planilha. Se algum não bater, getColumnIndexByHeader vai lançar um erro
 * dizendo qual.
 */
function obterMapaColunas(sheet) {
  return {
    timestamp: getColumnIndexByHeader(sheet, "Timestamp"),
    os: getColumnIndexByHeader(sheet, "OS"),
    status: getColumnIndexByHeader(sheet, "STATUS"),
    prioridade: getColumnIndexByHeader(sheet, "PRIORIDADE"),
    trello: getColumnIndexByHeader(sheet, "TRELLO_CARD_ID"),
    pdfOs: getColumnIndexByHeader(sheet, "PDF_OS"),
    solicitante: getColumnIndexByHeader(sheet, "Nome do solicitante"),
    unidade: getColumnIndexByHeader(sheet, "UNIDADE"),
    setor: getColumnIndexByHeader(sheet, "Setor"),
    dataOcorrencia: getColumnIndexByHeader(sheet, "Data e hora da ocorrência"),
    tipoOcorrencia: getColumnIndexByHeader(sheet, "Tipo de ocorrência"),
    equipamentoLocal: getColumnIndexByHeader(sheet, "Equipamento ou local afetado"),
    fotoProblema: getColumnIndexByHeader(sheet, "Foto do problema"),
    codigoTag: getColumnIndexByHeader(sheet, "Código/Tag do equipamento"),
    descricao: getColumnIndexByHeader(sheet, "O que está acontecendo?"),
    parou: getColumnIndexByHeader(sheet, "O equipamento parou totalmente?"),
    impacto: getColumnIndexByHeader(sheet, "Impacto na produção"),
    gravidade: getColumnIndexByHeader(sheet, "Gravidade"),
    observacoes: getColumnIndexByHeader(sheet, "Observações adicionais"),
    oQueFoiFeito: getColumnIndexByHeader(sheet, "O que foi feito"),
    dataConclusao: getColumnIndexByHeader(sheet, "Data de conclusão"),
    assinadoPor: getColumnIndexByHeader(sheet, "Assinado por"),
    fotoConclusao: getColumnIndexByHeader(sheet, "Foto da conclusão"),
    pdfFechamento: getColumnIndexByHeader(sheet, "PDF Fechamento"),
  };
}

var STATUS_CONCLUIDO = "Concluído";
var NOME_ABA_TECNICOS = "Manutenção";
var ORDEM_PRIORIDADE = { "Crítica": 0, "Alta": 1, "Média": 2, "Baixa": 3 };
// Pasta do Drive usada por todos os anexos de OS: PDFs de abertura e
// fechamento, foto de conclusão e foto de abertura (quando enviada pela
// página nova).
var PASTA_ANEXOS_OS = "1nX2iKlFvWMG-7jvCSpwgf8ZOwiK1qRit";

/**
 * Descobre o próximo número sequencial de OS olhando o MAIOR número já
 * usado na coluna OS (extrai os dígitos finais de "OS-AAAAMMDD-NNN") e
 * soma 1. Isso é à prova de linhas em branco, linhas órfãs de uma
 * tentativa que falhou, ou qualquer outra coisa que desalinhe a posição
 * da linha do número real de OS já criadas — diferente de contar
 * "linha atual - 1", que quebra (e pode repetir um número já usado) se a
 * planilha tiver qualquer linha fora do padrão.
 */
function proximoNumeroSequencialOS(sheet, cols) {
  var ultimaLinha = sheet.getLastRow();
  if (ultimaLinha < 2) return 1;

  var valores = sheet.getRange(2, cols.os, ultimaLinha - 1, 1).getValues();
  var maior = 0;

  valores.forEach(function (linha) {
    var valor = (linha[0] || "").toString();
    var match = valor.match(/-(\d+)$/);
    if (match) {
      var numero = parseInt(match[1], 10);
      if (numero > maior) maior = numero;
    }
  });

  return maior + 1;
}

function onFormSubmit(e) {

  try {

    var sheet = SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheets()[0];

    var lastRow = sheet.getLastRow();

    var cols = obterMapaColunas(sheet);

    // DATA
    var agora = new Date();

    var dataFormatada = Utilities.formatDate(
      agora,
      "America/Sao_Paulo",
      "yyyyMMdd"
    );

    var numero = proximoNumeroSequencialOS(sheet, cols);

    var os =
      "OS-" +
      dataFormatada +
      "-" +
      ("000" + numero).slice(-3);

    // LINHA
    var linha = sheet
      .getRange(lastRow, 1, 1, sheet.getLastColumn())
      .getValues()[0];

    var timestamp = linha[cols.timestamp - 1];
    var solicitante = linha[cols.solicitante - 1];
    var setor = linha[cols.setor - 1];
    var dataOcorrencia = linha[cols.dataOcorrencia - 1];
    var tipoOcorrencia = linha[cols.tipoOcorrencia - 1];
    var equipamentoLocal = linha[cols.equipamentoLocal - 1];
    var fotoUrl = linha[cols.fotoProblema - 1];
    var codigoTag = linha[cols.codigoTag - 1];
    var descricao = linha[cols.descricao - 1];
    var parou = linha[cols.parou - 1];
    var impacto = linha[cols.impacto - 1];
    var gravidade = linha[cols.gravidade - 1];
    var observacoes = linha[cols.observacoes - 1];

    var prioridade = gravidade || "Baixa";

    // PLANILHA
    sheet.getRange(lastRow, cols.os).setValue(os);
    sheet.getRange(lastRow, cols.status).setValue("Aberto");
    sheet.getRange(lastRow, cols.prioridade).setValue(prioridade);

    var dadosOS = {
      os: os,
      status: "Aberto",
      prioridade: prioridade,
      solicitante: solicitante,
      setor: setor,
      dataOcorrencia: dataOcorrencia,
      tipoOcorrencia: tipoOcorrencia,
      equipamentoLocal: equipamentoLocal,
      fotoUrl: fotoUrl,
      codigoTag: codigoTag,
      descricao: descricao,
      parou: parou,
      impacto: impacto,
      observacoes: observacoes,
      timestamp: timestamp
    };

    // ---- TRELLO (isolado: uma falha aqui não impede o PDF) ----
    var cardId = "";
    try {
      cardId = criarCardOSNoTrello(dadosOS);
      sheet.getRange(lastRow, cols.trello).setValue(cardId);
    } catch (erroTrello) {
      Logger.log("Falha ao criar card no Trello: " + erroTrello);
      enviarErroTelegram(
        "⚠️ OS " + os + " aberta, mas falhou ao criar o card no Trello:\n\n" + erroTrello
      );
    }

    // ---- PDF (isolado: uma falha aqui não impede Telegram/Trello) ----
    var pdfLink = "";
    try {
      pdfLink = gerarPDFOS(dadosOS);
      sheet.getRange(lastRow, cols.pdfOs).setValue(pdfLink);
    } catch (erroPdf) {
      Logger.log("Falha ao gerar PDF da OS " + os + ": " + erroPdf);
      enviarErroTelegram(
        "⚠️ OS " + os + " aberta, mas o PDF NÃO foi gerado automaticamente.\n" +
        "Motivo: " + erroPdf + "\n\n" +
        "Rode a função gerarPDFsPendentes() no Apps Script para gerar o PDF retroativamente, " +
        "ou aguarde a próxima execução automática (se o gatilho estiver configurado)."
      );
    }

    // ---- TELEGRAM (sempre tenta avisar, mesmo se PDF/Trello falharam) ----
    try {
      enviarTelegramOSAberta({
        os: os,
        prioridade: prioridade,
        solicitante: solicitante,
        setor: setor,
        equipamentoLocal: equipamentoLocal,
        descricao: descricao,
        impacto: impacto,
        parou: parou,
        fotoUrl: fotoUrl,
        linkPDF: pdfLink || "PDF pendente de geração"
      });
    } catch (erroTelegram) {
      Logger.log("Falha ao enviar mensagem do Telegram: " + erroTelegram);
    }

  } catch (erro) {

    Logger.log(erro);

    enviarErroTelegram(
      "❌ ERRO AO ABRIR OS:\n\n" + erro
    );
  }
}

/**
 * Extrai o ID do arquivo do Drive a partir da URL gravada na pergunta de
 * upload de arquivo (funciona com os formatos "...?id=ID", "/d/ID/view"
 * etc). Se houver mais de um arquivo enviado (separados por vírgula), usa
 * apenas o primeiro.
 */
function extrairIdArquivoDrive(url) {
  if (!url) return null;

  var primeiraUrl = url.toString().split(",")[0].trim();

  // IDs de arquivo do Drive têm 25+ caracteres alfanuméricos/traço/underscore
  var match = primeiraUrl.match(/[-\w]{25,}/);

  return match ? match[0] : null;
}

/**
 * Busca o blob da foto do problema no Drive a partir da URL gravada.
 * Retorna null (em vez de lançar erro) se não houver foto ou se o arquivo
 * não estiver acessível — assim uma foto com problema nunca derruba a
 * geração do PDF nem o envio do Telegram.
 */
function obterBlobFotoDrive(fotoUrl) {

  var id = extrairIdArquivoDrive(fotoUrl);
  if (!id) return null;

  try {
    return DriveApp.getFileById(id).getBlob();
  } catch (erro) {
    Logger.log("Não foi possível acessar a foto do problema (id " + id + "): " + erro);
    return null;
  }
}

function criarCardOSNoTrello(dados) {

  var key = PropertiesService
    .getScriptProperties()
    .getProperty("TRELLO_KEY");

  var token = PropertiesService
    .getScriptProperties()
    .getProperty("TRELLO_TOKEN");

  var titulo =
    dados.os +
    " | " +
    dados.setor +
    " | " +
    dados.equipamentoLocal;

  var desc =

    "STATUS: " + dados.status + "\n" +
    "PRIORIDADE: " + dados.prioridade + "\n\n" +

    "Solicitante: " + dados.solicitante + "\n" +
    "Setor: " + dados.setor + "\n" +
    "Data ocorrência: " + formatarDataBR(dados.dataOcorrencia) + "\n" +
    "Tipo ocorrência: " + dados.tipoOcorrencia + "\n" +
    "Equipamento/Local: " + dados.equipamentoLocal + "\n" +
    "Código/Tag: " + dados.codigoTag + "\n" +
    "Descrição: " + dados.descricao + "\n" +
    "Parado totalmente?: " + dados.parou + "\n" +
    "Impacto: " + dados.impacto + "\n" +
    "Observações: " + dados.observacoes;

  var url = "https://api.trello.com/1/cards";

  var payload = {
    idList: "69acb5cd9a537d3334d81bc8",
    name: titulo,
    desc: desc,
    pos: "top",
    key: key,
    token: token
  };

  var response = UrlFetchApp.fetch(url, {
    method: "post",
    payload: payload
  });

  var json = JSON.parse(
    response.getContentText()
  );

  if (!json.id) {
    throw new Error("Trello não retornou um card ID válido: " + response.getContentText());
  }

  return json.id;
}

function moverCard(cardId, status) {

  try {

    var key = PropertiesService
      .getScriptProperties()
      .getProperty("TRELLO_KEY");

    var token = PropertiesService
      .getScriptProperties()
      .getProperty("TRELLO_TOKEN");

    var listas = {

      "Aberto": "69acb5cd9a537d3334d81bc8",
      "Em análise": "69c348d200ec6669fa84050c",
      "Em execução": "69c348e0614b5748c30f2816",
      "Aguardando peça": "69c348e76f3a09e0c9005e0b",
      "Concluído": "69c348e8ac771c62e12ed270"
    };

    var idList = listas[status];

    if (!idList) return;

    var url =

      "https://api.trello.com/1/cards/" +
      cardId +

      "?idList=" + idList +

      "&key=" + key +

      "&token=" + token;

    UrlFetchApp.fetch(url, {
      method: "put"
    });

  } catch (erro) {

    Logger.log(erro);
  }
}

function onEdit(e) {

  try {

    var sheet = e.range.getSheet();

    var row = e.range.getRow();

    var col = e.range.getColumn();

    if (row < 2) return;

    var cols = obterMapaColunas(sheet);

    if (col !== cols.status) return;

    var status =
      (e.range.getValue() || "")
      .toString()
      .trim();

    var cardId =
      sheet.getRange(row, cols.trello).getValue();

    if (!cardId) return;

    moverCard(cardId, status);

  } catch (erro) {

    Logger.log(erro);
  }
}

function enviarTelegramOSAberta(dados) {

  var TOKEN = PropertiesService
    .getScriptProperties()
    .getProperty("TELEGRAM_TOKEN");

  var CHAT_ID = PropertiesService
    .getScriptProperties()
    .getProperty("TELEGRAM_CHAT_ID");

  var mensagem =

    "🚨 NOVA OS ABERTA\n\n" +

    "🆔 " + dados.os + "\n" +

    "📍 Setor: " + dados.setor + "\n" +

    "⚠️ Prioridade: " + dados.prioridade + "\n" +

    "🛠️ Equipamento: " +
    dados.equipamentoLocal + "\n" +

    "📝 Descrição: " +
    dados.descricao + "\n" +

    "📉 Impacto: " +
    dados.impacto + "\n" +

    "⛔ Parado: " +
    dados.parou + "\n" +

    "👤 Solicitante: " +
    dados.solicitante + "\n\n" +

    "📄 PDF DA OS:\n" +
    dados.linkPDF;

  // ---- Tenta enviar com a foto anexada (via sendPhoto) ----
  var fotoBlob = obterBlobFotoDrive(dados.fotoUrl);

  if (fotoBlob) {
    try {
      var urlFoto =
        "https://api.telegram.org/bot" +
        TOKEN +
        "/sendPhoto";

      var payloadFoto = {
        chat_id: CHAT_ID,
        caption: mensagem, // Telegram corta legendas acima de 1024 caracteres
        photo: fotoBlob
      };

      UrlFetchApp.fetch(urlFoto, {
        method: "post",
        payload: payloadFoto
      });

      return; // já notificou com a foto, não precisa mandar texto de novo

    } catch (erroFoto) {
      Logger.log("Falha ao enviar foto no Telegram, enviando só o texto: " + erroFoto);
      // cai para o envio de texto simples abaixo
    }
  }

  // ---- Fallback: envia só o texto (sem foto, ou se a foto falhou) ----
  var urlTexto =
    "https://api.telegram.org/bot" +
    TOKEN +
    "/sendMessage";

  var payloadTexto = {
    chat_id: CHAT_ID,
    text: mensagem
  };

  UrlFetchApp.fetch(urlTexto, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payloadTexto)
  });
}

function enviarErroTelegram(mensagem) {

  try {

    var TOKEN = PropertiesService
      .getScriptProperties()
      .getProperty("TELEGRAM_TOKEN");

    var CHAT_ID = PropertiesService
      .getScriptProperties()
      .getProperty("TELEGRAM_CHAT_ID");

    var url =
      "https://api.telegram.org/bot" +
      TOKEN +
      "/sendMessage";

    var payload = {
      chat_id: CHAT_ID,
      text: mensagem
    };

    UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload)
    });

  } catch (e) {

    Logger.log(e);
  }
}

function gerarPDFOS(dados) {

  var pastaId =
    "1nX2iKlFvWMG-7jvCSpwgf8ZOwiK1qRit";

  var pasta =
    DriveApp.getFolderById(pastaId);

  var logoId =
    "1mBHCppmwzj65IlT7kCKXInhSV-ltqE3I";

  var logoBlob =
    DriveApp
      .getFileById(logoId)
      .getBlob();

  logoBlob.setContentType("image/png");

  var logoBase64 =
    Utilities.base64Encode(
      logoBlob.getBytes()
    );

  var logoSrc =
    "data:image/png;base64," +
    logoBase64;

  // ---- Foto do problema (opcional: se falhar, PDF é gerado sem ela) ----
  var fotoSrc = "";
  try {
    var fotoBlob = obterBlobFotoDrive(dados.fotoUrl);
    if (fotoBlob) {
      var fotoBase64 = Utilities.base64Encode(fotoBlob.getBytes());
      fotoSrc = "data:" + fotoBlob.getContentType() + ";base64," + fotoBase64;
    }
  } catch (erroFoto) {
    Logger.log("Falha ao embutir foto no PDF da OS " + dados.os + ": " + erroFoto);
  }

  var blocoFoto = fotoSrc
    ? '<div class="bloco"><div class="secao">FOTO DO PROBLEMA</div>' +
      '<img src="' + fotoSrc + '" style="max-width:100%;border-radius:8px;border:1px solid #ccc;"/></div>'
    : "";

  var html = `

  <html>

  <head>

    <style>

      body{
        font-family: Arial, sans-serif;
        padding: 30px;
        color:#222;
      }

      .topo{
        text-align:center;
        margin-bottom:25px;
      }

      .logo{
        width:180px;
        margin-bottom:15px;
      }

      .titulo{
        font-size:28px;
        font-weight:bold;
        color:#c62828;
      }

      .subtitulo{
        font-size:18px;
        font-weight:bold;
        margin-top:5px;
      }

      .bloco{
        border:1px solid #dcdcdc;
        border-radius:10px;
        padding:15px;
        margin-bottom:20px;
      }

      .secao{
        color:#c62828;
        font-size:16px;
        font-weight:bold;
        margin-bottom:10px;
      }

      .linha{
        margin-bottom:8px;
      }

      .descricao{
        border:1px solid #ccc;
        border-radius:8px;
        padding:12px;
        background:#fafafa;
        margin-top:10px;
      }

      .assinaturas{
        margin-top:80px;
        display:flex;
        justify-content:space-between;
      }

      .assinatura{
        width:40%;
        text-align:center;
      }

      .linha-ass{
        border-top:1px solid #000;
        padding-top:8px;
      }

    </style>

  </head>

  <body>

    <div class="topo">

      <img class="logo" src="${logoSrc}">

      <div class="titulo">
        ORDEM DE SERVIÇO
      </div>

      <div class="subtitulo">
        ${dados.os}
      </div>

    </div>

    <div class="bloco">

      <div class="secao">
        DADOS GERAIS
      </div>

      <div class="linha">
        <b>Status:</b> ${dados.status}
      </div>

      <div class="linha">
        <b>Prioridade:</b> ${dados.prioridade}
      </div>

      <div class="linha">
        <b>Solicitante:</b> ${dados.solicitante}
      </div>

      <div class="linha">
        <b>Setor:</b> ${dados.setor}
      </div>

      <div class="linha">
        <b>Data:</b>
        ${formatarDataBR(dados.timestamp)}
      </div>

    </div>

    <div class="bloco">

      <div class="secao">
        OCORRÊNCIA
      </div>

      <div class="linha">
        <b>Tipo:</b>
        ${dados.tipoOcorrencia}
      </div>

      <div class="linha">
        <b>Equipamento:</b>
        ${dados.equipamentoLocal}
      </div>

      <div class="linha">
        <b>Código:</b>
        ${dados.codigoTag}
      </div>

      <div class="linha">
        <b>Impacto:</b>
        ${dados.impacto}
      </div>

      <div class="linha">
        <b>Parado:</b>
        ${dados.parou}
      </div>

      <div class="descricao">
        ${dados.descricao}
      </div>

    </div>

    ${blocoFoto}

    <div class="assinaturas">

      <div class="assinatura">
        <div class="linha-ass">
          ASSINATURA DO REQUISITANTE
        </div>
      </div>

      <div class="assinatura">
        <div class="linha-ass">
          ASSINATURA DO EXECUTOR
        </div>
      </div>

    </div>

  </body>

  </html>

  `;

  var pdfBlob =
    HtmlService
      .createHtmlOutput(html)
      .getBlob()
      .getAs("application/pdf");

  var arquivo =
    pasta.createFile(pdfBlob);

  arquivo.setName(
    dados.os + ".pdf"
  );

  return arquivo.getUrl();
}

function formatarDataBR(valor) {

  if (!valor) return "";

  try {

    return Utilities.formatDate(
      new Date(valor),
      "America/Sao_Paulo",
      "dd/MM/yyyy HH:mm"
    );

  } catch (e) {

    return valor;
  }
}

/**
 * Varre a planilha e gera o PDF de qualquer OS que ainda não tenha
 * o link na coluna PDF_OS, em lotes de no máximo LIMITE_POR_EXECUCAO por
 * vez. Use isto para:
 * 1) Corrigir manualmente uma OS que falhou na hora da abertura
 *    (Apps Script > selecionar "gerarPDFsPendentes" > Executar).
 * 2) Configurar um gatilho de tempo pra rodar isso automaticamente.
 */
function gerarPDFsPendentes() {

  var LIMITE_POR_EXECUCAO = 25;

  try {

    var sheet =
      SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheets()[0];

    var cols = obterMapaColunas(sheet);

    var dados =
      sheet
      .getDataRange()
      .getValues();

    var gerados = 0;
    var falhas = 0;
    var pendentesRestantes = 0;

    for (var i = 1; i < dados.length; i++) {

      var linha = dados[i];

      var os = linha[cols.os - 1];
      var linkPDF = linha[cols.pdfOs - 1];

      if (!os || linkPDF) continue;

      if (gerados + falhas >= LIMITE_POR_EXECUCAO) {
        pendentesRestantes++;
        continue;
      }

      try {
        var pdf = gerarPDFOS({

          os: linha[cols.os - 1],
          status: linha[cols.status - 1],
          prioridade: linha[cols.prioridade - 1],
          solicitante: linha[cols.solicitante - 1],
          setor: linha[cols.setor - 1],
          dataOcorrencia: linha[cols.dataOcorrencia - 1],
          tipoOcorrencia: linha[cols.tipoOcorrencia - 1],
          equipamentoLocal: linha[cols.equipamentoLocal - 1],
          fotoUrl: linha[cols.fotoProblema - 1],
          codigoTag: linha[cols.codigoTag - 1],
          descricao: linha[cols.descricao - 1],
          parou: linha[cols.parou - 1],
          impacto: linha[cols.impacto - 1],
          observacoes: linha[cols.observacoes - 1],
          timestamp: linha[cols.timestamp - 1]
        });

        sheet
          .getRange(i + 1, cols.pdfOs)
          .setValue(pdf);

        gerados++;

      } catch (erroLinha) {
        Logger.log("Falha ao gerar PDF pendente da OS " + os + ": " + erroLinha);
        falhas++;
      }
    }

    var resumo = gerados + " PDF(s) gerado(s) com sucesso.";
    if (falhas > 0) resumo += " " + falhas + " falharam novamente (veja os Logs).";
    if (pendentesRestantes > 0) resumo += " " + pendentesRestantes + " ainda ficaram pendentes (acima do limite de " + LIMITE_POR_EXECUCAO + " por execução) — rode a função de novo, ou deixe o gatilho automático cuidar disso.";

    Logger.log(resumo);

    if (gerados > 0 || falhas > 0 || pendentesRestantes > 0) {
      enviarErroTelegram("📄 gerarPDFsPendentes:\n\n" + resumo);
    }

  } catch (erro) {

    Logger.log(erro);

    enviarErroTelegram(
      "❌ Erro ao rodar gerarPDFsPendentes:\n\n" + erro
    );
  }
}

/**
 * Lista as OS ainda não concluídas, para a tela de fechamento (chamada
 * pelo cliente via google.script.run). Ordenada por prioridade — Crítica
 * primeiro; dentro da mesma prioridade, mantém a ordem da planilha.
 */
function listarOSAbertas() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  var cols = obterMapaColunas(sheet);
  var dados = sheet.getDataRange().getValues();

  var abertas = [];
  for (var i = 1; i < dados.length; i++) {
    var linha = dados[i];
    var os = linha[cols.os - 1];
    var status = (linha[cols.status - 1] || "").toString().trim();
    if (!os || status === STATUS_CONCLUIDO) continue;

    abertas.push({
      os: os,
      status: status,
      prioridade: (linha[cols.prioridade - 1] || "").toString().trim(),
      setor: linha[cols.setor - 1],
      equipamento: linha[cols.equipamentoLocal - 1],
      descricao: linha[cols.descricao - 1],
    });
  }

  abertas.sort(function (a, b) {
    var pa = ORDEM_PRIORIDADE.hasOwnProperty(a.prioridade) ? ORDEM_PRIORIDADE[a.prioridade] : 9;
    var pb = ORDEM_PRIORIDADE.hasOwnProperty(b.prioridade) ? ORDEM_PRIORIDADE[b.prioridade] : 9;
    return pa - pb;
  });

  return abertas;
}

/**
 * Lê a lista de técnicos da aba "Manutenção" (coluna A). Ignora células
 * vazias e uma eventual primeira linha de cabeçalho (ex: "Nome", "Técnico").
 */
function listarTecnicos() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName(NOME_ABA_TECNICOS);
  if (!aba) {
    throw new Error('Aba "' + NOME_ABA_TECNICOS + '" não foi encontrada na planilha.');
  }

  var ultimaLinha = aba.getLastRow();
  if (ultimaLinha < 1) return [];

  var valores = aba.getRange(1, 1, ultimaLinha, 1).getValues();
  var CABECALHOS_CONHECIDOS = ["NOME", "TÉCNICO", "TECNICO", "MANUTENÇÃO", "MANUTENCAO"];

  return valores
    .map(function (linha) { return (linha[0] || "").toString().trim(); })
    .filter(function (nome, idx) {
      if (!nome) return false;
      if (idx === 0 && CABECALHOS_CONHECIDOS.indexOf(nome.toUpperCase()) !== -1) return false;
      return true;
    });
}

/**
 * Salva a foto do problema resolvido na mesma pasta do Drive usada pelos
 * PDFs de OS (gerarPDFOS). Devolve a URL do arquivo E o blob em memória
 * (pra gerarPDFFechamentoOS não precisar buscar a foto de novo no Drive).
 * fotoBase64 vem sem o prefixo "data:...;base64," — isso é removido no
 * cliente antes de chamar fecharOS.
 */
function salvarFotoConclusao(osId, fotoBase64, mimeType) {
  var pasta = DriveApp.getFolderById(PASTA_ANEXOS_OS);
  var bytes = Utilities.base64Decode(fotoBase64);
  var blob = Utilities.newBlob(bytes, mimeType || "image/jpeg", osId + "-conclusao.jpg");
  var arquivo = pasta.createFile(blob);
  return { url: arquivo.getUrl(), blob: blob };
}

/**
 * Gera o PDF da OS fechada — mesmo estilo visual do gerarPDFOS usado na
 * abertura — com os dados originais da ocorrência, a resolução (o que foi
 * feito, quem assinou, quando) e as fotos de antes/depois. Salva na mesma
 * pasta do Drive dos outros PDFs de OS e devolve a URL do arquivo.
 */
function gerarPDFFechamentoOS(dados) {
  var pasta = DriveApp.getFolderById(PASTA_ANEXOS_OS);

  var logoId = "1mBHCppmwzj65IlT7kCKXInhSV-ltqE3I";
  var logoBlob = DriveApp.getFileById(logoId).getBlob();
  logoBlob.setContentType("image/png");
  var logoSrc = "data:image/png;base64," + Utilities.base64Encode(logoBlob.getBytes());

  // Foto do problema original (antes) — opcional, mesma lógica do gerarPDFOS.
  var fotoProblemaSrc = "";
  try {
    var blobProblema = obterBlobFotoDrive(dados.fotoProblemaUrl);
    if (blobProblema) {
      fotoProblemaSrc = "data:" + blobProblema.getContentType() + ";base64," + Utilities.base64Encode(blobProblema.getBytes());
    }
  } catch (erroFoto) {
    Logger.log("Falha ao embutir foto do problema no PDF de fechamento da OS " + dados.os + ": " + erroFoto);
  }
  // Foto da conclusão (depois) — sempre presente, já em memória.
  var fotoConclusaoSrc = "data:" + dados.fotoConclusaoBlob.getContentType() + ";base64," + Utilities.base64Encode(dados.fotoConclusaoBlob.getBytes());

  // Antes/depois lado a lado (quando há foto do problema original) com altura
  // limitada, pra não deixar uma foto vertical do celular estourar a página e
  // sobrar espaço em branco embaixo — tudo precisa caber numa página só.
  var blocoFotos = fotoProblemaSrc
    ? '<div class="bloco">' +
        '<div class="secao">ANTES / DEPOIS</div>' +
        '<div class="fotos-lado-a-lado">' +
          '<div class="foto-item"><div class="foto-legenda">Antes</div><img src="' + fotoProblemaSrc + '"></div>' +
          '<div class="foto-item"><div class="foto-legenda">Depois</div><img src="' + fotoConclusaoSrc + '"></div>' +
        '</div>' +
      '</div>'
    : '<div class="bloco">' +
        '<div class="secao">FOTO DO PROBLEMA RESOLVIDO</div>' +
        '<img class="foto-unica" src="' + fotoConclusaoSrc + '">' +
      '</div>';

  var html = `

  <html>

  <head>

    <style>

      body{
        font-family: Arial, sans-serif;
        padding: 22px;
        color:#222;
      }

      .topo{
        text-align:center;
        margin-bottom:14px;
      }

      .logo{
        width:130px;
        margin-bottom:8px;
      }

      .titulo{
        font-size:22px;
        font-weight:bold;
        color:#2e7d32;
      }

      .subtitulo{
        font-size:16px;
        font-weight:bold;
        margin-top:4px;
      }

      .bloco{
        border:1px solid #dcdcdc;
        border-radius:10px;
        padding:12px;
        margin-bottom:12px;
        page-break-inside: avoid;
      }

      .secao{
        color:#2e7d32;
        font-size:14px;
        font-weight:bold;
        margin-bottom:8px;
      }

      .linha{
        font-size:13px;
        margin-bottom:6px;
      }

      .descricao{
        border:1px solid #ccc;
        border-radius:8px;
        padding:10px;
        background:#fafafa;
        margin-top:8px;
        font-size:13px;
      }

      .fotos-lado-a-lado{
        display:flex;
        gap:12px;
      }

      .foto-item{
        flex:1;
        min-width:0;
      }

      .foto-legenda{
        font-size:11px;
        font-weight:bold;
        color:#666;
        text-transform:uppercase;
        letter-spacing:0.03em;
        margin-bottom:4px;
        text-align:center;
      }

      .foto-item img, .foto-unica{
        width:100%;
        max-height:260px;
        object-fit:contain;
        background:#f4f4f4;
        border-radius:8px;
        border:1px solid #ccc;
        display:block;
      }

      .assinatura-digital{
        margin-top:14px;
        padding-top:10px;
        border-top:1px dashed #ccc;
        font-size:12px;
        color:#555;
        text-align:center;
      }

    </style>

  </head>

  <body>

    <div class="topo">

      <img class="logo" src="${logoSrc}">

      <div class="titulo">
        ORDEM DE SERVIÇO — CONCLUÍDA
      </div>

      <div class="subtitulo">
        ${dados.os}
      </div>

    </div>

    <div class="bloco">

      <div class="secao">
        DADOS GERAIS
      </div>

      <div class="linha">
        <b>Prioridade:</b> ${dados.prioridade}
      </div>

      <div class="linha">
        <b>Solicitante:</b> ${dados.solicitante}
      </div>

      <div class="linha">
        <b>Setor:</b> ${dados.setor}
      </div>

      <div class="linha">
        <b>Aberta em:</b> ${formatarDataBR(dados.dataOcorrencia)}
      </div>

    </div>

    <div class="bloco">

      <div class="secao">
        OCORRÊNCIA ORIGINAL
      </div>

      <div class="linha">
        <b>Equipamento:</b>
        ${dados.equipamentoLocal}
      </div>

      <div class="linha">
        <b>Código:</b>
        ${dados.codigoTag}
      </div>

      <div class="descricao">
        ${dados.descricao}
      </div>

    </div>

    <div class="bloco">

      <div class="secao">
        RESOLUÇÃO
      </div>

      <div class="linha">
        <b>Concluída em:</b>
        ${formatarDataBR(dados.dataConclusao)}
      </div>

      <div class="descricao">
        ${dados.oQueFoiFeito}
      </div>

    </div>

    ${blocoFotos}

    <div class="assinatura-digital">
      Baixa assinada digitalmente por <b>${dados.assinadoPor}</b> em ${formatarDataBR(dados.dataConclusao)},
      pelo app de fechamento de OS da manutenção.
    </div>

  </body>

  </html>

  `;

  var pdfBlob =
    HtmlService
      .createHtmlOutput(html)
      .getBlob()
      .getAs("application/pdf");
  pdfBlob.setName(dados.os + "-fechamento.pdf");

  var arquivo = pasta.createFile(pdfBlob);
  arquivo.setName(dados.os + "-fechamento.pdf");

  return { url: arquivo.getUrl(), blob: pdfBlob };
}

/**
 * Dá baixa numa OS: grava Status = Concluído, o que foi feito, data/hora
 * de conclusão, quem assinou e a foto do problema resolvido (obrigatória).
 * Gera o PDF de fechamento, tenta mover o card no Trello e avisar no
 * Telegram — se qualquer uma dessas três falhar, a baixa já gravada na
 * planilha NÃO é desfeita; a falha só fica registrada no Log.
 */
function fecharOS(osId, oQueFoiFeito, assinadoPor, fotoBase64, fotoTipo) {
  osId = (osId || "").toString().trim();
  oQueFoiFeito = (oQueFoiFeito || "").toString().trim();
  assinadoPor = (assinadoPor || "").toString().trim();

  if (!osId) throw new Error("Selecione uma OS.");
  if (!oQueFoiFeito) throw new Error("Descreva o que foi feito antes de confirmar.");
  if (!assinadoPor) throw new Error("Selecione quem está assinando a baixa.");
  if (!fotoBase64) throw new Error("Tire uma foto do problema resolvido antes de confirmar.");

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  var cols = obterMapaColunas(sheet);
  var dados = sheet.getDataRange().getValues();

  var linhaEncontrada = -1;
  var linhaAtual = null;
  for (var i = 1; i < dados.length; i++) {
    if ((dados[i][cols.os - 1] || "").toString().trim() === osId) {
      linhaEncontrada = i + 1; // +1 porque getRange é 1-based
      linhaAtual = dados[i];
      break;
    }
  }
  if (linhaEncontrada === -1) throw new Error("OS não encontrada: " + osId);

  var statusAtual = (sheet.getRange(linhaEncontrada, cols.status).getValue() || "").toString().trim();
  if (statusAtual === STATUS_CONCLUIDO) {
    throw new Error("Essa OS já foi fechada por outra pessoa.");
  }

  var resultadoFoto = salvarFotoConclusao(osId, fotoBase64, fotoTipo);

  var agora = new Date();
  sheet.getRange(linhaEncontrada, cols.status).setValue(STATUS_CONCLUIDO);
  sheet.getRange(linhaEncontrada, cols.oQueFoiFeito).setValue(oQueFoiFeito);
  sheet.getRange(linhaEncontrada, cols.dataConclusao).setValue(agora);
  sheet.getRange(linhaEncontrada, cols.assinadoPor).setValue(assinadoPor);
  sheet.getRange(linhaEncontrada, cols.fotoConclusao).setValue(resultadoFoto.url);

  var resultadoPdf = null;
  try {
    resultadoPdf = gerarPDFFechamentoOS({
      os: osId,
      prioridade: (linhaAtual[cols.prioridade - 1] || "").toString().trim(),
      solicitante: linhaAtual[cols.solicitante - 1],
      setor: linhaAtual[cols.setor - 1],
      dataOcorrencia: linhaAtual[cols.dataOcorrencia - 1],
      equipamentoLocal: linhaAtual[cols.equipamentoLocal - 1],
      codigoTag: linhaAtual[cols.codigoTag - 1],
      descricao: linhaAtual[cols.descricao - 1],
      fotoProblemaUrl: linhaAtual[cols.fotoProblema - 1],
      oQueFoiFeito: oQueFoiFeito,
      assinadoPor: assinadoPor,
      dataConclusao: agora,
      fotoConclusaoBlob: resultadoFoto.blob,
    });
    sheet.getRange(linhaEncontrada, cols.pdfFechamento).setValue(resultadoPdf.url);
  } catch (erroPdf) {
    Logger.log("Falha ao gerar PDF de fechamento da OS " + osId + ": " + erroPdf);
  }

  try {
    var cardId = sheet.getRange(linhaEncontrada, cols.trello).getValue();
    if (cardId) moverCard(cardId, STATUS_CONCLUIDO);
  } catch (erroTrello) {
    Logger.log("Falha ao mover card no Trello pra OS " + osId + ": " + erroTrello);
  }

  try {
    enviarTelegramOSFechada({
      os: osId,
      oQueFoiFeito: oQueFoiFeito,
      assinadoPor: assinadoPor,
      dataConclusao: agora,
      fotoUrl: resultadoFoto.url,
      pdfUrl: resultadoPdf ? resultadoPdf.url : "PDF pendente de geração",
      pdfBlob: resultadoPdf ? resultadoPdf.blob : null,
    });
  } catch (erroTelegram) {
    Logger.log("Falha ao avisar no Telegram sobre a baixa da OS " + osId + ": " + erroTelegram);
  }

  return { ok: true, os: osId, pdfUrl: resultadoPdf ? resultadoPdf.url : "" };
}

function enviarTelegramOSFechada(dados) {
  var TOKEN = PropertiesService.getScriptProperties().getProperty("TELEGRAM_TOKEN");
  var CHAT_ID = PropertiesService.getScriptProperties().getProperty("TELEGRAM_CHAT_ID");

  var mensagem =
    "✅ OS FECHADA\n\n" +
    "🆔 " + dados.os + "\n" +
    "👤 Assinado por: " + dados.assinadoPor + "\n" +
    "🕒 " + formatarDataBR(dados.dataConclusao) + "\n" +
    "📝 O que foi feito: " + dados.oQueFoiFeito + "\n" +
    "📸 Foto: " + dados.fotoUrl;

  // ---- Tenta enviar o PDF de fechamento anexado (via sendDocument) ----
  if (dados.pdfBlob) {
    try {
      var urlDoc = "https://api.telegram.org/bot" + TOKEN + "/sendDocument";
      var payloadDoc = {
        chat_id: CHAT_ID,
        caption: mensagem, // Telegram corta legendas acima de 1024 caracteres
        document: dados.pdfBlob,
      };
      UrlFetchApp.fetch(urlDoc, { method: "post", payload: payloadDoc });
      return; // já notificou com o PDF anexado, não precisa mandar texto de novo
    } catch (erroDoc) {
      Logger.log("Falha ao enviar PDF no Telegram, enviando só o texto: " + erroDoc);
      // cai para o envio de texto simples abaixo
    }
  }

  // ---- Fallback: envia só o texto com o link (sem PDF anexado, ou se falhou) ----
  var mensagemComLink = mensagem + "\n📄 PDF: " + dados.pdfUrl;
  var url = "https://api.telegram.org/bot" + TOKEN + "/sendMessage";
  UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({ chat_id: CHAT_ID, text: mensagemComLink }),
  });
}

/**
 * Salva a foto do problema (opcional) na mesma pasta do Drive usada pelos
 * PDFs de OS e pelas fotos de conclusão. Devolve "" se não houver foto —
 * diferente da foto de conclusão do fechamento, aqui ela não é obrigatória
 * (mesmo comportamento do campo de upload no Google Forms).
 * fotoBase64 vem sem o prefixo "data:...;base64," — isso é removido no
 * cliente antes de chamar abrirOS.
 */
function salvarFotoAbertura(fotoBase64, mimeType) {
  if (!fotoBase64) return "";

  var pasta = DriveApp.getFolderById(PASTA_ANEXOS_OS);
  var bytes = Utilities.base64Decode(fotoBase64);
  var nomeArquivo = "abertura-" + Utilities.formatDate(new Date(), "America/Sao_Paulo", "yyyyMMdd-HHmmss") + ".jpg";
  var blob = Utilities.newBlob(bytes, mimeType || "image/jpeg", nomeArquivo);
  var arquivo = pasta.createFile(blob);
  return arquivo.getUrl();
}

/**
 * Abre uma OS nova a partir da página AbrirOS.html: valida os campos
 * obrigatórios (mesma lista de obrigatórios do Google Forms atual), salva
 * a foto (se houver), adiciona uma linha na planilha e chama o
 * onFormSubmit() já existente — que gera o número da OS, cria o card no
 * Trello, gera o PDF de abertura e avisa no Telegram, exatamente como já
 * faz hoje pro Forms. Devolve o número da OS gerada pro cliente mostrar.
 */
function abrirOS(dados) {
  dados = dados || {};

  var CAMPOS_OBRIGATORIOS = [
    ["solicitante", "Nome do solicitante"],
    ["unidade", "Unidade"],
    ["setor", "Setor"],
    ["dataOcorrencia", "Data e hora da ocorrência"],
    ["tipoOcorrencia", "Tipo de ocorrência"],
    ["equipamentoLocal", "Equipamento ou local afetado"],
    ["codigoTag", "Código/Tag do equipamento"],
    ["descricao", "O que está acontecendo?"],
    ["parou", "O equipamento parou totalmente?"],
    ["impacto", "Impacto na produção"],
    ["gravidade", "Gravidade"],
  ];

  for (var i = 0; i < CAMPOS_OBRIGATORIOS.length; i++) {
    var chave = CAMPOS_OBRIGATORIOS[i][0];
    var rotulo = CAMPOS_OBRIGATORIOS[i][1];
    if (!(dados[chave] || "").toString().trim()) {
      throw new Error('Preencha o campo "' + rotulo + '" antes de enviar.');
    }
  }

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  var cols = obterMapaColunas(sheet);

  var fotoUrl = "";
  try {
    fotoUrl = salvarFotoAbertura(dados.fotoBase64, dados.fotoTipo);
  } catch (erroFoto) {
    throw new Error("Não foi possível enviar a foto. Tente novamente.");
  }

  var linha = new Array(sheet.getLastColumn()).fill("");
  linha[cols.timestamp - 1] = new Date();
  linha[cols.solicitante - 1] = dados.solicitante;
  linha[cols.unidade - 1] = dados.unidade;
  linha[cols.setor - 1] = dados.setor;
  // O campo datetime-local do cliente manda uma string tipo "2026-08-28T14:30"
  // (hora local do celular). Convertida aqui pra Date, igual as outras
  // colunas de data/hora da planilha (Timestamp, Data de conclusão etc.).
  linha[cols.dataOcorrencia - 1] = new Date(dados.dataOcorrencia);
  linha[cols.tipoOcorrencia - 1] = dados.tipoOcorrencia;
  linha[cols.equipamentoLocal - 1] = dados.equipamentoLocal;
  linha[cols.codigoTag - 1] = dados.codigoTag;
  linha[cols.descricao - 1] = dados.descricao;
  linha[cols.parou - 1] = dados.parou;
  linha[cols.impacto - 1] = dados.impacto;
  linha[cols.gravidade - 1] = dados.gravidade;
  linha[cols.observacoes - 1] = dados.observacoes || "";
  linha[cols.fotoProblema - 1] = fotoUrl;
  // OS, STATUS, PRIORIDADE, TRELLO_CARD_ID e PDF_OS ficam em branco — quem
  // preenche é o onFormSubmit() chamado logo abaixo.

  sheet.appendRow(linha);
  var linhaNova = sheet.getLastRow();

  onFormSubmit();

  var osGerada = sheet.getRange(linhaNova, cols.os).getValue();
  return { ok: true, os: osGerada };
}

/**
 * Serve a tela certa quando o Web App é aberto pelo navegador:
 * ".../exec" (sem parâmetro) → menu com os 2 botões (Menu.html);
 * ".../exec?tela=abrir" → tela de abrir OS (AbrirOS.html);
 * ".../exec?tela=fechar" → tela de fechar OS (Index.html).
 */
function doGet(e) {
  var tela = e && e.parameter && e.parameter.tela;

  if (tela === "abrir") {
    return HtmlService
      .createHtmlOutputFromFile("AbrirOS")
      .setTitle("Abrir OS — Manutenção Mamma Mia")
      .addMetaTag("viewport", "width=device-width, initial-scale=1");
  }

  if (tela === "fechar") {
    return HtmlService
      .createHtmlOutputFromFile("Index")
      .setTitle("Fechar OS — Manutenção Mamma Mia")
      .addMetaTag("viewport", "width=device-width, initial-scale=1");
  }

  return HtmlService
    .createHtmlOutputFromFile("Menu")
    .setTitle("Manutenção Mamma Mia")
    .addMetaTag("viewport", "width=device-width, initial-scale=1");
}
