# App Android (WebView) para o Web App de manutenção

## Problema

O Web App de manutenção (menu + abrir/fechar OS) hoje só existe como página
web, acessada pelo navegador (mesmo salva na tela inicial). O dono do
negócio quer um app Android de verdade — com ícone próprio, tela cheia,
instalável — e tem o Android Studio já instalado no PC pra buildar.

## Objetivo

Empacotar o Web App existente dentro de um app Android mínimo (WebView),
sem duplicar nenhuma lógica: o app é uma "moldura nativa" em volta do
mesmo link que já funciona no navegador.

## Restrição do ambiente

Esta sessão remota não tem Android SDK/Gradle instalado — não é possível
compilar um `.apk` aqui. O entregável é o **código-fonte de um projeto
Android Studio completo**, pro usuário abrir e buildar localmente (mesmo
padrão já usado no lado Apps Script: o código é gerado aqui, o
build/deploy acontece na máquina do usuário).

## Abordagens consideradas

1. **WebView wrapper (escolhida)** — um app com uma única tela contendo um
   `WebView` que carrega a URL do Web App. Reaproveita 100% do que já
   existe; único código novo é a "moldura" (permissões, seletor de
   foto/câmera, botão voltar).
2. **Trusted Web Activity (TWA)** — o jeito "oficial" do Android de
   empacotar um PWA como app, usando o Chrome por trás. Descartada: exige
   hospedar um arquivo `assetlinks.json` na raiz do domínio pra provar que
   o app e o site são do mesmo dono — o Apps Script não permite controlar
   isso (não hospeda arquivos arbitrários na raiz nem cabeçalhos customizados).
3. **App nativo do zero** — recriar as telas de abrir/fechar OS em Kotlin
   nativo, chamando a planilha/API diretamente. Descartada: duplicaria
   toda a lógica já construída e testada no Apps Script, sem ganho real
   pro caso de uso (3 técnicos, uso interno).

## Arquitetura

Novo diretório `manutencao-android/` no mesmo repositório, projeto Android
Studio padrão (Gradle com Kotlin DSL):

- `settings.gradle.kts`, `build.gradle.kts` (raiz e módulo `app`).
- `AndroidManifest.xml`: permissão `INTERNET` (obrigatória — sem ela o
  WebView não carrega nada) e `CAMERA` (pra deixar o seletor de arquivo
  oferecer "tirar foto" além de "escolher da galeria"; se negada, o
  seletor ainda funciona só com a galeria).
- `MainActivity.kt`: única tela do app.
  - Configura o `WebView` (JavaScript habilitado — obrigatório, já que
    todo o app depende de `google.script.run`; `domStorageEnabled`
    habilitado por segurança/compatibilidade).
  - Carrega a URL fixa do Web App (a mesma do menu:
    `.../exec`).
  - `WebViewClient` padrão, mantendo toda navegação dentro do próprio
    WebView (os links internos já são absolutos, então continuam
    funcionando exatamente como no navegador).
  - `WebChromeClient.onShowFileChooser`: implementação padrão pra abrir o
    seletor de arquivo/câmera do Android quando a página pede foto (campo
    `<input type="file">` das telas de abrir/fechar OS) — sem isso, esse
    campo simplesmente não responde a toque dentro de um WebView puro.
  - Botão voltar do Android: se o WebView tem histórico (`canGoBack()`),
    volta uma página dentro do app; senão, fecha o app normalmente.
- `activity_main.xml`: layout com um único `WebView` ocupando a tela
  inteira.
- `strings.xml`: nome do app "OS Manutenção".
- Ícone: entra depois, direto no Android Studio (Image Asset Studio),
  usando a logo que o usuário já tem salva — não faz parte do código
  gerado aqui.

`minSdk` 24 (cobre praticamente todo aparelho Android em uso hoje),
`targetSdk`/`compileSdk` 34.

## Fluxo de dados

Não há fluxo de dados novo — o app não fala com a planilha, Trello,
Telegram ou Drive diretamente. Tudo isso continua sendo responsabilidade
do Apps Script, exatamente como já é hoje pelo navegador. O app Android é
puramente uma casca visual.

## Tratamento de erros

- Sem internet: o WebView mostra a página de erro padrão do sistema
  (offline). Não faz parte deste escopo criar uma tela de erro customizada
  — pode ser adicionado depois se incomodar no uso real.
- Permissão de câmera negada: o seletor de arquivo cai pra galeria/outros
  apps de arquivo, sem quebrar o fluxo de tirar/anexar foto.

## Fora de escopo

- Publicar na Play Store (usuário optou por instalação direta do `.apk`).
- Notificações push, uso offline, ou qualquer funcionalidade nativa além
  de exibir o Web App.
- Gerar os arquivos de ícone (mipmaps) — feito pelo usuário no Android
  Studio a partir da logo que ele já tem.
