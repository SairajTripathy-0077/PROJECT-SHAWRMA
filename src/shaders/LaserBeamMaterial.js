import * as THREE from 'three';

/**
 * Volumetric Mie-Scattering Laser Beam Shader Material
 * FSOC PAT Virtual Simulator - Smart India Hackathon Deliverable
 */
export const LaserBeamMaterial = new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0.0 },
    uBeamColor: { value: new THREE.Color("#00ffcc") },
    uExtinctionGamma: { value: 0.05 },
    uIsLocked: { value: 1.0 }
  },
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    void main() {
      vUv = uv;
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPos.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uBeamColor;
    uniform float uExtinctionGamma;
    uniform float uIsLocked;
    varying vec2 vUv;
    varying vec3 vWorldPosition;

    // Mie Scattering Phase Function Approximation (Henyey-Greenstein)
    float henyeyGreenstein(float cosTheta, float g) {
      float g2 = g * g;
      return (1.0 - g2) / (4.0 * 3.14159 * pow(1.0 + g2 - 2.0 * g * cosTheta, 1.5));
    }

    void main() {
      if (uIsLocked < 0.5) {
        discard;
      }

      // Center beam intensity gradient
      float centerDist = abs(vUv.x - 0.5) * 2.0;
      float coreIntensity = exp(-centerDist * centerDist * 8.0);

      // High-frequency optical pulse oscillation (1.5 GHz modulated simulation)
      float pulse = sin(vUv.y * 50.0 - uTime * 15.0) * 0.15 + 0.85;

      // Mie Atmospheric Extinction Attenuation along ray length
      float attenuation = exp(-uExtinctionGamma * vUv.y * 10.0);

      // Core Laser + Mie Scattering Glow Halo
      vec3 finalColor = uBeamColor * (coreIntensity * 2.5 + 0.2) * pulse * attenuation;
      float alpha = (coreIntensity * 0.85 + 0.15) * attenuation;

      gl_FragColor = vec4(finalColor, alpha);
    }
  `,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  side: THREE.DoubleSide
});
