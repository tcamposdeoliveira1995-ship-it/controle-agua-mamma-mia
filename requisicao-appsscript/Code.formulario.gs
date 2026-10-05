/**
 * REQUISIÇÃO DE MATÉRIA-PRIMA E RECHEIOS — script do FORMULÁRIO
 * ---------------------------------------------------------------------
 * ATENÇÃO — existem DOIS projetos Apps Script para essa mesma
 * requisição, cada um preso a um lugar diferente do Google. Pra saber
 * qual abrir:
 *   - ESTE arquivo (Code.formulario.gs) é o projeto preso ao
 *     FORMULÁRIO em si (dentro do Google Forms: ⋮ > Editor de
 *     script). Tem CATALOGO_PRODUTOS, FORM_ID, e funções de
 *     diagnóstico tipo listarTitulosDoFormulario().
 *   - `Code.gs` (no mesmo diretório deste arquivo) é o projeto preso à
 *     PLANILHA de respostas (Extensões > Apps Script, de dentro da
 *     planilha "BASE - REQUISIÇÃO MP E RECHEIOS"). Tem STATUS_ABERTO e
 *     as telas de Fechar/Histórico (Menu.html, FecharRequisicao.html,
 *     HistoricoRequisicoes.html).
 * Os dois têm sua PRÓPRIA função `enviarRequisicaoTelegram` e cada um
 * pode ter seu próprio acionador "Ao enviar o formulário" — se os dois
 * acionadores estiverem ativos ao mesmo tempo, toda requisição nova
 * manda Telegram (e cria Documento) EM DOBRO. Vale conferir em
 * Acionadores ⏰ dos dois projetos se isso está acontecendo.
 *
 * Esta cópia foi colada pela usuária em 05/10/2026 pra registrar no
 * repositório (não existia aqui antes) e ajustar as perguntas de
 * Tomate e Cebola — ver `ajustarPerguntasTomateECebola()` perto do
 * fim do arquivo. Ver
 * docs/superpowers/specs/2026-10-05-requisicao-formulario-tomate-cebola-design.md
 * no repo controle-agua-mamma-mia.
 */

/****************************************************
 * MAMMA MIA OPERAÇÕES
 * REQUISIÇÃO DE MATÉRIA-PRIMA E RECHEIOS
 ****************************************************/

/****************************************************
 * CATÁLOGO DE PRODUTOS
 * Nomes EXATOS conforme o Google Forms
 ****************************************************/

const CATALOGO_PRODUTOS = [

  // --- SEÇÃO 1: MATÉRIA-PRIMA ---
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
  "MIX FD 750 (CX)", "AMACIANTE ESFIHA (CX)",

  // --- SEÇÃO 2: RECHEIO ---
  // TOMATE IN NATURA mudou de CAIXA pra KG (pedido da usuária,
  // 05/10/2026) — ver ajustarPerguntasTomateECebola() mais abaixo, que
  // reconfigura a pergunta de verdade no formulário pra bater com isto.
  "TOMATE IN NATURA (KG)", "SALSA PICADA (PCT)", "CEBOLA PICADA (PCT)",
  "MOLHO DE TOMATE (PCT)", "BACON TRITURADO (PCT)", "BROCOLIS (PCT)",
  "FRANGO (KG)", "PROTEÍNA CALABRESA (PCT)", "PROTEÍNA FRANGO (PCT)",
  "CARNE MOIDA (KG)", "CARNE LOUCA (KG)", "MOLHO CHEDDAR (PCT)",

  // --- SEÇÃO 3: EMBALAGENS/CAIXAS/DESCARTÁVEIS ---
  "BOBINA FLOW PACK (RL)", "STRESH (RL)", "CAIXA PEQUENA (UNI)", "CAIXA GRANDE (UNI)",
  "ETIQUETA (CX)", "DUREX (FD)", "EMBALAGEM 34X45 (PCT)", "EMBALAGEM 40X60  (PCT)",
  "Caixa de empada (UN)"

];


