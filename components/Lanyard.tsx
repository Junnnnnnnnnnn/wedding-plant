/* eslint-disable @typescript-eslint/no-explicit-any */
 
'use client';
import { useEffect, useRef, useState } from 'react';
import { Canvas, extend, useFrame } from '@react-three/fiber';
import { useGLTF, useTexture, Environment, Lightformer, Text } from '@react-three/drei';
import {
  BallCollider,
  CuboidCollider,
  Physics,
  RigidBody,
  useRopeJoint,
  useSphericalJoint,
  RigidBodyProps
} from '@react-three/rapier';
import { MeshLineGeometry, MeshLineMaterial } from 'meshline';
import * as THREE from 'three';
import { useWedding } from '@/app/contexts/WeddingContext';

// Simple card geometry and lanyard texture will be created programmatically

import './Lanyard.css';

extend({ MeshLineGeometry, MeshLineMaterial });

// Type declarations for extended components
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
       
      meshLineGeometry: any;
       
      meshLineMaterial: any;
    }
  }
}

// Register meshline components properly
THREE.ShaderLib.meshline = {
  uniforms: {
    lineWidth: { value: 1 },
    resolution: { value: new THREE.Vector2(1000, 1000) },
    map: { value: null },
    useMap: { value: false },
    color: { value: new THREE.Color(0xffffff) },
    opacity: { value: 1 },
    transparent: { value: true },
    depthTest: { value: false }
  },
  vertexShader: `
    uniform float lineWidth;
    uniform vec2 resolution;
    #include <common>
    void main() {
      vec3 pos = position.xyz;
      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    uniform vec3 color;
    uniform float opacity;
    uniform bool useMap;
    uniform sampler2D map;
    void main() {
      vec4 texColor = vec4(color, opacity);
      if (useMap) {
        texColor *= texture2D(map, gl_PointCoord);
      }
      gl_FragColor = texColor;
    }
  `
};

interface LanyardProps {
  position?: [number, number, number];
  gravity?: [number, number, number];
  fov?: number;
  transparent?: boolean;
}

