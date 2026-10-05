# Painel Qualidade — Rotinas com frequência (semanal/quinzenal/mensal)

**Data:** 2026-10-05
**Status:** Implementado, aguardando teste da usuária em produção.

## Contexto

Pedido da usuária, logo depois de validar a correção do card único por rotina: "e eu quero criar rotinas
que não sejam diárias. Tenho coisas mensais pra fazer, semanais, quinzenais... entende?"

Esclarecido por pergunta: pra semanal/quinzenal, ela escolhe o **dia da semana**; pra mensal, o **dia do
mês**. Duas perguntas de acompanhamento (quando começa a contar a quinzenal, e se o card some ou fica
parado em "Concluído" entre ocorrências) foram dispensadas pela usuária — implementado com os padrões
abaixo, marcados como suposição, a corrigir se ela testar e não for isso.

## Decisões assumidas (sem resposta explícita da usuária — revisar se o teste não bater)

- **Quinzenal — início da contagem:** a 1ª ocorrência é a próxima data do dia da semana escolhido, a partir
  de hoje (dia do cadastro). Dali em diante, pula de 14 em 14 dias a partir dessa data-âncora — nunca de 7
  em 7.
- **Card entre ocorrências:** mesmo comportamento das rotinas diárias de hoje (ver
  `2026-10-01-painel-qualidade-rotinas-design.md`, correção de 05/10) — o card fica parado onde a usuária
  deixou (ex.: "Concluído") até chegar o próximo dia de resetar, não desaparece.

## Arquitetura

Reaproveita a estrutura de "1 card só por rotina, resetado no dia certo" já existente (ver
`2026-10-01-painel-qualidade-rotinas-design.md`) — a única mudança é **quando** um card é considerado
"vencido" e precisa resetar pra "A Fazer". Antes, isso era sempre "todo dia" (qualquer dia é dia de
ocorrência). Agora, depende da frequência da rotina.

### Novas colunas na aba ROTINAS (opcionais — sem elas, toda rotina continua DIARIA)

- **FREQUENCIA**: `DIARIA` (padrão) | `SEMANAL` | `QUINZENAL` | `MENSAL`.
- **DIA_SEMANA**: 0 (domingo) a 6 (sábado) — só usado quando `FREQUENCIA` é `SEMANAL` ou `QUINZENAL`.
- **DIA_MES**: 1 a 31 — só usado quando `FREQUENCIA` é `MENSAL`. Se o mês não tiver esse dia (ex.: 31 em
  abril), a ocorrência cai no último dia do mês.
- **REFERENCIA_QUINZENAL**: data (`dd/MM/yyyy`, como as outras datas desse projeto) — a 1ª ocorrência da
  rotina quinzenal, calculada automaticamente pelo servidor quando ela é criada (ou editada), não digitada
  pela usuária. É a âncora que define quais semanas "contam".

### Cálculo da próxima ocorrência (`avisos-appscript/Code.gs`)

Funções novas, antes de `gerarCardsRotinasDoDia()`:

- `proximaDataComDiaSemana_(apartirDe, diaSemana)` — menor data ≥ `apartirDe` com aquele dia da semana
  (olha os próximos 7 dias).
- `proximaDataComDiaMes_(apartirDe, diaMes)` — menor data ≥ `apartirDe` com aquele dia do mês, já tratando
  o caso do mês não ter esse dia (usa o último dia do mês naquele caso).
- `proximaDataQuinzenal_(apartirDe, referencia)` — menor data ≥ `apartirDe` que seja a referência + um
  múltiplo de 14 dias.
- `proximaOcorrenciaRotina_(rotina, apartirDe)` — escolhe uma das três acima conforme `rotina.frequencia`;
  `DIARIA` (ou frequência vazia/desconhecida, compatível com rotina antiga) devolve a própria `apartirDe`
  (toda data é ocorrência).

### Mudança em `gerarCardsRotinasDoDia()`

Antes, a decisão de resetar um card de rotina pra "A Fazer" era simplesmente "a última vez que foi tratada
não é hoje". Agora:

1. Se a última vez que foi tratada **já é hoje**, não mexe (igual antes).
2. Senão, calcula a **próxima ocorrência esperada** a partir do dia seguinte à última vez tratada
   (`proximaOcorrenciaRotina_`). Se essa data já chegou ou passou (≤ hoje), reseta o card pra "A Fazer" e
   marca a data de hoje como "tratada".
3. Senão (a próxima ocorrência ainda é no futuro), não mexe — o card continua onde está.

Usar "a próxima ocorrência a partir do dia seguinte à última tratada" (em vez de checar só "hoje é
exatamente o dia X") cobre o caso de a usuária abrir o Painel **depois** do dia certo — ex.: rotina semanal
de terça-feira, ela só abre o Painel na sexta: o reset acontece na sexta (primeira vez que abre depois do
dia vencido), não fica esperando a terça da semana seguinte pra resetar.

Mesma lógica vale pra quando a rotina ainda **nunca gerou card nenhum** (cadastro novo): só cria o
primeiro card quando a 1ª ocorrência dela já chegou — uma rotina semanal/mensal cadastrada hoje pode não
aparecer no Quadro imediatamente, só no dia certo.

### `criarRotina`/`editarRotina`

Ganham 3 parâmetros novos: `frequencia`, `diaSemana`, `diaMes` (todos opcionais — sem eles, cai em
`DIARIA`). Ao salvar como `QUINZENAL`, a referência (`REFERENCIA_QUINZENAL`) é **sempre recalculada a
partir de hoje** (próxima ocorrência do dia da semana escolhido) — tanto na criação quanto em qualquer
edição seguinte. Decisão deliberada pra simplificar: editar uma rotina quinzenal reinicia a contagem de
"semana sim, semana não" a partir da data da edição, em vez de tentar preservar o ciclo anterior. Efeito
pra usuária: se ela editar outra coisa (ex.: só o nome) numa rotina quinzenal, a contagem reinicia também —
aceitável pra esse app, não foi guardrail explícito.

## Frontend (`Kanban.html`)

- Modal de criar/editar rotina ganha um campo **"Repete"** (select: Todo dia / Toda semana, num dia fixo /
  A cada 2 semanas, num dia fixo / Todo mês, num dia fixo).
- Selecionando "semana" ou "quinzena", aparece um seletor de **dia da semana** (botões Dom/Seg/Ter/.../Sáb,
  mesmo padrão visual das etiquetas do Kanban — um selecionado por vez).
- Selecionando "mês", aparece um campo numérico de **dia do mês** (1-31).
- Na lista de rotinas cadastradas, cada uma mostra a frequência embaixo do nome (ex.: "Semanal · Terça",
  "Mensal · dia 5", "Diária").
- Texto de ajuda da aba Rotinas atualizado (não fala mais só em "todo dia").

## O que NÃO foi feito (fora do pedido)

- Sem opção de "vários dias da semana" por rotina (ex.: segunda E quinta) — só 1 dia fixo, não foi pedido.
- Sem campo pra editar a `REFERENCIA_QUINZENAL` manualmente — é sempre calculada pelo servidor.
- Sem indicação visual no card do Kanban de qual é a frequência da rotina (só o 🔁 de sempre) — não foi
  pedido, e a aba Rotinas já mostra isso pra quem cadastra.

## Passos manuais pra usuária

1. Na aba **ROTINAS** já existente, adicionar 4 colunas no cabeçalho (qualquer posição): **FREQUENCIA**,
   **DIA_SEMANA**, **DIA_MES**, **REFERENCIA_QUINZENAL**. Rotinas já cadastradas continuam funcionando
   sem preencher nada nelas (ficam `DIARIA`, igual antes).
2. Colar `Code.gs` do `avisos-appscript` por cima do existente e reimplantar.
3. Colar `Kanban.html` por cima do existente no Painel Qualidade e reimplantar.
4. Testar: cadastrar uma rotina semanal, uma quinzenal e uma mensal, e conferir se o campo de dia aparece
   certo conforme a frequência escolhida.