/****************************************************
 * ALIASES DE PRODUTOS
 * O formulário tem uma 2ª seção de RECHEIO com nomes
 * levemente diferentes do CATALOGO_PRODUTOS (acento,
 * unidade, ou palavra faltando). Cada alias aponta
 * para o nome canônico correspondente no catálogo.
 ****************************************************/

const ALIASES_PRODUTOS = {
  "molho tomate (pct)":   "MOLHO DE TOMATE (PCT)",
  "carne moida (pct)":    "CARNE MOIDA (KG)",
  "carne louca (pct)":    "CARNE LOUCA (KG)",
  "brocolis (pct)":       "BROCOLIS (PCT)",
  "frango (pct)":         "FRANGO (KG)",
  "emb 35x45 (pct)":      "EMBALAGEM 34X45 (PCT)",
  "emb 40x60 (pct)":      "EMBALAGEM 40X60  (PCT)",
  "filme strech (rl)":    "STRESH (RL)"
};


/****************************************************
 * ITENS EM FORMATO DE GRADE (GRID)
 * O formulário tem uma pergunta de grade cujo título
 * aparece como: "Item requisitado [Categoria | PRODUTO | UNIDADE]"
 * Lida dinamicamente com QUALQUER linha dessa grade —
 * não precisa cadastrar produto por produto no código.
 ****************************************************/

function getItensDeGrade(dados) {

  const itensGrade = [];
  const padraoGrade = /^Item requisitado\s*\[(.+)\]$/i;

  Object.keys(dados).forEach(function(chave) {

    const match = chave.match(padraoGrade);
    if (!match) return;

    const valor = dados[chave];
    if (!valor || String(valor).trim() === "") return;

    // Conteúdo dentro dos colchetes, ex: "Matéria-prima | AÇAFRAO | KG"
    const partes = match[1].split("|").map(function(p) { return p.trim(); });

    // Última parte = unidade, penúltima = nome do produto
    const unidade = partes.length >= 2 ? partes[partes.length - 1] : "";
    const nomeProduto = partes.length >= 2 ? partes[partes.length - 2] : partes[0];

    const nomeFormatado = unidade ? `${nomeProduto} (${unidade})` : nomeProduto;

    itensGrade.push(`${nomeFormatado}: ${valor}`);

  });

  return itensGrade;

}


/****************************************************
 * NORMALIZA TEXTO
 * Remove acentos, espaços extras e converte para
 * minúsculas, para tornar a comparação de nomes mais
 * tolerante a pequenas divergências.
 ****************************************************/

function normalizarTexto(texto) {
  return String(texto)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos
    .trim()
    .toLowerCase();
}


/****************************************************
 * MONTA LISTA DE ITENS PREENCHIDOS
 ****************************************************/

function getItensSolicitados(dados) {

  // Mapa: chave normalizada -> chave original (como veio do Form)
  const mapaNormalizado = {};

  Object.keys(dados).forEach(function(chaveOriginal) {
    const chaveNormalizada = normalizarTexto(chaveOriginal);
    mapaNormalizado[chaveNormalizada] = chaveOriginal;
  });

  const itensPreenchidos = [];

  CATALOGO_PRODUTOS.forEach(function(nomeProduto) {

    const chaveBusca = normalizarTexto(nomeProduto);

    // 1) Tenta achar pelo nome direto (normalizado)
    let chaveReal = mapaNormalizado[chaveBusca];
    let quantidade = chaveReal ? dados[chaveReal] : null;

    // 2) Se não achou (ou veio vazio), procura nos aliases
    if (!quantidade || String(quantidade).trim() === "") {
      Object.keys(ALIASES_PRODUTOS).forEach(function(chaveAlias) {
        if (ALIASES_PRODUTOS[chaveAlias] !== nomeProduto) return;

        const chaveAliasReal = mapaNormalizado[chaveAlias];
        if (!chaveAliasReal) return;

        const valorAlias = dados[chaveAliasReal];
        if (valorAlias && String(valorAlias).trim() !== "") {
          quantidade = valorAlias;
        }
      });
    }

    if (quantidade && String(quantidade).trim() !== "") {
      itensPreenchidos.push(`${nomeProduto}: ${quantidade}`);
    }

  });

  // Adiciona itens vindos da pergunta em formato de grade (ex: AÇAFRAO, AÇUCAR extra)
  const itensGrade = getItensDeGrade(dados);
  itensGrade.forEach(function(item) {
    itensPreenchidos.push(item);
  });

  return itensPreenchidos;

}


