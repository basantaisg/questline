'use client';

import { Float, MeshDistortMaterial } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

/**
 * The living progression crystal.
 * - Rotation speed scales with current streak intensity.
 * - Color morphs with level: cyan → magenta → gold.
 * - Distortion (the "pulse") rises with streak heat.
 */
function Gem({ level, streakIntensity }: { level: number; streakIntensity: number }) {
  const mesh = useRef<THREE.Mesh>(null);

  const color = useMemo(() => {
    const cyan = new THREE.Color('#38e1ff');
    const magenta = new THREE.Color('#ff4ecd');
    const gold = new THREE.Color('#ffd54d');
    if (level <= 10) return cyan.lerp(magenta, level / 10);
    return magenta.lerp(gold, Math.min((level - 10) / 20, 1));
  }, [level]);

  useFrame((state, delta) => {
    if (!mesh.current) return;
    const speed = 0.25 + streakIntensity * 0.9;
    mesh.current.rotation.y += delta * speed;
    mesh.current.rotation.x += delta * speed * 0.35;
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.03 * (1 + streakIntensity);
    mesh.current.scale.setScalar(pulse);
  });

  return (
    <Float speed={2} rotationIntensity={0.4} floatIntensity={1.2}>
      <mesh ref={mesh}>
        <icosahedronGeometry args={[1.35, 1]} />
        <MeshDistortMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.35 + streakIntensity * 0.4}
          roughness={0.15}
          metalness={0.85}
          distort={0.22 + streakIntensity * 0.18}
          speed={2 + streakIntensity * 2}
          wireframe={false}
        />
      </mesh>
      {/* wire shell */}
      <mesh scale={1.28}>
        <icosahedronGeometry args={[1.35, 1]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.12} />
      </mesh>
    </Float>
  );
}

export default function Crystal({
  level,
  bestStreak,
}: {
  level: number;
  bestStreak: number;
}) {
  // 0 → dormant, 1 → fully ignited (30-day streak).
  const intensity = Math.min(bestStreak / 30, 1);

  return (
    <div className="h-64 w-full" role="img" aria-label={`Level ${level} progression crystal`}>
      <Canvas camera={{ position: [0, 0, 4.2], fov: 45 }} dpr={[1, 2]}>
        <ambientLight intensity={0.4} />
        <pointLight position={[4, 4, 4]} intensity={40} color="#38e1ff" />
        <pointLight position={[-4, -2, 3]} intensity={30} color="#ff4ecd" />
        <Gem level={level} streakIntensity={intensity} />
      </Canvas>
    </div>
  );
}
