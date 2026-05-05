import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { Img, staticFile } from 'remotion';
import { tokens } from '../design/tokens';
import { zh } from '../copy/zh';
import { RevealText } from '../design/TextEffects';

const steps = [
  zh.sixSteps.step1,
  zh.sixSteps.step2,
  zh.sixSteps.step3,
  zh.sixSteps.step4,
  zh.sixSteps.step5,
  zh.sixSteps.step6,
];

const SCENE_DURATION_FRAMES = 30 * 30;

export const SixSteps: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const stepDuration = SCENE_DURATION_FRAMES / 6;
  const currentStep = Math.min(5, Math.floor(frame / stepDuration));

  const imageSpring = spring({ frame: frame - 20, fps, config: { damping: 14 } });
  const imageOpacity = interpolate(imageSpring, [0, 1], [0, 1]);
  const imageY = interpolate(imageSpring, [0, 1], [24, 0]);

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
          text={zh.sixSteps.headline}
          fontSize={tokens.fontSize.xl}
          color={tokens.brand.red}
          letterSpacing={6}
          delay={0}
        />
      </div>
      <div
        style={{
          display: 'flex',
          flex: 1,
          width: '100%',
          maxWidth: 1100,
          gap: tokens.spacing.xl,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            flex: '0 0 420px',
            position: 'relative',
            borderRadius: tokens.radius.lg,
            overflow: 'hidden',
            border: `1px solid ${tokens.bg.lightBorder}`,
            boxShadow: `0 30px 100px rgba(10,12,20,0.18), 0 0 40px ${tokens.brand.redLight}`,
            opacity: imageOpacity,
            transform: `translateY(${imageY}px)`,
          }}
        >
          <Img
            src={staticFile('presentation/maintenance.png')}
            style={{ width: '100%', height: 'auto', display: 'block' }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              background: 'linear-gradient(transparent, rgba(10,12,20,0.72))',
              padding: tokens.spacing.md,
              color: '#ffffff',
              fontSize: tokens.fontSize.sm,
              fontWeight: 600,
            }}
          >
            Step {currentStep + 1}: {steps[currentStep]}
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: tokens.spacing.sm,
            flex: '1 1 auto',
          }}
        >
          {steps.map((label, i) => {
            const stepSpring = spring({ frame: frame - 35 - i * 5, fps, config: { damping: 14 } });
            const stepOpacity = interpolate(stepSpring, [0, 1], [0, 1]);
            const stepY = interpolate(stepSpring, [0, 1], [16, 0]);
            const isActive = i <= currentStep;
            return (
              <div
                key={i}
                style={{
                  background: isActive ? tokens.brand.redLight : tokens.bg.lightCard,
                  border: `2px solid ${isActive ? tokens.brand.red : tokens.bg.lightBorder}`,
                  borderRadius: tokens.radius.md,
                  padding: tokens.spacing.sm,
                  color: tokens.text.dark,
                  fontSize: tokens.fontSize.sm,
                  display: 'flex',
                  alignItems: 'center',
                  gap: tokens.spacing.sm,
                  opacity: stepOpacity,
                  transform: `translateY(${stepY}px)`,
                }}
              >
                <span
                  style={{
                    width: 28,
                    height: 28,
                    background: isActive ? tokens.brand.red : 'rgba(10,12,20,0.12)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: 14,
                    color: isActive ? '#ffffff' : tokens.text.dark,
                  }}
                >
                  {i < currentStep ? '✓' : i + 1}
                </span>
                {label}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
