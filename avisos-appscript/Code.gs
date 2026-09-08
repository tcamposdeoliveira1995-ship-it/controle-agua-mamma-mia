/**
 * PROJETO ÚNICO: registro de água via Telegram + mural de Avisos do
 * painel (mammamia-control.vercel.app). Os dois moram no mesmo projeto
 * Apps Script porque só existe 1 link (/exec) e 1 doPost por projeto —
 * então o doPost, lá embaixo, decide sozinho qual dos dois é, pelo
 * formato do corpo recebido.
 *
 * planilhaId aponta pra planilha de água — é onde tanto a aba
 * "Respostas ao formulário 1" (leituras, 1 linha por dia x 1 coluna por
 * relógio) quanto a aba "AVISOS" (mural) vivem.
 */

// Link publicado (/exec) desse Web App — o mesmo que está em
// AVISOS_EXEC_URL no painel (src/main.js). Fixo aqui de propósito:
// ScriptApp.getService().getUrl() devolve o link /dev (só funciona
// logado no navegador, não pro Telegram) quando a função roda
// manualmente pelo editor — então não dá pra confiar nele pra
// registrar o webhook. Se um dia fizer uma "Nova implantação" (não
// "Nova versão") e o link mudar, atualiza aqui E no painel.
var URL_EXEC_PUBLICADA = "https://script.google.com/macros/s/AKfycbzHvvPZzBDSB730gShVCl7CPQb23h37w8k8B-cY8n1RI-NkBJzp0eUP5m-rbtj3nGdwpw/exec";

// ================= CONFIG =================
function getConfig() {
  var props = PropertiesService.getScriptProperties();

  return {
    telegramToken: props.getProperty("TELEGRAM_TOKEN"),
    chatId: props.getProperty("TELEGRAM_CHAT_ID"),
    planilhaId: "1tixTJ74aaEo-EuCfTFl-efWOT7p-TIgN0su8NzX8aKw",
    nomeAba: "Respostas ao formulário 1",
    // Meta de consumo do ciclo, em m³, POR RELÓGIO (não somada entre os
    // 4) — configurável via Propriedades do Script (META_INDIVIDUAL_M3)
    // sem precisar mexer em código; 20 é só o valor padrão de hoje.
    metaIndividualM3: Number(props.getProperty("META_INDIVIDUAL_M3")) || 20,
    // Dia do mês em que o ciclo de faturamento começa (ex: 7 = todo dia
    // 7). Também configurável via Propriedade do Script.
    diaInicioCiclo: Number(props.getProperty("DIA_INICIO_CICLO")) || 7
  };
}

// ================= TELEGRAM =================
function enviarTelegram(msg) {
  var c = getConfig();

  var url = "https://api.telegram.org/bot" + c.telegramToken + "/sendMessage";

  UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({
      chat_id: c.chatId,
      text: msg
    })
  });
}

// ================= CONVERSÃO NUMÉRICA =================
function converterNumero(valor) {
  if (typeof valor === "string") {
    valor = valor.replace(/\./g, "").replace(",", ".");
  }
  return parseFloat(valor);
}

// ================= CONTROLE DE ALERTA =================
function jaEnviouHoje(relogio) {
  var props = PropertiesService.getScriptProperties();
  var hoje = Utilities.formatDate(new Date(), "GMT-3", "yyyy-MM-dd");
  var chave = "alerta_" + relogio + "_" + hoje;

  return props.getProperty(chave);
}

function marcarComoEnviado(relogio) {
  var props = PropertiesService.getScriptProperties();
  var hoje = Utilities.formatDate(new Date(), "GMT-3", "yyyy-MM-dd");
  var chave = "alerta_" + relogio + "_" + hoje;

  props.setProperty(chave, "true");
}

// ================= CICLO DE CONSUMO (alertas de 20/40/60/80%/meta) =================
// O ciclo de faturamento não é mês corrente — começa no dia
// c.diaInicioCiclo (hoje, dia 7) e vai até o dia anterior ao próximo
// início. Ex: hoje é dia 15 → ciclo começou dia 7 deste mês. Hoje é dia
// 3 → ciclo começou dia 7 do mês PASSADO (ainda não virou).
function calcularInicioCiclo(dataReferencia, diaInicioCiclo) {
  var ano = dataReferencia.getFullYear();
  var mes = dataReferencia.getMonth();
  var dia = dataReferencia.getDate();
  if (dia >= diaInicioCiclo) {
    return new Date(ano, mes, diaInicioCiclo);
  }
  return new Date(ano, mes - 1, diaInicioCiclo);
}

