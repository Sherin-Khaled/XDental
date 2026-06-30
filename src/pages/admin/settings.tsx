import { useMemo, useState, type FormEvent } from "react";
import { AdminLayout } from "./_components/AdminLayout";
import { AdminPageHeader, AdminPanel, AdminStatusBadge } from "./_components/admin-ui";
import { adminSettings } from "./admin-data";
import {
  getCurrentWeekday,
  getDefaultWeeklyOfferCalendarSettings,
  getWeeklyOfferCalendarSettings,
  isOfferActiveToday,
  resetWeeklyOfferCalendarSettings,
  saveWeeklyOfferCalendarSettings,
  scheduledOfferDays,
  type ScheduledOfferDay,
  type WeeklyOffer,
} from "@/lib/dailyOffer";

const dayLabels: Record<ScheduledOfferDay, string> = {
  sunday: "Sunday",
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
};

export default function AdminSettings() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <AdminPageHeader
          title="Settings"
          description="Frontend-only settings scaffold. These cards reserve space for future store configuration."
        />

        <div className="grid gap-4 lg:grid-cols-2">
          {adminSettings.map((setting) => (
            <AdminPanel key={setting.label} title={setting.label} description={setting.detail}>
              <AdminStatusBadge tone={setting.tone}>{setting.value}</AdminStatusBadge>
            </AdminPanel>
          ))}
        </div>

        <DailyOfferSettingsPanel />

        <section className="rounded-lg border border-dashed border-[#D4A72C]/45 bg-white p-6 text-sm leading-6 text-[#717182]">
          Future backend settings can be added here without touching public store pages or customer account screens.
        </section>
      </div>
    </AdminLayout>
  );
}