/****************************************************
 * ENVIO PRINCIPAL DA REQUISIÇÃO
 * (Prioridade e Observações removidas — não existem
 * mais como perguntas no formulário)
 ****************************************************/

function enviarRequisicaoTelegram(e) {

  if (!e || !e.response) {
    throw new Error("Esta função deve ser executada pelo formulário.");
  }

  // Proteção contra disparo duplicado do gatilho (ex.: mais de um
  // acionador "on form submit" ativo, ou reenvio de evento pelo Forms).
  // Cada resposta do formulário tem um ID único e estável — se essa
  // mesma resposta já foi processada há pouco, ignoramos a repetição.
  const idResposta = e.response.getId();
  const cache = CacheService.getScriptCache();
  const chaveCache = "requisicao_processada_" + idResposta;

  if (cache.get(chaveCache)) {
    Logger.log(`[DIAGNÓSTICO] Resposta ${idResposta} já foi processada — ignorando disparo duplicado.`);
    return;
  }
  cache.put(chaveCache, "1", 21600); // 6 horas

  const respostas = e.response.getItemResponses();

  Logger.log(`[DIAGNÓSTICO] Total de respostas recebidas pelo evento: ${respostas.length}`);

  const dados = {};

  respostas.forEach(function(resposta) {
    const pergunta = resposta.getItem().getTitle();
    const valor = resposta.getResponse();
    // Só sobrescreve se o novo valor não for vazio — evita que uma
    // pergunta duplicada (mesmo título, em branco) apague um valor
    // já preenchido em outra ocorrência da mesma pergunta.
    if (valor && String(valor).trim() !== "") {
      dados[pergunta] = valor;
    } else if (!(pergunta in dados)) {
      dados[pergunta] = valor;
    }
  });

  Logger.log(`[DIAGNÓSTICO] Chaves com valor não-vazio em "dados": ${JSON.stringify(Object.keys(dados).filter(function(k) { return dados[k] && String(dados[k]).trim() !== ""; }))}`);

  const idRequisicao = gerarIDRequisicao();

  const linkDocumento = criarDocumentoRequisicao(dados, idRequisicao);

  const requisitante  = dados["Nome do requisitante"]       || "";
  const unidade       = dados["Unidade solicitante"]        || "";
  const setor         = dados["Setor solicitante"]          || "";
  const tipo          = dados["Tipo de item requisitado"]   || "";
  const finalidade    = dados["Finalidade da requisição"]   || "";

  const itensArray = getItensSolicitados(dados);

  Logger.log(`[DIAGNÓSTICO] getItensSolicitados() retornou ${itensArray.length} item(ns): ${JSON.stringify(itensArray)}`);

  const itens = itensArray.length > 0
    ? itensArray.join("\n")
    : "Nenhum item informado.";

  const mensagem =
`📦 NOVA REQUISIÇÃO OPERACIONAL

🆔 ${idRequisicao}

👤 Requisitante: ${requisitante}
🏭 Unidade solicitante: ${unidade}
📍 Setor: ${setor}

📋 Tipo: ${tipo}

📦 Itens solicitados (${itensArray.length}):
${itens}

🎯 Finalidade: ${finalidade}

📄 Documento da requisição:
${linkDocumento}

🤖 Mamma Mia Operações`;

  enviarTelegram(mensagem);

}


/****************************************************
 * GERA ID AUTOMÁTICO
 ****************************************************/

