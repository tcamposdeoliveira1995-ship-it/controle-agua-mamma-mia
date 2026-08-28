/**
 * FECHAMENTO DE OS PELA MANUTENÇÃO — adições ao Code.gs já existente
 * ---------------------------------------------------------------------
 * ATUALIZAÇÃO (v3): gera um PDF da OS fechada (mesmo estilo visual do
 * gerarPDFOS que vocês já usam na abertura), com o que foi feito, quem
 * assinou e as fotos de antes/depois — link salvo na planilha e enviado
 * no aviso do Telegram.
 *
 * Se você AINDA NÃO colou nenhuma versão deste arquivo: siga os passos
 * 1 a 8 abaixo inteiros, na ordem — já estão com a versão v3.
 *
 * Se você JÁ COLOU a v1 ou v2: leia o aviso "SÓ QUEM JÁ TEM UMA VERSÃO
 * ANTERIOR" antes de cada função abaixo.
 *
 * ─────────────────────────────────────────────────────────────────────
 * Como instalar (do zero):
 * 1) Na planilha de OS, adicione ao cabeçalho (linha 1) estas 5 colunas
 *    novas, com esse nome exato (em qualquer posição):
 *      "O que foi feito"
 *      "Data de conclusão"
 *      "Assinado por"
 *      "Foto da conclusão"
 *      "PDF Fechamento"
 * 2) Confirme que existe uma aba chamada "Manutenção" com os nomes dos
 *    técnicos na coluna A (uma linha de cabeçalho como "Nome" é opcional
 *    — o código ignora automaticamente).
 * 3) Abra o Apps Script já vinculado à planilha (Extensões > Apps Script).
 * 4) A função obterMapaColunas() já existe no seu Code.gs — SUBSTITUA ela
 *    inteira pela versão abaixo (é a mesma, só com 5 chaves novas no
 *    final). Não duplique a função.
 * 5) Cole o restante deste arquivo (listarOSAbertas, listarTecnicos,
 *    salvarFotoConclusao, gerarPDFFechamentoOS, fecharOS,
 *    enviarTelegramOSFechada) no final do seu Code.gs.
 * 6) Se o seu Code.gs já tem uma função doGet, ajuste-a para retornar
 *    HtmlService.createHtmlOutputFromFile('Index') como no exemplo do
 *    final deste arquivo. Se não tiver nenhuma, cole a função doGet daqui.
 * 7) Crie um arquivo novo no projeto do Apps Script chamado "Index"
 *    (tipo HTML) e cole o conteúdo de Index.html (arquivo ao lado deste).
 * 8) Implantar > Nova implantação > App da Web:
 *      Executar como: Eu
 *      Quem pode acessar: Qualquer pessoa
 *    Copie o link gerado e compartilhe com a equipe de manutenção.
 *
 * ─────────────────────────────────────────────────────────────────────
 * SÓ QUEM JÁ TEM UMA VERSÃO ANTERIOR — o que muda:
 * a) Adicione a coluna nova "PDF Fechamento" no cabeçalho da planilha
 *    (as outras 4 colunas você já tem).
 * b) Ache a obterMapaColunas() que você já colou e adicione só esta linha
 *    dentro do objeto, junto das outras "novas colunas":
 *      pdfFechamento: getColumnIndexByHeader(sheet, "PDF Fechamento"),
 * c) SUBSTITUA o salvarFotoConclusao() e o fecharOS() que você já colou
 *    pelas versões abaixo (o salvarFotoConclusao agora também devolve a
 *    foto em memória, pra não precisar buscar ela de novo no Drive na
 *    hora de montar o PDF; o fecharOS agora gera o PDF de fechamento).
 * d) Adicione a função nova gerarPDFFechamentoOS() (ela ainda não existe
 *    no que você colou).
 * e) SUBSTITUA a enviarTelegramOSFechada() pela versão abaixo (agora
 *    inclui o link do PDF no aviso).
 * f) SUBSTITUA o Index.html inteiro pelo novo (mostra o link do PDF na
 *    tela de sucesso).
 * g) Volte em Implantar > Gerenciar implantações > ✏️ (editar) > Nova
 *    versão > Implantar — pra publicar essa atualização no link que a
 *    equipe já usa (não precisa gerar um link novo).
 */

