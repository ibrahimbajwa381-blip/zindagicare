import { cn } from "@zindagi/shared";

type PageTitleProps = {
  title: string;
  description?: string;
  eyebrow?: string;
  className?: string;
  align?: "left" | "center";
};

export function PageTitle({
  title,
  description,
  eyebrow,
  className,
  align = "left",
}: PageTitleProps) {
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
      <h1
        className={cn(
          "font-display text-2xl font-semibold tracking-tight text-foreground sm:text-4xl",
          eyebrow && "mt-3",
        )}
      >
        {title}
      </h1>
      {description && (
        <p
          className={cn(
            "mt-2 text-base leading-relaxed text-slate-600 sm:mt-3 sm:text-lg",
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
