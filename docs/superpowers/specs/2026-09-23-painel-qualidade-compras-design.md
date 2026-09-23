# Painel Qualidade — Fase 1 (hub + migração do módulo Compras)

**Data:** 2026-09-23
**Status:** Aprovado para implementação

## Contexto

O Mamma Mia Control é o painel que o Diretor acessa — hoje pensado como leitura, mas alguns módulos
têm formulário de edição embutido nele mesmo (Compras, Insumos Críticos, Auditoria, Dedetização,
Avisos), o que significa que o Diretor tecnicamente consegue criar/editar registros ali. A usuária
quer separar isso: um painel novo, **Painel Qualidade**, onde ELA lança tudo (mesmo padrão já usado em
Água — lançamento fora do Mamma Mia Control, painel só exibe o resultado), deixando o Mamma Mia
Control 100% leitura pro Diretor.

Levantamento feito antes desta spec identificou 5 módulos com escrita embutida no Painel: Compras,
Insumos Críticos, Auditoria, Dedetização e Avisos. Cada um vira sua própria fase de migração — esta
spec cobre só a primeira: **Compras**, escolhida por ser a maior/mais completa.

Água e Configurações têm um formulário "Nova Leitura" que só grava no `localStorage` do navegador
(nunca chega ao backend) — não é um vazamento real de escrita pro Diretor, fica fora de escopo.

## Arquitetura

**Novo projeto `painel-qualidade-appscript`** — um hub simples, sem lógica de dados própria (só um
`Code.gs` com `doGet` servindo `Menu.html`, igual o `doGet` do app de Manutenção): uma tela com cards
de link, um por módulo migrado. Nesta fase, só "🛒 Compras" (linkando pro `compras-appsscript`); os
outros 4 entram conforme forem migrados nas próximas fases.

**`compras-appsscript` ganha páginas HTML novas** — o projeto já existe e já tem todo o backend
(`registrarCompra`, `editarCompra`, `COMPRAS_EXEC_URL`, etc.), usado sem nenhuma mudança. O `doGet(e)`
atual (que só devolve um JSON de status) passa a servir HTML pra navegador:

- **Lista** (tela inicial): busca as compras recentes lendo o mesmo `COMPRAS_CSV_URL`/
  `COMPRAS_ITENS_CSV_URL` publicados que o Mamma Mia Control já lê (fetch client-side, igual o
  Painel faz — não reimplementa leitura de planilha no servidor). Mostra ID, data, unidade, fornecedor,
  valor, status; campo de busca por ID/fornecedor; botão **"+ Nova compra"**.
- **Formulário** (criar/editar): MESMO comportamento de hoje, portado do `src/main.js` pro estilo já
  usado nas páginas HTML deste projeto (Index.html/AbrirOS.html/Menu.html — JavaScript em ES5, sem
  arrow function/template literal, por consistência com o que já existe nessas páginas) —
  Identificação (incluindo o campo "OS relacionada" da Fase 4, que busca `OS_CSV_URL` pra listar as OS
  em aberto, igual o Painel já faz), Itens da compra (múltiplos itens, "+ item", "Colar itens" com o
  mesmo parser bloco/linha já testado), Fornecedor, Pagamento, Status, Entrega, Documentos
  (NF/comprovante/foto), Histórico (só quando editando). Salva chamando o mesmo `COMPRAS_EXEC_URL` via
  `fetch` POST (`acao: "criar"|"editar"`), nos mesmos moldes do que o Painel já faz.

Nenhuma mudança nas planilhas (`COMPRAS`, `COMPRAS_ITENS`, `COMPRAS_HISTORICO`) nem no `Code.gs` além
de adicionar o roteamento de `doGet`.

## Mamma Mia Control (`src/main.js` / `index.html`)

A aba Compras perde:
- O botão "🛒 Nova compra".
- O clique numa linha da lista abrindo o modal de edição.
- O modal `#modal-compra` inteiro e as funções que só existem pra sustentá-lo
  (`comprasAbrirModal`, `comprasSalvar`, `_comprasRenderizarFormulario` e as funções de itens/anexos/
  histórico que só o formulário usa).

Continua exatamente igual: KPIs, filtros, lista (agora sem ação de clique), os 4 gráficos do dashboard
gerencial (Fase 3). `carregarCompras()` deixa de precisar preparar dados pro modal, só pra exibição.

## Fluxo

1. Usuária abre o link do Painel Qualidade (salvo no celular/computador, igual o app de OS).
2. Toca "🛒 Compras" → cai na lista de compras recentes.
3. "+ Nova compra" ou toca numa compra existente → formulário completo, preenche/edita, salva.
4. Volta pra lista atualizada.
5. Mamma Mia Control, em paralelo, mostra os mesmos dados (mesmo CSV) pro Diretor, sem nenhum botão de
   ação.

## Reaproveitamento (nada muda no backend)

- `COMPRAS_EXEC_URL`, `COMPRAS_CSV_URL`, `COMPRAS_ITENS_CSV_URL` — os mesmos três links já
  configurados, sem trocar nenhum.
- `CAMPOS_COMPRA`/`CAMPOS_ITEM`/`ANEXOS_COMPRA` no `Code.gs` — sem mudança, já são genéricos.
- Heurística de "Colar itens" (parser por bloco e por linha) — portada tal e qual, mesmo
  comportamento já validado com dados reais do CMV Fácil.

## Tratamento de erros

- Lista de compras falha ao carregar (rede instável): mostra mensagem de erro com botão "Tentar de
  novo"; não trava o "+ Nova compra", que não depende da lista carregada.
- Formulário falha ao salvar: mesma mensagem de erro inline já usada hoje no Painel, sem perder o que
  foi preenchido.
- Duas edições concorrentes na mesma compra (ex.: painel antigo ainda aberto em algum lugar por
  engano): sem controle de concorrência — a última a salvar prevalece, mesma regra já usada em todo o
  resto do sistema.

## Fora de escopo

- Migração de Insumos Críticos, Auditoria, Dedetização e Avisos — fases seguintes, uma spec cada.
- Login/autenticação — acesso ao Painel Qualidade continua por link direto (quem tem o link acessa),
  mesmo modelo de segurança já usado nos outros apps Apps Script deste sistema.
- Qualquer mudança de layout/campos do formulário de Compras em si — é uma migração de "onde roda",
  não uma revisão do que ele faz.
