import type { HTMLAttributes, ReactNode } from "react";
import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

type SectionRevealProps = Omit<HTMLMotionProps<"div">, "children"> & {
  children: ReactNode;
  delay?: number;
  duration?: number;
  y?: number;
  amount?: number;
};

const revealEase = [0.22, 1, 0.36, 1] as const;

export function SectionReveal({
  children,
  className,
  delay = 0,
  duration = 0.36,
  y = 12,
  amount = 0.18,
  ...props
}: SectionRevealProps) {
  const prefersReducedMotion = useReducedMotion();
  const revealDelay = Math.min(delay, 0.08);

  if (prefersReducedMotion) {
    return (
      <div className={className} {...(props as HTMLAttributes<HTMLDivElement>)}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount }}
      transition={{ duration, delay: revealDelay, ease: revealEase }}
      className={cn("will-change-[opacity,transform]", className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}
