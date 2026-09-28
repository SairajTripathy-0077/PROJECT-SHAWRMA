/**
 * Aerospace-Grade FSOC Received Power, Link Margin, and BER Mathematical Engine
 * Smart India Hackathon FSOC PAT Virtual Simulator
 *
 * Mathematical Foundations:
 * 1. Geometric Path Loss (L_geo):
 *        L_geo = ( (pi * d_t * d_r) / (4 * lambda * R) )^2
 *    where d_t = transmitter aperture diameter (m), d_r = receiver aperture diameter (m),
 *          lambda = optical wavelength (m, e.g. 1550 nm), R = slant range distance (m).
 *
 * 2. Atmospheric Attenuation (L_atm):
 *    Based on Beer-Lambert law:
 *        L_atm = exp(-gamma * R)
 *    where gamma is volumetric extinction coefficient (m^-1).
 *
 * 3. Received Optical Power (P_rx):
 *        P_rx = P_tx * eta_tx * eta_rx * L_atm * L_geo
 *    where P_tx = transmit power (W), eta_tx / eta_rx = optical efficiency factors.
 *
 * 4. Link Margin (dB):
 *        Margin_dB = 10 * log10( P_rx / P_sensitivity )
 *
 * 5. Bit Error Rate (BER) Approximation:
 *        BER = 0.5 * erfc( Q / sqrt(2) )
 *    where Q factor is proportional to Signal-to-Noise Ratio (SNR).
 */

// Complementary Error Function Approximation erfc(x)
function erfc(x) {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * Math.exp(-absX * absX);

  return sign === 1 ? 1.0 - y : 1.0 + y;
}

export function computeFSOCLinkBudget({
  distanceMeters = 2000,         // Slant range distance R (m)
  transmitPowerWatts = 0.5,      // P_tx (W) -> e.g. 500 mW laser diode
  wavelengthMeters = 1550e-9,    // 1550 nm C-band optical wavelength
  txApertureDiameterM = 0.08,    // 80 mm transmitter optics
  rxApertureDiameterM = 0.15,    // 150 mm receiver telescope optics
  txEfficiency = 0.85,           // 85% transmitter optics efficiency
  rxEfficiency = 0.85,           // 85% receiver optics efficiency
  turbulenceCn2 = 1e-14,         // Atmospheric refractive index structure parameter
  fogDensity = 0.0,              // Cloud/fog density (0 to 100%)
  rxSensitivityWatts = 1e-6      // APD receiver sensitivity (-30 dBm -> 1 uW)
}) {
  const R = Math.max(distanceMeters, 10.0);
  const lambda = wavelengthMeters;
  const dt = txApertureDiameterM;
  const dr = rxApertureDiameterM;

  // 1. Geometric Path Loss L_geo
  const num = Math.PI * dt * dr;
  const den = 4.0 * lambda * R;
  const lGeoRatio = Math.pow(num / den, 2);
  const lGeodB = 10 * Math.log10(Math.max(lGeoRatio, 1e-15));

  // 2. Volumetric Atmospheric Extinction Gamma (Beer-Lambert)
  const gamma = 0.0001 + (fogDensity * 0.005) + (Math.pow(turbulenceCn2 / 1e-14, 0.5) * 0.0002);
  const lAtmRatio = Math.exp(-gamma * R);
  const lAtmdB = 10 * Math.log10(Math.max(lAtmRatio, 1e-15));

  // 3. Received Optical Power P_rx
  const pRxWatts = transmitPowerWatts * txEfficiency * rxEfficiency * lAtmRatio * lGeoRatio;
  const pRxdBm = 10 * Math.log10(Math.max(pRxWatts, 1e-12) * 1000.0);

  // 4. Link Margin (dB) relative to APD Receiver Sensitivity
  const sensitivitydBm = 10 * Math.log10(rxSensitivityWatts * 1000.0);
  const linkMargindB = pRxdBm - sensitivitydBm;

  // 5. SNR & Q-Factor Estimation for BER Calculation
  const snrRatio = Math.max(pRxWatts / rxSensitivityWatts, 0.1);
  const qFactor = Math.sqrt(snrRatio);
  const ber = Math.max(0.5 * erfc(qFactor / Math.sqrt(2)), 1e-12);

  return {
    distanceMeters: R,
    pRxWatts,
    pRxdBm: Math.round(pRxdBm * 10) / 10,
    lGeodB: Math.round(lGeodB * 10) / 10,
    lAtmdB: Math.round(lAtmdB * 10) / 10,
    linkMargindB: Math.round(linkMargindB * 10) / 10,
    berScientific: ber.toExponential(2),
    isLinkFeasible: linkMargindB > 3.0
  };
}
