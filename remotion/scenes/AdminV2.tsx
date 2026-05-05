import React from 'react';
import { Img, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { tokens } from '../design/tokens';
import { RevealText } from '../design/TextEffects';
import { zhV2 } from '../copy/zhV2';

export const AdminV2: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();

  const imageSpr = spring({ frame: frame - 22, fps, config: { damping: 14 } });
  const imageOpacity = interpolate(imageSpr, [0, 1], [0, 1]);
  const imageScale = interpolate(imageSpr, [0, 1], [0.92, 1]);

  return (
    <div
      style={{
        width,
        height,
        background: tokens.bg.light,
        padding: tokens.spacing.xl,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ marginBottom: tokens.spacing.sm }}>
        <RevealText
          text={zhV2.admin.headline}
          fontSize={tokens.fontSize.xl}
          color={tokens.brand.red}
          letterSpacing={6}
          delay={0}
        />
      </div>
      <div style={{ marginBottom: tokens.spacing.lg }}>
        <RevealText
          text={zhV2.admin.sub}
          fontSize={tokens.fontSize.md}
          color={tokens.text.darkMuted}
          letterSpacing={2}
          delay={12}
        />
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            width: 1400,
            maxWidth: '92%',
            borderRadius: tokens.radius.lg,
            overflow: 'hidden',
            border: `1px solid ${tokens.bg.lightBorder}`,
            boxShadow: `0 32px 110px rgba(10,12,20,0.18), 0 0 60px ${tokens.brand.redLight}`,
            opacity: imageOpacity,
            transform: `scale(${imageScale})`,
          }}
        >
          <Img
            src={staticFile('presentation/management.png')}
            style={{ width: '100%', height: 'auto', display: 'block' }}
          />
        </div>
      </div>
    </div>
  );
};

