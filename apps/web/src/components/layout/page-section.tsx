import { cn } from "@zindagi/shared";
import { pageContainer } from "@/lib/ui/surfaces";

export type PageSectionVariant = "brand" | "accent" | "neutral" | "soft";

type PageSectionProps = {
  children: React.ReactNode;
  variant?: PageSectionVariant;
  id?: string;
  className?: string;
  innerClassName?: string;
  /** Vertical padding scale; `tall` adds full-viewport min-height (hero promos). */
  spacing?: "sm" | "default" | "lg" | "tall";
  /** Mirror decorative blurs for alternating sections */
  flipBlur?: boolean;
  /** Section edge borders (off for full-page shells like auth) */
  bordered?: boolean;
};

const variantStyles: Record<
  PageSectionVariant,
  { section: string; wash: string; brandBlur: string; accentBlur: string }
> = {
  brand: {
    section:
      "bg-gradient-to-br from-brand-muted via-white to-accent-muted",
    wash: "from-brand-light/25",
    brandBlur: "bg-brand-light/20",
    accentBlur: "bg-accent-light/20",
  },
  accent: {
    section:
      "bg-gradient-to-br from-accent-muted via-white to-brand-muted",
    wash: "from-accent-light/22",
    brandBlur: "bg-brand-light/18",
    accentBlur: "bg-accent-light/22",
  },
  neutral: {
    section:
      "bg-gradient-to-br from-slate-50/90 via-white to-brand-muted/45",
    wash: "from-slate-100/40",
    brandBlur: "bg-brand-light/15",
    accentBlur: "bg-accent-light/15",
  },
  soft: {
    section:
      "bg-gradient-to-b from-white via-brand-muted/30 to-accent-muted/35",
    wash: "from-brand-light/18",
    brandBlur: "bg-brand-light/16",
    accentBlur: "bg-accent-light/18",
  },
};

const spacingClasses = {
  sm: "py-10 sm:py-12",
  default: "py-16 sm:py-20 lg:py-24",
  lg: "py-20 sm:py-28",
  tall: "py-16 sm:py-20 lg:py-24",
};

export function PageSection({
  children,
  variant = "brand",
  id,
  className,
  innerClassName,
  spacing = "default",
  flipBlur = false,
  bordered = true,
}: PageSectionProps) {
  const styles = variantStyles[variant];
  const isTall = spacing === "tall";

  return (
    <section
      id={id}
      className={cn(
        "relative w-full overflow-hidden",
        styles.section,
        bordered && "border-y border-brand-light/25",
        isTall && "flex min-h-[min(100svh,920px)] items-center",
        className,
      )}
    >
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-1/4 h-80 w-80 rounded-full blur-3xl sm:h-[28rem] sm:w-[28rem]",
          styles.brandBlur,
          flipBlur
            ? "-left-24 bottom-0 top-auto sm:h-96 sm:w-96"
            : "-right-32 sm:h-[36rem] sm:w-[36rem]",
        )}
      />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute bottom-0 h-72 w-72 rounded-full blur-3xl sm:h-96 sm:w-96",
          styles.accentBlur,
          flipBlur ? "-right-32 top-1/4 bottom-auto" : "-left-24",
        )}
      />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-b via-transparent to-transparent",
          styles.wash,
        )}
      />

      <div
        className={cn(pageContainer, spacingClasses[spacing], innerClassName)}
      >
        {children}
      </div>
    </section>
  );
}
