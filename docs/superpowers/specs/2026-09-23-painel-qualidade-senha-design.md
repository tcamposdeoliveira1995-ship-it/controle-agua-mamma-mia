# Painel Qualidade — porta de entrada com senha

**Data:** 2026-09-23
**Status:** Aprovado para implementação

## Contexto

A usuária pediu pra restringir quem consegue acessar o Painel Qualidade ("não quero pessoas
acessando"). A implantação hoje é "Qualquer pessoa" (sem exigir nem login do Google), porque a equipe
que preenche os formulários (auditor, cozinheira, etc.) nem sempre usa a mesma conta Google, então
restringir por conta do Google (nativo do Apps Script) não é uma opção viável sem travar quem realmente
precisa usar.

Decisão (confirmada com a usuária): senha única compartilhada, protegendo só a tela inicial (Menu) por
enquanto — não os 10 módulos individualmente (cada um é um projeto Apps Script separado; proteger todos
exigiria mexer e reimplantar em 7+ projetos diferentes). Quem tem o link direto de um módulo específico
ainda entra sem senha — essa spec cobre só a porta de entrada.

## Arquitetura

`Menu.html` ganhou uma tela de login (`#tela-login`) que aparece por padrão, escondendo o conteúdo
normal (`#conteudo-principal`, que já tinha o cabeçalho + grade de módulos). Um campo de senha compara
com uma constante `SENHA_PAINEL` fixa no próprio arquivo (comparação client-side simples — não é
criptografia forte, mas é proporcional ao risco real: um painel operacional interno, não dados
financeiros/sensíveis de terceiros). Acertando a senha, guarda um flag em `sessionStorage` pra não pedir
de novo enquanto a aba/sessão do navegador continuar aberta.

`SENHA_PAINEL` fica como um placeholder (`'TROQUE_ESSA_SENHA'`) no código — a usuária escolhe e edita
esse valor antes de reimplantar. Diferente de outros valores já conhecidos que foram preenchidos direto
nos arquivos enviados, uma senha é algo que só ela deve escolher, então aqui o placeholder é
intencional.

## Limitações conhecidas (aceitas)

- Não protege os 10 módulos individualmente — só quem não tem o link direto de cada um é forçado a
  passar pela tela de login do Menu primeiro.
- `sessionStorage` é por aba/navegador — cada dispositivo/navegador novo pede a senha de novo (esperado
  e aceitável pro caso de uso).
- Comparação de senha acontece no navegador (visível no código-fonte da página pra quem souber abrir o
  DevTools) — suficiente como barreira contra acesso casual, não contra alguém tecnicamente motivado.

## Fora de escopo

- Proteger os 10 módulos individuais com a mesma senha — pode virar uma fase futura se a usuária pedir.
- Qualquer autenticação real (contas de usuário, backend validando senha, etc.).
