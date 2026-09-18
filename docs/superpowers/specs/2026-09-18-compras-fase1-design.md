# Módulo Compras — Fase 1 (registro completo + dashboard)

**Data:** 2026-09-18
**Status:** Implementado e validado em produção (criar, listar, KPIs e editar testados de ponta a ponta)

## Contexto

Usuária mandou uma proposta completa (15 seções) de um módulo de Compras e Aquisições pro Mamma Mia
Control: dashboard com KPIs, registro de compra (categoria, valores, fornecedor, pagamento/reembolso,
status, entrega, documentos), histórico por registro, alertas automáticos, dashboard gerencial com
gráficos, e integração com o módulo de OS de Manutenção.

É grande demais pra uma tacada só — decompomos em fases, mesmo padrão usado no resto do projeto (Água,
OS, Perdas, Refeições, Requisição MP cresceram todos aos poucos). Este spec cobre só a **Fase 1**:

- **Fase 1 (este spec):** registro completo de uma compra (todos os campos, incluindo anexos e
  conferência) + dashboard com KPIs, quebra por unidade e filtros.
- **Fase 2 (futura):** ficha de histórico/timeline por compra, alertas automáticos (atraso de entrega,
  reembolso pendente) via Telegram.
- **Fase 3 (futura):** dashboard gerencial com gráficos (gastos por unidade/categoria, evolução mensal,
  principais fornecedores).
- **Fase 4 (futura):** integração com o módulo de OS (vincular compra a uma OS de manutenção).

Diferente do que a primeira leitura sugeria, a Fase 1 já inclui TUDO que entra no registro de uma compra
(inclusive documentos no Drive e conferência) — só fica de fora o que depende de mais tempo de uso
(histórico, alertas, gráficos) ou de outro módulo (OS). Só a usuária registra compras (confirmado) — não
existe um formulário separado pra outras pessoas solicitarem; "Solicitante" é só um campo informativo de
quem pediu, preenchido por ela.

## Arquitetura

Segue o mesmo padrão dos outros módulos do projeto:

- **Novo projeto Apps Script** `compras-appsscript/` (pasta nova no repo, mesmo modelo de
  `manutencao-appsscript`/`requisicao-appsscript`), com uma planilha própria contendo a aba `COMPRAS`.
- A aba é **publicada como CSV** (Arquivo → Publicar na Web) — o painel lê esse CSV pra listar/calcular
  KPIs, mesmo padrão de leitura de OS/Perdas/Refeições/Requisição.
- **Escrita:** como só a usuária registra e o registro acontece dentro do próprio Mamma Mia Control (não
  numa tela separada pra celular), a escrita vai por `fetch` POST direto pro `/exec` do Apps Script
  (`doPost` com `{acao: "criar"|"editar", ...}`) — exatamente como o mural de Avisos já funciona hoje
  (`AVISOS_EXEC_URL`, `criarAviso`/`editarAviso`). Sem `google.script.run` (só funciona dentro de páginas
  servidas pelo próprio Apps Script, que não é o caso aqui — o painel é um site Vite separado no Vercel).
- **Anexos:** convertidos pra base64 no navegador (`FileReader`) e enviados dentro do mesmo corpo JSON do
  `fetch` POST; o backend decodifica e salva no Drive — mesma técnica de `salvarFotoConclusao` (OS), só
  trocando `google.script.run` por `doPost`.
- Nova aba **"🛒 Compras"** no menu do Mamma Mia Control (`index.html`/`src/main.js`), mesmo nível de
  Água/OS/Perdas/Refeições.

## ID e Status

- **ID automático:** `CMP-AAAA-NNNN` (ex.: `CMP-2026-0001`), sequencial dentro do ano. Reaproveita a
  mesma lógica segura de `proximoNumeroSequencialOS` (manutencao-appsscript): olha o maior NNNN já usado
  nas linhas com prefixo `CMP-2026-` e soma 1 — à prova de linha em branco ou fora de ordem, nunca repete
  um número já usado.
- **Status da compra** (campo livre, sem forçar sequência — você pode criar uma compra já como
  "🛒 Comprado" se já comprou direto):
  - 🟣 Solicitação registrada
  - 🟠 Cotação
  - 🟡 Aguardando aprovação
  - 🛒 Comprado
  - 🚚 Em transporte
  - ✅ Entregue
  - ❌ Cancelado

## Formulário único (criar e editar)

Uma só tela cobre criação e edição — a usuária preenche o que sabe no momento (ex.: só o pedido, sem
valor/fornecedor ainda) e volta depois pra completar, sempre reabrindo a mesma tela pré-preenchida com o
que já existe (mesmo padrão de "✏️ Editar" já usado em Produção/Avisos).

**Identificação:** Data da solicitação · Unidade (TC/YUKA/CD/Geral) · Solicitante — categoria
(Qualidade/Produção/Manutenção/RH/Administrativo/Limpeza/Cozinha/Outro) + Nome do solicitante (texto
livre, ex.: "Carlos - Manutenção").

