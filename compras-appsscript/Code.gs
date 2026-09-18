/**
 * MÓDULO COMPRAS — Fase 1 + Fase 2 (ver
 * docs/superpowers/specs/2026-09-18-compras-fase1-design.md e
 * docs/superpowers/specs/2026-09-20-compras-fase2-design.md, no repo
 * controle-agua-mamma-mia).
 *
 * Backend puro (sem tela própria) — o registro/edição de compras
 * acontece dentro do próprio Mamma Mia Control (painel Vercel), que
 * escreve aqui via fetch POST no /exec deste projeto (mesmo padrão do
 * mural de Avisos). A leitura (dashboard, lista, KPIs) é pelo CSV
 * publicado da aba COMPRAS, não passa por este arquivo — só o histórico
 * de uma compra específica (Fase 2) é pedido direto aqui via doPost.
 *
 * ─────────────────────────── COMO INSTALAR (do zero) ───────────────────────────
 * 1) Crie uma planilha nova no Google Sheets (ex.: "Compras — Mamma Mia Control").
 * 2) Renomeie a primeira aba pra exatamente "COMPRAS" e cole na linha 1, em
 *    qualquer ordem de colunas, estes cabeçalhos exatos (copie certinho, com
 *    acento — o código acha a coluna pelo nome, não pela posição):
 *
 *    ID | TIMESTAMP | UNIDADE | CATEGORIA SOLICITANTE | NOME SOLICITANTE |
 *    CATEGORIA | ITEM | DESCRIÇÃO | QUANTIDADE | UNIDADE MEDIDA |
 *    VALOR UNITÁRIO | VALOR TOTAL | FORNECEDOR | LINK COMPRA |
 *    FORMA PAGAMENTO | PAGO POR | REEMBOLSO NECESSÁRIO | STATUS REEMBOLSO |
 *    STATUS COMPRA | DATA SOLICITAÇÃO | DATA COMPRA | PREVISÃO ENTREGA |
 *    DATA RECEBIMENTO | RECEBIDO POR | CONFERIDO | CONDIÇÃO MATERIAL |
 *    NF | COMPROVANTE | FOTO
 *
 * 2.1) NOVO NA FASE 2: crie uma segunda aba, chamada exatamente
 *      "COMPRAS_HISTORICO", com estes 3 cabeçalhos na linha 1:
 *
 *      ID_COMPRA | TIMESTAMP | STATUS
 *
 *      (Se você já tinha só a Fase 1 instalada, é só adicionar essa aba —
 *      não precisa mexer em nada da aba COMPRAS.)
 *
 * 3) Extensões > Apps Script, apague o conteúdo do Code.gs padrão e cole
 *    este arquivo inteiro no lugar.
 * 4) Implantar > Nova implantação > tipo "App da Web":
 *      - Executar como: Eu (sua conta)
 *      - Quem pode acessar: Qualquer pessoa
 *    Implantar. Copie a URL que termina em /exec — é o COMPRAS_EXEC_URL.
 *    (Se já tinha uma implantação da Fase 1: Implantar > Gerenciar
 *    implantações > ✏️ editar > Nova versão > Implantar — mesma URL de
 *    antes, não precisa trocar nada no painel.)
 * 5) Arquivo > Compartilhar > Publicar na Web, escolha a aba "COMPRAS",
 *    formato CSV, Publicar — e marque "Republicar automaticamente quando
 *    alterações forem feitas" (senão o painel só vê snapshots antigos).
 *    Copie esse link — é o COMPRAS_CSV_URL.
 * 6) Me manda os dois links (exec e CSV) que eu termino de configurar o
 *    painel (faltam só essas duas constantes no src/main.js).
 *
 * A pasta do Drive pros anexos (NF/comprovante/foto) é criada sozinha na
 * primeira vez que alguém anexar algo — não precisa criar nada no Drive
 * antes. Fica em "Compras/<ano>/<mês>/<ID da compra>/", na raiz do Drive
 * da conta que fez a implantação.
 *
 * ────────────────────── FASE 2: alertas automáticos (opcional) ──────────────────────
 * Pra ligar o resumo diário de atrasos/reembolsos no Telegram:
 * 1) Configurações do projeto (ícone de engrenagem) > Propriedades do
 *    script > adicione TELEGRAM_TOKEN e TELEGRAM_CHAT_ID — os MESMOS
 *    valores que você já tem configurados no bot de Água/OS (é só copiar
 *    de lá, o alerta de Compras cai no mesmo chat).
 * 2) Rode a função `testarTelegram` (menu suspenso ao lado de ▶️ Executar)
 *    — deve chegar uma mensagem de teste. Se não chegar, revise o passo 1.
 * 3) Rode a função `configurarAlertasCompras` UMA VEZ — liga o resumo
 *    diário às 8h e manda uma confirmação no Telegram. Não precisa rodar
 *    de novo depois disso (nem ao reimplantar).
 */

