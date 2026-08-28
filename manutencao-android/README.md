# OS Manutenção — app Android

App Android bem enxuto: uma tela com um WebView que carrega o Web App de
manutenção (`.../manutencao-appsscript`). Toda a lógica (planilha, Trello,
Telegram, PDFs) continua no Apps Script, exatamente como já funciona no
navegador — este app só empacota o mesmo link numa "moldura" nativa, com
ícone próprio e sem barra de navegador.

## Como abrir e buildar

1. Abra o **Android Studio** > **Open** > selecione a pasta
   `manutencao-android/` (esta pasta, não o repositório inteiro).
2. Se o Android Studio avisar sobre o Gradle Wrapper (arquivo binário que
   não vai pro Git), deixe ele mesmo regenerar — normalmente basta clicar
   em **"Sync Now"** quando aparecer, ou **File > Sync Project with Gradle
   Files**.
3. Espere o Gradle sincronizar (primeira vez demora um pouco, baixando
   dependências).
4. Troque o ícone provisório pela logo de verdade: botão direito na pasta
   `res` (dentro de `app/src/main`) > **New > Image Asset** > em "Path",
   aponte pro arquivo da logo Mamma Mia que você já tem salvo > ajuste o
   zoom/padding na prévia até ficar bom > **Next > Finish**. Isso
   substitui `ic_launcher_foreground.xml` pela imagem de verdade.
5. Conecte o celular por USB (com "Depuração USB" ativada) ou use um
   emulador, e clique em **Run ▶** pra testar.
6. Pra gerar o `.apk` pra instalar direto nos celulares da equipe:
   **Build > Build Bundle(s) / APK(s) > Build APK(s)**. O arquivo fica em
   `app/build/outputs/apk/debug/app-debug.apk` — copie pro celular
   (WhatsApp, Drive, cabo USB, o que for mais fácil) e instale (o Android
   vai pedir pra liberar "instalar de fontes desconhecidas" na primeira
   vez).

## Se quiser trocar o link do Web App depois

O link fica numa única linha, no topo de
`app/src/main/java/com/mammamia/manutencao/MainActivity.kt`
(constante `URL_APP`). Só trocar ali e rodar de novo.
