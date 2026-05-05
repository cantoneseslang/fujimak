import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { tokens } from '../design/tokens';
import { RevealText } from '../design/TextEffects';
import { zhV2 } from '../copy/zhV2';

export const ProblemV2: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();

  return (
    <div
      style={{
        width,
        height,
        background: tokens.bg.light,
        padding: tokens.spacing.xl,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
    >
      <div style={{ marginBottom: tokens.spacing.lg }}>
        <RevealText
          text={zhV2.problem.headline}
          fontSize={tokens.fontSize.xl}
          color={tokens.brand.red}
          letterSpacing={6}
          delay={0}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: tokens.spacing.md }}>
        {zhV2.problem.points.map((p, i) => {
          const spr = spring({ frame: frame - 18 - i * 8, fps, config: { damping: 14 } });
          const opacity = interpolate(spr, [0, 1], [0, 1]);
          const y = interpolate(spr, [0, 1], [24, 0]);
          return (
            <div
              key={p}
              style={{
                background: tokens.bg.lightCard,
                border: `1px solid ${tokens.bg.lightBorder}`,
                borderRadius: tokens.radius.lg,
                padding: tokens.spacing.lg,
                color: tokens.text.dark,
                fontSize: tokens.fontSize.sm,
                boxShadow: `0 26px 80px rgba(10,12,20,0.14)`,
                opacity,
                transform: `translateY(${y}px)`,
              }}
            >
              {p}
            </div>
          );
        })}
      </div>
    </div>
  );
};

