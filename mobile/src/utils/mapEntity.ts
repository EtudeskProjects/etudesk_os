export interface MapPoint {
  lat: number;
  lng: number;
  title?: string;
  subtitle?: string;
}

function toFiniteNumber(value: unknown): number | null {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : null;
}

function sanitizeText(value: unknown, max = 120): string | undefined {
  if (value == null) return undefined;
  const text = String(value).replace(/\s+/g, ' ').trim();
  if (!text || text === 'null' || text === 'undefined' || text === '[object Object]') return undefined;
  return text.length > max ? `${text.slice(0, max).trimEnd()}...` : text;
}

function extractPoint(source: unknown): MapPoint | null {
  if (!source || typeof source !== 'object') return null;
  const raw = source as Record<string, any>;
  const lat = toFiniteNumber(raw.latitude ?? raw.lat ?? raw.coordinates?.latitude ?? raw.coordinates?.lat);
  const lng = toFiniteNumber(raw.longitude ?? raw.lng ?? raw.coordinates?.longitude ?? raw.coordinates?.lng);
  if (lat === null || lng === null) return null;

  return {
    lat,
    lng,
    title: sanitizeText(raw.title || raw.label || raw.name),
    subtitle: sanitizeText(raw.address || raw.location || raw.subtitle || raw.description),
  };
}

export function getMapPoints(raw: Record<string, any> | null | undefined): MapPoint[] {
  if (!raw || typeof raw !== 'object') return [];

  const collections = [raw.locations, raw.points, raw.markers, raw.results, raw.items]
    .filter(Array.isArray) as unknown[][];

  const points = collections
    .flat()
    .map(extractPoint)
    .filter((point): point is MapPoint => Boolean(point));

  if (points.length > 0) return points;

  const topLevelPoint = extractPoint(raw);
  return topLevelPoint ? [topLevelPoint] : [];
}

export function getPrimaryMapPoint(raw: Record<string, any> | null | undefined): MapPoint | null {
  return getMapPoints(raw)[0] || null;
}

export function hasMapEntityPayload(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const data = raw as Record<string, any>;
  if (getMapPoints(data).length > 0) return true;
  return Boolean(
    sanitizeText(data.url || data.mapUrl || data.address || data.location || data.title || data.name)
  );
}

export function buildExternalMapUrl(raw: Record<string, any>): string | null {
  const directUrl = sanitizeText(raw.mapUrl || raw.url, 512);
  if (directUrl) return directUrl;

  const firstPoint = getPrimaryMapPoint(raw);
  if (firstPoint) {
    return `https://www.google.com/maps/search/?api=1&query=${firstPoint.lat},${firstPoint.lng}`;
  }

  const query = [raw.address || raw.location || raw.title || raw.name, raw.city, raw.country]
    .map((value) => sanitizeText(value, 120))
    .filter(Boolean)
    .join(', ');

  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : null;
}

function buildMarkerOverlay(point: MapPoint, color: string): string {
  return `pin-s+${color}(${point.lng},${point.lat})`;
}

export function buildMapboxStaticMapUrl(params: {
  raw: Record<string, any>;
  token?: string | null;
  width?: number;
  height?: number;
  styleId?: string;
}): string | null {
  const { raw, token, width = 720, height = 360, styleId = 'mapbox/dark-v11' } = params;
  if (!token) return null;

  const points = getMapPoints(raw).slice(0, 6);
  if (points.length === 0) return null;

  const overlays = points
    .map((point, index) => buildMarkerOverlay(point, index === 0 ? '22c55e' : 'f3c15b'))
    .join(',');

  const baseUrl = `https://api.mapbox.com/styles/v1/${styleId}/static`;

  if (points.length === 1) {
    const point = points[0];
    return `${baseUrl}/${overlays}/${point.lng},${point.lat},14,0/${width}x${height}@2x?access_token=${token}`;
  }

  return `${baseUrl}/${overlays}/auto/${width}x${height}@2x?padding=48&access_token=${token}`;
}
