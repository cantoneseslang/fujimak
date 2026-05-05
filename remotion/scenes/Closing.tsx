import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { Img, staticFile } from 'remotion';
import { tokens } from '../design/tokens';
import { zh } from '../copy/zh';
import { RevealText } from '../design/TextEffects';

export const Closing: React.FC = () => {
  const { width, height, fps } = useVideoConfig();
  const frame = useCurrentFrame();

  const thanksSpring = spring({ frame, fps, config: { damping: 14 } });
  const ctaSpring = spring({ frame: frame - 25, fps, config: { damping: 14 } });
  const logoSpring = spring({ frame: frame - 45, fps, config: { damping: 14 } });
  const companySpring = spring({ frame: frame - 60, fps, config: { damping: 14 } });

  const thanksOpacity = interpolate(thanksSpring, [0, 1], [0, 1]);
  const thanksY = interpolate(thanksSpring, [0, 1], [30, 0]);
  const ctaOpacity = interpolate(ctaSpring, [0, 1], [0, 1]);
  const logoOpacity = interpolate(logoSpring, [0, 1], [0, 1]);
  const logoScale = interpolate(logoSpring, [0, 1], [0.8, 1]);
  const companyOpacity = interpolate(companySpring, [0, 1], [0, 1]);

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
      <div
        style={{
          opacity: thanksOpacity,
          transform: `translateY(${thanksY}px)`,
          marginBottom: tokens.spacing.lg,
          position: 'relative',
        }}
      >
        <RevealText
          text={zh.closing.thanks}
          fontSize={tokens.fontSize.title}
          color={tokens.text.dark}
          letterSpacing={8}
          delay={0}
        />
      </div>
      <p
        style={{
          fontSize: tokens.fontSize.md,
          opacity: ctaOpacity,
          marginBottom: tokens.spacing.xl,
          textAlign: 'center',
          maxWidth: 700,
          fontWeight: 600,
          color: tokens.text.darkMuted,
          position: 'relative',
        }}
      >
        {zh.closing.cta}
      </p>
      <div
        style={{
          opacity: logoOpacity,
          transform: `scale(${logoScale})`,
          marginBottom: tokens.spacing.lg,
          position: 'relative',
        }}
      >
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
      <p
        style={{
          fontSize: tokens.fontSize.sm,
          opacity: companyOpacity,
          fontWeight: 500,
          color: tokens.text.darkMuted,
          position: 'relative',
        }}
      >
        {zh.closing.company}
      </p>
    </div>
  );
};
