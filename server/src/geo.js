// Distance and direction helpers. Friends never get each other's exact
// coordinates: they get a rounded distance, a rounded bearing and a coarse area.

const R_MILES = 3958.8;
const M_PER_MILE = 1609.344;
const rad = (d) => (d * Math.PI) / 180;

export function distanceMiles(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Degrees clockwise from north, 0 to 359.
export function bearing(a, b) {
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function band(miles) {
  if (miles < 0.25) return 'Under ¼ mi';
  if (miles < 1) return 'Under 1 mi';
  if (miles < 3) return '1 to 3 mi';
  return '3+ mi';
}

const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
export const compassPoint = (deg) => DIRS[Math.round(deg / 45) % 8];

// The closer you are, the more precise the guidance gets. Far away you only
// learn a rough direction, which is what "general area, not a pin" means.
export function blur(miles, deg) {
  let dist, step;
  if (miles < 0.05) { dist = Math.round(miles * M_PER_MILE / 2) * 2 / M_PER_MILE; step = 5; }
  else if (miles < 0.25) { dist = Math.round(miles * M_PER_MILE / 10) * 10 / M_PER_MILE; step = 10; }
  else if (miles < 1) { dist = Math.round(miles * 10) / 10; step = 15; }
  else { dist = Math.round(miles); step = 45; }
  return { miles: Math.max(dist, 0.001), bearing: (Math.round(deg / step) * step) % 360 };
}

export const toMeters = (miles) => Math.round(miles * M_PER_MILE);

// Move a point toward another by a fraction (used by "walk closer" in tests and demos).
export function stepToward(from, to, fraction) {
  return { lat: from.lat + (to.lat - from.lat) * fraction, lng: from.lng + (to.lng - from.lng) * fraction };
}

// A point at a distance and bearing from an origin (used for demo places).
export function offset(origin, miles, deg) {
  const d = miles / R_MILES;
  const b = rad(deg);
  const lat1 = rad(origin.lat);
  const lng1 = rad(origin.lng);
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(b));
  const lng2 = lng1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
  return { lat: (lat2 * 180) / Math.PI, lng: (lng2 * 180) / Math.PI };
}
