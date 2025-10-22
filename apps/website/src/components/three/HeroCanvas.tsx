"use client";

import { Center, Text } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useRef } from "react";
import type { Mesh, PointLight } from "three";
import * as THREE from "three";

function LitBackground() {
    const meshRef = useRef<Mesh>(null);
    const lightRef = useRef<PointLight>(null);
    const textGroupRef = useRef<THREE.Group>(null);
    const { viewport, camera } = useThree();

    useFrame((state) => {
        if (lightRef.current) {
            // Convert normalized mouse coords to viewport coordinates
            const x = (state.mouse.x * viewport.width) / 2;
            const y = (state.mouse.y * viewport.height) / 2;
            // Position light slightly in front of the plane
            lightRef.current.position.set(x, y, 2);
        }

        // Make the text group face the camera
        if (textGroupRef.current) {
            textGroupRef.current.lookAt(camera.position);
        }

        // Make the plane always face the camera
        if (meshRef.current) {
            meshRef.current.lookAt(camera.position);

            // Animate the wavy displacement
            const geometry = meshRef.current.geometry;
            const positionAttribute = geometry.attributes.position;
            const time = state.clock.elapsedTime;

            if (!positionAttribute) {
                return;
            }

            for (let i = 0; i < positionAttribute.count; i++) {
                const x = positionAttribute.getX(i);
                const y = positionAttribute.getY(i);

                // Create wave effect using sine waves
                const wave1 = Math.sin(x * 0.5 + time * 0.5) * 0.1;
                const wave2 = Math.sin(y * 0.5 + time * 0.3) * 0.1;
                const z = wave1 + wave2;

                positionAttribute.setZ(i, z);
            }

            positionAttribute.needsUpdate = true;
            geometry.computeVertexNormals();
        }
    });

    return (
        <>
            {/* Background plane that fills the viewport and faces camera */}
            <mesh ref={meshRef} position={[0, 0, 0]}>
                <planeGeometry
                    args={[viewport.width * 1.5, viewport.height * 1.5, 50, 50]}
                />
                <meshStandardMaterial color="#1a1a1a" roughness={0.8} metalness={0.2} />
            </mesh>

            {/* 3D Text that reacts to light */}
            <group ref={textGroupRef} position={[0, 0.5, 1]}>
                {/* Create depth by layering multiple text instances */}
                {[...Array(10)].map((_, i) => (
                    <Text
                        key={i.toString()}
                        position={[0, 0, -i * 0.05]}
                        fontSize={1.5}
                        color="#0a0a0a"
                        anchorX="center"
                        anchorY="middle"
                    >
                        ⊇
                        <meshStandardMaterial
                            color="#333333"
                            metalness={1.0}
                            roughness={0.05}
                            emissive="#000000"
                            emissiveIntensity={0}
                        />
                    </Text>
                ))}
            </group>

            {/* Ambient light for base visibility */}
            <ambientLight intensity={0.5} />

            {/* Point light that follows mouse */}
            <pointLight
                ref={lightRef}
                intensity={8}
                color="#ff9999"
                distance={100}
                decay={0.3}
            />
        </>
    );
}

interface HeroCanvasProps {
    className?: string;
}

export function HeroCanvas({ className }: HeroCanvasProps) {
    return (
        <div className={className} style={{ pointerEvents: "auto" }}>
            <Canvas
                camera={{ position: [0, 0, 5], fov: 45 }}
                style={{ background: "#0a0a0a" }}
            >
                <Suspense fallback={null}>
                    <LitBackground />
                </Suspense>
            </Canvas>
        </div>
    );
}
