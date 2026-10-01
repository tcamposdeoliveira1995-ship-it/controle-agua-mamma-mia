# Painel Qualidade — Checklist Diário (Rotinas), aba dentro do Kanban

**Data:** 2026-10-01
**Status:** Implementado, aguardando teste em produção

## Contexto

Pedido da usuária, logo depois de validar o Kanban: "Quero no kanban um checklist fixo de atividades.
Tipo eu tenho rotinas diárias que preciso fazer. Leitura da água, refeitório, sabe?!" Esclarecido por
perguntas antes de implementar:

- **Onde fica:** uma aba nova dentro da mesma tela do Kanban (botão "📋 Quadro" / "✅ Checklist Diário" no
  topo), não um link novo no Menu.
- **Ao virar o dia:** todas as caixinhas marcadas desmarcam sozinhas — toda rotina é diária.
- **Itens iniciais:** nenhum pré-cadastrado por mim — a usuária cadastra as rotinas dela direto na tela
  (criar, editar, excluir), igual ela já faz com os cards do Kanban e os post-its de Avisos.

## Por que é um recurso separado do Kanban (mesmo estando na mesma tela)

O Kanban (cards com coluna/etiqueta, arrastados entre "A Fazer/Em Andamento/Concluído") é pra atividades
pontuais, que começam e terminam. Rotina diária é outra coisa: a MESMA atividade reaparece todo dia, sem
"terminar" de verdade — só fica "feita hoje" ou "não feita hoje". Modelar como card do Kanban obrigaria
mover o card de volta pra "A Fazer" toda manhã manualmente, ou duplicar card todo dia — nenhum dos dois é
o que foi pedido. Por isso: estrutura de dado própria (2 abas novas), ação própria, só compartilhando a
tela e o backend já implantado.

## Arquitetura

Mesmo backend do Kanban/Avisos (`avisos-appscript`, já implantado) — 5 ações novas, 2 abas novas na mesma
planilha de água:

- **ROTINAS**: `ID | TEXTO | ORDEM | ATIVA | CRIADO_EM` — a lista fixa, cadastrada pela usuária.
  `ATIVA=false` em vez de apagar a linha quando ela exclui uma rotina ("soft delete") — preserva o
  histórico de `ROTINA_MARCACOES` que aponta pro `ID` dela, mesmo removida da lista visível.
- **ROTINA_MARCACOES**: `ID | ROTINA_ID | DATA | MARCADO_EM` — 1 linha por dia em que uma rotina foi
  marcada como feita.

### Como o reset diário funciona sem nenhum job agendado

Em vez de ter uma rotina programada que "desmarca tudo à meia-noite" (mais um ponto de falha, mais
LockService, mais chance de rodar atrasado), a marcação é por DATA: `marcarRotina(id)` cria uma linha em
`ROTINA_MARCACOES` com `DATA = hoje`; `listarRotinas()` devolve só os IDs com marcação de HOJE
(`marcadosHoje`). No dia seguinte, sem nenhuma linha pra essa data nova, a rotina já nasce desmarcada —
"resetar" é simplesmente não existir ainda marcação pra hoje. `DATA` é sempre calculada no servidor
(`Utilities.formatDate(new Date(), "GMT-3", "dd/MM/yyyy")`), nunca no relógio do aparelho de quem usa —
evita qualquer inconsistência por fuso ou hora errada no celular.

### Ações (doPost)

- `criar_rotina {texto}` — entra no fim da lista (`ORDEM` = maior já usada + 1).
- `editar_rotina {id, texto}` — renomeia.
- `excluir_rotina {id}` — soft delete (`ATIVA=false`).
- `marcar_rotina {id}` — idempotente: clicar 2x não duplica linha em `ROTINA_MARCACOES`.
- `desmarcar_rotina {id}` — remove a linha de hoje, se existir; não é erro se já estava desmarcada.

### Leitura (doGet)

`?dados=rotinas` → `{ ok, rotinas: [{id, texto, ordem}], marcadosHoje: [id, id, ...] }` — uma chamada só,
já traz lista + estado de hoje junto, sem precisar de 2 requisições.

## Frontend (`Kanban.html`)

- Abas no topo da tela ("📋 Quadro" / "✅ Checklist Diário") — `trocarAba()` só mostra/esconde divs, sem
  recarregar nada; os dois conjuntos de dados (`cards` do Kanban e `rotinas`/`marcadosHoje`) são buscados
  juntos (`Promise.all`) na carga inicial da página, pra trocar de aba ser instantâneo.
- Cada rotina é uma checkbox grande (alvo de toque confortável) + texto + ✏️/✕ (editar/excluir, mesmo
  padrão visual de ações dos cards do Kanban e dos post-its de Avisos).
- Marcar/desmarcar é **otimista**: a tela atualiza na hora, sem esperar o servidor; se o POST falhar,
  desfaz recarregando tudo do zero (mesmo padrão já usado no arrastar-e-soltar do Kanban).
- "+ Nova rotina" abre um modal simples (só nome — sem descrição nem etiqueta, que são conceitos do
  Kanban, não do checklist).

## O que NÃO foi feito (fora do pedido)

- Nenhuma rotina pré-cadastrada no código — a usuária cadastra as dela.
- Sem reordenar rotinas na tela (fica na ordem de criação) — não foi pedido.
- Sem histórico visível de dias passados (ex.: "fiz Leitura da Água 6 de 7 dias essa semana") — os dados
  ficam guardados em `ROTINA_MARCACOES` (nada é apagado ao desmarcar de dia pra dia, só a linha do dia em
  que foi desmarcada manualmente), então dá pra construir isso depois se for pedido, sem migração de dado.

## Passos manuais pra usuária

1. Na planilha de água (mesma onde já tem AVISOS e KANBAN), criar DUAS abas novas:
   - **ROTINAS**, linha 1: `ID | TEXTO | ORDEM | ATIVA | CRIADO_EM`
   - **ROTINA_MARCACOES**, linha 1: `ID | ROTINA_ID | DATA | MARCADO_EM`
2. Colar `Code.gs` do `avisos-appscript` por cima do existente (ganhou as 5 ações novas) e reimplantar.
3. Colar `Kanban.html` por cima do existente no Painel Qualidade (ganhou a aba Checklist Diário) e
   `Code.gs` do Painel Qualidade por cima do existente (só comentário atualizado, nenhuma rota nova) e
   reimplantar.
4. Abrir a aba "✅ Checklist Diário" e cadastrar as rotinas (ex.: Leitura da Água, Refeitório).
