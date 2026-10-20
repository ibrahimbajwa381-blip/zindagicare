"use client";

import { useState } from "react";
import { BellRing } from "lucide-react";

const DOCTORS_COMMUNITY_URL =
  "https://chat.whatsapp.com/HUYhntv8Bmp5qTNdPAjfAq?s=cl&p=a&mlu=4&ilr=4";

/** Red invite to the doctors' WhatsApp community; hidden for good once the doctor clicks through. */
export function DoctorCommunityBanner() {
  const [joined, setJoined] = useState(false);
  if (joined) return null;

  const markJoined = () => {
    setJoined(true);
    void fetch("/api/v1/doctor/community", { method: "POST", keepalive: true }).catch(() => {});
  };

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5 text-red-800 shadow-sm sm:flex-row sm:items-center sm:justify-between">
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
