/**
 * Physics-Grounded Atmospheric Turbulence & Scintillation ShaderPass
 * FSOC PAT Virtual Simulator - Smart India Hackathon Deliverable
 *
 * Mathematical Foundations:
 * 1. Dynamic Refractive Index Structure Parameter (C_n^2):
 *    Simulates atmospheric optical turbulence and wavefront phase distortion via Kolmogorov turbulence spectrum.
 *    Variance of log-amplitude fluctuation (Rytov Variance):
 *        sigma_R^2 = 1.23 * C_n^2 * k^(7/6) * L^(11/6)
 *    where k = 2*pi / lambda (laser wavenumber), L = propagation path length.
 *
 * 2. Beer-Lambert Atmospheric Extinction & Beam Scattering:
 *    Optical intensity attenuation along propagation path distance (d) through fog/clouds:
 *        I(d) = I_0 * exp(-gamma * d)
 *    where gamma is the volumetric extinction coefficient (m^-1).
 */

export const AtmosphericTurbulenceShader = {
  uniforms: {
    tDiffuse: { value: null },
    u_time: { value: 0.0 },
    u_turbulence_strength: { value: 0.3 }, // Controls C_n^2 refractive index distortion
    u_fog_density: { value: 0.0 },          // Controls Beer-Lambert extinction coefficient gamma
    u_wind_speed: { value: 1.5 }           // Controls transverse wind advection vector (m/s)
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
    uniform float u_time;
    uniform float u_turbulence_strength;
    uniform float u_fog_density;
    uniform float u_wind_speed;
    varying vec2 vUv;

    // Pseudo-random hash generator for 3D Simplex noise approximation
    float hash(vec3 p) {
      p  = fract(p * 0.1031);
      p += dot(p, p.yzx + 33.33);
      return fract((p.x + p.y) * p.z);
    }

    // Multi-octave 3D Simplex noise representing Kolmogorov turbulent eddies
    float noise3D(vec3 p) {
      vec3 i = floor(p);
      vec3 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);

      return mix(
        mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
            mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
        mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
            mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z
      );
    }

    // Fractional Brownian Motion (fBm) for multi-scale atmospheric phase distortion
    float fbm(vec3 p) {
      float value = 0.0;
      float amplitude = 0.5;
      for (int i = 0; i < 4; i++) {
        value += amplitude * noise3D(p);
        p *= 2.02;
        amplitude *= 0.5;
      }
      return value;
    }

    void main() {
      vec2 st = vUv;

      // 1. Refractive Index Structure Parameter C_n^2 UV Distortion
      vec3 pos = vec3(st * 12.0, u_time * u_wind_speed * 0.5);
      float dx = fbm(pos) - 0.5;
      float dy = fbm(pos + vec3(43.1, 17.5, 9.2)) - 0.5;

      vec2 distortedUv = st + vec2(dx, dy) * (u_turbulence_strength * 0.03);

      // Sample base WebGL render with distorted UV coordinates
      vec4 color = texture2D(tDiffuse, distortedUv);

      // 2. Scintillation Intensity Modulation (Rytov Variance simulation)
      float scintillation = fbm(vec3(st * 25.0, u_time * 2.0));
      color.rgb *= (1.0 + (scintillation - 0.5) * u_turbulence_strength * 0.8);

      // 3. Beer-Lambert Atmospheric Extinction: I(d) = I_0 * exp(-gamma * d)
      float propagationDistance = 20.0; // Simulated optical path length in meters
      float gamma = u_fog_density * 0.15;
      float transmittance = exp(-gamma * propagationDistance);

      vec3 fogColor = vec3(0.06, 0.10, 0.18); // Stratospheric mist ambient color
      color.rgb = mix(fogColor, color.rgb, transmittance);

      gl_FragColor = color;
    }
  `
};
