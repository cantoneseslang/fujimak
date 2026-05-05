import React from 'react';
import { spring, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { tokens } from './tokens';

type RevealTextProps = {
  text: string;
  fontSize?: number;
  color?: string;
  delay?: number;
  letterSpacing?: number;
};

export const RevealText: React.FC<RevealTextProps> = ({
  text,
  fontSize = tokens.fontSize.lg,
  color = tokens.text.primary,
  delay = 0,
  letterSpacing = 4,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const chars = Array.from(text);

  return (
    <div
      style={{
        display: 'flex',
        fontSize,
        color,
        fontWeight: 700,
        letterSpacing,
        fontFamily: 'sans-serif',
      }}
    >
      {chars.map((char, i) => {
        const spr = spring({
          frame: frame - delay - i * 2,
          fps,
          config: { damping: 12 },
        });

        const opacity = interpolate(spr, [0, 1], [0, 1]);
        const y = interpolate(spr, [0, 1], [20, 0]);
        const blur = interpolate(spr, [0, 1], [10, 0]);

        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              opacity,
              transform: `translateY(${y}px)`,
              filter: `blur(${blur}px)`,
              whiteSpace: char === ' ' ? 'pre' : 'normal',
            }}
          >
            {char}
          </span>
        );
      })}
    </div>
  );
};