var ABA_COMPRAS = "COMPRAS";

var MESES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

// Campos de texto/data simples — cada um só é escrito se a coluna
// correspondente já existir na planilha (colunas "opcionais": se você
// remover ou ainda não tiver criado uma dessas, o resto do registro
// continua funcionando normalmente, só essa informação específica não é
// salva). `data: true` marca os campos que chegam como "aaaa-mm-dd" (do
// <input type="date"> do painel) e precisam virar "dd/mm/aaaa" antes de
// gravar — mesmo formato de data usado no resto do projeto.
var CAMPOS_COMPRA = [
  { chave: "unidade", coluna: "UNIDADE" },
  { chave: "categoriaSolicitante", coluna: "CATEGORIA SOLICITANTE" },
  { chave: "nomeSolicitante", coluna: "NOME SOLICITANTE" },
  { chave: "categoria", coluna: "CATEGORIA" },
  { chave: "item", coluna: "ITEM" },
  { chave: "descricao", coluna: "DESCRIÇÃO" },
  { chave: "quantidade", coluna: "QUANTIDADE" },
  { chave: "unidadeMedida", coluna: "UNIDADE MEDIDA" },
  { chave: "valorUnitario", coluna: "VALOR UNITÁRIO" },
  { chave: "fornecedor", coluna: "FORNECEDOR" },
  { chave: "linkCompra", coluna: "LINK COMPRA" },
  { chave: "formaPagamento", coluna: "FORMA PAGAMENTO" },
  { chave: "pagoPor", coluna: "PAGO POR" },
  { chave: "reembolsoNecessario", coluna: "REEMBOLSO NECESSÁRIO" },
  { chave: "statusReembolso", coluna: "STATUS REEMBOLSO" },
  { chave: "statusCompra", coluna: "STATUS COMPRA" },
  { chave: "dataSolicitacao", coluna: "DATA SOLICITAÇÃO", data: true },
  { chave: "dataCompra", coluna: "DATA COMPRA", data: true },
  { chave: "previsaoEntrega", coluna: "PREVISÃO ENTREGA", data: true },
  { chave: "dataRecebimento", coluna: "DATA RECEBIMENTO", data: true },
  { chave: "recebidoPor", coluna: "RECEBIDO POR" },
  { chave: "conferido", coluna: "CONFERIDO" },
  { chave: "condicaoMaterial", coluna: "CONDIÇÃO MATERIAL" },
];

// Os 3 anexos — cada um só é salvo no Drive quando vem um *base64 novo*
// (o painel só manda isso quando a usuária troca/anexa o arquivo naquele
// campo). Editar uma compra sem mexer num anexo não apaga o que já
// estava lá: a linha inteira parte de uma cópia do que já existia (ver
// editarCompra), então uma coluna de anexo não tocada aqui simplesmente
// mantém o valor anterior.
var ANEXOS_COMPRA = [
  { base64: "nfBase64", mime: "nfMimeType", coluna: "NF", nome: "NF" },
  { base64: "comprovanteBase64", mime: "comprovanteMimeType", coluna: "COMPROVANTE", nome: "Comprovante" },
  { base64: "fotoBase64", mime: "fotoMimeType", coluna: "FOTO", nome: "Foto" },
];

