import { Environment } from '@react-three/drei';

/**
 * Lighting setup for the 3D scene
 */
export function SceneLights() {
  return (
    <>
      <ambientLight intensity={0.4} />
      
      {/* Key Light */}
      <directionalLight 
        position={[10, 10, 10]} 
        intensity={1.5} 
        color="#ffffff"
        castShadow={false}
      />
      
      {/* Fill Light */}
      <directionalLight 
        position={[-10, 5, 10]} 
        intensity={0.8} 
        color="#ffffff"
      />
      
      {/* Back Light */}
      <directionalLight 
        position={[0, 5, -10]} 
        intensity={0.6} 
        color="#ffffff"
      />
    </>
  );
}
