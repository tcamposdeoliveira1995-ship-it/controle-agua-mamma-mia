/**
 * MÓDULO COMPRAS — Fase 1 + Fase 2 + reestruturação de itens múltiplos +
 * Fase 4 (integração com OS de Manutenção) + Painel Qualidade
 * (ver docs/superpowers/specs/2026-09-18-compras-fase1-design.md,
 * 2026-09-20-compras-fase2-design.md,
 * 2026-09-21-compras-itens-multiplos-design.md,
 * 2026-09-18-compras-fase4-os-design.md e
 * 2026-09-23-painel-qualidade-compras-design.md, no repo
 * controle-agua-mamma-mia).
 *
 * DESDE O PAINEL QUALIDADE: o registro/edição de compras NÃO acontece
 * mais dentro do Mamma Mia Control (painel Vercel) — esse continua só
 * lendo os CSVs publicados (dashboard, lista, KPIs, gráficos), sem
 * nenhum formulário de escrita. Quem registra/edita compras agora é a
 * tela HTML própria deste projeto (Compras.html — acessada pelo link
 * /exec deste Apps Script, direto ou pelo hub do Painel Qualidade), que
 * chama o mesmo doPost abaixo — nenhuma mudança no formato dos dados
 * trocados, só de ONDE a tela roda.
 *
 * ─────────────────────────── COMO INSTALAR (do zero) ───────────────────────────
 * 1) Crie uma planilha nova no Google Sheets (ex.: "Compras — Mamma Mia Control").
 * 2) Renomeie a primeira aba pra exatamente "COMPRAS" e cole na linha 1, em
 *    qualquer ordem de colunas, estes cabeçalhos exatos (copie certinho, com
 *    acento — o código acha a coluna pelo nome, não pela posição). Essa aba é
 *    o CABEÇALHO de cada compra — os itens em si moram na aba COMPRAS_ITENS
 *    (passo 2.2 abaixo), então as colunas CATEGORIA/ITEM/DESCRIÇÃO/
 *    QUANTIDADE/UNIDADE MEDIDA/VALOR UNITÁRIO desta lista só existem aqui
 *    por causa de instalações antigas — se for instalação nova, pode nem
 *    criar essas 6 colunas em COMPRAS, só em COMPRAS_ITENS:
 *
 *    ID | TIMESTAMP | UNIDADE | OS RELACIONADA | CATEGORIA SOLICITANTE |
 *    NOME SOLICITANTE | FORNECEDOR | LINK COMPRA | VALOR TOTAL |
 *    FORMA PAGAMENTO | PAGO POR | REEMBOLSO NECESSÁRIO | STATUS REEMBOLSO |
 *    STATUS COMPRA | DATA SOLICITAÇÃO | DATA COMPRA | PREVISÃO ENTREGA |
 *    DATA RECEBIMENTO | RECEBIDO POR | CONFERIDO | CONDIÇÃO MATERIAL |
 *    NF | COMPROVANTE | FOTO
 *
 *    (OS RELACIONADA é opcional — se você já tinha a planilha criada
 *    antes da Fase 4, só adicionar essa coluna nova no meio do
 *    cabeçalho já é suficiente, o código acha ela pelo nome)
 *
 * 2.1) NA FASE 2: crie uma segunda aba, chamada exatamente
 *      "COMPRAS_HISTORICO", com estes 3 cabeçalhos na linha 1:
 *
 *      ID_COMPRA | TIMESTAMP | STATUS
 *
 * 2.2) NA REESTRUTURAÇÃO DE ITENS MÚLTIPLOS: crie uma terceira aba,
 *      chamada exatamente "COMPRAS_ITENS", com estes cabeçalhos na
 *      linha 1 — é aqui que ficam os itens de cada compra (uma compra
 *      pode ter vários):
 *
 *      ID_COMPRA | CATEGORIA | ITEM | DESCRIÇÃO | QUANTIDADE |
 *      UNIDADE MEDIDA | VALOR UNITÁRIO | VALOR TOTAL
 *
 *      Se você já tinha compras lançadas no formato antigo (1 item nos
 *      próprios campos de COMPRAS), depois de criar essa aba rode a
 *      função `migrarItensParaComprasItens` UMA VEZ (menu suspenso ao
 *      lado de ▶️ Executar) — ela copia o item de cada compra antiga pra
 *      cá, sem apagar nem mudar nada em COMPRAS. Pode rodar mais de uma
 *      vez sem medo (compra já migrada é pulada).
 *
 * 3) Extensões > Apps Script, apague o conteúdo do Code.gs padrão e cole
 *    este arquivo inteiro no lugar.
 * 3.1) NO PAINEL QUALIDADE: crie um arquivo novo do tipo HTML chamado
 *      exatamente "Compras" e cole o conteúdo de Compras.html nele — é a
 *      tela de registrar/editar compras. Se você já tinha esse projeto
 *      instalado antes (Fase 1-4), só precisa adicionar esse arquivo
 *      novo, o resto do Code.gs já existente continua igual. Dentro de
 *      Compras.html, troque "COLE_AQUI_A_URL_DO_PAINEL_QUALIDADE" (link
 *      "‹ Menu" no topo) pela URL /exec do painel-qualidade-appscript —
 *      tem que ser a URL completa, um atalho relativo não funciona
 *      dentro do domínio de conteúdo temporário que o Apps Script usa
 *      pra servir essa tela.
 * 4) Implantar > Nova implantação > tipo "App da Web":
 *      - Executar como: Eu (sua conta)
 *      - Quem pode acessar: Qualquer pessoa
 *    Implantar. Copie a URL que termina em /exec — é o COMPRAS_EXEC_URL
 *    (usado pelo painel pra ler/gravar) E TAMBÉM o link direto da tela
 *    de Compras do Painel Qualidade (abrir esse link no navegador mostra
 *    a lista de compras, não mais um JSON de status).
 *    (Se já tinha uma implantação anterior: Implantar > Gerenciar
 *    implantações > ✏️ editar > Nova versão > Implantar — mesma URL de
 *    antes, não precisa trocar nada no painel nem no Menu do Painel
 *    Qualidade.)
 * 5) Arquivo > Compartilhar > Publicar na Web — publique CADA UMA das
 *    abas COMPRAS e COMPRAS_ITENS (uma de cada vez, escolhendo a aba
 *    certa no seletor), formato CSV, Publicar — e marque "Republicar
 *    automaticamente quando alterações forem feitas" nas duas (senão o
 *    painel só vê snapshots antigos). Copie os dois links — são o
 *    COMPRAS_CSV_URL e o COMPRAS_ITENS_CSV_URL.
 * 6) Me manda os três links (exec, CSV de COMPRAS e CSV de COMPRAS_ITENS)
 *    que eu termino de configurar o painel (faltam só essas constantes
 *    em src/main.js).
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
// Campos do CABEÇALHO da compra — desde a reestruturação pra itens
// múltiplos (ver docs/superpowers/specs/2026-09-21-compras-itens-
// multiplos-design.md), Categoria/Item/Descrição/Quantidade/Unidade
// medida/Valor unitário SAÍRAM daqui e viraram linhas em COMPRAS_ITENS
// (ver CAMPOS_ITEM mais abaixo) — uma compra agora é 1 fornecedor/
// pagamento/status/entrega + N itens dentro.
var CAMPOS_COMPRA = [
  { chave: "unidade", coluna: "UNIDADE" },
  { chave: "osRelacionada", coluna: "OS RELACIONADA" },
  { chave: "categoriaSolicitante", coluna: "CATEGORIA SOLICITANTE" },
  { chave: "nomeSolicitante", coluna: "NOME SOLICITANTE" },
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

// Campos de cada linha de item, na aba COMPRAS_ITENS (cabeçalhos:
// ID_COMPRA | CATEGORIA | ITEM | DESCRIÇÃO | QUANTIDADE | UNIDADE MEDIDA
// | VALOR UNITÁRIO | VALOR TOTAL — ID_COMPRA e VALOR TOTAL tratados à
// parte, não entram nesta lista).
var CAMPOS_ITEM = [
  { chave: "categoria", coluna: "CATEGORIA" },
  { chave: "item", coluna: "ITEM" },
  { chave: "descricao", coluna: "DESCRIÇÃO" },
  { chave: "quantidade", coluna: "QUANTIDADE" },
  { chave: "unidadeMedida", coluna: "UNIDADE MEDIDA" },
  { chave: "valorUnitario", coluna: "VALOR UNITÁRIO" },
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

// ───────────────────────── Itens da compra (COMPRAS_ITENS) ─────────────────────────

var ABA_COMPRAS_ITENS = "COMPRAS_ITENS";

function obterAbaItens() {
  var aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ABA_COMPRAS_ITENS);
  if (!aba) {
    throw new Error('Aba "' + ABA_COMPRAS_ITENS + '" não foi encontrada na planilha.');
  }
  return aba;
}

function calcularValorTotalItem(item) {
  var quantidade = Number(item.quantidade) || 0;
  var valorUnitario = Number(item.valorUnitario) || 0;
  return Math.round(quantidade * valorUnitario * 100) / 100;
}

function calcularValorTotalCompra(itens) {
  return (itens || []).reduce(function (soma, item) { return soma + calcularValorTotalItem(item); }, 0);
}

// Apaga todas as linhas de COMPRAS_ITENS de uma compra — usado antes de
// regravar os itens numa edição (mais simples e seguro que tentar
// comparar item a item o que mudou). De baixo pra cima, pra deleteRow
// não bagunçar os índices das próximas iterações.
function excluirItensDaCompra(idCompra) {
  var aba = obterAbaItens();
  var mapa = mapaColunas(aba);
  var colId = mapa["ID_COMPRA"];
  if (!colId) return;
  var dados = aba.getDataRange().getValues();
  for (var i = dados.length - 1; i >= 1; i--) {
    if ((dados[i][colId - 1] || "").toString().trim() === idCompra) aba.deleteRow(i + 1);
  }
}

// Grava uma linha em COMPRAS_ITENS por item — chamada tanto na criação
// quanto (depois de excluirItensDaCompra) na edição.
function gravarItens(idCompra, itens) {
  var aba = obterAbaItens();
  var mapa = mapaColunas(aba);
  var colIdCompra = mapa["ID_COMPRA"];
  if (!colIdCompra) throw new Error('Coluna "ID_COMPRA" não encontrada na aba "' + ABA_COMPRAS_ITENS + '".');

  (itens || []).forEach(function (item) {
    var linha = new Array(aba.getLastColumn()).fill("");
    linha[colIdCompra - 1] = idCompra;
    CAMPOS_ITEM.forEach(function (campo) {
      var col = mapa[campo.coluna];
      if (!col) return;
      linha[col - 1] = item[campo.chave] != null ? item[campo.chave] : "";
    });
    var colValorTotal = mapa["VALOR TOTAL"];
    if (colValorTotal) linha[colValorTotal - 1] = calcularValorTotalItem(item);
    aba.appendRow(linha);
  });
}

/**
 * Migração ÚNICA — rode esta função UMA VEZ, direto no editor do Apps
 * Script, depois de criar a aba COMPRAS_ITENS. Lê toda compra já
 * lançada no formato antigo (item nos próprios campos de COMPRAS) e
 * cria a linha correspondente em COMPRAS_ITENS — sem apagar nem alterar
 * nada em COMPRAS (as colunas antigas de item ficam intactas, só sem
 * uso daqui pra frente). Idempotente: pode rodar de novo sem medo, uma
 * compra que já tem item em COMPRAS_ITENS é pulada.
 */