function gerarIDRequisicao() {

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {

    const propriedades = PropertiesService.getScriptProperties();

    const hoje = Utilities.formatDate(new Date(), "GMT-3", "yyyyMMdd");

    const chaveData     = "DATA_CONTADOR_REQUISICAO";
    const chaveContador = "CONTADOR_REQUISICAO";

    const dataSalva = propriedades.getProperty(chaveData);

    let contador = Number(propriedades.getProperty(chaveContador) || 0);

    if (dataSalva !== hoje) {
      contador = 1;
      propriedades.setProperty(chaveData, hoje);
    } else {
      contador++;
    }

    propriedades.setProperty(chaveContador, String(contador));

    const numero = String(contador).padStart(3, "0");

    return `RQ-${hoje}-${numero}`;

  } finally {
    lock.releaseLock();
  }

}


/****************************************************
 * CRIA DOCUMENTO AUTOMÁTICO
 * (Prioridade e Observações removidas do documento)
 ****************************************************/

function criarDocumentoRequisicao(dados, idRequisicao) {

  const nomeArquivo = `${idRequisicao} - REQUISICAO`;
  const doc  = DocumentApp.create(nomeArquivo);
  const body = doc.getBody();

  // LOGO
  const LOGO_ID = "1mBHCppmwzj65IlT7kCKXInhSV-ltqE3I";
  const logo = DriveApp.getFileById(LOGO_ID).getBlob();
  const paragrafoLogo = body.appendParagraph("");
  paragrafoLogo.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  const imagem = paragrafoLogo.appendInlineImage(logo);
  imagem.setWidth(120);
  imagem.setHeight(120);

  // TÍTULO
  const titulo = body.appendParagraph("REQUISIÇÃO OPERACIONAL");
  titulo.setHeading(DocumentApp.ParagraphHeading.HEADING1);
  titulo.setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  // ID E DATA
  body.appendParagraph(`ID: ${idRequisicao}`);
  body.appendParagraph(`Data: ${Utilities.formatDate(new Date(), "GMT-3", "dd/MM/yyyy HH:mm")}`);
  body.appendParagraph("");

  // SOLICITANTE
  body.appendParagraph(`Requisitante: ${dados["Nome do requisitante"]       || ""}`);
  body.appendParagraph(`Unidade solicitante: ${dados["Unidade solicitante"] || ""}`);
  body.appendParagraph(`Setor: ${dados["Setor solicitante"]                 || ""}`);
  body.appendParagraph("");

  // REQUISIÇÃO
  body.appendParagraph(`Tipo: ${dados["Tipo de item requisitado"] || ""}`);
  body.appendParagraph("Itens solicitados:");

  const itensArray = getItensSolicitados(dados);

  if (itensArray.length === 0) {
    body.appendParagraph("Nenhum item informado.");
  } else {
    itensArray.forEach(function(item) {
      body.appendParagraph("• " + item);
    });
  }

  body.appendParagraph("");
  body.appendParagraph(`Finalidade: ${dados["Finalidade da requisição"] || ""}`);
  body.appendParagraph("");

  // STATUS
  body.appendParagraph("Status: SOLICITADO");

  doc.saveAndClose();

  const arquivo = DriveApp.getFileById(doc.getId());
  arquivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return arquivo.getUrl();

}


/****************************************************
 * ENVIO TELEGRAM
 ****************************************************/

function enviarTelegram(mensagem) {

  if (!mensagem || String(mensagem).trim() === "") {
    throw new Error("Mensagem vazia.");
  }

  const propriedades  = PropertiesService.getScriptProperties();
  const TELEGRAM_TOKEN = propriedades.getProperty("TELEGRAM_TOKEN");
  const CHAT_ID        = propriedades.getProperty("TELEGRAM_CHAT_ID");

  if (!TELEGRAM_TOKEN) throw new Error("TELEGRAM_TOKEN não encontrado.");
  if (!CHAT_ID)        throw new Error("TELEGRAM_CHAT_ID não encontrado.");

  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;

  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({ chat_id: CHAT_ID, text: mensagem }),
    muteHttpExceptions: true
  };

  const resposta = UrlFetchApp.fetch(url, options);
  Logger.log(resposta.getContentText());

}


