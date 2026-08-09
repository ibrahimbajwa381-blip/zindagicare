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
            "[:where(html[lang=ur])_&]:normal-case [:where(html[lang=ur])_&]:tracking-normal [:where(html[lang=ur])_&]:font-semibold",
            align === "center" && "mx-auto",
          )}
        >
          {eyebrow}
        </p>
      )}
      <h2
        className={cn(
          "font-display text-[1.65rem] font-semibold text-foreground sm:text-4xl",
          "leading-[1.15] tracking-tight sm:leading-tight",
          "[:where(html[lang=ur])_&]:leading-[2.15] [:where(html[lang=ur])_&]:tracking-normal [:where(html[lang=ur])_&]:font-medium",
          eyebrow && "mt-3",
        )}
      >
        {title}
      </h2>
      {description && (
        <p
          className={cn(
            "mt-2 text-base text-slate-600 sm:mt-3 sm:text-lg",
            "leading-relaxed",
            "[:where(html[lang=ur])_&]:leading-[2.25]",
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