function migrarItensParaComprasItens() {
  var abaCompras = obterAbaCompras();
  var mapaCompras = mapaColunas(abaCompras);
  var colId = mapaCompras["ID"];
  var colItem = mapaCompras["ITEM"];
  if (!colId || !colItem) {
    throw new Error("Não encontrei as colunas ID/ITEM na aba COMPRAS — nada pra migrar.");
  }
  var colCategoria = mapaCompras["CATEGORIA"];
  var colDescricao = mapaCompras["DESCRIÇÃO"];
  var colQuantidade = mapaCompras["QUANTIDADE"];
  var colUnidadeMedida = mapaCompras["UNIDADE MEDIDA"];
  var colValorUnitario = mapaCompras["VALOR UNITÁRIO"];

  var abaItens = obterAbaItens(); // erro claro se COMPRAS_ITENS ainda não existir
  var mapaItens = mapaColunas(abaItens);
  var colIdCompraItens = mapaItens["ID_COMPRA"];
  if (!colIdCompraItens) throw new Error('Coluna "ID_COMPRA" não encontrada na aba COMPRAS_ITENS.');

  var jaMigrados = {};
  var dadosItensAtuais = abaItens.getDataRange().getValues();
  for (var j = 1; j < dadosItensAtuais.length; j++) {
    var idJa = (dadosItensAtuais[j][colIdCompraItens - 1] || "").toString().trim();
    if (idJa) jaMigrados[idJa] = true;
  }

  var dadosCompras = abaCompras.getDataRange().getValues();
  var migrados = 0;
  for (var i = 1; i < dadosCompras.length; i++) {
    var idCompra = (dadosCompras[i][colId - 1] || "").toString().trim();
    var nomeItem = (dadosCompras[i][colItem - 1] || "").toString().trim();
    if (!idCompra || !nomeItem || jaMigrados[idCompra]) continue;

    var valorUnitario = colValorUnitario ? dadosCompras[i][colValorUnitario - 1] : "";
    var quantidade = colQuantidade ? dadosCompras[i][colQuantidade - 1] : "";

    var linha = new Array(abaItens.getLastColumn()).fill("");
    linha[colIdCompraItens - 1] = idCompra;
    if (mapaItens["CATEGORIA"]) linha[mapaItens["CATEGORIA"] - 1] = colCategoria ? dadosCompras[i][colCategoria - 1] : "";
    if (mapaItens["ITEM"]) linha[mapaItens["ITEM"] - 1] = nomeItem;
    if (mapaItens["DESCRIÇÃO"]) linha[mapaItens["DESCRIÇÃO"] - 1] = colDescricao ? dadosCompras[i][colDescricao - 1] : "";
    if (mapaItens["QUANTIDADE"]) linha[mapaItens["QUANTIDADE"] - 1] = quantidade;
    if (mapaItens["UNIDADE MEDIDA"]) linha[mapaItens["UNIDADE MEDIDA"] - 1] = colUnidadeMedida ? dadosCompras[i][colUnidadeMedida - 1] : "";
    if (mapaItens["VALOR UNITÁRIO"]) linha[mapaItens["VALOR UNITÁRIO"] - 1] = valorUnitario;
    if (mapaItens["VALOR TOTAL"]) linha[mapaItens["VALOR TOTAL"] - 1] = calcularValorTotalItem({ quantidade: quantidade, valorUnitario: valorUnitario });

    abaItens.appendRow(linha);
    migrados++;
  }

  var mensagem = "Migração concluída: " + migrados + " item(ns) criado(s) em COMPRAS_ITENS.";
  Logger.log(mensagem);
  return mensagem;
}

