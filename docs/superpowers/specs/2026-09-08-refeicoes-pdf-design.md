# PDF de Refeições (Presença + Ausências + Produção e Sobra) — Design

**Data:** 2026-09-08
**Status:** Aprovado para implementação

## Problema

A aba "Refeições" do painel (`mammamia-control.vercel.app`) já mostra, para a data escolhida, o total de
presença do dia, a tabela de Produção e Sobra e a tabela de Ausências — mas tudo só na tela. Não existe
forma de emitir isso como um documento (pra imprimir, arquivar, ou mandar pra alguém que não usa o
painel). Além disso, a lista de presença hoje só mostra um número (total do dia); os nomes de quem
comeu naquele dia já estão registrados na planilha, mas não aparecem em lugar nenhum do painel.

## Objetivo

Um botão "📄 PDF" na aba Refeições, do lado do filtro de data já existente, que emite um PDF de uma
página com três seções — na mesma ordem em que aparecem na tela — para o dia selecionado:

1. **Lista de Presença** — nomes de quem comeu naquele dia.
2. **Ausências** — quem estava de falta/férias naquele dia (já existe na tela, sem mudança de dado).
3. **Produção e Sobra** — a tabela de Cru/Produzido/Sobra/Rendimento/Perda por categoria (já existe na
   tela, sem mudança de dado).

Fora de escopo: período diferente de um único dia (semana/mês), qualquer alteração no fluxo de registro
de presença/ausência/produção (Totem, Lista de Presença, Produção, Sobra — todos no repositório
`refeitorio-mamma-mia`), envio automático do PDF por e-mail/Telegram (é sempre gerado sob demanda, pelo
botão).

## Contexto existente (relevante pro design)

- `carregarRefeicoes()` (`src/main.js`) já busca, em paralelo, o CSV publicado da aba REFEICOES (via
  `REFEICOES_CSV_URL`) e o de Ausências (`AUSENCIAS_CSV_URL`), e separadamente o de Produção
  (`PRODUCAO_CSV_URL`, com seu próprio try/catch porque o `gid` ainda é recente). Tudo já filtrado pela
  data escolhida em `renderizar()`.
- A aba REFEICOES tem uma coluna `NOME` (confirmado em `refeitorio-mamma-mia/apps-script/Code.gs`,
  função `registrarPresencas`, que grava `TIPO = "PRESENCA"` por funcionário, sem `REFEICAO`) — mas
  `carregarRefeicoes()` hoje só extrai `data` e `refeicao` de cada linha, nunca `nome`.
- Já existe um padrão de exportação de PDF usado em Perdas (`_perdasGerarPDF`) e Requisições
  (`gerarPDFRequisicaoMP`, `gerarPDFRequisicaoLimpeza`): monta uma string HTML com o cabeçalho visual
  padrão do painel ("Mamma Mia Control", faixa dourada `#b79b6c`, cards cinza-claro `#f9f5f0`), escreve
  num `<iframe>` escondido (`position:fixed;top:-9999px`), e chama `iframe.contentWindow.print()` depois
  de um `setTimeout` curto — o usuário salva como PDF pelo diálogo de impressão do navegador. Sem
  biblioteca nova.
- O botão "📄 PDF" de Perdas segue o padrão `<button class="btn btn-secondary" id="...">📄 PDF</button>`,
  ao lado dos filtros.

## Decisão de arquitetura

Reaproveitar os dados que `carregarRefeicoes()` já carrega e já filtra por data — o botão de PDF não faz
nenhuma chamada nova à planilha, só lê o que a função `renderizar()` interna já calculou pra data
selecionada (presentes do dia, ausências do dia, produção do dia).

Isso implica reestruturar levemente `carregarRefeicoes()`: hoje `renderizar()` é uma função que só
monta HTML e não expõe os dados que calculou. Vou fazer `renderizar()` guardar o resultado calculado
(nomes presentes, ausências do dia, produção do dia agrupada) numa variável no escopo de
`carregarRefeicoes()`, que o handler do botão de PDF lê no momento do clique — assim não há
recomputação nem re-fetch, e o PDF sempre bate com o que está na tela.

## Componentes

### `src/main.js` — mudanças em `carregarRefeicoes()`

