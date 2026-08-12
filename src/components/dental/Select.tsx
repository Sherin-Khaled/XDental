import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/context/LanguageContext";
import { cn } from "@/lib/utils";

export type DentalSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export function DentalSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  dir,
  className,
  triggerClassName,
  contentClassName,
  itemClassName,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: DentalSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  dir?: "ltr" | "rtl";
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  itemClassName?: string;
}) {
  const { direction } = useLanguage();
  const isCompactTrigger = triggerClassName?.includes("rounded-full") ?? false;
  const resolvedDirection = dir ?? direction;

  return (
    <div className={cn("block min-w-0 w-full", className)}>
      <Select value={value} onValueChange={onChange} disabled={disabled} dir={resolvedDirection}>
        <SelectTrigger
          aria-label={label}
          className={cn(
            "h-[52px] min-w-0 rounded-[14px] border border-[#050505]/10 bg-white px-5 text-start text-[14px] font-semibold text-[#050505] shadow-none outline-none transition hover:border-[var(--xd-gold-border)] focus:border-[var(--xd-gold-border-hover)] focus:ring-4 focus:ring-[var(--xd-gold-active)]/10 focus:ring-offset-0 data-[placeholder]:text-[#B3B4BD] [&>span]:min-w-0 [&>span]:truncate [&>svg]:ms-3 [&>svg]:h-4 [&>svg]:w-4 [&>svg]:shrink-0 [&>svg]:text-[#717182] [&>svg]:opacity-100",
            isCompactTrigger && "justify-center gap-2 text-center [&>svg]:ms-0",
            triggerClassName
          )}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent
          position="popper"
          sideOffset={8}
          align="start"
          collisionPadding={16}
          avoidCollisions
          className={cn(
            "z-[110] w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-32px)] overflow-hidden rounded-[16px] border border-[var(--xd-gold-border-soft)] bg-[#FFFEFB] p-1 text-[#050505] shadow-[0_18px_44px_rgba(5,5,5,0.12)] dark:border-[#D4A72C]/25 dark:bg-[#1A1A17] dark:text-[#F5F1E7] dark:shadow-[0_22px_56px_rgba(0,0,0,0.42)]",
            contentClassName
          )}
        >
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              disabled={option.disabled}
              className={cn(
                "my-0.5 min-w-0 overflow-hidden rounded-[12px] border border-transparent py-2.5 ps-3 pe-9 text-[14px] font-semibold text-[#5F5F5F] focus:border-[#D4A72C]/35 focus:bg-[#FFF3B0] focus:text-[#050505] data-[state=checked]:border-[#D4A72C]/30 data-[state=checked]:bg-[#FFF9E8] data-[state=checked]:text-[var(--xd-gold-text)] dark:text-[#CEC8BA] dark:focus:border-[#D4A72C]/45 dark:focus:bg-[#D4A72C]/18 dark:focus:text-[#FFF7D6] dark:data-[state=checked]:border-[#D4A72C]/35 dark:data-[state=checked]:bg-[#D4A72C]/10 dark:data-[state=checked]:text-[#F6D85D] [&>span:last-child]:block [&>span:last-child]:min-w-0 [&>span:last-child]:truncate",
                itemClassName
              )}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
