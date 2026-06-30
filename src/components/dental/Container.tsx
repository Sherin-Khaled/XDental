import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ContainerProps {
  children: ReactNode;
  className?: string;
}

export function Container({ children, className }: ContainerProps) {
  return (
    <div className={cn("box-border w-full max-w-[1344px] mx-auto px-5 sm:px-8 lg:px-12", className)}>
      {children}
    </div>
  );
}
