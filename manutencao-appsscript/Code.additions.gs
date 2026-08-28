/**
 * FECHAMENTO DE OS PELA MANUTENÇÃO — adições ao Code.gs já existente
 * ---------------------------------------------------------------------
 * ATUALIZAÇÃO (v2): adiciona a foto do problema resolvido, obrigatória
 * pra fechar a OS, salva na mesma pasta do Drive usada pelos PDFs.
 *
 * Se você AINDA NÃO colou a v1 deste arquivo: siga os passos 1 a 8 abaixo
 * inteiros, na ordem — já estão com a versão v2.
 *
 * Se você JÁ COLOU a v1 (já tem listarOSAbertas, listarTecnicos, fecharOS,
 * enviarTelegramOSFechada e doGet no seu Code.gs funcionando): só muda 2
 * coisas — leia o aviso "SÓ QUEM JÁ TEM A V1" antes de cada função abaixo.
 *
 * ─────────────────────────────────────────────────────────────────────
 * Como instalar (do zero):
 * 1) Na planilha de OS, adicione ao cabeçalho (linha 1) estas 4 colunas
 *    novas, com esse nome exato (em qualquer posição):
 *      "O que foi feito"
 *      "Data de conclusão"
 *      "Assinado por"
 *      "Foto da conclusão"
 * 2) Confirme que existe uma aba chamada "Manutenção" com os nomes dos
 *    técnicos na coluna A (uma linha de cabeçalho como "Nome" é opcional
 *    — o código ignora automaticamente).
 * 3) Abra o Apps Script já vinculado à planilha (Extensões > Apps Script).
 * 4) A função obterMapaColunas() já existe no seu Code.gs — SUBSTITUA ela
 *    inteira pela versão abaixo (é a mesma, só com 4 chaves novas no
 *    final). Não duplique a função.
 * 5) Cole o restante deste arquivo (listarOSAbertas, listarTecnicos,
 *    fecharOS, salvarFotoConclusao, enviarTelegramOSFechada) no final do
 *    seu Code.gs.
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
 * SÓ QUEM JÁ TEM A V1 — o que muda:
 * a) Adicione a coluna nova "Foto da conclusão" no cabeçalho da planilha
 *    (as outras 3 colunas você já tem).
 * b) Ache a obterMapaColunas() que você já colou e adicione só esta linha
 *    dentro do objeto, junto das outras "novas colunas":
 *      fotoConclusao: getColumnIndexByHeader(sheet, "Foto da conclusão"),
 * c) Ache o fecharOS() que você já colou e SUBSTITUA ele inteiro pela
 *    versão abaixo (agora recebe a foto e exige ela pra fechar).
 * d) Adicione a função nova salvarFotoConclusao() (ela ainda não existe
 *    no que você colou).
 * e) SUBSTITUA o Index.html inteiro pelo novo (tem o campo de foto).
 * f) Volte em Implantar > Gerenciar implantações > ✏️ (editar) > Nova
 *    versão > Implantar — pra publicar essa atualização no link que a
 *    equipe já usa (não precisa gerar um link novo).
 */

// ── Substitui a obterMapaColunas() existente — mesmas chaves de antes, +4 novas ──
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
 * PDFs de OS (gerarPDFOS) e retorna a URL do arquivo criado.
 * fotoBase64 vem sem o prefixo "data:...;base64," — isso é removido no
 * cliente antes de chamar fecharOS.
 */
function salvarFotoConclusao(osId, fotoBase64, mimeType) {
  var pasta = DriveApp.getFolderById(PASTA_ANEXOS_OS);
  var bytes = Utilities.base64Decode(fotoBase64);
  var blob = Utilities.newBlob(bytes, mimeType || "image/jpeg", osId + "-conclusao.jpg");
  var arquivo = pasta.createFile(blob);
  return arquivo.getUrl();
}

/**
 * Dá baixa numa OS: grava Status = Concluído, o que foi feito, data/hora
 * de conclusão (hora do servidor, não do celular do técnico — mais
 * confiável), quem assinou e a foto do problema resolvido (obrigatória).
 * Também tenta mover o card no Trello e avisar no Telegram — se qualquer
 * uma das duas falhar, a baixa já gravada na planilha NÃO é desfeita; a
 * falha só fica registrada no Log.
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
  for (var i = 1; i < dados.length; i++) {
    if ((dados[i][cols.os - 1] || "").toString().trim() === osId) {
      linhaEncontrada = i + 1; // +1 porque getRange é 1-based
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
  var fotoUrl = salvarFotoConclusao(osId, fotoBase64, fotoTipo);

  var agora = new Date();
  sheet.getRange(linhaEncontrada, cols.status).setValue(STATUS_CONCLUIDO);
  sheet.getRange(linhaEncontrada, cols.oQueFoiFeito).setValue(oQueFoiFeito);
  sheet.getRange(linhaEncontrada, cols.dataConclusao).setValue(agora);
  sheet.getRange(linhaEncontrada, cols.assinadoPor).setValue(assinadoPor);
  sheet.getRange(linhaEncontrada, cols.fotoConclusao).setValue(fotoUrl);

  // Trello: reaproveita moverCard(), já existente no Code.gs. Uma falha
  // aqui não desfaz a baixa (ela já foi gravada na planilha acima).
  try {
    var cardId = sheet.getRange(linhaEncontrada, cols.trello).getValue();
    if (cardId) moverCard(cardId, STATUS_CONCLUIDO);
  } catch (erroTrello) {
    Logger.log("Falha ao mover card no Trello pra OS " + osId + ": " + erroTrello);
  }

  // Telegram: aviso de baixa, mesmo padrão de enviarTelegramOSAberta().
  try {
    enviarTelegramOSFechada({
      os: osId,
      oQueFoiFeito: oQueFoiFeito,
      assinadoPor: assinadoPor,
      dataConclusao: agora,
      fotoUrl: fotoUrl,
    });
  } catch (erroTelegram) {
    Logger.log("Falha ao avisar no Telegram sobre a baixa da OS " + osId + ": " + erroTelegram);
  }

  return { ok: true, os: osId };
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

  var url = "https://api.telegram.org/bot" + TOKEN + "/sendMessage";
  UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({ chat_id: CHAT_ID, text: mensagem }),
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
