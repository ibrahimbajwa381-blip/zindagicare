"use client";

import { useState, useSyncExternalStore } from "react";
import { BellRing, X } from "lucide-react";

const DOCTORS_COMMUNITY_URL =
  "https://chat.whatsapp.com/HUYhntv8Bmp5qTNdPAjfAq?s=cl&p=a&mlu=4&ilr=4";
const DISMISSED_KEY = "zc:doctor-community-banner-dismissed";

const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const readDismissed = () => {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    // Storage blocked (private mode): the banner simply shows again next visit.
    return false;
  }
};

/**
 * Red invite to the doctors' WhatsApp community; hidden for good once the doctor clicks through,
 * and hidden on this device once they close it.
 */
export function DoctorCommunityBanner() {
  const [joined, setJoined] = useState(false);
  const [closed, setClosed] = useState(false);
  const dismissed = useSyncExternalStore(subscribe, readDismissed, () => false);

  if (joined || closed || dismissed) return null;

  const dismiss = () => {
    setClosed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Storage blocked: dismissal lasts for this page view only.
    }
    listeners.forEach((listener) => listener());
  };

  const markJoined = () => {
    setJoined(true);
    void fetch("/api/v1/doctor/community", { method: "POST", keepalive: true }).catch(() => {});
  };

  return (
    <div className="relative mb-6 flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 py-3.5 pl-4 pr-10 text-red-800 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Close community invite"
        className="absolute right-2 top-2 rounded-lg p-1 text-red-500 transition-colors hover:bg-red-100 hover:text-red-700"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex min-w-0 items-start gap-3">
        <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
        <div className="min-w-0">
          <p className="text-sm font-semibold">Join the ZindagiCare Doctors’ Community</p>
          <p className="mt-0.5 text-sm">
            Stay updated on platform announcements, new features, and opportunities to grow your
            practice.
          </p>
        </div>
      </div>
      <a
        href={DOCTORS_COMMUNITY_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={markJoined}
        className="inline-flex shrink-0 items-center justify-center rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-700"
      >
        Join Doctors’ Community →
      </a>
    </div>
  );
}