// Consumo acumulado do relógio DENTRO do ciclo atual = leitura de agora
// menos a leitura "de referência" do início do ciclo. Essa referência é
// a última leitura registrada ANTES do início do ciclo (o valor do
// hidrômetro no fechamento do ciclo anterior); se o relógio não tem
// nenhuma leitura anterior a isso (ciclo novo em folha, sem histórico),
// usa a primeira leitura já dentro do ciclo — e o consumo começa em 0
// nessa primeira leitura, já que não dá pra saber o consumo antes dela.
function calcularConsumoCiclo(dados, colRelogio, colData, inicioCiclo, leituraAtual) {
  var baseline = null;

  for (var i = dados.length - 1; i >= 1; i--) {
    var celData = dados[i][colData - 1];
    var valor = dados[i][colRelogio - 1];
    if (!celData || valor === "" || valor == null) continue;
    if (new Date(celData) < inicioCiclo) {
      baseline = converterNumero(valor);
      break;
    }
  }

  if (baseline === null) {
    for (var j = 1; j < dados.length; j++) {
      var celData2 = dados[j][colData - 1];
      var valor2 = dados[j][colRelogio - 1];
      if (!celData2 || valor2 === "" || valor2 == null) continue;
      if (new Date(celData2) >= inicioCiclo) {
        baseline = converterNumero(valor2);
        break;
      }
    }
  }

  if (baseline === null) baseline = leituraAtual; // primeiríssima leitura desse relógio

  return leituraAtual - baseline;
}

// Compara o % do ciclo contra o maior limiar já alertado (guardado por
// relógio + data de início do ciclo, pra zerar sozinho quando o ciclo
// virar) e devolve o NOVO limiar cruzado (20/40/60/80/100) — ou null se
// nenhum limiar novo foi cruzado ainda. Evita alertar 20% de novo toda
// vez que o consumo segue subindo depois de já ter passado dos 20%.
function verificarLimiarCiclo(relogio, inicioCiclo, percentual) {
  var props = PropertiesService.getScriptProperties();
  var chave = "limiar_" + relogio + "_" + Utilities.formatDate(inicioCiclo, "GMT-3", "yyyy-MM-dd");
  var limiares = [100, 80, 60, 40, 20];
  var ultimoAlertado = Number(props.getProperty(chave)) || 0;

  for (var i = 0; i < limiares.length; i++) {
    if (percentual >= limiares[i] && limiares[i] > ultimoAlertado) {
      props.setProperty(chave, String(limiares[i]));
      return limiares[i];
    }
  }
  return null;
}

