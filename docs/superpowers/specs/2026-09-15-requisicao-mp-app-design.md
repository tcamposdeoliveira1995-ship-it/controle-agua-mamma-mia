# Fechar Requisição de MP e Recheios (a abertura continua no Google Forms)

**Data:** 2026-09-15
**Status:** Aprovado para implementação (revisado após ver a planilha real)

## Problema

A requisição de matéria-prima/recheios/embalagens é aberta pelo Google Forms e cai numa aba de
respostas. A equipe já mantém manualmente uma coluna `STATUS` (`ABERTO`/`CONCLUÍDO`/`PARCIALMENTE`)
nessa aba, mas não tem uma forma própria de dar baixa — o fechamento depende de editar a célula de
Status direto na planilha, sem registrar quem entregou nem quando. O dono do negócio pediu um app
"tipo as OS" com **Abrir** e **Fechar**.

## Histórico desta espec (por que ela mudou)

A primeira versão deste plano assumia que a abertura também seria refeita como uma tela própria
(substituindo o Forms), com uma planilha nova e um catálogo de produtos embutido. Duas coisas
mudaram isso depois de ver a planilha real do usuário
(`1aDbE5qxZdtTlPsJbDJF6V_0QiCsQnv4-9xuGafRIuhw`, "BASE - REQUISIÇÃO MP E RECHEIOS"):

1. **A abertura pelo Forms já funciona e já é a fonte real dos dados** — a planilha tem 211
   requisições reais, com ID (`REQUISICOES`, formato `REQ-AAAAMMDD-HHMMSS-N`) e `STATUS` já
   preenchidos por uma automação que não faz parte deste projeto. O usuário confirmou: "as
   requisições para abrir vêm de formulário" — ou seja, **não** trocar a abertura, só fechar o que
   já existe.
2. **O catálogo de ~75 produtos do Forms parecia morto na prática, mas voltou a ser usado** — nas
   primeiras ~180 linhas reais (até ~16/06/2026), ninguém preenchia as colunas por produto; todo
   mundo escrevia em texto livre num único campo ("Item requisitado / Quantidade requisitada", ex:
   `"10 FARDOS DE EMBALAGEM DE PÃO DE QUEIJO GOURMET 4KG"`). A partir de 17/06/2026, porém, várias
   respostas passaram a preencher as colunas por produto (provavelmente uma mudança no Forms) e
   deixaram o campo de texto livre em branco. **Correção:** em vez de ler só o campo de texto livre
   (que ficaria vazio pra essas respostas), o app varre **qualquer coluna não reconhecida** (tudo
   que não é um dos campos fixos: requisitante, unidade, setor, status, etc.) com valor
   diferente de vazio/zero e mostra "Nome da coluna: valor" — funciona pros dois jeitos de
   preencher, sem manter uma lista fixa de produtos no código (`obterColunasProduto`/
   `montarItensTexto` em `Code.gs`).

Isso reduz o escopo pra **só a tela de Fechar Requisição** (+ um Histórico de consulta) — as peças
que realmente não existiam.

## Objetivo

Um Web App em Apps Script, visualmente consistente com `manutencao-appsscript/`, com um menu de 3
cards:
1. **Abrir Requisição** — link direto pro Google Forms já existente (sem mudança nenhuma).
2. **Fechar Requisição** — tela nova: lista as requisições com `STATUS` `ABERTO` ou `PARCIALMENTE`,
   quem está entregando escolhe uma, informa se foi entrega total ou parcial, seu nome e uma
   observação opcional, e confirma.
3. **Histórico** — tela nova de consulta: lista as requisições com `STATUS` `CONCLUÍDO`, mais
   recente primeiro, com busca por ID/requisitante/setor/item.

## Planilha real usada

Planilha **"BASE - REQUISIÇÃO MP E RECHEIOS"** já existente, com 5 abas:

- **`REQUISIÇÃO DE MATÉRIA-PRIMA E RECHEIOS - MAMMA MIA CONTROL`** — aba de respostas do Forms
  (nome real completo, sem truncar — cuidado ao copiar, o nome de exibição no Google Sheets pode
  aparecer cortado em ferramentas que exportam pra `.xlsx`, que tem limite de 31 caracteres pra
  nome de aba). É **nela** que o app lê e grava. 211 linhas reais, 107 colunas. Colunas relevantes
  (localizadas por cabeçalho, não por posição):
  - `Timestamp`, `Nome do requisitante`, `Unidade solicitante`, `Setor solicitante`, `Tipo de item
    requisitado`, `Prioridade`, `Finalidade da requisição`, `Observações`.
  - O campo de itens em texto livre — título real (com instruções embutidas): `"Item requisitado /
    Quantidade requisitada\nPreencha uma linha para cada item..."`. Localizado por **padrão**
    (`/^Item requisitado\s*\/\s*Quantidade requisitada/i`), não por nome exato, porque o título tem
    texto de instrução que pode ser reformulado sem mudar de sentido.
  - `Quantidade solicitada` — às vezes preenchida, às vezes não (a quantidade geralmente já vem
    embutida no texto livre); quando presente, é anexada ao texto exibido no card.
  - `STATUS` (`ABERTO` / `CONCLUÍDO` / `PARCIALMENTE`) e `REQUISICOES` (ID, ex:
    `REQ-20260528-095637-2`) — já preenchidos por outra automação; o app só lê e, no fechamento,
    só escreve em `STATUS`.
  - ~93 colunas por produto (`Apresuntado (PÇ)`, `Achocolatado (KG)`, etc.) e 2 colunas de pergunta
    em grade (`Item requisitado [Matéria-prima | AÇAFRAO | KG]` etc.) — o app nunca grava nelas,
    mas **lê**: são o que `obterColunasProduto()` varre pra montar o texto de itens quando quem
    respondeu preencheu por ali em vez do campo de texto livre (ver "Histórico desta espec" acima).
- **`BASE_REQUISICAO_MP_RECHEIOS`**, **`BASE_CONSOLIDADA`**, **`BASE_CONTROLE_YUKA`** — abas
  auxiliares de outro processo manual (catálogo de referência e conferência pedido x recebido).
  Fora de escopo, o app não toca nelas.
- **`FecharRequisicao`** — aba criada numa iteração anterior deste projeto (só cabeçalho, sem
  dados), quando a ideia ainda era uma planilha de requisições própria. **Não é mais usada** — pode
  ser apagada ou deixada sem uso.

### Mudança manual necessária na planilha

Adicionar 3 colunas novas ao cabeçalho (linha 1) da aba
`REQUISIÇÃO DE MATÉRIA-PRIMA E RECHEIOS - MAMMA MIA CONTROL`, com esses nomes exatos:

- `Entregue por`
- `Data de entrega`
- `Observações de entrega`

## Componentes

### `Code.gs`

- `getColumnIndexByHeader` / `getColumnIndexByPattern` / `obterMapaColunas` — mesmo padrão
  defensivo do `manutencao-appsscript` (nunca grava na coluna errada silenciosamente); a segunda
  função existe só pra achar a coluna de itens em texto livre por padrão, não por nome exato.
- `obterSheet()` — busca a aba pelo **nome exato**
  (`REQUISIÇÃO DE MATÉRIA-PRIMA E RECHEIOS - MAMMA MIA CONTROL`), nunca por posição
  (`getSheets()[0]`) — importante porque essa aba É a primeira aba hoje, mas depender de posição
  quebraria silenciosamente se alguém reordenar as abas no futuro.
- `formatarNomeColunaProduto(nome)` / `obterColunasProduto(sheet, cols)` / `montarItensTexto(linha,
  cols, colunasProduto)` — juntos, montam o texto de itens de uma requisição combinando o campo de
  texto livre, a `Quantidade solicitada` avulsa e qualquer coluna por produto com valor não-vazio/
  não-zero (ver "Histórico desta espec"). `obterColunasProduto` acha essas colunas por exclusão
  (tudo que não é um campo conhecido em `cols`), então não precisa manter uma lista de produtos.
- `listarRequisicoesAbertas()` — devolve requisições com `STATUS !== "CONCLUÍDO"` (cobre `ABERTO` e
  `PARCIALMENTE`), mais recente primeiro; cada item traz id, requisitante, unidade, setor, tipo,
  itens (via `montarItensTexto`), prioridade, finalidade, observações e status atual.
- `fecharRequisicao(id, statusFinal, entreguePor, observacoesEntrega)` — `statusFinal` é
  `"CONCLUÍDO"` ou `"PARCIALMENTE"` (os dois status já usados manualmente hoje); localiza a linha
  pelo `REQUISICOES`; se já estiver `CONCLUÍDO`, lança erro ("já foi concluída por outra pessoa");
  senão grava `STATUS`, `Entregue por`, `Data de entrega` (hora do servidor) e a observação
  opcional; avisa no Telegram (falha isolada em `try/catch`, não desfaz a baixa já gravada).
- `listarRequisicoesFechadas()` — igual a `listarRequisicoesAbertas()`, mas devolve `STATUS ===
  "CONCLUÍDO"`; usado pela tela de Histórico.
- `enviarTelegram(mensagem)` — igual aos outros apps da Mamma Mia.
- `doGet(e)` — `?tela=fechar` → `FecharRequisicao.html`; `?tela=historico` →
  `HistoricoRequisicoes.html`; sem parâmetro → `Menu.html`. Não existe `?tela=abrir` (o card de
  abrir no menu aponta direto pro link do Forms).

