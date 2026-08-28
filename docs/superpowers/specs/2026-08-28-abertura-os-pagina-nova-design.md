# Abrir OS pela página nova (substituindo o Google Forms)

## Problema

Hoje, abrir uma Ordem de Serviço (OS) é feito por um Google Forms nativo. O
formulário funciona, mas tem uma experiência ruim no celular (visual genérico
do Forms, exige login Google pra anexar foto) e o dono do negócio pediu pra
deixar a abertura de OS no mesmo padrão visual da página de fechamento de OS
que já existe (`manutencao-appsscript/Index.html`), construída numa sessão
anterior.

## Objetivo

Criar uma segunda tela dentro do mesmo Web App de manutenção — visualmente
consistente com a tela de fechamento — pra qualquer colaborador reportar um
problema (abrir uma OS) direto do celular, sem passar pelo Google Forms.

## Contexto existente relevante

O `Code.gs` real (colado pelo usuário) tem hoje:

- `onFormSubmit(e)`: dispara quando o Forms é enviado. **Não usa o objeto de
  evento `e` em nenhum momento** — ele relê a própria planilha (`sheet =
  getSheets()[0]`, `lastRow = sheet.getLastRow()`) pra descobrir os dados da
  resposta recém-adicionada. Isso importa: significa que basta adicionar uma
  linha na planilha com os campos certos e chamar `onFormSubmit()` sem
  argumentos — ele mesmo:
  - Gera o número da OS (`OS-YYYYMMDD-NNN`, onde NNN = `lastRow - 1`);
  - Define `STATUS = "Aberto"` e `PRIORIDADE = Gravidade` (com fallback pra
    `"Baixa"`);
  - Cria o card no Trello (`criarCardOSNoTrello`) e grava o `TRELLO_CARD_ID`;
  - Gera o PDF de abertura (`gerarPDFOS`) e grava o `PDF_OS`;
  - Envia o aviso no Telegram (`enviarTelegramOSAberta`), com foto anexada
    quando houver.
  - Cada uma dessas três etapas já é isolada em try/catch própria — uma
    falha em uma não impede as outras, e falhas viram aviso de erro no
    Telegram (`enviarErroTelegram`), sem interromper a abertura da OS.

- Cabeçalhos reais da planilha (linha 1, confirmados pelo usuário), na
  ordem: `Timestamp, OS, STATUS, PRIORIDADE, TRELLO_CARD_ID, Nome do
  solicitante, UNIDADE, Data e hora da ocorrência, Tipo de ocorrência,
  Equipamento ou local afetado, Código/Tag do equipamento, O que está
  acontecendo?, O equipamento parou totalmente?, Impacto na produção,
  Gravidade, Observações adicionais, Setor, Foto do problema, PDF_OS, O que
  foi feito, Data de conclusão, Assinado por, Foto da conclusão, PDF
  Fechamento`.

- **Achado colateral (fora do escopo deste projeto, só registrado):**
  `obterMapaColunas` mapeia `setor` para o cabeçalho `"Setor"` (a pergunta
  de área/departamento: Produção, Cozinha, Limpeza...). A pergunta
  `"UNIDADE"` (TC/YUKA/DS) não é lida por nenhuma função hoje — nem
  automação, nem o dashboard web (que foi ajustado numa sessão anterior
  achando que "Setor" e "Unidade" eram a mesma coisa). Ou seja, o dashboard
  hoje mostra os valores de `Setor` numa coluna rotulada "Unidade". Não será
  corrigido aqui — fica registrado pra um ajuste futuro se o usuário quiser.

- Perguntas e opções reais do Forms (confirmadas por print do usuário):
  - Nome do solicitante — texto livre, obrigatório
  - UNIDADE — TC / YUKA / DS, obrigatório
  - Setor — Produção / Cozinha / Limpeza / Manutenção / Outro (mais 1-2
    opções não totalmente legíveis no print — serão tratadas como "Outro"
    editável se necessário), obrigatório
  - Data e hora da ocorrência — obrigatório
  - Tipo de ocorrência — Equipamento / Estrutura / Elétrica / Hidráulica /
    Outro, obrigatório
  - Equipamento ou local afetado — texto livre, obrigatório
  - Código/Tag do equipamento — "Não possui" ou "Outro" (com campo de texto
    revelado), obrigatório
  - O que está acontecendo? — texto livre, obrigatório
  - O equipamento parou totalmente? — Sim / Não / Parcialmente, obrigatório
  - Impacto na produção — 3 opções (texto exato incerto pelo print, será
    aproximado; não afeta nenhuma lógica de automação, é só concatenado em
    texto livre no Trello/PDF/Telegram), obrigatório
  - Gravidade — Crítica / Alta / Média / Baixa, obrigatório (essas 4 opções
    batem exatamente com `ORDEM_PRIORIDADE` no Code.gs — crítico manter
    exatas, pois viram a `PRIORIDADE` da OS)
  - Observações adicionais — texto livre, opcional
  - Foto do problema — upload de imagem, opcional

## Arquitetura

