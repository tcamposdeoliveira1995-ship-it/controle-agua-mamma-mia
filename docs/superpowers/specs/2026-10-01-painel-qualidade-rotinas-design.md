# Painel Qualidade — Rotinas gerando card diário no Kanban

**Data:** 2026-10-01
**Status:** Implementado, aguardando teste da usuária em produção da 2ª correção de duplicação (05/10/2026 —
ver última seção). **ATENÇÃO:** o desenho original deste documento (checklist com caixinha de marcar,
abaixo) foi SUBSTITUÍDO no dia seguinte — ver a seção "Correção/complemento — Rotina vira card no Kanban"
no fim, que é a versão que está valendo. O corpo do documento foi mantido pra contexto histórico (por que a
1ª versão foi desenhada daquele jeito), mas não reflete mais o código atual sozinho — leia as correções
também, inclusive a última, que muda de novo como `gerarCardsRotinasDoDia()` funciona.

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

## Correção/complemento — Horário por rotina (01/10/2026)

Depois de validado, a usuária pediu "quero definir horário" pra cada rotina. Esclarecido: só informativo
(ordenar a lista), sem alerta/notificação na hora certa — diferente do alerta sonoro de OS nova já usado
em `manutencao-appsscript/Menu.html`, que exige a tela aberta no navegador pra funcionar; um alerta por
horário teria a mesma limitação (não dispara se a tela não estiver aberta naquele minuto exato), então foi
descartado por enquanto.

- **Nova coluna opcional `HORARIO`** na aba ROTINAS (formato `HH:MM`, ex.: `08:00`) — opcional de verdade:
  se a coluna não existir na planilha, o backend não quebra, só trata toda rotina como sem horário (mesmo
  padrão de coluna opcional já usado em `main.js` pra `KG_CRU`/`INGREDIENTE`).
- **Ordenação**: rotinas COM horário vêm primeiro, da mais cedo pra mais tarde; rotinas SEM horário ficam
  no fim, na ordem em que foram criadas entre si.
- Campo `<input type="time">` no modal de criar/editar rotina — mesmo estilo visual dos outros campos.
- Na lista, o horário aparece em destaque (cor dourada) antes do nome: "**08:00** · Leitura da Água".

### Passo manual adicional

Na aba ROTINAS já criada, adicionar a coluna **HORARIO** no cabeçalho (qualquer posição — a leitura é por
nome da coluna, não pela posição). Não precisa recriar a aba nem preencher horário em rotinas já
cadastradas (ficam sem horário até serem editadas).

## Correção/complemento — Rotina vira card no Kanban (01/10/2026, mesmo dia)

Depois de testar o checklist com caixinha, a usuária pediu outra coisa: "Quero que esse checklist apareça
no Kanban. Como não dei baixa em nada, eles estão parados, lá entende. Quando eu cadastrar rotina, ela
diariamente vai para o Kanban sem eu precisar ficar olhando checklist." Esclarecido por perguntas:

- **O checklist (caixinha de marcar) sai** — substituído completamente pelos cards do Kanban. Não ficam os
  dois juntos.
- **Se o card de ontem de uma rotina não foi movido pra "Concluído"**, hoje ganha um card novo mesmo assim
  (o de ontem continua lá, parado, como lembrete do que ficou pra trás — não trava a rotina de aparecer
  nos dias seguintes).

### O que muda na arquitetura

- **ROTINAS continua existindo**, mas muda de papel: deixa de ser "a lista que a usuária marca" e vira só o
  **molde** (texto, horário, ordem, ativa) — de onde um card de verdade é gerado todo dia.
- **ROTINA_MARCACOES é removida.** Não existe mais "marcar"/"desmarcar" — o estado de "feito" passa a ser o
  próprio card estar (ou não) na coluna "Concluído" do Kanban, igual qualquer outro card. As funções
  `marcarRotina`/`desmarcarRotina`/`obterAbaRotinaMarcacoes` foram apagadas do `Code.gs` (não só
  desativadas) — código morto não fica pra trás.
- **KANBAN ganha 2 colunas novas, opcionais**: `ROTINA_ID` (qual rotina gerou esse card — vazio pra card
  criado manualmente) e `DATA_ROTINA` (o dia — `dd/MM/yyyy` — pro qual esse card de rotina é). É esse par
  que permite checar "a rotina X já tem card de hoje?" sem duplicar.
