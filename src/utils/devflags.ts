const IS_DEV: boolean = import.meta.env.DEV;

function params(): URLSearchParams {
  return new URLSearchParams(window.location.search);
}

export function isDebugMode(): boolean {
  return IS_DEV && params().has('debug');
}

export function devStartFloor(): number | null {
  if (!IS_DEV) return null;
  const raw = params().get('depth');
  if (raw === null) return null;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? value : null;
}