// ================= REGISTRO DE LEITURA (webhook do Telegram) =================
// A aba (Respostas ao formulário 1) tem 1 LINHA POR DIA, com 1 COLUNA
// por relógio (cabeçalho = o próprio código do relógio, ex:
// "Y21T156506") — não é 1 linha por leitura. Então "RELOGIO VALOR"
// funciona assim: acha (ou cria) a linha de hoje, e preenche a coluna
// daquele relógio nela. Duas leituras de relógios diferentes no mesmo
// dia caem na mesma linha, cada uma na sua coluna.
// Aceita uma ou várias linhas na mesma mensagem — "RELOGIO VALOR" por
// linha (ex: os 4 relógios de uma vez, um por linha). Cada linha é
// tratada de forma independente (erro numa não trava as outras), e no
// final manda 1 mensagem só, resumindo o que aconteceu com cada uma.
function processarRegistroTelegram(dadosTelegram) {
  var c = getConfig();
  var msg = dadosTelegram.message.text;

  var linhas = msg.split("\n")
    .map(function (linha) { return linha.trim(); })
    .filter(function (linha) { return linha; });

  if (linhas.length === 0) {
    enviarTelegram("❌ Envie no formato:\nRELOGIO VALOR\n(pode mandar vários, um por linha)");
    return;
  }

  var planilha = SpreadsheetApp.openById(c.planilhaId);
  var sheet = planilha.getSheetByName(c.nomeAba);
  var mapa = mapaColunas(sheet);
  var colData = colunaObrigatoria(mapa, c.nomeAba, "Carimbo de data/hora");

  var dados = sheet.getDataRange().getValues();
  var agora = new Date();
  var hoje = Utilities.formatDate(agora, "GMT-3", "dd/MM/yyyy");
  var inicioCiclo = calcularInicioCiclo(agora, c.diaInicioCiclo);

  // Acha a linha de hoje uma vez só — se nenhuma leitura desta mensagem
  // precisar criar linha nova, essa variável nunca é usada pra isso.
  var linhaHoje = -1;
  for (var i = dados.length - 1; i >= 1; i--) {
    var celData = dados[i][colData - 1];
    if (!celData) continue;
    var dataFormatada = Utilities.formatDate(new Date(celData), "GMT-3", "dd/MM/yyyy");
    if (dataFormatada === hoje) {
      linhaHoje = i + 1; // +1 porque getRange é 1-based
      break;
    }
  }

  var resultados = [];

  linhas.forEach(function (linha) {
    var partes = linha.split(" ").filter(function (p) { return p; });
    if (partes.length < 2) {
      resultados.push("❓ \"" + linha + "\" — formato inválido, esperado RELOGIO VALOR");
      return;
    }

    var relogio = partes[0];
    var leituraAtual = converterNumero(partes[1]);
    var colRelogio = mapa[relogio.toUpperCase()];

    if (!colRelogio) {
      resultados.push("❌ " + relogio + " — relógio não encontrado nos cabeçalhos da aba");
      return;
    }

    // 🔒 já tem valor nessa coluna, na linha de hoje?
    if (linhaHoje !== -1) {
      var valorExistente = dados[linhaHoje - 1][colRelogio - 1];
      if (valorExistente !== "" && valorExistente != null) {
        resultados.push("⚠️ " + relogio + " — já registrado hoje");
        return;
      }
    }

    // 🔍 última leitura desse relógio (linha anterior com valor na mesma coluna)
    var ultimaLeitura = 0;
    for (var j = dados.length - 1; j >= 1; j--) {
      var valor = dados[j][colRelogio - 1];
      if (valor !== "" && valor != null) {
        ultimaLeitura = converterNumero(valor);
        break;
      }
    }
    var consumo = leituraAtual - ultimaLeitura;

    // 💾 salva — preenche a linha de hoje (criando se ainda não existir)
    if (linhaHoje === -1) {
      var novaLinha = new Array(sheet.getLastColumn()).fill("");
      novaLinha[colData - 1] = new Date();
      sheet.appendRow(novaLinha);
      linhaHoje = sheet.getLastRow();
      dados.push(novaLinha);
    }
    sheet.getRange(linhaHoje, colRelogio).setValue(leituraAtual);
    dados[linhaHoje - 1][colRelogio - 1] = leituraAtual; // reflete no snapshot em memória, pra "última leitura" das próximas linhas desta mesma mensagem já enxergar isto se repetido

    resultados.push("✅ " + relogio + " — " + ultimaLeitura + " → " + leituraAtual + " (consumo " + consumo + ")");

    // 📊 alerta de 20/40/60/80%/meta atingida do ciclo (do dia diaInicioCiclo até o próximo)
    var consumoCiclo = calcularConsumoCiclo(dados, colRelogio, colData, inicioCiclo, leituraAtual);
    var percentualCiclo = (consumoCiclo / c.metaIndividualM3) * 100;
    var limiarCruzado = verificarLimiarCiclo(relogio, inicioCiclo, percentualCiclo);
    if (limiarCruzado) {
      var dataInicioTexto = Utilities.formatDate(inicioCiclo, "GMT-3", "dd/MM");
      if (limiarCruzado >= 100) {
        resultados.push(
          "🚨 " + relogio + " — META DO CICLO ATINGIDA: " + consumoCiclo.toFixed(1) +
          "m³ de " + c.metaIndividualM3 + "m³ (ciclo desde " + dataInicioTexto + ")"
        );
      } else {
        resultados.push(
          "⚠️ " + relogio + " — " + limiarCruzado + "% da meta do ciclo (" +
          consumoCiclo.toFixed(1) + "m³ de " + c.metaIndividualM3 + "m³, desde " + dataInicioTexto + ")"
        );
      }
    }
  });

  enviarTelegram(resultados.join("\n"));
}

