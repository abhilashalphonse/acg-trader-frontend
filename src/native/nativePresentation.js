import { isAndroidNativeRuntime } from './androidRuntime.js';

// The build-time preview switch only exists in isolated review environments.
// Production web and desktop users cannot opt into native screens via URL.
export function useNativeEntryScreens(runtime = globalThis, env = import.meta.env) {
  return isAndroidNativeRuntime(runtime) ||
    String(env?.VITE_ACG_NATIVE_UI_PREVIEW || '').toLowerCase() === 'true';
}
