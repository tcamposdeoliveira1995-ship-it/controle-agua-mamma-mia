# Painel Qualidade — Menu vertical + resumo ao vivo do Kanban

**Data:** 2026-10-02
**Status:** SUBSTITUÍDO no mesmo dia por
`2026-10-02-painel-qualidade-shell-iframe-design.md` — a usuária viu essa versão (lista vertical + resumo
em card) e mandou um desenho deixando claro que queria o menu lateral fixo com o módulo abrindo embutido
no painel ao lado, não um resumo. Documento mantido pra contexto histórico; o Menu.html atual não
corresponde mais ao que está descrito abaixo.

## Contexto

Depois de rebalancear a grade do Menu pra 4 por linha (spec anterior), a usuária ainda não gostou. Pedido
seguinte: "Tem como deixar os ícones na vertical? E a ABA KANBAN sempre aberta? Conforme for abrindo as
páginas elas abrem direto no painel."

A 2ª parte ("páginas abrem direto no painel", tipo um app só, sem sair da tela) foi avaliada e
**recusada** — explicado à usuária antes de implementar: cada módulo (Compras, Avisos, OS etc.) é um
projeto Apps Script separado, e **todo HTML deste projeto inteiro usa `<base target="_top">`** de
propósito, desde o início deste trabalho — ver spec de Avisos/Pipa/Higienização — porque o Apps Script,
quando servido dentro de outra página (iframe), às vezes redireciona pra um domínio de conteúdo temporário
(`*.googleusercontent.com`) que quebra navegação e histórico, deixando telas em branco ou botões sem
reação. Colocar esses apps "dentro" do Menu via iframe reintroduziria exatamente esse problema, em todos
os módulos, principalmente no celular — que é como a usuária mais acessa. Com a aprovação dela, o escopo
final ficou: **ícones na vertical** + **resumo do Kanban direto no Menu** (sem abrir a tela toda), mantendo
todos os outros módulos abrindo em tela cheia como já funcionava.

## O que mudou

### 1. Lista vertical (não mais grade)

`grid-template-columns` (grade 4 colunas) → `display: flex; flex-direction: column` (1 card por linha,
largura cheia). Cada card passa a mostrar ícone à esquerda + título/descrição à direita (`opcao-texto`),
em vez de ícone em cima/título embaixo — a descrição de cada módulo, que ficava escondida
(`display: none`) por falta de espaço na grade pequena, agora aparece, já que uma linha inteira sobra de
espaço.

### 2. Resumo do Kanban (`kanban-resumo`), card fixo no topo

Card novo, sempre o primeiro da tela, que busca a contagem de cards do Kanban por coluna direto do mesmo
backend que `Kanban.html` já usa (`avisos-appscript`, `?dados=kanban`) e mostra 3 números: A Fazer / Em
Andamento / Concluído — mesmas cores já usadas nas colunas do quadro (laranja/amarelo/verde). O card
inteiro é um link pro Kanban completo (`?tela=kanban`); clicar nele continua abrindo a tela cheia — não é
embutido, só o RESUMO é que aparece sem precisar entrar.

Esse fetch, como já acontecia ao abrir o Kanban.html, também aciona `gerarCardsRotinasDoDia()` no servidor
(chamado dentro de `listarCards()`) — efeito colateral bom: os cards de rotina do dia já ficam prontos
mesmo que a usuária nunca chegue a abrir a tela do Kanban.

Se o fetch falhar (rede, backend fora), o card continua sendo um link normal pro Kanban — só o número não
aparece, mostra "Não foi possível carregar o resumo." em vez de travar a tela toda (mesmo padrão de
degradação graciosa usado em todo o resto do projeto).

### 3. Card "Kanban" da lista removido

Como o resumo já linka pro Kanban, o card antigo (simples, sem número nenhum) ficaria redundante — removido
da lista. Lista agora tem 10 módulos (era 11); o resumo do Kanban é o 11º ponto de acesso, só que em
destaque no topo em vez de mais uma linha igual às outras.

## O que NÃO foi feito (e por quê)

- **Nenhum módulo abre "dentro" do Menu.** Avaliado e recusado — ver "Contexto" acima. Continuam como
  links normais que abrem a página cheia, exatamente como sempre funcionaram.
- **Nenhuma mudança no backend dos outros módulos** — só `Menu.html` foi tocado.

## Passo manual pra usuária

Colar `Menu.html` por cima do existente no projeto Apps Script do Painel Qualidade e reimplantar (Nova
versão). Nenhuma outra mudança — mesma URL de sempre.
