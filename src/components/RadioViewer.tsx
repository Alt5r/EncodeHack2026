'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { Suspense, useRef, useEffect } from 'react';
import * as THREE from 'three';

// Max rotation in radians (~35 degrees) — drag tapers off before reaching this
const MAX_ROTATION = 0.6;
// How quickly drag maps to rotation (lower = more sensitive)
const DRAG_SENSITIVITY = 300;
// Spring stiffness for snapping back (0-1, higher = snappier)
const SPRING_LERP = 0.08;
// If pointer moves less than this (px) between down/up, it's a click not a drag
const CLICK_THRESHOLD = 6;

// Rest rotation (the "always facing user" default pose)
const REST_ROTATION = new THREE.Euler(0.0, 0.4, 0);

function WalkieTalkie({ onToggle }: { onToggle: () => void }) {
  const { scene } = useGLTF('/models/walkie-talkie/scene.gltf');
  const yGroupRef = useRef<THREE.Group>(null!);
  const xGroupRef = useRef<THREE.Group>(null!);

  // Make materials matte — kill the shine
  useEffect(() => {
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const mat = child.material as THREE.MeshStandardMaterial;
        mat.roughness = 1;
        mat.metalness = 0;
        mat.needsUpdate = true;
      }
    });
  }, [scene]);
  const { gl } = useThree();

  // Drag state (not reactive — just tracking values)
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const dragDistance = useRef(0);
  // Target rotation offset from rest (where we're dragging toward)
  const targetOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = gl.domElement;

    const onPointerDown = (e: PointerEvent) => {
      isDragging.current = true;
      dragDistance.current = 0;
      dragStart.current = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging.current) return;

      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      dragDistance.current = Math.sqrt(dx * dx + dy * dy);

      // atan gives natural diminishing returns — drags far but rotation tapers off
      targetOffset.current = {
        x: Math.atan(dy / DRAG_SENSITIVITY) * MAX_ROTATION * 2,
        y: Math.atan(dx / DRAG_SENSITIVITY) * MAX_ROTATION * 2,
      };
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!isDragging.current) return;
      isDragging.current = false;

      // If barely moved, treat as click → toggle transcript
      if (dragDistance.current < CLICK_THRESHOLD) {
        onToggle();
      }
      // Spring back: set target to zero offset
      targetOffset.current = { x: 0, y: 0 };
      canvas.releasePointerCapture(e.pointerId);
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerUp);

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerUp);
    };
  }, [gl, onToggle]);

  useFrame(() => {
    if (!yGroupRef.current || !xGroupRef.current) return;

    // Lerp Y and X independently on separate groups — no coupling
    yGroupRef.current.rotation.y += ((REST_ROTATION.y + targetOffset.current.y) - yGroupRef.current.rotation.y) * SPRING_LERP;
    xGroupRef.current.rotation.x += ((REST_ROTATION.x + targetOffset.current.x) - xGroupRef.current.rotation.x) * SPRING_LERP;
  });

  return (
    <group ref={yGroupRef} rotation={[0, REST_ROTATION.y, 0]}>
      <group ref={xGroupRef} rotation={[REST_ROTATION.x, 0, 0]}>
        <primitive
          object={scene}
          scale={0.6}
          position={[0, 0, 0]}
        />
      </group>
    </group>
  );
}

interface RadioViewerProps {
  onToggle: () => void;
  containerStyle?: React.CSSProperties;
}

export default function RadioViewer({ onToggle, containerStyle }: RadioViewerProps) {
  return (
    <div
      style={containerStyle ?? {
        position: 'absolute',
        bottom: -180,
        right: -40,
        width: '400px',
        height: '500px',
        pointerEvents: 'none',
        zIndex: 15,
      }}
    >
      <Canvas
        gl={{ alpha: true, antialias: true }}
        camera={{ position: [0, 0.3, 2.5], fov: 35 }}
        style={{ pointerEvents: 'auto', cursor: 'grab' }}
      >
        <Suspense fallback={null}>
          <WalkieTalkie onToggle={onToggle} />
          <ambientLight intensity={2} />
          <directionalLight position={[2, 3, 4]} intensity={0.5} />
        </Suspense>
      </Canvas>
    </div>
  );
}

useGLTF.preload('/models/walkie-talkie/scene.gltf');
