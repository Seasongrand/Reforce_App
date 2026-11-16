# Decisões tomadas durante a implementação da Fase 1

Decisões que o plano (`docs/superpowers/plans/2026-11-16-fase-1-motor-e-professor.md`) não fixava ou que mudaram ao implementar, com o custo de cada uma se estiver errada. As decisões de produto suas (16/11/2026) estão em `docs/pendencias.md`.

## Banco de dados

| Decisão | Por quê | Custo se errada |
| --- | --- | --- |
| As quatro extensões ficam em `0000_extensoes.sql` | Manter `0001` e `0002` como cópia literal do apêndice | Nenhum |
| `free_slots` em `0003`, funções da busca em `0004`; acréscimos da Fase 1 em `0005`, tabelas de desenvolvimento em `0006`, valor devolvido em `0007` | Cada função entra com os testes que a exercitam | Nenhum (só nomes de arquivo) |
| `refresh_next_slot` começa um dia antes (desvio aprovado) | `p_now::date` depende do fuso da sessão; o teste das 22h falhou com a versão literal | Nenhum: `free_slots` filtra por instante |
| O teste das 20 sessões só com a restrição aceita `40P01` além de `23P01` | Com transações realmente simultâneas, o PostgreSQL às vezes recusa as perdedoras por impasse; sempre grava exatamente uma | Nenhum para a aplicação, que usa a trava e trata `40P01` como “ocupado” |
| Colunas a mais: `lesson_sessions.checkin_attempts`, `teachers.created_at`, `payments.created_at`, `teacher_verifications.submitted_at`, `calendar_connections.last_error`, `auth_codes.payload`, `payments.refunded_cents` | Limite de tentativas do código, filas, dados pendentes do checkout e devolução sem duplicar | Colunas sem uso |
| `webhook_events.provider` guarda `payment:<nome>` e `video:<nome>` | Eventos de pagamento e de vídeo nunca colidem na chave única | Nenhum |
| A consulta de liberação do repasse também grava `release_attempted_at` | A conciliação precisa saber há quanto tempo o repasse está em `releasing` | Nenhum |

## Reserva e pagamento

| Decisão | Por quê | Custo se errada |
| --- | --- | --- |
| “Ocupado” mostra os horários livres mais próximos do pedido, do mais perto ao mais longe | O documento fala em “horários livres mais próximos” | Só a ordem na tela |
| Endereço sem coordenada (ou professor sem raio) pula a verificação do raio | Falta o serviço de CEP | O professor pode receber um endereço longe; está nas pendências |
| A criação da cobrança roda sob trava do pedido | Clique duplo em “pagar” não cria duas cobranças | A transação do pedido fica aberta durante a chamada ao provedor |
| Pagamento em dobro do mesmo pedido: o segundo é devolvido automaticamente | Não está no documento | A família teria de pedir ao suporte |
| Pagamento tardio depois do início da aula: devolve sem reocupar | A aula já não pode acontecer | Nenhum |
| A tarefa de devolução recebe o total que deve estar devolvido, não “devolva mais X” | Repetir a tarefa não devolve em dobro | Uma coluna a mais |
| Sem cookie de origem na Fase 1: a primeira reserva registra `teacher_link` | Toda família chega pelo link do professor; a origem “busca” vem com a busca, na Fase 2 | Nenhum agora |

## Aula e repasse

| Decisão | Por quê | Custo se errada |
| --- | --- | --- |
| Online: professor que entra depois de 15 min com o aluno presente conta como falta do professor; professor atrasado com aluno ausente, ou ninguém na sala, vai para decisão da equipe | O documento cobre os casos claros; os ambíguos ficam com pessoas | Mais decisões manuais |
| Falta do aluno com `STUDENT_NO_SHOW_TEACHER_PCT` abaixo de 100: repasse proporcional e devolução do resto | Torna a configuração coerente | Só vale se o padrão de 100 mudar; o comportamento da retenção do Asaas está nas pendências |

## Professor e painel

| Decisão | Por quê | Custo se errada |
| --- | --- | --- |
| Um cookie de sessão por tipo de usuário (professor, equipe, família) | A mesma pessoa pode ser professor e responsável | Nenhum |
| O armazenamento de arquivos ganhou `list(prefixo)` | A equipe vê todos os arquivos de cada verificação | Nenhum |
| Renovação da certidão só depois de a anterior vencer | Índice único de verificação ativa; o documento diz que o professor sai da venda até a nova ser aprovada | Professor fora de venda entre o vencimento e a nova aprovação |
| Titular da conta de recebimento com 18 anos ou mais; CPF/CNPJ validado antes de chamar o provedor | Evita chamadas inúteis ao provedor | Nenhum |
| Recusar um documento devolve o cadastro ao professor, com o motivo por e-mail; aprovar o perfil exige conta de recebimento ativa | O professor precisa saber o que corrigir; sem conta ativa, ele não recebe | Um passo a mais de reenvio |
| Regras semanais sobrepostas no mesmo dia são recusadas | `free_slots` não remove horários repetidos entre janelas sobrepostas | O professor precisa juntar as regras |
| Limites de serviço: duração de 30 a 240 min (múltiplos de 5), intervalos de 0 a 180 min, grade de 10, 15, 20, 30 ou 60 min | O documento não fixa | Mudar é simples |
| `/dev` exige `DEV_TOOLS=1`, ambiente que não seja produção e adaptadores falsos de pagamento e vídeo | Nenhuma simulação chega a produção | Nenhum |

## Testes

| Decisão | Por quê | Custo se errada |
| --- | --- | --- |
| Telas testadas pelo fluxo de ponta a ponta e por testes rápidos no navegador; as ações do servidor só chamam funções de domínio testadas | Ações do Next dependem de cookies e não rodam no Vitest | Pouco: a lógica fica nas funções testadas |
| O teste de ponta a ponta reserva a aula online; o serviço na casa do aluno é criado e o intervalo padrão de 30/30 conferido, mas a reserva presencial é coberta pelos testes de domínio | Manter o teste de ponta a ponta estável | O caminho presencial pela tela tem menos cobertura |

## Pendências menores da revisão final (não corrigidas)

- As rotas `/api/dev/pagar` e `/api/dev/presenca` aceitam `//host` como endereço de volta (redirecionamento aberto, só em desenvolvimento).
- `free_slots` pode devolver o mesmo início duas vezes quando um horário extra se sobrepõe a uma regra semanal (botão repetido na tela; a reserva continua única).
- O envio de mensagens mantém as linhas travadas enquanto chama o WhatsApp e o e-mail.
- O login da equipe responde um pouco mais rápido para e-mails sem acesso, porque não envia nada.
- `teachers_listed` usa a data do banco (UTC), e a aplicação usa a data de São Paulo para o vencimento das verificações: diferença de até 3 horas perto da meia-noite.
- O piso de preço é conferido ao criar ou editar um serviço, não no momento da reserva.
