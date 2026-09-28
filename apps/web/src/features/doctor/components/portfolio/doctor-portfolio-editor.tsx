"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Award,
  BadgeCheck,
  BookOpen,
  Briefcase,
  Building2,
  ClipboardList,
  ExternalLink,
  Eye,
  EyeOff,
  GraduationCap,
  HelpCircle,
  Link2,
  Pencil,
  Plus,
  Stethoscope,
  Users,
  UserRound,
  Video,
  type LucideIcon,
} from "lucide-react";
import {
  cn,
  DOCTOR_MEMBERSHIP_SUGGESTIONS,
  DOCTOR_PORTFOLIO_LIMITS as LIMITS,
  DOCTOR_PORTFOLIO_LINK_KEYS,
  DOCTOR_PORTFOLIO_LINKS,
  doctorPortfolioSuggestions,
  parseYouTubeVideoId,
  type DoctorPortfolioHideableSection,
  type DoctorPortfolioLinkKey,
} from "@zindagi/shared";
import type { UpdateDoctorPortfolioInput } from "@zindagi/validators";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { TagInput } from "@/components/forms/tag-input";
import {
  draftRowsToItems,
  itemsToDraftRows,
  PortfolioListEditor,
  type DraftRow,
  type ListFieldDef,
} from "@/features/physiotherapist/components/portfolio/portfolio-list-editor";
import {
  PortfolioChecklist,
  PortfolioProgressBar,
} from "@/features/physiotherapist/components/portfolio/portfolio-progress";
import {
  PortfolioAwardList,
  PortfolioCertificationList,
  PortfolioEducationList,
  PortfolioExperienceTimeline,
  PortfolioTagList,
} from "@/features/physiotherapist/components/portfolio/portfolio-views";
import { useSafeRouter } from "@/lib/navigation/safe-router";
import {
  DOCTOR_PORTFOLIO_MIN_BIO_CHARS,
  doctorPortfolioChecklist,
  doctorPortfolioCompleteness,
  doctorPortfolioVideoId,
  isDoctorSectionVisible,
  type DoctorPortfolio,
  type DoctorPortfolioContext,
} from "@/lib/doctors/portfolio";
import { DoctorIntroVideo } from "./doctor-intro-video";
import {
  DoctorFaqList,
  DoctorLinkList,
  DoctorPublicationList,
  DoctorServiceList,
  hasDoctorLinks,
} from "./doctor-portfolio-views";
import { doctorPortfolioItemHref, DOCTOR_PROFILE_EDIT_PATH } from "./doctor-portfolio-paths";

type PortfolioPatch = UpdateDoctorPortfolioInput;
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

const SERVICE_FIELDS: ListFieldDef[] = [
  { key: "name", label: "Service / procedure", kind: "text", required: true, maxLength: LIMITS.serviceName, placeholder: "e.g. Echocardiography" },
  { key: "fee", label: "Fee (Rs., optional)", kind: "number", maxValue: LIMITS.serviceFee, placeholder: "e.g. 3000" },
  {
    key: "description",
    label: "Short description",
    kind: "textarea",
    wide: true,
    maxLength: LIMITS.serviceDescription,
    placeholder: "What it involves and who it's for.",
  },
];

const EXPERIENCE_FIELDS: ListFieldDef[] = [
  { key: "role", label: "Role", kind: "text", required: true, maxLength: 100, placeholder: "e.g. Consultant Cardiologist" },
  { key: "organization", label: "Hospital / clinic", kind: "text", required: true, maxLength: 160, placeholder: "e.g. Mayo Hospital" },
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
    placeholder: "Departments, procedures, teams you led, results you're proud of…",
  },
];

const EDUCATION_FIELDS: ListFieldDef[] = [
  { key: "degree", label: "Training / qualification", kind: "text", required: true, maxLength: 120, placeholder: "e.g. FCPS Cardiology residency" },
  { key: "institute", label: "Hospital / institute", kind: "text", required: true, maxLength: 160, placeholder: "e.g. Punjab Institute of Cardiology" },
  { key: "year", label: "Year completed", kind: "year" },
];

