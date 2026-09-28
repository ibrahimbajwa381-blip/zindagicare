"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  Award,
  BadgeCheck,
  Briefcase,
  ExternalLink,
  GraduationCap,
  Pencil,
  Plus,
  Stethoscope,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import {
  PHYSIOTHERAPIST_PORTFOLIO_LIMITS as LIMITS,
  PHYSIOTHERAPY_CONDITION_SUGGESTIONS,
  PHYSIOTHERAPY_MEMBERSHIP_SUGGESTIONS,
  PHYSIOTHERAPY_TECHNIQUE_SUGGESTIONS,
} from "@zindagi/shared";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { TagInput } from "@/components/forms/tag-input";
import { useSafeRouter } from "@/lib/navigation/safe-router";
import {
  portfolioChecklist,
  portfolioCompleteness,
  type PhysiotherapistPortfolio,
  type PortfolioAward,
  type PortfolioSectionId,
} from "@/lib/physiotherapists/portfolio";
import type { UpdatePhysiotherapistPortfolioInput } from "@zindagi/validators";
import {
  draftRowsToItems,
  itemsToDraftRows,
  PortfolioListEditor,
  type DraftRow,
  type ListFieldDef,
} from "./portfolio-list-editor";
import { PortfolioChecklist, PortfolioProgressBar } from "./portfolio-progress";
import {
  PortfolioAwardList,
  PortfolioCertificationList,
  PortfolioEducationList,
  PortfolioExperienceTimeline,
  PortfolioTagList,
} from "./portfolio-views";

type PortfolioPatch = UpdatePhysiotherapistPortfolioInput;
/** Resolves to an error message, or undefined on success. */
type SaveFn = (patch: PortfolioPatch) => Promise<string | undefined>;

const LANGUAGE_SUGGESTIONS = [
  "English",
  "Urdu",
  "Punjabi",
  "Pashto",
  "Sindhi",
  "Saraiki",
  "Balochi",
  "Arabic",
];

const EXPERIENCE_FIELDS: ListFieldDef[] = [
  { key: "role", label: "Role", kind: "text", required: true, maxLength: 100, placeholder: "e.g. Senior Physiotherapist" },
  { key: "organization", label: "Hospital / clinic", kind: "text", required: true, maxLength: 160, placeholder: "e.g. Services Hospital" },
  { key: "city", label: "City", kind: "text", maxLength: 80, placeholder: "e.g. Lahore" },
  { key: "startYear", label: "Start year", kind: "year" },
  { key: "endYear", label: "End year", kind: "year", hidden: (row) => Boolean(row.current) },
  { key: "current", label: "I currently work here", kind: "checkbox", wide: true },
  {
    key: "description",
    label: "What you did",
    kind: "textarea",
    wide: true,
    maxLength: LIMITS.experienceDescription,
    placeholder: "Patients you treated, departments, results you're proud of…",
  },
];

const EDUCATION_FIELDS: ListFieldDef[] = [
  { key: "degree", label: "Degree", kind: "text", required: true, maxLength: 120, placeholder: "e.g. Doctor of Physical Therapy (DPT)" },
  { key: "institute", label: "Institute", kind: "text", required: true, maxLength: 160, placeholder: "e.g. University of Lahore" },
  { key: "year", label: "Graduation year", kind: "year" },
];

const CERTIFICATION_FIELDS: ListFieldDef[] = [
  { key: "title", label: "Certification / course", kind: "text", required: true, maxLength: 160, placeholder: "e.g. Certified Dry Needling Practitioner" },
  { key: "issuer", label: "Issued by", kind: "text", maxLength: 160, placeholder: "e.g. PPTA" },
  { key: "year", label: "Year", kind: "year" },
];

const AWARD_FIELDS: ListFieldDef[] = [
  { key: "title", label: "Award / achievement", kind: "text", required: true, maxLength: 160, wide: true, placeholder: "e.g. Best Clinical Performance Award" },
  { key: "year", label: "Year", kind: "year" },
];

type PhysiotherapistPortfolioEditorProps = {
  initialPortfolio: PhysiotherapistPortfolio;
  avatarUrl?: string;
  publicPath: string | null;
};

