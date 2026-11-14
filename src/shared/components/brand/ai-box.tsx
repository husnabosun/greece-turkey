"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { colors } from "@/shared/theme/tokens";

export function AIBox({ title, children, className }: { title: string; children?: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-card border border-line bg-card p-3", className)}>
      <div className="flex items-center gap-2">
        <Sparkles className="size-3.5" style={{ color: colors.good }} aria-hidden />
        <p className="text-ap-body font-bold text-good">{title}</p>
      </div>
      {typeof children === "string" ? (
        <p className="mt-1.5 text-ap-body font-medium text-ink">{children}</p>
      ) : (
        children
      )}
    </div>
  );
}

export function AiTag({ source, className }: { source: "gemini" | "model" | "demo"; className?: string }) {
  const t = useTranslations("common");
  if (source === "demo") {
    return (
      <span className={cn("inline-flex h-6 items-center self-start rounded-full bg-warn-soft px-2.5 text-ap-small font-bold text-warn-text", className)}>
        {t("aiDemo")}
      </span>
    );
  }
  return (
    <span className={cn("inline-flex h-6 items-center gap-1 self-start rounded-full bg-good-soft px-2.5 text-ap-small font-bold text-good", className)}>
      <Sparkles className="size-2.5" aria-hidden />
      {source === "gemini" ? t("aiGemini") : t("aiModel")}
    </span>
  );
}

export function PrivacyLine({ className }: { className?: string }) {
  const t = useTranslations("farmerScan");
  return (
    <p className={cn("text-center text-ap-small font-medium text-muted-foreground", className)}>
      {t("privacy")}
    </p>
  );
}
