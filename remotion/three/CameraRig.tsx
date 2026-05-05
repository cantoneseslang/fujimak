import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

const CameraRig: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const { camera } = useThree();

  // Slow orbit + slight zoom in over first 8 seconds. Animation driven by useCurrentFrame only (no useFrame).
  const angle = t * 0.15;
  const radius = Math.max(6, 12 - t * 0.3);
  const x = Math.sin(angle) * radius;
  const z = Math.cos(angle) * radius;
  const y = 2 + t * 0.1;
  camera.position.set(x, y, z);
  (camera as THREE.PerspectiveCamera).lookAt(0, 0, 0);
  camera.updateProjectionMatrix();

  return null;
};

export { CameraRig };
