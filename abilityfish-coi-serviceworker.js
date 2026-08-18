/* Cross-origin isolation shim for the threaded AbilityFish WASM analysis engine.
 * Kept dependency-free so the static site can host it directly.
 */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

function isolated(response) {
  if (!response || response.status === 0) return response;
  const headers = new Headers(response.headers);
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  // credentialless permits ordinary cross-origin no-CORS assets while still
  // enabling SharedArrayBuffer / WebAssembly threads in supporting browsers.
  headers.set('Cross-Origin-Embedder-Policy', 'credentialless');
  headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.cache === 'only-if-cached' && request.mode !== 'same-origin') return;
  event.respondWith((async () => {
    try {
      // Avoid sending ambient credentials on opaque cross-origin subresources;
      // this mirrors COEP credentialless semantics.
      const req = request.mode === 'no-cors' && new URL(request.url).origin !== self.location.origin
        ? new Request(request, { credentials: 'omit' })
        : request;
      return isolated(await fetch(req));
    } catch (error) {
      return fetch(request);
    }
  })());
});
