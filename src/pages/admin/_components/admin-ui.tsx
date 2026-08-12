import type { ReactNode } from "react";
import type { StatusTone } from "../admin-data";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/LanguageContext";

export type AdminStatusVariant =
  | "success"
  | "pending"
  | "warning"
  | "error"
  | "information"
  | "draft"
  | "scheduled"
  | "paused"
  | "archived";

const statusClasses: Record<AdminStatusVariant, string> = {
  success: "border-[#BFE4C9] bg-[#F0FAF3] text-[#137A36] dark:border-[#43A862]/45 dark:bg-[#43A862]/12 dark:text-[#8DE3A6]",
  pending: "border-[#F0D78A] bg-[#FFF9E5] text-[#9A6C00] dark:border-[#D4A72C]/50 dark:bg-[#D4A72C]/14 dark:text-[#F6D85D]",
  warning: "border-[#F1C58F] bg-[#FFF5E8] text-[#A65300] dark:border-[#E78B37]/45 dark:bg-[#E78B37]/12 dark:text-[#F5B675]",
  error: "border-[#F2C8C8] bg-[#FFF3F3] text-[#B42318] dark:border-[#E45B52]/45 dark:bg-[#E45B52]/12 dark:text-[#FF9B94]",
  information: "border-[#BFD9F3] bg-[#F1F7FD] text-[#1769A7] dark:border-[#5297D5]/45 dark:bg-[#5297D5]/12 dark:text-[#8BC5F7]",
  draft: "border-[#D9D9DF] bg-[#F7F7F8] text-[#646474] dark:border-white/20 dark:bg-white/[0.06] dark:text-[#C8C8D0]",
  scheduled: "border-[#D9C9F0] bg-[#F8F3FD] text-[#7350A5] dark:border-[#9C76D1]/45 dark:bg-[#9C76D1]/12 dark:text-[#C5A8EE]",
  paused: "border-[#E6D6B7] bg-[#FBF7EF] text-[#876A35] dark:border-[#B88A44]/45 dark:bg-[#B88A44]/12 dark:text-[#E3C27F]",
  archived: "border-[#D5D6D9] bg-[#F3F4F5] text-[#555963] dark:border-white/15 dark:bg-white/[0.04] dark:text-[#AEB1B7]",
};

const toneToVariant: Record<StatusTone, AdminStatusVariant> = {
  green: "success",
  amber: "pending",
  red: "error",
  blue: "information",
  purple: "scheduled",
  slate: "draft",
};

export function AdminPageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#D4A72C]">
          {t("admin.shell.admin")}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#050505]">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#717182]">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function AdminButton({ children }: { children: ReactNode }) {
  return (
    <button
      type="button"
      className="xd-gradient-primary-button inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100"
    >
      {children}
    </button>
  );
}

export function AdminGhostButton({ children }: { children: ReactNode }) {
  return (
    <button
      type="button"
      className="inline-flex h-8 items-center justify-center rounded-md border border-[#050505]/10 bg-white px-3 text-xs font-semibold text-[#050505] transition-[transform,background-color,border-color] duration-200 ease-out hover:-translate-y-[1px] hover:border-[#D4A72C]/60 hover:bg-[#FFF7D6] dark:hover:border-[#D4A72C]/40 dark:hover:bg-white/[0.05] dark:hover:text-[#F6D85D] active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[#D4A72C]/35 motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100"
    >
      {children}
    </button>
  );
}

export function AdminStatusPill({
  children,
  variant,
  icon,
  className,
}: {
  children: ReactNode;
  variant: AdminStatusVariant;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-8 min-w-max shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-xs font-bold leading-none",
        statusClasses[variant],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

export function AdminStatusBadge({ children, tone, icon }: { children: ReactNode; tone: StatusTone; icon?: ReactNode }) {
  return <AdminStatusPill variant={toneToVariant[tone]} icon={icon}>{children}</AdminStatusPill>;
}

export function AdminStatCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: StatusTone;
}) {
  return (
    <section className="rounded-lg border border-[#EFE2BC] bg-white p-5 shadow-sm transition-[transform,background-color,border-color,box-shadow] duration-200 ease-out hover:-translate-y-[1px] hover:border-[#D4A72C]/40 hover:shadow-[0_8px_22px_rgba(5,5,5,0.045)] dark:hover:border-[#D4A72C]/40 dark:hover:bg-white/[0.03] dark:hover:shadow-[0_18px_45px_rgba(0,0,0,0.25)] motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[#717182]">{label}</p>
          <p className="mt-3 text-3xl font-bold tracking-tight text-[#050505]">{value}</p>
        </div>
        <span className={cn("h-3 w-3 rounded-full border", statusClasses[toneToVariant[tone]])} aria-hidden="true" />
      </div>
      <p className="mt-4 text-sm text-[#717182]">{detail}</p>
    </section>
  );
}

export function AdminTableShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-w-0 max-w-full overflow-hidden rounded-lg border border-[#EFE2BC] bg-white shadow-sm [&_tbody_tr]:transition-colors [&_tbody_tr]:duration-150 [&_tbody_tr:hover]:bg-[#FBFAF7] dark:[&_tbody_tr:hover]:bg-white/[0.04] motion-reduce:[&_tbody_tr]:transition-none">
      <div className="max-w-full overflow-x-auto overscroll-x-contain">{children}</div>
    </div>
  );
}

export function AdminPanel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[#EFE2BC] bg-white p-5 shadow-sm transition-[transform,background-color,border-color,box-shadow] duration-200 ease-out hover:-translate-y-[1px] hover:border-[#D4A72C]/40 hover:shadow-[0_8px_22px_rgba(5,5,5,0.04)] dark:hover:border-[#D4A72C]/40 dark:hover:bg-white/[0.03] dark:hover:shadow-[0_18px_45px_rgba(0,0,0,0.25)] motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <h2 className="text-base font-bold text-[#050505]">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-[#717182]">{description}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}
