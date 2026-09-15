# Requisição de MP e Recheios — App próprio (substituindo o Google Forms)

**Data:** 2026-09-15
**Status:** Aprovado para implementação

## Problema

Hoje a requisição de matéria-prima/recheios/embalagens é feita por um Google Forms com ~75
perguntas (uma por produto do catálogo), lido por um Apps Script cheio de camadas de correção
(`CATALOGO_PRODUTOS`, `ALIASES_PRODUTOS`, `CAMPOS_META`, grade, texto livre, "rede de segurança")
só para compensar o fato de o Forms não garantir que o título de cada pergunta bate com o nome do
produto. Isso já causou pelo menos um bug real (itens de "Proteína" sumindo da mensagem do
Telegram). O dono do negócio pediu um app próprio, no mesmo padrão das outras telas internas —
"tipo as OS": um menu com **Abrir Requisição** e **Fechar Requisição**.

## Objetivo

Um Web App em Apps Script, visualmente consistente com `manutencao-appsscript/`, com:
1. **Abrir Requisição** — formulário próprio (não Forms) onde o solicitante escolhe os produtos do
   catálogo e a quantidade de cada um, preenche os dados da requisição e envia. Gera um Doc e avisa
   no Telegram — mesma automação que já existe hoje.
2. **Fechar Requisição** — tela para quem entrega os itens dar baixa numa requisição em aberto:
   escolhe a requisição na lista, informa quem está entregando, confirma. Isso **não existe hoje**
   (o script atual não tem conceito de status/baixa) — é a peça nova que falta pra virar "tipo as OS".

## Decisão de arquitetura

Novo projeto de Apps Script, próprio, com planilha própria — não reaproveita o projeto de
manutenção (domínio diferente: produtos e estoque, não ordens de serviço/Trello). Mesma filosofia
de código, porém:

- **Elimina toda a camada de reconciliação de nomes** (`ALIASES_PRODUTOS`, `CAMPOS_META`,
  `getItensDeGrade`, `getItensDeTextoLivre`, a "rede de segurança" com `⚠️`). Essa complexidade só
  existia para compensar a falta de controle sobre os títulos de pergunta do Forms. Num formulário
  HTML próprio, os nomes dos produtos vêm exatamente como estão em `CATALOGO_PRODUTOS` — não há
  nome divergente pra reconciliar.
- **Um produto = uma linha do array `itens` enviado pelo cliente**, não uma coluna da planilha. A
  planilha de respostas passa a ter uma única coluna de texto "Itens solicitados" (uma linha por
  item, formato `Produto (UNIDADE): Quantidade`), em vez de ~75 colunas quase todas vazias.
- Mantém os mesmos princípios defensivos do `manutencao-appsscript`: colunas localizadas por
  cabeçalho (`getColumnIndexByHeader`/`obterMapaColunas`), não por posição fixa; `LockService` para
  gerar o ID sequencial sem corrida; falha em Doc/Telegram isolada em `try/catch` própria, sem
  desfazer a requisição já gravada.
- Reaproveita a mesma pasta de logo (`LOGO_ID = "1mBHCppmwzj65IlT7kCKXInhSV-ltqE3I"`) e o mesmo
  padrão de propriedades do Telegram (`TELEGRAM_TOKEN`, `TELEGRAM_CHAT_ID` em
  `PropertiesService.getScriptProperties()`) já usados pelos outros apps da Mamma Mia.

## Planilha real usada (atualização pós-implementação)

O usuário criou o app na planilha já existente **"BASE - REQUISIÇÃO MP E RECHEIOS"**
(`1aDbE5qxZdtTlPsJbDJF6V_0QiCsQnv4-9xuGafRIuhw`), não numa planilha em branco. Essa planilha já
tinha várias abas de um fluxo anterior (Forms + planilhas auxiliares de conferência), então o app
foi ajustado para conviver com elas em vez de presumir "primeira aba = requisições":

- **`FecharRequisicao`** (nome dado pelo usuário) — é a aba nova, só com o cabeçalho (linha 1)
  descrito abaixo, sem dados. É nela que `abrirRequisicao`/`fecharRequisicao`/
  `listarRequisicoesAbertas` leem e gravam. `obterSheet()` busca por esse nome exato
  (`getSheetByName`), não mais por posição (`getSheets()[0]`) — a primeira aba da planilha é, na
  verdade, a resposta antiga do Google Forms, com ~100 colunas (uma por produto) e dados
  históricos reais; usar `getSheets()[0]` teria feito o app ler/gravar na aba errada.