// ── Substitui a obterMapaColunas() existente — mesmas chaves de antes, +5 novas ──
function obterMapaColunas(sheet) {
  return {
    timestamp: getColumnIndexByHeader(sheet, "Timestamp"),
    os: getColumnIndexByHeader(sheet, "OS"),
    status: getColumnIndexByHeader(sheet, "STATUS"),
    prioridade: getColumnIndexByHeader(sheet, "PRIORIDADE"),
    trello: getColumnIndexByHeader(sheet, "TRELLO_CARD_ID"),
    pdfOs: getColumnIndexByHeader(sheet, "PDF_OS"),
    solicitante: getColumnIndexByHeader(sheet, "Nome do solicitante"),
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
    // Novas colunas, usadas pelo fechamento de OS pela manutenção:
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
// Mesma pasta do Drive já usada por gerarPDFOS() para os PDFs de OS.
var PASTA_ANEXOS_OS = "1nX2iKlFvWMG-7jvCSpwgf8ZOwiK1qRit";

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
        max-height:210px;
        object-fit:cover;
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

  // Devolve a URL (salva na planilha) e o blob em memória (pra anexar
  // direto no Telegram sem precisar baixar o PDF de novo do Drive).
  return { url: arquivo.getUrl(), blob: pdfBlob };
}

/**
 * Dá baixa numa OS: grava Status = Concluído, o que foi feito, data/hora
 * de conclusão (hora do servidor, não do celular do técnico — mais
 * confiável), quem assinou e a foto do problema resolvido (obrigatória).
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

  // Salva a foto ANTES de gravar qualquer coisa na planilha: se o upload
  // falhar, a OS continua aberta e o técnico pode tentar de novo, em vez
  // de ficar com uma baixa "pela metade" sem foto.
  var resultadoFoto = salvarFotoConclusao(osId, fotoBase64, fotoTipo);

  var agora = new Date();
  sheet.getRange(linhaEncontrada, cols.status).setValue(STATUS_CONCLUIDO);
  sheet.getRange(linhaEncontrada, cols.oQueFoiFeito).setValue(oQueFoiFeito);
  sheet.getRange(linhaEncontrada, cols.dataConclusao).setValue(agora);
  sheet.getRange(linhaEncontrada, cols.assinadoPor).setValue(assinadoPor);
  sheet.getRange(linhaEncontrada, cols.fotoConclusao).setValue(resultadoFoto.url);

  // PDF de fechamento: reaproveita o estilo visual do gerarPDFOS. Uma
  // falha aqui não desfaz a baixa (ela já foi gravada na planilha acima).
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

  // Trello: reaproveita moverCard(), já existente no Code.gs. Uma falha
  // aqui não desfaz a baixa (ela já foi gravada na planilha acima).
  try {
    var cardId = sheet.getRange(linhaEncontrada, cols.trello).getValue();
    if (cardId) moverCard(cardId, STATUS_CONCLUIDO);
  } catch (erroTrello) {
    Logger.log("Falha ao mover card no Trello pra OS " + osId + ": " + erroTrello);
  }

  // Telegram: aviso de baixa, com o PDF anexado, mesmo padrão de
  // enviarTelegramOSAberta() (que anexa a foto do problema).
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
 * Serve a tela de fechamento de OS (arquivo Index.html) quando o Web App
 * é aberto pelo navegador. Se o seu Code.gs JÁ TEM uma função doGet (para
 * outra finalidade), não cole esta — em vez disso, ajuste a que já existe
 * para retornar isto no lugar que fizer sentido.
 */
function doGet(e) {
  return HtmlService
    .createHtmlOutputFromFile("Index")
    .setTitle("Fechar OS — Manutenção Mamma Mia")
    .addMetaTag("viewport", "width=device-width, initial-scale=1");
}
