"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { tryCreateBrowserClient } from "@/core/supabase/safe-client";
import { homePathForRole } from "@/core/auth/routing";
import type { UserRole } from "@/core/config/constants";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { useRouter } from "@/shared/i18n/navigation";
import { toast } from "sonner";

async function resolveHomePath(
  supabase: NonNullable<ReturnType<typeof tryCreateBrowserClient>>,
  fallbackRole?: UserRole,
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return homePathForRole(fallbackRole ?? "farmer");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role =
    profile?.role === "farmer" || profile?.role === "processor"
      ? profile.role
      : ((user.user_metadata?.role as UserRole | undefined) ?? fallbackRole ?? "farmer");

  return homePathForRole(role);
}

/** Read from the live DOM so browser autofill is not lost (React state often stays empty). */
function credentialsFromForm(form: HTMLFormElement) {
  const data = new FormData(form);
  const email = String(data.get("email") ?? "").trim().toLowerCase();
  const password = String(data.get("password") ?? "");
  const displayName = String(data.get("display_name") ?? "").trim();
  const companyName = String(data.get("company_name") ?? "").trim();
  return { email, password, displayName, companyName };
}

function authErrorMessage(error: { message: string; code?: string }, t: (key: string) => string) {
  const code = error.code ?? "";
  const msg = error.message.toLowerCase();
  if (code === "invalid_credentials" || msg.includes("invalid login credentials")) {
    return t("invalidCredentials");
  }
  return error.message;
}

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
  const [showPassword, setShowPassword] = useState(false);

  async function onLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const supabase = tryCreateBrowserClient();
    if (!supabase) {
      toast.error(t("missingSupabase"));
      return;
    }
    const { email: loginEmail, password: loginPassword } = credentialsFromForm(e.currentTarget);
    if (!loginEmail || !loginPassword) {
      toast.error(t("invalidCredentials"));
      return;
    }
    setEmail(loginEmail);
    setPassword(loginPassword);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });
    if (error) {
      setLoading(false);
      toast.error(authErrorMessage(error, t));
      return;
    }
    const home = await resolveHomePath(supabase);
    setLoading(false);
    toast.success(t("loginOk"));
    router.replace(home);
  }

  async function onRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const supabase = tryCreateBrowserClient();
    if (!supabase) {
      toast.error(t("missingSupabase"));
      return;
    }
    const {
      email: regEmail,
      password: regPassword,
      displayName: regName,
      companyName: regCompany,
    } = credentialsFromForm(e.currentTarget);
    if (role === "processor" && !regCompany) {
      toast.error(t("companyRequired"));
      return;
    }
    if (!regEmail || !regPassword) {
      toast.error(t("invalidCredentials"));
      return;
    }
    setEmail(regEmail);
    setPassword(regPassword);
    setDisplayName(regName);
    setCompanyName(regCompany);
    setLoading(true);

    // Server creates an already-confirmed user (no email gate), then we sign in.
    const registerRes = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: regEmail,
        password: regPassword,
        role,
        locale,
        display_name: regName || regEmail.split("@")[0],
        company_name: role === "processor" ? regCompany : null,
      }),
    });
    const registerJson = (await registerRes.json().catch(() => null)) as
      | { error?: string }
      | null;
    if (!registerRes.ok) {
      setLoading(false);
      toast.error(registerJson?.error || t("registerFailed"));
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: regEmail,
      password: regPassword,
    });
    if (signInError) {
      setLoading(false);
      toast.error(authErrorMessage(signInError, t));
      return;
    }

    await new Promise((r) => setTimeout(r, 250));
    const home = await resolveHomePath(supabase, role);
    setLoading(false);
    toast.success(t("registerOk"));
    router.replace(home);
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{mode === "login" ? t("loginTitle") : t("registerTitle")}</CardTitle>
        <CardDescription>{mode === "login" ? t("loginSubtitle") : t("registerSubtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        {mode === "register" ? (
          <Tabs value={role} onValueChange={(v) => setRole(v as UserRole)} className="mb-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="farmer">{t("roleFarmer")}</TabsTrigger>
              <TabsTrigger value="processor">{t("roleProcessor")}</TabsTrigger>
            </TabsList>
            <TabsContent value="farmer" />
            <TabsContent value="processor" />
          </Tabs>
        ) : null}

        <form onSubmit={mode === "login" ? onLogin : onRegister} className="space-y-3" autoComplete="on">
          {mode === "register" ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="name">{t("displayName")}</Label>
                <Input
                  id="name"
                  name="display_name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
              {role === "processor" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="company">{t("companyName")}</Label>
                  <Input
                    id="company"
                    name="company_name"
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
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">{t("password")}</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? t("hidePassword") : t("showPassword")}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden />
                )}
              </button>
            </div>
          </div>


          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t("loading") : mode === "login" ? t("loginCta") : t("registerCta")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
