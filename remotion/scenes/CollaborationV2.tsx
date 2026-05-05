import React from 'react';
import { Img, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { tokens } from '../design/tokens';
import { RevealText } from '../design/TextEffects';
import { zhV2 } from '../copy/zhV2';

const nodes = ['店舖', '業者', '總部'] as const;

export const CollaborationV2: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();

  const imageSpr = spring({ frame: frame - 28, fps, config: { damping: 14 } });
  const imageOpacity = interpolate(imageSpr, [0, 1], [0, 1]);
  const imageScale = interpolate(imageSpr, [0, 1], [0.96, 1]);

  return (
    <div
      style={{
        width,
        height,
        background: tokens.bg.light,
        padding: tokens.spacing.xl,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ marginBottom: tokens.spacing.sm }}>
        <RevealText
          text={zhV2.collaboration.headline}
          fontSize={tokens.fontSize.xl}
          color={tokens.brand.red}
          letterSpacing={6}
          delay={0}
        />
      </div>
      <div style={{ marginBottom: tokens.spacing.lg }}>
        <RevealText
          text={zhV2.collaboration.sub}
          fontSize={tokens.fontSize.md}
          color={tokens.text.darkMuted}
          letterSpacing={2}
          delay={12}
        />
      </div>

      <div style={{ display: 'flex', gap: tokens.spacing.xl, flexWrap: 'wrap', justifyContent: 'center' }}>
        {nodes.map((label, i) => {
          const spr = spring({ frame: frame - 18 - i * 7, fps, config: { damping: 14 } });
          const opacity = interpolate(spr, [0, 1], [0, 1]);
          const y = interpolate(spr, [0, 1], [18, 0]);
          return (
            <div
              key={label}
              style={{
                background: tokens.brand.redLight,
                border: `2px solid ${tokens.brand.red}`,
                borderRadius: tokens.radius.md,
                padding: tokens.spacing.lg,
                color: tokens.text.dark,
                fontSize: tokens.fontSize.md,
                fontWeight: 700,
                opacity,
                transform: `translateY(${y}px)`,
              }}
            >
              {label}
            </div>
          );
        })}
      </div>

      <div
        style={{
          marginTop: tokens.spacing.xl,
          maxWidth: 560,
          borderRadius: tokens.radius.lg,
          overflow: 'hidden',
          border: `1px solid ${tokens.bg.lightBorder}`,
          boxShadow: `0 30px 100px rgba(10,12,20,0.18), 0 0 50px rgba(0,242,255,0.12)`,
          opacity: imageOpacity,
          transform: `scale(${imageScale})`,
        }}
      >
        <Img src={staticFile('presentation/stores.png')} style={{ width: '100%', height: 'auto', display: 'block' }} />
      </div>
    </div>
  );
};

