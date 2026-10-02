# Refeições — migração pra REFEITORIO_PUBLICO (INC-001, só contagens)

**Data:** 2026-09-30
**Status:** Implementado, aguardando validação em produção e aprovação pra deploy

## Contexto

INC-001: a planilha original "CONTROLE DE REFEICOES", publicada por link (`2PACX-1vTrD…`), expunha CPF e
nome de funcionários. A publicação foi interrompida — todas as URLs antigas (REFEICOES, AUSENCIAS,
PRODUCAO, CONFIG_RENDIMENTO) agora respondem HTTP 401, e a aba Refeições inteira caiu (presença,
ausências, produção/sobra, previsão de compra e PDF, todos dependiam dessas URLs).

Foi criada uma planilha nova, pública, **REFEITORIO_PUBLICO**, que só tem agregados — nenhum nome, nenhum
CPF. Decisão: o painel mostra **somente contagens**; os nomes continuam sendo consultados direto na
planilha privada, fora do painel público.

Handoff completo (INC-001) recebido de Tita em 30/09/2026, com evidências de curl, hipóteses de causa e
critérios de aceite — implementação abaixo segue esse documento à risca.

## O que muda

| | Antes | Depois |
|---|---|---|
| Fonte | Planilha "CONTROLE DE REFEICOES" (401) | REFEITORIO_PUBLICO — 5 abas: REFEICOES_DIA, PRESENCA_DIA, AUSENCIAS_PUB, PRODUCAO_PUB, EXTRAS_USO |
| Total do dia | 1 linha por pessoa (`doDia.length`) | Soma de `QTD` de REFEICOES_DIA (a aba já vem agregada) |
| Lista de Presença | Tabela de nomes, com botão Recolher | Card com o número de `PESSOAS` (PRESENCA_DIA), sem nome nem botão |
| Ausências | Nome + Tipo + Data | Tipo + Data + **Qtd** (agrupada — ver abaixo), sem nome |
| PDF | Lista de nomes, coluna Nome em Ausências | Só contagens: card "Total de Presentes", card "Refeições Registradas", tabela de Ausências com Qtd |
| Produção/Extras | Mesma lógica, mas dependia das URLs antigas (401) | Mesma lógica, só URLs novas — nada mudou no cálculo |

## Decisões de design

- **`AUSENCIAS_PUB` não tem coluna NOME.** O filtro que existia (`.filter(a => a.nome)`) descartaria 100%
  das linhas em silêncio — trocado pra `.filter(a => a.dataInicio)`.
- **Ausências agrupadas por tipo + período, com uma coluna Qtd**, em vez de uma linha por pessoa (que sem
  nome ficariam idênticas e repetidas — ex.: 9 linhas "Falta | 28/09/2026"). Mesma função
  (`agruparAusencias`) usada na tela e no PDF, seguindo o padrão já existente de funções de formatação
  compartilhadas (`textoIngredientes`, `textoSobra`).
- **Lista de Presença vira um card de número** (`PESSOAS` de `PRESENCA_DIA`), não mais uma tabela — não há
  mais nome pra listar. Se essa aba específica falhar ao carregar, mostra "—" sem derrubar o resto da tela
  (mesmo padrão de tolerância a falha já usado em Produção/Config de Rendimento).
- **PDF sem nenhuma lista de nomes**: a seção "Lista de Presença" (que era uma tabela) virou parte dos 2
  cards de número no topo (Total de Presentes + Refeições Registradas).
- **Escapa todo texto vindo do CSV** antes de inserir no HTML (categoria de produção, tipo/período de
  ausência, ingredientes, horário da refeição) — reaproveitando `escaparHtmlAviso`, já existente no
  arquivo (usada pelos Avisos do header). Nenhuma das 5 abas novas tem controle de conteúdo tão rígido
  quanto as antigas (ex.: `EXTRAS_USO.CATEGORIA` é texto livre digitado pela cozinheira), então a mesma
  regra de escapar por segurança que já valia pros Avisos passa a valer aqui.
- **Renomeado `e.nome` → `e.ingrediente`** no parsing de `EXTRAS_USO` — não é nome de pessoa, é o nome do
  ingrediente extra (campo `CATEGORIA`); o rename evita confusão com as outras estruturas de dado dessa
  aba que agora não têm mais `nome` nenhum.
- **Produção e Previsão de Compra**: nenhuma mudança de lógica, só as URLs novas — o parser já tratava
  `INGREDIENTE` como coluna opcional (idx `-1` → `''`), então a ausência dela em `PRODUCAO_PUB` não quebra
  nada.

## Não mudou

- `sw.js` — network-first, não intercepta `docs.google.com`, nada a fazer.
- Nenhuma chave, token ou variável de ambiente nova — as 5 URLs são constantes, mesmo padrão das já
  existentes no arquivo, geradas a partir de uma base (`REFEITORIO_PUB_BASE`) + gid.
- Nenhuma outra aba do painel (Água, Limpeza, MP, Perdas, OS, Insumos, Avisos) foi tocada.

## Testes

- `npm run build` — passa sem erro.
- Parser testado com CSVs inventados (sem dado real): soma de QTD, contagem de ausências por
  tipo+período, parsing de decimal com vírgula (`"1,5"` → `1.5`) — todos batendo com o esperado.
- `rg "\.nome\b|NOME|presentesDoDia|presencaRecolhida|presenca-toggle|2PACX-1vTrD" src/main.js` limpo (só
  sobra o comentário mencionando a chave antiga, pra contexto histórico, e usos de `NOME`/`.nome`
  totalmente alheios a Refeições — no módulo de Requisição de MP).
- Não foi possível confirmar o conteúdo real das 5 abas nesta sessão (egress bloqueado pro
  `docs.google.com` no ambiente de execução) — a implementação segue exatamente o formato de coluna
  (`DATA,REFEICAO,QTD` / `DATA,PESSOAS` / `TIPO,DATA_INICIO,DATA_FIM` / `DATA,ITEM,KG_PRODUZIDO,KG_SOBRA,
  KG_CRU,UNIDADE`) e os gids confirmados por curl no handoff da Tita. **Falta validar contra os dados reais
  em produção/preview antes do deploy final.**

## Rollback

- `git revert` do commit e redeploy, ou *Promote to Production* do deploy anterior no Vercel.
- Nunca republicar a planilha original "CONTROLE DE REFEICOES".