- **Nenhum gatilho/trigger agendado.** Em vez de uma function rodando sozinha à meia-noite (mais
  configuração manual pra usuária, mais um ponto de falha se o Apps Script não acordar), a geração roda
  **dentro de `listarCards()`**, chamada toda vez que a aba Quadro é aberta: `gerarCardsRotinasDoDia()`
  olha as rotinas ativas, verifica quais já têm card com `DATA_ROTINA = hoje`, e cria o que faltar — direto
  na coluna "A Fazer", no fim da lista (`ORDEM` = maior já usada em "A Fazer" + 1). Idempotente: abrir a
  tela 10 vezes no mesmo dia não gera 10 cards.
- **ROTINA_ID/DATA_ROTINA são opcionais** (mesmo padrão de todas as colunas novas deste projeto): se
  qualquer uma não existir ainda na planilha, `gerarCardsRotinasDoDia()` simplesmente não faz nada — o
  Kanban continua funcionando normalmente pra cards manuais, só sem os cards de rotina até a coluna ser
  criada.

### Frontend

- A aba (antes "✅ Checklist Diário") vira **"🔁 Rotinas"** — só cadastro (criar/editar/excluir o molde,
  com horário opcional), sem caixinha de marcar nenhuma.
- Um aviso fixo no topo dessa aba explica o novo comportamento: *"Toda rotina cadastrada aqui vira um card
  🔁 sozinho, todo dia, na coluna 'A Fazer' do Quadro."*
