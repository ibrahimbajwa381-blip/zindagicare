/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { defaultCache } from "@serwist/turbopack/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkOnly, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/** Stale HTML/RSC caches break App Router navigations after deploys. */
const VOLATILE_PAGE_CACHES = new Set([
  "others",
  "pages",
  "pages-rsc",
  "pages-rsc-prefetch",
]);

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Full document loads must always hit the network.
    {
      matcher: ({ request }) => request.mode === "navigate",
      handler: new NetworkOnly(),
    },
    // Soft navigations use RSC payloads — never serve a stale flight stream.
    {
      matcher: ({ request, sameOrigin }) =>
        sameOrigin && request.headers.get("RSC") === "1",
      handler: new NetworkOnly(),
    },
    {
      matcher: ({ url }) => url.pathname.startsWith("/api/"),
      handler: new NetworkOnly(),
    },
    // Keep assets from defaultCache; drop HTML/RSC/catch-all page caching.
    ...defaultCache.filter((entry) => {
      const cacheName =
        entry &&
        typeof entry === "object" &&
        "handler" in entry &&
        entry.handler &&
        typeof entry.handler === "object" &&
        "cacheName" in entry.handler
          ? String((entry.handler as { cacheName?: string }).cacheName ?? "")
          : "";
      return !VOLATILE_PAGE_CACHES.has(cacheName);
    }),
  ],
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => VOLATILE_PAGE_CACHES.has(name))
          .map((name) => caches.delete(name)),
      );
    })(),
  );
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload: { title?: string; body?: string; url?: string; tag?: string };
  try {
    payload = event.data.json() as typeof payload;
  } catch {
    payload = { title: "ZindagiCare", body: event.data.text() };
  }

  const title = payload.title ?? "ZindagiCare";
  const options: NotificationOptions = {
    body: payload.body ?? "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: payload.url ?? "/dashboard" },
    tag: payload.tag,
    requireInteraction: Boolean(payload.tag?.startsWith("urgent-")),
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl =
    (event.notification.data as { url?: string } | undefined)?.url ?? "/dashboard";

  event.waitUntil(
    (async () => {
      const windowClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of windowClients) {
        if ("focus" in client && client.url.includes(self.location.origin)) {
          await client.focus();
          if ("navigate" in client && typeof client.navigate === "function") {
            await client.navigate(targetUrl);
          }
          return;
        }
      }

      await self.clients.openWindow(targetUrl);
    })(),
  );
});