// ───────────────────────── Registrar / editar ─────────────────────────

/**
 * Cria uma compra nova. `dados.itens` é uma lista de
 * {categoria, item, descricao, quantidade, unidadeMedida, valorUnitario}
 * — só entram os itens com Categoria E Item preenchidos; precisa sobrar
 * pelo menos 1 pra poder salvar. O resto dos campos (fornecedor,
 * pagamento, status, entrega...) fica no cabeçalho da compra e pode
 * ficar em branco pra ser completado depois via editarCompra.
 */
function registrarCompra(dados) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    dados = dados || {};
    var itensValidos = (dados.itens || []).filter(function (item) {
      return item && (item.categoria || "").toString().trim() && (item.item || "").toString().trim();
    });
    if (itensValidos.length === 0) {
      throw new Error("Adicione pelo menos um item com categoria e nome preenchidos.");
    }

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
    var colValorTotal = mapa["VALOR TOTAL"];
    if (colValorTotal) linha[colValorTotal - 1] = calcularValorTotalCompra(itensValidos);
    preencherAnexosNovos(linha, mapa, dados, id);

    sheet.appendRow(linha);
    gravarItens(id, itensValidos);

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
 * do tempo (valor, fornecedor, entrega, anexos, itens...) sem precisar
 * recriar o registro. O cabeçalho parte de uma CÓPIA da linha atual,
 * então qualquer coluna não coberta por CAMPOS_COMPRA/ANEXOS_COMPRA (ou
 * um anexo sem base64 novo) mantém o valor que já tinha, automaticamente
 * — mas os ITENS são sempre substituídos por inteiro (ver
 * excluirItensDaCompra/gravarItens), nunca mesclados linha a linha.
 */
function editarCompra(id, dados) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    id = (id || "").toString().trim();
    if (!id) throw new Error("Compra não identificada.");
    dados = dados || {};

    var itensValidos = (dados.itens || []).filter(function (item) {
      return item && (item.categoria || "").toString().trim() && (item.item || "").toString().trim();
    });
    if (itensValidos.length === 0) {
      throw new Error("Adicione pelo menos um item com categoria e nome preenchidos.");
    }

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
      var colValorTotal = mapa["VALOR TOTAL"];
      if (colValorTotal) linha[colValorTotal - 1] = calcularValorTotalCompra(itensValidos);
      preencherAnexosNovos(linha, mapa, dados, id);

      sheet.getRange(i + 1, 1, 1, linha.length).setValues([linha]);

      excluirItensDaCompra(id);
      gravarItens(id, itensValidos);

      // Só grava uma entrada nova no histórico quando o status REALMENTE
      // mudou — editar outros campos (valor, fornecedor, anexo, itens...)
      // sem tocar no status não gera entrada.
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
  return HtmlService.createHtmlOutputFromFile("Compras")
    .setTitle("Compras — Mamma Mia")
    .addMetaTag("viewport", "width=device-width, initial-scale=1");
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
