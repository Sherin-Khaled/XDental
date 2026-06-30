import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-full font-sans font-bold transition-[transform,background-color,border-color,color,box-shadow] duration-200 ease-out active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--xd-bg)] disabled:pointer-events-none disabled:opacity-55 motion-reduce:transition-none motion-reduce:active:scale-100",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--xd-gold)] text-[#3A2600] hover:-translate-y-[1px] hover:bg-[var(--xd-gold-hover)] hover:text-[#2A1A00] hover:shadow-[var(--xd-shadow-hover)]",
        secondary:
          "border border-[#050505]/10 bg-white/70 text-[#050505] backdrop-blur-md hover:-translate-y-[1px] hover:border-[var(--xd-gold-border-hover)] hover:bg-white hover:shadow-[0px_10px_24px_rgba(5,5,5,0.06)]",
        tertiary:
          "bg-transparent text-[#717182] hover:bg-[#050505]/[0.04] hover:text-[#050505]",
        ghost:
          "bg-transparent text-[#717182] hover:bg-[#050505]/[0.04] hover:text-[#050505]",
        destructive:
          "border border-[#F44336]/25 bg-white/70 text-[#F44336] hover:-translate-y-[1px] hover:bg-[#F44336]/[0.04] hover:shadow-[0px_10px_24px_rgba(244,67,54,0.08)] focus-visible:ring-[#F44336]/30",
      },
      size: {
        sm: "h-11 px-4 text-sm",
        md: "h-12 px-6 text-base",
        lg: "h-14 px-8 text-lg",
        icon: "h-12 w-12",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
