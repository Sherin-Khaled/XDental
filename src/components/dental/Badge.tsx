import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring",
  {
    variants: {
      variant: {
        neutral: "bg-[#EFE8D8] text-[#5F5F5F]",
        discount: "bg-[#B42318]/10 text-[#B42318] border border-[#B42318]/20",
        new: "bg-[#25B8C7]/10 text-[#178A96] border border-[#25B8C7]/20",
        fastDelivery: "bg-[var(--xd-gold-bg-soft)] text-[var(--xd-gold-text)] border border-[var(--xd-gold-border-soft)]",
        inStock: "bg-[#16803C]/10 text-[#16803C] border border-[#16803C]/20",
        lowStock: "bg-[var(--xd-gold-bg-medium)] text-[var(--xd-gold-text)] border border-[var(--xd-gold-border-soft)]",
        outOfStock: "bg-[#B42318]/10 text-[#B42318] border border-[#B42318]/20",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
