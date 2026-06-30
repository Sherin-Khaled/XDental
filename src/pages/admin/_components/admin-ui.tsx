import type { ReactNode } from "react";
import type { StatusTone } from "../admin-data";

const toneClasses: Record<StatusTone, string> = {
  green: "border-[#CFE8D6] bg-[#F4FBF5] text-[#16803C]",
  amber: "border-[#F9DC5C]/70 bg-[#FFF7D6] text-[#B88A44]",
  red: "border-[#F2C8C8] bg-[#FFF3F3] text-[#B42318]",
  blue: "border-[#F9DC5C]/70 bg-[#FFF7D6] text-[#B88A44]",
  purple: "border-[#E5C98D] bg-[#FFF9E8] text-[#B88A44]",
  slate: "border-[#050505]/10 bg-[#FBFAF7] text-[#717182]",
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
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#D4A72C]">Admin</p>
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
      className="inline-flex h-10 items-center justify-center rounded-lg bg-[#F9DC5C] px-4 text-sm font-semibold text-[#050505] shadow-sm transition-[transform,background-color,box-shadow] duration-200 ease-out hover:-translate-y-[1px] hover:bg-[#D4A72C] active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[#D4A72C]/45 focus:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100"
    >
      {children}
    </button>
  );
}

export function AdminGhostButton({ children }: { children: ReactNode }) {
  return (
    <button
      type="button"
      className="inline-flex h-8 items-center justify-center rounded-md border border-[#050505]/10 bg-white px-3 text-xs font-semibold text-[#050505] transition-[transform,background-color,border-color] duration-200 ease-out hover:-translate-y-[1px] hover:border-[#D4A72C]/60 hover:bg-[#FFF7D6] active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[#D4A72C]/35 motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100"
    >
      {children}
    </button>
  );
}

export function AdminStatusBadge({ children, tone }: { children: ReactNode; tone: StatusTone }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${toneClasses[tone]}`}>
      {children}
    </span>
  );
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
    <section className="rounded-lg border border-[#EFE2BC] bg-white p-5 shadow-sm transition-[transform,border-color,box-shadow] duration-200 ease-out hover:-translate-y-[1px] hover:border-[#D4A72C]/40 hover:shadow-[0_8px_22px_rgba(5,5,5,0.045)] motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[#717182]">{label}</p>
          <p className="mt-3 text-3xl font-bold tracking-tight text-[#050505]">{value}</p>
        </div>
        <span className={`h-3 w-3 rounded-full border ${toneClasses[tone]}`} aria-hidden="true" />
      </div>
      <p className="mt-4 text-sm text-[#717182]">{detail}</p>
    </section>
  );
}

export function AdminTableShell({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-[#EFE2BC] bg-white shadow-sm [&_tbody_tr]:transition-colors [&_tbody_tr]:duration-150 [&_tbody_tr:hover]:bg-[#FBFAF7] motion-reduce:[&_tbody_tr]:transition-none">
      <div className="overflow-x-auto">{children}</div>
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
    <section className="rounded-lg border border-[#EFE2BC] bg-white p-5 shadow-sm transition-[transform,border-color,box-shadow] duration-200 ease-out hover:-translate-y-[1px] hover:border-[#D4A72C]/40 hover:shadow-[0_8px_22px_rgba(5,5,5,0.04)] motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <h2 className="text-base font-bold text-[#050505]">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-[#717182]">{description}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}