const CERTIFICATION_FIELDS: ListFieldDef[] = [
  { key: "title", label: "Certification / course", kind: "text", required: true, maxLength: 160, placeholder: "e.g. Advanced Cardiac Life Support (ACLS)" },
  { key: "issuer", label: "Issued by", kind: "text", maxLength: 160, placeholder: "e.g. American Heart Association" },
  { key: "year", label: "Year", kind: "year" },
  {
    key: "url",
    label: "Verification link",
    kind: "url",
    maxLength: 500,
    placeholder: "e.g. https://issuer.org/verify/ABC123",
  },
];

const AWARD_FIELDS: ListFieldDef[] = [
  { key: "title", label: "Award / achievement", kind: "text", required: true, maxLength: 160, wide: true, placeholder: "e.g. Gold Medal, Final Professional MBBS" },
  { key: "year", label: "Year", kind: "year" },
];

const PUBLICATION_FIELDS: ListFieldDef[] = [
  { key: "title", label: "Title", kind: "text", required: true, maxLength: 300, wide: true, placeholder: "e.g. Outcomes of early PCI in young adults" },
  { key: "publisher", label: "Journal / conference", kind: "text", maxLength: 160, placeholder: "e.g. JPMA" },
  { key: "year", label: "Year", kind: "year" },
  { key: "url", label: "Link (optional)", kind: "url", maxLength: LIMITS.url, wide: true, placeholder: "https://doi.org/… or https://pubmed.ncbi.nlm.nih.gov/…" },
];

const FAQ_FIELDS: ListFieldDef[] = [
  { key: "question", label: "Question", kind: "text", required: true, maxLength: LIMITS.faqQuestion, wide: true, placeholder: "e.g. Do you see children?" },
  { key: "answer", label: "Answer", kind: "textarea", required: true, maxLength: LIMITS.faqAnswer, wide: true, placeholder: "A short, friendly answer." },
];

const LINK_PLACEHOLDERS: Record<DoctorPortfolioLinkKey, string> = {
  website: "https://www.yourclinic.com",
  linkedin: "https://www.linkedin.com/in/your-name",
  facebook: "https://www.facebook.com/your-page",
  instagram: "https://www.instagram.com/your-handle",
  youtube: "https://www.youtube.com/@your-channel",
  x: "https://x.com/your-handle",
  researchgate: "https://www.researchgate.net/profile/Your-Name",
  googleScholar: "https://scholar.google.com/citations?user=…",
};

type DoctorPortfolioEditorProps = {
  initialPortfolio: DoctorPortfolio;
  context: DoctorPortfolioContext;
  doctorName: string;
  specialties: string[];
  hospitals: Array<{ name: string; city: string }>;
  publicPath: string | null;
};

