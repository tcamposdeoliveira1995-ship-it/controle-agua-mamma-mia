# Módulo Compras — Reestruturação: itens múltiplos por compra

**Data:** 2026-09-21
**Status:** Aprovado para implementação

## Contexto

Até aqui, 1 registro de Compras = 1 item (a Fase 1, já em produção, tinha Categoria/Item/Quantidade/
Valor Unitário como campos do próprio registro). A usuária mostrou como usa o app externo **CMV Fácil**
pra lançar compras de material de limpeza: uma nota tem 1 fornecedor, mas VÁRIOS itens dentro (ex.: Papel
Higiênico, Papel Toalha, Luva Latex G, Luva Latex P, cada um com sua quantidade e valor), com um total
geral somando tudo.

Motivo real do pedido: ela já digita essa lista de itens no CMV Fácil pra controle de consumo — não quer
digitar a mesma coisa duas vezes. Quer poder **colar** o que já lançou lá dentro do formulário de Compras
do Mamma Mia Control, sem redigitar item por item.

Isso é uma mudança estrutural (cabeçalho da nota + lista de itens), não um ajuste pontual — afeta a
planilha, o formulário, e como a Fase 3 (gráficos, spec já escrito mas ainda não implementado) vai somar
"gastos por categoria". Decidido fazer essa mudança **antes** de implementar a Fase 3, pra ela já nascer
em cima da estrutura certa.

## Estrutura de dados

**Aba `COMPRAS` passa a ser o CABEÇALHO da nota/compra** — mantém todas as colunas que já existiam,
exceto que `CATEGORIA`, `ITEM`, `DESCRIÇÃO`, `QUANTIDADE`, `UNIDADE MEDIDA` e `VALOR UNITÁRIO` deixam de
ser preenchidas (podem continuar existindo na planilha, só ficam sem uso — não precisa remover colunas).
`VALOR TOTAL` passa a ser **a soma do valor total de todos os itens** daquela compra, calculada pelo
backend, não mais um valor digitado direto.

**Nova aba `COMPRAS_ITENS`** (a usuária cria, mesmo processo das outras abas do módulo) — colunas:

```
ID_COMPRA | CATEGORIA | ITEM | DESCRIÇÃO | QUANTIDADE | UNIDADE MEDIDA | VALOR UNITÁRIO | VALOR TOTAL
```

Um item por linha, `ID_COMPRA` liga à linha correspondente em `COMPRAS`. `VALOR TOTAL` do item =
Quantidade × Valor Unitário (calculado, mesma regra de antes, só que agora por linha de item).

## Formulário único (criar/editar)

A seção "Categoria e item" (antes 2 campos soltos) vira **"Itens da compra"**: uma tabela dentro do
formulário, uma linha por item — Categoria (select), Item (texto), Descrição (texto), Quantidade
(número), Unidade de medida (select), Valor unitário (número), Valor total (calculado, só leitura),
botão de remover a linha.

Duas formas de adicionar linhas:
- **"+ item"** — adiciona uma linha em branco pra preencher na mão (mesmo padrão de "+ ingrediente" já
  usado no Refeitório).
- **"Colar itens"** — abre uma caixa de texto; ao confirmar, o sistema tenta separar o texto colado em
  linhas de item automaticamente (ver heurística abaixo) e adiciona essas linhas na tabela, **sempre
  editáveis depois** — nada é salvo sem a usuária revisar e confirmar o formulário inteiro. Não é um
  parser garantido: quando uma linha do texto colado não é reconhecida com confiança, ela ainda vira uma
  linha na tabela (com o texto inteiro no campo Item), só sem quantidade/valor preenchidos — pra
  completar na mão em vez de descartar silenciosamente.

**Heurística de parse** (best-effort, documentada como tal — não tenta ser perfeita): cada linha não-
vazia do texto colado vira 1 item candidato. Dentro da linha, procura um valor monetário (padrão
`R$ 123,45` ou `123,45`) — se achar, isso vira Valor unitário; procura um número isolado antes/perto do
nome — se achar, vira Quantidade; o texto restante (sem esses números) vira o campo Item. Sem nenhum
número reconhecido na linha, ela inteira vira só o campo Item, com Quantidade/Valor em branco.

