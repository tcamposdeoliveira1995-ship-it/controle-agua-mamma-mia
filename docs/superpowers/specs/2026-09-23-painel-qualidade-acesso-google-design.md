# Painel Qualidade — restringir acesso a "qualquer conta do Google"

**Data:** 2026-09-23
**Status:** Aprovado para implementação

## Contexto

Depois de aprovar a senha compartilhada (ver
docs/superpowers/specs/2026-09-23-painel-qualidade-senha-design.md), a usuária trocou de ideia: como ela
mesma já usa 3+ contas Google diferentes e a equipe também tem conta Google, exigir login com QUALQUER
conta Google — em vez de uma senha própria pra decorar/compartilhar — resolve o mesmo problema
("não quero pessoas acessando") sem precisar de nenhum código novo.

A tela de login com senha foi revertida do `Menu.html`.

## Arquitetura

Isso é 100% configuração de implantação do Apps Script — nenhum arquivo precisa mudar. Cada projeto tem
uma opção "Quem pode acessar" na hora de implantar, hoje configurada como "Qualquer pessoa". Trocando
pra "Qualquer pessoa com Conta do Google", o Google passa a exigir login (com qualquer conta @gmail.com
ou Google Workspace) antes de servir a página — quem não estiver logado num navegador com conta Google
vê a tela de login do Google primeiro.

Como isso não exige nenhum código, e diferente da senha (que só valia a pena proteger a entrada por
causa do trabalho de reimplantar cada projeto), dá pra aplicar em TODOS os projetos de uma vez, sem
custo extra de desenvolvimento — só o tempo da usuária ajustar a configuração em cada um.

### Passo a passo (por projeto, ela mesma faz — não precisa colar nenhum arquivo novo)

Pra cada projeto Apps Script (Painel Qualidade, Compras, Insumos/Auditoria/Dedetização/Avisos/Pipa/
Higienização — que são o mesmo projeto Painel Qualidade —, Manutenção/OS, e Avisos-backend):

1. Abrir o projeto em script.google.com.
2. **Implantar > Gerenciar implantações**.
3. Clicar no ✏️ (editar) da implantação ativa.
4. Em **"Quem pode acessar"**, trocar de "Qualquer pessoa" pra **"Qualquer pessoa com Conta do
   Google"**.
5. **Implantar** (não precisa ser "Nova versão" só por essa mudança — é config, não código; mas se o
   Apps Script pedir, tudo bem confirmar).

Repetir para: `painel-qualidade-appscript` (cobre Menu + Insumos + Auditoria + Dedetização + Avisos +
Pipa + Higienização, todos na mesma implantação), `compras-appsscript`, `manutencao-appsscript`.

Os apps em repositórios separados (Refeitório, VTO) não são cobertos por esta spec — ficam de fora por
enquanto, a usuária pode pedir o mesmo ajuste neles depois se quiser.

## Limitações conhecidas (aceitas)

- Não restringe a QUAIS contas Google — qualquer pessoa com QUALQUER conta Google (inclusive
  desconhecidos) ainda consegue entrar se tiver o link. Não é uma lista de convidados, só exige login.
- Continua sem afetar os apps em outros repositórios (Refeitório, VTO) — só os 3 projetos Apps Script
  deste repositório.

## Fora de escopo

- Restringir a contas Google específicas (exigiria Google Workspace com domínio próprio — não é o caso
  aqui, contas são @gmail.com pessoais).
- Aplicar o mesmo ajuste em Refeitório e VTO (repositórios separados) — pendente de pedido explícito.