export function DoctorPortfolioEditor({
  initialPortfolio,
  context,
  doctorName,
  specialties,
  hospitals,
  publicPath,
}: DoctorPortfolioEditorProps) {
  const { refresh } = useSafeRouter();
  const [portfolio, setPortfolio] = useState(initialPortfolio);
  const [openEditors, setOpenEditors] = useState<Set<string>>(() => new Set());
  const [visibilityError, setVisibilityError] = useState<string>();
  const checklist = doctorPortfolioChecklist(portfolio, context);
  const percent = doctorPortfolioCompleteness(checklist);
  const suggestions = doctorPortfolioSuggestions(specialties);

  // Warn before leaving the page while any section has an unsaved editor open.
  useEffect(() => {
    if (!openEditors.size) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [openEditors]);

  const setEditorOpen = useCallback((id: string, open: boolean) => {
    setOpenEditors((prev) => {
      if (prev.has(id) === open) return prev;
      const next = new Set(prev);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const save: SaveFn = async (patch) => {
    try {
      const res = await fetch("/api/v1/doctor/portfolio", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        return json?.error?.message ?? "Could not save. Please try again.";
      }
      setPortfolio(json.data as DoctorPortfolio);
      refresh();
      return undefined;
    } catch {
      return "Could not save. Check your connection and try again.";
    }
  };

  async function toggleVisibility(section: DoctorPortfolioHideableSection) {
    const hidden = new Set(portfolio.hiddenSections);
    if (hidden.has(section)) hidden.delete(section);
    else hidden.add(section);
    setVisibilityError(undefined);
    const message = await save({ hiddenSections: [...hidden] });
    if (message) setVisibilityError(message);
  }

  const sectionProps = (hideable?: DoctorPortfolioHideableSection) => ({
    onEditingChange: setEditorOpen,
    visibility: hideable
      ? {
          visible: isDoctorSectionVisible(portfolio, hideable),
          onToggle: () => toggleVisibility(hideable),
        }
      : undefined,
  });

  const videoId = doctorPortfolioVideoId(portfolio);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
      <aside className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm lg:sticky lg:top-24 lg:order-2">
        <PortfolioProgressBar percent={percent} />
        <PortfolioChecklist items={checklist} itemHref={doctorPortfolioItemHref} />
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
          <p className="mt-3 text-xs text-slate-500">
            Use the <Eye className="inline h-3 w-3" /> toggle on a section to hide it from your
            public page without deleting it.
          </p>
          {visibilityError && <p className="mt-2 text-xs text-red-600">{visibilityError}</p>}
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
          isEmpty={!portfolio.headline && !portfolio.bio && !portfolio.approach}
          emptyText="Add a headline and a short introduction about your practice."
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
              {portfolio.approach && (
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    My approach to care
                  </p>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
                    {portfolio.approach}
                  </p>
                </div>
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
          {...sectionProps()}
        />

        <PortfolioSection
          id="video"
          icon={Video}
          title="Intro video"
          description="Optional — a 1–2 minute YouTube video introducing yourself."
          isEmpty={!videoId}
          emptyText="Upload a short introduction to YouTube (public or unlisted), then paste the link here."
          view={videoId ? <DoctorIntroVideo videoId={videoId} title={`Introduction by ${doctorName}`} /> : null}
          renderEditor={(done) => <VideoEditor portfolio={portfolio} onSave={save} onDone={done} />}
          {...sectionProps("video")}
        />

        <PortfolioSection
          id="conditions"
          icon={Stethoscope}
          title="Conditions you treat"
          description="Patients search by their problem — list what you treat most."
          isEmpty={!portfolio.conditionsTreated.length}
          emptyText="List the conditions you treat most often."
          view={<PortfolioTagList tags={portfolio.conditionsTreated} />}
          renderEditor={(done) => (
            <TagSectionEditor
              patchKey="conditionsTreated"
              label="Conditions you treat"
              values={portfolio.conditionsTreated}
              max={LIMITS.conditionsTreated}
              suggestions={suggestions.conditions}
              placeholder="e.g. Hypertension"
              onSave={save}
              onDone={done}
            />
          )}
          {...sectionProps("conditions")}
        />

        <PortfolioSection
          id="services"
          icon={ClipboardList}
          title="Services & procedures"
          description="Consultations, tests and procedures you offer. Fees are optional."
          isEmpty={!portfolio.services.length}
          emptyText="Add the services patients can book or ask you about."
          view={<DoctorServiceList items={portfolio.services} />}
          renderEditor={(done) => (
            <ListSectionEditor
              patchKey="services"
              items={portfolio.services}
              fields={SERVICE_FIELDS}
              itemLabel="Service"
              max={LIMITS.services}
              emptyRow={{ name: "", fee: "", description: "" }}
              suggestions={{ key: "name", values: suggestions.services }}
              onSave={save}
              onDone={done}
            />
          )}
          {...sectionProps("services")}
        />

        <PortfolioSection
          id="experience"
          icon={Briefcase}
          title="Work experience"
          description="Hospitals and clinics where you've practiced."
          isEmpty={!portfolio.experience.length}
          emptyText="Add the hospitals and clinics you've worked at."
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
          {...sectionProps("experience")}
        />

        <PortfolioSection
          id="education"
          icon={GraduationCap}
          title="Training & qualifications"
          description="House job, residency, fellowships and postgraduate training. Your verified degree is shown automatically."
          isEmpty={!portfolio.education.length}
          emptyText="Add your house job, residency, fellowships or other training."
          view={<PortfolioEducationList items={portfolio.education} />}
          renderEditor={(done) => (
            <ListSectionEditor
              patchKey="education"
              items={portfolio.education}
              fields={EDUCATION_FIELDS}
              itemLabel="Training"
              max={LIMITS.education}
              emptyRow={{ degree: "", institute: "", year: "" }}
              onSave={save}
              onDone={done}
            />
          )}
          {...sectionProps("education")}
        />

        <PortfolioSection
          id="certifications"
          icon={BadgeCheck}
          title="Certifications & courses"
          description="Specialist courses and continuing medical education."
          isEmpty={!portfolio.certifications.length}
          emptyText="Add courses like ACLS, BLS, or specialist workshops."
          view={<PortfolioCertificationList items={portfolio.certifications} />}
          renderEditor={(done) => (
            <ListSectionEditor
              patchKey="certifications"
              items={portfolio.certifications}
              fields={CERTIFICATION_FIELDS}
              itemLabel="Certification"
              max={LIMITS.certifications}
              emptyRow={{ title: "", issuer: "", year: "", url: "" }}
              onSave={save}
              onDone={done}
            />
          )}
          {...sectionProps("certifications")}
        />

        <PortfolioSection
          id="publications"
          icon={BookOpen}
          title="Publications & research"
          description="Optional — papers, case reports and conference presentations."
          isEmpty={!portfolio.publications.length}
          emptyText="Add research papers or presentations you've authored."
          view={<DoctorPublicationList items={portfolio.publications} />}
          renderEditor={(done) => (
            <ListSectionEditor
              patchKey="publications"
              items={portfolio.publications}
              fields={PUBLICATION_FIELDS}
              itemLabel="Publication"
              max={LIMITS.publications}
              emptyRow={{ title: "", publisher: "", year: "", url: "" }}
              onSave={save}
              onDone={done}
            />
          )}
          {...sectionProps("publications")}
        />

        <PortfolioSection
          id="awards"
          icon={Award}
          title="Awards & achievements"
          description="Optional — medals, distinctions and recognition."
          isEmpty={!portfolio.awards.length}
          emptyText="Add awards or distinctions you've received."
          view={<PortfolioAwardList items={portfolio.awards} />}
          renderEditor={(done) => (
            <ListSectionEditor
              patchKey="awards"
              items={portfolio.awards}
              fields={AWARD_FIELDS}
              itemLabel="Award"
              max={LIMITS.awards}
              emptyRow={{ title: "", year: "" }}
              onSave={save}
              onDone={done}
            />
          )}
          {...sectionProps("awards")}
        />

        <PortfolioSection
          id="memberships"
          icon={Users}
          title="Professional memberships"
          description="Optional — societies and colleges you belong to."
          isEmpty={!portfolio.memberships.length}
          emptyText="Add associations like PMA or CPSP."
          view={<PortfolioTagList tags={portfolio.memberships} />}
          renderEditor={(done) => (
            <TagSectionEditor
              patchKey="memberships"
              label="Professional memberships"
              values={portfolio.memberships}
              max={LIMITS.memberships}
              suggestions={DOCTOR_MEMBERSHIP_SUGGESTIONS}
              placeholder="e.g. Pakistan Medical Association (PMA)"
              onSave={save}
              onDone={done}
            />
          )}
          {...sectionProps("memberships")}
        />

        <PortfolioSection
          id="faqs"
          icon={HelpCircle}
          title="Frequently asked questions"
          description="Optional — answer what patients ask you most. Also helps you appear in Google."
          isEmpty={!portfolio.faqs.length}
          emptyText="Add common questions, e.g. “Do you offer online follow-ups?”"
          view={<DoctorFaqList items={portfolio.faqs} />}
          renderEditor={(done) => (
            <ListSectionEditor
              patchKey="faqs"
              items={portfolio.faqs}
              fields={FAQ_FIELDS}
              itemLabel="Question"
              max={LIMITS.faqs}
              emptyRow={{ question: "", answer: "" }}
              onSave={save}
              onDone={done}
            />
          )}
          {...sectionProps("faqs")}
        />

        <PortfolioSection
          id="links"
          icon={Link2}
          title="Website & social links"
          description="Optional — your clinic website and professional profiles."
          isEmpty={!hasDoctorLinks(portfolio.links)}
          emptyText="Link your website, LinkedIn, or research profiles."
          view={<DoctorLinkList links={portfolio.links} />}
          renderEditor={(done) => <LinksEditor portfolio={portfolio} onSave={save} onDone={done} />}
          {...sectionProps("links")}
        />

        <section
          id="portfolio-clinics"
          className="scroll-mt-28 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-muted text-brand">
                <Building2 className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-slate-900">Clinic locations & hours</h2>
                <p className="text-xs text-slate-500">
                  Managed in your profile settings — shown on your public page with today&apos;s hours.
                </p>
              </div>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href={DOCTOR_PROFILE_EDIT_PATH}>
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Link>
            </Button>
          </div>
          <div className="mt-5 text-sm text-slate-600">
            {hospitals.length ? (
              <ul className="space-y-1">
                {hospitals.map((h, i) => (
                  <li key={`${h.name}-${i}`}>
                    <span className="font-medium text-slate-800">{h.name}</span>, {h.city}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-500">No clinic locations added yet.</p>
            )}
            <p className="mt-2 text-xs text-slate-500">
              {context.weeklySlotCount
                ? `${context.weeklySlotCount} weekly time window${context.weeklySlotCount === 1 ? "" : "s"} set.`
                : "No weekly clinic hours set yet."}
            </p>
          </div>
        </section>
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
  onEditingChange,
  visibility,
}: {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
  isEmpty: boolean;
  emptyText: string;
  view: ReactNode;
  renderEditor: (done: () => void) => ReactNode;
  onEditingChange: (id: string, editing: boolean) => void;
  visibility?: { visible: boolean; onToggle: () => Promise<void> };
}) {
  const [editing, setEditingState] = useState(false);
  const [toggling, setToggling] = useState(false);

  const setEditing = (value: boolean) => {
    setEditingState(value);
    onEditingChange(id, value);
  };

  // Clear the unsaved-changes flag if the section unmounts mid-edit.
  useEffect(() => () => onEditingChange(id, false), [id, onEditingChange]);

  const hidden = visibility && !visibility.visible;

  return (
    <section
      id={`portfolio-${id}`}
      className={cn(
        "scroll-mt-28 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6",
        hidden && "border-dashed bg-slate-50/60",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
              hidden ? "bg-slate-100 text-slate-400" : "bg-brand-muted text-brand",
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="flex flex-wrap items-center gap-2 text-base font-semibold text-slate-900">
              {title}
              {hidden && (
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                  Hidden from public page
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-500">{description}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {visibility && !isEmpty && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 sm:h-8 sm:w-8"
              disabled={toggling}
              onClick={async () => {
                setToggling(true);
                await visibility.onToggle();
                setToggling(false);
              }}
              aria-label={visibility.visible ? `Hide ${title} from public page` : `Show ${title} on public page`}
              title={visibility.visible ? "Visible on public page — click to hide" : "Hidden — click to show"}
            >
              {visibility.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </Button>
          )}
          {!editing && !isEmpty && (
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
          )}
        </div>
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

const textareaClass =
  "mt-1 flex w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-light focus:outline-none focus:ring-2 focus:ring-brand-light/25";

type SectionEditorProps = {
  portfolio: DoctorPortfolio;
  onSave: SaveFn;
  onDone: () => void;
};

function AboutEditor({ portfolio, onSave, onDone }: SectionEditorProps) {
  const [headline, setHeadline] = useState(portfolio.headline ?? "");
  const [bio, setBio] = useState(portfolio.bio ?? "");
  const [approach, setApproach] = useState(portfolio.approach ?? "");
  const [languages, setLanguages] = useState(portfolio.languages);
  const { pending, error, setError, run } = useSectionSave(onSave, onDone);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!languages.length) return setError("Add at least one language.");
        run({ headline: headline.trim(), bio: bio.trim(), approach: approach.trim(), languages });
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
          placeholder="e.g. Interventional cardiologist helping patients live heart-healthy lives"
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
          placeholder="Your background, the patients you see most, and what makes your care different."
          className={textareaClass}
        />
        <p className="mt-1 flex justify-between text-xs text-slate-400">
          <span>
            {bio.trim().length < DOCTOR_PORTFOLIO_MIN_BIO_CHARS
              ? `Aim for at least ${DOCTOR_PORTFOLIO_MIN_BIO_CHARS} characters.`
              : "Looks great."}
          </span>
          <span>
            {bio.length}/{LIMITS.bio}
          </span>
        </p>
      </div>
      <div>
        <Label htmlFor="portfolio-approach">My approach to care (optional)</Label>
        <textarea
          id="portfolio-approach"
          rows={4}
          value={approach}
          onChange={(e) => setApproach(e.target.value)}
          maxLength={LIMITS.approach}
          placeholder="How you work with patients — e.g. explaining every option, evidence-based treatment, follow-up on WhatsApp…"
          className={textareaClass}
        />
        <p className="mt-1 text-right text-xs text-slate-400">
          {approach.length}/{LIMITS.approach}
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

function VideoEditor({ portfolio, onSave, onDone }: SectionEditorProps) {
  const [url, setUrl] = useState(portfolio.introVideoUrl ?? "");
  const { pending, error, setError, run } = useSectionSave(onSave, onDone);
  const trimmed = url.trim();
  const previewId = trimmed ? parseYouTubeVideoId(trimmed) : null;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (trimmed && !previewId) {
          return setError("That doesn't look like a YouTube video link. Copy it from YouTube's Share button.");
        }
        run({ introVideoUrl: trimmed });
      }}
      className="space-y-4"
    >
      <ol className="list-decimal space-y-1 rounded-xl bg-slate-50 px-8 py-3 text-sm text-slate-600">
        <li>Record a short (1–2 min) video introducing yourself and your practice.</li>
        <li>Upload it to YouTube as <strong>Public</strong> or <strong>Unlisted</strong>.</li>
        <li>Click <strong>Share</strong> on YouTube, copy the link and paste it below.</li>
      </ol>
      <div>
        <Label htmlFor="portfolio-video">YouTube link</Label>
        <Input
          id="portfolio-video"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          maxLength={LIMITS.url}
          inputMode="url"
          placeholder="https://youtu.be/…"
        />
        {trimmed && !previewId && (
          <p className="mt-1 text-xs text-amber-700">Paste a full YouTube video link (youtube.com or youtu.be).</p>
        )}
      </div>
      {previewId && <DoctorIntroVideo videoId={previewId} title="Intro video preview" />}
      {portfolio.introVideoUrl && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-red-600 hover:bg-red-50"
          disabled={pending}
          onClick={() => run({ introVideoUrl: "" })}
        >
          Remove video
        </Button>
      )}
      <EditorActions pending={pending} error={error} onCancel={onDone} />
    </form>
  );
}

function TagSectionEditor({
  patchKey,
  label,
  values,
  max,
  suggestions,
  placeholder,
  onSave,
  onDone,
}: {
  patchKey: "conditionsTreated" | "memberships";
  label: string;
  values: string[];
  max: number;
  suggestions: readonly string[];
  placeholder: string;
  onSave: SaveFn;
  onDone: () => void;
}) {
  const [tags, setTags] = useState(values);
  const { pending, error, run } = useSectionSave(onSave, onDone);
  const inputId = `portfolio-${patchKey}`;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run({ [patchKey]: tags } as PortfolioPatch);
      }}
      className="space-y-4"
    >
      <div>
        <Label htmlFor={inputId}>{label}</Label>
        <TagInput
          id={inputId}
          values={tags}
          onChange={setTags}
          max={max}
          maxLength={LIMITS.tag}
          suggestions={suggestions}
          placeholder={placeholder}
        />
      </div>
      <EditorActions pending={pending} error={error} onCancel={onDone} />
    </form>
  );
}

type ListPatchKey =
  | "services"
  | "experience"
  | "education"
  | "certifications"
  | "awards"
  | "publications"
  | "faqs";

function ListSectionEditor<T extends object>({
  patchKey,
  items,
  fields,
  itemLabel,
  max,
  emptyRow,
  validate,
  suggestions,
  onSave,
  onDone,
}: {
  patchKey: ListPatchKey;
  items: T[];
  fields: ListFieldDef[];
  itemLabel: string;
  max: number;
  emptyRow: DraftRow;
  validate?: (rows: DraftRow[]) => string | undefined;
  /** One-tap chips that add a pre-filled row (e.g. common services for the specialty). */
  suggestions?: { key: string; values: readonly string[] };
  onSave: SaveFn;
  onDone: () => void;
}) {
  const [rows, setRows] = useState<DraftRow[]>(() =>
    items.length ? itemsToDraftRows(items, fields) : [{ ...emptyRow }],
  );
  const { pending, error, setError, run } = useSectionSave(onSave, onDone);

  const used = new Set(
    suggestions ? rows.map((r) => String(r[suggestions.key] ?? "").trim().toLowerCase()) : [],
  );
  const remaining = suggestions?.values.filter((v) => !used.has(v.toLowerCase())) ?? [];

  function addSuggestion(value: string) {
    if (!suggestions || rows.length >= max) return;
    // Reuse a blank first row instead of leaving an empty one behind.
    const blankIndex = rows.findIndex((r) =>
      fields.every((f) => (f.kind === "checkbox" ? true : !String(r[f.key] ?? "").trim())),
    );
    const row = { ...emptyRow, [suggestions.key]: value };
    setRows(blankIndex >= 0 ? rows.map((r, i) => (i === blankIndex ? row : r)) : [...rows, row]);
  }

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
      {remaining.length > 0 && rows.length < max && (
        <div>
          <p className="mb-2 text-xs font-medium text-slate-500">Quick add</p>
          <div className="flex flex-wrap gap-1.5">
            {remaining.slice(0, 10).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => addSuggestion(value)}
                className="rounded-full border border-dashed border-slate-300 px-2.5 py-1 text-xs text-slate-600 transition hover:border-brand hover:text-brand"
              >
                + {value}
              </button>
            ))}
          </div>
        </div>
      )}
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

function LinksEditor({ portfolio, onSave, onDone }: SectionEditorProps) {
  const [links, setLinks] = useState<Record<DoctorPortfolioLinkKey, string>>(
    () =>
      Object.fromEntries(
        DOCTOR_PORTFOLIO_LINK_KEYS.map((key) => [key, portfolio.links[key] ?? ""]),
      ) as Record<DoctorPortfolioLinkKey, string>,
  );
  const { pending, error, setError, run } = useSectionSave(onSave, onDone);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const bad = DOCTOR_PORTFOLIO_LINK_KEYS.find((key) => {
          const v = links[key].trim();
          return v !== "" && !v.toLowerCase().startsWith("https://");
        });
        if (bad) return setError(`${DOCTOR_PORTFOLIO_LINKS[bad].label}: links must start with https://`);
        run({
          links: Object.fromEntries(
            DOCTOR_PORTFOLIO_LINK_KEYS.map((key) => [key, links[key].trim()]),
          ) as NonNullable<PortfolioPatch["links"]>,
        });
      }}
      className="space-y-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {DOCTOR_PORTFOLIO_LINK_KEYS.map((key) => (
          <div key={key}>
            <Label htmlFor={`portfolio-link-${key}`}>{DOCTOR_PORTFOLIO_LINKS[key].label}</Label>
            <Input
              id={`portfolio-link-${key}`}
              value={links[key]}
              onChange={(e) => setLinks((prev) => ({ ...prev, [key]: e.target.value }))}
              maxLength={LIMITS.url}
              inputMode="url"
              placeholder={LINK_PLACEHOLDERS[key]}
            />
          </div>
        ))}
      </div>
      <EditorActions pending={pending} error={error} onCancel={onDone} />
    </form>
  );
}