- **`BASE_REQUISICAO_MP_RECHEIOS`** — aba **já existente**, com o catálogo real e atual de produtos
  em 3 colunas: `TIPO`, `ITEM`, `UN_MEDIDA` (112 produtos: 94 de Matéria-prima, 18 de Recheio; sem
  categoria de Embalagens). É mais completo e mais atual que o `CATALOGO_PRODUTOS` do script
  original do Forms — por isso o catálogo do app **não fica mais hardcoded em `Code.gs`**; é lido
  ao vivo dessa aba (`obterCatalogoDaPlanilha()`), formatado como `"ITEM (UNIDADE)"`. Isso também
  significa que adicionar/renomear um produto na planilha passa a valer no app sem reimplantar
  nada.
- **`BASE_CONSOLIDADA`** e **`BASE_CONTROLE_YUKA`** — abas auxiliares de conferência (quantidade
  pedida x recebida) já existentes, usadas por outro processo manual. Fora de escopo: o app não lê
  nem escreve nelas.

Cabeçalhos exatos da aba `FecharRequisicao` (linha 1), localizados por nome (não por posição):

`Timestamp`, `ID`, `STATUS`, `Nome do requisitante`, `Unidade solicitante`, `Setor solicitante`,
`Tipo de item requisitado`, `Itens solicitados`, `Finalidade da requisição`, `Documento`,
`Entregue por`, `Data de entrega`, `Observações de entrega`.

`STATUS` é `"Solicitado"` (ao abrir) ou `"Entregue"` (ao fechar).

`Setor solicitante` e `Tipo de item requisitado` também foram ajustados para bater com o uso real
observado na aba antiga do Forms, em vez dos setores copiados da tela de OS (que são de
manutenção, não de requisição de estoque):
- Setores: `Estoque`, `Produção`, `Expedição`, `Cocção`, `CD`, `Outro`.
- Tipos: os valores de `TIPO` que existirem em `BASE_REQUISICAO_MP_RECHEIOS` (hoje `Matéria-prima`
  e `Recheio`) mais `Outro`, calculados dinamicamente — não fixos no código.

## Componentes

### `Code.gs`

- `obterCatalogoDaPlanilha()` — lê a aba `BASE_REQUISICAO_MP_RECHEIOS` (colunas `TIPO`, `ITEM`,
  `UN_MEDIDA`, localizadas por cabeçalho) e devolve os produtos agrupados por tipo, já formatados
  como `"ITEM (UNIDADE)"`. Substitui o catálogo fixo que estava planejado originalmente — ver
  "Planilha real usada" acima.
- `obterDadosAberturaRequisicao()` — chamado pelo cliente via `google.script.run` na tela de
  abertura; devolve `{ catalogo, opcoesUnidade, opcoesSetor, opcoesTipoItem }` num único payload.
- `getColumnIndexByHeader` / `obterMapaColunas` — mesmo padrão defensivo do `manutencao-appsscript`.
- `gerarIDRequisicao()` — mesma lógica já existente (contador diário em `PropertiesService`,
  protegido por `LockService`), formato `RQ-AAAAMMDD-NNN`.
- `criarDocumentoRequisicao(dados, idRequisicao, linhasItens)` — mesmo documento (logo, dados do
  solicitante, lista de itens, finalidade, status), adaptado para receber os itens já formatados.
- `enviarTelegram(mensagem)` — igual ao script original.
- `abrirRequisicao(dados)` — novo: valida campos obrigatórios e que ao menos 1 item tenha
  quantidade > 0; grava a linha (`STATUS = "Solicitado"`); gera o Doc; avisa no Telegram; devolve
  `{ ok: true, id }`. Falha ao gerar Doc ou avisar no Telegram é isolada (log + aviso de erro no
  Telegram quando possível), sem desfazer a requisição já gravada — mesmo padrão do `onFormSubmit`
  de manutenção.
- `listarRequisicoesAbertas()` — devolve requisições com `STATUS !== "Entregue"`, mais recente
  primeiro, para a tela de fechamento.
