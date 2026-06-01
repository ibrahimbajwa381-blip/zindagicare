import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@zindagi/shared";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-light focus-visible:ring-offset-2 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 disabled:active:scale-100",
  {
    variants: {
      variant: {
        default: "bg-brand text-brand-foreground hover:bg-brand-dark",
        secondary: "bg-muted text-foreground hover:bg-border",
        outline: "border border-border bg-white text-foreground hover:bg-muted",
        ghost: "text-foreground hover:bg-muted",
        link: "text-brand underline-offset-4 hover:text-brand-dark hover:underline active:scale-100",
        accent: "bg-accent text-white hover:bg-accent-dark",
      },
      size: {
        default: "min-h-11 h-11 px-4 py-2 sm:min-h-10 sm:h-10",
        sm: "min-h-10 h-10 rounded-lg px-3 sm:min-h-9 sm:h-9 sm:rounded-md",
        lg: "min-h-12 h-12 rounded-xl px-8 text-base",
        icon: "h-11 w-11 sm:h-10 sm:w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

<<<<<<< HEAD
const Button = React.forwardRef<React.ElementRef<"button">, ButtonProps>(
=======
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
>>>>>>> de54e62 (google verification)
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size }), className)}
<<<<<<< HEAD
        ref={ref as never}
        {...(props as Record<string, unknown>)}
=======
        ref={ref}
        {...props}
>>>>>>> de54e62 (google verification)
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
