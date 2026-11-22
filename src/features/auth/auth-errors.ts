/**
 * Maps auth failures (Supabase GoTrue errors, our /api/auth/register codes, fetch failures) to a closed set of
 * keys under the `auth` message namespace, so the user never sees a raw English server message.
 */
export const AUTH_ERROR_KEYS = [
  "invalidCredentials",
  "emailNotConfirmed",
  "alreadyRegistered",
  "weakPassword",
  "invalidEmail",
  "rateLimited",
  "network",
  "companyRequired",
  "missingSupabase",
  "registerFailed",
  "signInFailed",
] as const;

export type AuthErrorKey = (typeof AUTH_ERROR_KEYS)[number];

export type AuthErrorLike = { message?: string | null; code?: string | null; status?: number | null };

export function authErrorKey(
  error: AuthErrorLike | null | undefined,
  fallback: "registerFailed" | "signInFailed" = "signInFailed",
): AuthErrorKey {
  const code = (error?.code ?? "").toLowerCase();
  const msg = (error?.message ?? "").toLowerCase();
  const has = (...needles: string[]) => needles.some((n) => code === n || msg.includes(n));

  if (has("invalid_credentials", "invalid login credentials")) return "invalidCredentials";
  if (has("email_not_confirmed", "email not confirmed")) return "emailNotConfirmed";
  if (has("user_already_exists", "email_exists", "already registered", "already been registered", "already exists"))
    return "alreadyRegistered";
  if (has("weak_password", "password should be", "password is too", "at least 6 characters")) return "weakPassword";
  if (has("email_address_invalid", "validation_failed", "invalid email", "unable to validate email", "invalid_email"))
    return "invalidEmail";
  if (has("over_request_rate_limit", "over_email_send_rate_limit", "rate limit", "too many requests", "security purposes"))
    return "rateLimited" as const;
  if (error?.status === 429) return "rateLimited";
  if (has("failed to fetch", "networkerror", "network request failed", "load failed")) return "network";
  if (has("company_required", "company name is required")) return "companyRequired";
  if (has("service_role_missing", "service role is not configured")) return "missingSupabase";
  return fallback;
}
