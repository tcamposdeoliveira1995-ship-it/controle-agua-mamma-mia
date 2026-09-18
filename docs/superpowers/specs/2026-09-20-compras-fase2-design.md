# Módulo Compras — Fase 2 (histórico/timeline + alertas automáticos)

**Data:** 2026-09-20
**Status:** Implementado e validado em produção (histórico e alertas testados de ponta a ponta — bot do Telegram dedicado pra Compras, não o mesmo de Água/OS como o spec original previa)

## Contexto

Segunda fase do módulo Compras (ver `2026-09-18-compras-fase1-design.md`, já implementado e validado em
produção). Cobre as duas partes que ficaram fora da Fase 1 por dependerem de mais tempo de uso:

1. Ficha de histórico/timeline por compra — ver as mudanças de status ao longo do tempo.
2. Alertas automáticos via Telegram — entregas atrasadas e reembolsos pendentes.

Dashboard gerencial com gráficos (Fase 3) e integração com OS (Fase 4) continuam fora de escopo.

## 1. Histórico / Timeline

**O que registra:** só mudanças de **Status da compra** — não qualquer edição de campo. Cada entrada tem
timestamp + o status pro qual mudou (ex.: "18/09 09:32 — 🟣 Solicitação registrada", "18/09 10:45 —
🛒 Comprado"). A criação de uma compra já grava a primeira entrada, com o status escolhido no momento de
criar.

**Onde mora:** nova aba `COMPRAS_HISTORICO`, na mesma planilha do módulo (colunas: `ID_COMPRA`,
`TIMESTAMP`, `STATUS`). Um registro por mudança — não sobrescreve, só acrescenta.

**Como grava:** `registrarCompra` grava a primeira entrada logo após criar a linha em COMPRAS.
`editarCompra` só grava uma entrada nova quando o `STATUS COMPRA` enviado for **diferente** do que já
estava na linha antes da edição (comparação feita antes de sobrescrever) — editar outros campos sem tocar
no status não gera entrada.

**Como aparece no painel:** sem CSV novo pra publicar — ao abrir o formulário de editar uma compra
(`comprasAbrirModal`), o painel já pede o histórico direto ao Apps Script via `doPost`
(`{acao: "historico", id}`, resposta `{ok: true, historico: [{status, timestamp}, ...]}`, mais antigo
primeiro) e mostra como uma lista no topo do formulário, antes dos campos editáveis. Compra sem nenhuma
entrada (não deveria acontecer, já que a criação sempre grava uma) mostra "Sem histórico ainda" em vez de
lista vazia.

## 2. Alertas automáticos (Telegram)

**Quando roda:** 1x por dia, 8h da manhã — trigger de tempo configurado uma única vez rodando
`configurarAlertasCompras()` no editor do Apps Script (mesmo padrão de `configurarPollingTelegram` do bot
de água: remove qualquer trigger antigo da mesma função antes de criar um novo, pra nunca duplicar).

**Pra onde manda:** o mesmo chat/bot do Telegram que já recebe os alertas de Água/OS — reaproveita
`TELEGRAM_TOKEN`/`TELEGRAM_CHAT_ID` que a usuária já tem configurado em outro projeto; ela só copia esses
dois valores pras Propriedades do Script (Configurações do projeto) do `compras-appsscript`. Uma função
`testarTelegram()` (mesmo nome/padrão já usado no bot de água) manda uma mensagem de teste isolada, pra
validar o token/chat antes de depender do trigger diário.

**O que verifica, todo dia:**
- 🚨 **Entregas atrasadas** — `PREVISÃO ENTREGA` já passou E `STATUS COMPRA` não é `✅ Entregue` nem
  `❌ Cancelado`.
- 💰 **Reembolsos pendentes** — `REEMBOLSO NECESSÁRIO` = Sim E `STATUS REEMBOLSO` ≠ `Reembolsado`
  (Pendente ou Solicitado) — mostra há quantos dias, contados a partir de `DATA COMPRA` (ou
  `DATA SOLICITAÇÃO` se a compra ainda não tiver data de compra).

**Formato:** uma mensagem só por dia, juntando as duas listas (exemplo):
```
📦 Resumo diário de Compras — 18/09

🚨 Entregas atrasadas (2)
CMP-2026-0012 — Luvas térmicas (YUKA) — previsão 15/09
CMP-2026-0018 — Filtro de água (TC) — previsão 17/09

💰 Reembolsos pendentes (1)
CMP-2026-0009 — R$ 45,00 — Thalita — pendente há 6 dias
```

**Sem repetição artificial:** não existe trava de "só avisa uma vez" — é um resumo diário do estado
ATUAL, então um item que continua atrasado aparece de novo no dia seguinte (esperado: lembrete recorrente
até resolver). O único controle de frequência é o próprio trigger (1x/dia).

**Silêncio quando não há nada:** se as duas listas vierem vazias no dia, a função não manda mensagem
nenhuma — sem "tudo certo" diário.

## Componentes (mudanças em `compras-appsscript/Code.gs`)

- Nova aba `COMPRAS_HISTORICO` (criada manualmente pela usuária, mesmo processo de instalação da Fase 1 —
  cabeçalhos `ID_COMPRA | TIMESTAMP | STATUS`).
- `registrarEntradaHistorico(idCompra, status)` — grava uma linha em `COMPRAS_HISTORICO`. Chamada por
  `registrarCompra` (sempre) e por `editarCompra` (só quando o status mudou).
- `obterHistorico(idCompra)` — lê `COMPRAS_HISTORICO`, filtra pelo ID, devolve ordenado por timestamp
  crescente.
- Nova ação `"historico"` no roteamento de `doPost`.
- `testarTelegram()` / `enviarTelegram(mensagem)` — mesmo padrão do bot de água.
- `configurarAlertasCompras()` — cria o trigger diário (remove duplicata antes).
- `verificarAlertasCompras()` — a função chamada pelo trigger: monta as duas listas, formata a mensagem,
  envia (ou não manda nada, se ambas vazias).

## Componentes (mudanças em `src/main.js`)

- `comprasAbrirModal`: busca o histórico via `fetch(COMPRAS_EXEC_URL, {acao: "historico", id})` antes de
  montar o formulário (só quando `registro` existe — compra nova não tem histórico pra buscar); insere a
  lista no topo do `#compra-form-conteudo`.
- Sem mudança nos KPIs/filtros/lista — Fase 2 não altera nada do que já existe, só adiciona.

## Tratamento de erros

- Falha ao buscar o histórico (rede, Apps Script fora do ar): formulário abre normalmente, só sem a
  timeline — mensagem "Não foi possível carregar o histórico" no lugar da lista, sem travar a edição.
- Trigger diário que falha (ex.: erro ao ler a planilha): fica registrado no log de Execuções do Apps
  Script (`Logger.log`), mesmo padrão de erro silencioso-mas-logado já usado em `registrarCompra`/
  `editarCompra` — não há novo mecanismo de alerta-de-erro-do-alerta (evita recursão de complexidade).

## Fora de escopo

- Confirmar/silenciar um alerta específico (ex.: marcar "já sei, não avisa de novo") — o resumo diário
  sempre reflete o estado atual; não há estado de "alerta reconhecido".
- Dashboard gerencial com gráficos (Fase 3).
- Integração com OS de Manutenção (Fase 4).
