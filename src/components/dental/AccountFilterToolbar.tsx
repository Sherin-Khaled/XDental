import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const accountFilterSearchClassName = "relative col-span-2 block min-w-0";
export const accountFilterControlClassName = "min-w-0";
export const accountFilterTriggerClassName =
  "h-12 rounded-full px-3 text-[12px] sm:px-4 sm:text-[13px]";

export function AccountFilterToolbar({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("grid grid-cols-2 gap-3", className)} {...props} />;
}
