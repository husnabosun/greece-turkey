"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";

/**
 * Maps raw errors (RPC exception names, Postgres codes, fetch failures, our own short codes)
 * to a stable code that has a translation under `errors.action.*`. Never show raw keys to users.
 */
export function errorCode(raw?: string | null): string {
  if (!raw) return "actionFailed";
  const s = String(raw);
  const has = (...needles: string[]) => needles.some((n) => s.includes(n));
  if (has("offer_not_pending", "offerNotPending")) return "offerNotPending";
  if (has("lot_not_listed", "lotAlreadySold", "lot_locked")) return "lotAlreadySold";
  if (has("request_closed")) return "requestClosed";
  if (has("tons_exceed_lot", "tonsExceedLot")) return "tonsExceedLot";
  if (has("invalid_weight", "invalidWeight")) return "invalidWeight";
  if (has("invalid_price", "invalidPrice", "price_range_chk")) return "invalidPrice";
  if (has("invalidTons", "tons_range_chk")) return "invalidTons";
  if (has("lab_failed_blocked", "labFailedBlocked")) return "labFailedBlocked";
  if (has("lab_result_required")) return "labResultRequired";
  if (has("invalid_step", "delivery_locked", "terminal")) return "invalidStep";
  if (has("invalid_date")) return "invalidDate";
  if (has("role_change_forbidden", "forbidden", "row-level security", "42501", "offer_terms_locked", "use_")) return "forbidden";
  if (has("offer_not_found", "not_found", "notFound", "lot_not_found")) return "notFound";
  if (has("duplicate key", "23505")) return "duplicate";
  if (has("check constraint", "23514", "22003")) return "outOfRange";
  if (has("needLogin", "JWT", "not authenticated")) return "needLogin";
  if (has("Failed to fetch", "NetworkError", "network")) return "network";
  if (has("rate_limited", "429")) return "rateLimited";
  if (has("needName")) return "needName";
  if (has("needSupabase")) return "unavailable";
  if (/^[a-zA-Z]+$/.test(s) && s.length < 40) return s;
  return "actionFailed";
}

export function useErrorMessage() {
  const t = useTranslations("errors.action");
  return useCallback(
    (raw?: string | null, fallback: string = "actionFailed") => {
      const code = errorCode(raw);
      if (t.has(code as never)) return t(code as never);
      return t.has(fallback as never) ? t(fallback as never) : t("actionFailed");
    },
    [t],
  );
}
