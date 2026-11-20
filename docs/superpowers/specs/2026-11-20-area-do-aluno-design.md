# Área do aluno — design

Aprovado pelo dono em 20/11 (“aprovado”), depois da proposta no chat.

## Por quê

Hoje “Minha conta” é uma página só, e só existe para quem já reservou. A família não consegue se cadastrar antes de escolher um professor, nem cuidar dos alunos e dos próprios dados. A área do professor já tem cara de produto; a do aluno deve seguir o mesmo molde.

## Decisões do dono (valem desde o projeto da área do professor)

- A conta é do adulto responsável; o aluno é só um perfil com primeiro nome e série (“menores sem login”).
- Pronta para a abertura, fechada enquanto o site estiver em lista de espera (o porteiro já bloqueia `/conta`).
- Visual Reforce no molde da Telavita, igual à área do professor.

## O que se constrói

1. **Criar conta sem comprar.** “Entrar” ganha “Criar conta” (`/conta/criar`): nome, e-mail, WhatsApp, avisos por WhatsApp (desmarcado) e, se quiser, o primeiro aluno (primeiro nome e série). O e-mail é confirmado por código. Sem duplicar contas: se o WhatsApp já tem conta, o código vai para o e-mail dela e a pessoa entra nela; senão, se o e-mail já tem conta, entra nela; senão, cria. A tela nunca diz se uma conta existe.
2. **Painel** com topo (“Reforce · Minha conta”, nome e “Sair”) e menu: Início, Aulas, Alunos, Meus dados (no celular, barra embaixo com os quatro).
   - **Início:** “Olá, <primeiro nome>”, cartões de próxima aula, alunos e aulas esperando avaliação, cada um com o estado vazio e a ação (buscar professor, cadastrar aluno).
   - **Aulas:** abas Próximas e Anteriores (como a do professor), com página da aula, agenda, avaliar e marcar de novo.
   - **Alunos:** cadastrar e editar primeiro nome e série; remover só aluno sem aula na conta.
   - **Meus dados:** mudar o nome; ligar e desligar os avisos por WhatsApp; trocar o e-mail com código enviado ao e-mail novo. Trocar o WhatsApp e excluir a conta: pela equipe, como explica a política de privacidade.
3. **Reserva com a conta aberta:** quem já entrou reserva sem preencher os dados de novo, inclusive quem ainda não cadastrou aluno (informa só o primeiro nome e a série).

## Abordagem

O mesmo do painel do professor e do da equipe: grupo de rotas próprio para `/conta` (os endereços não mudam), layout com `PanelNav`, regras no domínio (`src/domain/guardians/`) testadas com PostgreSQL real e o fluxo completo no Playwright. Outras opções descartadas: manter a página única com seções (não resolve o cadastro sem compra nem cresce) e um app separado para famílias (custo sem ganho).

## Fora do escopo

Excluir a conta e trocar o WhatsApp pela própria pessoa; vários responsáveis por aluno; endereços salvos em “Meus dados” (continuam sendo pedidos na reserva).
