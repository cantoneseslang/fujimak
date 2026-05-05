import React, { useMemo } from 'react';
import { useCurrentFrame, useVideoConfig, staticFile } from 'remotion';
import * as THREE from 'three';
import { GlassPanel } from './GlassPanel';
import { tokens } from '../design/tokens';

export const FloatingScreens: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  const textureLoader = useMemo(() => new THREE.TextureLoader(), []);
  const logoTexture = useMemo(
    () => textureLoader.load(staticFile('images/logo.png')),
    [textureLoader]
  );
  const dashboardTexture = useMemo(
    () => textureLoader.load(staticFile('presentation/dashboard.png')),
    [textureLoader]
  );
  const maintenanceTexture = useMemo(
    () => textureLoader.load(staticFile('presentation/maintenance.png')),
    [textureLoader]
  );

  const logoScale = Math.min(1.2, t * 0.6);
  const logoOpacity = Math.min(1, t * 0.8);
  const panelRotationY = t * 0.15;
  const panel2RotationY = t * 0.1 + 0.5;
  const floatingAnim = Math.sin(t * 1.5) * 0.2;

  const particleCount = 120;
  const particlePositions = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 25;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 15;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 20;
    }
    return pos;
  }, []);

  return (
    <group>
      <points>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[particlePositions, 3]}
            count={particleCount}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.12}
          color={tokens.brand.cyan}
          transparent
          opacity={0.4 + Math.sin(t * 2) * 0.2}
          sizeAttenuation
        />
      </points>

      {/* Center Logo Panel */}
      <group position={[0, floatingAnim, 2]} scale={[logoScale, logoScale, 1]}>
        <GlassPanel width={3} height={3} texture={logoTexture} opacity={logoOpacity} />
      </group>

      {/* Dashboard Side Panel */}
      <group position={[4.5, 1.5 + floatingAnim * 0.5, -2]} rotation={[0, panelRotationY, 0.1]}>
        <GlassPanel width={4} height={2.25} texture={dashboardTexture} />
      </group>

      {/* Maintenance Side Panel */}
      <group position={[-4, -0.8 + floatingAnim * 0.7, -1]} rotation={[0, panel2RotationY, -0.05]}>
        <GlassPanel width={3.2} height={2} texture={maintenanceTexture} />
      </group>

      {/* Additional ambient elements */}
      <mesh position={[0, -10, -5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial
          color={tokens.bg.dark}
          roughness={0.1}
          metalness={0.8}
        />
      </mesh>
    </group>
  );
};