- `fecharRequisicao(id, entreguePor, observacoes)` — localiza a linha pelo `ID`; se já estiver
  `"Entregue"`, lança erro ("Essa requisição já foi entregue por outra pessoa."); senão grava
  `STATUS = "Entregue"`, `Entregue por`, `Data de entrega` (hora do servidor) e a observação
  opcional; avisa no Telegram (falha isolada, não desfaz a baixa).
- `doGet(e)` — mesmo esquema de `manutencao-appsscript`: `?tela=abrir` → `AbrirRequisicao.html`,
  `?tela=fechar` → `FecharRequisicao.html`, sem parâmetro → `Menu.html`.

### `Menu.html`

Clone visual de `manutencao-appsscript/Menu.html` (mesma paleta `--bg`/`--card-bg`/`--gold`/
`--green`), trocando texto/ícones para "📦 Requisição MP e Recheios" com os cards **Abrir
Requisição** / **Fechar Requisição**. Links relativos (`?tela=abrir`, `?tela=fechar`) em vez de URL
fixa — não depende de saber o link de implantação de antemão.

### `AbrirRequisicao.html`

Mesma base visual/CSS de `AbrirOS.html`. Campos do cabeçalho da requisição (Nome do requisitante,
Unidade solicitante, Setor solicitante — opções `Estoque`/`Produção`/`Expedição`/`Cocção`/`CD`/
`Outro`, vindas do uso real da aba antiga do Forms, com fallback "Outro" —, Tipo de item
requisitado, Finalidade). Catálogo, opções de setor e de tipo chegam num só payload de
`obterDadosAberturaRequisicao()`, chamado ao carregar a tela. Abaixo, o catálogo agrupado por
categoria (lido da planilha) com um campo numérico de quantidade por produto e um filtro de texto
no topo (112+ produtos não cabem numa lista sem busca). Só os produtos com quantidade > 0 viram
itens da requisição. Validação no cliente: campos obrigatórios preenchidos e pelo menos 1 item
selecionado, antes de chamar `google.script.run.abrirRequisicao(dados)`.

### `FecharRequisicao.html`

Mesma base visual/lógica de `Index.html` (fechamento de OS): lista as requisições em aberto
(`listarRequisicoesAbertas()`), toque abre o formulário de baixa (campo "Entregue por" + observação
opcional), confirma chamando `fecharRequisicao(id, entreguePor, observacoes)`.

## Fora de escopo

- Controle de estoque/baixa automática de quantidade em almoxarifado — a baixa aqui é só do
  *status da requisição* (entregue/não entregue), não um sistema de inventário.
- Foto/assinatura obrigatória no fechamento — diferente da OS (onde a foto prova o reparo físico),
  aqui a baixa é uma confirmação de entrega; não há problema físico a documentar.
- Migrar respostas antigas do Google Forms para a planilha nova — a planilha nova começa vazia; o
  Forms antigo pode continuar existindo em paralelo até a equipe migrar de fato.
- Trello — a requisição nunca teve card de Trello; não é adicionado aqui.

## Passos de implantação (feitos pelo usuário, com o código já pronto)

1. ✅ Já feito: aba `FecharRequisicao` criada na planilha "BASE - REQUISIÇÃO MP E RECHEIOS", com os
   13 cabeçalhos exatos na linha 1. A aba `BASE_REQUISICAO_MP_RECHEIOS` (catálogo) já existia.
2. Nessa MESMA planilha: Extensões → Apps Script (isso cria um script vinculado a ela — importante,
   já que `obterSheet()`/`obterCatalogoDaPlanilha()` usam `SpreadsheetApp.getActiveSpreadsheet()`).
   Colar `Code.gs`, `Menu.html`, `AbrirRequisicao.html`, `FecharRequisicao.html`.
3. Configurar `TELEGRAM_TOKEN` e `TELEGRAM_CHAT_ID` em Configurações do projeto → Propriedades do
   script (mesmos valores já usados nos outros bots da Mamma Mia, ou um chat novo se quiser separar
   o aviso de requisição do de manutenção).
4. Implantar → Nova implantação → App da Web (Executar como: Eu; Quem pode acessar: Qualquer
   pessoa).
5. Compartilhar o link com quem solicita (Abrir) e com o almoxarifado/cozinha central (Fechar).
