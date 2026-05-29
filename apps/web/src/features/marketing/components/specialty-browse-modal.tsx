"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { siteConfig } from "@/config/site";
import { Input } from "@/components/ui/input";
import { allSpecialties } from "../data/browse-catalog";
import { BrowseIconTile } from "./browse-icon-tile";
import { surfaceCard } from "@/lib/ui/surfaces";

type SpecialtyBrowseModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function SpecialtyBrowseModal({
  open,
  onOpenChange,
}: SpecialtyBrowseModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) dialog.showModal();
      document.body.style.overflow = "hidden";
    } else {
      if (dialog.open) dialog.close();
      document.body.style.overflow = "";
      setQuery("");
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allSpecialties;
    return allSpecialties.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.slug.replace(/-/g, " ").includes(q),
    );
  }, [query]);

  return (
    <dialog
      ref={dialogRef}
      className="specialty-browse-dialog fixed inset-0 z-50 m-0 h-full max-h-none w-full max-w-none border-0 bg-transparent p-0 backdrop:bg-slate-900/50"
      onClose={() => onOpenChange(false)}
      onClick={(e) => {
        if (e.target === dialogRef.current) onOpenChange(false);
      }}
    >
      <div className="flex h-full items-end justify-center p-0 sm:items-center sm:p-4">
        <div
          className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl shadow-premium-lg sm:max-h-[85vh] sm:max-w-3xl sm:rounded-3xl ${surfaceCard}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:px-6">
            <div>
              <h2 className="font-display text-xl font-semibold text-foreground sm:text-2xl">
                All specialties
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {allSpecialties.length} specialties · search to filter
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800 active:scale-95"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search specialty, e.g. Cardiologist"
                className="h-11 rounded-xl pl-10"
                autoFocus
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            {filtered.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-500">
                No specialties match &ldquo;{query}&rdquo;
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-x-2 gap-y-6 sm:grid-cols-4 md:grid-cols-5">
                {filtered.map((item) => (
                  <BrowseIconTile
                    key={item.slug}
                    item={item}
                    href={`${siteConfig.links.doctors}?specialty=${item.slug}`}
                    onNavigate={() => onOpenChange(false)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 px-5 py-4 sm:px-6">
            <Link
              href={siteConfig.links.doctors}
              className="block text-center text-sm font-medium text-brand hover:text-brand-dark hover:underline"
              onClick={() => onOpenChange(false)}
            >
              Browse all doctors in Lahore
            </Link>
          </div>
        </div>
      </div>
    </dialog>
  );
}
