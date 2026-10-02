# Painel Qualidade — menu lateral fixo + painel embutido (iframe)

**Data:** 2026-10-02
**Status:** Implementado, aguardando teste em produção (depende de 3 projetos Apps Script diferentes
redeployados — ver "Passos manuais")

## Contexto

Depois de duas tentativas visuais que não acertaram (grade 5→4 colunas, depois lista vertical com resumo
do Kanban), a usuária mandou um desenho: menu fixo na lateral esquerda ("MENU"), e ao clicar num módulo,
a página dele abre **dentro do painel ao lado**, sem sair da tela — "página aberta do app selecionado".

Isso é literalmente o pedido original que eu tinha recusado antes ("conforme for abrindo as páginas elas
abrem direto no painel"), explicando o risco de usar `<iframe>` com apps Apps Script. Com o desenho
confirmando que é exatamente isso que ela quer, a decisão foi implementar mesmo assim, mas com os ajustes
técnicos necessários pra reduzir o risco ao mínimo possível, e ser honesta sobre as 2 limitações que
continuam existindo (abaixo).

## Arquitetura

`Menu.html` vira um **shell de app**: cabeçalho fixo em cima, e embaixo dele uma sidebar fixa à esquerda
(lista de módulos, com o resumo do Kanban por coluna no topo) + um `<iframe>` ocupando o resto da tela à
direita. Clicar num item da sidebar não navega a página — só troca o `src` do iframe
(`iframe.src = item.getAttribute('data-src')`), via JavaScript (`preventDefault()` no clique do link).

No mobile (`max-width: 760px`), a sidebar vira uma faixa horizontal no topo (até 40% da altura da tela,
com rolagem própria) e o iframe ocupa o resto embaixo — mesma ideia do desenho, adaptada pra tela estreita.

### O problema técnico central: X-Frame-Options

Apps Script, por padrão, serve HTML com `X-Frame-Options: SAMEORIGIN` — ou seja, só pode ser exibido
dentro de um `<iframe>` se a página "pai" for **da mesma origem**. Isso tem duas consequências diferentes
dependendo de qual módulo:

- **Módulos do PRÓPRIO projeto Painel Qualidade** (Insumos, Auditoria, Dedetização, Avisos, Pipa,
  Higienização, Kanban — todos servidos pelo `doGet` deste mesmo `Code.gs`): são a MESMA origem do
  `Menu.html` que os embute, então **já funcionam sem nenhuma mudança de permissão**.
- **Módulos de OUTRO projeto Apps Script** (Compras → `compras-appsscript`; Ordens de Serviço →
  `manutencao-appsscript`): são origens DIFERENTES — por padrão, o navegador BLOQUEARIA o iframe
  (painel em branco). Pra esses dois, adicionei `.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)`
  no `doGet()` de cada um, que remove essa restrição. **Efeito colateral a saber:** isso também permite
  que QUALQUER outro site, não só o Painel Qualidade, exiba essas páginas dentro de um iframe — risco baixo
  pra uma ferramenta interna da empresa, mas é uma troca real (segurança por "ninguém mais tenta" vira
  segurança só pelo login do Google).

### Duas limitações aceitas (não dá pra resolver sem mudar mais coisa)

1. **Ordens de Serviço (Manutenção) tem 3 telas próprias** (Abrir/Fechar/Histórico), cada uma um link
   `target="_top"` — necessário pra aquele app não quebrar no celular (ver spec de PWA-lite da OS). Clicar
   entre essas telas DENTRO do iframe faz a navegação "escapar" pro navegador inteiro, perdendo a sidebar
   — abre em tela cheia, como já funcionava antes. Não é um bug, é a mesma proteção contra o bug de
   redirecionamento do Apps Script que já existia, só que agora também interrompe o embutimento. Resolver
   isso direito exigiria reestruturar a navegação interna da OS pra não depender mais de `target="_top"`,
   o que é bem mais arriscado (reabre o problema original que essa técnica resolvia) — fora de escopo por
   ora.
2. **Refeitório e VTO não foram embutidos.** Refeitório é outro repositório (`refeitorio-mamma-mia`), sem
   acesso nesta sessão — não dá pra adicionar `ALLOWALL` nem conferir os links internos dele. VTO é um
   site externo (Vercel/Next.js), fora do meu controle — sites modernos costumam já vir com
   `X-Frame-Options`/CSP bloqueando iframe por padrão, e não dá pra saber sem testar direto. Pra não
   arriscar um painel em branco pra esses dois, eles abrem em **aba nova** (ícone ↗ do lado do nome na
   sidebar) em vez de carregar no iframe.

## Resumo do Kanban na sidebar

Reaproveitado do design anterior (card com contagem por coluna), só reposicionado: agora fica no topo da
sidebar (3 números pequenos: A Fazer / Fazendo / Feito), acima da lista de módulos, buscado do mesmo
backend (`avisos-appscript`, `?dados=kanban`). Falha no fetch não quebra nada — só os números ficam "–".

## Arquivos tocados (3 projetos Apps Script diferentes)

- **painel-qualidade-appscript**: `Menu.html` (reescrito — shell), e `Insumos.html`, `Auditoria.html`,
  `Dedetizacao.html`, `Avisos.html`, `Pipa.html`, `Higienizacao.html`, `Kanban.html` (cada um ganhou 1
  linha: esconde o link "‹ Menu" quando a página detecta que está dentro de um iframe
  `window.self !== window.top` — sem isso, cada módulo mostraria um link redundante pra voltar a um Menu
  que já está sempre visível do lado).
- **compras-appsscript**: `Code.gs` (`ALLOWALL`) e `Compras.html` (mesma linha de esconder o link).
- **manutencao-appsscript**: `Code.completo.gs` (`ALLOWALL` nas 4 rotas) e `Menu.html`, `AbrirOS.html`,
  `Index.html`, `Historico.html` (mesma linha de esconder o link "‹ Painel Qualidade"/"‹ Menu" em cada um
  — a navegação ENTRE essas 4 telas continua normal, só o link de volta pro Painel é que se esconde).

## Passos manuais pra usuária

**Três projetos Apps Script diferentes precisam ser atualizados e reimplantados — não é só um.**

1. **Painel Qualidade**: colar `Menu.html` (reescrito), `Insumos.html`, `Auditoria.html`,
   `Dedetizacao.html`, `Avisos.html`, `Pipa.html`, `Higienizacao.html`, `Kanban.html`, cada um por cima do
   existente. Reimplantar (Nova versão).
2. **Compras** (`compras-appsscript`): colar `Code.gs` e `Compras.html` por cima dos existentes.
   Reimplantar.
3. **Manutenção/OS** (`manutencao-appsscript`): colar `Code.completo.gs`, `Menu.html`, `AbrirOS.html`,
   `Index.html`, `Historico.html` por cima dos existentes. Reimplantar.

Nenhuma URL muda em nenhum dos três — é só o conteúdo dos arquivos.

## O que testar

- Abrir o Painel Qualidade: deve aparecer a sidebar à esquerda com o Kanban já carregado à direita.
- Clicar em cada item da sidebar: Compras, Insumos, Auditoria, Dedetização, Avisos, Pipa, Higienização,
  Ordens de Serviço — todos devem carregar DENTRO do painel, sem sair da tela.
- Clicar em Refeitório e VTO: devem abrir numa aba nova do navegador (esperado, não é bug).
- Dentro de Ordens de Serviço, clicar pra abrir/fechar/ver histórico de OS: esperado "pular" pra tela
  cheia (limitação conhecida, documentada acima) — reportar se isso incomodar na prática, pra avaliar se
  vale resolver depois.
- Testar no celular também — o layout muda pra sidebar em cima + painel embaixo.