export function PhysiotherapistPortfolioEditor({
  initialPortfolio,
  avatarUrl,
  publicPath,
}: PhysiotherapistPortfolioEditorProps) {
  const { refresh } = useSafeRouter();
  const [portfolio, setPortfolio] = useState(initialPortfolio);
  const checklist = portfolioChecklist(portfolio, avatarUrl);
  const percent = portfolioCompleteness(checklist);

  const save: SaveFn = async (patch) => {
    try {
      const res = await fetch("/api/v1/physiotherapist/portfolio", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        return json?.error?.message ?? "Could not save. Please try again.";
      }
      setPortfolio(json.data as PhysiotherapistPortfolio);
      refresh();
      return undefined;
    } catch {
      return "Could not save. Check your connection and try again.";
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
      <aside className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm lg:sticky lg:top-24 lg:order-2">
        <PortfolioProgressBar percent={percent} />
        <PortfolioChecklist items={checklist} />
        <div className="border-t border-slate-100 pt-4">
          {publicPath ? (
            <Button asChild variant="outline" className="w-full">
              <Link href={publicPath} target="_blank">
                <ExternalLink className="h-4 w-4" />
                View public profile
              </Link>
            </Button>
          ) : (
            <p className="text-xs text-slate-500">
              Your portfolio goes live on your public profile once your application is approved.
              Build it now so it&apos;s ready on day one.
            </p>
          )}
          {portfolio.updatedAt && (
            <p className="mt-3 text-xs text-slate-400">
              Last updated{" "}
              {new Date(portfolio.updatedAt).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
          )}
        </div>
      </aside>

      <div className="space-y-6 lg:order-1">
        <PortfolioSection
          id="about"
          icon={UserRound}
          title="About you"
          description="Your headline and story — the first thing patients read."
          isEmpty={!portfolio.headline && !portfolio.bio}
          emptyText="Add a headline and a short introduction about your approach and experience."
          view={
            <div className="space-y-3">
              {portfolio.headline && (
                <p className="text-base font-semibold text-slate-900">{portfolio.headline}</p>
              )}
              {portfolio.bio && (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
                  {portfolio.bio}
                </p>
              )}
              {portfolio.languages.length > 0 && (
                <p className="text-sm text-slate-600">
                  <span className="font-medium text-slate-800">Languages:</span>{" "}
                  {portfolio.languages.join(", ")}
                </p>
              )}
            </div>
          }
          renderEditor={(done) => <AboutEditor portfolio={portfolio} onSave={save} onDone={done} />}
        />

        <PortfolioSection
          id="focus"
          icon={Stethoscope}
          title="Conditions & techniques"
          description="What you treat and how — patients search by their problem."
          isEmpty={!portfolio.conditionsTreated.length && !portfolio.techniques.length}
          emptyText="List the conditions you treat and the techniques you use."
          view={
            <div className="space-y-4">
              {portfolio.conditionsTreated.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Conditions treated
                  </p>
                  <PortfolioTagList tags={portfolio.conditionsTreated} />
                </div>
              )}
              {portfolio.techniques.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Techniques
                  </p>
                  <PortfolioTagList tags={portfolio.techniques} />
                </div>
              )}
            </div>
          }
          renderEditor={(done) => <FocusEditor portfolio={portfolio} onSave={save} onDone={done} />}
        />

        <PortfolioSection
          id="experience"
          icon={Briefcase}
          title="Work experience"
          description="Hospitals, clinics and teams you've worked with."
          isEmpty={!portfolio.experience.length}
          emptyText="Add the places you've practiced physiotherapy."
          view={<PortfolioExperienceTimeline items={portfolio.experience} />}
          renderEditor={(done) => (
            <ListSectionEditor
              patchKey="experience"
              items={portfolio.experience}
              fields={EXPERIENCE_FIELDS}
              itemLabel="Position"
              max={LIMITS.experience}
              emptyRow={{ role: "", organization: "", city: "", startYear: "", endYear: "", current: false, description: "" }}
              validate={(rows) =>
                rows.find(
                  (r) => !r.current && r.startYear && r.endYear && Number(r.endYear) < Number(r.startYear),
                )
                  ? "End year cannot be before start year."
                  : undefined
              }
              onSave={save}
              onDone={done}
            />
          )}
        />

        <PortfolioSection
          id="education"
          icon={GraduationCap}
          title="Education"
          description="Degrees and diplomas."
          isEmpty={!portfolio.education.length}
          emptyText="Add your physiotherapy degree and any post-graduate study."
          view={<PortfolioEducationList items={portfolio.education} />}
          renderEditor={(done) => (
            <ListSectionEditor
              patchKey="education"
              items={portfolio.education}
              fields={EDUCATION_FIELDS}
              itemLabel="Degree"
              max={LIMITS.education}
              emptyRow={{ degree: "", institute: "", year: "" }}
              onSave={save}
              onDone={done}
            />
          )}
        />

        <PortfolioSection
          id="certifications"
          icon={BadgeCheck}
          title="Certifications & training"
          description="Specialist courses and continuing education."
          isEmpty={!portfolio.certifications.length}
          emptyText="Add courses like dry needling, manual therapy, or kinesio taping."
          view={<PortfolioCertificationList items={portfolio.certifications} />}
          renderEditor={(done) => (
            <ListSectionEditor
              patchKey="certifications"
              items={portfolio.certifications}
              fields={CERTIFICATION_FIELDS}
              itemLabel="Certification"
              max={LIMITS.certifications}
              emptyRow={{ title: "", issuer: "", year: "" }}
              onSave={save}
              onDone={done}
            />
          )}
        />

        <PortfolioSection
          id="recognition"
          icon={Award}
          title="Awards & memberships"
          description="Optional — recognition and professional bodies you belong to."
          isEmpty={!portfolio.awards.length && !portfolio.memberships.length}
          emptyText="Add awards you've received or associations like PPTA."
          view={
            <div className="space-y-4">
              {portfolio.awards.length > 0 && <PortfolioAwardList items={portfolio.awards} />}
              {portfolio.memberships.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Memberships
                  </p>
                  <PortfolioTagList tags={portfolio.memberships} />
                </div>
              )}
            </div>
          }
          renderEditor={(done) => (
            <RecognitionEditor portfolio={portfolio} onSave={save} onDone={done} />
          )}
        />

      </div>
    </div>
  );
}

