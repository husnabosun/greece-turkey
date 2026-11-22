import { describe, expect, it } from "vitest";
import { AUTH_ERROR_KEYS, authErrorKey } from "@/features/auth/auth-errors";
import { LOCALES, flattenMessages, loadMessages } from "@/shared/i18n/audit-helpers";

describe("authErrorKey", () => {
  it("maps GoTrue codes and messages", () => {
    expect(authErrorKey({ code: "invalid_credentials", message: "Invalid login credentials" })).toBe("invalidCredentials");
    expect(authErrorKey({ message: "Email not confirmed" })).toBe("emailNotConfirmed");
    expect(authErrorKey({ message: "A user with this email address has already been registered" })).toBe("alreadyRegistered");
    expect(authErrorKey({ code: "email_exists" })).toBe("alreadyRegistered");
    expect(authErrorKey({ message: "Password should be at least 6 characters." })).toBe("weakPassword");
    expect(authErrorKey({ code: "over_request_rate_limit" })).toBe("rateLimited");
    expect(authErrorKey({ status: 429 })).toBe("rateLimited");
    expect(authErrorKey({ message: "Failed to fetch" })).toBe("network");
  });

  it("maps our own register API codes", () => {
    expect(authErrorKey({ code: "company_required" })).toBe("companyRequired");
    expect(authErrorKey({ code: "service_role_missing" })).toBe("missingSupabase");
  });

  it("never returns the raw message: unknown errors use the fallback", () => {
    expect(authErrorKey({ message: "Database error saving new user" })).toBe("signInFailed");
    expect(authErrorKey({ message: "Something odd" }, "registerFailed")).toBe("registerFailed");
    expect(authErrorKey(null)).toBe("signInFailed");
  });
});

describe("auth error messages", () => {
  it("every AuthErrorKey has a message in en, el and tr", () => {
    for (const locale of LOCALES) {
      const flat = flattenMessages(loadMessages(locale));
      for (const key of AUTH_ERROR_KEYS) expect(flat[`auth.${key}`], `${locale}:auth.${key}`).toBeTruthy();
    }
  });
});
