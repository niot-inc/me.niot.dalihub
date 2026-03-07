/**
 * Colour conversion utilities for DT8 colour control
 */

export interface RGB {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
}

export interface HSV {
  h: number; // 0-360
  s: number; // 0-1
  v: number; // 0-1
}

/**
 * Convert HSV to RGB
 * @param h - Hue (0-360)
 * @param s - Saturation (0-1)
 * @param v - Value/Brightness (0-1)
 * @returns RGB object with r, g, b values (0-255)
 */
export function hsvToRgb(h: number, s: number, v: number): RGB {
  let r = 0;
  let g = 0;
  let b = 0;

  const i = Math.floor(h / 60);
  const f = h / 60 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);

  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

/**
 * Convert RGB to HSV
 * @param r - Red (0-255)
 * @param g - Green (0-255)
 * @param b - Blue (0-255)
 * @returns HSV object with h (0-360), s (0-1), v (0-1)
 */
export function rgbToHsv(r: number, g: number, b: number): HSV {
  const r01 = r / 255;
  const g01 = g / 255;
  const b01 = b / 255;

  const max = Math.max(r01, g01, b01);
  const min = Math.min(r01, g01, b01);
  const d = max - min;

  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (d !== 0) {
    switch (max) {
      case r01:
        h = ((g01 - b01) / d + (g01 < b01 ? 6 : 0)) * 60;
        break;
      case g01:
        h = ((b01 - r01) / d + 2) * 60;
        break;
      case b01:
        h = ((r01 - g01) / d + 4) * 60;
        break;
    }
  }

  return { h, s, v };
}

/**
 * Convert Homey's light_hue (0-1) and light_saturation (0-1) to RGB
 * Uses maximum brightness (V=1) since brightness is controlled separately via dim
 */
export function homeyHueSatToRgb(hue: number, saturation: number): RGB {
  const h = hue * 360;
  return hsvToRgb(h, saturation, 1);
}

/**
 * Convert RGB to Homey's light_hue (0-1) and light_saturation (0-1)
 */
export function rgbToHomeyHueSat(r: number, g: number, b: number): { hue: number; saturation: number } {
  const hsv = rgbToHsv(r, g, b);
  return {
    hue: hsv.h / 360,
    saturation: hsv.s,
  };
}

/**
 * Scale RGB values from 0-255 to DALI 0-254 range
 */
export function rgbToDaliPrimary(r: number, g: number, b: number): { r: number; g: number; b: number } {
  return {
    r: Math.round((r / 255) * 254),
    g: Math.round((g / 255) * 254),
    b: Math.round((b / 255) * 254),
  };
}

/**
 * Scale DALI primary values from 0-254 to RGB 0-255 range
 */
export function daliPrimaryToRgb(r: number, g: number, b: number): RGB {
  return {
    r: Math.round((r / 254) * 255),
    g: Math.round((g / 254) * 255),
    b: Math.round((b / 254) * 255),
  };
}

/**
 * Convert colour temperature in Kelvin to Mirek
 * Mirek = 1,000,000 / Kelvin
 */
export function kelvinToMirek(kelvin: number): number {
  return Math.round(1000000 / kelvin);
}

/**
 * Convert colour temperature in Mirek to Kelvin
 * Kelvin = 1,000,000 / Mirek
 */
export function mirekToKelvin(mirek: number): number {
  return Math.round(1000000 / mirek);
}
