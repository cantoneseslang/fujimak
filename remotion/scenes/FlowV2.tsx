import React from 'react';
import { Img, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { tokens } from '../design/tokens';
import { RevealText } from '../design/TextEffects';
import { zhV2 } from '../copy/zhV2';
import { zh } from '../copy/zh';

const steps = [
  zh.sixSteps.step1,
  zh.sixSteps.step2,
  zh.sixSteps.step3,
  zh.sixSteps.step4,
  zh.sixSteps.step5,
  zh.sixSteps.step6,
];

export const FlowV2: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();

  const imageSpr = spring({ frame: frame - 18, fps, config: { damping: 14 } });
  const imageOpacity = interpolate(imageSpr, [0, 1], [0, 1]);
  const imageY = interpolate(imageSpr, [0, 1], [24, 0]);

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
      <div style={{ marginBottom: tokens.spacing.md }}>
        <RevealText
          text={zhV2.flow.headline}
          fontSize={tokens.fontSize.xl}
          color={tokens.brand.red}
          letterSpacing={6}
          delay={0}
        />
      </div>
      <div style={{ marginBottom: tokens.spacing.lg }}>
        <RevealText
          text={zhV2.flow.sub}
          fontSize={tokens.fontSize.md}
          color={tokens.text.darkMuted}
          letterSpacing={2}
          delay={12}
        />
      </div>

      <div style={{ display: 'flex', flex: 1, gap: tokens.spacing.xl, alignItems: 'center' }}>
        <div
          style={{
            flex: '0 0 520px',
            maxWidth: '52%',
            borderRadius: tokens.radius.lg,
            overflow: 'hidden',
            border: `1px solid ${tokens.bg.lightBorder}`,
            boxShadow: `0 30px 100px rgba(10,12,20,0.18), 0 0 50px ${tokens.brand.redLight}`,
            opacity: imageOpacity,
            transform: `translateY(${imageY}px)`,
          }}
        >
          <Img src={staticFile('presentation/maintenance.png')} style={{ width: '100%', height: 'auto' }} />
        </div>

        <div style={{ flex: '1 1 auto', display: 'grid', gridTemplateColumns: '1fr', gap: tokens.spacing.sm }}>
          {steps.map((label, i) => {
            const spr = spring({ frame: frame - 30 - i * 5, fps, config: { damping: 14 } });
            const opacity = interpolate(spr, [0, 1], [0, 1]);
            const y = interpolate(spr, [0, 1], [16, 0]);
            return (
              <div
                key={label}
                style={{
                  background: tokens.bg.lightCard,
                  border: `1px solid ${tokens.bg.lightBorder}`,
                  borderRadius: tokens.radius.md,
                  padding: tokens.spacing.sm,
                  color: tokens.text.dark,
                  fontSize: tokens.fontSize.sm,
                  display: 'flex',
                  alignItems: 'center',
                  gap: tokens.spacing.sm,
                  opacity,
                  transform: `translateY(${y}px)`,
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 999,
                    background: tokens.brand.redLight,
                    border: `1px solid ${tokens.brand.red}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    color: tokens.text.dark,
                    fontSize: 14,
                  }}
                >
                  {i + 1}
                </div>
                {label}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

