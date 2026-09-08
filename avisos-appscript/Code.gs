/**
 * AVISOS — MAMMA MIA CONTROL. Backend simples (Google Sheets + Apps
 * Script) pro mural de post-its fixado no header do painel
 * (mammamia-control.vercel.app), editável direto na tela.
 *
 * IMPORTANTE: este é um projeto Apps Script PRÓPRIO E SEPARADO — não
 * cole isso dentro do Apps Script de nenhuma outra planilha que já
 * tenha código (ex: a planilha de água, que já tem doGet/doPost
 * próprios pra outra coisa). Um projeto só pode ter 1 doGet e 1 doPost
 * — colar em cima de um projeto existente sobrescreve/entra em
 * conflito com o que já tinha lá. Por isso este script aponta pra
 * planilha pelo ID (`PLANILHA_ID` abaixo), em vez de depender de estar
 * "dentro" dela — funciona projeto novo e solto, sem tocar em nada que
 * já existe.
 *
 * Como instalar:
 * 1) script.google.com > Novo projeto (NÃO pelo menu Extensões de
 *    dentro de uma planilha — direto pelo site do Apps Script, pra
 *    criar um projeto solto, sem vínculo com planilha nenhuma).
 * 2) Apague o conteúdo padrão e cole este arquivo inteiro.
 * 3) Confira/ajuste a constante `PLANILHA_ID` abaixo — já está com o
 *    ID da planilha de água, que é onde a aba AVISOS foi criada.
 * 4) Implantar > Nova implantação > App da Web:
 *      Executar como: Eu
 *      Quem pode acessar: Qualquer pessoa
 *    Copia o link gerado (termina em /exec) e me manda — eu troco no
 *    painel (constante AVISOS_EXEC_URL em src/main.js).
 *
 * Diferente do resto do ecossistema (que lê CSV publicado, com alguns
 * minutos de atraso), aqui o painel chama esse Web App direto via
 * fetch — tanto pra ler quanto pra escrever — pra editar e ver
 * refletido na hora, sem esperar cache nenhum. Mesmo padrão já usado
 * pelo botão de editar quantidade em Insumos Críticos.
 */

var PLANILHA_ID = "1tixTJ74aaEo-EuCfTFl-efWOT7p-TIgN0su8NzX8aKw";
var ABA_AVISOS = "AVISOS";

function obterAba() {
  var aba = SpreadsheetApp.openById(PLANILHA_ID).getSheetByName(ABA_AVISOS);
  if (!aba) {
    throw new Error('Aba "' + ABA_AVISOS + '" não foi encontrada na planilha.');
  }
  return aba;
}

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

function respostaJson(objeto) {
  return ContentService
    .createTextOutput(JSON.stringify(objeto))
    .setMimeType(ContentService.MimeType.JSON);
}

/** GET — lista todos os avisos (id + texto), na ordem da planilha. */
function doGet(e) {
  try {
    return respostaJson(listarAvisos());
  } catch (erro) {
    return respostaJson({ ok: false, erro: erro.message });
  }
}

/**
 * POST — cria, edita ou remove um aviso, conforme o campo "acao" no
 * corpo (JSON): "criar" (texto), "editar" (id, texto) ou "remover"
 * (id). O cliente manda com Content-Type text/plain de propósito —
 * evita o preflight OPTIONS que o Apps Script não trata, então dá pra
 * chamar direto de um site em outro domínio (o painel, hospedado no
 * Vercel) sem CORS travar a requisição.
 */
function doPost(e) {
  try {
    var dados = JSON.parse(e.postData.contents);
    var acao = dados.acao;

    if (acao === "criar") return respostaJson(criarAviso(dados.texto));
    if (acao === "editar") return respostaJson(editarAviso(dados.id, dados.texto));
    if (acao === "remover") return respostaJson(removerAviso(dados.id));

    throw new Error("Ação inválida: " + acao);
  } catch (erro) {
    return respostaJson({ ok: false, erro: erro.message });
  }
}

function listarAvisos() {
  var aba = obterAba();
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
    var aba = obterAba();
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
    var aba = obterAba();
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
    var aba = obterAba();
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
