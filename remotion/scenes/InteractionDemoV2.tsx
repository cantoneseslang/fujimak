import React from 'react';
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { tokens } from '../design/tokens';

const IMG_W = 1626;
const IMG_H = 1882;

const Cursor: React.FC<{ x: number; y: number; scale?: number; opacity?: number }> = ({
  x,
  y,
  scale = 1,
  opacity = 1,
}) => {
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `translate(-8px, -6px) scale(${scale})`,
        opacity,
        filter: 'drop-shadow(0 10px 18px rgba(10,12,20,0.25))',
      }}
    >
      <svg width="44" height="44" viewBox="0 0 64 64" fill="none">
        <path
          d="M14 10L44 40L31 41L37 54L31 57L25 44L17 52L14 10Z"
          fill="#0B0C10"
          stroke="white"
          strokeWidth="3"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};

const ClickRipple: React.FC<{ x: number; y: number; t: number; color?: string }> = ({
  x,
  y,
  t,
  color = tokens.brand.red,
}) => {
  const s = interpolate(t, [0, 1], [0.4, 1.9]);
  const o = interpolate(t, [0, 0.7, 1], [0, 0.55, 0]);
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: 26,
        height: 26,
        borderRadius: 999,
        border: `2px solid ${color}`,
        transform: `translate(-50%, -50%) scale(${s})`,
        opacity: o,
        boxShadow: `0 0 26px ${tokens.brand.redLight}`,
      }}
    />
  );
};

const Highlight: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  opacity: number;
  color?: string;
}> = ({ x, y, w, h, opacity, color = tokens.brand.red }) => {
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        borderRadius: 18,
        border: `3px solid ${color}`,
        boxShadow: `0 0 28px ${tokens.brand.redLight}`,
        opacity,
        pointerEvents: 'none',
      }}
    />
  );
};

const Toast: React.FC<{ text: string; opacity: number }> = ({ text, opacity }) => {
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: 90,
        transform: 'translateX(-50%)',
        padding: '14px 18px',
        borderRadius: 14,
        background: tokens.bg.lightCard,
        border: `1px solid ${tokens.bg.lightBorder}`,
        boxShadow: `0 24px 70px rgba(10,12,20,0.18)`,
        color: tokens.text.dark,
        fontSize: 18,
        fontWeight: 800,
        letterSpacing: 0.5,
        opacity,
      }}
    >
      {text}
    </div>
  );
};

