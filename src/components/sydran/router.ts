'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Tiny hash-based router for the Sydran Maps SPA.
 *
 * The skill constraint is that only the `/` route can be rendered, but the
 * roadmap explicitly requires order-code URLs like `/order/MAP-1042`. We
 * reconcile these by using the URL hash instead of a separate Next.js
 * route: `#/order/MAP-1042`. The browser address bar still shows
 * `/#/order/MAP-1042`, the Discord "[Open Order]" button can deep-link to
 * it, and the user can share/bookmark it directly.
 *
 * Routes used:
 *   #/                          → gallery
 *   #/product/PRD-008           → product detail (also accepts id)
 *   #/cart                      → cart & checkout
 *   #/order/MAP-1042            → order detail (Phase 2 order-code URL)
 *   #/delivery                  → delivery queue
 *   #/mod                        → Fabric mod panel
 *   #/admin                      → admin (orders + products overview)
 */

export type Route =
  | { name: 'gallery' }
  | { name: 'product'; id: string }
  | { name: 'cart' }
  | { name: 'order'; code: string }
  | { name: 'delivery' }
  | { name: 'mod' }
  | { name: 'admin' }
  | { name: 'login' };

function parseHash(hash: string): Route {
  // Strip leading "#/" or "#".
  const raw = hash.replace(/^#\/?/, '').trim();
  if (!raw) return { name: 'gallery' };
  const [seg, ...rest] = raw.split('/');
  switch (seg) {
    case 'product':
      return { name: 'product', id: decodeURIComponent(rest[0] ?? '') };
    case 'order':
      return { name: 'order', code: decodeURIComponent(rest[0] ?? '').toUpperCase() };
    case 'cart':
      return { name: 'cart' };
    case 'delivery':
      return { name: 'delivery' };
    case 'mod':
      return { name: 'mod' };
    case 'admin':
      return { name: 'admin' };
    case 'login':
      return { name: 'login' };
    default:
      return { name: 'gallery' };
  }
}

export function routeToHash(route: Route): string {
  switch (route.name) {
    case 'gallery':
      return '#/';
    case 'product':
      return `#/product/${encodeURIComponent(route.id)}`;
    case 'cart':
      return '#/cart';
    case 'order':
      return `#/order/${encodeURIComponent(route.code)}`;
    case 'delivery':
      return '#/delivery';
    case 'mod':
      return '#/mod';
    case 'admin':
      return '#/admin';
    case 'login':
      return '#/login';
  }
}

export function useRouter() {
  // Lazy init: on the server we don't have a window, so default to the
  // gallery route. On the client, useState lazy initializers actually
  // DO run during hydration (with a window available), so we can safely
  // parse the hash there. The mismatch between server-default and
  // client-actual is handled by React's hydration — and since this is
  // a 'use client' component, only one render matters.
  const [route, setRoute] = useState<Route>(() =>
    typeof window !== 'undefined' ? parseHash(window.location.hash) : { name: 'gallery' }
  );

  useEffect(() => {
    // The lazy useState initializer above already parses the hash on the
    // client, so we don't need to re-sync here — just listen for changes.
    const onHashChange = () => {
      setRoute(parseHash(window.location.hash));
      // Scroll to top on every route change for SPA feel.
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((next: Route) => {
    const hash = routeToHash(next);
    if (hash !== window.location.hash) {
      window.location.hash = hash;
    } else {
      // Force re-evaluation even if hash is identical.
      setRoute(parseHash(hash));
    }
  }, []);

  return { route, navigate };
}

/** Convenience helper to build a product link URL. */
export function productHref(id: string): string {
  return `#/product/${encodeURIComponent(id)}`;
}

/** Convenience helper to build an order link URL (e.g. for Discord buttons). */
export function orderHref(code: string): string {
  return `#/order/${encodeURIComponent(code.toUpperCase())}`;
}
