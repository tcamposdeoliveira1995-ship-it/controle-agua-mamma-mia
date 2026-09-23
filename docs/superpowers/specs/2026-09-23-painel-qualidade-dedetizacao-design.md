# Painel Qualidade — Fase 4 (migração do módulo Dedetização / Armadilhas Luminosas)

**Data:** 2026-09-23
**Status:** Aprovado para implementação

## Contexto

Quarta frente da migração de escrita pro Painel Qualidade (ver specs de Compras, Insumos Críticos e
Auditoria, Fases 1 a 3). Diferente dos anteriores, esse módulo cobre dois tipos de registro que já
compartilhavam o mesmo modal e o mesmo backend no Mamma Mia Control: Dedetização (unidades TC, YUKA, CD)
e Armadilha Luminosa (unidades TC, YUKA) — cada combinação tipo×unidade tem seu próprio registro
(empresa, data realizada, certificado opcional), com alerta automático quando passam 30 dias da última
data registrada. Não existe projeto Apps Script próprio pra esse módulo — o backend
(`DEDETIZACAO_EXEC_URL`) é externo, sem código-fonte versionado aqui, mesma situação de Insumos e
Auditoria.

## Arquitetura

A tela de registro entra dentro do próprio `painel-qualidade-appscript` (o hub) como uma quarta página,
roteada por `?tela=dedetizacao`. `Dedetizacao.html` mostra os 5 chips de status (3 de Dedetização + 2 de
Armadilha Luminosa, mesma lógica de cálculo de vencimento mensal já existente) e, ao clicar em um deles,
abre um formulário (empresa, data realizada, upload de certificado em PDF/imagem convertido pra base64)
que salva no mesmo `DEDETIZACAO_EXEC_URL` de sempre — payload idêntico ao que já existia
(`{tipo, unidade, empresa, dataRealizada, registradoPor, certificadoBase64?, certificadoNome?}`,
inclusive o valor fixo `registradoPor: "Thalita Campos"` que já era hardcoded).

O `Menu.html` do hub ganha o card "🐜 Dedetização", linkando pra `?tela=dedetizacao`.

## Mamma Mia Control (`src/main.js` / `index.html`)

As duas barras de status (`documentos-vencimento-bar` no cabeçalho, que mistura Documentos e
Dedetização, e `armadilhas-vencimento-bar` na aba OS) continuam existindo e continuam buscando os dados
com a mesma chamada GET a `DEDETIZACAO_EXEC_URL` (`carregarDedetizacaoRemoto`) — isso é leitura pura, não
muda. O que sai é a interatividade: os chips deixam de ser clicáveis (removido `cursor:pointer`,
`data-praga-tipo`/`data-praga-unidade` e o listener de clique), e o modal de edição
(`modal-dedetizacao`, formulário, submit) é removido inteiramente do `index.html`/`main.js`. Um aviso
"Só leitura — registrar dedetização e troca de armadilhas agora acontece no Painel Qualidade." foi
adicionado acima da barra de Armadilhas na aba OS (mesmo padrão já usado em Compras/Insumos).

## Tratamento de erros

Mesmo comportamento de antes, só que agora no Painel Qualidade: falha ao carregar mostra mensagem de
erro; falha ao salvar mantém o formulário preenchido com o erro exibido (toast), sem perder o que foi
digitado, e sem fechar o modal.

## Fora de escopo

- Migração de Avisos — última fase pendente.
- Qualquer mudança de dados/colunas de Dedetização ou do backend `DEDETIZACAO_EXEC_URL`.
