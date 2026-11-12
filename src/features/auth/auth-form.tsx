"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { tryCreateBrowserClient } from "@/core/supabase/safe-client";
import type { UserRole } from "@/core/config/constants";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { useRouter } from "@/shared/i18n/navigation";
import { toast } from "sonner";

export function AuthForm({ mode = "login" }: { mode?: "login" | "register" }) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [role, setRole] = useState<UserRole>("farmer");
  const [loading, setLoading] = useState(false);

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    const supabase = tryCreateBrowserClient();
    if (!supabase) {
      toast.error(t("missingSupabase"));
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("loginOk"));
    router.push(role === "processor" ? "/processor/overview" : "/farmer/dashboard");
  }

  async function onRegister(e: React.FormEvent) {
    e.preventDefault();
    const supabase = tryCreateBrowserClient();
    if (!supabase) {
      toast.error(t("missingSupabase"));
      return;
    }
    if (role === "processor" && !companyName.trim()) {
      toast.error(t("companyRequired"));
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role,
          locale,
          display_name: displayName || email.split("@")[0],
          company_name: role === "processor" ? companyName : null,
        },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("registerOk"));
    router.push(role === "processor" ? "/processor/overview" : "/farmer/dashboard");
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{mode === "login" ? t("loginTitle") : t("registerTitle")}</CardTitle>
        <CardDescription>{t("subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs
          value={role}
          onValueChange={(v) => setRole(v as UserRole)}
          className="mb-4"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="farmer">{t("roleFarmer")}</TabsTrigger>
            <TabsTrigger value="processor">{t("roleProcessor")}</TabsTrigger>
          </TabsList>
          <TabsContent value="farmer" />
          <TabsContent value="processor" />
        </Tabs>

        <form onSubmit={mode === "login" ? onLogin : onRegister} className="space-y-3">
          {mode === "register" ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="name">{t("displayName")}</Label>
                <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </div>
              {role === "processor" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="company">{t("companyName")}</Label>
                  <Input
                    id="company"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    required
                  />
                </div>
              ) : null}
            </>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="email">{t("email")}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">{t("password")}</Label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t("loading") : mode === "login" ? t("loginCta") : t("registerCta")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
