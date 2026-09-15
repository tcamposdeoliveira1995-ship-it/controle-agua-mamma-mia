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

## Planilha (aba única, primeira aba do spreadsheet)

Cabeçalhos exatos (linha 1), localizados por nome (não por posição):

`Timestamp`, `ID`, `STATUS`, `Nome do requisitante`, `Unidade solicitante`, `Setor solicitante`,
`Tipo de item requisitado`, `Itens solicitados`, `Finalidade da requisição`, `Documento`,
`Entregue por`, `Data de entrega`, `Observações de entrega`.

`STATUS` é `"Solicitado"` (ao abrir) ou `"Entregue"` (ao fechar).

## Componentes

### `Code.gs`

- `CATALOGO` — mesmo catálogo de produtos do script original, agora agrupado por categoria
  (`Matéria-prima`, `Recheio`, `Embalagens/Descartáveis`) para alimentar o seletor de itens da
  tela de abertura. Nomes e unidades idênticos ao catálogo já validado pelo usuário.
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
Unidade solicitante, Setor solicitante — mesmas opções de setor usadas em OS, com "Outro" —, Tipo
de item requisitado, Finalidade). Abaixo, o catálogo agrupado por categoria com um campo numérico
de quantidade por produto e um filtro de texto no topo (73+ produtos não cabem numa lista sem
busca). Só os produtos com quantidade > 0 viram itens da requisição. Validação no cliente: campos
obrigatórios preenchidos e pelo menos 1 item selecionado, antes de chamar
`google.script.run.abrirRequisicao(dados)`.

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

1. Criar uma planilha nova (ou usar uma em branco) e colar os cabeçalhos exatos listados acima na
   linha 1.
2. Extensões → Apps Script, colar `Code.gs`, `Menu.html`, `AbrirRequisicao.html`,
   `FecharRequisicao.html`.
3. Configurar `TELEGRAM_TOKEN` e `TELEGRAM_CHAT_ID` em Configurações do projeto → Propriedades do
   script (mesmos valores já usados nos outros bots da Mamma Mia, ou um chat novo se quiser separar
   o aviso de requisição do de manutenção).
4. Implantar → Nova implantação → App da Web (Executar como: Eu; Quem pode acessar: Qualquer
   pessoa).
5. Compartilhar o link com quem solicita (Abrir) e com o almoxarifado/cozinha central (Fechar).
