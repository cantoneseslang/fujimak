import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { tokens } from '../design/tokens';
import { zh } from '../copy/zh';
import { RevealText } from '../design/TextEffects';

const benefitItems = [
  zh.benefits.efficiency,
  zh.benefits.visibility,
  zh.benefits.data,
  zh.benefits.speed,
  zh.benefits.cost,
  zh.benefits.language,
];

export const Benefits: React.FC = () => {
  const { width, height, fps } = useVideoConfig();
  const frame = useCurrentFrame();

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
      <div style={{ marginBottom: tokens.spacing.xl }}>
        <RevealText
          text={zh.benefits.headline}
          fontSize={tokens.fontSize.xl}
          color={tokens.brand.red}
          letterSpacing={6}
          delay={0}
        />
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: tokens.spacing.md,
          maxWidth: 1000,
        }}
      >
        {benefitItems.map((label, i) => {
          const cardSpring = spring({ frame: frame - 25 - i * 6, fps, config: { damping: 14 } });
          const opacity = interpolate(cardSpring, [0, 1], [0, 1]);
          const y = interpolate(cardSpring, [0, 1], [24, 0]);
          return (
            <div
              key={i}
              style={{
                background: tokens.bg.lightCard,
                border: `1px solid rgba(196,30,58,0.28)`,
                borderRadius: tokens.radius.lg,
                padding: tokens.spacing.lg,
                color: tokens.text.dark,
                fontSize: tokens.fontSize.sm,
                textAlign: 'center',
                opacity,
                transform: `translateY(${y}px)`,
                boxShadow: `0 26px 80px rgba(10,12,20,0.14), 0 0 24px ${tokens.brand.redLight}`,
              }}
            >
              {label}
            </div>
          );
        })}
      </div>
    </div>
  );
};
