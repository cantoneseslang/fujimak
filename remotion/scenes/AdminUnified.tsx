import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { Img, staticFile } from 'remotion';
import { tokens } from '../design/tokens';
import { zh } from '../copy/zh';
import { RevealText } from '../design/TextEffects';

export const AdminUnified: React.FC = () => {
  const { width, height, fps } = useVideoConfig();
  const frame = useCurrentFrame();

  const bodySpring = spring({ frame: frame - 18, fps, config: { damping: 14 } });
  const imageSpring = spring({ frame: frame - 35, fps, config: { damping: 14 } });
  const bodyOpacity = interpolate(bodySpring, [0, 1], [0, 1]);
  const bodyY = interpolate(bodySpring, [0, 1], [20, 0]);
  const imageOpacity = interpolate(imageSpring, [0, 1], [0, 1]);
  const imageScale = interpolate(imageSpring, [0, 1], [0.9, 1]);

  return (
    <div
      style={{
        width,
        height,
        background: tokens.bg.light,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: tokens.spacing.xl,
      }}
    >
      <div style={{ marginBottom: tokens.spacing.md }}>
        <RevealText
          text={zh.admin.headline}
          fontSize={tokens.fontSize.xl}
          color={tokens.brand.red}
          letterSpacing={6}
          delay={0}
        />
      </div>
      <p
        style={{
          color: tokens.text.darkMuted,
          marginBottom: tokens.spacing.lg,
          fontSize: tokens.fontSize.md,
          opacity: bodyOpacity,
          transform: `translateY(${bodyY}px)`,
          textAlign: 'center',
          maxWidth: 800,
        }}
      >
        {zh.admin.body}
      </p>
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          maxWidth: 1000,
          opacity: imageOpacity,
          transform: `scale(${imageScale})`,
        }}
      >
        <Img
          src={staticFile('presentation/management.png')}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            borderRadius: tokens.radius.md,
            border: `1px solid ${tokens.bg.lightBorder}`,
            boxShadow: `0 30px 100px rgba(10,12,20,0.18), 0 0 48px ${tokens.brand.redLight}`,
          }}
        />
      </div>
    </div>
  );
};
