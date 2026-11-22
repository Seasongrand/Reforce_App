# Cancelar e remarcar — design

Regra escolhida pelo dono em 21/11 (opção b): depois de reservar, a família pode cancelar ou remarcar; o professor é avisado na hora e o horário volta para a agenda dele.

## Regra

- **Com 24 horas ou mais até a aula:** a família cancela com devolução integral da aula, ou remarca.
- **Com menos de 24 horas:** a família só remarca (sem devolução).
- **Remarcar:** escolher outro horário livre do mesmo professor e do mesmo tipo de aula, sem pagar de novo. A aula antiga fica como “remarcada” e o horário dela volta a ficar livre.
- **Professor cancela aula paga** (especificação): a família recebe o valor integral de volta e é avisada.
- **Avisos na hora** (pela varredura de minuto em minuto): ao professor quando a família cancela ou remarca; à família quando o professor cancela, com a confirmação do que foi devolvido; lembretes de 24 h e 1 h para a nova data.

## Decisões minhas (o dono pode corrigir)

- **Limite de 2 remarcações por aula**, para a mesma aula não ser empurrada sem fim.
- O evento da aula antiga sai do Google Agenda do professor e o da nova entra.
- A devolução vai pelo mesmo meio do pagamento, pela tarefa de devolução que já existe.

## Fora

- Professor remarcar (ele cancela, e a família escolhe outro horário).
- Contar cancelamentos do professor na ordem da busca (é o item “confiabilidade na busca”).
