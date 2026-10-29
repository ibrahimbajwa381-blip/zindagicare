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

  let payload: {
    title?: string;
    body?: string;
    url?: string;
    tag?: string;
    kind?: "call";
    appointmentId?: string;
    ringId?: string;
  };
  try {
    payload = event.data.json() as typeof payload;
  } catch {
    payload = { title: "ZindagiCare", body: event.data.text() };
  }

  if (payload.kind === "call") {
    event.waitUntil(showIncomingCall(payload));
    return;
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

/** Matches INCOMING_CALL_MESSAGE in features/consult/incoming-call.ts. */
const INCOMING_CALL_MESSAGE = "zindagi:incoming-call";

/**
 * Video-call ring. An open, visible app window shows its own full-screen
 * ringing screen (with ringtone), so it only gets a message; otherwise a
 * WhatsApp-style notification buzzes the phone. The caller re-sends the push
 * every few seconds and `renotify` makes each one alert again, which is what
 * keeps a closed PWA "ringing".
 */
async function showIncomingCall(payload: {
  title?: string;
  body?: string;
  url?: string;
  appointmentId?: string;
  ringId?: string;
}) {
  const windowClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const client of windowClients) {
    client.postMessage({ type: INCOMING_CALL_MESSAGE, appointmentId: payload.appointmentId });
  }
  if (windowClients.some((client) => client.visibilityState === "visible")) return;

  // vibrate/renotify/actions are not in TypeScript's NotificationOptions yet.
  const options: NotificationOptions & {
    vibrate: number[];
    renotify: boolean;
    actions: { action: string; title: string }[];
  } = {
    body: payload.body ?? "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: `call-${payload.appointmentId ?? "consult"}`,
    renotify: true,
    requireInteraction: true,
    vibrate: [800, 400, 800, 400, 800, 400, 800],
    actions: [
      { action: "join", title: "Join" },
      { action: "decline", title: "Decline" },
    ],
    data: {
      url: payload.url ?? "/dashboard",
      appointmentId: payload.appointmentId,
      ringId: payload.ringId,
    },
  };
  await self.registration.showNotification(payload.title ?? "Incoming video call", options);
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data as
    | { url?: string; appointmentId?: string; ringId?: string }
    | undefined;

  if (event.action === "decline" && data?.appointmentId && data.ringId) {
    event.waitUntil(
      fetch(`/api/v1/video/sessions/${data.appointmentId}/ring`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "decline", ringId: data.ringId }),
      }).then(
        () => undefined,
        () => undefined,
      ),
    );
    return;
  }

  const targetUrl = data?.url ?? "/dashboard";

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
