import { cn } from "@zindagi/shared";

type SectionHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  className?: string;
};

export function SectionHeader({
  eyebrow,
  title,
  description,
  align = "left",
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn(align === "center" && "text-center", className)}>
      {eyebrow && (
        <p
          className={cn(
            "inline-flex rounded-full border border-brand/20 bg-brand-muted px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-dark",
            align === "center" && "mx-auto",
          )}
        >
          {eyebrow}
        </p>
      )}
      <h2
        className={cn(
          "font-display text-2xl font-semibold tracking-tight text-foreground sm:text-4xl",
          eyebrow && "mt-3",
        )}
      >
        {title}
      </h2>
      {description && (
        <p
          className={cn(
            "mt-2 text-base text-slate-600 sm:mt-3 sm:text-lg",
            align === "center" && "mx-auto max-w-2xl",
            align === "left" && "max-w-2xl",
          )}
        >
          {description}
        </p>
      )}
    </div>
  );
}
