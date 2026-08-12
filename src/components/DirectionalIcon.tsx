import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  MoveLeft,
  MoveRight,
} from "lucide-react";
import type { ComponentProps } from "react";
import { useLanguage } from "@/context/LanguageContext";

type DirectionalIconFamily = "arrow" | "chevron" | "move";
type DirectionalIconDirection = "forward" | "back" | "next" | "previous";
type DirectionalIconProps = ComponentProps<typeof ArrowRight> & {
  direction?: DirectionalIconDirection;
  family?: DirectionalIconFamily;
};

const icons = {
  arrow: {
    left: ArrowLeft,
    right: ArrowRight,
  },
  chevron: {
    left: ChevronLeft,
    right: ChevronRight,
  },
  move: {
    left: MoveLeft,
    right: MoveRight,
  },
} satisfies Record<DirectionalIconFamily, Record<"left" | "right", typeof ArrowRight>>;

export function DirectionalIcon({
  direction = "forward",
  family = "arrow",
  ...props
}: DirectionalIconProps) {
  const { isRtl } = useLanguage();
  const movesForward = direction === "forward" || direction === "next";
  const side =
    movesForward
      ? isRtl ? "left" : "right"
      : isRtl ? "right" : "left";
  const Icon = icons[family][side];

  return <Icon {...props} />;
}
