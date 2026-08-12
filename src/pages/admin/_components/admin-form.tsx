import {
  forwardRef,
  useMemo,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { AlertCircle, Check, ChevronsUpDown, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
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
import { DentalSelect, type DentalSelectOption } from "@/components/dental/Select";
import { cn } from "@/lib/utils";

const fieldControl =
  "mt-2 h-[50px] w-full rounded-[14px] border border-[#050505]/10 bg-white px-4 text-sm font-semibold text-[#050505] outline-none transition placeholder:text-[#A3A3AB] hover:border-[#D4A72C]/45 focus:border-[#D4A72C] focus:ring-4 focus:ring-[#D4A72C]/10 disabled:cursor-not-allowed disabled:bg-[#F5F4F1] disabled:text-[#8A8D9A]";
const errorControl =
  "border-[#B42318]/55 bg-[#FFF9F8] focus:border-[#B42318] focus:ring-[#B42318]/10";

export function AdminFormError({
  id,
  children,
  className,
}: {
  id?: string;
  children?: ReactNode;
  className?: string;
}) {
  if (!children) return null;
  return (
    <p
      id={id}
      role="alert"
      className={cn(
        "mt-1.5 flex min-h-5 items-start gap-1.5 text-xs font-semibold leading-5 text-[#B42318] animate-in fade-in slide-in-from-top-1",
        className
      )}
    >
      <AlertCircle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

export function AdminFieldLabel({
  htmlFor,
  children,
  optional,
}: {
  htmlFor?: string;
  children: ReactNode;
  optional?: string;
}) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-bold text-[#050505]">
      {children}
      {optional && (
        <span className="ms-1.5 text-xs font-medium text-[#8A8D9A]">
          {optional}
        </span>
      )}
    </label>
  );
}

type AdminInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  optional?: string;
  wrapperClassName?: string;
};

export const AdminInput = forwardRef<HTMLInputElement, AdminInputProps>(
  (
    {
      id,
      label,
      error,
      optional,
      className,
      wrapperClassName,
      ...props
    },
    ref
  ) => {
    const inputId = id ?? props.name;
    const errorId = error && inputId ? `${inputId}-error` : undefined;
    return (
      <div className={wrapperClassName}>
        <AdminFieldLabel htmlFor={inputId} optional={optional}>
          {label}
        </AdminFieldLabel>
        <input
          ref={ref}
          id={inputId}
          aria-invalid={Boolean(error)}
          aria-describedby={errorId}
          className={cn(fieldControl, error && errorControl, className)}
          {...props}
        />
        <AdminFormError id={errorId}>{error}</AdminFormError>
      </div>
    );
  }
);
AdminInput.displayName = "AdminInput";

type AdminTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  error?: string;
  optional?: string;
  wrapperClassName?: string;
};

export const AdminTextarea = forwardRef<
  HTMLTextAreaElement,
  AdminTextareaProps
>(
  (
    {
      id,
      label,
      error,
      optional,
      className,
      wrapperClassName,
      ...props
    },
    ref
  ) => {
    const inputId = id ?? props.name;
    const errorId = error && inputId ? `${inputId}-error` : undefined;
    return (
      <div className={wrapperClassName}>
        <AdminFieldLabel htmlFor={inputId} optional={optional}>
          {label}
        </AdminFieldLabel>
        <textarea
          ref={ref}
          id={inputId}
          aria-invalid={Boolean(error)}
          aria-describedby={errorId}
          className={cn(
            fieldControl,
            "min-h-28 resize-y py-3 leading-6",
            error && errorControl,
            className
          )}
          {...props}
        />
        <AdminFormError id={errorId}>{error}</AdminFormError>
      </div>
    );
  }
);
AdminTextarea.displayName = "AdminTextarea";

export function AdminSelect({
  id,
  label,
  value,
  onChange,
  options,
  placeholder,
  error,
  disabled,
  wrapperClassName,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: DentalSelectOption[];
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  wrapperClassName?: string;
}) {
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div
      className={wrapperClassName}
      data-admin-field={id}
      aria-disabled={disabled}
    >
      <AdminFieldLabel>{label}</AdminFieldLabel>
      <div
        className={cn(disabled && "pointer-events-none opacity-60")}
        aria-invalid={Boolean(error)}
        aria-describedby={errorId}
      >
        <DentalSelect
          label={label}
          value={value}
          onChange={onChange}
          options={options}
          placeholder={placeholder}
          triggerClassName={cn(
            "mt-2 h-[50px] rounded-[14px]",
            error && errorControl
          )}
        />
      </div>
      <AdminFormError id={errorId}>{error}</AdminFormError>
    </div>
  );
}

export function AdminCheckbox({
  id,
  checked,
  onCheckedChange,
  label,
  description,
  disabled,
}: {
  id: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-[14px] border border-[#050505]/10 bg-white p-3.5 transition hover:border-[#D4A72C]/50 hover:bg-[#FFFDF6]",
        disabled && "cursor-not-allowed opacity-60"
      )}
    >
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        className="mt-0.5 h-5 w-5 rounded-md border-[#D4A72C]/55 data-[state=checked]:border-[#D4A72C] data-[state=checked]:bg-[#F9DC5C] data-[state=checked]:text-[#050505] focus-visible:ring-[#D4A72C]/35"
      />
      <span className="min-w-0">
        <span className="block text-sm font-bold text-[#050505]">{label}</span>
        {description && (
          <span className="mt-1 block text-xs leading-5 text-[#717182]">
            {description}
          </span>
        )}
      </span>
    </label>
  );
}

