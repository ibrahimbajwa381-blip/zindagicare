"use client";

import { useState } from "react";
import { Play } from "lucide-react";

type Props = {
  videoId: string;
  title: string;
};

/**
 * Click-to-play YouTube embed. Shows only a thumbnail until the visitor presses play, so no
 * YouTube scripts or cookies load on page view; playback uses the privacy-enhanced domain.
 */
export function DoctorIntroVideo({ videoId, title }: Props) {
  const [playing, setPlaying] = useState(false);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-slate-900">
      {playing ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 h-full w-full border-0"
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="group absolute inset-0 flex h-full w-full items-center justify-center"
          aria-label={`Play video: ${title}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover opacity-90 transition group-hover:opacity-100"
          />
          <span className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent" />
          <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-white/95 text-brand shadow-lg transition group-hover:scale-105">
            <Play className="ml-1 h-7 w-7 fill-current" />
          </span>
        </button>
      )}
    </div>
  );
}
