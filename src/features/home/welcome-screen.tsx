"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Globe, Loader2, MapPin, Sprout } from "lucide-react";
import { LOCALES, type Locale } from "@/core/config/constants";
import { tryCreateBrowserClient } from "@/core/supabase/safe-client";
import { Link, usePathname, useRouter } from "@/shared/i18n/navigation";
import { cn } from "@/shared/lib/utils";
import { useErrorMessage } from "@/shared/lib/error-message";

const REGIONS_GR = [
  { id: "north-aegean", el: "Βόρειο Αιγαίο", en: "North Aegean", tr: "Kuzey Ege" },
  { id: "crete", el: "Κρήτη", en: "Crete", tr: "Girit" },
  { id: "peloponnese", el: "Πελοπόννησος", en: "Peloponnese", tr: "Mora" },
  { id: "central-greece", el: "Στερεά Ελλάδα", en: "Central Greece", tr: "Orta Yunanistan" },
] as const;

const REGIONS_TR = [
  { id: "izmir", el: "Σμύρνη", en: "İzmir", tr: "İzmir" },
  { id: "aydin", el: "Αϊδίνιο", en: "Aydın", tr: "Aydın" },
  { id: "mugla", el: "Μούγλα", en: "Muğla", tr: "Muğla" },
  { id: "balikesir", el: "Μπαλικεσίρ", en: "Balıkesir", tr: "Balıkesir" },
] as const;

type Step = 1 | 2 | 3;

/** 3-step farmer onboarding (Β10): country/region → first field → language. */
const STEP_KEY = "ap_onboarding_step";

