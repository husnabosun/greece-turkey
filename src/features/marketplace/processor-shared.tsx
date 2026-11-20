"use client";

import { useLocale } from "next-intl";
import { varietyLabelFromStored } from "@/features/fields/olive-varieties";

export function useVarietyLabel() {
  const locale = useLocale();
  return (slug: string) => varietyLabelFromStored(slug, locale);
}

