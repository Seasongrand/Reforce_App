/**
 * Imagem da prévia do link (WhatsApp, redes sociais): a abertura da página da
 * lista de espera. Gerada no build; usa a fonte padrão do ImageResponse.
 */
import { ImageResponse } from 'next/og';

export const alt = 'Reforce: lista de espera de professores';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#1E1B4B',
          color: '#FFFFFF',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '72px 88px',
          gap: 36,
        }}
      >
        <div style={{ fontSize: 44, fontWeight: 700 }}>Reforce</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 24, fontSize: 92, fontWeight: 700, lineHeight: 1.05 }}>
          <span>Ensine.</span>
          <span style={{ background: '#FACC15', color: '#1E1B4B', padding: '0 16px', borderRadius: 14 }}>A cobrança</span>
          <span>é com a gente.</span>
        </div>
        <div
          style={{
            display: 'flex',
            alignSelf: 'flex-start',
            border: '2px solid #4C478F',
            borderRadius: 14,
            padding: '12px 22px',
            fontSize: 30,
            color: '#DDDBFF',
          }}
        >
          Lista de espera aberta para os primeiros professores
        </div>
      </div>
    ),
    { ...size },
  );
}