// ───────────────────────── Utilidades de planilha ─────────────────────────

function obterAbaCompras() {
  var aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ABA_COMPRAS);
  if (!aba) {
    throw new Error('Aba "' + ABA_COMPRAS + '" não foi encontrada na planilha.');
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

function respostaJson(objeto) {
  return ContentService
    .createTextOutput(JSON.stringify(objeto))
    .setMimeType(ContentService.MimeType.JSON);
}

// ───────────────────────── Numeração e datas ─────────────────────────

/**
 * Próximo número sequencial de compra DENTRO DO ANO — olha o maior NNNN
 * já usado nas linhas com prefixo "CMP-<ano>-" e soma 1. À prova de
 * linha em branco ou fora de ordem (nunca repete um número já usado),
 * mesma lógica de proximoNumeroSequencialOS (manutencao-appsscript). A
 * numeração reinicia sozinha a cada ano novo, porque o prefixo muda.
 */
function proximoNumeroSequencialCompra(sheet, colId, ano) {
  var ultimaLinha = sheet.getLastRow();
  if (ultimaLinha < 2) return 1;

  var prefixo = "CMP-" + ano + "-";
  var valores = sheet.getRange(2, colId, ultimaLinha - 1, 1).getValues();
  var maior = 0;

  valores.forEach(function (linha) {
    var valor = (linha[0] || "").toString();
    if (valor.indexOf(prefixo) !== 0) return;
    var numero = parseInt(valor.substring(prefixo.length), 10);
    if (!isNaN(numero) && numero > maior) maior = numero;
  });

  return maior + 1;
}

// Converte "aaaa-mm-dd" (o que o <input type="date"> do painel manda)
// pra "dd/mm/aaaa" (formato de data usado no resto do projeto). Um valor
// que já não bate com esse formato (vazio, ou algo inesperado) volta
// como veio, sem quebrar o registro por causa disso.
function isoParaDataBR(iso) {
  var partes = (iso || "").split("-");
  if (partes.length !== 3) return iso || "";
  return partes[2] + "/" + partes[1] + "/" + partes[0];
}

// ───────────────────────── Anexos (Drive) ─────────────────────────

function pastaOuCriar(pastaPai, nome) {
  var existentes = pastaPai.getFoldersByName(nome);
  if (existentes.hasNext()) return existentes.next();
  return pastaPai.createFolder(nome);
}

// Compras/<ano atual>/<mês atual em português>/<ID>/ — criada sozinha na
// primeira vez que a compra recebe algum anexo (nunca antes disso, pra
// não encher o Drive de pasta vazia de compra que nunca teve documento
// anexado). Usa a data de HOJE (não a data da compra em si, que pode
// nem existir ainda numa compra só "solicitada") — é só organização de
// pasta, não precisa ser exata.
function pastaDaCompra(id) {
  var agora = new Date();
  var pastaRaiz = pastaOuCriar(DriveApp.getRootFolder(), "Compras");
  var pastaAno = pastaOuCriar(pastaRaiz, String(agora.getFullYear()));
  var pastaMes = pastaOuCriar(pastaAno, MESES_PT[agora.getMonth()]);
  return pastaOuCriar(pastaMes, id);
}

function extensaoDoMime(mimeType) {
  var mapa = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
  };
  return mapa[(mimeType || "").toLowerCase()] || "dat";
}

function salvarAnexo(pasta, base64, mimeType, nomeBase) {
  var bytes = Utilities.base64Decode(base64);
  var extensao = extensaoDoMime(mimeType);
  var blob = Utilities.newBlob(bytes, mimeType || "application/octet-stream", nomeBase + "." + extensao);
  var arquivo = pasta.createFile(blob);
  return arquivo.getUrl();
}

