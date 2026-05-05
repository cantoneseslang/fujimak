import React from 'react';
import { Img, staticFile, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { tokens } from '../design/tokens';
import { RevealText } from '../design/TextEffects';

// Rebuild: use the actual system boot feeling (logo → main screen).
export const Intro3D: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();

  // Phase 1: Logo + title (like the current system boot)
  const logoSpr = spring({ frame: frame - 4, fps, config: { damping: 18, mass: 0.9 } });
  const logoOpacity = interpolate(logoSpr, [0, 1], [0, 1]);
  const logoScale = interpolate(logoSpr, [0, 1], [0.92, 1]);
  const logoFadeOut = interpolate(frame, [72, 92], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Phase 2: Main screen (Dashboard)
  const screenSpr = spring({ frame: frame - 82, fps, config: { damping: 18, mass: 1 } });
  const screenOpacity = interpolate(screenSpr, [0, 1], [0, 1]);
  const screenScale = interpolate(screenSpr, [0, 1], [1.03, 1]);
  const screenY = interpolate(screenSpr, [0, 1], [22, 0]);

  return (
    <div
      style={{
        width,
        height,
        // Light UI-like background so the black logo stays visible
        background: '#F6F7FB',
        position: 'relative',
      }}
    >
      {/* Background depth (frame-stable, no CSS animations) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(900px 650px at 50% 35%, rgba(0, 242, 255, 0.08) 0%, transparent 60%), radial-gradient(900px 700px at 50% 92%, rgba(196, 30, 58, 0.10) 0%, transparent 65%)',
          opacity: 1,
        }}
      />

      {/* Boot logo + title */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: logoOpacity * logoFadeOut,
          transform: `scale(${logoScale})`,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
          <div
            style={{
              width: 220,
              height: 220,
              borderRadius: 56,
              background: 'rgba(255,255,255,0.88)',
              border: '1px solid rgba(10, 12, 20, 0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow:
                '0 26px 80px rgba(10, 12, 20, 0.18), 0 0 48px rgba(0, 242, 255, 0.12)',
            }}
          >
            <Img
              src={staticFile('images/logo.png')}
              style={{
                width: 170,
                height: 170,
                objectFit: 'contain',
                // Make the black logo readable on any background
                filter:
                  'drop-shadow(0 10px 24px rgba(10,12,20,0.25)) drop-shadow(0 0 18px rgba(255,255,255,0.9))',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <RevealText
              text="壽司郎維護管理系統"
              fontSize={56}
              color="#0B0C10"
              letterSpacing={6}
              delay={18}
            />
          </div>
        </div>
      </div>

      {/* Main screen */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: screenOpacity,
          transform: `translateY(${screenY}px) scale(${screenScale})`,
        }}
      >
        <div
          style={{
            width: 1400,
            maxWidth: '92%',
            borderRadius: 28,
            overflow: 'hidden',
            background: '#ffffff',
            border: `1px solid rgba(10, 12, 20, 0.08)`,
            boxShadow: `0 40px 120px rgba(10, 12, 20, 0.22), 0 0 70px rgba(0,242,255,0.08)`,
          }}
        >
          <Img
            src={staticFile('presentation/dashboard.png')}
            style={{ width: '100%', height: 'auto', display: 'block' }}
          />
        </div>
      </div>
    </div>
  );
};
