# Painel Qualidade — Fase 5 (migração do mural de Avisos + link para apps já existentes)

**Data:** 2026-09-23
**Status:** Aprovado para implementação

## Contexto

Última frente das 5 identificadas com escrita embutida no Mamma Mia Control (ver specs de Compras,
Insumos Críticos, Auditoria e Dedetização, Fases 1 a 4). Avisos é o mural de post-its fixado no
cabeçalho do painel — criar, editar e remover avisos que aparecem pra qualquer pessoa que abrir o Mamma
Mia Control. O backend (`AVISOS_EXEC_URL`, projeto `avisos-appscript` já versionado neste repo) não
muda em nada.

Junto com essa fase, o hub `painel-qualidade-appscript/Menu.html` também ganhou links diretos pra dois
apps de escrita que **já existiam antes desta migração**, em projetos próprios, e só não estavam
alcançáveis a partir do Painel Qualidade:

- **Ordens de Serviço** → `manutencao-appsscript` (já existente neste repo).
- **Refeitório** (presença, produção, sobra) → repositório separado `refeitorio-mamma-mia`.

Esses dois não tiveram nenhum código alterado — só ganharam um card no Menu do hub, igual ao padrão já
usado pra Compras (link pra um projeto Apps Script separado).

## Arquitetura (Avisos)

A tela de edição do mural entra dentro do próprio `painel-qualidade-appscript` como uma quinta página,
roteada por `?tela=avisos`. `Avisos.html` mostra o mesmo mural de post-its (criar, editar, remover),
chamando o mesmo `AVISOS_EXEC_URL` de sempre — payload idêntico
(`{acao: "criar"|"editar"|"remover", id?, texto}`).

## Mamma Mia Control (`src/main.js`)

O mural no cabeçalho (`avisos-postits`) continua carregando e mostrando os avisos (GET puro, sem
mudança), só perde os botões de editar/remover e o botão "+" de novo aviso — fica só a leitura dos
post-its já existentes.

## Módulos ainda fora do Painel Qualidade (pendentes, não é obrigação desta fase)

Durante essa fase a usuária apontou mais três frentes que também precisam de um jeito de lançar dado a
partir do Painel Qualidade, mas que não se encaixam no padrão "escrita embutida no Mamma Mia Control"
das fases 1-5 (elas nunca tiveram formulário dentro do Vite site — os dados de Pipa e Higienização de
Motores chegam por CSV publicado, sem escrita visível aqui):

- **VTO (Verificação Técnica Operacional)** — app separado (`VERIFICACAO_OPERACIONAL_MAMMAMIA`, um site
  Vite hospedado à parte, não um HtmlService do Apps Script). Falta a URL pública do site pra linkar.
- **Caminhão Pipa** — hoje só leitura (`PIPA_CSV_URL`) no Mamma Mia Control; não foi encontrado nenhum
  app de escrita dedicado em nenhum repositório already investigado.
- **Higienização de Motores (equipamentos refrigerados)** — mesma situação da Pipa: só leitura via CSV
  publicado, sem app de escrita encontrado.

Essas três ficam de fora desta spec — tratadas como continuação depois que a usuária confirmar onde/como
cada uma é hoje alimentada (link de um app já existente, ou construir um novo formulário).

## Fora de escopo

- VTO, Pipa e Higienização de Motores — ver seção acima.
- Qualquer mudança de dados/colunas de Avisos ou do backend `AVISOS_EXEC_URL`.
