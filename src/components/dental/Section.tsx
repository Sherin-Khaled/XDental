import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionProps {
  children: ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg" | "xl";
}

const paddingMap = {
  none: "",
  sm: "py-8 lg:py-12",
  md: "py-12 lg:py-[72px]",
  lg: "py-16 lg:py-24",
  xl: "py-20 lg:py-24",
};

export function Section({ children, className, padding = "md" }: SectionProps) {
  return (
    <section className={cn(paddingMap[padding], className)}>
      {children}
    </section>
  );
}