// Salva só os anexos que chegaram com base64 novo (ver ANEXOS_COMPRA) —
// se nenhum veio, nem toca no Drive (a maioria dos salvamentos é só
// texto). Uma falha num anexo específico não derruba o resto do
// registro, que já foi montado antes desta chamada — só fica de fora
// esse anexo, com o erro anotado no log de execuções.
function preencherAnexosNovos(linha, mapa, dados, id) {
  var temAlgumAnexoNovo = ANEXOS_COMPRA.some(function (a) { return dados[a.base64]; });
  if (!temAlgumAnexoNovo) return;

  var pasta = pastaDaCompra(id);
  ANEXOS_COMPRA.forEach(function (anexo) {
    var base64 = dados[anexo.base64];
    if (!base64) return;
    var col = mapa[anexo.coluna];
    if (!col) return;
    try {
      linha[col - 1] = salvarAnexo(pasta, base64, dados[anexo.mime], anexo.nome);
    } catch (erroAnexo) {
      Logger.log("Erro ao salvar anexo " + anexo.nome + " da compra " + id + ": " + erroAnexo);
    }
  });
}

// ───────────────────────── Campos comuns ─────────────────────────

function preencherCamposComuns(linha, mapa, dados) {
  CAMPOS_COMPRA.forEach(function (campo) {
    var col = mapa[campo.coluna];
    if (!col) return; // coluna opcional ainda não criada na planilha
    var valor = dados[campo.chave];
    if (valor == null) valor = "";
    if (campo.data && valor) valor = isoParaDataBR(valor);
    linha[col - 1] = valor;
  });
}

function preencherValorTotal(linha, mapa, dados) {
  var col = mapa["VALOR TOTAL"];
  if (!col) return;
  var quantidade = Number(dados.quantidade) || 0;
  var valorUnitario = Number(dados.valorUnitario) || 0;
  linha[col - 1] = (quantidade > 0 && valorUnitario > 0)
    ? Math.round(quantidade * valorUnitario * 100) / 100
    : "";
}

// ───────────────────────── Registrar / editar ─────────────────────────

/**
 * Cria uma compra nova. Só Categoria e Item são obrigatórios — tudo o
 * resto pode ficar em branco pra ser completado depois via editarCompra
 * (a ideia é registrar o que já se sabe no momento, sem travar em campo
 * que ainda não tem resposta).
 */
