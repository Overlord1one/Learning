/** Platform integration for the installed (home-screen) app. */

/** True when running as an installed app (iOS home screen or desktop PWA). */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function registerPlatformServices() {
  if (typeof window === 'undefined') return;

  // Offline support (production builds only – the dev server must not be cached).
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {
        /* offline mode unavailable – the app still works online */
      });
    });
  }

  // Ask the browser not to evict local data under storage pressure.
  void navigator.storage?.persist?.().catch(() => undefined);
}

/**
 * Show a system notification. iOS only supports notifications for installed
 * apps and only through the service worker.
 */
export async function showNotification(title: string, body: string): Promise<void> {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const options = { body, icon: './icons/icon-192.png', badge: './icons/icon-192.png' };
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration) return await registration.showNotification(title, options);
    new Notification(title, options);
  } catch {
    /* not supported in this context */
  }
}

/** Save a file – uses the iOS share sheet ("In Dateien sichern") where available. */
export async function saveFile(blob: Blob, fileName: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([blob], fileName, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (isIOS() && nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileName });
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}
