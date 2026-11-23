"use client";

import { useState } from "react";
import { Check, Eye, EyeOff, Factory, Loader2, Sprout } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { tryCreateBrowserClient } from "@/core/supabase/safe-client";
import { authErrorKey, type AuthErrorKey, type AuthErrorLike } from "@/features/auth/auth-errors";
import { homePathForRole } from "@/core/auth/routing";
import type { UserRole } from "@/core/config/constants";
import { ApButton, ApCard } from "@/shared/components/brand";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { useRouter } from "@/shared/i18n/navigation";
import { cn } from "@/shared/lib/utils";
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

/** Localised message for an auth failure; never the raw (English) server text. */
function authErrorMessage(
  error: AuthErrorLike | null | undefined,
  t: (key: AuthErrorKey) => string,
  fallback: "registerFailed" | "signInFailed" = "signInFailed",
) {
  return t(authErrorKey(error, fallback));
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
      | { error?: string; code?: string }
      | null;
    if (!registerRes.ok) {
      setLoading(false);
      toast.error(authErrorMessage({ message: registerJson?.error, code: registerJson?.code }, t, "registerFailed"));
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

  const inputClass = "h-11 rounded-xl px-3";

  return (
    <ApCard className="w-full max-w-md p-5">
      <h1 className="text-[20px] font-extrabold tracking-tight text-ink">{mode === "login" ? t("loginTitle") : t("registerTitle")}</h1>
      <p className="mt-0.5 text-ap-small text-muted-foreground">
        {mode === "login" ? t("loginSubtitle") : t("registerSubtitle")}
      </p>

      {mode === "register" ? (
        <div role="radiogroup" aria-label={t("registerTitle")} className="mt-4 grid grid-cols-2 gap-2">
          {(
            [
              { id: "farmer", label: t("roleFarmer"), Icon: Sprout },
              { id: "processor", label: t("roleProcessor"), Icon: Factory },
            ] as const
          ).map(({ id, label, Icon }) => {
            const on = role === id;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setRole(id)}
                className={cn(
                  "relative flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 py-3 text-center transition-colors",
                  on ? "border-ink bg-ink text-white" : "border-line bg-card text-ink hover:bg-soft",
                )}
              >
                {on ? (
                  <span className="absolute top-2 right-2 flex size-5 items-center justify-center rounded-full bg-white text-ink">
                    <Check className="size-3" strokeWidth={3} aria-hidden />
                  </span>
                ) : null}
                <Icon className="size-6" aria-hidden />
                <span className="text-ap-body font-bold">{label}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      <form
        onSubmit={mode === "login" ? onLogin : onRegister}
        className="mt-4 space-y-3"
        autoComplete="on"
        noValidate
      >
        {mode === "register" ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="name">{t("displayName")}</Label>
              <Input
                id="name"
                name="display_name"
                autoComplete="name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className={inputClass}
              />
            </div>
            {role === "processor" ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="company">{t("companyName")}</Label>
                  <Input
                    id="company"
                    name="company_name"
                    autoComplete="organization"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    required
                    className={inputClass}
                  />
                </div>
              </>
            ) : null}
          </>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="email">{t("email")}</Label>
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
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
              className={cn(inputClass, "pr-12")}
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-muted-foreground hover:text-foreground"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? t("hidePassword") : t("showPassword")}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff className="size-[18px]" aria-hidden /> : <Eye className="size-[18px]" aria-hidden />}
            </button>
          </div>
        </div>

        <ApButton
          type="submit"
          variant="dark"
          className="mt-1 w-full"
          disabled={loading}
          icon={loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          label={loading ? t("loading") : mode === "login" ? t("loginCta") : t("registerCta")}
        />
      </form>
    </ApCard>
  );
}
