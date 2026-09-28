import * as THREE from 'three';

/**
 * SWIR / Thermal False-Color Post-Processing Shader (Ironbow & White-Hot Palettes)
 * FSOC PAT Virtual Simulator - Smart India Hackathon Deliverable
 */
export const ThermalShader = {
  uniforms: {
    tDiffuse: { value: null },
    uMode: { value: 0 }, // 0: VIS (RGB), 1: SWIR (Ironbow Thermal), 2: White-Hot Thermal
    uIntensity: { value: 1.0 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform int uMode;
    uniform float uIntensity;
    varying vec2 vUv;

    // Ironbow Thermal False-Color Mapping Function
    vec3 ironbow(float t) {
      t = clamp(t, 0.0, 1.0);
      vec3 c;
      c.r = clamp(4.0 * t - 1.5, 0.0, 1.0) + clamp(0.5 - 4.0 * (t - 0.75), 0.0, 1.0);
      c.g = clamp(4.0 * t - 0.5, 0.0, 1.0) * clamp(2.5 - 4.0 * t, 0.0, 1.0);
      c.b = clamp(1.5 - 4.0 * t, 0.0, 1.0);
      return c;
    }

    void main() {
      vec4 baseColor = texture2D(tDiffuse, vUv);

      if (uMode == 0) {
        // Mode 0: VIS Photorealistic RGB
        gl_FragColor = baseColor;
      } else if (uMode == 1) {
        // Mode 1: SWIR Ironbow Thermal False-Color
        float luminance = dot(baseColor.rgb, vec3(0.299, 0.587, 0.114));
        vec3 thermalColor = ironbow(luminance * uIntensity);
        gl_FragColor = vec4(thermalColor, baseColor.a);
      } else {
        // Mode 2: White-Hot Monochromatic Infrared Thermal
        float luminance = dot(baseColor.rgb, vec3(0.299, 0.587, 0.114));
        vec3 whiteHot = vec3(pow(luminance, 0.8));
        gl_FragColor = vec4(whiteHot, baseColor.a);
      }
    }
  `
};
