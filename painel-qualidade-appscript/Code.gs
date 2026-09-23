/**
 * PAINEL QUALIDADE — tela inicial (hub) + módulos que não têm projeto
 * Apps Script próprio
 * ---------------------------------------------------------------------
 * Ponto de entrada único de onde a usuária lança tudo (Compras, Insumos
 * Críticos, e depois Auditoria, Dedetização, Avisos, conforme cada um
 * for migrado) — o Mamma Mia Control fica só de leitura. Ver
 * docs/superpowers/specs/2026-09-23-painel-qualidade-compras-design.md e
 * 2026-09-23-painel-qualidade-insumos-design.md, no repo
 * controle-agua-mamma-mia.
 *
 * Esse projeto não tem dado próprio nenhum — cada módulo migrado que já
 * tinha seu próprio projeto Apps Script (ex.: Compras) ganha uma tela
 * HTML DENTRO DAQUELE projeto, e aqui só entra um link. Já os módulos
 * que nunca tiveram projeto próprio (ex.: Insumos Críticos, cujo backend
 * é um Apps Script externo que já existia sem código-fonte neste repo)
 * ganham a tela HTML AQUI MESMO, roteada por `?tela=`, chamando o mesmo
 * backend de sempre — nada muda do lado de quem só lê os dados. Por não
 * ter dado próprio, pode ser criado como projeto AVULSO do Apps Script,
 * sem vincular a nenhuma planilha.
 *
 * Como instalar (do zero):
 * 1) Acesse script.google.com (fora de qualquer planilha) > Novo projeto.
 * 2) Apague o conteúdo padrão do Code.gs e cole este arquivo no lugar.
 * 3) Crie um arquivo novo do tipo HTML chamado exatamente "Menu" e cole
 *    o conteúdo de Menu.html nele.
 * 4) No Menu.html, troque o texto "COLE_AQUI_A_URL_DO_COMPRAS_APPSSCRIPT"
 *    pela URL /exec do compras-appsscript (a mesma que termina em /exec,
 *    já configurada como COMPRAS_EXEC_URL — é a mesma URL, só usada aqui
 *    também como link de navegador, não como destino de fetch).
 * 5) Crie um arquivo novo do tipo HTML chamado exatamente "Insumos" e
 *    cole o conteúdo de Insumos.html nele — já usa a mesma URL
 *    (INSUMOS_EXEC_URL/INSUMOS_CSV_URL) que o Mamma Mia Control já
 *    usava, só o link "‹ Menu" no topo dele precisa ser preenchido (ver
 *    passo 7 abaixo, mesma URL usada lá).
 * 5b) Crie um arquivo novo do tipo HTML chamado exatamente "Auditoria" e
 *    cole o conteúdo de Auditoria.html nele — formulário completo
 *    (checklist, não conformidade com foto obrigatória, assinatura
 *    digital, finalizar), já com a mesma URL (APPS_SCRIPT_URL) que o
 *    Mamma Mia Control já usava. Esse arquivo já vem com o link "‹ Menu"
 *    e o logo preenchidos, não precisa editar nada nele.
 * 6) Implantar > Nova implantação > tipo "App da Web":
 *      - Executar como: Eu (sua conta)
 *      - Quem pode acessar: Qualquer pessoa
 *    Implantar. Copie a URL que termina em /exec — é o link do Painel
 *    Qualidade. Salve esse link na tela inicial do celular/computador.
 *    (Se já tinha uma implantação anterior — ex.: só com Compras — não
 *    precisa criar implantação nova: Implantar > Gerenciar implantações
 *    > ✏️ editar > Nova versão > Implantar, mesma URL de sempre.)
 * 7) IMPORTANTE — os links abaixo precisam ser a URL COMPLETA deste
 *    MESMO projeto (não um atalho tipo "?tela=insumos" ou
 *    "javascript:history.back()" sozinho) — um link relativo ou de
 *    histórico não funciona aqui: o Google às vezes navega por dentro de
 *    um domínio de conteúdo temporário (algo.script.googleusercontent.com)
 *    que não reconhece rotas nem histórico de navegação direito, e a
 *    tela fica em branco ou o botão simplesmente não faz nada. Depois de
 *    copiar a URL /exec do passo 6, troque em:
 *      - Menu.html: "COLE_AQUI_A_URL_DESTE_PROPRIO_PAINEL_QUALIDADE?tela=insumos"
 *        (card "Insumos Críticos") — mantém o "?tela=insumos" no final.
 *      - Insumos.html: "COLE_AQUI_A_URL_DESTE_PROPRIO_PAINEL_QUALIDADE"
 *        (link "‹ Menu" no topo) — sem "?tela=" nenhum, volta pro Menu.
 *    Depois de trocar os dois, reimplante de novo (Nova versão) pra essa
 *    correção valer.
 */

function doGet(e) {
  var tela = e.parameter.tela;
  if (tela === 'insumos') {
    return HtmlService.createHtmlOutputFromFile('Insumos')
      .setTitle('Insumos Críticos — Mamma Mia')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
  if (tela === 'auditoria') {
    return HtmlService.createHtmlOutputFromFile('Auditoria')
      .setTitle('Auditoria — Mamma Mia')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
  return HtmlService.createHtmlOutputFromFile('Menu')
    .setTitle('Painel Qualidade — Mamma Mia')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
