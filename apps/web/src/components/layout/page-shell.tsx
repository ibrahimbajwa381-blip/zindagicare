import { cn } from "@zindagi/shared";
import { PageSection, type PageSectionVariant } from "./page-section";

type PageShellProps = {
  children: React.ReactNode;
  variant?: PageSectionVariant;
  spacing?: "sm" | "default" | "lg";
  flipBlur?: boolean;
  id?: string;
  /** Constrain content width (dashboard, forms) */
  narrow?: boolean;
  className?: string;
  innerClassName?: string;
};

export function PageShell({
  children,
  variant = "neutral",
  spacing = "default",
  flipBlur = false,
  id,
  narrow = false,
  className,
  innerClassName,
}: PageShellProps) {
  return (
    <PageSection
      id={id}
      variant={variant}
      spacing={spacing}
      flipBlur={flipBlur}
      className={className}
      innerClassName={cn(narrow && "!max-w-4xl", innerClassName)}
    >
      {children}
    </PageSection>
  );
}
