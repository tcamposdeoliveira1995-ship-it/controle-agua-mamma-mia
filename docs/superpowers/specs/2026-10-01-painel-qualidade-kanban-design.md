# Painel Qualidade — Kanban de Atividades

**Data:** 2026-10-01
**Status:** Implementado, aguardando teste em produção

## Contexto

Pedido da usuária: "quero criar nele [Painel Qualidade], basicamente uma cópia do Trello. Um kanban
interativo, uma tela principal de atividades." Esclarecido por perguntas antes de implementar:

- **Propósito:** quadro geral de atividades do dia a dia — **independente** do Trello real de Ordens de
  Serviço, que já existe e continua funcionando à parte (`manutencao-appsscript`, com seu próprio
  `moverCard` e lista de cards no Trello de verdade). Este Kanban não lê nem escreve nada lá.
- **Colunas:** fixas — "A Fazer" / "Em Andamento" / "Concluído". Não dá pra criar/renomear/reordenar
  coluna (decisão explícita, pra começar mais simples).
- **Campo do card, além do título:** descrição livre e etiqueta colorida. Sem responsável nem prazo
  (não pedidos).

## Arquitetura

Mesmo raciocínio já usado pra Pipa/Higienização de Motores: em vez de criar um projeto Apps Script novo
(mais um link/implantação pra gerenciar), o Kanban ganhou 4 ações novas no **mesmo backend já implantado**
do mural de Avisos (`avisos-appscript`), numa aba nova **KANBAN** na mesma planilha de água.

- `GET ?dados=kanban` → `listarCards()`. O `doGet` sem esse parâmetro continua devolvendo os avisos — não
  mudou nada pra quem já usa essa URL sem parâmetro (Avisos.html).
- `POST {acao: "criar_card", titulo, descricao, etiqueta}` → entra sempre no fim da coluna "A Fazer".
- `POST {acao: "editar_card", id, titulo, descricao, etiqueta}`.
- `POST {acao: "mover_card", id, coluna, ordemIds}` → `ordemIds` é a lista de IDs na ordem final da
  coluna de DESTINO (inclui o próprio card movido); grava `COLUNA` do card e `ORDEM` = índice de cada um
  nesse array. A coluna de origem não precisa ser reenviada: os cards que sobraram lá mantêm seus valores
  de `ORDEM` antigos, que já bastam pra manter a ordem relativa entre eles.
- `POST {acao: "excluir_card", id}`.

Aba KANBAN: `ID | TITULO | DESCRICAO | COLUNA | ETIQUETA | ORDEM | CRIADO_EM | ATUALIZADO_EM` — mesmo
padrão de colunas (achadas por cabeçalho, nunca por posição) e `LockService` (protegendo só a seção de
checar-e-gravar, nunca os fetches) já usados em todo o resto do arquivo.

## Arrastar e soltar

HTML5 Drag and Drop (`draggable`) **não funciona em toque no Safari/iOS** — e essa usuária acessa tudo
pelo celular. Implementado do zero com **Pointer Events** (`pointerdown`/`pointermove`/`pointerup`), que
funcionam igual pra mouse e dedo, sem nenhuma biblioteca externa (consistente com o resto do repo, que
nunca carrega dependência de CDN pras telas do Apps Script):

1. `pointerdown` no card arma a escuta, mas só "ativa" o arrasto depois de mover mais que 8px — abaixo
   disso é considerado toque/clique normal (editar/excluir continuam funcionando sem acionar o arrasto).
2. Uma vez ativo, o card vira `position: fixed` e segue o ponteiro; um placeholder tracejado marca onde
   ele vai cair.
3. A cada movimento, acha a coluna sob o ponteiro (`elementFromPoint`) e reposiciona o placeholder antes
   do card irmão mais próximo (comparando a posição Y do ponteiro com o meio de cada card).
4. Ao soltar, o card entra onde o placeholder estava; calcula a coluna final + a ordem de IDs da coluna de
   destino e manda `mover_card`. **Atualiza a tela na hora** (otimista, sem esperar o servidor) — se o
   POST falhar, desfaz recarregando o quadro do zero.

## O que NÃO foi feito (fora do pedido)

- Responsável, prazo, checklist dentro do card, comentários — nenhum desses foi pedido.
- Colunas customizáveis — decisão explícita de começar com as 3 fixas.
- Qualquer ligação com o Trello real de OS — são dois sistemas completamente separados.

## Passos manuais pra usuária

1. Na planilha de água (mesma onde já tem a aba AVISOS), criar uma aba nova chamada exatamente **KANBAN**,
   com a linha 1: `ID | TITULO | DESCRICAO | COLUNA | ETIQUETA | ORDEM | CRIADO_EM | ATUALIZADO_EM`.
2. No projeto Apps Script do Painel Qualidade, criar um arquivo HTML novo chamado exatamente **Kanban** e
   colar o conteúdo de `Kanban.html`.
3. Colar `Code.gs` do Painel Qualidade por cima do existente (ganhou a rota `?tela=kanban`) e `Code.gs` do
   `avisos-appscript` por cima do existente (ganhou as 4 ações novas).
4. Colar `Menu.html` por cima do existente (ganhou o card "Kanban").
5. Reimplantar os dois projetos (Nova versão) — nenhuma URL muda.

Nota: o card novo deixa o Menu com 11 opções (antes eram 10, 5×2) — a última linha da grade fica com 1
card sozinho em vez de 5. Puramente visual, não afeta funcionamento; ajustar o layout da grade se incomodar.
