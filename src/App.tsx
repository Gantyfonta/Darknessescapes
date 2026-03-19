import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import * as THREE from 'three';

// --- Constants & Generators ---
const MAP_SIZE = 100;
const TREE_COUNT = 150;
const ORB_COUNT = 8;

const generateTrees = () => {
  const trees = [];
  let count = 0;
  while (count < TREE_COUNT) {
    const x = (Math.random() - 0.5) * MAP_SIZE;
    const z = (Math.random() - 0.5) * MAP_SIZE;
    // Keep trees away from spawn (0,0)
    if (Math.abs(x) < 5 && Math.abs(z) < 5) continue;
    trees.push(new THREE.Vector3(x, 0, z));
    count++;
  }
  return trees;
};

const generateOrbs = () => {
  const orbs = [];
  let count = 0;
  while (count < ORB_COUNT) {
    const x = (Math.random() - 0.5) * (MAP_SIZE - 10);
    const z = (Math.random() - 0.5) * (MAP_SIZE - 10);
    if (Math.abs(x) < 10 && Math.abs(z) < 10) continue;
    orbs.push({ id: count, position: new THREE.Vector3(x, 1, z), collected: false });
    count++;
  }
  return orbs;
};

// --- Components ---

function Player() {
  const { camera } = useThree();
  const keys = useRef({ w: false, a: false, s: false, d: false, shift: false });
  const velocity = useRef(new THREE.Vector3());
  const direction = useRef(new THREE.Vector3());
  const flashlightRef = useRef<THREE.SpotLight>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW': keys.current.w = true; break;
        case 'KeyA': keys.current.a = true; break;
        case 'KeyS': keys.current.s = true; break;
        case 'KeyD': keys.current.d = true; break;
        case 'ShiftLeft': keys.current.shift = true; break;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW': keys.current.w = false; break;
        case 'KeyA': keys.current.a = false; break;
        case 'KeyS': keys.current.s = false; break;
        case 'KeyD': keys.current.d = false; break;
        case 'ShiftLeft': keys.current.shift = false; break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useFrame((state, delta) => {
    // Movement
    const speed = keys.current.shift ? 8.0 : 4.0;
    
    velocity.current.x -= velocity.current.x * 10.0 * delta;
    velocity.current.z -= velocity.current.z * 10.0 * delta;

    direction.current.z = Number(keys.current.w) - Number(keys.current.s);
    direction.current.x = Number(keys.current.d) - Number(keys.current.a);
    direction.current.normalize();

    if (keys.current.w || keys.current.s) velocity.current.z -= direction.current.z * speed * delta;
    if (keys.current.a || keys.current.d) velocity.current.x -= direction.current.x * speed * delta;

    camera.translateX(velocity.current.x * delta);
    camera.translateZ(velocity.current.z * delta);
    
    // Keep player in bounds
    camera.position.x = Math.max(-MAP_SIZE/2, Math.min(MAP_SIZE/2, camera.position.x));
    camera.position.z = Math.max(-MAP_SIZE/2, Math.min(MAP_SIZE/2, camera.position.z));
    camera.position.y = 1.6; // Eye level

    // Update flashlight
    if (flashlightRef.current) {
      flashlightRef.current.position.copy(camera.position);
      
      const offset = new THREE.Vector3(0.2, -0.2, 0);
      offset.applyQuaternion(camera.quaternion);
      flashlightRef.current.position.add(offset);
      
      const targetOffset = new THREE.Vector3(0, 0, -10);
      targetOffset.applyQuaternion(camera.quaternion);
      flashlightRef.current.target.position.copy(camera.position).add(targetOffset);
      flashlightRef.current.target.updateMatrixWorld();
    }
  });

  return (
    <>
      <PointerLockControls />
      <spotLight
        ref={flashlightRef}
        color="#ffffff"
        intensity={500}
        distance={40}
        angle={Math.PI / 5}
        penumbra={0.8}
        castShadow
      />
    </>
  );
}