function DailyOfferSettingsPanel() {
  const [offers, setOffers] = useState<WeeklyOffer[]>(() => getWeeklyOfferCalendarSettings());
  const [selectedDay, setSelectedDay] = useState<ScheduledOfferDay>(() => getCurrentWeekday());
  const [saved, setSaved] = useState(false);
  const currentDay = useMemo(() => getCurrentWeekday(), []);
  const todayOffer = useMemo(
    () => offers.find((offer) => offer.day === currentDay) ?? null,
    [currentDay, offers]
  );
  const selectedOffer = useMemo(
    () =>
      offers.find((offer) => offer.day === selectedDay) ??
      getDefaultWeeklyOfferCalendarSettings().find((offer) => offer.day === selectedDay)!,
    [offers, selectedDay]
  );
  const isActiveToday = todayOffer ? isOfferActiveToday(todayOffer) : false;
  const statusTone = todayOffer?.enabled ? (isActiveToday ? "green" : "amber") : "slate";
  const statusLabel = todayOffer?.enabled ? (isActiveToday ? "Today's offer active" : "Scheduled") : "Today's offer disabled";

  const getOfferForDay = (sourceOffers: WeeklyOffer[], day: ScheduledOfferDay) =>
    sourceOffers.find((offer) => offer.day === day) ??
    getDefaultWeeklyOfferCalendarSettings().find((offer) => offer.day === day)!;

  const updateSelectedOffer = (updates: Partial<WeeklyOffer>) => {
    setSaved(false);
    setOffers((currentOffers) =>
      scheduledOfferDays.map((day) => {
        const offer = getOfferForDay(currentOffers, day);
        return day === selectedDay ? { ...offer, ...updates, day } : offer;
      })
    );
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const defaults = getDefaultWeeklyOfferCalendarSettings();
    const nextOffers = scheduledOfferDays.map((day) => {
      const fallback = defaults.find((offer) => offer.day === day)!;
      const offer = getOfferForDay(offers, day);

      return {
        ...offer,
        id: offer.id.trim() || fallback.id,
        day,
        badgeEn: offer.badgeEn?.trim() || fallback.badgeEn,
        badgeAr: offer.badgeAr?.trim(),
        eyebrowEn: offer.eyebrowEn?.trim() || fallback.eyebrowEn,
        eyebrowAr: offer.eyebrowAr?.trim(),
        titleEn: offer.titleEn?.trim() || fallback.titleEn,
        titleAr: offer.titleAr?.trim(),
        descriptionEn: offer.descriptionEn?.trim() || fallback.descriptionEn,
        descriptionAr: offer.descriptionAr?.trim(),
        ctaUrl: offer.ctaUrl.trim() || fallback.ctaUrl,
      };
    });

    saveWeeklyOfferCalendarSettings(nextOffers);
    setOffers(nextOffers);
    setSaved(true);
  };

  const handleReset = () => {
    resetWeeklyOfferCalendarSettings();
    setOffers(getDefaultWeeklyOfferCalendarSettings());
    setSelectedDay(getCurrentWeekday());
    setSaved(false);
  };

  return (
    <AdminPanel
      title="Weekly Offers"
      description="Frontend-only daily offer calendar. This local source can be replaced by an API later."
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="inline-flex items-center gap-2 text-sm font-semibold text-[#050505]">
            <input
              type="checkbox"
              checked={selectedOffer.enabled}
              onChange={(event) => updateSelectedOffer({ enabled: event.target.checked })}
              className="h-4 w-4 rounded border-[#050505]/20 text-[#D4A72C] focus:ring-[#D4A72C]"
            />
            Enable {dayLabels[selectedDay]} offer
          </label>

          <AdminStatusBadge tone={statusTone}>{statusLabel}</AdminStatusBadge>
        </div>

        <div className="flex flex-wrap gap-2" aria-label="Select weekday offer">
          {scheduledOfferDays.map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => {
                setSaved(false);
                setSelectedDay(day);
              }}
              className={`inline-flex h-10 items-center rounded-lg border px-3 text-sm font-semibold transition ${
                day === selectedDay
                  ? "border-[#D4A72C] bg-[#FFF7D6] text-[#050505]"
                  : "border-[#050505]/10 bg-white text-[#717182] hover:border-[#D4A72C]/60 hover:text-[#050505]"
              }`}
            >
              {dayLabels[day]}
            </button>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <AdminTextField
            label="English eyebrow"
            value={selectedOffer.eyebrowEn ?? ""}
            placeholder="Uses default site translation"
            onChange={(value) => updateSelectedOffer({ eyebrowEn: value })}
          />
          <AdminTextField
            label="Arabic eyebrow"
            value={selectedOffer.eyebrowAr ?? ""}
            placeholder="Uses default site translation"
            onChange={(value) => updateSelectedOffer({ eyebrowAr: value })}
          />
          <AdminTextField
            label="English title"
            value={selectedOffer.titleEn ?? ""}
            placeholder="Uses default site translation"
            onChange={(value) => updateSelectedOffer({ titleEn: value })}
          />
          <AdminTextField
            label="Arabic title"
            value={selectedOffer.titleAr ?? ""}
            placeholder="Uses default site translation"
            onChange={(value) => updateSelectedOffer({ titleAr: value })}
          />
          <AdminTextArea
            label="English description"
            value={selectedOffer.descriptionEn ?? ""}
            placeholder="Uses default site translation"
            onChange={(value) => updateSelectedOffer({ descriptionEn: value })}
          />
          <AdminTextArea
            label="Arabic description"
            value={selectedOffer.descriptionAr ?? ""}
            placeholder="Uses default site translation"
            onChange={(value) => updateSelectedOffer({ descriptionAr: value })}
          />
          <AdminTextField
            label="English discount badge"
            value={selectedOffer.badgeEn ?? ""}
            onChange={(value) => updateSelectedOffer({ badgeEn: value })}
          />
          <AdminTextField
            label="Arabic discount badge"
            value={selectedOffer.badgeAr ?? ""}
            placeholder="Uses default site translation"
            onChange={(value) => updateSelectedOffer({ badgeAr: value })}
          />
          <AdminTextField
            label="CTA URL"
            value={selectedOffer.ctaUrl}
            onChange={(value) => updateSelectedOffer({ ctaUrl: value })}
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="submit"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[#F9DC5C] px-4 text-sm font-semibold text-[#050505] shadow-sm transition-[transform,background-color,box-shadow] duration-200 ease-out hover:-translate-y-[1px] hover:bg-[#D4A72C] active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[#D4A72C]/45 focus:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100"
          >
            Save weekly offers
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-[#050505]/10 bg-white px-4 text-sm font-semibold text-[#050505] transition hover:border-[#D4A72C]/60 hover:bg-[#FFF7D6] focus:outline-none focus:ring-2 focus:ring-[#D4A72C]/35 focus:ring-offset-2"
          >
            Reset to default
          </button>
          {saved && (
            <span className="text-sm font-semibold text-[#16803C]">
              Saved locally.
            </span>
          )}
        </div>
      </form>
    </AdminPanel>
  );
}

function AdminTextField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm font-semibold text-[#050505]">
      {label}
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-11 w-full rounded-lg border border-[#050505]/10 bg-white px-3 text-sm text-[#050505] outline-none transition placeholder:text-[#9A9A9A] focus:border-[#D4A72C]/60 focus:ring-4 focus:ring-[#F9DC5C]/20"
      />
    </label>
  );
}

function AdminTextArea({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm font-semibold text-[#050505]">
      {label}
      <textarea
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        className="mt-2 w-full resize-none rounded-lg border border-[#050505]/10 bg-white px-3 py-2 text-sm leading-6 text-[#050505] outline-none transition placeholder:text-[#9A9A9A] focus:border-[#D4A72C]/60 focus:ring-4 focus:ring-[#F9DC5C]/20"
      />
    </label>
  );
}