- **Extrair `nome`** da aba REFEICOES junto com `data` e `refeicao` (mesmo padrão de
  `cabecalho.findIndex(c => c === 'NOME')` já usado na leitura de Ausências).
- Em `renderizar()`, calcular a lista de presentes do dia: registros com `data` igual à selecionada,
  nomes únicos (um funcionário pode ter mais de um registro no mesmo dia — dedupe por nome), ordenados
  alfabeticamente. Guardar em variável de escopo (ex.: `ultimoEstadoRefeicoes`) junto com as ausências
  do dia e a produção do dia já agrupada por categoria (dados que já existem localmente em
  `ausenciasNoDia` e `porCategoria` dentro de `renderizar()` — só precisam ser preservados fora da
  função em vez de descartados).
- **Nova seção na tela**, entre os cards de total/horário e a tabela de Ausências: "👥 Lista de
  Presença" — tabela simples de uma coluna (Nome), mesmo componente visual (`modern-table`) das outras
  tabelas da aba. Estado vazio: "Ninguém registrado nesse dia." (mesmo padrão de mensagem das outras
  tabelas da aba).
- Ordem final da aba (tela): cards de total/horário → Lista de Presença → Ausências → Produção e
  Sobra (Ausências e Produção trocam de lugar em relação à ordem atual, pra bater com a ordem pedida:
  presença, ausências, produção e sobra).

### `src/main.js` — nova função `refeicoesGerarPDF(dataSelecionadaBR, presentes, ausenciasNoDia, categoriasProducao)`

Segue exatamente o padrão de `_perdasGerarPDF`: cabeçalho "Mamma Mia Control" / "🍽️ Refeições" / "Data:
{data selecionada}" à esquerda, "Emitido em: {timestamp}" à direita; um card de KPI só ("Total de
presentes"); três blocos, cada um com título de seção (`<h2>` com a borda dourada à esquerda, mesmo
estilo dos outros PDFs) e uma tabela:

1. **Lista de Presença** — coluna única (Nome). Vazio: "Ninguém registrado nesse dia."
2. **Ausências** — colunas Nome / Tipo / Data (mesmas 3 colunas já usadas na tela,
   `linhaTabelaAusencia`). Vazio: "Ninguém ausente nesse dia."
3. **Produção e Sobra** — colunas Categoria / Cru / Produzido / Sobra / Rendimento / Perda (mesmas 6
   colunas já usadas na tela). Vazio: "Nenhuma produção registrada nesse dia."

Mesmo rodapé padrão ("Mamma Mia Control — Gestão Inteligente de Operações • © 2026 Mamma Mia
Salgados"). Mesmo mecanismo de impressão (iframe escondido + `print()` + remoção depois de 1s).

### `index.html` — mudanças na aba Refeições

Botão novo ao lado do input de data existente:
```html
<button class="btn btn-secondary" id="refeicoes-btn-pdf" type="button">📄 PDF</button>
```

### Handler do botão

No `setup` de listeners da aba (mesmo bloco que já registra o listener de `change` do filtro de data em
`carregarRefeicoes()`), adicionar um listener de `click` em `refeicoes-btn-pdf` que chama
`refeicoesGerarPDF(...)` com os dados guardados em `ultimoEstadoRefeicoes` no clique mais recente. Se o
usuário clicar antes de qualquer carregamento terminar (estado ainda nulo), o botão não faz nada
silenciosamente — não deveria acontecer na prática, já que a tela sempre chama `renderizar()` antes do
usuário conseguir interagir, mas evita erro caso a rede esteja lenta.

## Tratamento de erro

- Se `carregarRefeicoes()` falhou (rede fora, CSV indisponível) a mensagem de erro já existente
  ("Não foi possível carregar os dados de refeições.") substitui todo o conteúdo, inclusive o botão de
  PDF — que fica fora do DOM nesse caso, então não precisa de tratamento extra.
- Se a coluna `NOME` não existir na aba REFEICOES (`idxNome === -1`), a lista de presença fica vazia
  (mesmo padrão defensivo já usado pra Ausências) — não derruba o carregamento da aba inteira.

## Passos de implantação

Nenhum — é só código no `src/main.js`/`index.html` do painel (`controle-agua-mamma-mia`), que já é
publicado direto no Vercel a partir do branch. Sem mudança de planilha, sem mudança no Apps Script do
Refeitório.
