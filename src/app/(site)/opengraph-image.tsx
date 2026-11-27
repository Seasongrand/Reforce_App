/**
 * Imagem da prévia do link (WhatsApp, redes sociais): a abertura da página da
 * lista de espera. Gerada no build; usa a fonte padrão do ImageResponse.
 */
import { ImageResponse } from 'next/og';
import { BRAND_MARK_PATH } from '@/components/site/brand';

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
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 20, fontSize: 30, color: '#DDDBFF' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 44, fontWeight: 700, color: '#FFFFFF' }}>
            <svg width="48" height="48" viewBox="0 0 48 48"><path fill="#A5B4FC" fillRule="evenodd" d={BRAND_MARK_PATH} /></svg>
            Reforce
          </span>
          <span>Mais tempo para ensinar. Mais confiança para aprender.</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 24, fontSize: 92, fontWeight: 700, lineHeight: 1.05 }}>
          <span>Você ensina.</span>
          <span>A gente</span>
          <span style={{ background: '#FACC15', color: '#1E1B4B', padding: '0 16px', borderRadius: 14 }}>cuida do resto.</span>
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
