export type PreloadedData = Record<string, unknown> | undefined;

declare global {
  interface Window {
    __NOET_PRELOADED__?: Record<string, unknown>;
  }
}

export function getPreloadedData<T = Record<string, unknown>>(): T | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.__NOET_PRELOADED__ as T | undefined;
}

export function clearPreloadedData() {
  if (typeof window === 'undefined') return;
  delete window.__NOET_PRELOADED__;
}