- No Quadro, um card gerado a partir de rotina é identificado com um emoji 🔁 antes do título (ex.: "🔁
  Leitura da Água"), pra diferenciar de cards criados manualmente — sem precisar abrir o card pra saber a
  origem.

### Por que não precisa mais da seção "Como o reset diário funciona" do corpo original

Aquela lógica (marcação por data, sem job de reset) resolvia "desmarcar sozinho a caixinha". Esse
problema nem existe mais: não há caixinha. O card de hoje simplesmente nasce na coluna "A Fazer" — "ainda
não feito" É o estado em que ele nasce, não algo que precisa ser resetado.

### Passos manuais pra usuária (substituem os do corpo original)

1. Na aba **KANBAN** já existente, adicionar 2 colunas no cabeçalho: **ROTINA_ID** e **DATA_ROTINA**
   (qualquer posição).
2. Se a aba **ROTINA_MARCACOES** existir (da instalação anterior, mesmo dia), pode apagar — não é mais
   usada por nada.
3. Colar `Code.gs` do `avisos-appscript` por cima do existente e reimplantar.
4. Colar `Kanban.html` e `Code.gs` do Painel Qualidade por cima dos existentes e reimplantar.
5. Abrir a aba "🔁 Rotinas" — as rotinas já cadastradas continuam lá (só perderam a marcação de hoje, que
   não existe mais); abrir a aba "📋 Quadro" já deve mostrar um card novo pra cada uma, na coluna "A
   Fazer".

## Correção — bug de duplicação (02/10/2026)

Reportado pela usuária logo após testar: cada rotina aparecia com 2 cards duplicados no Quadro ("Não move
e parece ter duplicado" — o "não move" era ilusão: mover UM dos 2 duplicados de verdade funcionava, mas o
outro, idêntico, continuava parado em "A Fazer", parecendo que nada tinha acontecido).

**Causa raiz:** o Google Sheets converte sozinho qualquer texto que pareça uma data (ex.: `"02/10/2026"`)
pra um objeto `Date` de verdade ao gravar a célula — mesmo escrito via `appendRow`/`setValue` pelo código,
não só digitado à mão na planilha. `gerarCardsRotinasDoDia()` gravava `DATA_ROTINA` como essa string, mas
a comparação seguinte (`"já existe card de hoje?"`) comparava contra o texto original — e como a célula
tinha virado `Date`, a comparação nunca batia. Resultado: toda vez que o Kanban era aberto no mesmo dia,
a função achava que nenhuma rotina tinha card ainda e criava um novo pra cada uma.

**Correção** em `gerarCardsRotinasDoDia()` (`avisos-appscript/Code.gs`):
- Nova função `paraDataBR(valorCelula)` — normaliza a leitura: se a célula virou `Date` (o problema),
  reformata de volta pra `"dd/MM/yyyy"` antes de comparar; se já é texto, usa direto. Mesma ideia já usada
  em `processarRegistroTelegram()` (leitura de água), que sempre fez `new Date(celData)` antes de comparar,
  por este mesmo motivo.
- Depois de gravar cada card novo, força a célula de `DATA_ROTINA` a ficar como **texto puro**
  (`setNumberFormat("@")`) — evita a conversão automática acontecer de novo nos próximos cards.

**Limpeza dos duplicados já criados pelo bug:** nova função `limparCardsRotinaDuplicados()`, pra rodar
**1 VEZ SÓ, manualmente**, direto no editor do Apps Script (selecionar a função no menu "Selecionar
função" do topo e clicar em ▶ Executar) — agrupa os cards por rotina+dia e mantém só 1 de cada grupo,
preferindo o que já foi movido pra fora de "A Fazer" (representa o que a usuária já tinha de fato
começado a mexer) e, se nenhum saiu de lá, o primeiro criado.

### Passo manual adicional

Depois de colar o `Code.gs` novo do `avisos-appscript` e reimplantar, abrir o editor do Apps Script,
selecionar **`limparCardsRotinaDuplicados`** no menu de funções e clicar em ▶ Executar — uma vez só.

## Correção — rotina com 1 card só, resetando sozinho todo dia (05/10/2026)

A correção de 02/10/2026 (acima) resolveu o bug de duas linhas criadas no MESMO dia pela mesma rotina —
mas não era o problema todo. Reportado de novo pela usuária, com print do Quadro cheio de cards repetidos
("Meu painel da Qualidade, está duplicando as coisas"): investigando, a causa era o próprio
**comportamento pretendido** da versão de 01/10/2026 de `gerarCardsRotinasDoDia()` — ela só CRIAVA um card
novo quando não achava um com `DATA_ROTINA = hoje`, mas nunca reaproveitava ou apagava os de dias
anteriores. Então cada rotina foi literalmente acumulando 1 card por dia: um em "A Fazer" todo dia em que
não foi movida, e mais um em "Concluído" a cada dia em que foi. Visualmente eram cards idênticos (o card
não mostra a data em que foi gerado), por isso pareciam duplicados.

Esclarecido com a usuária o comportamento esperado: *"Deve aparecer hj no a fazer, eu vou mover para
concluído, e só amanhã voltar pro A fazer, não ficar criando novos."* — ou seja, cada rotina deveria ter
**1 card só, sempre**, que é reaproveitado e resetado pra "A Fazer" a cada novo dia, não um card novo por
dia.

### O que muda em `gerarCardsRotinasDoDia()`

Antes: pra cada rotina, procurava uma linha com `DATA_ROTINA = hoje`; se não achava, **criava uma linha
nova** (deixando as de dias anteriores intactas, acumulando pra sempre).

Agora: pra cada rotina, procura a (no máximo 1) linha já existente dela, independente da data:
- **Não existe nenhuma ainda** → cria a primeira, em "A Fazer" (igual antes).
- **Existe e `DATA_ROTINA` já é hoje** → não mexe, fica onde a usuária colocou (ela pode ter movido pra
  "Em Andamento" ou "Concluído" hoje mesmo — não desfaz esse progresso).
- **Existe mas `DATA_ROTINA` não é hoje** (dia novo) → a MESMA linha é reaproveitada: coluna volta pra "A
  Fazer" (não importa se estava em "Concluído", "Em Andamento", ou ainda parada em "A Fazer" de um dia que
  não foi mexida) e `DATA_ROTINA` é atualizada pra hoje. Nenhuma linha nova é criada.

Resultado: cada rotina ativa tem sempre exatamente 1 linha/card no KANBAN, que "viaja" entre as colunas e
volta pra "A Fazer" sozinho a cada novo dia — nunca mais que 1 por rotina.

### Limpeza dos cards já acumulados

Nova função `consolidarCardsRotinaUnica()` (`avisos-appscript/Code.gs`), **EXECUTAR 1 VEZ SÓ** manualmente
pelo editor do Apps Script — pra cada `ROTINA_ID` com mais de 1 linha no KANBAN, mantém só a de
`DATA_ROTINA` mais recente e apaga as outras. Depois de rodar, a próxima abertura do Quadro já reseta
sozinha pra "A Fazer" quem não for de hoje (pela `gerarCardsRotinasDoDia()` corrigida) — não precisa fazer
nada manual além de rodar essa função uma vez. Idempotente (rodar de novo sem duplicata não apaga nada).

A função antiga `limparCardsRotinaDuplicados()` (da correção de 02/10/2026) foi removida do código — ela
resolvia um caso particular (duplicata no mesmo dia) que `consolidarCardsRotinaUnica()` já cobre por
completo (junto com o caso de dias diferentes), então ficou redundante.

### Passos manuais pra usuária

1. Colar `Code.gs` do `avisos-appscript` por cima do existente e reimplantar.
2. Abrir o editor do Apps Script, selecionar **`consolidarCardsRotinaUnica`** no menu de funções e clicar
   em ▶ Executar — uma vez só. Autorizar se pedir.
3. Abrir o Quadro — cada rotina deve aparecer com só 1 card agora.
