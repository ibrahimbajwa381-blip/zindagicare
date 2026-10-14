"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Clock, LayoutGrid, List, PenLine, Search, UserRound, X } from "lucide-react";
import { cn } from "@zindagi/shared";
import { MedicalQaCategories, MEDICAL_QA_LIMITS, type MedicalQaCategory } from "@zindagi/validators";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/i18n/locale-provider";
import type { MedicalQuestionSummaryDto } from "../types";
import { categoryIcons } from "../lib/category-icons";
import { fetchQuestions } from "../lib/qa-api";
import { QuestionCard } from "./question-card";

type Filter = "all" | "unanswered" | "mine";
type Query = { filter: Filter; category: MedicalQaCategory | null; q: string };

const SEARCH_DEBOUNCE_MS = 350;
/** Specialities shown before "See all" expands the row into a wrapped grid. */
const COLLAPSED_CATEGORY_COUNT = 4;

const pill = (active: boolean) =>
  cn(
    "inline-flex shrink-0 items-center gap-2 rounded-full border-2 px-4 py-2 text-sm transition-colors",
    active
      ? "border-brand-dark bg-brand-muted font-bold text-brand-dark"
      : "border-slate-200 bg-white font-medium text-slate-700 hover:border-brand-light",
  );

const chip = (active: boolean) =>
  cn(
    "inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-sm transition-colors",
    active
      ? "border-transparent bg-gradient-to-r from-brand-dark to-brand font-bold text-white shadow-sm"
      : "border-slate-200 bg-white font-medium text-slate-800 hover:border-brand-light",
  );

export function QuestionList({
  initialItems,
  initialCursor,
  initialTotal,
}: {
  initialItems: MedicalQuestionSummaryDto[];
  initialCursor: string | null;
  initialTotal: number | null;
}) {
  const t = useTranslations().medicalQa;
  const { status } = useSession();
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [total, setTotal] = useState(initialTotal);
  const [query, setQuery] = useState<Query>({ filter: "all", category: null, q: "" });
  const [searchInput, setSearchInput] = useState("");
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const inflight = useRef<AbortController | null>(null);

  async function load(next: Query, append: boolean) {
    inflight.current?.abort();
    const controller = new AbortController();
    inflight.current = controller;
    setLoading(true);
    setError(false);
    try {
      const page = await fetchQuestions({
        filter: next.filter,
        category: next.category,
        q: next.q || null,
        cursor: append ? cursor : null,
        signal: controller.signal,
      });
      setItems((prev) => (append ? [...prev, ...page.items] : page.items));
      setCursor(page.nextCursor);
      if (page.total !== null) setTotal(page.total);
    } catch {
      if (!controller.signal.aborted) setError(true);
    } finally {
      if (inflight.current === controller) setLoading(false);
    }
  }

  function apply(patch: Partial<Query>) {
    const next = { ...query, ...patch };
    setQuery(next);
    void load(next, false);
  }

  // Debounced search; skips the initial render (server already sent page one).
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const q = searchInput.trim();
    if (q === query.q) return;
    const id = window.setTimeout(() => apply({ q }), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const tabs: Array<{ value: Filter; label: string; icon: typeof List }> = [
    { value: "all", label: t.filterAll, icon: List },
    { value: "mine", label: t.filterMine, icon: UserRound },
    { value: "unanswered", label: t.filterUnanswered, icon: Clock },
  ];

  const visibleCategories =
    showAllCategories || query.category
      ? MedicalQaCategories
      : MedicalQaCategories.slice(0, COLLAPSED_CATEGORY_COUNT);

  return (
    <div className="space-y-6">
      <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm focus-within:border-brand-light focus-within:ring-2 focus-within:ring-brand-light/30">
        <Search className="h-5 w-5 shrink-0 text-slate-500" aria-hidden />
        <span className="sr-only">{t.searchLabel}</span>
        <input
          type="search"
          value={searchInput}
          maxLength={MEDICAL_QA_LIMITS.searchMax}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={t.searchPlaceholder}
          className="w-full min-w-0 bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400 [&::-webkit-search-cancel-button]:hidden"
        />
        {searchInput ? (
          <button
            type="button"
            onClick={() => setSearchInput("")}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label={t.clearSearch}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </label>

      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {tabs.map(({ value, label, icon: Icon }) =>
          value === "mine" && status !== "authenticated" ? (
            <Link key={value} href={`/login?callbackUrl=${encodeURIComponent("/questions")}`} className={pill(false)}>
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </Link>
          ) : (
            <button
              key={value}
              type="button"
              aria-pressed={query.filter === value}
              className={pill(query.filter === value)}
              onClick={() => apply({ filter: value })}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </button>
          ),
        )}
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">{t.specialities}</h2>
          <button
            type="button"
            className="text-sm font-bold text-brand-dark hover:underline"
            onClick={() => setShowAllCategories((v) => !v)}
            aria-expanded={showAllCategories}
          >
            {showAllCategories ? t.showLess : t.seeAll}
          </button>
        </div>
        <div
          className={cn(
            "flex gap-2.5",
            showAllCategories ? "flex-wrap" : "-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0",
          )}
        >
          <button
            type="button"
            aria-pressed={query.category === null}
            className={chip(query.category === null)}
            onClick={() => apply({ category: null })}
          >
            <LayoutGrid className="h-4 w-4" aria-hidden />
            {t.allCategories}
          </button>
          {visibleCategories.map((c) => {
            const Icon = categoryIcons[c];
            const active = query.category === c;
            return (
              <button
                key={c}
                type="button"
                aria-pressed={active}
                className={chip(active)}
                onClick={() => apply({ category: c })}
              >
                <Icon className={cn("h-4 w-4", active ? "text-white" : "text-brand")} aria-hidden />
                {t.categories[c]}
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-slate-900">{t.recentDiscussions}</h2>
          {total !== null ? (
            <span className="rounded-full bg-brand-muted px-3 py-1 text-sm font-semibold text-brand-dark">
              {total === 1 ? t.postOne : t.postsMany.replace("{count}", total.toLocaleString())}
            </span>
          ) : null}
        </div>

        {error ? (
          <p role="alert" className="text-sm font-medium text-red-600">
            {t.loadError}
          </p>
        ) : null}

        {items.length === 0 && !loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <p className="text-sm text-slate-600">{query.q ? t.noSearchResults : t.noQuestions}</p>
            <Button asChild className="mt-4">
              <Link href="/questions/ask">
                <PenLine className="h-4 w-4" aria-hidden />
                {t.askButton}
              </Link>
            </Button>
          </div>
        ) : (
          <div className={cn("grid gap-4 lg:grid-cols-2", loading && "opacity-60")} aria-busy={loading}>
            {items.map((q) => (
              <QuestionCard key={q.id} question={q} />
            ))}
          </div>
        )}

        {cursor ? (
          <div className="flex justify-center pt-2">
            <Button type="button" variant="outline" loading={loading} onClick={() => load(query, true)}>
              {t.loadMore}
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
