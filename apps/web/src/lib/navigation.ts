/**
 * Auth/session değişikliklerinden sonra Next istemci önbelleğini taşımamak için
 * aynı origin içinde kasıtlı bir tam sayfa geçişi yapar.
 */
export function hardNavigateInternal(destination: string) {
  const target = new URL(destination, window.location.origin);

  if (target.origin !== window.location.origin) {
    window.location.assign(new URL("/", window.location.origin));
    return;
  }

  window.location.assign(target);
}
