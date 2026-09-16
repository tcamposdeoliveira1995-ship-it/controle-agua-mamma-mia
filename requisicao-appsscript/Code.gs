/**
 * REQUISIÇÃO DE MATÉRIA-PRIMA E RECHEIOS — Mamma Mia
 * ---------------------------------------------------------------------
 * Abertura pelo Google Forms de sempre (sem mudança de UX pra quem
 * pede) + fechamento próprio (Fechar/Histórico). Este arquivo cuida
 * das DUAS pontas porque o acionador "Ao enviar o formulário" (já
 * configurado em Acionadores ⏰) chama uma função deste mesmo projeto
 * (enviarRequisicaoTelegram) — não dá pra ter isso num projeto e o
 * fechamento em outro.
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
 *    e os 3 HTML ao lado (Menu.html, FecharRequisicao.html,
 *    HistoricoRequisicoes.html).
 * 4) Confirme em Acionadores ⏰ que existe um acionador "Do formulário
 *    > Ao enviar o formulário" apontando pra "enviarRequisicaoTelegram"
 *    (se não existir mais, crie um novo apontando pra essa função).
 * 5) Rode a função "corrigirRequisicoesSemId" UMA VEZ manualmente
 *    (selecione ela no topo do editor e clique em Executar) — ela
 *    preenche ID + STATUS nas respostas que chegaram enquanto o
 *    acionador estava quebrado, sem isso elas ficam invisíveis pro
 *    Fechar/Histórico.
 * 6) Configurações do projeto > Propriedades do script > adicione
 *    TELEGRAM_TOKEN e TELEGRAM_CHAT_ID.
 * 7) Implantar > Gerenciar implantações > ✏️ > Nova versão > Implantar.
 */

var NOME_ABA_REQUISICOES = "REQUISIÇÃO DE MATÉRIA-PRIMA E RECHEIOS - MAMMA MIA CONTROL";

var STATUS_ABERTO = "ABERTO";
var STATUS_CONCLUIDO = "CONCLUÍDO";
var STATUS_PARCIAL = "PARCIALMENTE";
var STATUS_CANCELADO = "CANCELADO";
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

/**
 * Deixa legível o título de uma pergunta em formato de grade, ex:
 * "Item requisitado [Matéria-prima | AÇAFRAO | KG]" vira "AÇAFRAO (KG)".
 * Colunas que não batem com esse formato voltam como vieram.
 */
function formatarNomeColunaProduto(nomeColuna) {
  var match = nomeColuna.match(/^Item requisitado\s*\[(.+)\]$/i);
  if (!match) return nomeColuna;

  var partes = match[1].split("|").map(function (p) { return p.trim(); });
  var unidade = partes.length >= 2 ? partes[partes.length - 1] : "";
  var produto = partes.length >= 2 ? partes[partes.length - 2] : partes[0];

  return unidade ? produto + " (" + unidade + ")" : produto;
}

/**
 * Acha, uma vez por chamada, todas as colunas da planilha que NÃO são
 * um dos campos conhecidos em `cols` — na prática, as dezenas de
 * colunas por produto do Forms antigo (ex: "Farinha 101 (PCT)") e as
 * de pergunta em grade. Usado só pra leitura (nunca grava nelas): quem
 * preenche a requisição às vezes usa o campo de texto livre, às vezes
 * marca quantidade direto nessas colunas por produto — o app precisa
 * mostrar os dois jeitos sem manter uma lista fixa de produtos.
 */
function obterColunasProduto(sheet, cols) {
  var conhecidas = {};
  Object.keys(cols).forEach(function (chave) { conhecidas[cols[chave]] = true; });

  var totalColunas = sheet.getLastColumn();
  var cabecalhos = sheet.getRange(1, 1, 1, totalColunas).getValues()[0];

  var colunasProduto = [];
  for (var i = 1; i <= totalColunas; i++) {
    if (conhecidas[i]) continue;
    var nome = (cabecalhos[i - 1] || "").toString().trim();
    if (!nome) continue;
    colunasProduto.push({ indice: i, nome: formatarNomeColunaProduto(nome) });
  }
  return colunasProduto;
}

/**
 * Formata um valor de data/hora da planilha pro padrão brasileiro.
 * Devolve "" se o valor estiver vazio ou não for uma data válida —
 * nunca lança erro (usado só pra exibição).
 */
function formatarDataBR(valor) {
  if (!valor) return "";
  try {
    return Utilities.formatDate(new Date(valor), "America/Sao_Paulo", "dd/MM/yyyy HH:mm");
  } catch (erroData) {
    return String(valor);
  }
}