function Monster({ score, onGameOver }: { score: number, onGameOver: () => void }) {
  const monsterRef = useRef<THREE.Group>(null);
  const { camera } = useThree();

  // Spawn monster far away initially
  useEffect(() => {
    if (monsterRef.current) {
      monsterRef.current.position.set(0, 0, -30);
    }
  }, []);

  useFrame((state, delta) => {
    if (!monsterRef.current) return;
    const monsterPos = monsterRef.current.position;
    const playerPos = camera.position;

    // Move towards player
    const dir = new THREE.Vector3().subVectors(playerPos, monsterPos);
    dir.y = 0;
    
    if (dir.lengthSq() > 0.001) {
      dir.normalize();
      // Speed increases as score increases
      const monsterSpeed = 1.8 + (score * 0.4);
      monsterPos.add(dir.multiplyScalar(monsterSpeed * delta));
      // Look at player
      monsterRef.current.lookAt(playerPos.x, monsterPos.y, playerPos.z);
    }

    // Check collision
    if (monsterPos.distanceTo(playerPos) < 1.5) {
      onGameOver();
    }
  });

  return (
    <group ref={monsterRef}>
      <mesh position={[0, 2, 0]} castShadow>
        <cylinderGeometry args={[0.5, 0.5, 4, 16]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.9} />
      </mesh>
      {/* Glowing eyes */}
      <mesh position={[-0.2, 3.5, 0.45]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshBasicMaterial color="#ff0000" />
      </mesh>
      <mesh position={[0.2, 3.5, 0.45]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshBasicMaterial color="#ff0000" />
      </mesh>
      <pointLight position={[0, 3.5, 0.5]} color="#ff0000" intensity={100} distance={10} />
    </group>
  );
}

function Environment() {
  const trees = useMemo(() => generateTrees(), []);

  return (
    <>
      <fogExp2 attach="fog" color="#020202" density={0.03} />
      <ambientLight intensity={0.5} color="#444466" />
      
      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[MAP_SIZE, MAP_SIZE]} />
        <meshStandardMaterial color="#111511" roughness={1} />
      </mesh>

      {/* Trees */}
      {trees.map((pos, i) => (
        <mesh key={i} position={[pos.x, 2.5, pos.z]} castShadow receiveShadow>
          <cylinderGeometry args={[0.3, 0.5, 5, 8]} />
          <meshStandardMaterial color="#1a1a1a" roughness={1} />
        </mesh>
      ))}

      {/* Boundary Walls */}
      <mesh position={[0, 5, -MAP_SIZE/2]} receiveShadow>
        <boxGeometry args={[MAP_SIZE, 10, 1]} />
        <meshStandardMaterial color="#050505" />
      </mesh>
      <mesh position={[0, 5, MAP_SIZE/2]} receiveShadow>
        <boxGeometry args={[MAP_SIZE, 10, 1]} />
        <meshStandardMaterial color="#050505" />
      </mesh>
      <mesh position={[-MAP_SIZE/2, 5, 0]} rotation={[0, Math.PI/2, 0]} receiveShadow>
        <boxGeometry args={[MAP_SIZE, 10, 1]} />
        <meshStandardMaterial color="#050505" />
      </mesh>
      <mesh position={[MAP_SIZE/2, 5, 0]} rotation={[0, Math.PI/2, 0]} receiveShadow>
        <boxGeometry args={[MAP_SIZE, 10, 1]} />
        <meshStandardMaterial color="#050505" />
      </mesh>
    </>
  );
}

function Collectibles({ onCollect }: { onCollect: () => void }) {
  const orbsRef = useRef(generateOrbs());
  const { camera } = useThree();
  const [collectedIds, setCollectedIds] = useState<Set<number>>(new Set());

  useFrame(() => {
    const playerPos = camera.position;
    let collectedSomething = false;

    orbsRef.current.forEach(orb => {
      if (!orb.collected && playerPos.distanceTo(orb.position) < 2.0) {
        orb.collected = true;
        collectedSomething = true;
        setCollectedIds(prev => new Set(prev).add(orb.id));
      }
    });

    if (collectedSomething) {
      onCollect();
    }
  });

  return (
    <>
      {orbsRef.current.map(orb => (
        !collectedIds.has(orb.id) && (
          <mesh key={orb.id} position={orb.position}>
            <sphereGeometry args={[0.2, 16, 16]} />
            <meshBasicMaterial color="#00ffcc" />
            <pointLight color="#00ffcc" intensity={100} distance={10} />
          </mesh>
        )
      ))}
    </>
  );
}

export default function App() {
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'gameover' | 'win'>('menu');
  const [score, setScore] = useState(0);

  const startGame = () => {
    setScore(0);
    setGameState('playing');
  };

  const handleCollect = () => {
    setScore(prev => {
      const newScore = prev + 1;
      if (newScore >= ORB_COUNT) {
        setGameState('win');
        if (document.pointerLockElement) {
          document.exitPointerLock();
        }
      }
      return newScore;
    });
  };

  const handleGameOver = () => {
    setGameState('gameover');
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  };

  return (
    <div className="w-full h-screen bg-black text-white overflow-hidden relative font-sans">
      {/* UI Overlays */}
      {gameState === 'menu' && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/80">
          <h1 className="text-6xl font-bold text-red-600 mb-4 tracking-widest uppercase">Darkness Escapes</h1>
          <p className="text-gray-300 mb-8 max-w-md text-center">
            You are trapped in a dark forest. Collect all {ORB_COUNT} glowing orbs before the entity catches you.
            <br /><br />
            <strong>Controls:</strong> WASD to move, Mouse to look, Shift to sprint.
          </p>
          <button 
            onClick={startGame}
            className="px-8 py-3 bg-red-800 hover:bg-red-700 text-white font-bold rounded text-xl transition-colors cursor-pointer"
          >
            Enter the Forest
          </button>
        </div>
      )}

      {gameState === 'playing' && (
        <>
          <div className="absolute top-4 left-4 z-10 text-2xl font-mono text-teal-400 drop-shadow-md">
            Orbs: {score} / {ORB_COUNT}
          </div>
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 text-gray-300 text-sm bg-black/60 px-6 py-2 rounded-full pointer-events-none border border-white/10">
            Click anywhere on the game to lock mouse and look around
          </div>
          {/* Crosshair */}
          <div className="absolute top-1/2 left-1/2 w-2 h-2 bg-white/50 rounded-full -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none"></div>
        </>
      )}

      {gameState === 'gameover' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-red-950/90">
          <h1 className="text-7xl font-bold text-red-500 mb-4 animate-pulse">YOU DIED</h1>
          <p className="text-xl mb-8">Orbs collected: {score}</p>
          <button 
            onClick={startGame}
            className="px-8 py-3 bg-red-800 hover:bg-red-700 text-white font-bold rounded text-xl transition-colors cursor-pointer"
          >
            Try Again
          </button>
        </div>
      )}

      {gameState === 'win' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-teal-950/90">
          <h1 className="text-7xl font-bold text-teal-400 mb-4">YOU ESCAPED</h1>
          <p className="text-xl mb-8">You collected all {ORB_COUNT} orbs and survived the darkness.</p>
          <button 
            onClick={startGame}
            className="px-8 py-3 bg-teal-800 hover:bg-teal-700 text-white font-bold rounded text-xl transition-colors cursor-pointer"
          >
            Play Again
          </button>
        </div>
      )}

      {/* 3D Canvas */}
      {gameState !== 'menu' && (
        <Canvas shadows camera={{ fov: 75, position: [0, 1.6, 0] }}>
          <Environment />
          {gameState === 'playing' && (
            <>
              <Player />
              <Monster score={score} onGameOver={handleGameOver} />
              <Collectibles onCollect={handleCollect} />
            </>
          )}
        </Canvas>
      )}
    </div>
  );
}
