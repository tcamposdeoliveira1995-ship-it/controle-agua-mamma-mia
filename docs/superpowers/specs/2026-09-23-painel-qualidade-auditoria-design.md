# Painel Qualidade — Fase 3 (migração do módulo Auditoria de Higienização)

**Data:** 2026-09-23
**Status:** Implementado e validado em produção (checklist, não conformidade com foto, assinatura e
finalizar testados de ponta a ponta no Painel Qualidade)

## Contexto

Terceira frente da migração de escrita pro Painel Qualidade (ver
docs/superpowers/specs/2026-09-23-painel-qualidade-compras-design.md e
2026-09-23-painel-qualidade-insumos-design.md, Fases 1 e 2). Auditoria é o módulo mais completo dos
três: checklist de 48 itens (9 seções), registro de não conformidade com foto obrigatória, criticidade,
ação corretiva e opção de gerar OS, resultado calculado automaticamente, assinatura digital em canvas, e
geração de PDF individual (por auditoria) e resumo (por período).

## Arquitetura

Como não há projeto Apps Script próprio pra Auditoria (o backend `APPS_SCRIPT_URL` já era externo, sem
código-fonte versionado aqui — mesma situação de Insumos), a tela de registro entra dentro do próprio
`painel-qualidade-appscript` (o hub) como uma terceira página, roteada por `?tela=auditoria` no `doGet`.
`Auditoria.html` ganha o formulário completo: checklist, modal de não conformidade (com upload de foto
obrigatório via `FileReader`, criticidade, ação corretiva, checkbox "gerar OS"), cálculo automático do
resultado (aprovado / aprovado com ressalvas / reprovado), assinatura via `<canvas>` (sem biblioteca) e
finalizar — que grava em `localStorage['auditoria_historico_yuka']` e envia (POST) pro mesmo
`APPS_SCRIPT_URL` de sempre, sem mudar nada no backend.

O `Menu.html` do hub ganha o card "🧼 Auditoria", linkando pra `?tela=auditoria` (mesma implantação).

### Divisão do histórico local — decisão importante

O módulo original guarda dois tipos de histórico:
- **Local** (`localStorage`, por navegador/aparelho): cada auditoria completa, com foto de cada NC e
  assinatura em base64 — nunca foi visível pro Diretor, mesmo hoje, porque `localStorage` não sai do
  aparelho de quem preencheu.
- **Nuvem** (planilha via `APPS_SCRIPT_URL`): um resumo achatado (sem foto, sem assinatura, sem detalhe
  por item) — é o que o Diretor já vê hoje no Mamma Mia Control.

Migrar a escrita não reduz nada que o Diretor já via, porque ele nunca teve acesso ao detalhe local. Mas
em vez de simplesmente apagar a leitura do histórico local do Mamma Mia Control (o que tornaria
inacessíveis os registros com foto/assinatura já salvos antes da migração, que só existem no navegador
de quem os preencheu), a decisão foi:

- **Mamma Mia Control (`src/auditoria.js`)** mantém a tabela de histórico local (leitura), o modal "Ver"
  com detalhe completo e a geração de PDF individual — são operações **só de leitura** sobre dados que
  já existiam ali, não violam a regra "Mamma Mia Control só mostra". Esse histórico fica congelado: não
  cresce mais a partir daqui, porque as novas auditorias são registradas no Painel Qualidade, cuja
  origem é diferente e portanto usa um `localStorage` separado (mesma chave `auditoria_historico_yuka`,
  mas em outro domínio — não se misturam).
- **Painel Qualidade (`Auditoria.html`)** ganha seu próprio histórico local (mesma chave, começando
  vazio), com "Ver" e PDF individual, e cresce a partir de agora.
- O histórico **em nuvem** (o resumo achatado que o Diretor já vê) continua existindo só no Mamma Mia
  Control — o Painel Qualidade não tem essa tela, já que quem alimenta não precisa consultar o resumo
  consolidado de todas as unidades ali.

Resultado: nenhum dado antigo fica inacessível, e a separação escreve/lê fica limpa dali pra frente —
ao custo de um histórico local "dividido" (o antigo, congelado, dentro do Mamma Mia Control; o novo,
crescendo, dentro do Painel Qualidade).

### Correção de bug aproveitada na migração

`_enviarSheets` era `async` mas nunca dava `await` no próprio `fetch`, então o `try/catch` nunca pegava
falha de rede de verdade (só erro síncrono antes do disparo). Corrigido no `Auditoria.html` novo —
agora com `await` no fetch interno — mantendo a chamada em `_finalizar()` sem `await` (o toast e o PDF
continuam disparando na hora, sem esperar a resposta do backend, como já era o comportamento).

## Mamma Mia Control (`src/auditoria.js`)

Perde todo o formulário de escrita (checklist interativo, modal de NC, canvas de assinatura, botão
Finalizar) — fica só leitura: histórico local congelado (com Ver + PDF individual, ver acima) e
histórico em nuvem (tabela + filtro + PDF resumo, sem mudança).

## Tratamento de erros

Mesmo comportamento de antes, só que agora no Painel Qualidade: falha ao carregar o histórico em nuvem
não existe mais aqui (essa tela não busca nuvem); falha ao enviar pro backend não impede o registro
local nem a geração do PDF (mesma UX já existente — o envio pro backend é best-effort).

## Fora de escopo

- Migração de Dedetização e Avisos — fases seguintes.
- Qualquer mudança de dados/colunas da Auditoria ou do backend `APPS_SCRIPT_URL`.
