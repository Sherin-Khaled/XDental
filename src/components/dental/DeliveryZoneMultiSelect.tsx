import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, MapPin, X } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useLanguage } from "@/context/LanguageContext";
import { cn } from "@/lib/utils";
import type {
  ClinicLocationInput,
  DeliveryZone,
} from "@/services/delivery";

type DeliveryZoneMultiSelectProps = {
  zones: DeliveryZone[];
  value: ClinicLocationInput[];
  onChange: (value: ClinicLocationInput[]) => void;
  label: string;
  placeholder: string;
  addAnotherPlaceholder: string;
  searchPlaceholder: string;
  emptyText: string;
  otherLabel: string;
  otherPlaceholder: string;
  error?: string;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  testId?: string;
};

export function DeliveryZoneMultiSelect({
  zones,
  value,
  onChange,
  label,
  placeholder,
  addAnotherPlaceholder,
  searchPlaceholder,
  emptyText,
  otherLabel,
  otherPlaceholder,
  error,
  disabled = false,
  className,
  inputClassName,
  testId = "clinic-locations",
}: DeliveryZoneMultiSelectProps) {
  const { language, direction } = useLanguage();
  const [open, setOpen] = useState(false);
  const otherInputRef = useRef<HTMLInputElement | null>(null);
  const shouldFocusOtherRef = useRef(false);
  const zonesById = useMemo(
    () => new Map(zones.map((zone) => [zone.id, zone])),
    [zones]
  );
  const selectedIds = useMemo(
    () => new Set(value.map((item) => item.deliveryZoneId)),
    [value]
  );
  const selectedItems = value
    .map((item) => ({ item, zone: zonesById.get(item.deliveryZoneId) }))
    .filter(
      (entry): entry is { item: ClinicLocationInput; zone: DeliveryZone } =>
        Boolean(entry.zone)
    );
  const otherZone = zones.find((zone) => zone.slug === "other");
  const otherSelection = otherZone
    ? value.find((item) => item.deliveryZoneId === otherZone.id)
    : undefined;

  const zoneName = (zone: DeliveryZone) =>
    language === "ar" ? zone.nameAr : zone.nameEn;

  useEffect(() => {
    if (!otherSelection || !shouldFocusOtherRef.current) return;
    shouldFocusOtherRef.current = false;
    otherInputRef.current?.focus();
  }, [otherSelection]);

  const toggleZone = (zone: DeliveryZone) => {
    if (selectedIds.has(zone.id)) {
      onChange(value.filter((item) => item.deliveryZoneId !== zone.id));
      return;
    }
    onChange([
      ...value,
      {
        deliveryZoneId: zone.id,
        ...(zone.slug === "other" ? { customArea: "" } : {}),
      },
    ]);
    if (zone.slug === "other") {
      shouldFocusOtherRef.current = true;
      setOpen(false);
    }
  };

  const removeZone = (deliveryZoneId: string) => {
    onChange(value.filter((item) => item.deliveryZoneId !== deliveryZoneId));
  };

  const updateOtherArea = (customArea: string) => {
    if (!otherZone) return;
    onChange(
      value.map((item) =>
        item.deliveryZoneId === otherZone.id
          ? { ...item, customArea }
          : item
      )
    );
  };

  return (
    <div dir={direction} className={cn("block", className)}>
      <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.09em] text-[#3A3A3A]">
        {label}
      </span>

      <div
        className={cn(
          "flex min-h-12 w-full flex-wrap items-center gap-1.5 rounded-[12px] border border-[#050505]/10 bg-white/80 px-2.5 py-2 text-[14px] text-[#050505] outline-none transition focus-within:border-[var(--xd-gold-active)]/70 focus-within:ring-4 focus-within:ring-[var(--xd-gold-bg-soft)]",
          error && "border-[#C97922]/40 bg-[#FFF8E6]/45",
          disabled && "cursor-not-allowed opacity-60",
          inputClassName
        )}
        aria-invalid={Boolean(error)}
        data-testid={testId}
      >
        {selectedItems.map(({ item, zone }) => (
          <span
            key={item.deliveryZoneId}
            className="inline-flex max-w-full items-center gap-1 rounded-full border border-[var(--xd-gold-border-soft)] bg-[var(--xd-gold-bg-soft)] ps-2.5 pe-1 py-1 text-[12px] font-semibold text-[var(--xd-gold-text)]"
          >
            <span className="truncate">{zoneName(zone)}</span>
            <button
              type="button"
              onClick={() => removeZone(item.deliveryZoneId)}
              disabled={disabled}
              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition hover:bg-[#050505]/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-focus-ring)]"
              aria-label={`${language === "ar" ? "إزالة" : "Remove"} ${zoneName(zone)}`}
            >
              <X size={12} />
            </button>
          </span>
        ))}

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              className="flex min-h-7 min-w-[150px] flex-1 items-center gap-2 rounded-lg px-1.5 text-start text-[#8A8D9A] outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-focus-ring)]"
              aria-label={placeholder}
              data-testid={`${testId}-trigger`}
            >
              <MapPin
                size={15}
                className="shrink-0 text-[var(--xd-gold-text)]"
              />
              <span className="min-w-0 flex-1 truncate">
                {selectedItems.length === 0
                  ? placeholder
                  : addAnotherPlaceholder}
              </span>
              <ChevronsUpDown size={15} className="shrink-0 opacity-60" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            sideOffset={8}
            className="w-[min(380px,calc(100vw-32px))] rounded-[16px] border border-[#050505]/10 bg-white p-0 text-[#050505] shadow-[0_18px_44px_rgba(5,5,5,0.12)]"
          >
            <Command dir={direction}>
              <CommandInput
                placeholder={searchPlaceholder}
                className="h-11 text-[14px]"
              />
              <CommandList className="max-h-[260px]">
                <CommandEmpty className="py-6 text-[13px] text-[#717182]">
                  {emptyText}
                </CommandEmpty>
                <CommandGroup>
                  {zones.map((zone) => {
                    const selected = selectedIds.has(zone.id);
                    return (
                      <CommandItem
                        key={zone.id}
                        value={`${zone.nameEn} ${zone.nameAr} ${zone.slug}`}
                        onSelect={() => toggleZone(zone)}
                        className="rounded-[10px] px-3 py-2.5 text-[14px] data-[selected=true]:bg-[var(--xd-gold-bg-soft)]"
                      >
                        <span
                          className={cn(
                            "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border",
                            selected
                              ? "border-[var(--xd-gold-active)] bg-[var(--xd-gold-active)] text-white"
                              : "border-[#050505]/15 bg-white"
                          )}
                        >
                          {selected && <Check size={13} />}
                        </span>
                        <span className="min-w-0 flex-1 truncate">
                          {zoneName(zone)}
                        </span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {otherSelection && (
        <label className="mt-3 block">
          <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.09em] text-[#3A3A3A]">
            {otherLabel}
          </span>
          <input
            ref={otherInputRef}
            type="text"
            value={otherSelection.customArea ?? ""}
            onChange={(event) => updateOtherArea(event.target.value)}
            maxLength={100}
            minLength={2}
            required
            disabled={disabled}
            placeholder={otherPlaceholder}
            aria-invalid={Boolean(error)}
            className={cn(
              "h-11 w-full rounded-[12px] border border-[#050505]/10 bg-white/80 px-4 text-[14px] text-[#050505] outline-none transition placeholder:text-[#9A9A9A] focus:border-[var(--xd-gold-active)]/70 focus:ring-4 focus:ring-[var(--xd-gold-bg-soft)]",
              error && "border-[#C97922]/40 bg-[#FFF8E6]/45"
            )}
            data-testid={`${testId}-other`}
          />
        </label>
      )}

      {error && (
        <p className="mt-2 text-[12px] font-medium text-[#9B6B18]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