function registrarCompra(dados) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    dados = dados || {};
    var categoria = (dados.categoria || "").toString().trim();
    var item = (dados.item || "").toString().trim();
    if (!categoria) throw new Error("Selecione a categoria.");
    if (!item) throw new Error("Informe o item/produto.");

    var sheet = obterAbaCompras();
    var mapa = mapaColunas(sheet);
    var colId = colunaObrigatoria(mapa, ABA_COMPRAS, "ID");
    var colTimestamp = colunaObrigatoria(mapa, ABA_COMPRAS, "TIMESTAMP");

    var ano = new Date().getFullYear();
    var numero = proximoNumeroSequencialCompra(sheet, colId, ano);
    var id = "CMP-" + ano + "-" + ("0000" + numero).slice(-4);

    var linha = new Array(sheet.getLastColumn()).fill("");
    linha[colId - 1] = id;
    linha[colTimestamp - 1] = new Date();

    preencherCamposComuns(linha, mapa, dados);
    preencherValorTotal(linha, mapa, dados);
    preencherAnexosNovos(linha, mapa, dados, id);

    sheet.appendRow(linha);

    // Só grava a primeira entrada do histórico se já veio um status
    // escolhido na criação — sem isso, fica sem histórico até a
    // primeira edição que definir um status (ver registrarEntradaHistorico).
    var statusInicial = (dados.statusCompra || "").toString().trim();
    if (statusInicial) registrarEntradaHistorico(id, statusInicial);

    return { ok: true, id: id };
  } catch (erro) {
    Logger.log("Erro em registrarCompra: " + erro);
    throw erro;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Edita uma compra já existente, pelo ID. Reaproveita a mesma tela do
 * painel usada pra criar — a usuária vai preenchendo/corrigindo ao longo
 * do tempo (valor, fornecedor, entrega, anexos...) sem precisar recriar
 * o registro. Parte de uma CÓPIA da linha atual, então qualquer coluna
 * não coberta por CAMPOS_COMPRA/ANEXOS_COMPRA (ou um anexo sem base64
 * novo) mantém o valor que já tinha, automaticamente.
 */
function editarCompra(id, dados) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    id = (id || "").toString().trim();
    if (!id) throw new Error("Compra não identificada.");
    dados = dados || {};

    var sheet = obterAbaCompras();
    var mapa = mapaColunas(sheet);
    var colId = colunaObrigatoria(mapa, ABA_COMPRAS, "ID");

    var colStatusCompra = mapa["STATUS COMPRA"];

    var dadosPlanilha = sheet.getDataRange().getValues();
    for (var i = 1; i < dadosPlanilha.length; i++) {
      if ((dadosPlanilha[i][colId - 1] || "").toString().trim() !== id) continue;

      // Lido ANTES de sobrescrever a linha — é o que permite comparar
      // "mudou de verdade" com o status novo logo abaixo.
      var statusAntigo = colStatusCompra ? (dadosPlanilha[i][colStatusCompra - 1] || "").toString().trim() : "";

      var linha = dadosPlanilha[i].slice();
      preencherCamposComuns(linha, mapa, dados);
      preencherValorTotal(linha, mapa, dados);
      preencherAnexosNovos(linha, mapa, dados, id);

      sheet.getRange(i + 1, 1, 1, linha.length).setValues([linha]);

      // Só grava uma entrada nova no histórico quando o status REALMENTE
      // mudou — editar outros campos (valor, fornecedor, anexo...) sem
      // tocar no status não gera entrada.
      var statusNovo = (dados.statusCompra || "").toString().trim();
      if (statusNovo && statusNovo !== statusAntigo) registrarEntradaHistorico(id, statusNovo);

      return { ok: true };
    }
    throw new Error("Compra não encontrada.");
  } catch (erro) {
    Logger.log("Erro em editarCompra (" + id + "): " + erro);
    throw erro;
  } finally {
    lock.releaseLock();
  }
}

// ───────────────────────── Histórico / Timeline (Fase 2) ─────────────────────────
// Aba COMPRAS_HISTORICO (cabeçalhos: ID_COMPRA | TIMESTAMP | STATUS) — um
// registro por MUDANÇA de status (não por edição de campo qualquer). Ver
// docs/superpowers/specs/2026-09-20-compras-fase2-design.md.

var ABA_COMPRAS_HISTORICO = "COMPRAS_HISTORICO";

function obterAbaHistorico() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ABA_COMPRAS_HISTORICO);
}

// Silenciosa se a aba ainda não existir (Fase 2 pode não estar instalada
// ainda) ou se algo falhar — histórico é um extra, nunca pode travar o
// registro/edição principal da compra, que já foi salvo antes desta
// chamada.
function registrarEntradaHistorico(idCompra, status) {
  try {
    var aba = obterAbaHistorico();
    if (!aba) return;
    var mapa = mapaColunas(aba);
    var colId = mapa["ID_COMPRA"];
    var colTimestamp = mapa["TIMESTAMP"];
    var colStatus = mapa["STATUS"];
    if (!colId || !colTimestamp || !colStatus) return;

    var linha = new Array(aba.getLastColumn()).fill("");
    linha[colId - 1] = idCompra;
    linha[colTimestamp - 1] = new Date();
    linha[colStatus - 1] = status;
    aba.appendRow(linha);
  } catch (erro) {
    Logger.log("Erro ao registrar histórico da compra " + idCompra + ": " + erro);
  }
}

