// Service worker mínimo: só habilita a instalação como app. Não guarda nada em cache
// (as atualizações do site chegam sempre direto da rede).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
