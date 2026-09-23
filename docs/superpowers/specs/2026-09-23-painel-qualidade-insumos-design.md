# Painel Qualidade — Fase 2 (migração do módulo Insumos Críticos)

**Data:** 2026-09-23
**Status:** Implementado e validado em produção (lista de insumos e atualização de quantidade pelo
Painel Qualidade testadas de ponta a ponta — inclusive corrigindo o link do card "Insumos Críticos" no
Menu, que precisava ser a URL completa do projeto em vez de um atalho relativo)

## Contexto

Segunda frente da migração de escrita pro Painel Qualidade (ver
docs/superpowers/specs/2026-09-23-painel-qualidade-compras-design.md, Fase 1 — Compras). Insumos
Críticos é bem menor: cada item tem só um campo de quantidade + botão "Salvar" (sem sub-formulário,
sem itens múltiplos). Diferente de Compras, não existe um projeto Apps Script próprio pra Insumos neste
repo — o backend (`INSUMOS_EXEC_URL`) é um Apps Script externo que já existia antes, sem código-fonte
versionado aqui, e não precisa mudar nada nele.

## Arquitetura

Como não há projeto próprio de Insumos pra ganhar uma tela nova (diferente de Compras), a tela de
edição entra dentro do **próprio `painel-qualidade-appscript`** (o hub) como uma segunda página,
roteada por `?tela=insumos` no `doGet` — mesmo padrão do `?tela=abrir`/`?tela=fechar` do app de
Manutenção. `Insumos.html` é a mesma lista de cards que o Mamma Mia Control já mostrava (item,
quantidade atual, mínimo, badge de alerta quando abaixo do mínimo, última atualização) com o campo de
quantidade + Salvar de volta, chamando o mesmo `INSUMOS_EXEC_URL`/`INSUMOS_CSV_URL` de sempre — toda a
lógica de leitura do CSV (nomes de coluna, conversão de número) e o corpo do POST
(`{item, novaQuantidade, atualizadoPor}`) portados idênticos ao que já existia no Mamma Mia Control,
inclusive o valor fixo `atualizadoPor: "Thalita Campos"` que já era hardcoded lá.

O `Menu.html` do hub ganha o card "📦 Insumos Críticos", linkando pra `?tela=insumos` (mesma
implantação, sem precisar de outra URL).

## Mamma Mia Control (`src/main.js` / `index.html`)

A aba Insumos Críticos perde o campo de quantidade e o botão "Salvar" de cada card — fica só a leitura
(item, quantidade, mínimo, badge de alerta, última atualização). O botão "Atualizar" no topo continua
igual (só recarrega a leitura, não é uma escrita).

## Tratamento de erros

Mesmo comportamento de antes, só que agora na tela do Painel Qualidade: falha ao carregar o CSV mostra
mensagem de erro; falha ao salvar mantém o formulário preenchido com o erro exibido, sem perder o que
foi digitado.

## Fora de escopo

- Migração de Auditoria, Dedetização e Avisos — fases seguintes.
- Qualquer mudança de dados/colunas do Insumos.
