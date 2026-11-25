"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Globe, Loader2 } from "lucide-react";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/core/config/constants";
import { tryCreateBrowserClient } from "@/core/supabase/safe-client";
import { ApButton } from "@/shared/components/brand/ap-button";
import { ApCard } from "@/shared/components/brand/ap-card";
import { usePathname, useRouter } from "@/shared/i18n/navigation";
import { useErrorMessage } from "@/shared/lib/error-message";
import { cn } from "@/shared/lib/utils";
import { PageHeader, TextField } from "./processor-kit";

export function ProcessorSettingsScreen() {
  const t = useTranslations("processorNav");
  const tAuth = useTranslations("auth");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const errMsg = useErrorMessage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [prefLocale, setPrefLocale] = useState<Locale>(
    locale === "tr" || locale === "en" || locale === "el" ? (locale as Locale) : DEFAULT_LOCALE,
  );

  useEffect(() => {
    const supabase = tryCreateBrowserClient();
    if (!supabase) {
      setLoading(false);
      return;
    }
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("company_name, display_name, locale")
        .eq("id", user.id)
        .maybeSingle();
      if (data?.company_name) setCompanyName(data.company_name);
      if (data?.display_name) setDisplayName(data.display_name);
      if (data?.locale === "el" || data?.locale === "en" || data?.locale === "tr") {
        setPrefLocale(data.locale);
      }
      setLoading(false);
    })();
  }, []);

  async function onSave() {
    const supabase = tryCreateBrowserClient();
    if (!supabase) {
      toast.error(tAuth("missingSupabase"));
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error(t("processorFallback"));
      router.replace("/login");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        company_name: companyName.trim() || null,
        display_name: displayName.trim() || null,
        locale: prefLocale,
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error(errMsg(error.message, "actionFailed"));
      return;
    }
    toast.success(t("settingsSaved"));
    if (prefLocale !== locale) {
      router.replace(pathname, { locale: prefLocale });
    }
  }

  function onPickLocale(next: Locale) {
    setPrefLocale(next);
    if (next !== locale) {
      router.replace(pathname, { locale: next });
    }
  }

  return (
    <div className="mx-auto w-full max-w-[640px] space-y-4">
      <PageHeader title={t("settings")} subtitle={t("settingsSubtitle")} />

      {loading ? (
        <div className="flex items-center gap-2 text-[13px] font-semibold text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {tAuth("loading")}
        </div>
      ) : (
        <ApCard className="space-y-4 p-4">
          <TextField label={t("companyName")} value={companyName} onChange={setCompanyName} />
          <TextField label={t("displayName")} value={displayName} onChange={setDisplayName} />

          <div className="space-y-2">
            <p className="flex items-center gap-2 text-[12px] font-bold tracking-wide text-muted-foreground uppercase">
              <Globe className="size-3.5" aria-hidden />
              {t("language")}
            </p>
            <div className="flex gap-1.5">
              {LOCALES.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => onPickLocale(code)}
                  className={cn(
                    "h-11 flex-1 rounded-full border text-[13px] font-bold uppercase transition-colors",
                    prefLocale === code
                      ? "border-ink bg-ink text-white"
                      : "border-line bg-card text-ink hover:bg-soft",
                  )}
                >
                  {code}
                </button>
              ))}
            </div>
          </div>

          <ApButton
            label={saving ? tAuth("loading") : t("saveSettings")}
            onClick={() => void onSave()}
            disabled={saving}
            className="w-full"
          />
        </ApCard>
      )}
    </div>
  );
}
