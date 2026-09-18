# Módulo Compras — Fase 4 (integração com OS de Manutenção)

**Data:** 2026-09-18
**Status:** Implementado e validado em produção (sinalização de peça pelo técnico, alerta no
Telegram, botão "Registrar compra" no Painel e pré-preenchimento da OS/unidade no formulário de
Compras testados de ponta a ponta)

## Contexto

Fases 1 a 3 do módulo Compras já estão implementadas e validadas em produção (registro, histórico,
alertas, itens múltiplos, dashboard gerencial). A Fase 4, que ficou marcada como fora de escopo em todas
as specs anteriores, é a integração com OS de Manutenção.

Motivação real (confirmada com a usuária): hoje, quando uma OS fica esperando uma peça, ela não tem como
saber — sem perguntar pro técnico ou pra si mesma — se a compra daquela peça já foi feita e em que pé
está (comprado / a caminho / entregue). O objetivo desta fase é fechar esse ciclo: o técnico sinaliza que
precisa de uma peça, ela registra a compra vinculada àquela OS, e o status da compra aparece de volta na
própria OS no Painel.

## Fluxo geral

1. Técnico, na tela **"Fechar OS"** que já usa no celular (`manutencao-appsscript/Index.html`), abre uma
   OS e — em vez de (ou antes de) fechar — usa uma nova opção **"🔩 Preciso de uma peça"**, descrevendo o
   que falta.
2. Isso muda o status da OS pra **"Aguardando peça"** (status que já existe hoje no sistema, usado nos
   KPIs de Manutenção), grava a descrição numa coluna nova da planilha de OS, e avisa a usuária no
   Telegram (mesmo canal que já avisa quando uma OS nova é aberta).
3. No **Painel** (Mamma Mia Control, aba OS), a usuária vê essa OS com um botão **"🛒 Registrar compra"**.
   Ao clicar, abre o formulário de Compras (o mesmo já existente) com a OS já vinculada e a unidade
   pré-preenchida.
4. Depois de registrada, a mesma linha da OS no Painel passa a mostrar o **status da compra vinculada**
   (🛒 Comprado / 🚚 Em transporte / ✅ Entregue / etc.) em vez do botão — sem precisar abrir a aba
   Compras pra saber onde a peça está.

## Mudanças no app do técnico (`manutencao-appsscript`)

- **Nova coluna na planilha de OS:** `Necessidade de peça` (texto livre, só a nota do técnico sobre o que
  falta — mesmo espírito de "campo livre pra completar depois", não é parseado por nada).
- **Nova função de backend** `sinalizarNecessidadePeca(osId, descricao)`:
  - Valida que a OS existe e que o status atual não é "Concluído" (não faz sentido sinalizar peça pra OS
    já fechada).
  - Grava `descricao` na coluna `Necessidade de peça` (sobrescreve se já havia uma nota — sem histórico
    de múltiplas notas, mesma OS só tem a mais recente).
  - Muda o `STATUS` da OS pra `"Aguardando peça"`.
  - Move o card no Trello pra lista "Aguardando peça" chamando `moverCard()` diretamente — como a mudança
    de status aqui é feita pelo script (não editando a célula manualmente na planilha), o gatilho
    `onEdit` não dispara sozinho, então a função precisa chamar `moverCard()` ela mesma.
  - Envia um Telegram pra usuária avisando (nova função `enviarTelegramNecessidadePeca`, reaproveitando
    `TELEGRAM_TOKEN`/`TELEGRAM_CHAT_ID` já configurados nesse projeto — mesmo bot que já avisa OS nova).
- **Tela "Fechar OS" (`Index.html`):** no formulário que aparece ao tocar numa OS, abaixo de
  "Confirmar baixa ✅" e "Cancelar", um terceiro botão **"🔩 Preciso de uma peça"**. Ao tocar, troca a
  seção do formulário por um campo de texto ("Descreva a peça que falta") + botão "Enviar sinalização" —
  não precisa preencher foto/assinatura/o que foi feito pra isso, é uma ação separada da baixa.
  Descrição é obrigatória pra confirmar (mesma trava simples usada no resto do projeto).
  Depois de enviada, mostra uma tela de sucesso curta e volta pra lista, igual já acontece ao fechar uma
  OS.
- **Indicador visual na lista:** os cards de OS na lista (tanto em `Index.html` quanto no resumo do
  `Menu.html`) já mostram um badge de prioridade; quando o status da OS for "Aguardando peça", o card
  ganha um segundo badge/rótulo indicando isso, pro técnico saber que aquela OS já foi sinalizada (evita
  sinalizar de novo sem querer, embora sinalizar de novo não quebre nada — só atualiza a nota).
- OS "Aguardando peça" **continua aparecendo** na lista de "Fechar OS" normalmente (pode ser fechada a
  qualquer momento, caso o problema tenha sido resolvido de outro jeito).

