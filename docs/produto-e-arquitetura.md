# Marketplace de aulas particulares: produto e arquitetura

Nov 14, 2026 · @Odimar

## Resumo executivo

**O produto passa a ser um marketplace no modelo das plataformas de terapia online: a família busca um professor verificado, reserva um horário real e paga na plataforma. A aula acontece por vídeo ou presencialmente, e o professor recebe depois que ela ocorre.**

As decisões que sustentam essa resposta:

- **Decisões suas.** Busca pública desde o lançamento, aula online e presencial, receita por comissão por aula. Empresas e escolas ficam para uma fase posterior.

- **O que entra.** Busca com filtros, perfil verificado, sala de vídeo, mensagens, avaliações e repasse depois da aula. Motor de agenda, regra de fuso e proteção contra reserva dupla continuam os mesmos.

- **Concorrência de horários.** A restrição de exclusão no PostgreSQL segue como garantia. A busca usa um retrato do próximo horário que pode atrasar; no teste, o retrato velho gerou recusa, não reserva dupla.

- **Dinheiro.** A família paga na plataforma. A parte do professor fica retida no provedor de pagamento e é liberada depois da aula. Comissão de partida: 15% para famílias vindas da busca e 5% para as que o professor trouxe, ambas hipóteses a testar.

- **Confiança.** Professor particular não tem conselho profissional como o CRP dos psicólogos. A verificação (identidade, antecedentes e formação) vira parte do produto, e o cliente é o responsável por um menor.

- **Maior risco.** Abrir a busca com pouca oferta. O plano concentra o lançamento em uma cidade e quatro disciplinas, com professores recrutados e verificados antes da abertura.

- **Mercado.** Superprof, Preply e Profes já ocupam “achar um professor”. O espaço livre está em agenda real, pagamento protegido e verificação, para pais de alunos do 6º ano ao ensino médio.

Prazo estimado até abrir a busca ao público: cerca de 16 semanas, com 2 a 3 pessoas em tempo integral e o recrutamento de professores em paralelo. É estimativa minha, não compromisso.

## Premissas e escopo

O produto é um marketplace de duas pontas: vende aula particular reservada e paga na plataforma, e cobra do professor uma comissão por aula realizada.

**Decisões suas, de 13/11/2026**

| Decisão                       | O que muda no desenho                                                                                                   |
|-------------------------------|-------------------------------------------------------------------------------------------------------------------------|
| Busca pública desde o dia 1   | O lançamento já traz busca, perfil, verificação e avaliações; a oferta de professores precisa existir antes da abertura |
| Aula online e presencial      | Sala de vídeo embutida; endereço, raio de atendimento e deslocamento entram no motor de agenda                          |
| Receita por comissão por aula | Divisão automática do pagamento; taxa menor para a família que o próprio professor trouxe                               |
| Empresas e escolas depois     | Nada é construído agora; o modelo de dados só não pode impedir um pagador que não seja a família                        |

**Objetivos**

- A família encontra um professor verificado com horário livre na semana, reserva e paga em menos de 5 minutos.

- Um horário nunca é vendido duas vezes, online ou presencial, nem colide com a agenda pessoal do professor.

- O professor recebe por toda aula que deu e nunca por aula que não aconteceu.

- O responsável vê tudo o que envolve o aluno: mensagens, aulas e avaliações.

**Fora do escopo do lançamento**

- Venda para empresas e escolas (fase 4).

- Gestão pedagógica: planos de aula, notas, boletins. Entra só um resumo da aula para o responsável, na fase 3.

- Aplicativo nativo, aula em grupo e gravação de aulas.

**O que seria fracasso mesmo funcionando**

- A busca mostrar professor sem horário livre ou com verificação vencida.

- Professor e família combinarem a segunda aula por fora, porque a plataforma custa mais do que entrega.

- Um menor conversar com um adulto em canal que o responsável não vê.

- A plataforma guardar dinheiro de terceiros na própria conta.

- O preço da aula ser tabelado pela plataforma, como no caso que rendeu à PsyMeet a acusação de “uberização”.

**Decisões que tomei por você.** Nenhuma veio do seu pedido; corrija as que não servirem.

| Decisão                                                                        | Motivo                                                           | Se mudar                                                                                  |
|--------------------------------------------------------------------------------|------------------------------------------------------------------|-------------------------------------------------------------------------------------------|
| Brasil, em reais e em português, com todos os fusos do país desde o início     | Modelar fuso certo custa pouco agora e muito depois              | Outros países pedem multimoeda e outro provedor de pagamento                              |
| A conta é do responsável; o aluno é um perfil sem login                        | Reduz os dados de menores guardados e simplifica o consentimento | Login de aluno exige autorização dos pais e mais salvaguardas                             |
| O professor define o próprio preço, com um piso da plataforma                  | Evita tabelamento e a crítica de precarização                    | Preço tabelado simplifica a busca e muda a relação com o professor                        |
| A parte do professor fica retida no provedor de pagamento e sai depois da aula | A família fica protegida e a plataforma não custodia valores     | Receber tudo e repassar simplifica pacotes, mas muda o enquadramento fiscal e regulatório |
| Lançamento em uma cidade para o presencial e em quatro disciplinas             | Poucas buscas precisam encontrar muitos professores              | Abrir o país inteiro espalha a oferta e a busca volta vazia                               |
| Verificação de professores feita por pessoas, sem fornecedor de biometria      | Volume pequeno e critério ainda em formação                      | Automatizar cedo custa por consulta e engessa o critério                                  |
| Monólito em TypeScript com PostgreSQL, para equipe de 2 a 3 pessoas            | Um deploy e uma base: menos peças para operar                    | Equipe maior pode separar serviços mais cedo                                              |
| Google Calendar primeiro; Outlook depois                                       | Hipótese: os professores-piloto usam conta Google                | Se usarem iPhone com iCloud, um feed de leitura entra antes do Outlook                    |
| WhatsApp pela API oficial, saindo de um número da plataforma                   | Estabilidade, sem risco para o número pessoal do professor       | Número próprio por professor exige cadastro de cada um na Meta                            |

## Modelo de referência: da terapia online para aluno e professor

As cinco plataformas que você citou não seguem um modelo só: três são vitrines em que o paciente escolhe o profissional, uma tabela o preço e uma funciona como clínica.

