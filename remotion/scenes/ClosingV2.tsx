import React from 'react';
import { Img, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { tokens } from '../design/tokens';
import { RevealText } from '../design/TextEffects';
import { zhV2 } from '../copy/zhV2';

export const ClosingV2: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();

  const ctaSpr = spring({ frame: frame - 15, fps, config: { damping: 14 } });
  const logoSpr = spring({ frame: frame - 30, fps, config: { damping: 14 } });
  const companySpr = spring({ frame: frame - 45, fps, config: { damping: 14 } });

  const ctaOpacity = interpolate(ctaSpr, [0, 1], [0, 1]);
  const ctaY = interpolate(ctaSpr, [0, 1], [20, 0]);
  const logoOpacity = interpolate(logoSpr, [0, 1], [0, 1]);
  const logoScale = interpolate(logoSpr, [0, 1], [0.85, 1]);
  const companyOpacity = interpolate(companySpr, [0, 1], [0, 1]);

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
        color: tokens.text.dark,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(900px 650px at 50% 35%, rgba(0, 242, 255, 0.08) 0%, transparent 60%), radial-gradient(900px 700px at 50% 92%, rgba(196, 30, 58, 0.10) 0%, transparent 65%)',
          opacity: 1,
        }}
      />
      <div style={{ marginBottom: tokens.spacing.lg }}>
        <RevealText
          text={zhV2.closing.thanks}
          fontSize={tokens.fontSize.title}
          color={tokens.text.dark}
          letterSpacing={8}
          delay={0}
        />
      </div>
      <div style={{ opacity: ctaOpacity, transform: `translateY(${ctaY}px)`, marginBottom: tokens.spacing.xl }}>
        <div
          style={{
            fontSize: tokens.fontSize.md,
            fontWeight: 800,
            textAlign: 'center',
            color: tokens.text.darkMuted,
          }}
        >
          {zhV2.closing.cta}
        </div>
      </div>
      <div style={{ opacity: logoOpacity, transform: `scale(${logoScale})`, marginBottom: tokens.spacing.lg }}>
        <div
          style={{
            width: 160,
            height: 160,
            borderRadius: 44,
            background: tokens.bg.lightCard,
            border: `1px solid ${tokens.bg.lightBorder}`,
            boxShadow: `0 26px 80px rgba(10,12,20,0.16), 0 0 40px ${tokens.brand.redLight}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Img
            src={staticFile('images/logo.png')}
            style={{
              width: 120,
              height: 120,
              objectFit: 'contain',
              filter:
                'drop-shadow(0 10px 24px rgba(10,12,20,0.25)) drop-shadow(0 0 18px rgba(255,255,255,0.9))',
            }}
          />
        </div>
      </div>
      <div style={{ opacity: companyOpacity, fontSize: tokens.fontSize.sm, fontWeight: 600 }}>
        {zhV2.closing.company}
      </div>
    </div>
  );
};

