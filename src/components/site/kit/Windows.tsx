/**
 * Janelas da Reforce desenhadas em HTML para a página dos professores (a
 * skill pede a interface real do produto, não ilustrações): cada uma mostra
 * uma tela que a plataforma de fato tem, com nomes e valores de exemplo.
 * Os ícones de WhatsApp, Gmail, Visa e Mastercard são os reais, nas cores
 * das marcas (public/assets/icons/brand).
 */
const Check = () => (
  <svg className="win__check" viewBox="0 0 16 16" aria-hidden="true"><path d="m3.5 8.4 2.8 2.8 6.2-6.4" /></svg>
);

function Win({ title, children, label }: { title: string; children: React.ReactNode; label: string }) {
  return (
    <div className="win ui ui-win" role="img" aria-label={label}>
      <div className="win__bar"><span className="win__dots" aria-hidden="true"><i /><i /><i /></span><span>{title}</span></div>
      <div className="win__body">{children}</div>
    </div>
  );
}

export function StepVisual({ step }: { step: number }) {
  if (step === 0)
    return (
      <Win title="Verificação" label="Tela de verificação com documento, antecedentes e formação conferidos">
        <ul className="win__list">
          {['Documento com foto e selfie', 'Certidão de antecedentes criminais', 'Diploma ou declaração de matrícula'].map((t) => (
            <li key={t}><Check />{t}<span className="win__tag">Conferido</span></li>
          ))}
        </ul>
        <p className="win__status"><span className="win__seal">Verificada</span>Perfil aprovado pela equipe</p>
      </Win>
    );
  if (step === 1)
    return (
      <Win title="Sua página" label="Página da professora com preço e horários livres">
        <div className="win__person">
          <span className="win__avatar" aria-hidden="true">AS</span>
          <div><b>Ana Souza</b><span>Matemática e Física</span></div>
          <span className="win__seal">Verificada</span>
        </div>
        <div className="win__row"><span>Aula online, 60 min</span><b>R$ 90,00</b></div>
        <div className="win__slots">
          {['Ter 15:00', 'Qua 10:00', 'Qui 18:30', 'Sáb 09:00'].map((s) => <span key={s}>{s}</span>)}
        </div>
      </Win>
    );
  return (
    <Win title="Recebimento" label="Aula concluída e pagamento liberado para a professora">
      <div className="win__row"><span>Matemática online, terça 15:00</span><span className="win__tag">Concluída</span></div>
      <div className="win__row"><span>Pago pelo aluno, por PIX</span><b>R$ 90,00</b></div>
      <div className="win__row"><span>Comissão da Reforce (5%)</span><span>R$ 4,50</span></div>
      <div className="win__row win__row--total"><span>Liberado para você</span><b>R$ 85,50</b></div>
    </Win>
  );
}

export function FeatureVisual({ feature }: { feature: number }) {
  if (feature === 0)
    return (
      <Win title="Reserva" label="Reserva paga por PIX ou cartão">
        <div className="win__row"><span>Matemática online, terça 15:00</span><b>R$ 90,00</b></div>
        <div className="win__pay">
          <span className="win__chip win__chip--on">PIX</span>
          <span className="win__chip"><img src="/assets/icons/brand/visa.svg" alt="Visa" width="34" height="22" /><img src="/assets/icons/brand/mastercard.svg" alt="Mastercard" width="28" height="22" />Cartão</span>
        </div>
        <p className="win__status"><Check />Pagamento confirmado</p>
      </Win>
    );
  if (feature === 1)
    return (
      <Win title="Avisos" label="Lembretes da aula por WhatsApp e e-mail">
        <ul className="win__notes">
          <li><img src="/assets/icons/brand/whatsapp.svg" alt="WhatsApp" width="28" height="28" /><span><b>Lembrete: aula amanhã, 15:00</b>Matemática com Ana Souza</span><time>24 h antes</time></li>
          <li><img src="/assets/icons/brand/gmail.svg" alt="Gmail" width="28" height="28" /><span><b>Sua aula começa em 1 hora</b>Link da sala de aula</span><time>1 h antes</time></li>
        </ul>
      </Win>
    );
  if (feature === 2)
    return (
      <Win title="Sala de aula" label="Sala de aula online com a professora e o aluno">
        <div className="win__room">
          <span className="win__tile">Ana</span>
          <span className="win__tile win__tile--alt">Pedro</span>
        </div>
        <div className="win__controls" aria-hidden="true"><i /><i /><i className="win__end" /></div>
      </Win>
    );
  return (
    <Win title="Busca" label="Resultados da busca com o selo de verificado">
      {[['AS', 'Ana Souza', 'Matemática e Física'], ['RC', 'Rafael Costa', 'Química']].map(([i, n, d]) => (
        <div className="win__person" key={n}>
          <span className="win__avatar" aria-hidden="true">{i}</span>
          <div><b>{n}</b><span>{d}</span></div>
          <span className="win__seal">Verificado</span>
        </div>
      ))}
    </Win>
  );
}