// [] se a aba não existir, o cabeçalho estiver incompleto, ou não houver
// nenhuma entrada — nunca lança erro (o formulário de edição precisa
// continuar abrindo mesmo sem histórico). Mais antigo primeiro.
function obterHistorico(idCompra) {
  try {
    var aba = obterAbaHistorico();
    if (!aba) return [];
    var mapa = mapaColunas(aba);
    var colId = mapa["ID_COMPRA"];
    var colTimestamp = mapa["TIMESTAMP"];
    var colStatus = mapa["STATUS"];
    if (!colId || !colTimestamp || !colStatus) return [];

    var dados = aba.getDataRange().getValues();
    var historico = [];
    for (var i = 1; i < dados.length; i++) {
      if ((dados[i][colId - 1] || "").toString().trim() !== idCompra) continue;
      var ts = dados[i][colTimestamp - 1];
      historico.push({
        status: dados[i][colStatus - 1],
        timestamp: ts instanceof Date ? ts.toISOString() : ts,
      });
    }
    historico.sort(function (a, b) { return new Date(a.timestamp) - new Date(b.timestamp); });
    return historico;
  } catch (erro) {
    Logger.log("Erro ao ler histórico da compra " + idCompra + ": " + erro);
    return [];
  }
}

// ───────────────────────── Alertas automáticos (Fase 2) ─────────────────────────
// Resumo diário via Telegram — mesmo TELEGRAM_TOKEN/TELEGRAM_CHAT_ID
// (Propriedades do Script) já usado no bot de água/OS; copie os mesmos
// dois valores pra cá. Ver docs/superpowers/specs/2026-09-20-compras-
// fase2-design.md.

function getConfigTelegram() {
  var props = PropertiesService.getScriptProperties();
  return {
    token: props.getProperty("TELEGRAM_TOKEN"),
    chatId: props.getProperty("TELEGRAM_CHAT_ID"),
  };
}

function enviarTelegram(mensagem) {
  var c = getConfigTelegram();
  if (!c.token || !c.chatId) {
    throw new Error("TELEGRAM_TOKEN/TELEGRAM_CHAT_ID não configurados nas Propriedades do Script.");
  }
  var url = "https://api.telegram.org/bot" + c.token + "/sendMessage";
  UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({ chat_id: c.chatId, text: mensagem }),
  });
}

/** Roda esta primeiro, isolada, pra confirmar que TELEGRAM_TOKEN/TELEGRAM_CHAT_ID estão certos. */
function testarTelegram() {
  enviarTelegram("🧪 Teste de conexão — Compras. Se você recebeu isso, o token e o chat ID estão certos.");
}

/**
 * Roda esta UMA VEZ pra ligar o resumo diário (8h) — remove qualquer
 * trigger antigo da mesma função antes de criar um novo, pra rodar essa
 * configuração de novo nunca duplicar o agendamento.
 */
function configurarAlertasCompras() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "verificarAlertasCompras") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("verificarAlertasCompras").timeBased().atHour(8).everyDays(1).create();
  enviarTelegram("⏱️ Alertas automáticos de Compras configurados — todo dia às 8h, se tiver entrega atrasada ou reembolso pendente, você recebe um resumo aqui.");
}

