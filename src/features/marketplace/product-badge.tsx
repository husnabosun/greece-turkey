"use client";

import { Droplet, Leaf } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import type { OilCategory, OilStorage, ProductKind } from "@/shared/types/database";

export const OIL_CATEGORIES: OilCategory[] = ["extra_virgin", "virgin", "lampante"];
export const OIL_STORAGES: OilStorage[] = ["tank", "ibc", "tins", "bottles"];

export function productI18nKey(product: ProductKind): "productOil" | "productOlives" {
  return product === "oil" ? "productOil" : "productOlives";
}

export function oilCategoryI18nKey(cat: OilCategory): "extraVirgin" | "virgin" | "lampante" {
  if (cat === "extra_virgin") return "extraVirgin";
  if (cat === "virgin") return "virgin";
  return "lampante";
}

export function oilStorageI18nKey(
  storage: OilStorage,
): "storageTank" | "storageDrum" | "storageTins" | "storageBottle" {
  if (storage === "tank") return "storageTank";
  if (storage === "ibc") return "storageDrum";
  if (storage === "tins") return "storageTins";
  return "storageBottle";
}

/** Amber oil badge / green olives badge — oil gets visual priority. */
export function ProductBadge({
  product,
  label,
  className,
}: {
  product: ProductKind;
  label: string;
  className?: string;
}) {
  const oil = product === "oil";
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2.5 text-[11px] leading-none font-extrabold tracking-wide",
        oil ? "bg-[#F3E6C8] text-[#8A6A1F]" : "bg-good-soft text-good",
        className,
      )}
    >
      {oil ? <Droplet className="size-3 shrink-0" aria-hidden /> : <Leaf className="size-3 shrink-0" aria-hidden />}
      {label}
    </span>
  );
}
