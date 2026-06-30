import React from "react";
import { cn } from "@/lib/utils";

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverEffect?: boolean;
}

export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, hoverEffect = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "bg-white/68 backdrop-blur-[18px] border border-[var(--xd-gold-border-soft)] rounded-[24px] shadow-[0px_12px_32px_rgba(5,5,5,0.05)]",
          hoverEffect && "transition-[transform,border-color,box-shadow] duration-300 ease-out hover:-translate-y-[2px] hover:border-[var(--xd-gold-border-hover)] hover:shadow-[0px_18px_44px_var(--xd-gold-bg-medium)] motion-reduce:transition-none motion-reduce:hover:translate-y-0",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

GlassCard.displayName = "GlassCard";
