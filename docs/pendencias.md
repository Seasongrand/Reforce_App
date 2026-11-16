# Pendências que dependem de você

Itens que o código trata como configuração provisória ou que dependem de uma
decisão, credencial ou validação externa. Cada etapa da Fase 1 acrescenta aqui
o que encontrar. Valores entre crases são variáveis de ambiente (veja
`.env.example`).

## Decisões de produto

| Tema | Situação no código | O que preciso de você |
| --- | --- | --- |
| Cidade de lançamento | Não afeta a Fase 1 (sem busca pública) | Definir a cidade do presencial |
| Disciplinas | Catálogo semeado com a sugestão do documento: Matemática, Física, Química e Redação | Confirmar ou trocar |
| Comissão | 15% para famílias da busca e 5% para as do link do professor, hipóteses do documento | Confirmar; decidir se cai para famílias recorrentes |
| Regra de cancelamento | Na Fase 1 não há cancelamento pela família. Falta do professor: reembolso integral automático. Falta do aluno: professor recebe 100% | Definir a regra (única ou opções por professor) e o formato da tabela `credits` |
| Piso de preço | `PRICE_FLOOR_CENTS`, começa em 0 | Definir o valor |
| Quem pode dar aula | Sem restrição no código | Só formados e licenciados, ou também universitários? |

## Credenciais e homologações

Os adaptadores reais ficam desligados até estas credenciais chegarem; o sistema roda com adaptadores falsos.

- Provedor de pagamento (Asaas): conta principal com CNPJ, chave de API, token do webhook, homologação de subcontas e da Conta Escrow.
- Vídeo (Daily ou Whereby): chave de API e configuração do webhook de presença.
- WhatsApp Cloud API: número da plataforma, token, identificador do número e modelos de utilidade aprovados.
- E-mail (Amazon SES ou equivalente): domínio verificado e credenciais.
- Google Cloud: projeto, OAuth (client id e secret) e pedido de verificação dos escopos `calendar.freebusy` e `calendar.app.created`.
- Geocodificação de CEP: serviço a escolher.
- Armazenamento privado de arquivos (S3 ou equivalente) para os documentos de verificação.
