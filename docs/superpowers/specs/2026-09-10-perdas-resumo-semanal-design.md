# Perdas — Resumo Semanal (gráfico) + Pão de Queijo em kg

**Data:** 2026-09-10
**Status:** Aprovado para implementação

## Contexto

Módulo Perdas (`carregarPerdas`, aba "Perdas" do painel) já tem 3 gráficos, todos ranking por categoria
(barra horizontal, top 10): Perdas por Motivo, Ranking de Produtos, Perdas por Responsável. O filtro de
período (`TODOS`/`MES_ATUAL`/`MES_PASSADO`) não tem granularidade semanal.

Dois pedidos do usuário:

1. Um gráfico novo de "Resumo Semanal".
2. Pão de Queijo deve ser computado em kg (hoje a coluna `quantidade` mistura kg e unidades sem
   distinção, dependendo do que cada pessoa digita no formulário).

## 1. Gráfico "Resumo Semanal"

**O que mostra:** total perdido em **cada dia da semana atual** (Segunda a Domingo) — não é uma
tendência de várias semanas, é só a semana corrente, dia a dia. Dias sem nenhum registro aparecem com 0
(não são omitidos), pra dar visão completa da semana toda, mesmo a parte que ainda não aconteceu.

**Onde fica:** 4º gráfico, no mesmo grid dos 3 que já existem (`Perdas por Motivo`, `Ranking de
Produtos`, `Perdas por Responsável`), mesmo estilo visual (barra, Chart.js, mesma paleta implícita dos
outros — sem `indexAxis: 'y'`, já que aqui o eixo natural é vertical: dias da semana no X, quantidade no
Y).

**Independente do filtro de período:** ao contrário dos outros 3 gráficos (que respeitam
`TODOS`/`MES_ATUAL`/`MES_PASSADO`), este sempre mostra a semana corrente — trocar o filtro de período não
muda este gráfico, porque "semana atual" já é um recorte fixo por natureza (não faria sentido, por
exemplo, mostrar a semana atual filtrada por "mês passado").

**Cálculo:**
- Semana = Segunda a Domingo (convenção de semana de trabalho já usada no resto do projeto — ver
  `AUSENCIAS`/`PRODUCAO`, que também tratam dia a dia sem conceito de fim de semana especial).
- Início da semana: `hoje - (diaDaSemana === 0 ? 6 : diaDaSemana - 1)` dias (trata Domingo como o
  7º dia da semana anterior, não o 1º da atual — mesma lógica precisa em qualquer cálculo de "semana
  corrente" em JS, já que `getDay()` numera Domingo como `0`).
- Para cada um dos 7 dias da semana (Segunda a Domingo), soma `quantidade` de todos os registros
  (`registros`, não `registrosPeriodo` — usa a lista completa não filtrada por período, já que este
  gráfico ignora o filtro) cuja `data` cai naquele dia.
- Rótulos: `Seg`, `Ter`, `Qua`, `Qui`, `Sex`, `Sáb`, `Dom`.

## 2. Pão de Queijo em kg

**Decisão final (depois de explorar o formulário real):** não é mudança de código nem do formulário —
é uma instrução de processo pra equipe. O campo **"Quantidade perdida (Descrição: (kg ou unidades))"**
do formulário já aceita tanto peso quanto contagem, sem distinguir — o `onFormSubmit` (Apps Script do
formulário, fora deste projeto) só extrai o primeiro número do texto, sem saber a unidade. A partir de
agora, sempre que o produto for **Pão de Queijo**, a pessoa que registra a perda deve digitar o **peso em
kg** nesse campo (não a contagem de unidades) — o resto do sistema (painel, `onFormSubmit`, Telegram) já
funciona sem nenhuma mudança, porque todos já tratam esse campo como "um número", e esse número passa a
ser kg pra esse produto específico.

**Descartado:** ler o peso a partir do nome do produto (campo `PRODUTO`, texto livre) — na prática a
maioria dos lançamentos de Pão de Queijo não inclui o peso no nome (ex.: "PÃO DE QUEIJO GOIABADA
VENCIDO", "Coquetel"), só uma minoria (ex.: "PAO DE QUEIJO 100G"), o que tornaria qualquer tentativa de
adivinhar o peso pelas outras variantes (Coquetel, Goiabada, Empanado, sem qualificação) pouco confiável.
Trocar o campo PRODUTO por múltipla escolha (as opções 20g/50g/70g/80g/90g/100g) foi cogitado e é seguro
pro `onFormSubmit` (que busca colunas pelo nome do cabeçalho, não pelo tipo do campo — mudar de "resposta
curta" pra "múltipla escolha" não altera o cabeçalho "PRODUTO"), mas foi descartado por ser mais
complicado que simplesmente digitar o peso certo no campo de quantidade, que já existe pra isso.

**Fora de escopo:** conversão automática dos lançamentos antigos de Pão de Queijo (mistura kg/unidades
sem forma confiável de distinguir) — ficam como estão.

## Componentes (mudanças em `src/main.js`, dentro de `carregarPerdas`/`renderizar`)

- Nova função auxiliar (escopo de módulo, prefixo `_perdas` como as demais): `_perdasResumoSemanal(registros)`
  — recebe a lista completa de registros (não filtrada por período), devolve `{ labels, valores }` com os
  7 dias da semana corrente e o total perdido em cada um (0 onde não houver registro).
- Dentro de `renderizar()`: chama `_perdasResumoSemanal(registros)` (não `registrosPeriodo`) uma vez,
  junto do resto dos cálculos de agregação já existentes.
- Novo `<canvas id="graficoResumoSemanal">`, 4º card no grid de gráficos (`display:grid;grid-template-
  columns:repeat(auto-fit,minmax(340px,1fr))`), com o título "📅 Resumo Semanal".
- Novo `new Chart(...)` pro canvas acima, tipo `bar`, sem `indexAxis: 'y'` (colunas verticais, dias no
  eixo X) — mesma configuração `responsive`/`maintainAspectRatio` dos outros 3.

## Tratamento de erros

- Sem registros na semana corrente → gráfico mostra os 7 dias com barras zeradas (não esconde o
  gráfico nem mostra mensagem de vazio — diferente da tabela histórica, que tem seu próprio estado vazio).
- Registros sem `data` válida (já tratados hoje via `_perdasParseTimestamp`, que pode devolver algo
  não-Date) são ignorados no cálculo do resumo semanal, mesmo comportamento já usado no resto do módulo
  (ex.: filtro `comData = registrosPeriodo.filter(r => r.data)` no bloco de Último Registro).

## Integração com PDF

Fora de escopo — o PDF de Perdas (`_perdasGerarPDF`) já foca em KPIs + histórico tabular, não replica os
gráficos de ranking existentes; o Resumo Semanal segue o mesmo padrão (só na tela, não no PDF).