/**
 * Monta o texto de itens de uma linha: o campo de texto livre (se
 * preenchido), a "Quantidade solicitada" avulsa (se houver) e qualquer
 * coluna por produto com valor diferente de vazio/zero.
 */
function montarItensTexto(linha, cols, colunasProduto) {
  var partes = [];

  var itensLivre = (linha[cols.itensLivre - 1] || "").toString().trim();
  if (itensLivre) partes.push(itensLivre);

  var quantidade = linha[cols.quantidadeSolicitada - 1];
  if (quantidade !== "" && quantidade !== null && quantidade !== undefined) {
    partes.push("Quantidade: " + quantidade);
  }

  colunasProduto.forEach(function (coluna) {
    var valor = linha[coluna.indice - 1];
    if (valor === "" || valor === null || valor === undefined) return;
    if (typeof valor === "number" && valor === 0) return;
    partes.push(coluna.nome + ": " + valor);
  });

  return partes.join("\n");
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
 * "Em aberto" = STATUS diferente de CONCLUÍDO e de
 * CANCELADO (cobre ABERTO, AGUARDANDO, EM SEPARAÇÃO e
 * PARCIALMENTE — os dois primeiros vêm do fluxo normal
 * do Forms, "EM SEPARAÇÃO"/"CANCELADO" vêm do painel do
 * site de água, ver `atualizarStatusPorQuery`). Mais
 * recente primeiro.
 ****************************************************/

function listarRequisicoesAbertas() {
  var sheet = obterSheet();
  var cols = obterMapaColunas(sheet);
  var colunasProduto = obterColunasProduto(sheet, cols);
  var dados = sheet.getDataRange().getValues();

  var abertas = [];
  for (var i = 1; i < dados.length; i++) {
    var linha = dados[i];
    var id = (linha[cols.id - 1] || "").toString().trim();
    var status = (linha[cols.status - 1] || "").toString().trim().toUpperCase();
    if (!id || status === STATUS_CONCLUIDO || status === STATUS_CANCELADO) continue;

    abertas.push({
      id: id,
      dataAbertura: formatarDataBR(linha[cols.timestamp - 1]),
      requisitante: linha[cols.requisitante - 1],
      unidade: linha[cols.unidade - 1],
      setor: linha[cols.setor - 1],
      tipo: linha[cols.tipo - 1],
      itens: montarItensTexto(linha, cols, colunasProduto),
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
      "🕒 " + formatarDataBR(agora) +
      (observacoesEntrega ? "\n📝 Observações: " + observacoesEntrega : "");

    enviarTelegram(mensagem);
  } catch (erroTelegram) {
    Logger.log("Falha ao avisar no Telegram sobre a baixa da requisição " + id + ": " + erroTelegram);
  }

  return { ok: true, id: id, status: statusFinal };
}


/****************************************************
 * HISTÓRICO DE REQUISIÇÕES JÁ CONCLUÍDAS
 * Só STATUS === CONCLUÍDO — PARCIALMENTE continua
 * contando como pendente (aparece em
 * listarRequisicoesAbertas, não aqui). Mais recente
 * primeiro. "Entregue por"/"Data de entrega" só vêm
 * preenchidos pras requisições fechadas por este app —
 * as fechadas manualmente antes dele existir ficam com
 * esses campos em branco, o que é esperado.
 ****************************************************/

function listarRequisicoesFechadas() {
  var sheet = obterSheet();
  var cols = obterMapaColunas(sheet);
  var colunasProduto = obterColunasProduto(sheet, cols);
  var dados = sheet.getDataRange().getValues();

  var fechadas = [];
  for (var i = 1; i < dados.length; i++) {
    var linha = dados[i];
    var id = (linha[cols.id - 1] || "").toString().trim();
    var status = (linha[cols.status - 1] || "").toString().trim().toUpperCase();
    if (!id || status !== STATUS_CONCLUIDO) continue;

    fechadas.push({
      id: id,
      dataAbertura: formatarDataBR(linha[cols.timestamp - 1]),
      requisitante: linha[cols.requisitante - 1],
      unidade: linha[cols.unidade - 1],
      setor: linha[cols.setor - 1],
      tipo: linha[cols.tipo - 1],
      itens: montarItensTexto(linha, cols, colunasProduto),
      prioridade: (linha[cols.prioridade - 1] || "").toString().trim(),
      finalidade: linha[cols.finalidade - 1],
      entreguePor: (linha[cols.entreguePor - 1] || "").toString().trim(),
      dataEntrega: formatarDataBR(linha[cols.dataEntrega - 1]),
      obsEntrega: linha[cols.obsEntrega - 1],
    });
  }

  // Mais recente primeiro.
  fechadas.reverse();

  return fechadas;
}


/****************************************************
 * ABERTURA — ACIONADOR "AO ENVIAR O FORMULÁRIO"
 * ---------------------------------------------------------------------
 * O Google Forms já grava a resposta direto na planilha (isso não
 * depende de código); a função abaixo só roda DEPOIS disso, via um
 * acionador instalável "Do formulário > Ao enviar o formulário"
 * apontando pra "enviarRequisicaoTelegram" (configurado em Acionadores
 * ⏰ no editor do Apps Script — não precisa mexer nisso de novo, só
 * garantir que a função com esse nome exista, que é o que estava
 * faltando). Ela dá ID + STATUS pra linha nova e avisa no Telegram.
 ****************************************************/

/**
 * Gera o próximo ID sequencial do dia, formato REQ-AAAAMMDD-HHmmss-N
 * (mesmo formato já usado nas requisições existentes na planilha).
 * Protegido por LockService pra duas respostas quase simultâneas nunca
 * saírem com o mesmo número.
 */
function gerarIDRequisicao() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    var propriedades = PropertiesService.getScriptProperties();
    var agora = new Date();
    var dataStr = Utilities.formatDate(agora, "America/Sao_Paulo", "yyyyMMdd");
    var horaStr = Utilities.formatDate(agora, "America/Sao_Paulo", "HHmmss");

    var chaveData = "DATA_CONTADOR_REQUISICAO";
    var chaveContador = "CONTADOR_REQUISICAO";

    var dataSalva = propriedades.getProperty(chaveData);
    var contador = Number(propriedades.getProperty(chaveContador) || 0);

    if (dataSalva !== dataStr) {
      contador = 1;
      propriedades.setProperty(chaveData, dataStr);
    } else {
      contador++;
    }
    propriedades.setProperty(chaveContador, String(contador));

    return "REQ-" + dataStr + "-" + horaStr + "-" + contador;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Alvo do acionador "Ao enviar o formulário". Relê a última linha da
 * planilha (a que o próprio Forms acabou de gravar), dá ID + STATUS =
 * ABERTO se ainda não tiver, e avisa no Telegram. Protegido contra o
 * Forms disparando o mesmo envio duas vezes (comportamento conhecido
 * do Google, não é bug seu) via cache + lock, pelo ID da resposta.
 */
function enviarRequisicaoTelegram(e) {
  var idResposta = e && e.response ? e.response.getId() : null;

  if (idResposta) {
    var cache = CacheService.getScriptCache();
    var chaveResposta = "req_notif_resposta_" + idResposta;
    var lock = LockService.getScriptLock();
    lock.waitLock(30000);

    var jaProcessada;
    try {
      jaProcessada = !!cache.get(chaveResposta);
      if (!jaProcessada) cache.put(chaveResposta, "1", 21600); // 6 horas
    } finally {
      lock.releaseLock();
    }

    if (jaProcessada) {
      Logger.log("Resposta " + idResposta + " já processada — ignorando disparo duplicado do Forms.");
      return;
    }
  }

  var sheet = obterSheet();
  var cols = obterMapaColunas(sheet);
  var colunasProduto = obterColunasProduto(sheet, cols);
  var linhaNova = sheet.getLastRow();
  var dados = sheet.getRange(linhaNova, 1, 1, sheet.getLastColumn()).getValues()[0];

  var idExistente = (dados[cols.id - 1] || "").toString().trim();
  if (!idExistente) {
    var novoId = gerarIDRequisicao();
    sheet.getRange(linhaNova, cols.id).setValue(novoId);
    sheet.getRange(linhaNova, cols.status).setValue(STATUS_ABERTO);
    dados[cols.id - 1] = novoId;
    dados[cols.status - 1] = STATUS_ABERTO;
  }

  try {
    var mensagem =
      "📦 NOVA REQUISIÇÃO OPERACIONAL\n\n" +
      "🆔 " + dados[cols.id - 1] + "\n\n" +
      "👤 Requisitante: " + (dados[cols.requisitante - 1] || "") + "\n" +
      "🏭 Unidade solicitante: " + (dados[cols.unidade - 1] || "") + "\n" +
      "📍 Setor: " + (dados[cols.setor - 1] || "") + "\n\n" +
      "📋 Tipo: " + (dados[cols.tipo - 1] || "") + "\n\n" +
      "📦 Itens:\n" + (montarItensTexto(dados, cols, colunasProduto) || "Nenhum item informado.") + "\n\n" +
      "🎯 Finalidade: " + (dados[cols.finalidade - 1] || "") + "\n\n" +
      "🤖 Mamma Mia Operações";

    enviarTelegram(mensagem);
  } catch (erroTelegram) {
    Logger.log("Falha ao avisar no Telegram sobre a nova requisição " + dados[cols.id - 1] + ": " + erroTelegram);
  }
}

/**
 * CONSERTO PONTUAL — rode isto UMA VEZ manualmente (selecione a função
 * no editor do Apps Script e clique em Executar), não é chamada por
 * ninguém automaticamente. Preenche ID + STATUS = ABERTO em qualquer
 * linha que já tenha uma resposta real (tem "Nome do requisitante")
 * mas ficou sem ID — foi o caso das respostas recebidas enquanto o
 * acionador "Ao enviar o formulário" estava apontando pra uma função
 * que não existia mais no projeto. Não mexe em linhas que já têm ID.
 */
function corrigirRequisicoesSemId() {
  var sheet = obterSheet();
  var cols = obterMapaColunas(sheet);
  var dados = sheet.getDataRange().getValues();

  var corrigidas = 0;

  for (var i = 1; i < dados.length; i++) {
    var linha = dados[i];
    var idAtual = (linha[cols.id - 1] || "").toString().trim();
    var requisitante = (linha[cols.requisitante - 1] || "").toString().trim();

    if (idAtual || !requisitante) continue;

    var linhaPlanilha = i + 1; // +1 porque getRange é 1-based
    var novoId = gerarIDRequisicao();
    sheet.getRange(linhaPlanilha, cols.id).setValue(novoId);
    sheet.getRange(linhaPlanilha, cols.status).setValue(STATUS_ABERTO);
    corrigidas++;
  }

  Logger.log(corrigidas + " requisição(ões) corrigida(s) (ID + STATUS = ABERTO).");
  return corrigidas;
}


/****************************************************
 * COMPATIBILIDADE COM O PAINEL DE ÁGUA (site
 * controle-agua-mamma-mia, seção "Central" de MP e
 * Recheios): o botão de lá (EM SEPARAÇÃO/CONCLUÍDO/
 * CANCELADO, em src/main.js `atualizarStatusCentral`)
 * já chama ESTE MESMO Web App via
 * ".../exec?rq=<ID>&status=<STATUS>" e espera um JSON
 * { sucesso: true|false } de volta — não uma tela HTML.
 * Isso já existia antes deste projeto de Fechar/
 * Histórico; se não for tratado aqui, esse botão do site
 * passa a receber o HTML do Menu em vez de JSON e quebra
 * silenciosamente.
 ****************************************************/

function atualizarStatusPorQuery(rq, statusNovo) {
  var resultado = { sucesso: false };

  try {
    var id = (rq || "").toString().trim();
    var status = (statusNovo || "").toString().trim().toUpperCase();
    if (!id) throw new Error("Parâmetro 'rq' vazio.");
    if (!status) throw new Error("Parâmetro 'status' vazio.");

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

    sheet.getRange(linhaEncontrada, cols.status).setValue(status);
    resultado.sucesso = true;
  } catch (erro) {
    Logger.log("Falha em atualizarStatusPorQuery(" + rq + ", " + statusNovo + "): " + erro);
    resultado.erro = String(erro);
  }

  return ContentService
    .createTextOutput(JSON.stringify(resultado))
    .setMimeType(ContentService.MimeType.JSON);
}


/****************************************************
 * ROTEAMENTO DO WEB APP
 * ".../exec" → Menu.html (3 cards: Abrir, que aponta
 * pro Google Forms; Fechar; Histórico).
 * ".../exec?tela=fechar" → FecharRequisicao.html.
 * ".../exec?tela=historico" → HistoricoRequisicoes.html.
 * ".../exec?rq=<ID>&status=<STATUS>" → JSON, ver
 * `atualizarStatusPorQuery` acima (usado pelo painel de
 * água, não pelas telas HTML deste projeto).
 ****************************************************/

function doGet(e) {
  var parametros = (e && e.parameter) || {};

  if (parametros.rq && parametros.status) {
    return atualizarStatusPorQuery(parametros.rq, parametros.status);
  }

  var tela = parametros.tela;

  if (tela === "fechar") {
    return HtmlService
      .createHtmlOutputFromFile("FecharRequisicao")
      .setTitle("Fechar Requisição — Mamma Mia")
      .addMetaTag("viewport", "width=device-width, initial-scale=1");
  }

  if (tela === "historico") {
    return HtmlService
      .createHtmlOutputFromFile("HistoricoRequisicoes")
      .setTitle("Histórico de Requisições — Mamma Mia")
      .addMetaTag("viewport", "width=device-width, initial-scale=1");
  }

  return HtmlService
    .createHtmlOutputFromFile("Menu")
    .setTitle("Requisição MP e Recheios — Mamma Mia")
    .addMetaTag("viewport", "width=device-width, initial-scale=1");
}