export const InteractionDemoV2: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();

  // Timeline (frames)
  const tClickDashboard = 28;
  const tShowMaintenance = 38;
  const tClickArea = 52;
  const tClickNext = 78;
  const tFastToSend = 110;
  const tClickSend = 136;

  // Screen cards
  const cardW = 1400;
  const cardH = 820;
  const cardX = (width - cardW) / 2;
  const cardY = (height - cardH) / 2;

  // The screenshots are portrait. Fit them into our landscape card with `contain`.
  const drawH = cardH;
  const drawW = (cardH * IMG_W) / IMG_H; // 820 * (1626/1882) ≈ 709
  const padX = (cardW - drawW) / 2;

  const dashSpr = spring({ frame: frame - 0, fps, config: { damping: 16 } });
  const dashOpacity = interpolate(dashSpr, [0, 1], [0, 1]);
  const dashScale = interpolate(dashSpr, [0, 1], [0.985, 1]);

  const maintSpr = spring({ frame: frame - tShowMaintenance, fps, config: { damping: 16 } });
  const maintOpacity = interpolate(maintSpr, [0, 1], [0, 1]);
  const maintY = interpolate(maintSpr, [0, 1], [18, 0]);

  const map = (px: number, py: number) => ({
    x: cardX + padX + (px / IMG_W) * drawW,
    y: cardY + (py / IMG_H) * drawH,
  });

  // Targets in screenshot pixel-space (tuned to real buttons)
  const dashNewRequest = map(300, 620); // 「新維護呼叫」 tile center (left tile)
  const maintAreaAll = map(520, 360); // 「全域」 button center
  const maintNextBtn = map(815, 1790); // 「下一步」 button center (bottom)
  const maintSendBtn = map(815, 1790); // reuse bottom button area for send in the simulated flow

  const move1 = spring({ frame: frame - 10, fps, config: { damping: 22, mass: 0.8 } });
  const cxDash = interpolate(move1, [0, 1], [cardX + cardW * 0.85, dashNewRequest.x]);
  const cyDash = interpolate(move1, [0, 1], [cardY + cardH * 0.75, dashNewRequest.y]);

  const moveArea = spring({ frame: frame - (tShowMaintenance + 8), fps, config: { damping: 22, mass: 0.8 } });
  const cxArea = interpolate(moveArea, [0, 1], [dashNewRequest.x, maintAreaAll.x]);
  const cyArea = interpolate(moveArea, [0, 1], [dashNewRequest.y, maintAreaAll.y]);

  const moveNext = spring({ frame: frame - (tClickArea + 10), fps, config: { damping: 22, mass: 0.8 } });
  const cxNext = interpolate(moveNext, [0, 1], [maintAreaAll.x, maintNextBtn.x]);
  const cyNext = interpolate(moveNext, [0, 1], [maintAreaAll.y, maintNextBtn.y]);

  const moveSend = spring({ frame: frame - (tFastToSend + 6), fps, config: { damping: 22, mass: 0.8 } });
  const cxSend = interpolate(moveSend, [0, 1], [maintNextBtn.x, maintSendBtn.x]);
  const cySend = interpolate(moveSend, [0, 1], [maintNextBtn.y, maintSendBtn.y]);

  const cursorX = frame < tShowMaintenance ? cxDash : frame < tClickArea + 6 ? cxArea : frame < tFastToSend ? cxNext : cxSend;
  const cursorY = frame < tShowMaintenance ? cyDash : frame < tClickArea + 6 ? cyArea : frame < tFastToSend ? cyNext : cySend;

  const clickDashT = interpolate(frame, [tClickDashboard - 6, tClickDashboard + 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const clickAreaT = interpolate(frame, [tClickArea - 6, tClickArea + 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const clickNextT = interpolate(frame, [tClickNext - 6, tClickNext + 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const clickSendT = interpolate(frame, [tClickSend - 6, tClickSend + 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const hintOpacity = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ background: tokens.bg.light }}>
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(900px 650px at 50% 35%, rgba(0, 242, 255, 0.08) 0%, transparent 60%), radial-gradient(900px 700px at 50% 92%, rgba(196, 30, 58, 0.10) 0%, transparent 65%)',
        }}
      />

      {/* Dashboard */}
      <div
        style={{
          position: 'absolute',
          left: cardX,
          top: cardY,
          width: cardW,
          height: cardH,
          borderRadius: 28,
          overflow: 'hidden',
          background: '#ffffff',
          border: `1px solid ${tokens.bg.lightBorder}`,
          boxShadow: `0 40px 120px rgba(10, 12, 20, 0.22), 0 0 70px rgba(0,242,255,0.08)`,
          opacity: dashOpacity,
          transform: `scale(${dashScale})`,
        }}
      >
        <Img
          src={staticFile('presentation/dashboard.png')}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      </div>

      {/* Maintenance overlay (after click) */}
      <div
        style={{
          position: 'absolute',
          left: cardX,
          top: cardY + maintY,
          width: cardW,
          height: cardH,
          borderRadius: 28,
          overflow: 'hidden',
          background: '#ffffff',
          border: `1px solid ${tokens.bg.lightBorder}`,
          boxShadow: `0 40px 120px rgba(10, 12, 20, 0.22), 0 0 70px rgba(196,30,58,0.10)`,
          opacity: maintOpacity,
        }}
      >
        <Img
          src={staticFile('presentation/maintenance.png')}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />

        {/* Simulated progress overlay so the demo reaches "Send" */}
        {frame >= tClickNext ? (
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              right: 0,
              bottom: 0,
              pointerEvents: 'none',
            }}
          >
            {/* Bottom CTA enabled + label changes */}
            <div
              style={{
                position: 'absolute',
                left: 90,
                right: 90,
                bottom: 38,
                height: 78,
                borderRadius: 18,
                background: frame >= tFastToSend ? tokens.brand.red : 'rgba(10,12,20,0.20)',
                boxShadow: frame >= tFastToSend ? `0 0 28px ${tokens.brand.redLight}` : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 900,
                fontSize: 26,
                letterSpacing: 2,
                opacity: 0.96,
              }}
            >
              {frame >= tFastToSend ? '送信' : '下一步'}
            </div>
          </div>
        ) : null}
      </div>

      {/* Hint labels (minimal) */}
      <div
        style={{
          position: 'absolute',
          left: cardX,
          top: cardY - 62,
          width: cardW,
          display: 'flex',
          justifyContent: 'space-between',
          opacity: hintOpacity,
          color: tokens.text.darkMuted,
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: 1,
        }}
      >
        <div>示範：點擊按鈕 → 選擇 → 下一步 → 送信</div>
        <div style={{ color: tokens.brand.red }}>（操作例）</div>
      </div>

      {/* Clicks */}
      {frame >= tClickDashboard - 6 && frame <= tClickDashboard + 12 ? (
        <ClickRipple x={dashNewRequest.x} y={dashNewRequest.y} t={clickDashT} color={tokens.brand.red} />
      ) : null}
      {frame >= tClickArea - 6 && frame <= tClickArea + 12 ? (
        <ClickRipple x={maintAreaAll.x} y={maintAreaAll.y} t={clickAreaT} color={tokens.brand.red} />
      ) : null}
      {frame >= tClickNext - 6 && frame <= tClickNext + 12 ? (
        <ClickRipple x={maintNextBtn.x} y={maintNextBtn.y} t={clickNextT} color={tokens.brand.cyan} />
      ) : null}
      {frame >= tClickSend - 6 && frame <= tClickSend + 12 ? (
        <ClickRipple x={maintSendBtn.x} y={maintSendBtn.y} t={clickSendT} color={tokens.brand.red} />
      ) : null}

      {/* Highlights on the actual buttons */}
      <Highlight
        x={dashNewRequest.x - 150}
        y={dashNewRequest.y - 65}
        w={300}
        h={140}
        opacity={interpolate(frame, [0, tClickDashboard - 2], [0.0, 0.55], { extrapolateRight: 'clamp' })}
        color={tokens.brand.red}
      />
      {frame >= tShowMaintenance ? (
        <Highlight
          x={maintAreaAll.x - 230}
          y={maintAreaAll.y - 40}
          w={460}
          h={84}
          opacity={interpolate(frame, [tShowMaintenance, tClickArea + 8], [0.2, 0.75], {
            extrapolateRight: 'clamp',
          })}
          color={tokens.brand.red}
        />
      ) : null}
      {frame >= tClickArea ? (
        <Highlight
          x={maintNextBtn.x - 260}
          y={maintNextBtn.y - 48}
          w={520}
          h={96}
          opacity={interpolate(frame, [tClickArea + 2, tClickNext + 10], [0.2, 0.75], {
            extrapolateRight: 'clamp',
          })}
          color={tokens.brand.cyan}
        />
      ) : null}

      {/* "Submitted" toast */}
      <Toast
        text="已提交（送信完了）"
        opacity={interpolate(frame, [tClickSend + 6, tClickSend + 20, tClickSend + 55], [0, 1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })}
      />

      {/* Cursor */}
      <Cursor x={cursorX} y={cursorY} scale={1} opacity={1} />
    </AbsoluteFill>
  );
};