Mesmo projeto Apps Script já usado pelo fechamento de OS. Duas mudanças:

1. **`doGet(e)` passa a servir duas telas pela mesma URL**, via parâmetro de
   query:
   - `.../exec` (sem parâmetro) → continua servindo `Index.html` (fechar OS),
     **sem mudar o link que os técnicos já salvaram na tela inicial**.
   - `.../exec?tela=abrir` → serve um novo arquivo `AbrirOS.html`.

2. **`obterMapaColunas` ganha uma chave nova**: `unidade: getColumnIndexByHeader(sheet, "UNIDADE")` — necessária pra gravar a coluna
   `UNIDADE` na hora de abrir a OS pela página nova (hoje nenhuma função
   grava essa coluna via código, só o Forms grava direto).

Não haverá um segundo deployment nem uma segunda URL pra compartilhar — é o
mesmo Web App, mesmo "Implantar > Gerenciar implantações > Nova versão" de
sempre.

## Fluxo de dados

1. Colaborador abre `.../exec?tela=abrir`, preenche o formulário na tela.
2. Ao confirmar, o cliente (JS do `AbrirOS.html`) lê a foto (se houver) como
   base64 (mesmo padrão do `Index.html` atual) e chama
   `google.script.run.abrirOS(dados)`.
3. `abrirOS(dados)` no servidor:
   - Valida os campos obrigatórios (mesma lista de required do Forms) —
     erros aqui **propagam pro cliente** via `withFailureHandler`, igual o
     `fecharOS` já faz hoje.
   - Se houver foto, salva no mesmo Drive usado pelos PDFs de OS
     (`PASTA_ANEXOS_OS`) via uma função nova `salvarFotoAbertura`, mesmo
     padrão de `salvarFotoConclusao`.
   - Monta uma linha completa (tamanho = `sheet.getLastColumn()`) usando os
     índices de `obterMapaColunas`, preenchendo todos os campos exceto `OS`,
     `STATUS`, `PRIORIDADE`, `TRELLO_CARD_ID` e `PDF_OS` (esses ficam em
     branco — são preenchidos pelo próprio `onFormSubmit`).
   - `sheet.appendRow(linha)`.
   - Chama `onFormSubmit()` — sem argumentos, reaproveitando 100% da
     automação existente (Trello, PDF, Telegram) sem duplicar nenhuma
     lógica.
   - Relê a célula `OS` da linha recém-criada (já preenchida pelo
     `onFormSubmit`) e retorna `{ ok: true, os: numeroDaOS }` pro cliente.
4. Tela de sucesso mostra o número da OS gerada, e depois de ~2s volta pro
   formulário limpo (mesma UX do "voltar pra lista" do fechamento).

## Componentes

- **`AbrirOS.html`** (novo arquivo no projeto Apps Script): mesma paleta e
  classes CSS de `Index.html` (`--bg`, `--card-bg`, `.form-secao`, `.btn`,
  `.btn-foto`, `.alerta`, `.sucesso`) pra manter consistência visual total.
  Cabeçalho troca o texto pra "📋 Abrir Ordem de Serviço" (mesmo estilo de
  barra escura). Formulário único (sem lista prévia, diferente do
  fechamento que lista OS abertas) com os 13 campos na mesma ordem do
  Forms.
- **`abrirOS(dados)`** (novo, `Code.additions.gs`): validação + upload de
  foto + `appendRow` + `onFormSubmit()` + retorno do número da OS.
- **`salvarFotoAbertura(fotoBase64, mimeType)`** (novo): mesmo padrão de
  `salvarFotoConclusao`, mas foto é opcional (retorna `""` se não houver).
- **`obterMapaColunas`** (substituição, +1 chave: `unidade`).
- **`doGet(e)`** (substituição): branch por `e.parameter.tela`.

## Tratamento de erros

- Campos obrigatórios faltando → erro claro no cliente, nada é gravado na
  planilha (validação acontece antes do `appendRow`).
- Falha ao subir a foto → propaga como erro pro cliente (a OS não é aberta
  "pela metade" sem o restante dos dados); diferente do fechamento, aqui a
  foto é opcional, então esse erro só ocorre se o navegador falhar ao ler o
  arquivo já escolhido.
- Falha em Trello, PDF ou Telegram **depois** do `appendRow` → já é tratada
  pelo `onFormSubmit` existente (isolada por try/catch, avisa por Telegram,
  não desfaz a OS). O usuário na tela sempre vê "OS aberta com sucesso",
  mesmo que uma dessas três falhe — mesmo comportamento que já existe hoje
  quando o Forms é usado.

## Fora de escopo

- Corrigir a confusão `UNIDADE` vs `Setor` no dashboard web (registrado
  acima, não faz parte desta mudança).
- Desativar ou remover o Google Forms — continua existindo como estava; só
  deixamos de indicá-lo no manual da equipe.
- Confirmação exata de texto das opções de "Setor" e "Impacto na produção"
  além do que foi lido no print — não afeta nenhuma lógica de automação,
  só cosmético; pode ser ajustado depois se o usuário notar divergência.
