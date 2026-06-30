import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  className,
  triggerClassName,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: DentalSelectOption[];
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
}) {
  const isCompactTrigger = triggerClassName?.includes("rounded-full") ?? false;

  return (
    <div className={cn("block min-w-0 w-full", className)}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          aria-label={label}
          className={cn(
            "h-[52px] min-w-0 rounded-[14px] border border-[#050505]/10 bg-white px-5 text-left text-[14px] font-semibold text-[#050505] shadow-none outline-none transition hover:border-[var(--xd-gold-border)] focus:border-[var(--xd-gold-border-hover)] focus:ring-4 focus:ring-[var(--xd-gold-active)]/10 focus:ring-offset-0 data-[placeholder]:text-[#B3B4BD] [&>span]:min-w-0 [&>span]:truncate [&>svg]:ml-3 [&>svg]:h-4 [&>svg]:w-4 [&>svg]:shrink-0 [&>svg]:text-[#717182] [&>svg]:opacity-100",
            isCompactTrigger && "justify-center gap-2 text-center [&>svg]:ml-0",
            triggerClassName
          )}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent
          position="popper"
          sideOffset={8}
          className="z-[90] rounded-[16px] border border-[var(--xd-gold-border-soft)] bg-white p-1.5 text-[#050505] shadow-[0_18px_44px_rgba(5,5,5,0.12)]"
        >
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              disabled={option.disabled}
              className="rounded-[12px] py-2.5 pl-3 pr-9 text-[14px] font-semibold text-[#5F5F5F] focus:bg-[var(--xd-gold-bg-soft)] focus:text-[#050505] data-[state=checked]:bg-[var(--xd-gold-bg-soft)] data-[state=checked]:text-[var(--xd-gold-text)]"
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
