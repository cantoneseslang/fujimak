import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { Img, staticFile } from 'remotion';
import { tokens } from '../design/tokens';
import { zh } from '../copy/zh';
import { RevealText } from '../design/TextEffects';

const nodes = ['店舖', '業者', '總部'] as const;

export const SystemOverview: React.FC = () => {
  const { width, height, fps } = useVideoConfig();
  const frame = useCurrentFrame();

  const imageSpring = spring({ frame: frame - 25, fps, config: { damping: 14 } });
  const imageOpacity = interpolate(imageSpring, [0, 1], [0, 1]);
  const imageScale = interpolate(imageSpring, [0, 1], [0.95, 1]);

  return (
    <div
      style={{
        width,
        height,
        background: tokens.bg.light,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: tokens.spacing.xl,
      }}
    >
      <div style={{ marginBottom: tokens.spacing.sm }}>
        <RevealText
          text={zh.system.headline}
          fontSize={tokens.fontSize.xl}
          color={tokens.brand.red}
          letterSpacing={6}
          delay={0}
        />
      </div>
      <div style={{ marginBottom: tokens.spacing.lg }}>
        <RevealText
          text={zh.system.samePlatform}
          fontSize={tokens.fontSize.md}
          color={tokens.text.darkMuted}
          letterSpacing={2}
          delay={12}
        />
      </div>
      <div
        style={{
          display: 'flex',
          gap: tokens.spacing.xl,
          alignItems: 'center',
          justifyContent: 'center',
          flexWrap: 'wrap',
          marginBottom: tokens.spacing.lg,
        }}
      >
        {nodes.map((label, i) => {
          const nodeSpring = spring({ frame: frame - 20 - i * 8, fps, config: { damping: 14 } });
          const opacity = interpolate(nodeSpring, [0, 1], [0, 1]);
          const y = interpolate(nodeSpring, [0, 1], [20, 0]);
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
                fontWeight: 600,
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
          maxWidth: 500,
          borderRadius: tokens.radius.md,
          overflow: 'hidden',
          border: `1px solid ${tokens.bg.lightBorder}`,
          boxShadow: `0 30px 100px rgba(10,12,20,0.18), 0 0 40px ${tokens.brand.redLight}`,
          opacity: imageOpacity,
          transform: `scale(${imageScale})`,
        }}
      >
        <Img
          src={staticFile('presentation/stores.png')}
          style={{ width: '100%', height: 'auto', display: 'block' }}
        />
      </div>
    </div>
  );
};