export function AdminWeekdaySelector({
  id,
  labels,
  value,
  onChange,
  error,
}: {
  id: string;
  labels: string[];
  value: number[];
  onChange: (value: number[]) => void;
  error?: string;
}) {
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div
      data-admin-field={id}
      role="group"
      aria-invalid={Boolean(error)}
      aria-describedby={errorId}
    >
      <div className="flex flex-wrap gap-2">
        {labels.map((label, weekday) => {
          const selected = value.includes(weekday);
          return (
            <button
              key={weekday}
              type="button"
              aria-pressed={selected}
              onClick={() =>
                onChange(
                  selected
                    ? value.filter((item) => item !== weekday)
                    : [...value, weekday].sort((a, b) => a - b)
                )
              }
              className={cn(
                "min-h-10 rounded-full border px-4 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#D4A72C]/15",
                selected
                  ? "border-[#D4A72C] bg-[#FFF3B0] text-[#6F5000] shadow-sm"
                  : "border-[#050505]/10 bg-white text-[#717182] hover:border-[#D4A72C]/55 hover:text-[#050505]",
                error && !selected && "border-[#B42318]/25"
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
      <AdminFormError id={errorId}>{error}</AdminFormError>
    </div>
  );
}

export type AdminMultiSelectOption = {
  value: string;
  label: string;
  searchText?: string;
  disabled?: boolean;
};

export function AdminMultiSelect({
  id,
  label,
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder,
  emptyText,
  error,
  disabled,
}: {
  id: string;
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  options: AdminMultiSelectOption[];
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  error?: string;
  disabled?: boolean;
}) {
  const selected = useMemo(
    () => options.filter((option) => value.includes(option.value)),
    [options, value]
  );
  const errorId = error ? `${id}-error` : undefined;

  const toggle = (optionValue: string) => {
    onChange(
      value.includes(optionValue)
        ? value.filter((item) => item !== optionValue)
        : [...value, optionValue]
    );
  };

  return (
    <div data-admin-field={id}>
      <AdminFieldLabel>{label}</AdminFieldLabel>
      <div
        className={cn(
          "mt-2 flex min-h-[50px] flex-wrap items-center gap-1.5 rounded-[14px] border border-[#050505]/10 bg-white p-2 transition focus-within:border-[#D4A72C] focus-within:ring-4 focus-within:ring-[#D4A72C]/10",
          error && errorControl,
          disabled && "pointer-events-none opacity-60"
        )}
        aria-invalid={Boolean(error)}
        aria-describedby={errorId}
      >
        {selected.map((option) => (
          <span
            key={option.value}
            className="inline-flex max-w-full items-center gap-1 rounded-full border border-[#E7C85D]/60 bg-[#FFF7D6] py-1 ps-2.5 pe-1 text-xs font-bold text-[#765600]"
          >
            <span className="truncate">{option.label}</span>
            <button
              type="button"
              onClick={() => toggle(option.value)}
              className="grid h-5 w-5 place-items-center rounded-full hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4A72C]/40"
              aria-label={`Remove ${option.label}`}
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              className="flex min-h-8 min-w-[160px] flex-1 items-center justify-between gap-2 rounded-lg px-2 text-start text-sm font-semibold text-[#8A8D9A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4A72C]/35"
            >
              <span className="truncate">{placeholder}</span>
              <ChevronsUpDown size={15} className="shrink-0" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            sideOffset={8}
            collisionPadding={16}
            avoidCollisions
            data-admin-select-popover=""
            className="z-[110] w-[min(390px,calc(100vw-32px))] overflow-hidden rounded-[16px] border border-[#EFE2BC] bg-white p-0 shadow-[0_18px_44px_rgba(5,5,5,0.12)] data-[state=closed]:animate-none data-[state=open]:animate-none dark:border-[#D4A72C]/25 dark:bg-[#1A1A17] dark:shadow-[0_22px_56px_rgba(0,0,0,0.42)]"
          >
            <Command>
              <CommandInput placeholder={searchPlaceholder} />
              <CommandList className="max-h-[280px]">
                <CommandEmpty>{emptyText}</CommandEmpty>
                <CommandGroup>
                  {options.map((option) => {
                    const isSelected = value.includes(option.value);
                    return (
                      <CommandItem
                        key={option.value}
                        value={`${option.label} ${option.searchText ?? ""}`}
                        disabled={option.disabled}
                        onSelect={() => toggle(option.value)}
                        className="my-0.5 rounded-[10px] border border-transparent px-3 py-2.5 data-[selected=true]:border-[#D4A72C]/30 data-[selected=true]:bg-[#FFF7D6] dark:text-[#CEC8BA] dark:data-[selected=true]:border-[#D4A72C]/40 dark:data-[selected=true]:bg-[#D4A72C]/14 dark:data-[selected=true]:text-[#F6D85D]"
                      >
                        <span
                          className={cn(
                            "grid h-5 w-5 place-items-center rounded-md border",
                            isSelected
                              ? "border-[#D4A72C] bg-[#F9DC5C] text-[#050505]"
                              : "border-[#050505]/15 bg-white"
                          )}
                        >
                          {isSelected && <Check size={13} />}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                          {option.label}
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
      <AdminFormError id={errorId}>{error}</AdminFormError>
    </div>
  );
}
