/**
 * Geolocation helpers for Syrian governorates.
 *
 * - Province lat/lng centroids (governorate centres).
 * - Nearest-province resolution from raw GPS coordinates.
 * - Linear conversion between real lat/lng and the Syria SVG coordinate space
 *   (VIEW_BOX "-0.06 -0.06 7.5574 5.6276") used by the Fields map `geoPin`.
 */

export interface ProvinceGeo {
  id: string;
  nameAr: string;
  lat: number;
  lng: number;
}

// Governorate centres (capital / geographic centre).
export const PROVINCE_GEO: ProvinceGeo[] = [
  { id: "damascus",    nameAr: "دمشق",      lat: 33.51, lng: 36.29 },
  { id: "rif-dimashq", nameAr: "ريف دمشق", lat: 33.60, lng: 36.60 },
  { id: "aleppo",      nameAr: "حلب",       lat: 36.20, lng: 37.16 },
  { id: "homs",        nameAr: "حمص",       lat: 34.73, lng: 36.72 },
  { id: "hama",        nameAr: "حماة",      lat: 35.13, lng: 36.75 },
  { id: "latakia",     nameAr: "اللاذقية",  lat: 35.52, lng: 35.79 },
  { id: "tartus",      nameAr: "طرطوس",     lat: 34.89, lng: 35.89 },
  { id: "idlib",       nameAr: "إدلب",      lat: 35.93, lng: 36.63 },
  { id: "raqqa",       nameAr: "الرقة",     lat: 35.95, lng: 39.01 },
  { id: "deir-ez-zur", nameAr: "دير الزور", lat: 35.34, lng: 40.14 },
  { id: "hasakah",     nameAr: "الحسكة",    lat: 36.50, lng: 40.74 },
  { id: "suwayda",     nameAr: "السويداء",  lat: 32.71, lng: 36.57 },
  { id: "daraa",       nameAr: "درعا",      lat: 32.62, lng: 36.10 },
  { id: "quneitra",    nameAr: "القنيطرة",  lat: 33.13, lng: 35.82 },
];

/** Haversine-ish (planar is fine at this scale) nearest governorate to a GPS fix. */
export function nearestProvince(lat: number, lng: number): ProvinceGeo {
  let best = PROVINCE_GEO[0];
  let bestD = Infinity;
  for (const p of PROVINCE_GEO) {
    const dLat = (p.lat - lat) * 111;             // km per degree lat
    const dLng = (p.lng - lng) * 111 * Math.cos((lat * Math.PI) / 180);
    const d = dLat * dLat + dLng * dLng;
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}

/** Rough check that a coordinate falls within Syria's bounding box. */
export function isInSyria(lat: number, lng: number): boolean {
  return lat >= 32.0 && lat <= 37.4 && lng >= 35.5 && lng <= 42.5;
}

// ── lat/lng ↔ Syria SVG (geoPin) — linear fit calibrated from corner provinces
const X_A = 0.994, X_B = -34.86;   // x = X_A*lng + X_B
const Y_A = -0.949, Y_B = 35.70;   // y = Y_A*lat + Y_B
const VBW = 7.5574, VBH = 5.6276;

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

export function latLngToSvg(lat: number, lng: number): [number, number] {
  return [
    clamp(X_A * lng + X_B, 0.1, VBW - 0.1),
    clamp(Y_A * lat + Y_B, 0.1, VBH - 0.1),
  ];
}

export function svgToLatLng(x: number, y: number): { lat: number; lng: number } {
  return {
    lat: Math.round(((Y_B - y) / -Y_A) * 1000) / 1000,
    lng: Math.round(((x - X_B) / X_A) * 1000) / 1000,
  };
}