## Mudanças no Compras (`compras-appsscript` + painel)

- **Nova coluna na planilha `COMPRAS`:** `OS RELACIONADA` (guarda o ID da OS, ex: `OS-20260918-003`,
  ou vazio quando a compra não é de uma peça de manutenção).
- **Novo campo no formulário de Compras:** "OS relacionada" (select, opcional) — lista as OS com status
  diferente de "Concluído" (não só "Aguardando peça", pra dar flexibilidade de vincular uma compra a uma
  OS ainda em andamento se fizer sentido), com opção em branco por padrão. Mostra `OS-ID — equipamento
  (setor)` em cada opção.
- Quando o formulário é aberto pelo botão "🛒 Registrar compra" na aba OS do Painel, esse campo já vem
  preenchido com a OS clicada, e a "Unidade" do cabeçalho da compra vem pré-preenchida com a `UNIDADE` da
  própria OS (campo que a planilha de OS já tem, só não era lido pelo Painel até agora).
- `registrarCompra`/`editarCompra` no backend passam a gravar `dados.osRelacionada` na nova coluna, sem
  nenhuma validação cruzada com a planilha de OS (os dois projetos continuam desacoplados, cada um só
  mexe na própria planilha — mesmo padrão já usado em todo o sistema).

## Mudanças no Painel — aba OS (`src/main.js`)

- `carregarOS()` passa a guardar os registros carregados numa variável de módulo (`osRegistros`), em vez
  de descartá-los depois de montar a tabela — necessário pra alimentar o select de "OS relacionada" no
  formulário de Compras. Passa também a ler a coluna `UNIDADE` (já existe na planilha, só não era usada)
  e `Necessidade de peça`.
- `carregarOS()` também busca o CSV de Compras (reaproveitando `COMPRAS_CSV_URL`, já usado pelo módulo
  Compras) só pra saber, pra cada OS "Aguardando peça", se já existe alguma compra com aquele
  `OS RELACIONADA` e qual o status dela — sem duplicar a lógica do módulo Compras, só essa leitura.
- Nova coluna **"Peça"** na tabela de OS do Painel:
  - OS que não está "Aguardando peça": mostra "-" (comportamento atual, sem mudança).
  - OS "Aguardando peça" **sem** nenhuma compra vinculada: botão **"🛒 Registrar compra"**.
  - OS com **uma ou mais** compras vinculadas (em qualquer status de OS, não só "Aguardando peça" — se a
    OS já foi fechada mas a compra ainda está a caminho, continua mostrando): mostra o status **menos
    avançado** entre as compras vinculadas, seguindo a ordem que o próprio status de Compras já usa
    (Solicitação registrada → Cotação → Aguardando aprovação → Comprado → Em transporte → Entregue),
    ignorando as "❌ Cancelado" nessa comparação; se todas forem canceladas, mostra "❌ Cancelado". Quando
    há mais de uma compra vinculada, acrescenta a contagem (ex.: "🚚 Em transporte (2 compras)").
- Clicar no botão "Registrar compra" chama `comprasAbrirModal(null)` com a OS e a unidade pré-preenchidas
  (o modal de Compras já existe fora da aba, funciona a partir de qualquer aba ativa).

## Tratamento de erros

- `sinalizarNecessidadePeca` numa OS já "Concluído": erro claro, sem alterar nada (mesmo padrão de erro
  já usado nas outras funções de OS).
- Sinalizar peça numa OS que já está "Aguardando peça": permitido, só atualiza a nota e reenvia o
  Telegram (não é tratado como erro nem duplica nada na planilha).
- Compra sem "OS relacionada" preenchida: comportamento igual ao que já existe hoje, campo fica vazio,
  nada muda pro resto do módulo.
- OS com "Necessidade de peça" preenchida mas nunca vinculada a uma compra: fica assim indefinidamente,
  só o botão "Registrar compra" continuando visível — sem alerta automático extra além do Telegram já
  disparado no momento da sinalização (evita duplicar os alertas do Fase 2, que já cobrem atraso de
  entrega das compras que existem).
- Falha ao carregar o CSV de Compras dentro de `carregarOS()` (ex.: rede instável): a coluna "Peça" cai
  pro estado padrão (botão "Registrar compra" pra toda OS "Aguardando peça", já que não foi possível
  confirmar se já existe compra) — não trava a aba OS nem gera erro visível, mesmo espírito de
  degradação silenciosa já usado no resto do painel.

## Fora de escopo

- Fechar a OS automaticamente quando a compra vinculada for marcada como "✅ Entregue" — continua manual,
  o técnico fecha a OS pelo app dele como sempre.
- Histórico de múltiplas notas de "Necessidade de peça" pra mesma OS — só a mais recente é guardada.
- Validação cruzada entre as planilhas de OS e Compras (ex.: impedir vincular a uma OS que não existe) —
  os dois projetos continuam desacoplados.
