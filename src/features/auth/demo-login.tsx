"use client";

import { useState } from "react";
import { Factory, Loader2, Sprout } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import type { DemoRole } from "@/features/auth/demo-accounts";
import { requestDemoLogin } from "@/features/auth/demo-request";
import { ApButton } from "@/shared/components/brand";

const BUTTONS = {
  farmer: { labelKey: "demoFarmer", Icon: Sprout },
  mill: { labelKey: "demoMill", Icon: Factory },
} as const;

/** "Try as … (demo)" buttons. `roles` comes from the server; renders nothing when it is empty. */
export function DemoLogin({ roles }: { roles: DemoRole[] }) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [pending, setPending] = useState<DemoRole | null>(null);

  if (roles.length === 0) return null;

  async function onDemo(role: DemoRole) {
    setPending(role);
    const result = await requestDemoLogin(role, locale);
    if (!result.ok) {
      setPending(null);
      toast.error(t(result.errorKey));
      return;
    }
    // Full page load, so the app starts fresh with the new session cookies. Stays in loading state.
    window.location.assign(result.redirectTo);
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-2">
      {roles.map((role) => {
        const { labelKey, Icon } = BUTTONS[role];
        const busy = pending === role;
        return (
          <ApButton
            key={role}
            variant="outline"
            className="w-full"
            disabled={pending !== null}
            onClick={() => void onDemo(role)}
            icon={
              busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Icon className="size-4" aria-hidden />
            }
            label={busy ? t("loading") : t(labelKey)}
          />
        );
      })}
    </div>
  );
}