**Categoria e item:** Categoria (lista fechada: EPI, Manutenção, Produção, Qualidade, Higiene e Limpeza,
Estrutura, Refeitório, Escritório, TI, Uniforme, Segurança do Trabalho, Ferramentas, Equipamentos, Peças,
Outros) separada do Item/Produto (texto livre, ex.: "Cinta de teflon para seladora") — categoria fechada
permite análise de gasto por categoria sem depender do texto digitado; Descrição/especificação (texto
livre, opcional).

**Quantidade e valores:** Quantidade + Unidade de medida (UN/PCT/CX/KG/L/M/PAR/KIT) · Valor unitário →
Valor total calculado no cliente (Quantidade × Valor unitário), sem conta manual.

**Fornecedor e pagamento:** Fornecedor + Link da compra (Mercado Livre, Amazon, loja física...) · Forma de
pagamento (PIX/Boleto/Cartão/Dinheiro/Faturado/Outro) · Pago por (Empresa/Thalita/Outro colaborador) — se
for colaborador, aparecem Reembolso necessário? (Sim/Não) e, se sim, Status do reembolso
(Pendente/Solicitado/Reembolsado).

**Entrega e conferência:** Data da compra · Previsão de entrega · Data do recebimento · Recebido por ·
Conferido? (Sim/Não) · Condição do material (Conforme/Divergente/Danificado/Quantidade incorreta) — todos
opcionais até o momento em que fizerem sentido (não existem antes da compra acontecer).

**Documentos:** 📎 Nota fiscal · 📎 Comprovante de pagamento · 📎 Foto do produto — cada um opcional,
enviado como está (extensão real do arquivo, não força `.pdf`). Salvos no Drive em
`Compras/2026/Setembro/CMP-2026-0001/` (pastas por ano/mês/ID, criadas automaticamente se não existirem —
mesmo padrão de pasta usada pelos PDFs de OS).

**Status:** o campo Status da compra (lista acima).

## Dashboard e filtros

**4 KPIs no topo**, calculados sobre o CSV publicado:
- 💰 Valor comprado no mês (soma de Valor Total das compras com Data da compra no mês corrente)
- 🛒 Compras realizadas (contagem de registros com Status ∉ {Cancelado})
- 🚚 Aguardando entrega (Status ∈ {Comprado, Em transporte})
- ⚠️ Entregas atrasadas (hoje > Previsão de entrega E Status ∉ {Entregue, Cancelado})

**Logo abaixo**, quebra por unidade — 3 cartões (TC/YUKA/CD) com o valor total gasto em cada, mesmo
período dos KPIs.

**Filtros** (mesmo padrão de selects já usado em Perdas/OS): Unidade (Todas/TC/YUKA/CD) · Período (Este
mês/Mês passado/Todos/livre de-até) · Categoria · Status · Fornecedor.

**Lista** das compras filtradas (tabela: ID, Data, Unidade, Categoria, Item, Valor, Fornecedor, Status),
clicável — abre o formulário único em modo edição.

Sem tela "Minhas Compras" separada (ficaria redundante — só a usuária registra, então a lista já é
"dela"). Sem histórico/timeline por registro nesta fase (Fase 2).

## Aba COMPRAS na planilha

Colunas (cabeçalho-driven, mesmo padrão de `mapaColunas`/`colunaObrigatoria` usado em todo o projeto —
nunca por posição fixa): ID, Timestamp, Unidade, Categoria Solicitante, Nome Solicitante, Categoria, Item,
Descrição, Quantidade, Unidade Medida, Valor Unitário, Valor Total, Fornecedor, Link Compra, Forma
Pagamento, Pago Por, Reembolso Necessário, Status Reembolso, Status Compra, Data Solicitação, Data Compra,
Previsão Entrega, Data Recebimento, Recebido Por, Conferido, Condição Material, NF, Comprovante, Foto.

## Tratamento de erros

- Anexo que falha ao salvar no Drive: o resto do registro (todos os outros campos) é salvo normalmente —
  mesma filosofia de "extra não pode travar o principal" usada em `registrarIngredientesExtras`. Erro do
  anexo específico aparece pro usuário, mas não perde o resto do que foi preenchido.
- CSV de Compras fora do ar/não publicado ainda: a aba mostra "Não foi possível carregar as compras",
  sem quebrar o resto do painel — mesmo padrão de todo módulo que lê CSV externo.
- Edição de uma compra já `✅ Entregue`/`❌ Cancelado`: permitida sem trava — é só correção de dado
  histórico, sem necessidade de reabrir status.

## Fora de escopo (fases futuras)

- Histórico/timeline por compra (Fase 2).
- Alertas automáticos via Telegram — atraso de entrega, reembolso pendente (Fase 2).
- Dashboard gerencial com gráficos — por unidade, categoria, evolução mensal, fornecedores (Fase 3).
- Integração com OS de Manutenção — campo Origem/Nº da OS, total gasto por OS (Fase 4).
- Tela "Minhas Compras" — decidido fora de escopo permanentemente (redundante com usuária única).
