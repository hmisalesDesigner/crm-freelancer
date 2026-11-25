// Service worker: habilita a instalação como app e acelera as visitas seguintes.
// Os arquivos do site são pedidos com "?v=VERSÃO" (muda a cada publicação e a cada clique em "Atualizar"),
// então ficam guardados em cache e só são baixados de novo quando a versão muda.
// O index.html (que traz a versão) e qualquer outro pedido continuam sempre vindo da rede.
const CACHE = "crm-arquivos";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin || !url.searchParams.has("v")) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const guardado = await cache.match(req);
    if (guardado) return guardado;
    const resposta = await fetch(req);
    if (resposta.ok) {
      cache.put(req, resposta.clone());
      // apaga arquivos de versões antigas
      const v = url.searchParams.get("v");
      (await cache.keys()).forEach((k) => { if (new URL(k.url).searchParams.get("v") !== v) cache.delete(k); });
    }
    return resposta;
  })());
});
