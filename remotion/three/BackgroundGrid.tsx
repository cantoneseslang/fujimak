import React, { useMemo } from 'react';
import { useCurrentFrame } from 'remotion';
import { tokens } from '../design/tokens';

export const BackgroundGrid: React.FC = () => {
  const frame = useCurrentFrame();
  const speed = 0.02;
  const offset = frame * speed;

  const size = 100;
  const divisions = 50;

  return (
    <group position={[0, -5, 0]}>
      <gridHelper
        args={[size, divisions, tokens.brand.red, tokens.bg.grid]}
        position={[0, 0, offset % (size / divisions)]}
        rotation={[0, 0, 0]}
      />
      <ambientLight intensity={0.2} />
      <pointLight position={[0, 5, 0]} intensity={1} color={tokens.brand.cyan} />
    </group>
  );
};
