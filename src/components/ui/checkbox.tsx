import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Check, Minus } from "lucide-react"

import { cn } from "@/lib/utils"

type CheckboxProps = React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> & {
  variant?: "default" | "filter"
}

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(({ className, variant = "default", ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "group/checkbox peer grid h-4 w-4 shrink-0 place-content-center rounded-sm border shadow transition-[background,border-color,box-shadow] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
      variant === "filter"
        ? "border-[var(--xd-gold-border-hover)] bg-[var(--xd-surface)] text-[#050505] shadow-none hover:border-[var(--xd-gold-active)] focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-active)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--xd-bg)] data-[state=checked]:border-transparent data-[state=checked]:[background:var(--xd-gold-gradient)] data-[state=checked]:text-[#050505] data-[state=indeterminate]:border-transparent data-[state=indeterminate]:[background:var(--xd-gold-gradient)] data-[state=indeterminate]:text-[#050505]"
        : "border-primary shadow focus-visible:ring-1 focus-visible:ring-ring data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground",
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className={cn("grid place-content-center text-current")}
    >
      <Check className="h-4 w-4 group-data-[state=indeterminate]/checkbox:hidden" />
      <Minus className="hidden h-3.5 w-3.5 group-data-[state=indeterminate]/checkbox:block" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
