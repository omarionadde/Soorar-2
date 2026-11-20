/**
 * Admin-only PWA wiring. Imported only from the lazily-loaded AdminErpApp chunk,
 * so the public website never gets a manifest, service worker or install prompt.
 */
type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

const TAG_ATTR = 'data-soorar-admin-pwa';
let deferredPrompt: BIPEvent | null = null;
let listenersAttached = false;
const subscribers = new Set<() => void>();
const notify = () => subscribers.forEach((fn) => fn());

function addTag(tag: string, attrs: Record<string, string>) {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  el.setAttribute(TAG_ATTR, '1');
  document.head.appendChild(el);
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: window-controls-overlay)').matches ||
    (navigator as any).standalone === true
  );
}

export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && (navigator as any).maxTouchPoints > 1);
}

export function canPromptInstall(): boolean {
  return !!deferredPrompt;
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const p = deferredPrompt;
  if (!p) return 'unavailable';
  deferredPrompt = null;
  notify();
  await p.prompt();
  const choice = await p.userChoice.catch(() => ({ outcome: 'dismissed' as const }));
  return choice.outcome;
}

export function subscribePwa(fn: () => void): () => void {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

/** Add manifest / theme-color / Apple tags and register the /admin-scoped SW. Returns a cleanup. */
export function enableAdminPwa(): () => void {
  if (typeof window === 'undefined') return () => {};

  if (!listenersAttached) {
    listenersAttached = true;
    window.addEventListener('beforeinstallprompt', (e) => {
      if (!window.location.pathname.startsWith('/admin')) return;
      e.preventDefault();
      deferredPrompt = e as BIPEvent;
      notify();
    });
    window.addEventListener('appinstalled', () => {
      deferredPrompt = null;
      notify();
    });
  }

  if (!document.querySelector(`[${TAG_ATTR}]`)) {
    addTag('link', { rel: 'manifest', href: '/admin.webmanifest' });
    addTag('meta', { name: 'theme-color', content: '#0151B9' });
    addTag('link', { rel: 'apple-touch-icon', href: '/admin-icons/apple-touch-icon.png', sizes: '180x180' });
    addTag('meta', { name: 'apple-mobile-web-app-capable', content: 'yes' });
    addTag('meta', { name: 'mobile-web-app-capable', content: 'yes' });
    addTag('meta', { name: 'apple-mobile-web-app-title', content: 'SOORAR' });
    addTag('meta', { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' });
  }

  if ('serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker.register('/admin-sw.js', { scope: '/admin' }).catch((err) => {
      console.warn('[SOORAR Admin] service worker registration failed', err);
    });
  }

  return () => {
    // Leaving the admin area inside the same tab: drop the admin-only tags again.
    document.querySelectorAll(`[${TAG_ATTR}]`).forEach((el) => el.remove());
  };
}