function PortfolioSection({
  id,
  icon: Icon,
  title,
  description,
  isEmpty,
  emptyText,
  view,
  renderEditor,
}: {
  id: PortfolioSectionId;
  icon: LucideIcon;
  title: string;
  description: string;
  isEmpty: boolean;
  emptyText: string;
  view: ReactNode;
  renderEditor: (done: () => void) => ReactNode;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <section
      id={`portfolio-${id}`}
      className="scroll-mt-28 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-muted text-brand">
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            <p className="text-xs text-slate-500">{description}</p>
          </div>
        </div>
        {!editing && !isEmpty && (
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
        )}
      </div>

      <div className="mt-5">
        {editing ? (
          renderEditor(() => setEditing(false))
        ) : isEmpty ? (
          <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">{emptyText}</p>
            <Button type="button" size="sm" onClick={() => setEditing(true)} className="shrink-0">
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
        ) : (
          view
        )}
      </div>
    </section>
  );
}

function useSectionSave(onSave: SaveFn, onDone: () => void) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function run(patch: PortfolioPatch) {
    setPending(true);
    setError(undefined);
    const message = await onSave(patch);
    setPending(false);
    if (message) setError(message);
    else onDone();
  }

  return { pending, error, setError, run };
}

function EditorActions({
  pending,
  error,
  onCancel,
}: {
  pending: boolean;
  error?: string;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-3 border-t border-slate-100 pt-4">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending} loading={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

type SectionEditorProps = {
  portfolio: PhysiotherapistPortfolio;
  onSave: SaveFn;
  onDone: () => void;
};

function AboutEditor({ portfolio, onSave, onDone }: SectionEditorProps) {
  const [headline, setHeadline] = useState(portfolio.headline ?? "");
  const [bio, setBio] = useState(portfolio.bio ?? "");
  const [languages, setLanguages] = useState(portfolio.languages);
  const { pending, error, run } = useSectionSave(onSave, onDone);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run({ headline: headline.trim(), bio: bio.trim(), languages });
      }}
      className="space-y-4"
    >
      <div>
        <Label htmlFor="portfolio-headline">Headline</Label>
        <Input
          id="portfolio-headline"
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          maxLength={LIMITS.headline}
          placeholder="e.g. Sports physiotherapist helping athletes return to play faster"
        />
        <p className="mt-1 text-right text-xs text-slate-400">
          {headline.length}/{LIMITS.headline}
        </p>
      </div>
      <div>
        <Label htmlFor="portfolio-bio">About you</Label>
        <textarea
          id="portfolio-bio"
          rows={6}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={LIMITS.bio}
          placeholder="Your approach to treatment, the patients you love working with, and what makes your care different."
          className="mt-1 flex w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-light focus:outline-none focus:ring-2 focus:ring-brand-light/25"
        />
        <p className="mt-1 flex justify-between text-xs text-slate-400">
          <span>{bio.trim().length < 100 ? "Aim for at least 100 characters." : "Looks great."}</span>
          <span>
            {bio.length}/{LIMITS.bio}
          </span>
        </p>
      </div>
      <div>
        <Label htmlFor="portfolio-languages">Languages you speak</Label>
        <TagInput
          id="portfolio-languages"
          values={languages}
          onChange={setLanguages}
          max={LIMITS.languages}
          suggestions={LANGUAGE_SUGGESTIONS}
          placeholder="Add a language"
        />
      </div>
      <EditorActions pending={pending} error={error} onCancel={onDone} />
    </form>
  );
}