// "dd/mm/aaaa" OU um objeto Date (o Sheets converte texto de data
// sozinho em algumas colunas, dependendo de como foi digitado) -> Date
// local zerado na hora, ou null se não reconhecer nenhum dos dois formatos.
function parseDataBR(valor) {
  if (!valor) return null;
  if (valor instanceof Date) {
    var d = new Date(valor);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  var partes = valor.toString().split("/");
  if (partes.length !== 3) return null;
  return new Date(Number(partes[2]), Number(partes[1]) - 1, Number(partes[0]));
}

/**
 * Chamada pelo trigger diário (ver configurarAlertasCompras) — monta um
 * resumo só com o que precisa de atenção HOJE (entregas atrasadas,
 * reembolsos pendentes) e manda uma mensagem só. Sem nada pra avisar,
 * fica em silêncio (não manda "tudo certo" todo dia). Erro aqui fica só
 * no log de Execuções — não existe alerta-de-erro-do-alerta.
 */
function verificarAlertasCompras() {
  try {
    var sheet = obterAbaCompras();
    var mapa = mapaColunas(sheet);
    var dados = sheet.getDataRange().getValues();

    var colId = mapa["ID"];
    var colItem = mapa["ITEM"];
    var colUnidade = mapa["UNIDADE"];
    var colStatus = mapa["STATUS COMPRA"];
    var colPrevisao = mapa["PREVISÃO ENTREGA"];
    var colValorTotal = mapa["VALOR TOTAL"];
    var colPagoPor = mapa["PAGO POR"];
    var colReembolsoNecessario = mapa["REEMBOLSO NECESSÁRIO"];
    var colStatusReembolso = mapa["STATUS REEMBOLSO"];
    var colDataCompra = mapa["DATA COMPRA"];
    var colDataSolicitacao = mapa["DATA SOLICITAÇÃO"];

    var hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    var atrasadas = [];
    var reembolsosPendentes = [];

    for (var i = 1; i < dados.length; i++) {
      var linha = dados[i];
      var id = colId ? (linha[colId - 1] || "").toString().trim() : "";
      if (!id) continue;

      var status = colStatus ? (linha[colStatus - 1] || "").toString().trim() : "";

      if (colPrevisao && status !== "✅ Entregue" && status !== "❌ Cancelado") {
        var previsao = parseDataBR(linha[colPrevisao - 1]);
        if (previsao && previsao < hoje) {
          atrasadas.push(
            id + " — " + (colItem ? linha[colItem - 1] : "") +
            (colUnidade && linha[colUnidade - 1] ? " (" + linha[colUnidade - 1] + ")" : "") +
            " — previsão " + Utilities.formatDate(previsao, "GMT-3", "dd/MM/yyyy")
          );
        }
      }

      var reembolsoNecessario = colReembolsoNecessario ? (linha[colReembolsoNecessario - 1] || "").toString().trim() : "";
      var statusReembolso = colStatusReembolso ? (linha[colStatusReembolso - 1] || "").toString().trim() : "";
      if (reembolsoNecessario === "Sim" && statusReembolso !== "Reembolsado") {
        var dataRef = parseDataBR(colDataCompra ? linha[colDataCompra - 1] : "") || parseDataBR(colDataSolicitacao ? linha[colDataSolicitacao - 1] : "");
        var dias = dataRef ? Math.floor((hoje - dataRef) / 86400000) : null;
        var valor = colValorTotal ? linha[colValorTotal - 1] : "";
        var pagoPor = colPagoPor ? linha[colPagoPor - 1] : "";
        reembolsosPendentes.push(
          id +
          (valor ? " — R$ " + Number(valor).toFixed(2).replace(".", ",") : "") +
          (pagoPor ? " — " + pagoPor : "") +
          (dias != null ? " — pendente há " + dias + " dia" + (dias === 1 ? "" : "s") : "")
        );
      }
    }

    if (atrasadas.length === 0 && reembolsosPendentes.length === 0) return;

    var partes = ["📦 Resumo diário de Compras — " + Utilities.formatDate(hoje, "GMT-3", "dd/MM")];
    if (atrasadas.length) partes.push("\n🚨 Entregas atrasadas (" + atrasadas.length + ")\n" + atrasadas.join("\n"));
    if (reembolsosPendentes.length) partes.push("\n💰 Reembolsos pendentes (" + reembolsosPendentes.length + ")\n" + reembolsosPendentes.join("\n"));
    enviarTelegram(partes.join("\n"));
  } catch (erro) {
    Logger.log("Erro em verificarAlertasCompras: " + erro);
  }
}

// ───────────────────────── Roteamento do Web App ─────────────────────────

function doGet(e) {
  return respostaJson({ ok: true, mensagem: "Backend de Compras ativo." });
}

function doPost(e) {
  try {
    var dados = JSON.parse(e.postData.contents);
    if (dados.acao === "criar") return respostaJson(registrarCompra(dados));
    if (dados.acao === "editar") return respostaJson(editarCompra(dados.id, dados));
    if (dados.acao === "historico") return respostaJson({ ok: true, historico: obterHistorico(dados.id) });
    throw new Error("Ação inválida: " + dados.acao);
  } catch (erro) {
    return respostaJson({ ok: false, erro: erro.message });
  }
}