export default function Lanyard({
  position = [0, 0, 30],
  gravity = [0, -40, 0],
  fov = 20,
  transparent = true
}: LanyardProps) {
  const [isMobile, setIsMobile] = useState<boolean>(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const { weddingData } = useWedding();

  useEffect(() => {
    const handleResize = (): void => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="lanyard-wrapper">
      <Canvas
        camera={{ position, fov }}
        dpr={[1, isMobile ? 1.5 : 2]}
        gl={{ alpha: transparent }}
        onCreated={({ gl }) => gl.setClearColor(new THREE.Color(0x000000), transparent ? 0 : 1)}
      >
        <ambientLight intensity={Math.PI * 2} />
        <Physics gravity={gravity} timeStep={isMobile ? 1 / 30 : 1 / 60}>
          <Band isMobile={isMobile} weddingData={weddingData} />
        </Physics>
        <Environment blur={0.75}>
          <Lightformer
            intensity={4}
            color="white"
            position={[0, -1, 5]}
            rotation={[0, 0, Math.PI / 3]}
            scale={[100, 0.1, 1]}
          />
          <Lightformer
            intensity={6}
            color="white"
            position={[-1, -1, 1]}
            rotation={[0, 0, Math.PI / 3]}
            scale={[100, 0.1, 1]}
          />
          <Lightformer
            intensity={6}
            color="white"
            position={[1, 1, 1]}
            rotation={[0, 0, Math.PI / 3]}
            scale={[100, 0.1, 1]}
          />
          <Lightformer
            intensity={15}
            color="white"
            position={[-10, 0, 14]}
            rotation={[0, Math.PI / 2, Math.PI / 3]}
            scale={[100, 10, 1]}
          />
        </Environment>
      </Canvas>
    </div>
  );
}

interface BandProps {
  maxSpeed?: number;
  minSpeed?: number;
  isMobile?: boolean;
  weddingData: {
    budget: string;
    name: string;
    date?: { year: number; month: number; day: number };
  };
}

function Band({ maxSpeed = 50, minSpeed = 0, isMobile = false, weddingData }: BandProps) {
  // Using "any" for refs since the exact types depend on Rapier's internals
  const band = useRef<any>(null);
  const fixed = useRef<any>(null);
  const j1 = useRef<any>(null);
  const j2 = useRef<any>(null);
  const j3 = useRef<any>(null);
  const card = useRef<any>(null);

  const vec = new THREE.Vector3();
  const ang = new THREE.Vector3();
  const rot = new THREE.Vector3();
  const dir = new THREE.Vector3();

  const segmentProps: any = {
    type: 'dynamic' as RigidBodyProps['type'],
    canSleep: true,
    colliders: false,
    angularDamping: 4,
    linearDamping: 4
  };

// Create simple card geometry programmatically
  const cardGeometry = new THREE.BoxGeometry(0.8, 1.125, 0.01);
  const borderGeometry = new THREE.BoxGeometry(0.84, 1.165, 0.009); // 2px margin (0.02 units)
  
  // Create simple materials
  const cardMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.9,
    metalness: 0.8,
    clearcoat: isMobile ? 0 : 1,
    clearcoatRoughness: 0.15
  });
  
  const borderMaterial = new THREE.MeshStandardMaterial({
    color: 0xFFAAB8, // Same color as lanyard
    roughness: 0.5,
    metalness: 0
  });
  
  // Create simple lanyard texture
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Create a simple pattern for lanyard
    ctx.fillStyle = '#FFAAB8';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    for (let i = 0; i < 256; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 256);
      ctx.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  
  // Create gradient texture for divider line
  const gradientCanvas = document.createElement('canvas');
  gradientCanvas.width = 256;
  gradientCanvas.height = 64;
  const gradientCtx = gradientCanvas.getContext('2d');
  if (gradientCtx) {
    const gradient = gradientCtx.createLinearGradient(0, 0, 256, 0);
    gradient.addColorStop(0, '#FF69B4');
    gradient.addColorStop(0.5, '#FF85C1');
    gradient.addColorStop(1, '#FFA0D2');
    gradientCtx.fillStyle = gradient;
    gradientCtx.fillRect(0, 0, 256, 64);
  }
  const gradientTexture = new THREE.CanvasTexture(gradientCanvas);
  
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0), 
    new THREE.Vector3(0.5, 0, 0), 
    new THREE.Vector3(1, 0, 0), 
    new THREE.Vector3(1.5, 0, 0),
    new THREE.Vector3(2, 0, 0)
  ]);
  curve.curveType = 'chordal';
  const [dragged, drag] = useState<false | THREE.Vector3>(false);
  const [hovered, hover] = useState(false);

  useRopeJoint(fixed, j1, [[0, 0, 0], [0, 0, 0], 1]);
  useRopeJoint(j1, j2, [[0, 0, 0], [0, 0, 0], 1]);
  useRopeJoint(j2, j3, [[0, 0, 0], [0, 0, 0], 1]);
  useSphericalJoint(j3, card, [
    [0, 0, 0],
    [0, 0.0375, 0] // clip 상단 위치: -1.2 + (0.4 + 0.15) * 2.25 = 0.0375
  ]);

  useEffect(() => {
    if (hovered) {
      document.body.style.cursor = dragged ? 'grabbing' : 'grab';
      return () => {
        document.body.style.cursor = 'auto';
      };
    }
  }, [hovered, dragged]);

  useFrame((state, delta) => {
    if (dragged && typeof dragged !== 'boolean') {
      vec.set(state.pointer.x, state.pointer.y, 0.5).unproject(state.camera);
      dir.copy(vec).sub(state.camera.position).normalize();
      vec.add(dir.multiplyScalar(state.camera.position.length()));
      [card, j1, j2, j3, fixed].forEach(ref => ref.current?.wakeUp());
      card.current?.setNextKinematicTranslation({
        x: vec.x - dragged.x,
        y: vec.y - dragged.y,
        z: vec.z - dragged.z
      });
    }
    if (fixed.current && card.current && j3.current) {
      [j1, j2].forEach(ref => {
        if (!ref.current.lerped) ref.current.lerped = new THREE.Vector3().copy(ref.current.translation());
        const clampedDistance = Math.max(0.1, Math.min(1, ref.current.lerped.distanceTo(ref.current.translation())));
        ref.current.lerped.lerp(
          ref.current.translation(),
          delta * (minSpeed + clampedDistance * (maxSpeed - minSpeed))
        );
      });
      // Calculate card's attachment point (clip top where lanyard connects)
      // The joint anchor is at [0, 0.0375, 0] in card's local space (clip top)
      const cardTranslation = card.current.translation();
      const cardRotation = card.current.rotation();
      // Rapier returns rotation as quaternion {x, y, z, w}
      const quat = new THREE.Quaternion(cardRotation.x, cardRotation.y, cardRotation.z, cardRotation.w);
      const attachmentOffset = new THREE.Vector3(0, 0.0375, 0); // This matches the joint anchor - clip top
      attachmentOffset.applyQuaternion(quat);
      const cardAttachmentPoint = new THREE.Vector3().copy(cardTranslation).add(attachmentOffset);
      
      // Curve goes from fixed (top) through all joints to card attachment point (bottom)
      curve.points[0].copy(fixed.current.translation());
      curve.points[1].copy(j1.current.lerped);
      curve.points[2].copy(j2.current.lerped);
      curve.points[3].copy(j3.current.translation());
      curve.points[4].copy(cardAttachmentPoint);
      band.current.geometry.setPoints(curve.getPoints(isMobile ? 16 : 32));
      ang.copy(card.current.angvel());
      rot.copy(card.current.rotation());
      card.current.setAngvel({ x: ang.x, y: ang.y - rot.y * 0.25, z: ang.z });
    }
  });

  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;

  return (
    <>
      <group position={[0, 4, 0]}>
        <RigidBody ref={fixed} {...segmentProps} type={'fixed' as RigidBodyProps['type']} />
        <RigidBody position={[0.5, 0, 0]} ref={j1} {...segmentProps} type={'dynamic' as RigidBodyProps['type']}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody position={[1, 0, 0]} ref={j2} {...segmentProps} type={'dynamic' as RigidBodyProps['type']}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody position={[1.5, 0, 0]} ref={j3} {...segmentProps} type={'dynamic' as RigidBodyProps['type']}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody
          position={[2, 0, 0]}
          ref={card}
          {...segmentProps}
          type={dragged ? ('kinematicPosition' as RigidBodyProps['type']) : ('dynamic' as RigidBodyProps['type'])}
        >
          <CuboidCollider args={[0.8, 1.125, 0.01]} />
          <group
            scale={2.25}
            position={[0, -1.2, 0.1]}
            renderOrder={1}
            onPointerOver={() => hover(true)}
            onPointerOut={() => hover(false)}
            onPointerUp={(e: any) => {
              e.target.releasePointerCapture(e.pointerId);
              drag(false);
            }}
            onPointerDown={(e: any) => {
              e.target.setPointerCapture(e.pointerId);
              drag(new THREE.Vector3().copy(e.point).sub(vec.copy(card.current.translation())));
            }}
          >
            {/* Border */}
            <mesh geometry={borderGeometry} position={[0, 0, -0.001]}>
              <meshStandardMaterial
                color={0xFF69B4}
                roughness={0.5}
                metalness={0}
              />
            </mesh>
            {/* Card */}
            <mesh geometry={cardGeometry}>
              <meshPhysicalMaterial
                color={0xFFFFFF}
                clearcoat={isMobile ? 0 : 1}
                clearcoatRoughness={0.15}
                roughness={0.3}
                metalness={0}
              />
            </mesh>
            
            {/* Text Content */}
            <Text
              position={[0, 0.4, 0.006]}
              fontSize={0.1}
              color="#333333"
              anchorX="center"
              anchorY="middle"
              font="/font/Hakgyoansim Dunggeunmiso TTF B.ttf"
            >
              출입증
            </Text>
            
            {/* Divider Line */}
            <mesh position={[0, 0.26, 0.006]}>
              <boxGeometry args={[0.8, 0.02, 0.001]} />
              <meshStandardMaterial 
                color={0xFF69B4}
                roughness={0.5}
                metalness={0}
              />
            </mesh>
            
            {/* Name */}
            <Text
              position={[-0.3, 0.15, 0.006]}
              fontSize={0.06}
              color="#333333"
              anchorX="left"
              anchorY="middle"
              font="/font/Hakgyoansim Dunggeunmiso TTF B.ttf"
            >
              {`이름: ${weddingData.name || '미정'}`}
            </Text>
            
            {/* Budget */}
            <Text
              position={[-0.3, 0.0, 0.006]}
              fontSize={0.06}
              color="#333333"
              anchorX="left"
              anchorY="middle"
              font="/font/Hakgyoansim Dunggeunmiso TTF B.ttf"
            >
              {`예산: ${weddingData.budget || '0'}만원`}
            </Text>
            
            {/* Date */}
            <Text
              position={[-0.3, -0.15, 0.006]}
              fontSize={0.06}
              color="#333333"
              anchorX="left"
              anchorY="middle"
              font="/font/Hakgyoansim Dunggeunmiso TTF B.ttf"
            >
              {`날짜: ${weddingData.date ? `${weddingData.date.year}.${weddingData.date.month}.${weddingData.date.day}` : '미정'}`}
            </Text>
            
            {/* Watermark */}
            <Text
              position={[0.35, -0.5, 0.006]}
              fontSize={0.03}
              color="#AAAAAA"
              anchorX="right"
              anchorY="bottom"
              font="/font/Hakgyoansim Dunggeunmiso TTF B.ttf"
            >
              우리 플랜트
            </Text>
          </group>
        </RigidBody>
      </group>
<mesh ref={band} position={[0, 0, -0.2]} renderOrder={0}>
        {/* @ts-expect-error - meshLineGeometry is extended via extend() */}
        <meshLineGeometry />
        {/* @ts-expect-error - meshLineMaterial is extended via extend() */}
        <meshLineMaterial
          color="#FFAAB8"
          depthTest={true}
          depthWrite={true}
          resolution={new THREE.Vector2(isMobile ? 1000 : 1000, isMobile ? 2000 : 1000)}
          useMap={true}
          map={texture}
          lineWidth={1}
          transparent={true}
        />
      </mesh>
    </>
  );
}