export function WelcomeScreen() {
  const t = useTranslations("farmerWelcome");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const errMsg = useErrorMessage();
  // Step survives the language switch (router.replace remounts) and a page refresh.
  const [step, setStepState] = useState<Step>(1);
  useEffect(() => {
    try {
      const n = Number(window.sessionStorage.getItem(STEP_KEY));
      if (n === 2 || n === 3) setStepState(n as Step);
    } catch {
      /* ignore */
    }
  }, []);
  const setStep = (n: Step) => {
    setStepState(n);
    try {
      window.sessionStorage.setItem(STEP_KEY, String(n));
    } catch {
      /* ignore */
    }
  };
  const nameTouched = useRef(false);
  const [country, setCountry] = useState<"GR" | "TR">("GR");
  const [regionId, setRegionId] = useState<string>("north-aegean");
  const [displayName, setDisplayName] = useState("");
  const [notifyOffers, setNotifyOffers] = useState(true);
  const [notifyRisk, setNotifyRisk] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prefLocale, setPrefLocale] = useState<Locale>(
    locale === "tr" || locale === "en" || locale === "el" ? locale : "el",
  );

  useEffect(() => {
    const supabase = tryCreateBrowserClient();
    if (!supabase) return;
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const prefs = (user.user_metadata as { notify_prefs?: { offers?: boolean; risk?: boolean } } | null)
        ?.notify_prefs;
      if (prefs) {
        if (typeof prefs.offers === "boolean") setNotifyOffers(prefs.offers);
        if (typeof prefs.risk === "boolean") setNotifyRisk(prefs.risk);
      }
      const { data } = await supabase
        .from("profiles")
        .select("display_name, country, place, locale")
        .eq("id", user.id)
        .maybeSingle();
      // Never overwrite what the farmer already started typing.
      if (data?.display_name && !nameTouched.current) setDisplayName(data.display_name);
      if (data?.country === "GR" || data?.country === "TR") {
        setCountry(data.country);
        const list = data.country === "TR" ? REGIONS_TR : REGIONS_GR;
        const saved = list.find(
          (r) => data.place && [r.el, r.en, r.tr].some((l) => l === data.place),
        );
        setRegionId(saved?.id ?? (data.country === "TR" ? "izmir" : "north-aegean"));
      }
      if (data?.locale === "el" || data?.locale === "en" || data?.locale === "tr") {
        setPrefLocale(data.locale);
      }
    })();
  }, []);

  const regions = country === "TR" ? REGIONS_TR : REGIONS_GR;
  const regionLabel = (id: string) => {
    const row = [...REGIONS_GR, ...REGIONS_TR].find((r) => r.id === id);
    if (!row) return id;
    if (locale.startsWith("tr")) return row.tr;
    if (locale.startsWith("en")) return row.en;
    return row.el;
  };

  async function saveProfile() {
    const supabase = tryCreateBrowserClient();
    if (!supabase) {
      toast.error(t("needSupabase"));
      return false;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error(t("needLogin"));
      return false;
    }
    const place = regionLabel(regionId);
    const name = displayName.trim().slice(0, 80);
    const { error } = await supabase
      .from("profiles")
      .update({
        country,
        place,
        locale: prefLocale,
        // Empty input keeps the existing name instead of wiping it.
        ...(name ? { display_name: name } : {}),
      })
      .eq("id", user.id);
    if (error) {
      toast.error(errMsg(error.message, "saveFailed"));
      return false;
    }
    // Notification prefs follow the account (all devices), not just this browser.
    await supabase.auth
      .updateUser({ data: { notify_prefs: { offers: notifyOffers, risk: notifyRisk } } })
      .catch(() => undefined);
    try {
      localStorage.setItem(
        "ap_notify_prefs",
        JSON.stringify({ offers: notifyOffers, risk: notifyRisk, onboardingDone: true }),
      );
    } catch {
      /* ignore */
    }
    return true;
  }

  async function finish() {
    setSaving(true);
    try {
      const ok = await saveProfile();
      if (!ok) return;
      toast.success(t("done"));
      try {
        window.sessionStorage.removeItem(STEP_KEY);
      } catch {
        /* ignore */
      }
      if (prefLocale !== locale) {
        router.replace("/farmer/fields/new", { locale: prefLocale });
      } else {
        router.replace("/farmer/fields/new");
      }
    } finally {
      setSaving(false);
    }
  }

  function switchLocale(next: Locale) {
    setPrefLocale(next);
    if (next !== locale) {
      router.replace(pathname, { locale: next });
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 py-6 pb-[calc(5rem+env(safe-area-inset-bottom))] md:max-w-xl md:px-6">
      <p className="text-ap-small font-bold tracking-[1px] text-muted-foreground uppercase">
        {t("step", { n: step, total: 3 })}
      </p>
      <h1 className="mt-1 text-[28px] leading-tight font-extrabold tracking-tight text-ink">{t("title")}</h1>
      <p className="mt-1 text-ap-body text-muted-foreground">{t(`step${step}Hint`)}</p>

      <div
        className="mt-4 flex gap-1.5"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={3}
        aria-valuenow={step}
        aria-label={t("step", { n: step, total: 3 })}
      >
        {([1, 2, 3] as const).map((n) => (
          <i
            key={n}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors duration-300",
              n < step ? "bg-good" : n === step ? "bg-ink" : "bg-line",
            )}
            aria-hidden
          />
        ))}
      </div>

      {step === 1 ? (
        <div className="mt-6 space-y-4">
          <label className="block space-y-1.5">
            <span className="text-ap-small font-bold text-muted-foreground uppercase">{t("yourName")}</span>
            <input
              value={displayName}
              onChange={(e) => {
                nameTouched.current = true;
                setDisplayName(e.target.value);
              }}
              maxLength={80}
              autoComplete="name"
              className="h-12 w-full rounded-2xl border border-line bg-card px-4 text-base font-semibold text-ink outline-none focus:border-ink"
              placeholder={t("namePlaceholder")}
            />
          </label>
          <div>
            <p className="mb-2 text-ap-small font-bold text-muted-foreground uppercase">{t("country")}</p>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t("country")}>
              {(
                [
                  ["GR", t("countryGr")],
                  ["TR", t("countryTr")],
                ] as const
              ).map(([code, label]) => (
                <button
                  key={code}
                  type="button"
                  role="radio"
                  aria-checked={country === code}
                  onClick={() => {
                    setCountry(code);
                    setRegionId(code === "TR" ? "izmir" : "north-aegean");
                  }}
                  className={cn(
                    "flex h-12 items-center justify-center gap-2 rounded-2xl border text-ap-body font-bold",
                    country === code ? "border-ink bg-ink text-white" : "border-line bg-card text-ink",
                  )}
                >
                  {country === code ? <Check className="size-4" aria-hidden /> : <MapPin className="size-4" aria-hidden />}
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-ap-small font-bold text-muted-foreground uppercase">{t("region")}</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label={t("region")}>
              {regions.map((r) => {
                const on = regionId === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setRegionId(r.id)}
                    className={cn(
                      "flex h-12 items-center justify-between gap-2 rounded-2xl border px-4 text-left text-ap-body font-semibold",
                      on ? "border-good/40 bg-good-soft text-good" : "border-line bg-card text-ink",
                    )}
                  >
                    <span className="truncate">{regionLabel(r.id)}</span>
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                        on ? "border-good bg-good text-white" : "border-line",
                      )}
                      aria-hidden
                    >
                      {on ? <Check className="size-3" strokeWidth={3} /> : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="mt-6 rounded-[22px] border border-line bg-card p-5">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-good-soft">
            <Sprout className="size-6 text-good" aria-hidden />
          </div>
          <h2 className="mt-3 text-ap-card font-extrabold text-ink">{t("fieldTitle")}</h2>
          <p className="mt-1 text-ap-body text-muted-foreground">{t("fieldBody")}</p>
          <Link
            href="/farmer/fields/new"
            className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-ink text-ap-btn font-bold text-white"
          >
            {t("drawField")}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          <button
            type="button"
            onClick={() => setStep(3)}
            className="mt-2 flex h-11 w-full items-center justify-center text-ap-body font-semibold text-muted-foreground underline underline-offset-4"
          >
            {t("skipField")}
          </button>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="mt-6 space-y-4">
          <div>
            <p className="mb-2 flex items-center gap-2 text-ap-small font-bold text-muted-foreground uppercase">
              <Globe className="size-3.5" aria-hidden />
              {t("language")}
            </p>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t("language")}>
              {LOCALES.map((code) => (
                <button
                  key={code}
                  type="button"
                  role="radio"
                  aria-checked={prefLocale === code}
                  lang={code}
                  onClick={() => switchLocale(code)}
                  className={cn(
                    "flex h-14 min-w-0 flex-col items-center justify-center rounded-2xl border px-1",
                    prefLocale === code ? "border-ink bg-ink text-white" : "border-line bg-card text-ink",
                  )}
                >
                  <span className="truncate text-ap-body font-bold">{t(`lang_${code}`)}</span>
                  <span className={cn("text-[12px] font-bold uppercase", prefLocale === code ? "text-white/60" : "text-muted-foreground")}>
                    {code}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2 rounded-[18px] border border-line bg-card p-3">
            <p className="text-ap-small font-bold text-muted-foreground uppercase">{t("notifications")}</p>
            <ToggleRow
              label={t("notifyOffers")}
              on={notifyOffers}
              onChange={setNotifyOffers}
            />
            <ToggleRow label={t("notifyRisk")} on={notifyRisk} onChange={setNotifyRisk} />
          </div>
        </div>
      ) : null}

      <div className="sticky bottom-0 -mx-4 mt-auto flex gap-2 bg-gradient-to-t from-background via-background to-background/0 px-4 pt-8 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:-mx-6 md:px-6">
        {step > 1 ? (
          <button
            type="button"
            disabled={saving}
            onClick={() => setStep(step === 1 ? 1 : ((step - 1) as Step))}
            className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-full border border-line bg-card text-ap-btn font-bold text-ink disabled:opacity-50"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {t("back")}
          </button>
        ) : null}
        {step < 3 ? (
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              if (step !== 1) {
                setStep(3);
                return;
              }
              setSaving(true);
              void saveProfile()
                .then((ok) => ok && setStep(2))
                .finally(() => setSaving(false));
            }}
            className="flex h-12 flex-[2] items-center justify-center gap-2 rounded-full bg-ink text-ap-btn font-bold text-white disabled:opacity-50"
          >
            {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {t("continue")}
            {saving ? null : <ArrowRight className="size-4" aria-hidden />}
          </button>
        ) : (
          <button
            type="button"
            disabled={saving}
            onClick={() => void finish()}
            className="flex h-12 flex-[2] items-center justify-center gap-2 rounded-full bg-ink text-ap-btn font-bold text-white disabled:opacity-50"
          >
            {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {saving ? t("saving") : t("finish")}
            {saving ? null : <ArrowRight className="size-4" aria-hidden />}
          </button>
        )}
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex h-11 w-full items-center justify-between rounded-xl px-1 text-left"
    >
      <span className="text-ap-body font-semibold text-ink">{label}</span>
      <span
        className={cn(
          "relative h-6 w-11 rounded-full transition-colors",
          on ? "bg-good" : "bg-line",
        )}
      >
        <i
          className={cn(
            "absolute top-0.5 size-5 rounded-full bg-white transition-transform",
            on ? "translate-x-5" : "translate-x-0.5",
          )}
          aria-hidden
        />
      </span>
    </button>
  );
}
