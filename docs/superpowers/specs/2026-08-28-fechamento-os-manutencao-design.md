# Fechamento de OS pela Manutenção — Design

**Data:** 2026-08-28
**Status:** Aprovado para implementação

## Problema

Hoje a equipe de manutenção (Ari Cassio, Francinaldo Mendes, prestador terceirizado) não tem uma forma
própria de dar baixa numa Ordem de Serviço (OS). O fechamento depende de alguém editar a célula de
Status manualmente na planilha — o que é indireto, sujeito a erro de digitação, e não registra o que
foi feito, quando, nem quem executou.

## Objetivo

Uma tela única, pensada pra celular, onde um técnico:
1. Vê a lista de OS ainda abertas.
2. Escolhe a que está fechando.
3. Descreve o que foi feito.
4. Confirma o próprio nome.
5. Envia — a planilha é atualizada, o card do Trello move pra "Concluído", e um aviso sai no Telegram.

Não inclui (fora de escopo por ora): abrir novas OS (isso já existe via o Google Form), editar/excluir
uma baixa já registrada, autenticação de usuário (a lista de técnicos é fixa e pequena, sem senha),
anexar fotos da execução.

## Contexto existente (relevante pro design)

A planilha de OS já tem uma automação em Apps Script (`Code.gs`, aba de Formulário → Sheets):

- `onFormSubmit`: ao abrir uma OS pelo Form, gera o ID (`OS-AAAAMMDD-NNN`), grava Status/Prioridade,
  cria um card no Trello, gera um PDF da OS e avisa no Telegram.
- `onEdit`: se alguém edita a célula de Status na planilha manualmente, move o card correspondente
  no Trello para a lista equivalente (`Aberto`, `Em análise`, `Em execução`, `Aguardando peça`,
  `Concluído`).
- `obterMapaColunas(sheet)` / `getColumnIndexByHeader(sheet, nome)`: acham o índice de cada coluna
  pelo texto do cabeçalho (não por posição fixa), e lançam erro claro se o cabeçalho não existir —
  em vez de gravar dado na coluna errada silenciosamente.
- Credenciais do Trello e do Telegram já ficam em `PropertiesService.getScriptProperties()`.

Cabeçalho real da planilha (via `obterMapaColunas`): `Timestamp`, `OS`, `STATUS`, `PRIORIDADE`,
`TRELLO_CARD_ID`, `PDF_OS`, `Nome do solicitante`, `Setor`, `Data e hora da ocorrência`,
`Tipo de ocorrência`, `Equipamento ou local afetado`, `Foto do problema`, `Código/Tag do equipamento`,
`O que está acontecendo?`, `O equipamento parou totalmente?`, `Impacto na produção`, `Gravidade`,
`Observações adicionais`.

Duas observações que não fazem parte deste projeto, mas foram encontradas ao ler o código, e ficam
registradas para correção futura no dashboard (`controle-agua-mamma-mia`):
- O KPI "Em Andamento" do painel de OS nunca conta nada porque o Status real usado pelo Trello é
  `"Em análise"`/`"Em execução"`, não `"Em Andamento"`.
- A coluna "Unidade" da tabela de OS no dashboard sempre fica vazia porque o código procura um
  cabeçalho `"UNIDADE"`, que não existe — o cabeçalho real é `"Setor"`.

## Decisão de arquitetura

Estender o **mesmo projeto de Apps Script** já vinculado à planilha de OS, em vez de criar um projeto
ou repositório novo:

- Reaproveita `obterMapaColunas`/`getColumnIndexByHeader` (mesma filosofia: erro claro se uma coluna
  não existir, nunca gravação silenciosa no lugar errado).
- Reaproveita `moverCard(cardId, status)` — dar baixa por este app novo também move o card no Trello.
- Reaproveita o padrão de aviso no Telegram.
- Zero infraestrutura nova: nenhum repositório, build, ou deploy fora do Google. O técnico abre um
  único link (`.../macros/s/SCRIPT_ID/exec`).

