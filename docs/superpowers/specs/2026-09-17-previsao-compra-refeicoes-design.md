# Refeições — Previsão de Compra (Semana / Quinzena / Mês)

**Data:** 2026-09-17
**Status:** Implementado (ver correção pós-teste no fim do documento)

## Contexto

A aba Refeições do painel (mammamia-control.vercel.app) já mostra, pra um dia escolhido: Lista de
Presença, Ausências e Produção e Sobra (KG cru, produzido, sobra, rendimento, ingredientes — principal +
extras). Os dados vêm de 3 CSVs publicados pelo Apps Script do refeitório (repo separado
`refeitorio-mamma-mia`): `REFEICOES_CSV_URL`, `AUSENCIAS_CSV_URL`, `PRODUCAO_CSV_URL` e
`CONFIG_RENDIMENTO_CSV_URL` (esse último também carrega os ingredientes extras, linhas `TIPO=USO`).

Pedido do usuário: usar esse histórico pra prever quanto comprar de cada ingrediente, em 3
granularidades — Semana, Quinzena, Mês.

## Fonte de cada ingrediente

- **Arroz, Feijão, Salada** (categorias sem campo "ingrediente" no formulário): a chave do ingrediente é
  o próprio nome da categoria.
- **Prato Principal, Guarnição**: a chave é o campo `ingrediente` da linha de produção (ex.: "Frango"),
  ou o nome da categoria como fallback se `ingrediente` vier vazio — mesma regra de fallback já usada em
  `registrarProducao` (Apps Script) pra achar o rendimento esperado.
- **Ingredientes extras** (calabresa, cenoura...) NÃO entram — ver correção no fim do documento.

Cada linha de produção contribui com **KG cru quando `kgCru > 0`, senão KG produzido** dessa linha.

## Janela de histórico e cálculo

Janela = últimos 30 dias corridos a partir de hoje. Dentro dela:

- `totalKg[ingrediente]` = soma de todas as contribuições de produção daquele ingrediente na janela.
- `diasHistorico` = dias corridos desde a DATA MAIS ANTIGA com algum registro de produção dentro da
  janela até hoje (inclusive), mínimo 1. Isso evita dividir por 30 quando o sistema tem, por exemplo, só
  5 dias de histórico real — nesse caso `diasHistorico = 5`, não 30.
- `mediaDiaria[ingrediente]` = `totalKg[ingrediente] / diasHistorico`.
- `previsaoKg[ingrediente]` = `mediaDiaria[ingrediente] * diasAlvo`, onde `diasAlvo` é 7 (Semana), 15
  (Quinzena) ou 30 (Mês).

Sem nenhum registro de produção na janela (sistema nunca usado, ou os últimos 30 dias em branco) → sem
dado pra prever nada.

## Componentes (mudanças em `src/main.js`)

- Nova função módulo-escopo `_previsaoCalcular(diasAlvo)`: recebe `producao` e `ingredientesExtras` (já
  carregados por `carregarRefeicoes`, sem nova busca de rede), devolve uma lista
  `[{ ingrediente, previsaoKg, mediaDiaria, diasHistorico }]` ordenada por `previsaoKg` decrescente.
- Dentro de `renderizar()` (ou logo depois, no mesmo escopo de `carregarRefeicoes`): novo estado
  `previsaoDiasAlvo` (padrão 7 — Semana), recalculado a cada clique nos 3 botões, sem novo fetch.
- Novo bloco HTML "📦 Previsão de Compra" abaixo de "🍲 Produção e Sobra": 3 botões (Semana/Quinzena/Mês,
  estilo toggle igual aos filtros já existentes no painel), tabela
  `Ingrediente | Previsão (kg) | Média/dia | Base` — coluna "Base" mostra "X dias" e, quando
  `diasHistorico < 7`, um aviso discreto "⚠️ poucos dados" ao lado do número.
- Estado vazio (sem nenhum registro na janela): "Ainda não há dados suficientes pra prever." no lugar da
  tabela.
- Novo botão "📄 Gerar PDF" específico dessa seção, novo estado módulo-escopo `ultimoEstadoPrevisao`
  (guardado a cada recálculo, igual ao padrão de `ultimoEstadoRefeicoes`) e nova função
  `previsaoComprarGerarPDF(estado)` — mesmo padrão técnico dos outros PDFs do painel (HTML em iframe
  escondido + `print()`), só com a lista de ingredientes e a previsão do período selecionado no momento
  do clique. PDF separado do que já existe (`refeicoesGerarPDF`) — não altera esse.

## Tratamento de erros

- Ingrediente com `diasHistorico < 7`: continua aparecendo na tabela (não é escondido), só ganha o aviso
  "poucos dados" — decisão explícita de não esconder dado incompleto, consistente com o resto do painel
  (ex.: Perdas Resumo Semanal mostra os 7 dias mesmo com registros zerados).
- Falha ao carregar `PRODUCAO_CSV_URL` ou `CONFIG_RENDIMENTO_CSV_URL` (já tratada com try/catch próprio em
  `carregarRefeicoes`, listas ficam vazias): a seção de Previsão de Compra simplesmente cai no estado
  vazio ("Ainda não há dados suficientes pra prever"), sem quebrar o resto da aba Refeições.
- `diasAlvo` inválido (nunca deve acontecer, os 3 botões são fixos): fallback pra Semana (7).

## Correção pós-teste: ingredientes extras excluídos

Ao testar com dado real, a previsão veio poluída: linhas como "85 SOBRECOXA", "10 TOMATES", "20
TOMATES", "12 TOMATES" (o mesmo Tomate, 4 vezes) e até "SOBRA DA SEMANA PASSADA"/"SOBRA DE 15/09/2026"
(sobra reaproveitada, não algo a comprar) apareciam como ingredientes separados.

Causa raiz: o campo onde a cozinheira digita o nome do ingrediente extra
(`refeitorio-mamma-mia/apps-script/Producao.html`, `.extra-nome`) é um `<input type="text">` livre (com
`list=` de sugestão, mas sem travar a digitação) — cada pessoa escreve a quantidade junto do nome, de um
jeito diferente a cada vez, então o mesmo ingrediente real vira várias chaves distintas em
`CONFIG_RENDIMENTO`. Tentar agrupar isso por código (regex, matching de texto) é frágil — mesma decisão
já tomada pro caso do Pão de Queijo em kg (ver
`2026-09-10-perdas-resumo-semanal-design.md`): não adivinhar a partir de texto livre.

**Decisão:** `_previsaoCalcular` usa só as 5 categorias de `PRODUCAO` (Arroz, Feijão, Prato Principal,
Guarnição, Salada) — ingredientes extras ficam de fora da previsão. Continuam aparecendo normalmente na
tela do dia (Produção e Sobra, via `textoIngredientes`), que é só exibição e não soma nada entre dias —
esse uso não é afetado. Incluir extras na previsão fica pra quando (e se) a entrada de dados desse campo
virar uma lista fechada (dropdown, como já existe na tela de Sobra) em vez de texto livre.

## Fora de escopo

- Ajuste por presença esperada (headcount) — o painel não tem agenda de presença futura, só histórico;
  fica fora.
- Descontar estoque já em mãos — sistema não tem controle de estoque; a previsão é de CONSUMO projetado,
  não "o que falta comprar".
- Incluir a previsão no PDF de Refeições que já existe (Presença/Ausências/Produção e Sobra) — fica
  intacto; a previsão tem seu PDF próprio.
- Limpar a entrada de ingredientes extras (trocar texto livre por lista fechada) — ver seção de correção
  acima; é um trabalho à parte, só vale a pena se/quando quiser reincluir extras na previsão.
