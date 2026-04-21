/**
 * Lighting setup for the 3D scene.
 * Slightly reduced ambient + stronger key light for more depth on the model.
 */
export function SceneLights() {
  return (
    <>
      <ambientLight intensity={0.32} />
      <directionalLight
        position={[10, 10, 10]}
        intensity={1.7}
        color="#ffffff"
        castShadow={false}
      />
      <directionalLight
        position={[-10, 5, 10]}
        intensity={0.9}
        color="#ffffff"
      />
      <directionalLight
        position={[0, 5, -10]}
        intensity={0.7}
        color="#ffffff"
      />
    </>
  );
}
