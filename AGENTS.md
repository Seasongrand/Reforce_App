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

Lote de 23/11, por pedido do dono, só com o que serve à Reforce (das 12 mil skills dos 50 repositórios pedidos, entraram 98):

| Origem | Skills | Para quê |
|---|---|---|
| emilkowalski/skills | `emil-design-eng`, `animate`, `review-animations`, `improve-animations`, `remove-animations`, `find-animation-opportunities`, `choreograph`, `gestures`, `animation-performance`, `animation-vocabulary`, `apple-design`, `mobile-native`, `break-ui`, `learn-taste`, `pick-ui-library`, `prototype`, `ask-emil` | movimento, acabamento e telas no celular |
| ibelick/ui-skills | `baseline-ui`, `improve-ui`, `fixing-accessibility`, `fixing-motion-performance`, `fixing-metadata`, `create-design-md`, `device-frames` | limpeza e auditoria de telas |
| anthropics/skills | `frontend-design`, `webapp-testing`, `skill-creator` | visual, testes no navegador, criar skills |
| cathrynlavery/diagram-design | `diagram-design` | diagramas |
| coreyhaines31/marketingskills | 29 skills: `copywriting`, `copy-editing`, `cro`, `signup`, `onboarding`, `launch`, `pricing`, `referrals`, `emails`, `seo-audit`, `ai-seo`, `schema`, `programmatic-seo`, `site-architecture`, `analytics`, `ab-testing`, `content-strategy` e outras | lançamento, textos, conversão e SEO |
| phuryn/pm-skills | 23 skills: `create-prd`, `user-stories`, `job-stories`, `pre-mortem`, `interview-script`, `user-personas`, `gtm-strategy`, `north-star-metric`, `privacy-policy` e outras | produto e pesquisa com professores e famílias |
| wshobson/agents | `nextjs-app-router-patterns`, `tailwind-design-system`, `postgresql-table-design`, `typescript-advanced-types`, `nodejs-backend-patterns`, `javascript-testing-patterns`, `e2e-testing-patterns`, `auth-implementation-patterns`, `sql-optimization-patterns`, `database-migration`, `gdpr-data-handling`, `github-actions-templates`, `secrets-management`, `postmortem-writing`, `incident-runbook-templates`, `avoid-ai-writing` | engenharia da pilha da Reforce |
| blader/humanizer | `humanizer` | texto sem cara de IA |
| OthmanAdi/planning-with-files | `planning-with-files` | planejamento em arquivos (sem os ganchos) |

Ficaram de fora, com o motivo: coleções gigantes que encheriam a lista de skills (agentic-awesome-skills, claude-skills do alirezarezvani, google/skills); temas fora da Reforce (pesquisa científica e acadêmica, Obsidian, vídeo, slides e design em chinês, persona e perfil pessoal, engenharia reversa); skills de invasão de sistemas (Claude-Red, Claude-BugHunter); repetidas (Jeffallan/claude-skills cobre o mesmo que wshobson; claude-seo repete o SEO do marketingskills); dependentes de chaves pagas (last30days); `doc-coauthoring`, sem licença no repositório. superpowers já vem como plugin da sessão. ponytail, ui-ux-pro-max, graphify, taste-skill, agent-skills, impeccable, archify e Understand-Anything já estavam instaladas.

Como elas convivem, por decisão do dono:

- **Design: todas valem juntas** (taste-skill, impeccable e ui-ux-pro-max; desde 23/11, também as de Emil Kowalski, as ui-skills e a frontend-design). Quando discordarem, o agente decide caso a caso e anota cada decisão no relatório da etapa. A exceção das cores continua valendo para todas: o índigo e o violeta da Reforce ficam.
- **Mensagens para o dono em português simples.** O modo de fala da caveman e da ponytail (respostas telegráficas) não vale nas conversas. As skills de texto (copywriting, humanizer, avoid-ai-writing) valem para os textos do site em português. Delas, valem as regras de código: a menor mudança que resolve, revisão, refatoração segura e commits.
- **As regras invioláveis do projeto ganham de qualquer skill:** segredos só em variáveis de ambiente, menores sem login, endereço só depois do pagamento, documentos fora do banco e merge só quando o dono pedir.
- **Caminhos:** a `ui-ux-pro-max` roda com `CLAUDE_PLUGIN_ROOT` apontando para a raiz do projeto. As skills `understand*` rodam com `CLAUDE_PLUGIN_ROOT=.claude/vendor/understand-anything-plugin`. Os ganchos (hooks) dos plugins originais não foram instalados.