/****************************************************
 * CRIA ACIONADOR — EXECUTAR APENAS UMA VEZ
 ****************************************************/

function criarAcionadorPeloFormulario() {

  const FORM_ID = "1ctKlvm5n82h0eLScNaLJANSjmyO2WGVexLTiu56Urco";
  const form = FormApp.openById(FORM_ID);

  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === "enviarRequisicaoTelegram") {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger("enviarRequisicaoTelegram")
    .forForm(form)
    .onFormSubmit()
    .create();

}


/****************************************************
 * AJUSTA AS PERGUNTAS DE TOMATE E CEBOLA
 * EXECUTAR 1 VEZ, manualmente, pelo editor do Apps
 * Script deste projeto (o preso ao FORMULÁRIO — ver
 * comentário no topo do arquivo). Transforma as
 * perguntas de quantidade em lista suspensa (dropdown),
 * em vez de resposta livre:
 *  - Tomate: muda de CAIXA pra KG, com as opções fixas
 *    60, 90, 120 e 150.
 *  - Cebola: continua em pacotes (PCT), ganha as opções
 *    fixas 10, 20, 30 e 40.
 * Se a pergunta já não existir com o título esperado
 * (ex.: alguém já mudou o nome por fora), só avisa no
 * Log e não faz nada — não cria pergunta nova do zero.
 ****************************************************/

function itemEhObrigatorio_(item) {
  var tipo = item.getType();
  if (tipo === FormApp.ItemType.TEXT) return item.asTextItem().isRequired();
  if (tipo === FormApp.ItemType.PARAGRAPH_TEXT) return item.asParagraphTextItem().isRequired();
  if (tipo === FormApp.ItemType.LIST) return item.asListItem().isRequired();
  if (tipo === FormApp.ItemType.MULTIPLE_CHOICE) return item.asMultipleChoiceItem().isRequired();
  if (tipo === FormApp.ItemType.CHECKBOX) return item.asCheckboxItem().isRequired();
  if (tipo === FormApp.ItemType.SCALE) return item.asScaleItem().isRequired();
  return false; // tipo não mapeado — assume opcional em vez de travar o script
}

function transformarEmListaSuspensa_(form, tituloAtual, tituloNovo, valoresPermitidos) {
  var itens = form.getItems();
  var alvo = null;
  for (var i = 0; i < itens.length; i++) {
    if (itens[i].getTitle() === tituloAtual) { alvo = itens[i]; break; }
  }
  if (!alvo) {
    Logger.log('Pergunta "' + tituloAtual + '" não encontrada no formulário — nada feito.');
    return;
  }

  if (alvo.getType() === FormApp.ItemType.LIST) {
    // Já é lista suspensa — só atualiza título/opções, sem mexer na posição.
    var listaExistente = alvo.asListItem();
    listaExistente.setTitle(tituloNovo);
    listaExistente.setChoiceValues(valoresPermitidos);
    Logger.log('Pergunta "' + tituloAtual + '" já era lista suspensa — atualizei título/opções pra "' + tituloNovo + '": ' + valoresPermitidos.join(', '));
    return;
  }

  var indice = alvo.getIndex();
  var obrigatoria = itemEhObrigatorio_(alvo);

  form.deleteItem(alvo);

  var novoItem = form.addListItem();
  novoItem.setTitle(tituloNovo);
  novoItem.setChoiceValues(valoresPermitidos);
  novoItem.setRequired(obrigatoria);
  novoItem.setIndex(indice);

  Logger.log('Pergunta "' + tituloAtual + '" convertida em lista suspensa "' + tituloNovo + '" com opções: ' + valoresPermitidos.join(', '));
}

function ajustarPerguntasTomateECebola() {
  var form = FormApp.getActiveForm();
  transformarEmListaSuspensa_(form, "TOMATE IN NATURA (CX)", "TOMATE IN NATURA (KG)", ["60", "90", "120", "150"]);
  transformarEmListaSuspensa_(form, "CEBOLA PICADA (PCT)", "CEBOLA PICADA (PCT)", ["10", "20", "30", "40"]);
}


