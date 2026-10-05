# Requisição de MP e Recheio — Tomate em KG + Cebola em pacotes fixos

**Data:** 2026-10-05
**Status:** Implementado, aguardando teste da usuária em produção.

## Contexto

Pedido da usuária: "preciso ajustar o formulário de requisição de MP e RECHEIO" — "mudar tomate de caixa
para KG - 60, 90, 120 e 150" e "Cebola - 10, 20, 30 e 40 pcts".

## Dois projetos Apps Script, não um só

A usuária colou um `Code.gs` que não batia com o `requisicao-appsscript/Code.gs` já rastreado neste repo.
Investigando, ficou claro (e ela confirmou: "esse é o do formulário, esse é da planilha (nunca sei em qual
mexer)") que existem **dois projetos Apps Script separados** para Requisição de MP e Recheio:

- **`Code.gs`** (já existia no repo) — vinculado à **planilha** de respostas. Cuida do fechamento
  (Fechar/Histórico) depois que a requisição já chegou na planilha. Lê os produtos de forma **dinâmica**,
  pelo cabeçalho da linha 1 da aba de respostas (`obterColunasProduto`) — ou seja, não tem nenhuma lista
  fixa de produtos pra manter sincronizada com o formulário.
- **`Code.formulario.gs`** (novo arquivo, criado agora) — vinculado ao **formulário** (Google Forms) em si.
  Dispara no envio da requisição (`enviarRequisicaoTelegram`, acionado por `onFormSubmit`), manda a mensagem
  pro Telegram e cria o documento da requisição. Usa uma lista **fixa** de produtos
  (`CATALOGO_PRODUTOS`) pra montar o texto da mensagem.

Por isso a mudança de Tomate/Cebola, que é uma mudança nas **perguntas do formulário**, só podia ser feita
no projeto do formulário — e precisa também atualizar o texto desse produto dentro do `CATALOGO_PRODUTOS`
(usado pra montar a mensagem do Telegram) e do `COLUNAS_FORM_CONHECIDAS` (usado só pelas funções de
diagnóstico/teste do próprio arquivo).

## O que mudou

- `CATALOGO_PRODUTOS`: a entrada `"TOMATE IN NATURA (CX)"` passou a `"TOMATE IN NATURA (KG)"`.
- `COLUNAS_FORM_CONHECIDAS`: mesma troca de texto, pra bater com o novo título da pergunta no formulário.
- Cebola já usava `(PCT)` como unidade — não precisou trocar o texto do produto, só as opções de
  quantidade na pergunta do formulário (ver abaixo).

## Função nova — `ajustarPerguntasTomateECebola()`

Como as perguntas já existem no formulário publicado (com respostas), a forma seguura de trocar pra lista
suspensa com as opções certas é programaticamente, preservando posição e obrigatoriedade da pergunta —
não apagar e recriar o formulário manualmente.

A função helper `transformarEmListaSuspensa_(form, tituloAtual, tituloNovo, valoresPermitidos)`:

1. Procura a pergunta pelo título atual exato.
2. Se já for lista suspensa (`FormApp.ItemType.LIST`), só atualiza título e opções no lugar.
3. Se não for (ex.: hoje é texto livre ou múltipla escolha), guarda a posição (`getIndex()`) e se é
   obrigatória, apaga a pergunta antiga e cria uma lista suspensa nova (`addListItem`) com o título,
   opções e obrigatoriedade certos, e recoloca na mesma posição.
4. Se não achar a pergunta pelo título, registra um aviso no log e não faz nada (evita criar pergunta
   duplicada por erro de digitação no título).

`ajustarPerguntasTomateECebola()` chama esse helper duas vezes:

```js
transformarEmListaSuspensa_(form, "TOMATE IN NATURA (CX)", "TOMATE IN NATURA (KG)", ["60", "90", "120", "150"]);
transformarEmListaSuspensa_(form, "CEBOLA PICADA (PCT)", "CEBOLA PICADA (PCT)", ["10", "20", "30", "40"]);
```

É uma função de **uso único** — a usuária precisa rodar ela manualmente, uma vez, pelo editor do Apps
Script, depois de colar o arquivo. Rodar de novo não tem problema (idempotente: se a pergunta já for lista
suspensa com aquele título, só atualiza as opções de novo com os mesmos valores).

## Efeito do lado da planilha — nenhuma mudança de código necessária

Como `Code.gs` (o projeto da planilha) lê os produtos dinamicamente pelo cabeçalho da aba de respostas, a
troca do título da pergunta no formulário vai criar uma coluna nova na planilha de respostas
(`TOMATE IN NATURA (KG)` em vez de `(CX)`) automaticamente, sem precisar tocar em `Code.gs`.

## Risco identificado, ainda não resolvido — gatilho duplicado

Os dois projetos (`Code.gs` e `Code.formulario.gs`) têm, cada um, sua própria função de criação de
acionador (`criarAcionadorPeloFormulario` / função equivalente) e sua própria função de envio pro Telegram
(`enviarRequisicaoTelegram`). Se os dois acionadores estiverem ativos ao mesmo tempo (um no projeto da
planilha, outro no projeto do formulário), **cada requisição enviada dispara os dois**, duplicando a
mensagem no Telegram (e possivelmente o documento gerado). Isso não foi corrigido nesta mudança — só
identificado. Precisa confirmar com a usuária se ela já notou notificação duplicada, e, se sim, decidir
qual dos dois acionadores deve ficar ativo (provavelmente o do formulário, que é o que dispara primeiro no
envio).

## Passos manuais pra usuária

1. Abrir o **Google Forms** da Requisição de MP e Recheio.
2. No menu ⋮ (três pontinhos) do formulário, abrir "Editor de script" — isso abre o projeto Apps Script
   vinculado ao FORMULÁRIO (diferente do projeto vinculado à planilha de respostas, que é outro,
   `Code.gs`).
3. Colar o conteúdo de `Code.formulario.gs` por cima do que já existir lá.
4. No editor do Apps Script, escolher a função `ajustarPerguntasTomateECebola` no menu de funções (ao lado
   do botão ▶️ Executar) e rodar ela uma vez. Autorizar o acesso se pedir.
5. Conferir no formulário publicado: a pergunta do Tomate deve aparecer como lista suspensa com 60, 90,
   120, 150 (KG); a pergunta da Cebola com 10, 20, 30, 40 (pacotes).