function FocusEditor({ portfolio, onSave, onDone }: SectionEditorProps) {
  const [conditions, setConditions] = useState(portfolio.conditionsTreated);
  const [techniques, setTechniques] = useState(portfolio.techniques);
  const { pending, error, run } = useSectionSave(onSave, onDone);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run({ conditionsTreated: conditions, techniques });
      }}
      className="space-y-5"
    >
      <div>
        <Label htmlFor="portfolio-conditions">Conditions you treat</Label>
        <TagInput
          id="portfolio-conditions"
          values={conditions}
          onChange={setConditions}
          max={LIMITS.conditionsTreated}
          maxLength={LIMITS.tag}
          suggestions={PHYSIOTHERAPY_CONDITION_SUGGESTIONS}
          placeholder="e.g. Lower back pain"
        />
      </div>
      <div>
        <Label htmlFor="portfolio-techniques">Techniques & modalities</Label>
        <TagInput
          id="portfolio-techniques"
          values={techniques}
          onChange={setTechniques}
          max={LIMITS.techniques}
          maxLength={LIMITS.tag}
          suggestions={PHYSIOTHERAPY_TECHNIQUE_SUGGESTIONS}
          placeholder="e.g. Dry needling"
        />
      </div>
      <EditorActions pending={pending} error={error} onCancel={onDone} />
    </form>
  );
}

function ListSectionEditor<T extends object>({
  patchKey,
  items,
  fields,
  itemLabel,
  max,
  emptyRow,
  validate,
  onSave,
  onDone,
}: {
  patchKey: "experience" | "education" | "certifications";
  items: T[];
  fields: ListFieldDef[];
  itemLabel: string;
  max: number;
  emptyRow: DraftRow;
  validate?: (rows: DraftRow[]) => string | undefined;
  onSave: SaveFn;
  onDone: () => void;
}) {
  const [rows, setRows] = useState<DraftRow[]>(() =>
    items.length ? itemsToDraftRows(items, fields) : [{ ...emptyRow }],
  );
  const { pending, error, setError, run } = useSectionSave(onSave, onDone);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const invalid = validate?.(rows);
        if (invalid) return setError(invalid);
        const { items: parsed, error: parseError } = draftRowsToItems(rows, fields, itemLabel);
        if (parseError) return setError(parseError);
        run({ [patchKey]: parsed } as PortfolioPatch);
      }}
      className="space-y-4"
    >
      <PortfolioListEditor
        rows={rows}
        onChange={setRows}
        fields={fields}
        max={max}
        itemLabel={itemLabel}
        emptyRow={emptyRow}
      />
      <EditorActions pending={pending} error={error} onCancel={onDone} />
    </form>
  );
}

function RecognitionEditor({ portfolio, onSave, onDone }: SectionEditorProps) {
  const [rows, setRows] = useState<DraftRow[]>(() => itemsToDraftRows(portfolio.awards, AWARD_FIELDS));
  const [memberships, setMemberships] = useState(portfolio.memberships);
  const { pending, error, setError, run } = useSectionSave(onSave, onDone);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const { items, error: parseError } = draftRowsToItems<PortfolioAward>(rows, AWARD_FIELDS, "Award");
        if (parseError) return setError(parseError);
        run({ awards: items, memberships });
      }}
      className="space-y-5"
    >
      <div>
        <p className="mb-2 text-sm font-medium text-slate-800">Awards & achievements</p>
        <PortfolioListEditor
          rows={rows}
          onChange={setRows}
          fields={AWARD_FIELDS}
          max={LIMITS.awards}
          itemLabel="Award"
          emptyRow={{ title: "", year: "" }}
        />
      </div>
      <div>
        <Label htmlFor="portfolio-memberships">Professional memberships</Label>
        <TagInput
          id="portfolio-memberships"
          values={memberships}
          onChange={setMemberships}
          max={LIMITS.memberships}
          maxLength={LIMITS.tag}
          suggestions={PHYSIOTHERAPY_MEMBERSHIP_SUGGESTIONS}
          placeholder="e.g. PPTA"
        />
      </div>
      <EditorActions pending={pending} error={error} onCancel={onDone} />
    </form>
  );
}