**Validação pra salvar:** pelo menos 1 item com Categoria e Item preenchidos (substituindo a validação
antiga que era em cima do registro único). O resto do formulário (Identificação, Fornecedor, Pagamento,
Status, Entrega, Documentos) continua exatamente como já era — tudo no nível da nota inteira, sem virar
"por item".

## Backend (`compras-appsscript/Code.gs`)

- `registrarCompra(dados)` passa a receber `dados.itens = [{categoria, item, descricao, quantidade,
  unidadeMedida, valorUnitario}, ...]`. Cria a linha de cabeçalho em `COMPRAS` (sem os campos que
  migraram pro item), calcula `VALOR TOTAL` = soma dos itens, e grava uma linha por item em
  `COMPRAS_ITENS` (mesmo `ID_COMPRA`).
- `editarCompra(id, dados)`: atualiza o cabeçalho como já fazia, e **substitui todas as linhas de itens**
  daquela compra (apaga as linhas antigas com aquele `ID_COMPRA` em `COMPRAS_ITENS`, insere as novas) —
  mais simples e seguro que tentar comparar item a item o que mudou.
- Nova função **`migrarItensParaComprasItens()`** — rodada UMA VEZ pela usuária: lê todas as linhas já
  existentes em `COMPRAS` (formato antigo, com item nos campos de cabeçalho) e cria, pra cada uma, a
  linha correspondente em `COMPRAS_ITENS`. Não apaga nem modifica as colunas antigas em `COMPRAS` — só
  duplica a informação pro formato novo. Roda em cima de qualquer estado (mesmo já migrado uma vez):
  ignora silenciosamente uma linha de `COMPRAS_ITENS` que já exista com aquele `ID_COMPRA`, pra rodar de
  novo por engano não duplicar itens.

## Painel (`src/main.js`)

- Novo `COMPRAS_ITENS_CSV_URL` (a usuária publica essa aba como CSV, mesmo processo das outras).
- `carregarCompras()` busca os dois CSVs (`COMPRAS` e `COMPRAS_ITENS`) e junta em memória, indexando os
  itens por `ID_COMPRA`.
- Lista principal continua 1 linha por COMPRA (não por item) — coluna "Categoria" mostra a categoria
  única quando só há 1 item, ou "Várias" quando a compra tem itens de categorias diferentes; nova coluna
  "Itens" mostra a contagem (ex.: "3 itens").
- Abrir uma compra pra editar carrega o formulário com a tabela de itens já preenchida.
- KPIs (Fase 1) não mudam de fórmula — `VALOR TOTAL` já vem certo do cabeçalho (soma dos itens feita no
  backend).

## Impacto na Fase 3 (ainda não implementada)

O gráfico "Gastos por Categoria" passa a somar por **item** (lendo `COMPRAS_ITENS`), não por nota — uma
compra com itens de categorias diferentes contribui pra cada categoria correspondente, não fica "Várias"
nesse gráfico especificamente (isso só é assim na lista). Os outros 3 gráficos (Unidade, Fornecedores,
Evolução Mensal) continuam somando por nota (`COMPRAS`, `VALOR TOTAL` já agregado), sem mudança.

## Tratamento de erros

- Colar um texto vazio ou só espaços: nenhuma linha é adicionada, sem erro.
- Item sem Categoria ou sem Item preenchido na hora de salvar: mesma trava de antes, só que agora
  verificada por linha da tabela, não pelo formulário inteiro — linhas incompletas impedem salvar até
  serem completadas ou removidas.
- `migrarItensParaComprasItens()` rodando sem a aba `COMPRAS_ITENS` existir ainda: erro claro pedindo
  pra criar a aba primeiro, sem mexer em nada de `COMPRAS`.

## Fora de escopo

- Editar itens de uma compra concluída de forma restrita (ex.: travar depois de "Entregue") — continua
  tudo editável a qualquer momento, mesma filosofia do resto do módulo.
- Detectar/mesclar itens duplicados entre compras diferentes (ex.: "Papel Higiênico" comprado em notas
  separadas não é somado automaticamente em lugar nenhum além do que os gráficos por categoria já fazem).
