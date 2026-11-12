export function isDevStart(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get('menu') === '1') return false;
  if (params.get('menu') === '0' || params.has('debug') || params.has('depth')) return true;
  const floor = params.get('floor');
  return floor !== null && Number.isFinite(Number.parseInt(floor, 10));
}
