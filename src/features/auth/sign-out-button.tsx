"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { tryCreateBrowserClient } from "@/core/supabase/safe-client";
import { useRouter } from "@/shared/i18n/navigation";
import { Button } from "@/shared/components/ui/button";

export function SignOutButton({ className }: { className?: string }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onSignOut() {
    const supabase = tryCreateBrowserClient();
    if (!supabase) {
      toast.error(t("missingSupabase"));
      return;
    }
    setLoading(true);
    await supabase.auth.signOut();
    setLoading(false);
    router.replace("/login");
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={className}
      disabled={loading}
      onClick={onSignOut}
    >
      <LogOut className="size-4" aria-hidden />
      {loading ? t("loading") : t("logout")}
    </Button>
  );
}