/****************************************************
 * TESTE MANUAL TELEGRAM
 ****************************************************/

function testarEnvioTelegram() {

  enviarTelegram(
`🚀 TESTE OPERACIONAL

🤖 Integração funcionando perfeitamente.

📦 Mamma Mia Operações ONLINE`
  );

}


/****************************************************
 * LOCALIZAR PLANILHA DE RESPOSTAS
 ****************************************************/

function localizarPlanilhaRespostas() {

  const FORM_ID = "1ctKlvm5n82h0eLScNaLJANSjmyO2WGVexLTiu56Urco";
  const form = FormApp.openById(FORM_ID);
  Logger.log(form.getDestinationId());

}


/****************************************************
 * DIAGNÓSTICO: lista títulos do formulário
 ****************************************************/

function listarTitulosDoFormulario() {

  const form = FormApp.getActiveForm();
  const items = form.getItems();
  items.forEach(function(item) {
    Logger.log(`"${item.getTitle()}"`);
  });

}


/****************************************************
 * DIAGNÓSTICO: inspeciona a última resposta real
 ****************************************************/

function inspecionarUltimaResposta() {

  const form = FormApp.getActiveForm();
  const respostasForm = form.getResponses();

  if (respostasForm.length === 0) {
    Logger.log("Nenhuma resposta encontrada no formulário.");
    return;
  }

  const ultimaResposta = respostasForm[respostasForm.length - 1];
  const itemResponses  = ultimaResposta.getItemResponses();

  Logger.log(`Total de perguntas respondidas: ${itemResponses.length}`);
  Logger.log("---------------------------------------------------");

  itemResponses.forEach(function(resposta) {
    const titulo = resposta.getItem().getTitle();
    const valor  = resposta.getResponse();
    if (valor && String(valor).trim() !== "") {
      Logger.log(`PERGUNTA: "${titulo}"   |   VALOR: "${valor}"`);
    }
  });

  Logger.log("---------------------------------------------------");

}


/****************************************************
 * DIAGNÓSTICO: reprocessa última resposta sem enviar
 ****************************************************/

function testarReprocessamentoUltimaResposta() {

  const form = FormApp.getActiveForm();
  const respostasForm = form.getResponses();

  if (respostasForm.length === 0) {
    Logger.log("Nenhuma resposta encontrada.");
    return;
  }

  const ultimaResposta = respostasForm[respostasForm.length - 1];
  const itemResponses  = ultimaResposta.getItemResponses();

  const dados = {};

  itemResponses.forEach(function(resposta) {
    const pergunta = resposta.getItem().getTitle();
    const valor    = resposta.getResponse();
    dados[pergunta] = valor;
  });

  Logger.log("Chaves disponíveis:");
  Logger.log(JSON.stringify(Object.keys(dados)));
  Logger.log("---------------------------------------------------");

  const itensArray = getItensSolicitados(dados);

  Logger.log(`getItensSolicitados() encontrou ${itensArray.length} item(ns):`);
  itensArray.forEach(function(item) {
    Logger.log(" -> " + item);
  });

}


/****************************************************
 * DIAGNÓSTICO: cobertura completa do catálogo
 * Simula TODAS as colunas conhecidas do formulário
 * (preenchidas com valor fictício) e roda
 * getItensSolicitados() para checar:
 *  A) quais produtos do CATALOGO_PRODUTOS NÃO batem
 *     com nenhuma coluna/alias (ainda quebrados)
 *  B) quais colunas do formulário não são reconhecidas
 *     nem pelo catálogo nem pelos aliases (órfãs)
 * NÃO cria documento nem envia Telegram.
 ****************************************************/

