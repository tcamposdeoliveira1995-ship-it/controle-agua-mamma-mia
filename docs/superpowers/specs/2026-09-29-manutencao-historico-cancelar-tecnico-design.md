# Manutenção (OS) — Histórico de OS concluídas, Cancelar OS, Técnico responsável na abertura

**Data:** 2026-09-29
**Status:** Implementado, aguardando validação em produção

## Contexto

Ao perguntar "o que mais dá pra ajustar nesse app de manutenção?", a usuária aprovou 3 melhorias
pequenas de uma vez ("pode fazer o histórico de OS concluídas e os outros"):

1. Uma tela de **Histórico** pra ver OS já concluídas (a tela de Fechar OS só lista as abertas — depois
   de fechada, a OS "some" do app, só fica visível na planilha).
2. Poder **cancelar uma OS aberta por engano**, sem precisar "fechar" ela como se tivesse sido resolvida.
3. Poder **atribuir o técnico responsável** já no momento de abrir a OS (opcional — nem sempre já se sabe
   quem vai resolver).

## Decisões de design

- **Reaproveitar colunas existentes para o cancelamento**, em vez de criar novas: o campo `oQueFoiFeito`
  recebe o prefixo `"Cancelada: " + motivo`, `assinadoPor` recebe quem cancelou, `dataConclusao` recebe a
  data/hora do cancelamento. Isso evita mais uma coluna manual pra usuária criar na planilha.
- **Uma única coluna nova é necessária**: "Técnico responsável" — usada tanto na abertura (opcional)
  quanto exibida no histórico e na tela de fechamento.
- **Cancelamento não gera PDF**, diferente do fechamento normal — não há solução nem foto pra documentar,
  então um PDF não agregaria nada.
- **Trello**: OS cancelada move o card pra a mesma lista de "Concluído" (não faz sentido ter uma lista
  Trello separada só pra isso — o card só precisa sair da lista de "aberto").
- **Novo status `"Cancelada"`**, junto dos já existentes `"Concluído"` e `"Aguardando peça"`. A listagem
  de OS abertas (`listarOSAbertas`) passa a excluir tanto `Concluído` quanto `Cancelada`.
- **Histórico é somente leitura**: lista OS com status `Concluído` ou `Cancelada`, mais recentes primeiro,
  com busca por texto (OS, setor, equipamento, técnico, quem assinou, descrição).

## Backend (`Code.completo.gs`)

- Nova coluna mapeada em `obterMapaColunas`: `tecnicoResponsavel` (lookup por cabeçalho "Técnico
  responsável", igual ao padrão já usado pras outras colunas).
- `var STATUS_CANCELADA = "Cancelada";`
- `moverCard()`: lista `"Cancelada"` aponta pro mesmo id de lista Trello que `"Concluído"`.
- `listarOSAbertas()`: exclui `Concluído` e `Cancelada`; devolve `tecnicoResponsavel`.
- `listarOSFechadas()` (nova): devolve OS com status `Concluído` ou `Cancelada`, ordenadas por data de
  conclusão (mais recente primeiro), incluindo técnico responsável, o que foi feito, quem assinou, data e
  link do PDF (quando existir).
- `cancelarOS(osId, motivo, canceladoPor)` (nova): protegida por `LockService` na seção de
  checar-e-gravar (evita cancelar/fechar a mesma OS duas vezes em paralelo); valida que a OS existe e
  ainda não está `Concluído`/`Cancelada`; grava status, motivo (em `oQueFoiFeito`), quem cancelou e a
  data; move o card no Trello; avisa no Telegram via `enviarTelegramOSCancelada()`.
- `enviarTelegramOSCancelada(dados)` (nova): mensagem "🚫 OS CANCELADA" com setor, equipamento, motivo,
  quem cancelou e data.
- `abrirOS()`: grava `tecnicoResponsavel` (campo opcional, não obrigatório).
- `doGet()`: nova rota `?tela=historico` serve o arquivo `Historico`.

## Frontend

- **`AbrirOS.html`**: novo campo opcional "Técnico responsável" (select, com opção "Ainda não sei /
  decidir depois"), populado a partir de `listarTecnicos()` (já existente, usada em outros selects do
  mesmo app).
- **`Index.html`** (tela de Fechar OS): mostra o técnico responsável no card e no formulário, quando
  presente; novo botão "🚫 Cancelar essa OS (aberta por engano)" que abre um formulário próprio (motivo +
  quem está cancelando), com confirmação nativa antes de enviar, chamando `cancelarOS()`.
- **`Historico.html`** (novo arquivo): tela só de leitura, com busca por texto, mostrando OS concluídas
  (verde) e canceladas (vermelho) com todos os detalhes relevantes e link pro PDF quando existir. Segue o
  mesmo padrão visual e os mesmos meta tags de "Adicionar à tela inicial" (PWA-lite) dos outros 3 arquivos
  do app.
- **`Menu.html`**: novo card "📜 Histórico", com borda neutra (`var(--text-muted)`), linkando pra
  `?tela=historico`.

## Passos manuais pra usuária

1. Na planilha de OS, adicionar uma coluna com o cabeçalho exato **"Técnico responsável"**.
2. No editor do Apps Script, criar um arquivo HTML novo chamado exatamente **`Historico`** e colar o
   conteúdo de `Historico.html`.
3. Reimplantar (Implantar → Gerenciar implantações → Nova versão).

Nenhuma outra mudança de configuração é necessária — a URL do app continua a mesma.
