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

// Rest rotation (the "always facing user" default pose)
const REST_ROTATION = new THREE.Euler(0.0, 0.4, 0);

function WalkieTalkie() {
  const { scene } = useGLTF('/models/walkie-talkie/scene.gltf');
  const yGroupRef = useRef<THREE.Group>(null!);  // outer: Y rotation only
  const xGroupRef = useRef<THREE.Group>(null!);  // inner: X rotation only

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
  // Target rotation offset from rest (where we're dragging toward)
  const targetOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = gl.domElement;

    const onPointerDown = (e: PointerEvent) => {
      isDragging.current = true;
      dragStart.current = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging.current) return;

      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;

      // atan gives natural diminishing returns — drags far but rotation tapers off
      targetOffset.current = {
        x: Math.atan(dy / DRAG_SENSITIVITY) * MAX_ROTATION * 2,
        y: Math.atan(dx / DRAG_SENSITIVITY) * MAX_ROTATION * 2,
      };
    };

    const onPointerUp = (e: PointerEvent) => {
      isDragging.current = false;
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
  }, [gl]);

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
          scale={1.35}
          position={[0, -0.8, 0]}
        />
      </group>
    </group>
  );
}

export default function RadioViewer() {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 30,
        right: 40,
        width: '350px',
        height: '450px',
        pointerEvents: 'none',
      }}
    >
      <Canvas
        gl={{ alpha: true, antialias: true }}
        camera={{ position: [0, 0.3, 2.5], fov: 35 }}
        style={{ pointerEvents: 'auto', cursor: 'grab' }}
      >
        <Suspense fallback={null}>
          <WalkieTalkie />
          <ambientLight intensity={2} />
          <directionalLight position={[2, 3, 4]} intensity={0.5} />
        </Suspense>
      </Canvas>
    </div>
  );
}

useGLTF.preload('/models/walkie-talkie/scene.gltf');