### `Menu.html`, `FecharRequisicao.html`, `HistoricoRequisicoes.html`

Clones visuais de `manutencao-appsscript/Menu.html` e `Index.html`. **Importante:** todos os links
de navegação entre telas (inclusive "‹ Menu") usam a URL **absoluta** de implantação
(`https://script.google.com/macros/s/AKfycby.../exec?tela=...`), nunca relativa (`?tela=...`). O
Apps Script serve a página dentro de um iframe hospedado em `googleusercontent.com`; um link
relativo resolve contra esse iframe interno, não contra a URL `/exec` que aparece no navegador, e
acaba levando pro link de teste do editor (que só funciona de dentro do editor, com os cookies
certos). Foi exatamente esse bug que causou tela branca na primeira tentativa.

O card **Abrir Requisição**, no Menu, é um link comum (`<a href="...">`) direto pro Google Forms já
existente
(`https://docs.google.com/forms/d/e/1FAIpQLSeEPlg0wMPk-zwtOPa5p8fnl3_J0wwjWSGPRGpZNw-1nscWbw/viewform`).

### `FecharRequisicao.html`

Mesma base visual/lógica de `Index.html` (fechamento de OS): lista as requisições em aberto
(`listarRequisicoesAbertas()`) em cards com um badge colorido por prioridade (Urgente/Crítica em
vermelho, Alta em laranja, Média em amarelo, Baixa em verde). Ao tocar numa requisição, abre um
formulário com:
- Rádio "Entregue por completo" / "Entregue parcialmente" (define o `STATUS` final).
- Campo obrigatório "Entregue por".
- Campo opcional de observações.

Confirma chamando `fecharRequisicao(id, statusFinal, entreguePor, observacoes)`.

### `HistoricoRequisicoes.html`

Consulta somente leitura das requisições `CONCLUÍDO` (`listarRequisicoesFechadas()`), mais recente
primeiro, com um campo de busca (filtra no cliente por ID, requisitante, unidade, setor, tipo,
itens ou quem entregou). Mostra "Entregue por"/"Data de entrega"/observação quando presentes —
ficam em branco pras requisições concluídas antes deste app existir, o que é esperado.

## Tratamento de erro

- Aba ou coluna não encontrada → erro claro do `getColumnIndexByHeader`/`getColumnIndexByPattern`,
  propagado pro `google.script.run` e mostrado na tela (não grava nada na coluna errada).
- Corrida entre duas pessoas fechando a mesma requisição → `fecharRequisicao` reconfere o `STATUS`
  antes de gravar; quem chegar depois recebe aviso e não sobrescreve.
- Falha ao avisar no Telegram → não impede a baixa (a planilha é a fonte da verdade); só fica
  registrada no Log do Apps Script.

## Fora de escopo

- Reescrever a abertura da requisição — continua sendo o Google Forms, como já é hoje.
- Reconciliar nomes/aliases do catálogo de produtos do Forms (o que o script original de
  `enviarRequisicaoTelegram` fazia com `ALIASES_PRODUTOS`/`CAMPOS_META`) — o app só lê o nome da
  coluna como está e exibe, não tenta casar com um catálogo canônico.
- Controle de estoque/baixa automática de quantidade em almoxarifado — a baixa aqui é só do
  *status da requisição*, não um sistema de inventário (isso já existe, manual, nas abas
  `BASE_CONSOLIDADA`/`BASE_CONTROLE_YUKA`).
- Foto/assinatura obrigatória no fechamento — diferente da OS (onde a foto prova o reparo físico),
  aqui a baixa é uma confirmação de entrega de itens.
- Migrar ou apagar a aba `FecharRequisicao` (da iteração anterior) — fica como está, sem uso, até o
  usuário decidir apagá-la.

## Passos de implantação (feitos pelo usuário, com o código já pronto)

1. Na aba `REQUISIÇÃO DE MATÉRIA-PRIMA E RECHEIOS - MAMMA MIA CONTROL`, adicionar as 3 colunas
   novas no cabeçalho: `Entregue por`, `Data de entrega`, `Observações de entrega`.
2. Nessa MESMA planilha: Extensões → Apps Script → colar `Code.gs`, `Menu.html`,
   `FecharRequisicao.html`, `HistoricoRequisicoes.html` (substituindo qualquer versão anterior
   desses arquivos).
3. Configurar `TELEGRAM_TOKEN` e `TELEGRAM_CHAT_ID` em Configurações do projeto → Propriedades do
   script.
4. Implantar → Nova implantação (ou Gerenciar implantações → Nova versão, se já existir uma) → App
   da Web (Executar como: Eu; Quem pode acessar: Qualquer pessoa).
5. Compartilhar o link com quem dá baixa nas requisições (almoxarifado/cozinha central).
