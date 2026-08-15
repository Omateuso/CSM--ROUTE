const CACHE_NAME = "route-csm-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      ),
  );
  self.clients.claim();
});

// Passthrough por enquanto — só existir um fetch handler já satisfaz o
// critério de instalabilidade do Chrome. Estratégia de cache offline real
// fica pra Fase 3, quando o perfil técnico precisar funcionar sem conexão
// em campo.
self.addEventListener("fetch", () => {});