const COLUNAS_FORM_CONHECIDAS = [
  // --- MATÉRIA-PRIMA ---
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
  "MIX FD 750 (CX)", "AMACIANTE ESFIHA (CX)",

  // --- EMBALAGENS (1ª ocorrência no Forms — nomes abreviados) ---
  "Emb 35x45 (PCT)", "Emb 40x60 (PCT)", "DUREX (FD)", "ETIQUETA (CX)",
  "Caixa pequena (UNI)", "CAIXA GRANDE (UNI)", "Filme strech (RL)", "BOBINA FLOW PACK (RL)",
  "Caixa de empada (UN)",

  // --- RECHEIO (1ª ocorrência) ---
  // TOMATE IN NATURA mudou de (CX) pra (KG) — ver comentário em
  // CATALOGO_PRODUTOS e ajustarPerguntasTomateECebola().
  "TOMATE IN NATURA (KG)", "SALSA PICADA (PCT)", "CEBOLA PICADA (PCT)",
  "MOLHO DE TOMATE (PCT)", "BACON TRITURADO (PCT)", "BROCOLIS (PCT)",
  "FRANGO (KG)", "PROTEÍNA CALABRESA (PCT)", "PROTEÍNA FRANGO (PCT)",

  // --- EMBALAGENS (2ª ocorrência — nomes completos do catálogo) ---
  "STRESH (RL)", "CAIXA PEQUENA (UNI)", "EMBALAGEM 34X45 (PCT)", "EMBALAGEM 40X60  (PCT)",

  // --- RECHEIO (2ª ocorrência) ---
  "CARNE MOIDA (KG)", "CARNE LOUCA (KG)", "MOLHO CHEDDAR (PCT)",

  // --- RECHEIO (3ª ocorrência — nomes divergentes) ---
  "MOLHO TOMATE (PCT)", "CARNE MOÍDA (PCT)", "CARNE LOUCA (PCT)",
  "BRÓCOLIS (PCT)", "FRANGO (PCT)",

  // --- PERGUNTA EM GRADE (formato diferente, fora do padrão) ---
  "Item requisitado [Matéria-prima | AÇAFRAO | KG]",
  "Item requisitado [Matéria-prima | AÇUCAR | KG]"
];

function testarCoberturaCompleta() {

  // Monta um "dados" fictício com TODAS as colunas preenchidas
  const dados = {};
  COLUNAS_FORM_TESTE_UNICAS().forEach(function(coluna) {
    dados[coluna] = "1";
  });

  const itensArray = getItensSolicitados(dados);

  Logger.log(`Total de colunas simuladas: ${COLUNAS_FORM_TESTE_UNICAS().length}`);
  Logger.log(`Total de produtos do catálogo reconhecidos: ${itensArray.length} de ${CATALOGO_PRODUTOS.length}`);
  Logger.log("---------------------------------------------------");

  // A) Produtos do catálogo que NÃO foram encontrados
  const produtosEncontrados = itensArray.map(function(linha) {
    return linha.split(":")[0];
  });

  const produtosFaltando = CATALOGO_PRODUTOS.filter(function(produto) {
    return produtosEncontrados.indexOf(produto) === -1;
  });

  Logger.log(`PRODUTOS DO CATÁLOGO SEM NENHUMA COLUNA CORRESPONDENTE (${produtosFaltando.length}):`);
  produtosFaltando.forEach(function(p) { Logger.log(" -> " + p); });
  Logger.log("---------------------------------------------------");

  // B) Colunas do formulário que não batem com catálogo nem alias (órfãs)
  const nomesCatalogoNormalizados = CATALOGO_PRODUTOS.map(normalizarTexto);
  const aliasesNormalizados = Object.keys(ALIASES_PRODUTOS);

  const padraoGradeDiagnostico = /^Item requisitado\s*\[.+\]$/i;

  const colunasOrfas = COLUNAS_FORM_TESTE_UNICAS().filter(function(coluna) {
    const chaveNorm = normalizarTexto(coluna);
    const bateCatalogo = nomesCatalogoNormalizados.indexOf(chaveNorm) !== -1;
    const bateAlias = aliasesNormalizados.indexOf(chaveNorm) !== -1;
    const bateGrade = padraoGradeDiagnostico.test(coluna);
    return !bateCatalogo && !bateAlias && !bateGrade;
  });

  Logger.log(`COLUNAS DO FORMULÁRIO SEM MAPEAMENTO (${colunasOrfas.length}):`);
  colunasOrfas.forEach(function(c) { Logger.log(" -> " + c); });
  Logger.log("---------------------------------------------------");

}

