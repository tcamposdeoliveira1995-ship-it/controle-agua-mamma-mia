# Painel Qualidade — Valor das Contas de Água (por relógio, por mês)

**Data:** 2026-10-05
**Status:** Implementado, aguardando teste da usuária em produção.

## Contexto

Pedido da usuária: "quero incluir no controle de água o valor das contas, por relógio." Esclarecido por
perguntas:

- **Lançamento manual** — a usuária digita o valor quando a conta chega, um por relógio. Não é calculado a
  partir do consumo (tarifa com taxa fixa/faixa de preço não dá pra calcular certo só multiplicando
  m³ × preço).
- **Tela própria no Painel Qualidade** — igual Caminhão Pipa/Higienização de Motores, não pelo Telegram.
- **Também aparece no Mamma Mia Control**, junto do consumo — combinado que entra numa 2ª etapa, depois
  dessa tela validada (ver "Próximo passo" no fim).

A usuária já tinha criado a aba na planilha antes de eu perguntar: **VALOR CONTAS**, cabeçalho
`MES | RELOGIO | VALOR | | TOTAL MES` (com uma coluna em branco entre VALOR e TOTAL MES), pedindo que
"some a competência".

## Arquitetura

Mesmo projeto único (`avisos-appscript/Code.gs`, serve também o Painel Qualidade — ver comentário no topo
do arquivo) — 2 ações novas, 1 aba nova na mesma planilha de água.

### Aba VALOR CONTAS

- **MES**: sempre `"MM/yyyy"` (ex.: `"10/2026"`) — é a competência da conta (o mês a que ela se refere), não
  a data em que foi lançada no sistema.
- **RELOGIO**: o código do relógio, igual já aparece nos cabeçalhos da aba de leituras (ex.: `"Y21T156506"`).
- **VALOR**: número, em reais.
- **TOTAL MES**: preenchido sozinho pelo código (não é fórmula manual) — soma de todos os relógios daquele
  MES, regravada em toda linha daquele mês toda vez que um lançamento novo entra ou um existente é
  corrigido.

### Relógios — lista dinâmica, não cadastrada no código

`listarRelogios()` lê os cabeçalhos da aba "Respostas ao formulário 1" (a mesma de sempre, de onde vêm as
leituras) e devolve todos os nomes de coluna, exceto "Carimbo de data/hora" — mesma ideia já usada em
`processarRegistroTelegram()` pra achar a coluna de 1 relógio, só que aqui devolve a lista inteira. Evita
cadastrar os códigos dos relógios duas vezes (uma na leitura, outra aqui) — se um relógio for trocado/
adicionado só mudando o cabeçalho da aba de leituras, já aparece aqui também, sem mexer em código.

### Lançamento — upsert por MES+RELOGIO

`registrarContaAgua(mes, relogio, valor)`: procura uma linha já existente com esse MES+RELOGIO — se achar,
**atualiza** o VALOR (corrige sem duplicar linha); se não achar, cria uma nova. Depois, recalcula e grava o
TOTAL MES em **todas** as linhas daquele mês (não só a que acabou de mudar), pra manter todas em dia mesmo
se o lançamento for retroativo ou fora de ordem.

### Novas ações

- `GET ?dados=relogios` → `{ ok, relogios: [...] }`
- `GET ?dados=contas_agua` → `{ ok, contas: [{mes, relogio, valor, totalMes}, ...] }`, mais recente primeiro.
- `POST {acao: "registrar_conta_agua", mes, relogio, valor}` → upsert.

### Nova rota de tela

`?tela=contas` → `ContasAgua.html`, com `XFrameOptionsMode.ALLOWALL` (mesmo padrão de todo módulo embutido
no iframe do Menu).

## Frontend (`ContasAgua.html`, novo arquivo)

Mesmo estilo visual dos outros módulos (Pipa, Higienização):

- Formulário: **Mês da conta** (`<input type="month">`, convertido de `"yyyy-MM"` pra `"MM/yyyy"` antes de
  mandar pro servidor), **Relógio** (`<select>`, populado via `?dados=relogios`), **Valor** (R$, numérico).
- Lista de lançamentos já feitos (`?dados=contas_agua`), tabela com Mês | Relógio | Valor | Total do mês —
  mais recente primeiro.
- Item novo "💧 Valor das Contas" na barra lateral do Menu, entre Higienização de Motores e os links
  externos (Refeitório/VTO).

## Correção de bônus — URL de dados desatualizada

Durante essa mesma sessão, uma instabilidade grande no Painel Qualidade levou à criação de uma implantação
NOVA do projeto (ver `2026-10-01-painel-qualidade-rotinas-design.md` e os commits de 05/10/2026 sobre
"implantação travada"). O `src/main.js` (Mamma Mia Control) ainda apontava pra implantação antiga
(`AVISOS_EXEC_URL`) — corrigido junto, pra os Avisos nesse painel pararem de falhar silenciosamente.

## O que NÃO foi feito (fora do pedido / fica pra depois)

- **Valor da conta no Mamma Mia Control** — combinado como 2ª etapa. `src/main.js` é um arquivo grande
  (mais de 4000 linhas) com um pipeline de cálculo de ciclo próprio (`renderIndividualMeterCards`,
  `calculateConsumptions` etc.) que não necessariamente alinha com o mês civil usado em VALOR CONTAS (o
  ciclo de faturamento da água começa num dia configurável, não no dia 1) — antes de mexer nisso, preciso
  confirmar com a usuária exatamente onde/como ela quer ver o valor (ex.: no card de cada relógio, mostrando
  o mês mais recente lançado) pra não arriscar quebrar o painel que ela já usa todo dia, no mesmo dia em que
  uma implantação travada já causou bastante dor de cabeça.
- Sem edição/exclusão de lançamento pela tela — só upsert lançando de novo o mesmo mês+relógio (corrige o
  valor). Apagar de vez, se precisar, é direto na planilha.

## Passos manuais pra usuária

1. Confirmar que a aba **VALOR CONTAS** já tem o cabeçalho exatamente `MES | RELOGIO | VALOR | | TOTAL MES`
   (coluna em branco entre VALOR e TOTAL MES) — ela já criou essa aba antes do pedido.
2. Colar `Code.gs` do `avisos-appscript` por cima do existente e reimplantar.
3. Colar `ContasAgua.html` (arquivo novo — criar um arquivo HTML com esse nome exato no projeto) e
   `Menu.html` por cima do existente, e reimplantar de novo.
4. Colar `src/main.js` (correção da URL de Avisos) no repositório do Mamma Mia Control e publicar.
5. Testar: abrir "💧 Valor das Contas" no Painel, lançar um valor de teste, conferir se aparece na lista com
   o total do mês certo.