| Plataforma                                                                                                                              | Formato                                                                                                                                                                                             | Como ganha dinheiro                                                                                                                                                                                                                                                                                                                                                                              |
|-----------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| [Vittude](https://www.rdstation.com/blog/marketing/vittude/)                                                                            | Vitrine com buscador, agenda, pagamento e prontuário eletrônico ([Futuro da Saúde](https://futurodasaude.com.br/?p=4085)); consulta online ou presencial                                            | Plano pago pelo psicólogo mais percentual por consulta: em 2019, R\$ 239,70 por trimestre com 15%, ou R\$ 419,70 com 5%; em 2022, cerca de R\$ 299 por mês mais percentual ([Baguete](https://www.baguete.com.br/noticias/vittude-recebe-aporte-de-r-35-milhoes)). Empresas pagam valor fixo por funcionário ([Consumidor Moderno](https://consumidormoderno.com.br/investimento-saude-mental/)) |
| [Zenklub](https://braziljournal.com/zenklub-e-a-terapia-como-beneficio-corporativo)                                                     | Vitrine com questionário que indica profissionais; sessão por vídeo, áudio ou texto; conversa com o especialista antes de marcar ([App Store](https://apps.apple.com/app/apple-store/id1282953238)) | Sessão avulsa a partir de R\$ 60 ou pacote mensal. Em 2021, 40% da receita vinha de empresas, que pagam um valor mensal por vida                                                                                                                                                                                                                                                                 |
| [PsyMeet](https://iclnoticias.com.br/?p=103293)                                                                                         | Vitrine com preço social                                                                                                                                                                            | Assinatura mensal paga pelo psicólogo; a sessão custa R\$ 30, valor fixado pela plataforma                                                                                                                                                                                                                                                                                                       |
| [Psitto](https://www.psitto.com.br/)                                                                                                    | Vitrine só online, com 827 psicólogos de CRP conferido; a lista já mostra os próximos horários de cada um, e o psicólogo define o preço                                                             | Não aparece nas páginas que abri                                                                                                                                                                                                                                                                                                                                                                 |
| [Telavita](https://fusoesaquisicoes.com/acontece-no-setor/telavita-startup-de-saude-mental-para-empresas-chega-ao-ponto-de-equilibrio/) | Clínica digital, com corpo clínico e método próprios                                                                                                                                                | Contratos com empresas e planos de saúde                                                                                                                                                                                                                                                                                                                                                         |

O que as vitrines têm em comum: busca com filtros, perfil com registro profissional, agenda e pagamento na própria plataforma. A sessão nem sempre acontece em sala própria: na Psitto, o paciente escolhe entre WhatsApp, Google Meet e Zoom.

**O que copiar, o que adaptar e o que evitar**

| Nas plataformas de terapia                         | Na plataforma de aulas                                                | Por que não é cópia direta                                                                                                                                                                                                                        |
|----------------------------------------------------|-----------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Busca por especialidade, preço e horário           | Busca por disciplina, série, modalidade, bairro e preço               | A procura segue o calendário escolar, com picos antes de provas e recuperação                                                                                                                                                                     |
| Perfil com registro no conselho conferido          | Perfil com selo de verificação da própria plataforma                  | Não existe conselho de professores particulares; a verificação é produto seu                                                                                                                                                                      |
| Próximos horários já na lista (Psitto)             | Cartão do professor com o próximo horário livre                       | No presencial, o deslocamento entra na conta                                                                                                                                                                                                      |
| Pagamento antes da sessão                          | PIX ou cartão na reserva, com valor retido até a aula                 | Quem paga é o responsável, não quem assiste à aula                                                                                                                                                                                                |
| Sessão por vídeo                                   | Sala de vídeo embutida e aula presencial                              | O presencial não deixa registro automático de presença                                                                                                                                                                                            |
| Sigilo entre paciente e psicólogo                  | Transparência para o responsável: conversa visível e resumo da aula   | O usuário é menor; aqui o adulto precisa saber o que aconteceu                                                                                                                                                                                    |
| Conversa antes de marcar (Zenklub)                 | Mensagens na plataforma, com telefone oculto até a primeira aula paga | Protege o menor e reduz a combinação por fora                                                                                                                                                                                                     |
| Plano mensal e pacote de sessões                   | Horário fixo semanal com cobrança por aula                            | A relação de aula costuma ser mais curta e sazonal que a de terapia                                                                                                                                                                               |
| Benefício corporativo (Vittude, Zenklub, Telavita) | Empresas e escolas como pagadoras, na fase 4                          | Fica fora do lançamento por decisão sua                                                                                                                                                                                                           |
| Preço tabelado (PsyMeet)                           | Não copiar: o professor define o preço                                | Rendeu reportagem sobre “uberização” e defesa de piso de honorários pelo [CFP](https://site.cfp.org.br/em-reportagem-de-telejornal-cfp-defende-piso-para-atendimentos-por-convenios-e-aplicativos-contra-a-uberizacao-dos-servicos-psicologicos/) |

## 1. Jornadas: da busca à aula avaliada

A família vai da busca à aula paga em sete passos. O professor só vende depois de verificado e só recebe depois da aula.

**Família**

1.  **Chega pela busca ou pelo link de um professor.** A origem fica registrada na primeira visita e define a comissão.

    - Na busca, escolhe disciplina, série e modalidade; para aula presencial, informa o CEP.

2.  **Vê a lista de professores** com selo de verificação, nota, preço e próximo horário livre.

    - Só aparece quem tem horário na janela de agendamento e verificação em dia.

3.  **Abre o perfil:** formação, experiência, vídeo de apresentação, avaliações e a agenda dos próximos dias, calculada na hora.

    - Pode enviar uma pergunta ao professor pela plataforma.

4.  **Toca em um horário.** O sistema cria uma reserva temporária de 10 minutos e mostra o cronômetro.

    - Se outra família chegou antes, aparece “esse horário acabou de ser reservado”, com os horários livres mais próximos.

5.  **Entra na conta do responsável**, sem senha: nome, WhatsApp ou e-mail confirmado por código, primeiro nome e série do aluno.

    - Para aula em casa, informa o endereço. O professor só o vê depois do pagamento.

6.  **Paga por PIX ou cartão.** O QR expira junto com a reserva temporária, e a parte do professor fica retida no provedor.

7.  **Recebe a confirmação** na tela, no WhatsApp e no e-mail, com o acesso à sala de vídeo ou o código da aula presencial.

    - Os lembretes de 24 h e 1 h ficam agendados e a aula entra na agenda do professor.

**Depois da aula.** O responsável dá nota e comentário. Passadas 24 horas sem contestação, o professor recebe. A aula seguinte com o mesmo professor é marcada a partir da confirmação, sem refazer a busca.

**Professor**

1.  **Cadastra-se e monta o perfil:** disciplinas, séries, formação, vídeo curto e preço por modalidade.

2.  **Envia os documentos:** identidade com selfie e comprovante de formação. Quem dá aula presencial também envia a certidão de antecedentes criminais (decisão do dono, 22/11).

3.  **Passa pela análise da equipe.** O perfil só vende, pela busca ou pelo link próprio, depois de aprovado.

4.  **Abre a conta de recebimento** no provedor de pagamento, sem sair do painel.

5.  **Configura a agenda:** horários semanais, bloqueios, antecedência mínima, raio de atendimento e tempo de deslocamento. Conecta o Google Calendar.

6.  **Recebe a reserva paga** na agenda e no WhatsApp, e responde às mensagens pela plataforma.

7.  **Dá a aula** na sala de vídeo ou no endereço, onde digita o código informado pela família.

8.  **Recebe** a parte dele 24 horas depois da aula, se ninguém contestar. No cartão, vale o prazo de liquidação do provedor.

**Quando o aluno procura sozinho.** Ele navega na busca sem conta, escolhe professor e horário e toca em “enviar para meu responsável”. O WhatsApp dele abre com o link pronto; a reserva e o pagamento são feitos pelo adulto.

**Histórias de usuário e critérios de aceite**

| História                                                                      | Critério de aceite                                                                                    |
|-------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------|
| Como responsável, quero ver só professores verificados e com vaga             | Nenhum cartão aparece sem as três verificações em dia e sem horário livre na janela                   |
| Como responsável, quero ver horários realmente livres, no meu fuso            | Nenhum horário do perfil colide com aula, bloqueio ou compromisso ocupado do professor                |
| Como responsável, quero que o horário fique preso enquanto pago               | A segunda pessoa a tocar no mesmo horário recebe o aviso de ocupado, nunca um QR                      |
| Como responsável, quero meu dinheiro de volta se a aula não acontecer         | Falta do professor gera reembolso integral ou remarcação, à escolha da família, sem pedir comprovante |
| Como responsável, quero acompanhar o que o professor fala com meu filho       | Toda conversa acontece na conta do responsável; não existe canal separado para o aluno                |
| Como professor, quero receber por toda aula dada                              | O repasse sai 24 horas depois do fim da aula, sem ação do professor, salvo contestação                |
| Como professor, quero pagar menos comissão pelo aluno que eu trouxe           | A família que chegou pelo meu link fica marcada assim, mesmo que depois me encontre na busca          |
| Como professor de aula presencial, quero meu tempo de deslocamento respeitado | Nenhuma aula é oferecida dentro do intervalo de deslocamento que configurei                           |

**Desvios do caminho feliz**

| Situação                                                       | O que o sistema faz                                                                                              |
|----------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------|
| Reserva temporária expira sem pagamento                        | Libera o horário e cancela a cobrança; a página volta a oferecer a escolha                                       |
| PIX pago depois da expiração                                   | Tenta reocupar o mesmo horário; se já foi vendido, devolve o valor pela API do provedor e oferece outro          |
| A lista mostrou um horário que acabou de ser vendido           | A reserva é recusada pelo banco e a página oferece os horários mais próximos                                     |
| Professor não entra na sala em 15 minutos                      | Registra falta do professor; a família escolhe reembolso integral ou remarcação; o perfil perde posição na busca |
| Aluno não aparece                                              | O professor recebe conforme a regra de cancelamento; o responsável é avisado                                     |
| Família contesta a aula em até 24 horas                        | O repasse fica retido; o suporte decide com o registro da sala ou do código                                      |
| Professor cancela aula paga                                    | Reembolso integral ou outro professor; cancelamentos repetidos suspendem o perfil                                |
| Certidão do professor vence                                    | A aula presencial sai da busca até a nova certidão ser aprovada; a online continua                               |
| Telefone ou e-mail digitado na conversa antes da primeira aula | O trecho é ocultado e os dois são avisados do motivo                                                             |
| Responsável em outro fuso                                      | Vê tudo no próprio fuso; a confirmação cita os dois horários quando diferem                                      |

Os prazos de 15 minutos e de 24 horas são sugestões minhas.

## 2. Banco de dados: tempo, disponibilidade e concorrência

Quatro regras resolvem quase tudo: guardar instantes em UTC e regras em hora local, calcular a disponibilidade em vez de armazená-la, deixar o banco recusar a sobreposição e tratar a busca como um retrato que pode atrasar. O SQL desta seção foi executado em PostgreSQL 16.15, e os resultados aparecem em cada tópico.

### 2.1 Fuso horário: quatro tipos de dado, quatro tratamentos

| Dado                | Exemplo                      | Como guardar                                                  | Motivo                                                           |
|---------------------|------------------------------|---------------------------------------------------------------|------------------------------------------------------------------|
| Instante            | Início da aula de 17/11      | timestamptz                                                   | Ordena, compara e detecta conflito sem ambiguidade               |
| Regra recorrente    | “Toda terça, das 14h às 18h” | Dia da semana + time de início e fim + fuso IANA do professor | “14h” precisa continuar 14h se a regra do fuso mudar             |
| Hora combinada      | “Terça, 14h, em São Paulo”   | timestamp sem fuso + fuso IANA, na mesma linha do instante    | Permite recalcular o instante se a regra mudar depois da reserva |
| Fuso de quem agenda | America/Manaus               | Texto IANA no cadastro do responsável                         | Serve só para exibir horários e redigir mensagens                |

- **Guarde o nome do fuso, nunca o deslocamento.** America/Sao_Paulo sobrevive a mudanças de regra; -03:00 não. O horário de verão está suspenso desde 2019 e não volta em 2026/2027, mas pode voltar por decreto ([A Tarde](https://atarde.com.br/verao/vai-ter-horario-de-verao-em-2026-saiba-o-que-acontece-neste-ano-1408207)).

- **O Brasil tem quatro fusos.** Uma aula às 19h em Manaus acontece às 20h em São Paulo, às 21h em Fernando de Noronha e às 18h em Rio Branco.

- **Recorrência soma semanas na hora local, não horas no instante.** Com as regras de 2018, terça às 14h em São Paulo era 17:00 UTC em 30/10 e 16:00 UTC em 06/11. Somar 168 horas ao instante levou a aula para as 15h.

- **O dia depende de quem olha.** Um horário de 23h30 em Manaus cai em 00h30 do dia seguinte para quem está em São Paulo. Agrupe por data só depois de converter para o fuso de exibição.

- **Converta hora local em instante em um único lugar.** Para uma hora que se repete na virada do horário de verão, o PostgreSQL escolheu a segunda ocorrência e o Temporal, no modo compatible, a primeira.

- **Concilie quando a base de fusos mudar.** A consulta abaixo lista as aulas cujo instante deixou de corresponder à hora combinada.

SELECT id FROM bookings  
WHERE status IN ('held','confirmed')  
AND starts_at \<\> (local_start AT TIME ZONE timezone);

### 2.2 Tabelas e relacionamentos

Um professor tem perfil, verificações, serviços e regras; um responsável tem alunos e endereços; um pedido gera aulas e cobranças; cada aula concluída gera um repasse e pode receber uma avaliação.

| Tabela                 | Guarda                                                                                                                                   | Liga-se a                                       |
|------------------------|------------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------|
| subjects, grade_levels | Catálogo fechado de disciplinas e séries                                                                                                 | teacher_subjects, services                      |
| teachers               | Perfil público, situação na vitrine, fuso IANA, antecedência mínima, janela máxima, grade de horários, ponto-base e raio de deslocamento | calendar_connections                            |
| teacher_subjects       | O que o professor ensina: disciplina e série                                                                                             | teachers, subjects, grade_levels                |
| teacher_verifications  | Cada verificação (identidade, antecedentes, formação), com situação e validade; o arquivo fica em armazenamento privado                  | teachers                                        |
| services               | Como o professor vende: disciplina, modalidade, duração, preço, intervalo antes e depois                                                 | teachers, subjects                              |
| availability_rules     | Dia da semana, início e fim em hora local, vigência                                                                                      | teachers                                        |
| availability_overrides | Exceções por data: bloqueio (férias, feriado) ou horário extra                                                                           | teachers                                        |
| calendar_connections   | Conta Google ou Microsoft, token cifrado, calendários que bloqueiam e o que recebe as aulas                                              | teachers                                        |
| external_busy          | Intervalos ocupados vindos do calendário externo, sem título do evento (sincronização incremental)                                       | teachers                                        |
| teacher_search         | Uma linha por professor para a busca: texto, disciplinas, séries, notas e local aproximado                                               | teachers                                        |
| teacher_next_slot      | Retrato do próximo horário livre e do menor preço, por modalidade                                                                        | teachers                                        |
| guardians              | Responsável, dono da conta: nome, WhatsApp, e-mail, fuso, data do aceite de mensagens                                                    | students, addresses                             |
| students               | Primeiro nome e série                                                                                                                    | guardians                                       |
| addresses              | Endereço da família para aula presencial, com coordenadas                                                                                | guardians                                       |
| teacher_guardian_links | Origem de cada família para cada professor: busca ou link próprio                                                                        | teachers, guardians                             |
| messages               | Conversa entre responsável e professor, com marca de trecho ocultado                                                                     | teacher_guardian_links                          |
| orders                 | O que foi comprado: 1 aula ou pacote, total, prazo, chave de idempotência                                                                | teachers, guardians, students, services         |
| bookings               | Cada aula: instante, intervalo bloqueado, hora combinada, estado, modalidade, endereço, prazo da reserva temporária                      | orders, teachers, students, services, addresses |
| lesson_sessions        | O que aconteceu na aula: entradas na sala, tempo de cada um, código da aula presencial, desfecho                                         | bookings                                        |
| payments               | Cobrança no provedor: método, valor, taxa da plataforma, estado                                                                          | orders                                          |
| payouts                | Repasse por aula: valor bruto, comissão congelada, parte de cada um, data de liberação, estado                                           | bookings, teachers                              |
| disputes               | Contestação aberta por responsável, professor ou suporte                                                                                 | bookings                                        |
| reviews                | Nota e comentário, um por aula concluída, com resposta do professor                                                                      | bookings, teachers, guardians                   |
| webhook_events         | Cada evento recebido, único por provedor + identificador                                                                                 | payments                                        |
| notifications          | Mensagem agendada: canal, modelo, hora de envio, estado; única por aula + canal + modelo                                                 | bookings                                        |
| credits                | Aula a repor quando o cancelamento respeita a regra                                                                                      | guardians, teachers                             |
| booking_events         | Histórico de mudanças de estado, para auditoria                                                                                          | bookings                                        |

A tabela de aulas carrega a regra central do produto:

CREATE EXTENSION IF NOT EXISTS btree_gist;  
  
CREATE TABLE bookings (  
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),  
order_id uuid NOT NULL REFERENCES orders(id),  
teacher_id uuid NOT NULL REFERENCES teachers(id),  
student_id uuid NOT NULL REFERENCES students(id),  
service_id uuid NOT NULL REFERENCES services(id),  
starts_at timestamptz NOT NULL, -- instante  
ends_at timestamptz NOT NULL,  
blocked tstzrange NOT NULL, -- aula + intervalos, gravado pela aplicação  
local_start timestamp NOT NULL, -- hora combinada, sem fuso  
timezone text NOT NULL, -- fuso IANA do professor  
status booking_status NOT NULL DEFAULT 'held',  
hold_expires_at timestamptz,  
CHECK (ends_at \> starts_at),  
CHECK (blocked @\> tstzrange(starts_at, ends_at, '\[)')),  
CHECK (status \<\> 'held' OR hold_expires_at IS NOT NULL),  
CONSTRAINT no_double_booking EXCLUDE USING gist  
(teacher_id WITH =, blocked WITH &&)  
WHERE (status IN ('held','confirmed'))  
);

- **A restrição funciona como uma catraca.** Para o mesmo professor, o banco só deixa passar uma linha ativa por intervalo, não importa quantos servidores ou tarefas estejam gravando.

- **O intervalo é fechado no início e aberto no fim.** Aula das 14h às 15h não conflita com a das 15h.

- **blocked inclui descanso e deslocamento.** Com 10 minutos de intervalo, o teste aceitou 15h10 e recusou 15h00 depois de uma aula das 14h.

- **blocked é gravado pela aplicação.** Como coluna gerada a partir de timestamptz - interval, o PostgreSQL recusa com “generation expression is not immutable”.

- **O filtro por estado preserva o histórico.** Aula cancelada, expirada ou remarcada deixa de bloquear sem ser apagada.

- **PostgreSQL 18 tem WITHOUT OVERLAPS** para chaves primárias e únicas ([Neon](https://neon.com/postgresql/postgresql-18/temporal-constraints)). Aqui a restrição de exclusão continua sendo a ferramenta, por causa do filtro por estado.

| Estado      | Significado                                          | Bloqueia o horário |
|-------------|------------------------------------------------------|--------------------|
| held        | Reserva temporária, aguardando pagamento             | Sim, até expirar   |
| confirmed   | Aula paga                                            | Sim                |
| completed   | Aula dada                                            | Não                |
| no_show     | Aluno faltou                                         | Não                |
| cancelled   | Cancelada, com reembolso ou crédito conforme a regra | Não                |
| rescheduled | Substituída por outra aula                           | Não                |
| expired     | Reserva temporária venceu sem pagamento              | Não                |

**O que o marketplace acrescenta ao modelo**

- **Catálogo fechado.** Disciplina e série são códigos, não texto digitado: “Matematica”, “mat.” e “Matemática” viram a mesma busca.

- **Só entra na busca quem tem três verificações em dia.** A visão teachers_listed exige perfil aprovado e verificações não vencidas. No teste, a professora com certidão vencida ficou fora da lista.

- **Preço e comissão congelam na compra.** O pedido guarda o total e o repasse guarda a taxa aplicada; mudar o preço no perfil não altera aula já paga.

- **Um repasse e uma avaliação por aula.** payouts.booking_id e reviews.booking_id são chaves únicas.

- **Endereço é dado da aula.** Aula na casa do aluno sem endereço foi recusada pelo banco. A aplicação só mostra o endereço ao professor depois do pagamento.

- **A origem da família vale no primeiro contato.** No teste, o registro “link do professor” não foi sobrescrito por um registro posterior de “busca”.

- **Conversa só entre quem já tem vínculo.** Mensagem entre um professor e um responsável sem registro de origem foi recusada pela chave estrangeira.

### 2.3 Disponibilidade: calcular, não armazenar

Horários livres são uma subtração de conjuntos: as janelas do professor menos tudo o que o ocupa. Linhas de horário pré-geradas envelhecem a cada mudança de regra, duração ou compromisso externo.

1.  **Expandir as regras** semanais e os horários extras em intervalos de instantes, no fuso do professor.

2.  **Juntar o que ocupa:** aulas pagas, reservas temporárias ainda válidas, bloqueios por data e períodos ocupados do calendário externo.

3.  **Gerar candidatos** na grade do professor (por exemplo, a cada 30 minutos) dentro de cada janela.

4.  **Descartar** o candidato cujo intervalo bloqueado toca algo ocupado, ou que fere a antecedência mínima ou a janela máxima.

5.  **Converter** para o fuso de quem vê e só então agrupar por data.

O núcleo da consulta usa multirange, disponível desde o PostgreSQL 14. windows são as regras já expandidas e busy.mr é um único tstzmultirange com tudo o que ocupa o professor; a consulta completa está no apêndice “SQL testado”.

SELECT s AS starts_at  
FROM t, svc, busy, windows,  
LATERAL generate_series(lower(w),  
upper(w) - make_interval(mins =\> svc.duration_min),  
make_interval(mins =\> t.slot_step_min)) AS s  
WHERE s \>= now() + make_interval(mins =\> t.min_notice_min)  
AND s \< now() + make_interval(days =\> t.horizon_days)  
AND NOT busy.mr && tstzrange(  
s - make_interval(mins =\> svc.buffer_before_min),  
s + make_interval(mins =\> svc.duration_min + svc.buffer_after_min), '\[)')  
ORDER BY s;

No teste, com regras de terça (14h às 18h) e quinta (9h às 12h), uma aula paga, um compromisso do Google e um bloqueio de dia inteiro, a consulta devolveu exatamente os 8 horários esperados.

- **Grade e intervalo interagem.** Aula de 60 minutos com 10 de intervalo, numa grade de 30, perde 20 minutos por aula: depois de uma aula das 15h às 16h, o próximo início possível é 16h30. Aula de 50 minutos ou grade de 10 resolvem.

- **Deslocamento é intervalo do serviço presencial.** Com 30 minutos antes e depois, o teste recusou a aula presencial das 15h30 depois de uma online das 14h às 15h10 e aceitou a das 16h.

- **Entre duas presenciais seguidas os intervalos se somam.** No teste, a presencial seguinte só entrou às 18h, uma hora depois do fim da anterior. A folga a mais é proposital; rota real entre endereços fica para depois.

- **Retrato só na busca.** O perfil e a reserva calculam ao vivo. O retrato usado na lista de professores está no tópico 2.5.

- **Pacote semanal.** Gerar as datas somando semanas à hora local e gravar todas na mesma transação: entram todas ou nenhuma.

### 2.4 Concorrência: três camadas, com a garantia no banco

É a lógica do assento de cinema que fica “em compra” por alguns minutos: quem tocou primeiro segura o lugar enquanto paga, e o mesmo assento não é vendido duas vezes.

<img src="docs/media/media/image1.png" style="width:6in;height:3.66071in" alt="disputa pelo mesmo horário · 5 participantes, 10 mensagens" />

disputa pelo mesmo horário · 5 participantes, 10 mensagens

A aplicação tenta gravar as duas reservas e o PostgreSQL aceita só a primeira; o pagamento confirma a aula por uma atualização condicional.

| Camada                | O que garante                                                                    | Como                                                                  |
|-----------------------|----------------------------------------------------------------------------------|-----------------------------------------------------------------------|
| Restrição de exclusão | Duas aulas ativas do mesmo professor nunca se sobrepõem                          | EXCLUDE USING gist na tabela bookings                                 |
| Trava por professor   | “Verificar regras e gravar N aulas” acontece uma vez por vez para cada professor | pg_advisory_xact_lock no início da transação                          |
| Idempotência          | Clique, requisição ou notificação repetidos não criam nada novo                  | Chave única em orders e webhook_events; mudança de estado condicional |

Verificar com SELECT e depois gravar com INSERT, só na aplicação, não basta: entre um e outro a segunda requisição passa. Trava em Redis também não: ela expira e não deixa nenhuma regra no banco.

BEGIN;  
SELECT pg_advisory_xact_lock(hashtextextended('teacher:' \|\| \$1, 0));  
  
-- 1. reservas temporárias vencidas que estejam no caminho deixam de bloquear  
UPDATE bookings SET status = 'expired'  
WHERE teacher_id = \$1 AND status = 'held'  
AND hold_expires_at \< now() AND blocked && \$2;  
  
-- 2. revalidar o que a restrição não cobre: antecedência e limite diário  
  
-- 3. ocupar o horário; se alguém chegou antes, o banco responde 23P01  
INSERT INTO bookings (order_id, teacher_id, student_id, service_id,  
starts_at, ends_at, blocked, local_start, timezone,  
status, hold_expires_at)  
VALUES (\$3, \$1, \$4, \$5, \$6, \$7, \$2, \$8, \$9,  
'held', now() + interval '10 minutes');  
COMMIT;

**O que os testes mostraram**

- Só com a restrição, 20 sessões simultâneas no mesmo horário: 1 gravou e 19 receberam o erro 23P01.

- Com a trava e uma verificação prévia: 1 gravou e 19 receberam “ocupado”, sem erro.

- Reserva temporária vencida continua bloqueando até mudar de estado. O passo 1 resolve isso na hora, e uma varredura por minuto limpa o resto.

- Pacote de 4 semanas com conflito na terceira: a transação foi desfeita inteira e nenhuma aula ficou gravada.

**Pagamento e prazo**

- A reserva temporária dura 10 minutos e o QR do PIX expira 1 minuto antes. Assim, um pagamento no último segundo ainda encontra a reserva.

- A confirmação é condicional: UPDATE bookings SET status = 'confirmed' WHERE order_id = \$1 AND status = 'held'. Zero linhas alteradas significa notificação repetida ou pagamento tardio.

- No pagamento tardio, o sistema tenta gravar a aula de novo. Se a restrição recusar, devolve o valor pelo provedor e oferece outro horário.

- Toda notificação do provedor entra primeiro em webhook_events. A chave única descarta a repetição antes de qualquer efeito.

- Evento no Google e mensagens saem de tarefas enfileiradas na mesma transação que confirma a aula. Se a confirmação não gravar, nada é enviado.

**Calendário externo: coerência eventual, não transação**

- A restrição protege as aulas do sistema. Compromissos do Google chegam de fora, sem transação.

- O sistema consulta o livre/ocupado imediatamente antes de abrir a transação, com limite de 2 segundos, e nunca dentro dela.

- As aulas ficam em um calendário próprio (“Aulas”), fora da consulta de livre/ocupado, para o sistema não colidir consigo mesmo.

- Se o Google estiver fora do ar, a reserva segue com o último dado conhecido e gera alerta ao professor. É escolha minha: prefiro o risco raro de conflito a parar de vender.

- Compromisso criado sobre aula paga não cancela a aula; o professor é avisado.

### 2.5 Busca: o retrato pode atrasar, a reserva não

A lista de professores precisa mostrar o próximo horário livre de centenas de agendas. Calcular tudo ao vivo a cada busca não se sustenta; a lista usa um retrato guardado, e a reserva nunca confia nele.

É o painel de voos do aeroporto: pode estar um minuto atrasado, mas quem decide o embarque é o portão.

1.  **Índice de busca** (teacher_search): uma linha por professor, com texto sem acento, disciplinas, séries, notas e ponto-base. É refeita quando o perfil ou as avaliações mudam.

2.  **Retrato do próximo horário** (teacher_next_slot): por professor e modalidade. É refeito quando uma aula é reservada, cancelada ou expira, quando a agenda muda e por varredura periódica, porque o tempo passa e o horário mais próximo deixa de valer.

3.  **Consulta:** filtra por disciplina, série, modalidade, preço e, no presencial, distância; ordena por vaga na semana, nota e data do próximo horário.

4.  **Perfil:** ao abrir, os horários são calculados ao vivo, como em 2.3.

5.  **Reserva:** a transação de 2.4 decide. Se o retrato estava velho, o banco recusa.

SELECT t.display_name, ns.min_price_cents, ns.next_slot_at,  
round((ts.rating_sum + 4.5 \* 5)::numeric / (ts.rating_count + 5), 2) AS nota  
FROM teacher_search ts  
JOIN teachers_listed l ON l.id = ts.teacher_id -- aprovado, verificações em dia  
JOIN teachers t ON t.id = ts.teacher_id  
JOIN teacher_next_slot ns ON ns.teacher_id = ts.teacher_id AND ns.modality = \$3  
WHERE ts.subject_ids @\> ARRAY\[\$1\]::smallint\[\]  
AND ts.grade_ids @\> ARRAY\[\$2\]::smallint\[\]  
AND ns.min_price_cents \<= \$4  
AND ns.next_slot_at \> now() -- sem horário livre, não aparece  
ORDER BY (ns.next_slot_at \< now() + interval '7 days') DESC, nota DESC, ns.next_slot_at;

A versão com texto livre e distância está no apêndice.

**O que os testes mostraram**

- **Filtros e verificação.** Busca por Matemática, 9º ano, online: voltaram os dois professores esperados. A professora com certidão vencida ficou fora, mesmo com perfil aprovado.

- **Retrato velho não vende duas vezes.** Com o retrato ainda apontando 14h depois de a aula ser vendida, a segunda reserva foi recusada com 23P01. Refeito o retrato, o próximo horário passou a 15h30.

- **Nota com poucas avaliações.** A ordenação usa média bayesiana: cada professor começa com 5 notas de 4,5. Assim, 40 avaliações de média 4,8 (nota 4,77) ficam à frente de uma única nota 5 (4,58).

- **Texto sem acento.** “recuperacao” encontrou “Recuperação”. O PostgreSQL recusa unaccent em índice de expressão, por não ser imutável; por isso o texto fica em coluna própria, refeita por função.

- **Distância.** Na aula na casa do aluno vale o raio do professor: a 2,9 km com raio de 5 km, apareceu; a 10,1 km, não; com raio de 12 km, apareceu.

- **Volume.** Com 2.000 professores sintéticos, a busca levou cerca de 6 ms, e refazer os 2.000 retratos, 1,3 s, na máquina de teste. PostgreSQL basta; motor de busca separado só se a consulta ficar lenta.

**Duas decisões que não são técnicas**

- **Ordenação é decisão de produto.** Reserve posições da primeira página para professores novos. Sem isso, quem chegou primeiro concentra as avaliações e os demais nunca dão a primeira aula.

- **O local do professor é aproximado.** Guarda-se o centro do CEP, nunca o endereço; a lista mostra distância arredondada.

### 2.6 Depois da aula: presença, repasse e avaliação

O repasse é uma segunda sequência de estados, ligada à aula: o dinheiro só muda de dono quando há evidência de que a aula aconteceu e ninguém contestou.

<img src="docs/media/media/image2.png" style="width:6in;height:2.34821in" alt="caminho do dinheiro · 6 etapas, 1 decisão" />

caminho do dinheiro · 6 etapas, 1 decisão

A parte do professor fica retida desde o pagamento. Falta do professor ou contestação aceita devolvem o valor à família.

| Estado do repasse | Significado                                 | Avança quando                                                                |
|-------------------|---------------------------------------------|------------------------------------------------------------------------------|
| held              | Valor pago e retido no provedor             | A aula foi concluída, a janela de contestação fechou e não há disputa aberta |
| releasing         | Um processo assumiu a liberação             | O provedor confirma o fim da retenção                                        |
| released          | Parte do professor disponível na conta dele | Estado final                                                                 |
| refunded          | Valor devolvido à família                   | Estado final                                                                 |

- **Evidência na aula online.** O provedor de vídeo informa quem entrou e por quanto tempo. Os dois presentes: aula concluída. Só o professor: falta do aluno. Só o aluno: falta do professor, com reembolso.

- **Evidência na aula presencial.** A confirmação leva um código; a família o informa na chegada e o professor o digita no painel. Sem código, o sistema pergunta aos dois e abre contestação se divergirem.

- **Janela de contestação.** Sugestão: 24 horas depois do fim da aula. Passado o prazo, o repasse é liberado sem ação de ninguém.

WITH due AS (  
SELECT p.id  
FROM payouts p  
WHERE p.status = 'held'  
AND p.release_after \<= now()  
AND NOT EXISTS (SELECT 1 FROM disputes d  
WHERE d.booking_id = p.booking_id AND d.status = 'open')  
ORDER BY p.release_after  
LIMIT 50  
FOR UPDATE SKIP LOCKED -- outro processo pula o que este já pegou  
)  
UPDATE payouts p SET status = 'releasing'  
FROM due WHERE p.id = due.id  
RETURNING p.id, p.provider_escrow_id;

**O que os testes mostraram**

- Dois processos simultâneos e 4 repasses vencidos: um pegou 3, o outro pegou 1, e nenhum repasse caiu nos dois.

- O repasse com disputa aberta e o que ainda não tinha vencido continuaram retidos.

- Marcar como liberado é condicional (WHERE status = 'releasing'): 1 linha alterada na primeira vez, nenhuma na segunda.

- Um segundo repasse para a mesma aula foi recusado pela chave única.

- Avaliação: gravada para aula concluída e pelo responsável que comprou. A segunda tentativa, a de outro responsável e a de aula ainda não concluída não gravaram nada.

**Por que o estado intermediário**

- **O provedor não quer chamada repetida.** O Asaas pede que não se enviem várias solicitações de encerramento para a mesma retenção ([documentação](https://docs.asaas.com/docs/desbloqueio-dos-valores)). Se a resposta se perder, o sistema consulta a retenção antes de tentar de novo.

- **Comissão congelada.** O repasse guarda a taxa aplicada na reserva. No teste, R\$ 121,00 a 15% deram R\$ 18,15 para a plataforma e R\$ 102,85 para o professor; uma restrição exige que as duas partes somem o total.

## 3. Stack tecnológica e integrações

O monólito TypeScript com PostgreSQL continua cobrindo o produto. O marketplace acrescenta quatro peças: sala de vídeo, busca, verificação de professores e repasse com retenção. Cada serviço externo fica atrás de uma interface própria, para ser trocado sem tocar no motor de reservas.

<img src="docs/media/media/image3.png" style="width:6in;height:3.46428in" alt="arquitetura · 3 públicos, 1 aplicação, 1 banco, 6 integrações" />

arquitetura · 3 públicos, 1 aplicação, 1 banco, 6 integrações

Só a aplicação fala com o banco e com os serviços externos; as notificações deles entram pela mesma API.

### 3.1 Três caminhos para o motor de agenda

| Caminho                                                                            | Ganho                                                                                                | Custo                                                                                                 | Decisão                                   |
|------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------|-------------------------------------------|
| Construir sobre PostgreSQL                                                         | Controle total da reserva temporária presa ao pagamento, dos pacotes e do modelo responsável e aluno | O núcleo de disponibilidade é seu para escrever e manter                                              | Recomendado                               |
| Partir do [Cal.diy](https://github.com/calcom/cal.diy), o código aberto do Cal.com | Agenda e integrações com Google e Microsoft prontas, sob licença MIT                                 | Base grande em Prisma e tRPC; o próprio repositório a recomenda só para uso pessoal, fora de produção | Usar como leitura de referência           |
| Contratar uma API de agenda (Cal.com Platform, Nylas)                              | Google, Outlook e iCloud sem escrever sincronização                                                  | Dependência e custo recorrentes; a regra “só confirma se pagar” fica fora do seu banco                | Reavaliar quando Outlook e iCloud pesarem |

O Cal.com fechou o código da edição comercial em abril de 2026 e relançou a parte aberta como Cal.diy ([Cal.com](https://cal.com/blog/calcom-v6-4)).

Com busca, repasse e verificação no mesmo banco das reservas, nenhuma das alternativas prontas cobre o lado marketplace. Construir deixa de ser só preferência.

### 3.2 Stack recomendada

| Camada             | Escolha                                                                                 | Observação                                                                                                                                                                                            |
|--------------------|-----------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Aplicação          | Next.js com TypeScript, em um repositório                                               | Busca e perfis renderizados no servidor, o que ajuda a aparecer no Google; API, webhooks e painel interno no mesmo deploy                                                                             |
| Banco              | PostgreSQL 16 ou superior, gerenciado                                                   | Os testes usaram as extensões btree_gist, unaccent, cube e earthdistance; confirme que o serviço gerenciado oferece as quatro                                                                         |
| Busca              | O próprio PostgreSQL                                                                    | Texto com tsvector, filtros em vetores com índice GIN e distância com earthdistance; PostGIS se precisar de polígonos de bairro                                                                       |
| Acesso a dados     | Drizzle ou Kysely                                                                       | A restrição de exclusão e as colunas de intervalo são criadas em SQL puro, na migração                                                                                                                |
| Datas              | API Temporal com temporal-polyfill                                                      | Nativa no Chrome 144, Firefox 139 e Node 26; o Safari ainda não publicou versão com ela, então iPhone depende do polyfill ([TC39](https://cdn.jsdelivr.net/gh/tc39/proposal-temporal@main/README.md)) |
| Fila e agendamento | pg-boss ou Graphile Worker                                                              | A fila mora no PostgreSQL; cuida de lembretes, retratos da busca e liberação de repasses                                                                                                              |
| Vídeo              | Sala embutida de um provedor (3.6)                                                      | Atrás de uma interface própria, para trocar de fornecedor                                                                                                                                             |
| Arquivos           | Armazenamento privado e cifrado para os documentos de verificação                       | Acesso por link temporário, só para quem analisa                                                                                                                                                      |
| Painel interno     | Área restrita da mesma aplicação                                                        | Fila de verificação, contestações, reembolsos e denúncias                                                                                                                                             |
| Localização        | CEP convertido em coordenadas por um serviço de geocodificação, a escolher no protótipo | Guardar só o centro do CEP do professor                                                                                                                                                               |
| Hospedagem         | Um contêiner web e um worker, com PostgreSQL gerenciado em São Paulo                    | Em AWS: ECS Fargate, RDS e SES na região sa-east-1                                                                                                                                                    |
| E-mail             | Amazon SES ou equivalente                                                               | Cópia de toda mensagem enviada por WhatsApp                                                                                                                                                           |
| Observabilidade    | Erros, logs estruturados e alarme para webhook sem tráfego                              | Webhook parado é aula paga sem confirmação                                                                                                                                                            |

### 3.3 Calendário

- **Primeira versão: livre/ocupado sob demanda.** A chamada freebusy.query do Google devolve só os períodos ocupados. A plataforma nunca lê título nem participantes dos compromissos pessoais do professor.

- **Escopos estreitos.** calendar.freebusy para ler a ocupação e calendar.app.created para criar o calendário “Aulas” e gerenciar só os eventos dele ([escopos da API](https://developers.google.com/workspace/calendar/api/auth)). Confirme no primeiro protótipo se esse par basta para o seu caso.

- **Link da aula.** A confirmação leva à sala de vídeo da plataforma (3.6); o evento no calendário aponta para a mesma página.

- **Fase 3: sincronização incremental.** events.list com syncToken devolve só o que mudou, e a resposta 410 pede sincronização completa ([guia de sincronização](https://developers.google.com/workspace/calendar/api/guides/sync)). As notificações chegam sem conteúdo, o canal expira sem renovação automática e a entrega não é garantida; mantenha uma sincronização periódica de segurança ([guia de notificações](https://developers.google.com/workspace/calendar/api/guides/push)).

- **Verificação do app na Google.** Em modo de teste, o limite é de 100 usuários e a autorização expira em 7 dias. Publicado sem verificação e com escopos sensíveis, o app fica limitado a 100 usuários e mostra tela de alerta ([Google](https://developers.google.com/identity/protocols/oauth2/production-readiness/overview)).

- **O que a verificação pede.** Política de privacidade no mesmo domínio da página inicial, domínio verificado, vídeo de demonstração e justificativa por escopo; a Google fala em até 10 dias ([requisitos](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification)).

- **Outlook.** O Microsoft Graph tem consulta de disponibilidade e notificações de mudança. As assinaturas de eventos do Outlook duram no máximo 10.080 minutos e precisam de renovação ([Microsoft](https://learn.microsoft.com/en-us/graph/change-notifications-overview)).

- **iCloud.** Não há API equivalente; o caminho é CalDAV com senha específica de app, mais trabalhoso. Deixe por último.

### 3.4 Pagamento, comissão e repasse

O provedor precisa entregar cinco coisas:

1.  Conta do professor como recebedor, com divisão automática da comissão.

2.  Retenção da parte do professor até a aula, com liberação por API.

3.  PIX com expiração curta, ou cancelamento da cobrança por API.

4.  Notificação de pagamento e devolução por API.

5.  Cartão e recorrência por Pix Automático na mesma integração.

| Provedor                                                                                                                                   | Como o professor entra                                                                   | Expiração do PIX                                                                                                                                                                                               | A favor                                                                                | Contra                                                                                                                           |
|--------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------|
| [Asaas](https://docs.asaas.com/docs/criacao-de-subcontas)                                                                                  | Subconta criada por API, pessoa física ou jurídica, com divisão automática               | O QR da cobrança vale por 12 meses após o vencimento; use QR estático com expirationSeconds, o Checkout (10 a 1.440 min) ou cancele a cobrança ([documentação](https://docs.asaas.com/docs/cobrancas-via-pix)) | PIX, cartão, divisão, retenção por subconta e Pix Automático em uma API; preço público | A conta principal precisa de CNPJ; na avaliação inicial, até 10 subcontas e R\$ 2.000 em cobranças por subconta, por até 60 dias |
| [Mercado Pago](https://www.mercadopago.com.br/developers/pt/docs/split-payments/split-1-1/integration-configuration/integrate-marketplace) | O professor autoriza a conta que já tem (OAuth); a comissão vai no campo application_fee | De 30 minutos a 30 dias ([documentação](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/payment-integration/websites/pix))                                                               | Entrada em um clique para quem já usa                                                  | Reserva temporária de pelo menos 30 minutos, ou cancelamento ativo da cobrança                                                   |
| [Pagar.me](https://docs.pagar.me/reference/pix-2)                                                                                          | Recebedores cadastrados, com divisão                                                     | expires_in, em segundos                                                                                                                                                                                        | Expiração no segundo                                                                   | PIX com divisão só para contas com afiliação Pagar.me                                                                            |
| [Efí](https://dev.efipay.com.br/docs/api-pix/cobrancas-imediatas)                                                                          | API Pix no padrão do Banco Central, com divisão                                          | Campo calendario.expiracao na criação da cobrança                                                                                                                                                              | PIX com expiração curta nativa                                                         | Confirmar cartão e recorrência caso a caso                                                                                       |

**Minha escolha: Asaas**, por cobrir os cinco itens em uma integração, incluindo a retenção por subconta. Peça a homologação das subcontas e da retenção na semana 0, para o piloto não bater no teto da avaliação.

- **Custo de referência.** Na [tabela pública do Asaas](https://www.asaas.com/precos-e-taxas), PIX custa R\$ 1,99 por cobrança recebida (R\$ 0,99 nos três primeiros meses) e cartão à vista, 2,99% + R\$ 0,49, com recebimento em cerca de 32 dias sem antecipação. Numa aula de R\$ 100, o PIX sai por 2%.

- **Taxa fixa pesa em aula barata.** Compare com provedores de taxa percentual antes de fechar.

- **Isole o provedor.** Uma interface com cinco operações (criar cobrança, cancelar, devolver, liberar retenção, tratar notificação) permite trocar ou somar provedores.

- **CPF do pagador.** Alguns provedores exigem; confirme no protótipo, porque é um campo a mais no formulário.

- **Cartão desde o lançamento.** Psitto e Zenklub aceitam PIX e cartão, e as famílias esperam o mesmo. O cartão traz a contestação de compra, que pode chegar depois do repasse; defina nos termos quem arca e confirme com o provedor como o valor é recuperado.

- **Cartão atrasa o repasse.** Sem antecipação, a venda no cartão só fica disponível em cerca de 32 dias. O repasse em 24 horas vale para PIX; antecipar tem custo, e alguém precisa pagá-lo.

- **Stripe.** Contas brasileiras aceitam PIX avulso com liquidação em reais, mas o pagador vê EBANX como recebedor, e o Pix Automático não está disponível para empresa sediada no Brasil ([Stripe](https://docs.stripe.com/payments/pix)).

**Retenção até a aula: a Conta Escrow do Asaas**

- **O que faz.** Retém o que a subconta do professor recebe; o valor não entra no saldo dele até a retenção terminar ([Asaas](https://docs.asaas.com/docs/introducao-conta-escrow)).

- **Como termina.** Na data de expiração, por chamada de API que encerra a retenção de uma cobrança, ou ao desligar o recurso na subconta ([liberação](https://docs.asaas.com/docs/desbloqueio-dos-valores)).

- **O prazo é da subconta, não da cobrança.** O campo daysToExpire é configurado por professor ([divisão com retenção](https://docs.asaas.com/docs/split-para-contas-com-conta-escrow)). O desenho usa um teto, igual à janela máxima de agendamento mais a contestação, e encerra cada retenção por API depois da aula.

- **Uma retenção por cobrança.** Um pacote pago de uma vez gera uma retenção só, e não encontrei liberação parcial na documentação. Por isso o lançamento vende aula avulsa e, depois, horário fixo com cobrança por aula.

- **Custo.** Há mensalidade por subconta com o recurso ligado, paga pela conta principal ou pelo professor ([cobrança da taxa](https://docs.asaas.com/docs/cobran%C3%A7a-da-taxa-por-subconta-configurada)). As páginas que abri não trazem o valor; um trecho da mesma documentação, visto em resultado de busca, citava R\$ 99,90 por mês na conta principal e R\$ 9,90 por subconta. Confirme no painel de taxas.

- **Sem aviso de liberação.** Não há webhook para mudança de estado da retenção; o sistema consulta a retenção para conciliar ([valores sob garantia](https://docs.asaas.com/docs/bloqueio-dos-valores)).

- **Reembolso com valor retido.** A documentação que abri não descreve o estorno de uma cobrança com retenção ativa. Teste no ambiente de testes antes de prometer reembolso em um toque.

- **Alternativa sem retenção.** Receber na conta principal e transferir ao professor depois da aula, padrão que o Asaas indica para repasse em data futura ([dúvidas do split](https://docs.asaas.com/docs/duvidas-frequentes-split)). Resolve pacotes, mas o valor inteiro passa pela conta da plataforma: efeito fiscal e regulatório a validar com contador.

**Comissão: ponto de partida**

A conta usa uma aula de R\$ 100 como exemplo e as tarifas públicas citadas neste documento. As duas taxas de comissão são hipóteses minhas.

| Origem da família | Comissão | Professor recebe | Sobra para a plataforma, com PIX | Sobra para a plataforma, com cartão |
|-------------------|----------|------------------|----------------------------------|-------------------------------------|
| Busca             | 15%      | R\$ 85,00        | R\$ 12,90                        | R\$ 11,41                           |
| Link do professor | 5%       | R\$ 95,00        | R\$ 2,90                         | R\$ 1,41                            |

A sobra já desconta a tarifa do provedor e três mensagens de WhatsApp (R\$ 0,11). Falta descontar o vídeo, que custa US\$ 0,48 por aula online de 60 minutos fora da franquia, além de suporte e contestações.

- **Leitura.** Os 5% do link mal cobrem o custo: são preço para atrair professores, não fonte de lucro. O resultado vem das famílias que a busca traz.

- **Referências de mercado.** A Preply fica com 100% da aula experimental e com 18% a 33% das seguintes ([Preply](https://help.preply.com/pt-BR/articles/4171383-modelo-de-comissao-da-preply)). A Vittude combinava plano e 5% a 15% por consulta. A Superprof não cobra comissão ([página do professor](https://www.superprof.com.br/dar-aulas-particulares/?gad_source=1)) e vende à família um passe de R\$ 69 por mês ([termos](https://www.superprof.com.br/tcgu.html)).

- **Como a divisão é montada.** O professor recebe valor fixo, calculado sobre o preço cheio; a plataforma fica com o restante e absorve a tarifa do provedor. No Asaas, o percentual de divisão incide sobre o valor líquido; daí o valor fixo.

### 3.5 WhatsApp

- **Caminho.** WhatsApp Business Platform (Cloud API), direto com a Meta, com um número da plataforma.

- **Preço no Brasil desde 1º/10/2026.** Cerca de R\$ 0,035 por mensagem de utilidade entregue e R\$ 0,32 por mensagem de marketing ([Vectalk](https://vectalk.com.br/blog/en/whatsapp-api-pricing-brazil/), a partir da tabela em reais da Meta). Confirmação e dois lembretes somam perto de R\$ 0,11 por aula.

- **Mudança recente.** Desde essa data, mensagem de utilidade dentro da janela de 24 horas também é cobrada, e as respostas livres têm franquia de 1.000 por número por mês ([Meta](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing)).

- **Categoria importa.** Lembrete de aula com botões de confirmar e remarcar é utilidade. Texto com tom promocional é reclassificado como marketing, cerca de 9 vezes mais caro ([Wati](https://support.wati.io/en/articles/15932488-best-practices-to-reduce-whatsapp-utility-to-marketing-template-reclassification)).

- **Aceite.** O responsável autoriza as mensagens ao criar a conta. Sem aceite, só e-mail.

- **Código de acesso.** O login sem senha usa código por e-mail como padrão. Por WhatsApp, o código é mensagem de autenticação, categoria com preço próprio na tabela da Meta.

- **A conversa entre família e professor fica na plataforma.** O WhatsApp só avisa que há mensagem nova, com link para a conversa.

- **Do aluno para o responsável.** O link do professor e do horário sai do WhatsApp do próprio aluno, por compartilhamento, sem custo e sem modelo aprovado.

- **Fora da lista: bibliotecas não oficiais.** Conectores como o Baileys violam os termos do WhatsApp e expõem o número a banimento ([Hora de Codar](https://horadecodar.com.br/evolution-api-vs-api-oficial-whatsapp/)).

- **Número do professor.** O recurso de coexistência permite usar o mesmo número no aplicativo WhatsApp Business e na Cloud API ([360dialog](https://docs.360dialog.com/docs/hub/embedded-signup/whatsapp-coexistence)). Fica fora do plano: no marketplace, as mensagens saem da plataforma.

- **Plano B.** Todo envio tem cópia por e-mail. Se um modelo for pausado, o e-mail segura a operação.

### 3.6 Sala de aula por vídeo

A sala é um provedor de vídeo embutido na página da aula; construir vídeo próprio não se paga neste estágio.

| Provedor                                                             | Preço público                                                         | Franquia mensal               | Observação                                                                                                                                                                                                                                   |
|----------------------------------------------------------------------|-----------------------------------------------------------------------|-------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| [Daily](https://www.daily.co/pricing/video-sdk/)                     | US\$ 0,004 por participante-minuto                                    | 10.000 minutos                | A Deepgram anunciou a compra da Daily em 29/10/2026 e diz que mantém venda e suporte dos produtos atuais ([audioXpress](https://audioxpress.com/news/deepgram-acquires-daily-to-build-open-conversational-voice-ai-platform-around-pipecat)) |
| [Whereby Embedded](https://whereby.com/information/embedded/pricing) | US\$ 10,99 por mês mais US\$ 0,0042 por participante-minuto excedente | 2.000 minutos                 | Sala pronta para embutir: o caminho mais curto. O plano grátis limita a reunião a 30 minutos                                                                                                                                                 |
| [LiveKit Cloud](https://livekit.com/pricing.md)                      | US\$ 50 por mês com 150.000 minutos; excedente a US\$ 0,0005          | 5.000 minutos no plano grátis | Mais barato em volume; exige montar a interface da sala                                                                                                                                                                                      |

- **Conta por aula.** Professor e aluno por 60 minutos são 120 participante-minutos: US\$ 0,48 no preço de tabela da Daily. Com o responsável assistindo, US\$ 0,72. A franquia da Daily cobre cerca de 83 aulas por mês.

- **Minha escolha para o lançamento.** Uma sala pronta (Whereby ou Daily) atrás de uma interface com três operações: criar sala, emitir acesso por participante e receber o registro de presença.

- **O que a sala precisa ter.** Tela compartilhada, entrada só para os participantes da reserva, responsável como observador e registro de quem entrou e quando.

- **Por que não só um link do Meet.** Sem sala própria, a plataforma perde a evidência de que a aula aconteceu, que é o que libera o repasse e resolve contestações.

- **Sem gravação no lançamento.** Gravar menores pede base legal e guarda segura; o registro de presença basta para o repasse.

- **A validar no protótipo.** Qualidade a partir do Brasil em rede móvel, entrada restrita por participante e registro de presença por webhook.

### 3.7 Verificação de professores e segurança

Na terapia, o registro no conselho responde à pergunta “esse profissional é quem diz ser?”. Aqui a plataforma precisa responder sozinha, e o aluno é menor.

| Verificação            | Como é feita                                                                                                                                                                                             | Validade                                                                                                             |
|------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------|
| Identidade             | Documento com foto e selfie, conferidos por uma pessoa da equipe                                                                                                                                         | Única                                                                                                                |
| Antecedentes criminais | Certidão da Polícia Federal, que o próprio professor emite pela internet, de graça; a equipe confere no validador da PF ([Polícia Federal](https://www.gov.br/pf/pt-br/assuntos/antecedentes-criminais)) | A certidão vale 90 dias; renovar a cada 6 meses, prazo que a lei abaixo fixa para instituições com recursos públicos |
| Formação               | Diploma, histórico ou declaração de matrícula                                                                                                                                                            | Única                                                                                                                |

- **Base legal a confirmar.** O artigo 59-A do ECA, incluído pela [Lei 14.811/2024](https://legis.senado.leg.br/norma/38157392/publicacao/38158500), manda estabelecimentos educacionais e similares manterem certidões de antecedentes atualizadas de seus colaboradores. Se um marketplace se enquadra é pergunta para advogado; adotar a prática é decisão de produto.

- **A certidão não cobre tudo.** Ela informa registros nos sistemas da Polícia Federal. Quem tem homônimo pode não conseguir emitir pela internet ([gov.br](https://www.gov.br/pt-br/servicos/emitir-certidao-de-antecedentes-criminais)). Trate a falta de certidão como pendência, não como reprovação automática.

- **Documentos ficam fora do banco.** Armazenamento privado e cifrado, acesso por link temporário e descarte do que não precisa ser guardado depois da decisão.

- **Conversa sempre visível ao responsável.** A conta é do adulto; não existe canal privado entre professor e aluno.

- **Aula presencial.** Endereço liberado só depois do pagamento; adulto em casa na primeira aula, como regra da plataforma; denúncia grave suspende o perfil até a análise.

- **Uma fila só.** Verificações, avaliações denunciadas, contestações e denúncias caem no mesmo painel interno, com prazo de resposta definido.

## 4. Estratégia de produto: onde este marketplace ganha

“Achar um professor” já tem dono no Brasil. O espaço livre é o que as plataformas de terapia fazem bem e as de aula deixam em aberto: agenda real, pagamento protegido e confiança para os pais.

O Calendly deixa de ser a comparação. Ele cobra na reserva, mas pelo Stripe não aceita real nem PIX ([Calendly](https://calendly.com/payments), [central de ajuda](https://help.calendly.com/hc/en-us/articles/14077985848215)), e não tem busca, verificação nem repasse.

**Quem já está no mercado de aulas**

| Plataforma                                                                                                                                                            | Como funciona                                                                                                                                   | Como cobra                                                                                               |
|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------|
| [Superprof](https://www.superprof.com.br/tcgu.html)                                                                                                                   | Anúncios de professores; a família paga para pedir aulas e combina tudo direto com o professor. A plataforma não participa do pagamento da aula | Passe Aluno de R\$ 69 por mês; nenhuma comissão; destaque de anúncio para o professor por R\$ 269 ao ano |
| [Preply](https://help.preply.com/pt-BR/articles/4171383-modelo-de-comissao-da-preply)                                                                                 | Marketplace voltado principalmente a idiomas, com aula experimental e sala de aula própria                                                      | 100% da aula experimental e 18% a 33% das seguintes, conforme as horas dadas                             |
| [TutorMundi](https://www.prnewswire.com/br/comunicados-para-a-imprensa/tutormundi-amplia-atuacao-e-passa-a-oferecer-beneficio-educacional-corporativo-302530222.html) | Monitoria escolar e aulas sob demanda                                                                                                           | Vende a escolas e famílias e, desde 2025, a empresas, como benefício                                     |

A [Profes](https://apps.apple.com/us/app/-/id1479204191) informa mais de 50 mil professores e um tira-dúvidas por IA; não encontrei a tabela de comissão dela.

**Onde ganhar**

- **Nicho com dono: pais de alunos do 6º ano ao ensino médio.** Filtros por série e objetivo (recuperação, prova bimestral, ENEM), linguagem para o responsável e resumo depois da aula.

- **Reserva de verdade.** Horário real na lista, pagamento na hora e aula garantida ou dinheiro de volta. No modelo de anúncios, a família paga para conversar e resolve o resto sozinha.

- **Verificação como produto.** Selo com três verificações e validade à vista no perfil.

- **Presencial local.** Lançamento por cidade, com raio e deslocamento no cálculo de horários.

- **Comissão que o professor aceita.** Abaixo da faixa da Preply e quase nula para o aluno que ele mesmo trouxe.

**Largada a frio: o risco de abrir a busca no dia 1**

- **Busca vazia não tem segunda chance.** A família que não encontra professor com horário não volta.

- **Concentrar.** Uma cidade para o presencial e quatro disciplinas no online. Sugestão: Matemática, Física, Química e Redação.

- **Oferta mínima como critério de abertura.** Sugestão: pelo menos 5 professores com vaga na semana em cada combinação de disciplina e etapa (fundamental 2 e médio), o que pede de 30 a 50 professores verificados.

- **Oferta primeiro.** O professor ganha agenda, cobrança e página própria já no cadastro, e traz os próprios alunos pagando 5%. A ferramenta paga a espera enquanto a procura não chega.

- **Piloto fechado antes da abertura.** Os professores recrutados usam o link próprio por algumas semanas. O primeiro defeito aparece para eles, não para as famílias.

- **Procura depois.** Páginas por disciplina e bairro para a busca orgânica, indicação entre pais e parcerias locais.

**Saída por fora: o risco de todo marketplace de serviço recorrente**

- **O incentivo existe.** Depois da primeira aula, professor e família podem combinar direto e economizar a comissão.

- **A resposta é valer mais do que custa.** Agenda sem conflito, cobrança sem constrangimento, proteção contra falta, sala pronta, histórico e reputação pública. Quem sai perde avaliações novas e posição na busca.

- **Barreira leve, não muro.** Contato oculto só até a primeira aula paga. Depois disso, bloquear conversa irrita os dois lados e não impede nada.

- **Hipótese a testar: comissão decrescente.** A taxa da busca cai depois de um número de aulas com a mesma família. A Preply reduz a taxa conforme as horas dadas pelo professor.

**Outras hipóteses a testar**

- **Primeira aula com garantia.** Se a família não gostar, troca de professor sem custo. A Preply oferece aula substituta grátis depois da experimental e, para isso, fica com 100% dela.

- **Piso de preço.** Evita a corrida para o menor valor, crítica feita às plataformas de terapia de preço social.

**Métricas**

- **Principal.** Aulas pagas e realizadas por semana.

- **Liquidez.** Parcela das buscas que mostram ao menos 3 professores com vaga em 7 dias, e parcela das buscas que viram reserva.

- **Oferta.** Dias entre a aprovação de um professor e a primeira aula dele.

- **Recompra.** Parcela das famílias que compram a segunda aula na plataforma.

## 5. Fases de desenvolvimento

Com a busca no lançamento, a primeira versão pública fica maior: cerca de 16 semanas até a abertura, para 2 a 3 pessoas em tempo integral, com o recrutamento de professores correndo desde a semana 0. São estimativas minhas.

<img src="docs/media/media/image4.png" style="width:6in;height:2.49107in" alt="roteiro · 5 etapas, 4 critérios de saída e 1 trilha paralela" />

roteiro · 5 etapas, 4 critérios de saída e 1 trilha paralela

Cada losango é o critério para passar à etapa seguinte; a preparação e o recrutamento de professores correm em paralelo até a abertura.

**Semana 0 em diante: terceiros e oferta.** Começa no primeiro dia e corre em paralelo ao desenvolvimento.

- Conta no provedor de pagamento, com pedido de homologação das subcontas e da retenção.

- Verificação da empresa na Meta, número de WhatsApp e modelos de utilidade enviados para aprovação.

- Projeto no Google Cloud e pedido de verificação.

- Domínio, termos de uso, política de privacidade e parecer jurídico sobre menores, antecedentes e responsabilidade do intermediário.

- Escolha da cidade e das disciplinas; lista de espera de professores, com meta de 30 a 50 verificados antes da abertura.

- Três protótipos técnicos: reserva com PIX e retenção, sala de vídeo e busca com próximo horário.

**Fase 1: motor e professor (semanas 1 a 8)**

- Cadastro, perfil e verificação do professor, com painel interno de análise.

- Agenda: regras semanais, bloqueios, serviços por modalidade com deslocamento e livre/ocupado do Google.

- Página do professor com link próprio, reserva temporária, PIX e cartão com divisão e retenção.

- Confirmação e lembretes por WhatsApp e e-mail.

- Sala de vídeo, código da aula presencial e repasse depois da aula.

- Critério de saída: 20 aulas pagas e repassadas de ponta a ponta pelos professores-piloto, sem intervenção manual e sem reserva duplicada.

**Fase 2: vitrine e confiança (semanas 9 a 14)**

- Busca com filtros, próximo horário e distância; perfil com avaliações.

- Conta do responsável, mensagens na plataforma e avaliação depois da aula.

- Remarcação, cancelamento, contestação e reembolso pelas regras da plataforma.

- Páginas por disciplina e cidade, para a busca orgânica.

- Piloto fechado em paralelo: os professores recrutados vendem pelo link próprio.

- Critério de saída: oferta mínima atingida na cidade e nas disciplinas de lançamento.

**Abertura da busca (semanas 15 e 16)**

- Busca pública na cidade escolhida, com aula online para o país inteiro.

- Suporte, verificação e contestação operando com prazos definidos.

- Critério de saída: 100 aulas vindas da busca, com a maioria das buscas mostrando ao menos 3 professores com vaga.

**Fase 3: recorrência e fidelização (semanas 17 a 24)**

- Horário fixo semanal com cobrança automática por aula, por Pix Automático ou cartão.

- Resumo da aula para o responsável e garantia da primeira aula.

- Questionário que indica professores, como a Zenklub faz com especialistas.

- Sincronização incremental do Google, Outlook e pacote pré-pago, se o provedor permitir liberar o valor por aula.

- Critério de saída: metade das aulas vem de famílias que já compraram antes.

**Fase 4: empresas, escolas e alcance (depois)**

- Empresa ou escola como pagadora: créditos, relatórios e contrato.

- Segunda cidade, quadro branco na sala e aplicativo.

## Riscos e pontos a validar

Os dois primeiros riscos são de negócio e decidem o produto; os seis seguintes pedem validação profissional antes do lançamento. Não sou advogado nem contador.

| Risco                                 | Por que importa                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Como o desenho trata                                                                                                             | Validar com                                      |
|---------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------|
| Largada a frio                        | Busca aberta com pouca oferta devolve lista vazia, e a família não volta                                                                                                                                                                                                                                                                                                                                                                                                                                           | Uma cidade e quatro disciplinas; oferta mínima como critério de abertura; piloto fechado                                         | Lista de espera de professores, desde a semana 0 |
| Saída por fora                        | Depois da primeira aula, professor e família podem combinar direto                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Comissão de 5% para o aluno do professor; valor em toda aula; contato oculto só até a primeira aula paga                         | Taxa de segunda aula no piloto                   |
| Segurança de menores                  | Adulto e menor em vídeo ou em casa; um incidente compromete a marca                                                                                                                                                                                                                                                                                                                                                                                                                                                | Três verificações com validade; conversa visível ao responsável; endereço só depois do pagamento; denúncia que suspende o perfil | Advogado e entrevistas com responsáveis          |
| Dados de menores                      | A LGPD exige que o tratamento atenda ao melhor interesse do menor ([Machado Meyer](https://www.machadomeyer.com.br/pt/inteligencia-juridica/publicacoes-ij/direito-digital/nova-regra-de-tratamento-de-dados-de-criancas-e-adolescentes)). O ECA Digital, em vigor desde 17/03/2026, alcança serviços de acesso provável por menores de 18 anos, com multa de até R\$ 50 milhões por infração ([Confidata](https://confidata.com.br/blog/eca-digital-o-que-muda-empresas)). Vídeo e mensagens aumentam a exposição | Conta do responsável; aluno sem login, só com primeiro nome e série; sem gravação; nenhuma publicidade nem perfil de menor       | Advogado de proteção de dados                    |
| Responsabilidade do intermediário     | Quem anuncia, cobra e garante a aula pode ser chamado a responder por falha do serviço                                                                                                                                                                                                                                                                                                                                                                                                                             | Termos claros sobre o papel de cada parte; regra de reembolso; verificação documentada                                           | Advogado                                         |
| Relação com o professor               | Tabelar preço, impor horário ou exigir exclusividade aproxima a relação de emprego. Na reportagem sobre a PsyMeet, um procurador do trabalho falou em “falso autônomo” ([ICL Notícias](https://iclnoticias.com.br/?p=103293))                                                                                                                                                                                                                                                                                      | Professor define preço e agenda; sem exclusividade                                                                               | Advogado trabalhista                             |
| Custódia e imposto                    | A comissão é a receita. Se o valor inteiro passa pela conta da plataforma, mudam o enquadramento regulatório e a base de imposto                                                                                                                                                                                                                                                                                                                                                                                   | Divisão com retenção no provedor; transferência pela conta principal só com parecer                                              | Contador                                         |
| Cancelamento e reembolso              | A regra da plataforma precisa conviver com o direito de arrependimento em compra a distância                                                                                                                                                                                                                                                                                                                                                                                                                       | Regra visível antes do pagamento; reembolso integral em falta do professor; devolução pela API do provedor                       | Advogado                                         |
| Retenção do provedor não cobre o caso | Prazo por subconta, uma retenção por cobrança, estorno com valor retido sem documentação e mensalidade por subconta                                                                                                                                                                                                                                                                                                                                                                                                | Aula avulsa no lançamento; teste no ambiente de testes; interface que permite trocar de provedor                                 | Asaas, na semana 0                               |
| Fornecedor de vídeo                   | A Daily está sendo comprada pela Deepgram; preço e prioridades podem mudar                                                                                                                                                                                                                                                                                                                                                                                                                                         | Interface própria com três operações; um segundo provedor testado no protótipo                                                   | Protótipo                                        |
| Modelo do WhatsApp reclassificado     | A mensagem passa a custar cerca de 9 vezes mais                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Texto estritamente transacional; cópia por e-mail; alerta quando a categoria mudar                                               | Primeiras semanas de piloto                      |
| Verificação da Google atrasa          | Teto de 100 usuários e reautorização semanal                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Pedido na semana 0; escopos estreitos; a agenda manual funciona sem Google                                                       | Semana 0                                         |

## Próximos passos e perguntas em aberto

Sete respostas suas mudam o desenho; as tarefas abaixo valem em qualquer cenário.

1.  **Cidade de lançamento.** Onde começa a aula presencial? Define recrutamento, páginas de busca e parcerias.

2.  **Disciplinas iniciais.** Você confirma Matemática, Física, Química e Redação?

3.  **Quem pode dar aula.** Só formados e licenciados, ou também universitários? Muda o tamanho da oferta e a conversa com os pais.

4.  **Comissão.** 15% na busca e 5% no link como ponto de partida? A taxa deve cair para famílias recorrentes?

5.  **Regra de cancelamento.** Uma regra única da plataforma, ou duas ou três opções para o professor escolher?

6.  **Equipe e operação.** Quem constrói, com que dedicação, e quem analisa documentos e atende contestações?

7.  **Empresa.** Já existe CNPJ? O Asaas exige conta principal de pessoa jurídica.

- [ ] Responder às sete perguntas acima

- [ ] Abrir a lista de espera e entrevistar 10 professores e 10 responsáveis da cidade de lançamento

- [ ] Abrir as aprovações da semana 0: provedor de pagamento (subcontas e retenção), Meta e Google

- [ ] Rodar três protótipos (reserva com PIX e retenção, sala de vídeo e busca), a partir do apêndice “SQL testado”

- [ ] Levar os riscos jurídicos e fiscais a um advogado e a um contador

- [ ] Com este documento aprovado, detalhar a fase 1 em plano de implementação, tarefa por tarefa

## Apêndice: SQL testado

Esquema, reserva temporária, confirmação, horários livres e os acréscimos do marketplace (busca, repasse e avaliação), executados em PostgreSQL 16.15 em 13/11/2026. Os parâmetros estão no formato do psql.

| Teste                                                                 | Resultado                                                                                        |
|-----------------------------------------------------------------------|--------------------------------------------------------------------------------------------------|
| Duas aulas sobrepostas para o mesmo professor                         | Segunda recusada com 23P01                                                                       |
| Aula seguinte com 10 minutos de intervalo                             | 15h00 recusada, 15h10 aceita                                                                     |
| 20 sessões simultâneas, só com a restrição                            | 1 gravou, 19 recusadas                                                                           |
| 20 sessões simultâneas, com trava e verificação prévia                | 1 gravou, 19 receberam “ocupado”                                                                 |
| Reserva temporária vencida                                            | Bloqueia até virar expired; a limpeza na mesma transação libera o horário                        |
| Pacote de 4 semanas com conflito na terceira                          | Transação desfeita, nenhuma aula gravada                                                         |
| Horários livres com aula paga, compromisso externo e bloqueio         | 8 horários devolvidos, os 8 esperados                                                            |
| Antecedência mínima de 2 horas, consulta às 15h                       | Primeiro horário oferecido: 17h                                                                  |
| Confirmação de pagamento repetida                                     | 1 linha alterada na primeira vez, nenhuma na segunda                                             |
| Notificação de pagamento repetida                                     | Gravada 1 vez                                                                                    |
| Coluna gerada com timestamptz - interval                              | Recusada: expressão não imutável                                                                 |
| Hora local + 7 dias contra instante + 168 horas, regras de 2018       | 14h contra 15h                                                                                   |
| Busca por disciplina, série, modalidade e preço                       | Voltaram os 2 professores esperados; a professora com certidão vencida ficou fora                |
| Ordenação por média bayesiana                                         | 40 avaliações de média 4,8 (nota 4,77) à frente de 1 avaliação nota 5 (4,58)                     |
| Texto livre sem acento                                                | “recuperacao” encontrou “Recuperação”                                                            |
| unaccent em índice de expressão                                       | Recusado: função não imutável                                                                    |
| Aula na casa do aluno, raio do professor de 5 km                      | A 2,9 km apareceu; a 10,1 km, não; com raio de 12 km, apareceu                                   |
| Retrato do próximo horário desatualizado                              | Reserva recusada com 23P01; refeito, o próximo horário passou de 14h para 15h30                  |
| Presencial com 30 minutos de deslocamento antes e depois              | Depois de online das 14h às 15h10: 15h30 recusada, 16h aceita; presencial seguinte só às 18h     |
| Aula na casa do aluno sem endereço                                    | Recusada pela restrição                                                                          |
| Dois processos liberando repasses ao mesmo tempo                      | 4 repasses vencidos: um processo pegou 3, o outro 1; o disputado e o não vencido ficaram retidos |
| Liberação repetida do mesmo repasse                                   | 1 linha alterada na primeira vez, nenhuma na segunda                                             |
| Segunda avaliação, avaliação de outro responsável, aula não concluída | Nenhuma gravada                                                                                  |
| Origem da família registrada duas vezes                               | Prevaleceu o primeiro registro                                                                   |
| Mensagem entre professor e responsável sem vínculo                    | Recusada pela chave estrangeira                                                                  |
| 2.000 professores sintéticos                                          | Busca em cerca de 6 ms; 2.000 retratos refeitos em 1,3 s                                         |

**Esquema**

CREATE EXTENSION IF NOT EXISTS btree_gist;  
  
CREATE TYPE booking_status AS ENUM  
('held','confirmed','completed','no_show','cancelled','rescheduled','expired');  
  
CREATE TABLE teachers (  
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),  
slug text NOT NULL UNIQUE,  
display_name text NOT NULL,  
timezone text NOT NULL DEFAULT 'America/Sao_Paulo',  
min_notice_min int NOT NULL DEFAULT 120,  
horizon_days int NOT NULL DEFAULT 60,  
slot_step_min int NOT NULL DEFAULT 30,  
max_lessons_per_day int  
);  
  
CREATE TABLE services (  
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),  
teacher_id uuid NOT NULL REFERENCES teachers(id),  
subject text NOT NULL,  
duration_min int NOT NULL CHECK (duration_min \> 0),  
price_cents int NOT NULL CHECK (price_cents \>= 0),  
modality text NOT NULL CHECK (modality IN ('online','at_teacher','at_student')),  
buffer_before_min int NOT NULL DEFAULT 0,  
buffer_after_min int NOT NULL DEFAULT 0,  
active boolean NOT NULL DEFAULT true  
);  
  
CREATE TABLE availability_rules (  
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),  
teacher_id uuid NOT NULL REFERENCES teachers(id),  
weekday smallint NOT NULL CHECK (weekday BETWEEN 1 AND 7), -- ISO: 1 = segunda  
start_local time NOT NULL,  
end_local time NOT NULL,  
valid_from date,  
valid_until date,  
CHECK (end_local \> start_local)  
);  
  
CREATE TABLE availability_overrides (  
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),  
teacher_id uuid NOT NULL REFERENCES teachers(id),  
on_date date NOT NULL,  
kind text NOT NULL CHECK (kind IN ('block','extra')),  
start_local time,  
end_local time  
);  
  
CREATE TABLE external_busy (  
id bigserial PRIMARY KEY,  
teacher_id uuid NOT NULL REFERENCES teachers(id),  
calendar_ref text NOT NULL,  
provider_event_id text NOT NULL,  
during tstzrange NOT NULL,  
UNIQUE (teacher_id, calendar_ref, provider_event_id)  
);  
CREATE INDEX external_busy_gist ON external_busy USING gist (teacher_id, during);  
  
CREATE TABLE guardians (  
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),  
name text NOT NULL,  
phone_e164 text NOT NULL UNIQUE,  
email text,  
timezone text,  
whatsapp_opt_in_at timestamptz  
);  
  
CREATE TABLE students (  
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),  
guardian_id uuid NOT NULL REFERENCES guardians(id),  
first_name text NOT NULL,  
grade text  
);  
  
CREATE TABLE orders (  
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),  
teacher_id uuid NOT NULL REFERENCES teachers(id),  
guardian_id uuid NOT NULL REFERENCES guardians(id),  
student_id uuid NOT NULL REFERENCES students(id),  
service_id uuid NOT NULL REFERENCES services(id),  
lessons int NOT NULL DEFAULT 1,  
total_cents int NOT NULL,  
status text NOT NULL DEFAULT 'awaiting_payment'  
CHECK (status IN ('awaiting_payment','paid','expired','refunded','partially_refunded')),  
expires_at timestamptz,  
idempotency_key text NOT NULL UNIQUE,  
created_at timestamptz NOT NULL DEFAULT now()  
);  
  
CREATE TABLE bookings (  
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),  
order_id uuid NOT NULL REFERENCES orders(id),  
teacher_id uuid NOT NULL REFERENCES teachers(id),  
student_id uuid NOT NULL REFERENCES students(id),  
service_id uuid NOT NULL REFERENCES services(id),  
starts_at timestamptz NOT NULL,  
ends_at timestamptz NOT NULL,  
blocked tstzrange NOT NULL, -- aula + intervalos; gravado pela aplicação  
local_start timestamp NOT NULL, -- hora de parede combinada  
timezone text NOT NULL, -- fuso IANA do professor na reserva  
status booking_status NOT NULL DEFAULT 'held',  
hold_expires_at timestamptz,  
rescheduled_from uuid REFERENCES bookings(id),  
external_event_id text,  
created_at timestamptz NOT NULL DEFAULT now(),  
CHECK (ends_at \> starts_at),  
CHECK (blocked @\> tstzrange(starts_at, ends_at, '\[)')),  
CHECK (status \<\> 'held' OR hold_expires_at IS NOT NULL),  
CONSTRAINT no_double_booking EXCLUDE USING gist  
(teacher_id WITH =, blocked WITH &&)  
WHERE (status IN ('held','confirmed'))  
);  
CREATE INDEX bookings_teacher_start ON bookings (teacher_id, starts_at);  
  
CREATE TABLE payments (  
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),  
order_id uuid NOT NULL REFERENCES orders(id),  
provider text NOT NULL,  
provider_charge_id text NOT NULL,  
method text NOT NULL CHECK (method IN ('pix','card')),  
amount_cents int NOT NULL,  
platform_fee_cents int NOT NULL DEFAULT 0,  
status text NOT NULL DEFAULT 'pending'  
CHECK (status IN ('pending','paid','expired','failed','refunded','disputed')),  
expires_at timestamptz,  
paid_at timestamptz,  
UNIQUE (provider, provider_charge_id)  
);  
  
CREATE TABLE webhook_events (  
id bigserial PRIMARY KEY,  
provider text NOT NULL,  
provider_event_id text NOT NULL,  
payload jsonb NOT NULL,  
received_at timestamptz NOT NULL DEFAULT now(),  
processed_at timestamptz,  
UNIQUE (provider, provider_event_id)  
);  
  
CREATE TABLE notifications (  
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),  
booking_id uuid NOT NULL REFERENCES bookings(id),  
channel text NOT NULL CHECK (channel IN ('whatsapp','email')),  
template text NOT NULL,  
send_at timestamptz NOT NULL,  
status text NOT NULL DEFAULT 'scheduled'  
CHECK (status IN ('scheduled','sent','delivered','failed','cancelled')),  
provider_message_id text,  
UNIQUE (booking_id, channel, template)  
);

**Reserva temporária**

BEGIN;  
-- uma reserva por vez para cada professor  
SELECT pg_advisory_xact_lock(hashtextextended('teacher:' \|\| :'teacher', 0));  
  
-- reservas temporárias vencidas que estejam no caminho deixam de bloquear  
UPDATE bookings b SET status = 'expired'  
FROM teachers t  
WHERE t.id = :'teacher' AND b.teacher_id = t.id  
AND b.status = 'held' AND b.hold_expires_at \< now()  
AND b.blocked && tstzrange(  
(:'local_start'::timestamp AT TIME ZONE t.timezone) - make_interval(mins =\> :buffer_before),  
(:'local_start'::timestamp AT TIME ZONE t.timezone) + make_interval(mins =\> :duration + :buffer_after), '\[)');  
  
-- ocupa o horário; se alguém chegou antes, o banco responde 23P01  
INSERT INTO bookings (order_id, teacher_id, student_id, service_id,  
starts_at, ends_at, blocked, local_start, timezone,  
status, hold_expires_at)  
SELECT :'order', t.id, :'student', :'service',  
s, s + make_interval(mins =\> :duration),  
tstzrange(s - make_interval(mins =\> :buffer_before),  
s + make_interval(mins =\> :duration + :buffer_after), '\[)'),  
:'local_start'::timestamp, t.timezone,  
'held', now() + make_interval(mins =\> :hold_minutes)  
FROM teachers t,  
LATERAL (SELECT :'local_start'::timestamp AT TIME ZONE t.timezone AS s) x  
WHERE t.id = :'teacher';  
COMMIT;

**Confirmação de pagamento**

-- registra a notificação uma única vez  
INSERT INTO webhook_events (provider, provider_event_id, payload)  
VALUES (:'provider', :'event_id', :'payload'::jsonb)  
ON CONFLICT (provider, provider_event_id) DO NOTHING  
RETURNING id; -- sem linha: evento já tratado  
  
-- confirma só o que ainda está reservado  
UPDATE bookings SET status = 'confirmed', hold_expires_at = NULL  
WHERE order_id = :'order' AND status = 'held'  
RETURNING id; -- sem linha: repetição ou pagamento tardio

**Horários livres**

WITH t AS (  
SELECT id, timezone, min_notice_min, horizon_days, slot_step_min  
FROM teachers WHERE id = :'teacher'  
), svc AS (  
SELECT duration_min, buffer_before_min, buffer_after_min  
FROM services WHERE id = :'service'  
), days AS (  
SELECT d::date AS day  
FROM generate_series(:'from'::date, :'to'::date, interval '1 day') d  
), windows AS ( -- regra semanal (hora local) -\> intervalo de instantes  
SELECT tstzrange((day + r.start_local) AT TIME ZONE t.timezone,  
(day + r.end_local) AT TIME ZONE t.timezone, '\[)') AS w  
FROM t  
JOIN availability_rules r ON r.teacher_id = t.id  
JOIN days ON extract(isodow FROM day) = r.weekday  
AND (r.valid_from IS NULL OR day \>= r.valid_from)  
AND (r.valid_until IS NULL OR day \<= r.valid_until)  
UNION  
SELECT tstzrange((o.on_date + o.start_local) AT TIME ZONE t.timezone,  
(o.on_date + o.end_local) AT TIME ZONE t.timezone, '\[)')  
FROM t JOIN availability_overrides o  
ON o.teacher_id = t.id AND o.kind = 'extra'  
AND o.on_date BETWEEN :'from'::date AND :'to'::date  
), busy AS ( -- tudo que ocupa o professor, num unico multirange  
SELECT coalesce(range_agg(b), '{}'::tstzmultirange) AS mr FROM (  
SELECT bk.blocked AS b FROM bookings bk, t  
WHERE bk.teacher_id = t.id  
AND (bk.status = 'confirmed'  
OR (bk.status = 'held' AND bk.hold_expires_at \> :'now'::timestamptz))  
UNION ALL  
SELECT e.during FROM external_busy e, t WHERE e.teacher_id = t.id  
UNION ALL  
SELECT tstzrange(  
(o.on_date + coalesce(o.start_local, time '00:00')) AT TIME ZONE t.timezone,  
CASE WHEN o.end_local IS NULL  
THEN ((o.on_date + 1) + time '00:00') AT TIME ZONE t.timezone  
ELSE (o.on_date + o.end_local) AT TIME ZONE t.timezone END, '\[)')  
FROM t JOIN availability_overrides o ON o.teacher_id = t.id AND o.kind = 'block'  
) x  
)  
SELECT s AS starts_at  
FROM t, svc, busy, windows,  
LATERAL generate_series(lower(w),  
upper(w) - make_interval(mins =\> svc.duration_min),  
make_interval(mins =\> t.slot_step_min)) AS s  
WHERE s \>= :'now'::timestamptz + make_interval(mins =\> t.min_notice_min)  
AND s \< :'now'::timestamptz + make_interval(days =\> t.horizon_days)  
AND NOT busy.mr && tstzrange(s - make_interval(mins =\> svc.buffer_before_min),  
s + make_interval(mins =\> svc.duration_min + svc.buffer_after_min), '\[)')  
ORDER BY s;

**Acréscimos do marketplace**

Aplicados sobre o esquema acima.

CREATE EXTENSION IF NOT EXISTS cube;  
CREATE EXTENSION IF NOT EXISTS earthdistance;  
CREATE EXTENSION IF NOT EXISTS unaccent;  
  
-- catálogo fechado: a busca filtra por código, não por texto digitado  
CREATE TABLE subjects (  
id smallint PRIMARY KEY,  
slug text NOT NULL UNIQUE,  
name text NOT NULL  
);  
CREATE TABLE grade_levels (  
id smallint PRIMARY KEY,  
slug text NOT NULL UNIQUE,  
name text NOT NULL,  
stage text NOT NULL CHECK (stage IN ('fund2','medio','pre_vestibular'))  
);  
  
-- situação do professor na vitrine e área de atendimento presencial  
ALTER TABLE teachers  
ADD COLUMN status text NOT NULL DEFAULT 'draft'  
CHECK (status IN ('draft','in_review','approved','paused','suspended')),  
ADD COLUMN headline text,  
ADD COLUMN bio text,  
ADD COLUMN base_lat double precision, -- centro do CEP, nunca o endereço exato  
ADD COLUMN base_lng double precision,  
ADD COLUMN travel_radius_km numeric(4,1), -- até onde vai à casa do aluno  
ADD CHECK ((base_lat IS NULL) = (base_lng IS NULL));  
  
CREATE TABLE teacher_subjects ( -- o que ensina: disciplina x série  
teacher_id uuid NOT NULL REFERENCES teachers(id),  
subject_id smallint NOT NULL REFERENCES subjects(id),  
grade_level_id smallint NOT NULL REFERENCES grade_levels(id),  
PRIMARY KEY (teacher_id, subject_id, grade_level_id)  
);  
ALTER TABLE services ADD COLUMN subject_id smallint REFERENCES subjects(id);  
  
CREATE TABLE teacher_verifications (  
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),  
teacher_id uuid NOT NULL REFERENCES teachers(id),  
kind text NOT NULL CHECK (kind IN ('identity','criminal_record','education')),  
status text NOT NULL DEFAULT 'pending'  
CHECK (status IN ('pending','approved','rejected','expired')),  
evidence_key text, -- caminho do arquivo em armazenamento privado  
decided_at timestamptz,  
valid_until date -- a certidão de antecedentes vence  
);  
CREATE UNIQUE INDEX one_live_verification  
ON teacher_verifications (teacher_id, kind) WHERE status IN ('pending','approved');  
  
-- só aparece na busca quem está aprovado e com as três verificações em dia  
CREATE VIEW teachers_listed AS  
SELECT t.id  
FROM teachers t  
WHERE t.status = 'approved'  
AND (SELECT count(DISTINCT v.kind)  
FROM teacher_verifications v  
WHERE v.teacher_id = t.id AND v.status = 'approved'  
AND (v.valid_until IS NULL OR v.valid_until \>= current_date)) = 3;  
  
-- de onde veio cada família: decide a comissão e vale o primeiro contato  
CREATE TABLE teacher_guardian_links (  
teacher_id uuid NOT NULL REFERENCES teachers(id),  
guardian_id uuid NOT NULL REFERENCES guardians(id),  
acquisition text NOT NULL CHECK (acquisition IN ('marketplace','teacher_link')),  
created_at timestamptz NOT NULL DEFAULT now(),  
PRIMARY KEY (teacher_id, guardian_id)  
);  
  
CREATE TABLE addresses (  
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),  
guardian_id uuid NOT NULL REFERENCES guardians(id),  
cep text NOT NULL,  
street text NOT NULL,  
number text,  
district text,  
city text NOT NULL,  
state char(2) NOT NULL,  
lat double precision,  
lng double precision  
);  
  
ALTER TABLE bookings  
ADD COLUMN modality text NOT NULL DEFAULT 'online'  
CHECK (modality IN ('online','at_teacher','at_student')),  
ADD COLUMN address_id uuid REFERENCES addresses(id),  
ADD CHECK (modality \<\> 'at_student' OR address_id IS NOT NULL);  
  
-- o que aconteceu na aula: presença pelo vídeo ou pelo código da aula presencial  
CREATE TABLE lesson_sessions (  
booking_id uuid PRIMARY KEY REFERENCES bookings(id),  
video_room text,  
teacher_joined_at timestamptz,  
student_joined_at timestamptz,  
teacher_seconds int NOT NULL DEFAULT 0,  
student_seconds int NOT NULL DEFAULT 0,  
checkin_code_hash text,  
checked_in_at timestamptz,  
outcome text CHECK (outcome IN ('taught','student_no_show','teacher_no_show','interrupted')),  
closed_at timestamptz  
);  
  
CREATE TABLE reviews (  
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),  
booking_id uuid NOT NULL UNIQUE REFERENCES bookings(id), -- uma avaliação por aula  
teacher_id uuid NOT NULL REFERENCES teachers(id),  
guardian_id uuid NOT NULL REFERENCES guardians(id),  
rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),  
comment text,  
teacher_reply text,  
status text NOT NULL DEFAULT 'published' CHECK (status IN ('published','hidden')),  
created_at timestamptz NOT NULL DEFAULT now()  
);  
  
CREATE TABLE payouts (  
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),  
booking_id uuid NOT NULL UNIQUE REFERENCES bookings(id), -- um repasse por aula  
teacher_id uuid NOT NULL REFERENCES teachers(id),  
gross_cents int NOT NULL,  
commission_bps int NOT NULL, -- taxa congelada na reserva (1500 = 15%)  
platform_cents int NOT NULL,  
teacher_cents int NOT NULL,  
status text NOT NULL DEFAULT 'held'  
CHECK (status IN ('held','releasing','released','refunded')),  
release_after timestamptz NOT NULL, -- fim da aula + janela de contestação  
provider_escrow_id text,  
released_at timestamptz,  
CHECK (gross_cents = platform_cents + teacher_cents)  
);  
CREATE INDEX payouts_due ON payouts (release_after) WHERE status = 'held';  
  
CREATE TABLE disputes (  
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),  
booking_id uuid NOT NULL REFERENCES bookings(id),  
opened_by text NOT NULL CHECK (opened_by IN ('guardian','teacher','support')),  
reason text NOT NULL,  
status text NOT NULL DEFAULT 'open'  
CHECK (status IN ('open','for_teacher','for_guardian','shared')),  
opened_at timestamptz NOT NULL DEFAULT now(),  
resolved_at timestamptz  
);  
CREATE UNIQUE INDEX one_open_dispute ON disputes (booking_id) WHERE status = 'open';  
  
-- índice de busca: uma linha por professor, refeita quando o perfil muda  
CREATE TABLE teacher_search (  
teacher_id uuid PRIMARY KEY REFERENCES teachers(id),  
doc tsvector NOT NULL, -- nome, chamada, bio e disciplinas, sem acento  
subject_ids smallint\[\] NOT NULL,  
grade_ids smallint\[\] NOT NULL,  
rating_sum int NOT NULL DEFAULT 0,  
rating_count int NOT NULL DEFAULT 0,  
lat double precision,  
lng double precision,  
travel_radius_km numeric(4,1),  
refreshed_at timestamptz NOT NULL DEFAULT now()  
);  
CREATE INDEX teacher_search_doc ON teacher_search USING gin (doc);  
CREATE INDEX teacher_search_what ON teacher_search USING gin (subject_ids, grade_ids);  
CREATE INDEX teacher_search_geo ON teacher_search USING gist (ll_to_earth(lat, lng));  
  
-- retrato do próximo horário livre, por modalidade; a reserva nunca confia nele  
CREATE TABLE teacher_next_slot (  
teacher_id uuid NOT NULL REFERENCES teachers(id),  
modality text NOT NULL CHECK (modality IN ('online','at_teacher','at_student')),  
min_price_cents int NOT NULL,  
next_slot_at timestamptz,  
slots_7d int NOT NULL DEFAULT 0,  
refreshed_at timestamptz NOT NULL DEFAULT now(),  
PRIMARY KEY (teacher_id, modality)  
);  
  
-- conversa entre responsável e professor; sempre dentro da plataforma  
CREATE TABLE messages (  
id bigserial PRIMARY KEY,  
teacher_id uuid NOT NULL,  
guardian_id uuid NOT NULL,  
sender text NOT NULL CHECK (sender IN ('teacher','guardian','system')),  
body text NOT NULL,  
masked boolean NOT NULL DEFAULT false, -- telefone ou e-mail ocultado antes da primeira aula paga  
created_at timestamptz NOT NULL DEFAULT now(),  
FOREIGN KEY (teacher_id, guardian_id) REFERENCES teacher_guardian_links  
);  
CREATE INDEX messages_thread ON messages (teacher_id, guardian_id, created_at);

**Retrato do próximo horário**

A função free_slots é a consulta de horários livres acima, com professor, serviço, período e instante de referência como parâmetros.

-- Refaz o retrato do próximo horário livre de um professor, por modalidade.  
-- Usa o serviço mais curto de cada modalidade como referência para o cartão da busca.  
CREATE OR REPLACE FUNCTION refresh_next_slot(p_teacher uuid, p_now timestamptz)  
RETURNS void LANGUAGE sql AS \$\$  
INSERT INTO teacher_next_slot (teacher_id, modality, min_price_cents, next_slot_at, slots_7d, refreshed_at)  
SELECT p_teacher, m.modality, m.min_price,  
(SELECT min(s) FROM free_slots(p_teacher, m.ref_service,  
p_now::date, (p_now + interval '30 days')::date, p_now) s),  
(SELECT count(\*) FROM free_slots(p_teacher, m.ref_service,  
p_now::date, (p_now + interval '7 days')::date, p_now) s  
WHERE s \< p_now + interval '7 days'),  
p_now  
FROM (SELECT modality,  
min(price_cents) AS min_price,  
(array_agg(id ORDER BY duration_min, price_cents))\[1\] AS ref_service  
FROM services  
WHERE teacher_id = p_teacher AND active  
GROUP BY modality) m  
ON CONFLICT (teacher_id, modality) DO UPDATE  
SET min_price_cents = EXCLUDED.min_price_cents,  
next_slot_at = EXCLUDED.next_slot_at,  
slots_7d = EXCLUDED.slots_7d,  
refreshed_at = EXCLUDED.refreshed_at;  
\$\$;

**Busca com texto livre e distância**

-- Busca: disciplina + série + modalidade + preço máximo (+ raio, na aula presencial)  
-- Parâmetros psql: subject, grade, modality, max_price, lat, lng, family_radius_km, q (texto livre ou vazio), now  
SELECT t.display_name,  
ns.min_price_cents,  
ns.next_slot_at,  
ns.slots_7d,  
-- média bayesiana: cada professor começa com 5 notas de 4,5  
round((ts.rating_sum + 4.5 \* 5)::numeric / (ts.rating_count + 5), 2) AS nota,  
ts.rating_count AS avaliacoes,  
CASE WHEN :'modality' = 'online' THEN NULL  
ELSE round((earth_distance(ll_to_earth(ts.lat, ts.lng),  
ll_to_earth(:lat, :lng)) / 1000)::numeric, 1) END AS km  
FROM teacher_search ts  
JOIN teachers_listed l ON l.id = ts.teacher_id -- aprovado e com verificações em dia  
JOIN teachers t ON t.id = ts.teacher_id  
JOIN teacher_next_slot ns ON ns.teacher_id = ts.teacher_id AND ns.modality = :'modality'  
WHERE ts.subject_ids @\> ARRAY\[:subject\]::smallint\[\]  
AND ts.grade_ids @\> ARRAY\[:grade\]::smallint\[\]  
AND ns.min_price_cents \<= :max_price  
AND ns.next_slot_at \> :'now'::timestamptz -- sem horário livre, não aparece  
AND (:'q' = '' OR ts.doc @@ websearch_to_tsquery('portuguese', unaccent(:'q')))  
AND (:'modality' = 'online'  
OR (earth_box(ll_to_earth(:lat, :lng), 50000) @\> ll_to_earth(ts.lat, ts.lng) -- usa o índice  
AND earth_distance(ll_to_earth(ts.lat, ts.lng), ll_to_earth(:lat, :lng))  
\<= CASE WHEN :'modality' = 'at_student' THEN ts.travel_radius_km \* 1000 -- raio do professor  
ELSE :family_radius_km \* 1000 END)) -- raio da família  
ORDER BY (ns.next_slot_at \< :'now'::timestamptz + interval '7 days') DESC, -- quem tem vaga na semana  
nota DESC,  
ns.next_slot_at;

**Avaliação de aula concluída**

INSERT INTO reviews (booking_id, teacher_id, guardian_id, rating, comment)  
SELECT b.id, b.teacher_id, o.guardian_id, :rating, :'comment'  
FROM bookings b JOIN orders o ON o.id = b.order_id  
WHERE b.id = :'booking' AND b.status = 'completed' AND o.guardian_id = :'guardian'  
ON CONFLICT (booking_id) DO NOTHING  
RETURNING id; -- sem linha: aula não concluída, outro responsável ou avaliação repetida

## Fontes

Consultadas em 13/11/2026.

- **Plataformas de terapia:** [RD Station, Vittude, 2019](https://www.rdstation.com/blog/marketing/vittude/) · [Baguete, Vittude, 2022](https://www.baguete.com.br/noticias/vittude-recebe-aporte-de-r-35-milhoes) · [Futuro da Saúde, healthtechs de saúde mental](https://futurodasaude.com.br/?p=4085) · [Consumidor Moderno, Vittude para empresas](https://consumidormoderno.com.br/investimento-saude-mental/) · [Brazil Journal, Zenklub, 2021](https://braziljournal.com/zenklub-e-a-terapia-como-beneficio-corporativo) · [Zenklub na App Store](https://apps.apple.com/app/apple-store/id1282953238) · [ICL Notícias e Repórter Brasil, PsyMeet, 2026](https://iclnoticias.com.br/?p=103293) · [CFP, piso de honorários](https://site.cfp.org.br/em-reportagem-de-telejornal-cfp-defende-piso-para-atendimentos-por-convenios-e-aplicativos-contra-a-uberizacao-dos-servicos-psicologicos/) · [Psitto](https://www.psitto.com.br/) · [Fusões & Aquisições, Telavita](https://fusoesaquisicoes.com/acontece-no-setor/telavita-startup-de-saude-mental-para-empresas-chega-ao-ponto-de-equilibrio/)

- **Plataformas de aulas:** [Superprof, termos](https://www.superprof.com.br/tcgu.html) · [Superprof, página do professor](https://www.superprof.com.br/dar-aulas-particulares/?gad_source=1) · [Preply, modelo de comissão](https://help.preply.com/pt-BR/articles/4171383-modelo-de-comissao-da-preply) · [Profes na App Store](https://apps.apple.com/us/app/-/id1479204191) · [TutorMundi, benefício corporativo](https://www.prnewswire.com/br/comunicados-para-a-imprensa/tutormundi-amplia-atuacao-e-passa-a-oferecer-beneficio-educacional-corporativo-302530222.html)

- **Vídeo:** [Daily, preços](https://www.daily.co/pricing/video-sdk/) · [Whereby Embedded, preços](https://whereby.com/information/embedded/pricing) · [LiveKit Cloud, planos](https://livekit.com/pricing.md) · [audioXpress, compra da Daily pela Deepgram](https://audioxpress.com/news/deepgram-acquires-daily-to-build-open-conversational-voice-ai-platform-around-pipecat)

- **Repasse com retenção:** [Asaas, Conta Escrow](https://docs.asaas.com/docs/introducao-conta-escrow) · [liberação dos valores](https://docs.asaas.com/docs/desbloqueio-dos-valores) · [valores sob garantia](https://docs.asaas.com/docs/bloqueio-dos-valores) · [divisão com retenção](https://docs.asaas.com/docs/split-para-contas-com-conta-escrow) · [cobrança da taxa](https://docs.asaas.com/docs/cobran%C3%A7a-da-taxa-por-subconta-configurada) · [dúvidas do split](https://docs.asaas.com/docs/duvidas-frequentes-split)

- **Verificação de professores:** [Polícia Federal, antecedentes criminais](https://www.gov.br/pf/pt-br/assuntos/antecedentes-criminais) · [gov.br, emissão da certidão](https://www.gov.br/pt-br/servicos/emitir-certidao-de-antecedentes-criminais) · [Lei 14.811/2024](https://legis.senado.leg.br/norma/38157392/publicacao/38158500)

- **WhatsApp:** [Meta, preços da plataforma](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing) · [Vectalk, tabela em reais](https://vectalk.com.br/blog/en/whatsapp-api-pricing-brazil/) · [Flowcall, mudanças de outubro de 2026](https://www.flowcall.co/blog/whatsapp-business-api-pricing) · [Wati, reclassificação de modelos](https://support.wati.io/en/articles/15932488-best-practices-to-reduce-whatsapp-utility-to-marketing-template-reclassification) · [360dialog, coexistência](https://docs.360dialog.com/docs/hub/embedded-signup/whatsapp-coexistence) · [Hora de Codar, API não oficial](https://horadecodar.com.br/evolution-api-vs-api-oficial-whatsapp/)

- **Google Calendar:** [notificações](https://developers.google.com/workspace/calendar/api/guides/push) · [sincronização](https://developers.google.com/workspace/calendar/api/guides/sync) · [escopos](https://developers.google.com/workspace/calendar/api/auth) · [publicação do app](https://developers.google.com/identity/protocols/oauth2/production-readiness/overview) · [verificação de escopos sensíveis](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification)

- **Microsoft:** [notificações de mudança no Graph](https://learn.microsoft.com/en-us/graph/change-notifications-overview)

- **Pagamento:** [Asaas, preços](https://www.asaas.com/precos-e-taxas) · [Asaas, subcontas](https://docs.asaas.com/docs/criacao-de-subcontas) · [Asaas, cobrança por PIX](https://docs.asaas.com/docs/cobrancas-via-pix) · [Mercado Pago, split](https://www.mercadopago.com.br/developers/pt/docs/split-payments/split-1-1/integration-configuration/integrate-marketplace) · [Mercado Pago, PIX](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/payment-integration/websites/pix) · [Pagar.me, PIX](https://docs.pagar.me/reference/pix-2) · [Efí, cobranças imediatas](https://dev.efipay.com.br/docs/api-pix/cobrancas-imediatas) · [Stripe, PIX](https://docs.stripe.com/payments/pix)

- **Agenda:** [Cal.com, mudança de licença](https://cal.com/blog/calcom-v6-4) · [Cal.diy](https://github.com/calcom/cal.diy) · [Calendly, pagamentos](https://calendly.com/payments) · [Calendly com Stripe](https://help.calendly.com/hc/en-us/articles/14077985848215)

- **Tempo e banco:** [TC39, situação do Temporal](https://cdn.jsdelivr.net/gh/tc39/proposal-temporal@main/README.md) · [Neon, restrições temporais no PostgreSQL 18](https://neon.com/postgresql/postgresql-18/temporal-constraints) · [A Tarde, horário de verão](https://atarde.com.br/verao/vai-ter-horario-de-verao-em-2026-saiba-o-que-acontece-neste-ano-1408207)

- **Menores:** [Confidata, ECA Digital](https://confidata.com.br/blog/eca-digital-o-que-muda-empresas) · [Machado Meyer, enunciado da ANPD](https://www.machadomeyer.com.br/pt/inteligencia-juridica/publicacoes-ij/direito-digital/nova-regra-de-tratamento-de-dados-de-criancas-e-adolescentes)
