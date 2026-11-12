"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/shared/i18n/navigation";
import { LOCALES, type Locale } from "@/core/config/constants";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";

const LABELS: Record<Locale, string> = {
  el: "Ελληνικά",
  tr: "Türkçe",
  en: "English",
};

export function LocaleSwitcher() {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();

  return (
    <Select
      value={locale}
      onValueChange={(next) => {
        router.replace(pathname, { locale: next as Locale });
      }}
    >
      <SelectTrigger className="w-[140px]" aria-label="Language">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {LOCALES.map((code) => (
          <SelectItem key={code} value={code}>
            {LABELS[code]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
