"use client";

import { useLocale } from "next-intl";
import { varietyLabel } from "@/features/fields/olive-varieties";

export function useVarietyLabel() {
  const locale = useLocale();
  return (slug: string) => varietyLabel(slug, locale);
}