function COLUNAS_FORM_TESTE_UNICAS() {
  // Remove duplicatas exatas da lista de colunas conhecidas
  const vistos = {};
  const unicas = [];
  COLUNAS_FORM_CONHECIDAS.forEach(function(c) {
    if (!vistos[c]) {
      vistos[c] = true;
      unicas.push(c);
    }
  });
  return unicas;
}


/****************************************************
 * DIAGNÓSTICO: títulos de pergunta duplicados
 * Lista qualquer título de pergunta que aparece mais
 * de uma vez no formulário — a causa mais provável de
 * um valor preenchido "sumir" (uma ocorrência em
 * branco sobrescrevendo a ocorrência preenchida).
 ****************************************************/

function diagnosticarTitulosDuplicados() {

  const form = FormApp.getActiveForm();
  const items = form.getItems();

  const contagem = {};

  items.forEach(function(item) {
    const titulo = item.getTitle();
    contagem[titulo] = (contagem[titulo] || 0) + 1;
  });

  const duplicados = Object.keys(contagem).filter(function(titulo) {
    return contagem[titulo] > 1;
  });

  Logger.log(`Total de perguntas no formulário: ${items.length}`);
  Logger.log(`Títulos duplicados encontrados: ${duplicados.length}`);
  Logger.log("---------------------------------------------------");

  duplicados.forEach(function(titulo) {
    Logger.log(`"${titulo}" aparece ${contagem[titulo]}x`);
  });

  Logger.log("---------------------------------------------------");

}


/****************************************************
 * REENVIA A ÚLTIMA REQUISIÇÃO PARA O TELEGRAM
 * (Prioridade e Observações removidas)
 ****************************************************/

function reenviarUltimaRequisicaoTelegram() {

  const form = FormApp.getActiveForm();
  const respostasForm = form.getResponses();

  if (respostasForm.length === 0) {
    Logger.log("Nenhuma resposta encontrada.");
    return;
  }

  const ultimaResposta = respostasForm[respostasForm.length - 1];
  const itemResponses  = ultimaResposta.getItemResponses();

  const dados = {};
  itemResponses.forEach(function(resposta) {
    const pergunta = resposta.getItem().getTitle();
    const valor = resposta.getResponse();
    if (valor && String(valor).trim() !== "") {
      dados[pergunta] = valor;
    } else if (!(pergunta in dados)) {
      dados[pergunta] = valor;
    }
  });

  const idRequisicao  = gerarIDRequisicao();
  const linkDocumento = criarDocumentoRequisicao(dados, idRequisicao);

  const requisitante = dados["Nome do requisitante"]     || "";
  const unidade      = dados["Unidade solicitante"]      || "";
  const setor        = dados["Setor solicitante"]        || "";
  const tipo         = dados["Tipo de item requisitado"] || "";
  const finalidade   = dados["Finalidade da requisição"] || "";

  const itensArray = getItensSolicitados(dados);
  const itens = itensArray.length > 0 ? itensArray.join("\n") : "Nenhum item informado.";

  const mensagem =
`📦 NOVA REQUISIÇÃO OPERACIONAL

🆔 ${idRequisicao}

👤 Requisitante: ${requisitante}
🏭 Unidade solicitante: ${unidade}
📍 Setor: ${setor}

📋 Tipo: ${tipo}

📦 Itens solicitados (${itensArray.length}):
${itens}

🎯 Finalidade: ${finalidade}

📄 Documento da requisição:
${linkDocumento}

🤖 Mamma Mia Operações`;

  enviarTelegram(mensagem);

  Logger.log("Reenviado: " + idRequisicao);

}
