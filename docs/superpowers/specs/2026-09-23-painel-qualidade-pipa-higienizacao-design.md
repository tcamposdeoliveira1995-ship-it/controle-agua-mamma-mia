# Painel Qualidade — Fase 6 (Caminhão Pipa e Higienização de Motores) + hub completo

**Data:** 2026-09-23
**Status:** Implementado e validado em produção (registro de Pipa e de Higienização de Motores testados
de ponta a ponta, além dos links pra OS, Refeitório e VTO — inclusive um link de volta pro Painel
Qualidade adicionado nos apps de OS e Refeitório, que não tinham)

## Contexto

Depois das 5 fases originais (Compras, Insumos Críticos, Auditoria, Dedetização, Avisos), a usuária
apontou que o hub do Painel Qualidade ainda não cobria tudo que ela precisa lançar no dia a dia: Ordens
de Serviço, Refeitório, VTO (Verificação Técnica Operacional), Caminhão Pipa e Higienização de Motores.
Investigação:

- **OS** já tem app de escrita próprio neste repo (`manutencao-appsscript`) — só faltava um link no Menu.
- **Refeitório** (presença, produção, sobra) já tem app próprio em outro repositório
  (`refeitorio-mamma-mia`) — só faltava um link.
- **VTO** já tem app próprio (site à parte, `VERIFICACAO_OPERACIONAL_MAMMAMIA`, hospedado em
  `verificacao-operacional-mammamia.vercel.app`) — só faltava um link.
- **Caminhão Pipa** e **Higienização de Motores** nunca tiveram nenhum app de escrita — os dois sempre
  foram só leitura (CSV/gviz publicado) no Mamma Mia Control, e a usuária confirmou que lança esses
  dados direto na planilha do Google. Únicos dois módulos desta leva que precisam de formulário novo de
  verdade.

Os três primeiros (OS, Refeitório, VTO) foram resolvidos só com um card de link no `Menu.html` do hub —
nenhum código deles mudou. Esta spec documenta os dois que precisaram de trabalho novo: Pipa e
Higienização de Motores.

## Arquitetura

Nenhum dos dois tinha planilha com backend de escrita — só publicação CSV/gviz de leitura. Em vez de
criar dois projetos Apps Script novos do zero (mais um link/implantação pra usuária gerenciar), os dois
foram encaixados no projeto **`avisos-appscript`, que já existe e já está implantado** (mesmo raciocínio
que já juntava água+avisos nesse projeto: só existe 1 link `/exec` por projeto Apps Script, então
consolidar reduz a quantidade de coisas pra implantar). O `doPost` ganhou duas ações novas:

- `{acao: "criar_pipa", pedido, requisitada, recebida, placa, relInicio, relFim, recibo}` — grava na aba
  de Pipa, que fica na MESMA planilha de água/avisos (achada pelo gid, não pelo nome, porque o gid já é
  conhecido do link de leitura CSV e nunca muda mesmo que a aba seja renomeada).
- `{acao: "criar_higienizacao", dataHigienizacao, responsavel, unidade}` — grava na planilha de
  Higienização (`HIGIENIZACAO_PLANILHA_ID`, diferente da de água), também achada pelo gid.

As duas ações acham a coluna certa pelo cabeçalho (`colunaPorTrecho`, mesma lógica de "contains" que o
Mamma Mia Control já usa pra ler essas mesmas planilhas) em vez de depender de sabe a ordem exata das
colunas — evita quebrar se alguém reordenar colunas na planilha, e falha alto (erro claro) se um
cabeçalho esperado sumir, em vez de gravar na coluna errada.

`painel-qualidade-appscript` ganhou duas telas novas, roteadas por `?tela=pipa` e `?tela=higienizacao`,
cada uma com formulário + uma seção de leitura (últimos registros de Pipa via o mesmo CSV público de
sempre; status por unidade de Higienização via o mesmo gviz de sempre) pra dar confirmação visual do que
acabou de ser salvo, no mesmo padrão já usado em Dedetização (chips de status por unidade/tipo).

Nenhuma das duas precisa de implantação nova: o `avisos-appscript` já está implantado (é o mesmo exec
URL do mural de Avisos) — só precisa reimplantar (Nova versão) depois de colar o `Code.gs` atualizado.

## Mamma Mia Control

Nenhuma mudança — os dois módulos já eram só leitura lá (CSV/gviz), e continuam exatamente iguais.

## Tratamento de erros

Falha ao salvar mostra alerta com a mensagem de erro (incluindo o caso de cabeçalho não encontrado na
planilha, que aponta exatamente qual coluna sumiu) sem perder o que foi preenchido no formulário — os
campos não são limpos até a gravação confirmar sucesso.

## Fora de escopo

- Qualquer mudança nos apps já existentes de OS, Refeitório ou VTO — só ganharam link no Menu.
- Qualquer mudança de dados/colunas das planilhas de Pipa e Higienização.
