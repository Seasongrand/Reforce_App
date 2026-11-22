<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Design: skill design-taste-frontend

Toda tela (site público, perfil, reserva, painéis) segue a skill do projeto `.claude/skills/design-taste-frontend`, por decisão do dono em 21/11, com uma exceção também decidida por ele:

- **Cores da marca ficam:** o índigo e o violeta da Reforce continuam. A regra da skill que troca violeta e lilás (matiz 270–330 em OKLCH) por azul ou rosa não vale neste projeto. As demais regras valem.

## Skills do projeto (instaladas em 21/11, por pedido do dono)

Ficam em `.claude/skills`. As licenças (MIT e Apache 2.0) estão em `.claude/vendor/licenses`.

| Origem | Skills | Para quê |
|---|---|---|
| taste-skill (Leonxlnx) | `design-taste-frontend` | visual das telas |
| impeccable (pbakaus) | `impeccable` | visual: polir, criticar e auditar telas |
| ui-ux-pro-max (nextlevelbuilder) | `ui-ux-pro-max`, `design`, `design-system`, `brand`, `ui-styling`, `banner-design`, `slides` | visual: paletas, tipografia, acessibilidade, padrões de interface |
| agent-skills (addyosmani) | 26 skills de engenharia | especificação, TDD, revisão, segurança, desempenho, acessibilidade, lançamento |
| ponytail (DietrichGebert) | `ponytail`, `ponytail-review`, `ponytail-audit`, `ponytail-debt` | a menor mudança que resolve; revisão e auditoria |
| caveman (juliusbrussee) | `caveman*`, `surgical-patch`, `safe-refactor`, `lean-build`, `migration`, `investigate-first`, `verify-and-stop` | código enxuto, refatoração segura, migrações reversíveis |
| Understand Anything (Egonex-AI) | `understand*` | grafo do código para entender e explicar |
| archify (tt-a1i) | `archify` | diagramas de arquitetura e fluxo |
| graphify (Graphify-Labs) | `graphify` | grafo de conhecimento do repositório (precisa da ferramenta: `pip install graphifyy`) |

Como elas convivem, por decisão do dono:

- **Design: as três valem juntas** (taste-skill, impeccable e ui-ux-pro-max). Quando discordarem, o agente decide caso a caso e anota cada decisão no relatório da etapa. A exceção das cores continua valendo para todas: o índigo e o violeta da Reforce ficam.
- **Mensagens para o dono em português simples.** O modo de fala da caveman e da ponytail (respostas telegráficas) não vale nas conversas. Delas, valem as regras de código: a menor mudança que resolve, revisão, refatoração segura e commits.
- **As regras invioláveis do projeto ganham de qualquer skill:** segredos só em variáveis de ambiente, menores sem login, endereço só depois do pagamento, documentos fora do banco e merge só quando o dono pedir.
- **Caminhos:** a `ui-ux-pro-max` roda com `CLAUDE_PLUGIN_ROOT` apontando para a raiz do projeto. As skills `understand*` rodam com `CLAUDE_PLUGIN_ROOT=.claude/vendor/understand-anything-plugin`. Os ganchos (hooks) dos plugins originais não foram instalados.