A tela em si usa `HtmlService` (um arquivo `Index.html` servido pelo `doGet`), e o cliente chama as
funções do servidor via `google.script.run` — não é uma API HTTP com `doPost`/JSON como o Mamma
Fórmula, porque aqui cliente e servidor moram no mesmo projeto Apps Script; `google.script.run` é o
mecanismo nativo para isso e evita reimplementar autenticação/CORS.

## Mudança manual necessária na planilha

Adicionar 3 colunas novas ao cabeçalho (linha 1), com esses nomes exatos:

- `O que foi feito`
- `Data de conclusão`
- `Assinado por`

E confirmar que existe uma aba chamada **Manutenção**, coluna A, com os nomes dos técnicos (uma
por linha; se a primeira linha for um cabeçalho como "Nome" ou "Técnico", o código já ignora
automaticamente).

## Componentes

### `Code.gs` (adições ao arquivo já existente)

- `listarOSAbertas()` — retorna um array de OS com `Status !== "Concluído"` (cobre Aberto, Aguardando
  peça, Em análise, Em execução), ordenado por prioridade (Crítica → Alta → Média → Baixa). Cada item
  traz: número da OS, status, prioridade, setor, equipamento/local, descrição do problema.
- `listarTecnicos()` — lê a aba "Manutenção", devolve a lista de nomes (ignorando linha de cabeçalho
  e células vazias).
- `fecharOS(osId, oQueFoiFeito, assinadoPor)` — localiza a linha pela coluna OS; se já estiver
  `Concluído`, lança erro ("Essa OS já foi fechada por outra pessoa"); senão grava Status =
  `Concluído`, `O que foi feito`, `Data de conclusão` (hora do servidor, não do celular do técnico) e
  `Assinado por`; tenta mover o card no Trello (`moverCard`) e avisar no Telegram — ambos em
  `try/catch` que só loga em caso de falha, sem desfazer a baixa já gravada na planilha.
- `doGet(e)` — serve `Index.html` como a página do Web App.

### `Index.html` (novo)

Página única, mobile-first:
1. **Lista de OS abertas** — cards grandes e tocáveis (não um dropdown), com prioridade, setor,
   equipamento e descrição resumida, mais recente/crítica primeiro.
2. Ao tocar numa OS, abre o formulário: campo de texto "O que foi feito?" + seletor "Assinado por"
   (as opções vêm de `listarTecnicos()`).
3. Botão "Confirmar baixa" — desabilita durante o envio, mostra estado de carregando.
4. Tela de sucesso ("OS fechada ✅") e volta pra lista (recarregada, sem a OS que acabou de fechar).
5. Erros de `fecharOS` (ex.: OS já fechada) aparecem como mensagem na tela, sem travar o app.

## Tratamento de erro

- Coluna nova faltando → erro claro do `getColumnIndexByHeader`, propagado pro `google.script.run`
  e mostrado na tela.
- Corrida entre dois técnicos fechando a mesma OS → `fecharOS` reconfere o Status antes de gravar;
  quem chegar depois recebe aviso e não sobrescreve.
- Falha ao mover card no Trello ou avisar no Telegram → não impede a baixa (a planilha é a fonte da
  verdade); só fica registrado no Log do Apps Script.

## Passos de implantação (feitos pelo usuário, com o código já pronto)

1. Adicionar as 3 colunas na planilha e confirmar a aba "Manutenção".
2. Colar as funções novas no `Code.gs` existente (Extensões → Apps Script).
3. Criar o arquivo `Index.html` no mesmo projeto Apps Script.
4. **Implantar → Nova implantação → App da Web** (Executar como: Eu; Quem pode acessar: **Qualquer
   pessoa** — assim o técnico abre o link direto no celular sem precisar estar logado numa conta
   Google, igual aos outros links que a equipe já usa no dia a dia).
5. Compartilhar o link com os 3 técnicos (fixar no WhatsApp/tela inicial do celular).
