/**
 * MÓDULO COMPRAS — Fase 1 (ver
 * docs/superpowers/specs/2026-09-18-compras-fase1-design.md no repo
 * controle-agua-mamma-mia).
 *
 * Backend puro (sem tela própria) — o registro/edição de compras
 * acontece dentro do próprio Mamma Mia Control (painel Vercel), que
 * escreve aqui via fetch POST no /exec deste projeto (mesmo padrão do
 * mural de Avisos). A leitura (dashboard, lista, KPIs) é pelo CSV
 * publicado da aba COMPRAS, não passa por este arquivo.
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
 * 3) Extensões > Apps Script, apague o conteúdo do Code.gs padrão e cole
 *    este arquivo inteiro no lugar.
 * 4) Implantar > Nova implantação > tipo "App da Web":
 *      - Executar como: Eu (sua conta)
 *      - Quem pode acessar: Qualquer pessoa
 *    Implantar. Copie a URL que termina em /exec — é o COMPRAS_EXEC_URL.
 * 5) Arquivo > Compartilhar > Publicar na Web, escolha a aba "COMPRAS",
 *    formato CSV, Publicar. Copie esse link — é o COMPRAS_CSV_URL.
 * 6) Me manda os dois links (exec e CSV) que eu termino de configurar o
 *    painel (faltam só essas duas constantes no src/main.js).
 *
 * A pasta do Drive pros anexos (NF/comprovante/foto) é criada sozinha na
 * primeira vez que alguém anexar algo — não precisa criar nada no Drive
 * antes. Fica em "Compras/<ano>/<mês>/<ID da compra>/", na raiz do Drive
 * da conta que fez a implantação.
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

    var dadosPlanilha = sheet.getDataRange().getValues();
    for (var i = 1; i < dadosPlanilha.length; i++) {
      if ((dadosPlanilha[i][colId - 1] || "").toString().trim() !== id) continue;

      var linha = dadosPlanilha[i].slice();
      preencherCamposComuns(linha, mapa, dados);
      preencherValorTotal(linha, mapa, dados);
      preencherAnexosNovos(linha, mapa, dados, id);

      sheet.getRange(i + 1, 1, 1, linha.length).setValues([linha]);
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

// ───────────────────────── Roteamento do Web App ─────────────────────────

function doGet(e) {
  return respostaJson({ ok: true, mensagem: "Backend de Compras ativo." });
}

function doPost(e) {
  try {
    var dados = JSON.parse(e.postData.contents);
    if (dados.acao === "criar") return respostaJson(registrarCompra(dados));
    if (dados.acao === "editar") return respostaJson(editarCompra(dados.id, dados));
    throw new Error("Ação inválida: " + dados.acao);
  } catch (erro) {
    return respostaJson({ ok: false, erro: erro.message });
  }
}
