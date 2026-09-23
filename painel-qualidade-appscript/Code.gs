/**
 * PAINEL QUALIDADE — tela inicial (hub)
 * ---------------------------------------------------------------------
 * Ponto de entrada único de onde a usuária lança tudo (Compras, e depois
 * Insumos Críticos, Auditoria, Dedetização, Avisos, conforme cada um for
 * migrado) — o Mamma Mia Control fica só de leitura. Ver
 * docs/superpowers/specs/2026-09-23-painel-qualidade-compras-design.md,
 * no repo controle-agua-mamma-mia.
 *
 * Esse projeto não tem dado próprio nenhum — é só uma tela de links, cada
 * link levando pro app Apps Script que já faz o trabalho de verdade (ex.:
 * compras-appsscript). Por isso pode ser criado como projeto AVULSO do
 * Apps Script, sem vincular a nenhuma planilha.
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
 * 5) Implantar > Nova implantação > tipo "App da Web":
 *      - Executar como: Eu (sua conta)
 *      - Quem pode acessar: Qualquer pessoa
 *    Implantar. Copie a URL que termina em /exec — é o link do Painel
 *    Qualidade. Salve esse link na tela inicial do celular/computador.
 */

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('Menu')
    .setTitle('Painel Qualidade — Mamma Mia')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