// ================= AVISOS (mural de post-its do painel) =================
// Aba AVISOS, na mesma planilha de água (colunas: ID | TEXTO |
// CRIADO_EM | ATUALIZADO_EM). Editar/criar/remover chamado direto do
// painel (mammamia-control.vercel.app) via fetch nesse mesmo /exec.

var ABA_AVISOS = "AVISOS";

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

function obterAbaAvisos() {
  var aba = SpreadsheetApp.openById(getConfig().planilhaId).getSheetByName(ABA_AVISOS);
  if (!aba) {
    throw new Error('Aba "' + ABA_AVISOS + '" não foi encontrada na planilha.');
  }
  return aba;
}

function respostaJson(objeto) {
  return ContentService
    .createTextOutput(JSON.stringify(objeto))
    .setMimeType(ContentService.MimeType.JSON);
}

function listarAvisos() {
  var aba = obterAbaAvisos();
  var mapa = mapaColunas(aba);
  var colId = colunaObrigatoria(mapa, ABA_AVISOS, "ID");
  var colTexto = colunaObrigatoria(mapa, ABA_AVISOS, "TEXTO");

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
    var aba = obterAbaAvisos();
    var mapa = mapaColunas(aba);
    var colId = colunaObrigatoria(mapa, ABA_AVISOS, "ID");
    var colTexto = colunaObrigatoria(mapa, ABA_AVISOS, "TEXTO");
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
    var aba = obterAbaAvisos();
    var mapa = mapaColunas(aba);
    var colId = colunaObrigatoria(mapa, ABA_AVISOS, "ID");
    var colTexto = colunaObrigatoria(mapa, ABA_AVISOS, "TEXTO");
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
    var aba = obterAbaAvisos();
    var mapa = mapaColunas(aba);
    var colId = colunaObrigatoria(mapa, ABA_AVISOS, "ID");

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

// ================= DIAGNÓSTICO DO TELEGRAM (rodar manualmente) =================
// Três funções pra rodar direto no editor (▶ Executar, escolhendo o
// nome da função no menu ao lado do botão) — sem precisar mandar
// mensagem nenhuma pro bot. Isolam os motivos mais prováveis do bot não
// responder (ou responder duplicado/desatualizado): token/chat ID
// errados, o Telegram não sabendo pra onde mandar as mensagens, ou o
// Telegram mandando pra um link (implantação) diferente do que você
// acabou de atualizar.

/**
 * 1) Roda esta primeiro. Manda uma mensagem de teste direto (sem
 * passar pelo Telegram nem pelo webhook). Chegou no seu Telegram? O
 * TELEGRAM_TOKEN e TELEGRAM_CHAT_ID (Configurações do projeto >
 * Propriedades do script) estão certos. Não chegou / deu erro na
 * execução? É isso que precisa corrigir primeiro — confere se essas
 * duas propriedades existem *nesse* projeto (elas não vêm sozinhas de
 * um projeto antigo, são por projeto).
 */
function testarTelegram() {
  enviarTelegram("🧪 Teste de conexão — se você recebeu isso, o token e o chat ID estão certos.");
}

/**
 * 2) Roda esta depois que testarTelegram funcionar. Registra (ou
 * corrige) o webhook do Telegram pra apontar pro link /exec publicado
 * (URL_EXEC_PUBLICADA acima) — é isso que faz o Telegram saber que deve
 * mandar as mensagens que você digita pro bot pra cá. Precisa rodar de
 * novo toda vez que uma "Nova implantação" (não "Nova versão") gerar um
 * link /exec diferente do anterior (e aí também precisa atualizar
 * URL_EXEC_PUBLICADA aqui em cima e AVISOS_EXEC_URL no painel).
 */
function registrarWebhookTelegram() {
  var c = getConfig();
  var urlAtual = URL_EXEC_PUBLICADA;
  var url = "https://api.telegram.org/bot" + c.telegramToken + "/setWebhook?url=" + encodeURIComponent(urlAtual);
  var resposta = UrlFetchApp.fetch(url);
  Logger.log(resposta.getContentText());
  enviarTelegram("🔗 Webhook registrado pra:\n" + urlAtual);
}

/**
 * 3) Roda esta se, mesmo depois de implantar uma correção (Nova
 * versão), o bot continuar se comportando como o código ANTIGO (ex.:
 * respostas duplicadas voltando mesmo depois do conserto). Um projeto
 * pode acumular várias implantações (cada uma com seu próprio link
 * /exec) — se a "Nova versão" foi aplicada numa implantação diferente
 * da que o Telegram está realmente chamando, o Telegram continua
 * batendo no código velho pra sempre. Esta função manda pro seu
 * Telegram o link EXATO que ele está usando agora; compare o trecho
 * depois de "/macros/s/" e antes de "/exec" com o "Código de
 * implantação" de cada entrada em Implantar > Gerenciar implantações —
 * a implantação com o MESMO trecho é a única que precisa da Nova
 * versão. Se não bater com nenhuma que você reconhece, rode
 * registrarWebhookTelegram() (função 2) pra realinhar o Telegram com a
 * implantação certa (URL_EXEC_PUBLICADA).
 */
function verificarWebhookAtual() {
  var c = getConfig();
  var url = "https://api.telegram.org/bot" + c.telegramToken + "/getWebhookInfo";
  var resposta = UrlFetchApp.fetch(url);
  Logger.log(resposta.getContentText());
  var info = JSON.parse(resposta.getContentText());
  enviarTelegram("🔍 Link que o Telegram está usando agora:\n" + info.result.url);
}

// ================= ROTEAMENTO DO WEB APP =================

/** GET — só usado pelo painel, pra listar os avisos. */
function doGet(e) {
  try {
    return respostaJson(listarAvisos());
  } catch (erro) {
    return respostaJson({ ok: false, erro: erro.message });
  }
}

/**
 * Um projeto Apps Script só pode ter 1 doPost — esse aqui atende dois
 * usos que antes eram (indevidamente) dois doPost em conflito: o
 * webhook do Telegram (registro de leitura do relógio de água) e as
 * ações do mural de Avisos do painel. Distingue pelo formato do corpo:
 * webhook do Telegram manda {message: {...}}; o painel manda
 * {acao: "criar"|"editar"|"remover", ...}.
 */
function doPost(e) {
  var dados = JSON.parse(e.postData.contents);

  if (dados.message) {
    // O Telegram reenvia a MESMA atualização (mesmo update_id) se não
    // receber confirmação rápido o suficiente — sem essa trava, cada
    // reenvio processava a leitura de novo e mandava mensagem
    // duplicada. Cache de 10 min é de sobra pra cobrir qualquer
    // sequência de reenvio.
    if (dados.update_id != null) {
      var cache = CacheService.getScriptCache();
      var chaveUpdate = "update_" + dados.update_id;
      if (cache.get(chaveUpdate)) {
        return ContentService.createTextOutput("ok");
      }
      cache.put(chaveUpdate, "1", 600);
    }

    // Nunca deixa um erro aqui passar em silêncio de novo — se algo
    // quebrar (aba errada, planilha sem permissão, etc.), pelo menos
    // chega um aviso no Telegram em vez de nada.
    try {
      processarRegistroTelegram(dados);
    } catch (erro) {
      Logger.log("Erro no registro de água: " + erro);
      try {
        enviarTelegram("⚠️ Erro ao registrar: " + erro.message);
      } catch (erroTelegram) {
        Logger.log("Nem o aviso de erro foi enviado: " + erroTelegram);
      }
    }
    return ContentService.createTextOutput("ok");
  }

  try {
    if (dados.acao === "criar") return respostaJson(criarAviso(dados.texto));
    if (dados.acao === "editar") return respostaJson(editarAviso(dados.id, dados.texto));
    if (dados.acao === "remover") return respostaJson(removerAviso(dados.id));
    throw new Error("Ação inválida: " + dados.acao);
  } catch (erro) {
    return respostaJson({ ok: false, erro: erro.message });
  }
}
