# Módulo Compras — Fase 3 (dashboard gerencial com gráficos)

**Data:** 2026-09-19
**Status:** Aprovado para implementação

## Contexto

Terceira fase do módulo Compras (Fase 1 e Fase 2 já implementadas e validadas em produção — ver
`2026-09-18-compras-fase1-design.md` e `2026-09-20-compras-fase2-design.md`). Cobre o dashboard gerencial
com gráficos que ficou fora das fases anteriores: gastos por unidade, gastos por categoria, evolução
mensal e principais fornecedores.

Integração com OS de Manutenção (Fase 4) continua fora de escopo.

## Onde fica

Nova seção **"📊 Dashboard Gerencial"**, sempre visível, logo abaixo da lista de compras (mesma aba
Compras) — não é recolhível nem uma tela separada. Mesmo padrão visual e técnico já usado no módulo
Perdas (`carregarPerdas`): grid 2x2 responsivo (`display:grid;grid-template-columns:repeat(auto-fit,
minmax(340px,1fr))`), cada gráfico num `<canvas>` dentro de um cartão, Chart.js.

## Os 4 gráficos

1. **Gastos por Unidade** — barra vertical, 3 colunas (TC / YUKA / CD), valor total gasto em cada.
2. **Gastos por Categoria** — barra horizontal (ranking, `indexAxis: 'y'`), uma barra por categoria com
   gasto > 0 no período, ordenado do maior pro menor.
3. **Principais Fornecedores** — barra horizontal (ranking), **top 5** fornecedores por valor total
   gasto no período. Compra sem fornecedor preenchido não entra (não é um fornecedor real).
4. **Evolução Mensal** — barra vertical, **últimos 6 meses corridos** (rótulos tipo "Abr/26", "Mai/26"…
   até o mês atual), valor total gasto em cada mês.

## Filtro de período

Os 3 primeiros gráficos (Unidade, Categoria, Fornecedores) usam o **filtro de Período já existente na
lista de compras** (Este mês / Mês passado / Todos / Período livre) — mudar esse filtro atualiza a lista
E os 3 gráficos juntos, uma fonte de verdade só. Eles **ignoram os outros filtros da lista** (Unidade,
Categoria, Status, Fornecedor): um gráfico cujo propósito é comparar unidades/categorias/fornecedores não
pode ficar reduzido a uma barra só porque a lista está filtrada numa unidade/categoria/fornecedor
específico.

O gráfico de **Evolução Mensal** ignora TODOS os filtros da lista (inclusive Período) — sempre mostra os
últimos 6 meses corridos, porque precisa comparar meses diferentes lado a lado; não faria sentido um
recorte de "só este mês" nesse gráfico.

Todos os 4 **excluem compras com Status "❌ Cancelado"** — mesma regra já usada nos KPIs da Fase 1
(`_comprasCalcularKPIs`).

**Data de referência de cada compra** (pra decidir em qual período/mês ela cai): `DATA COMPRA` quando
preenchida, senão `DATA SOLICITAÇÃO` — mesma regra já usada em todo o resto do módulo (KPIs, filtro de
período da lista).

## Componentes (mudanças em `src/main.js`)

- `_comprasDadosGraficos(registrosFiltradosPorPeriodo, todosRegistros)` — calcula os 4 conjuntos de
  dados de uma vez: `porUnidade` (3 valores), `porCategoria` (lista ordenada), `porFornecedor` (top 5),
  `evolucaoMensal` (6 meses, calculado sobre `todosRegistros`, não sobre o filtrado por período).
- Dentro de `_comprasRenderizar()`: monta o grid dos 4 `<canvas>` (IDs fixos:
  `grafico-compras-unidade`, `grafico-compras-categoria`, `grafico-compras-fornecedores`,
  `grafico-compras-evolucao`) e cria/atualiza as 4 instâncias de `Chart` — precisa destruir a instância
  anterior antes de recriar (`chart.destroy()`), mesmo padrão já usado nos gráficos de Perdas, senão
  cada novo filtro empilha um canvas fantasma por cima do anterior.
- Paleta de cores reaproveita a mesma paleta neutra/dourada já usada no resto do painel (sem introduzir
  paleta nova).

## Tratamento de erros

- Sem nenhuma compra no período filtrado: os 3 primeiros gráficos ficam vazios (Chart.js renderiza um
  canvas em branco, sem erro) — sem mensagem extra, consistente com o resto do painel quando não há
  dado pro período escolhido.
- Menos de 6 meses de histórico no sistema: Evolução Mensal mostra os últimos 6 meses mesmo assim, com
  0 nos meses sem nenhum registro — não trunca nem esconde meses vazios (mesmo espírito do gráfico
  "Resumo Semanal" de Perdas, que também mostra dias zerados).

## Fora de escopo

- Integração com OS de Manutenção (Fase 4).
- Exportar os gráficos em PDF — o módulo de Compras ainda não tem nenhum PDF (diferente de
  Refeições/Perdas); fica fora de escopo desta fase, pode ser pedido depois se fizer falta.
