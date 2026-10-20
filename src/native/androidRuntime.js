// The Capacitor bridge is present only inside the installed native application.
// Keep web and federation routes unchanged when the bridge is absent.
export function isAndroidNativeRuntime(runtime = globalThis) {
  const bridge = runtime?.Capacitor;
  return bridge?.isNativePlatform?.() === true && bridge?.getPlatform?.() === 'android';
}
