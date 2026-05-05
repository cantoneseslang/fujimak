import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { tokens } from '../design/tokens';
import { zh } from '../copy/zh';
import { RevealText } from '../design/TextEffects';

export const BeforeAfter: React.FC = () => {
  const { width, height, fps } = useVideoConfig();
  const frame = useCurrentFrame();

  const beforeSpring = spring({ frame: frame - 15, fps, config: { damping: 14 } });
  const afterSpring = spring({ frame: frame - 30, fps, config: { damping: 14 } });

  const beforeOpacity = interpolate(beforeSpring, [0, 1], [0, 1]);
  const beforeY = interpolate(beforeSpring, [0, 1], [30, 0]);
  const afterOpacity = interpolate(afterSpring, [0, 1], [0, 1]);
  const afterY = interpolate(afterSpring, [0, 1], [30, 0]);

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
      <div style={{ marginBottom: tokens.spacing.xl }}>
        <RevealText
          text={zh.beforeAfter.headline}
          fontSize={tokens.fontSize.xl}
          color={tokens.brand.red}
          letterSpacing={6}
          delay={0}
        />
      </div>
      <div style={{ display: 'flex', gap: tokens.spacing.xl, flexWrap: 'wrap', justifyContent: 'center' }}>
        <div
          style={{
            background: tokens.bg.lightCard,
            border: `2px solid ${tokens.brand.glow}`,
            borderRadius: tokens.radius.lg,
            padding: tokens.spacing.lg,
            minWidth: 280,
            color: tokens.text.dark,
            opacity: beforeOpacity,
            transform: `translateY(${beforeY}px)`,
            boxShadow: `0 28px 90px rgba(10,12,20,0.14), 0 0 30px ${tokens.brand.redLight}`,
          }}
        >
          <h3 style={{ color: tokens.brand.red, marginBottom: tokens.spacing.md, fontWeight: 700 }}>
            Before
          </h3>
          <p style={{ fontSize: tokens.fontSize.sm }}>{zh.beforeAfter.before}</p>
        </div>
        <div
          style={{
            background: tokens.bg.lightCard,
            border: `2px solid ${tokens.brand.cyan}`,
            borderRadius: tokens.radius.lg,
            padding: tokens.spacing.lg,
            minWidth: 280,
            color: tokens.text.dark,
            opacity: afterOpacity,
            transform: `translateY(${afterY}px)`,
            boxShadow: `0 28px 90px rgba(10,12,20,0.14), 0 0 30px rgba(0, 242, 255, 0.18)`,
          }}
        >
          <h3 style={{ color: tokens.brand.cyan, marginBottom: tokens.spacing.md, fontWeight: 700 }}>
            After
          </h3>
          <p style={{ fontSize: tokens.fontSize.sm }}>{zh.beforeAfter.after}</p>
        </div>
      </div>
    </div>
  );
};
