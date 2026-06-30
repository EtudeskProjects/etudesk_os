import { ImageResponse } from 'next/og';

export const alt = 'Etudesk - Découvrir, apprendre et valoriser les compétences numériques';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#09090B',
          padding: '72px',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: '#FAFAFA',
              color: '#09090B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 36,
              fontWeight: 800,
            }}
          >
            E
          </div>
          <div style={{ color: '#FAFAFA', fontSize: 34, fontWeight: 700, letterSpacing: -1 }}>etudesk</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ color: '#FFFFFF', fontSize: 70, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2, maxWidth: 980 }}>
            Découvre, apprends et valorise tes compétences numériques.
          </div>
          <div style={{ color: '#A1A1AA', fontSize: 32, lineHeight: 1.3, maxWidth: 900 }}>
            Des opportunités locales et internationales, reliées à un référentiel propriétaire.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 36, color: '#71717A', fontSize: 26, fontWeight: 600 }}>
          <span style={{ color: '#34D399' }}>3 000 000+ formés</span>
          <span>53 pays</span>
          <span>1687 compétences</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
