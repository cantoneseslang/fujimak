import React from 'react';
import * as THREE from 'three';
import { tokens } from '../design/tokens';

type GlassPanelProps = {
  width: number;
  height: number;
  thickness?: number;
  texture?: THREE.Texture;
  opacity?: number;
};

export const GlassPanel: React.FC<GlassPanelProps> = ({
  width,
  height,
  thickness = 0.1,
  texture,
  opacity = tokens.three.glassOpacity,
}) => {
  return (
    <group>
      {/* Main glass body */}
      <mesh>
        <boxGeometry args={[width, height, thickness]} />
        <meshPhysicalMaterial
          map={texture}
          transparent
          opacity={opacity}
          roughness={tokens.three.glassRoughness}
          metalness={tokens.three.glassMetalness}
          transmission={tokens.three.glassTransmission}
          thickness={thickness}
          envMapIntensity={1}
          clearcoat={1}
          clearcoatRoughness={0}
          color="#ffffff"
        />
      </mesh>
      {/* Glowing edge highlight */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[width + 0.02, height + 0.02, thickness + 0.01]} />
        <meshBasicMaterial
          color={tokens.brand.red}
          wireframe
          transparent
          opacity={0.3}
        />
      </mesh>
    </group>
  );
};
