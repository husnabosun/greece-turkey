import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { availableDemoRoles } from "@/features/auth/demo-accounts";
import { DEMO_ERROR_KEYS, requestDemoLogin } from "@/features/auth/demo-request";
import { LOCALES, flattenMessages, loadMessages } from "@/shared/i18n/audit-helpers";

const signInWithPassword = vi.fn();

vi.mock("@/core/supabase/server", () => ({
  createClient: async () => ({ auth: { signInWithPassword } }),
}));
vi.mock("@/core/config/env", async (original) => ({
  ...(await original<typeof import("@/core/config/env")>()),
  hasSupabaseConfig: () => true,
}));

import { POST } from "./route";

const post = (body: unknown, contentType = "application/json") =>
  POST(
    new Request("http://localhost/api/auth/demo", {
      method: "POST",
      headers: { "Content-Type": contentType },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

beforeEach(() => {
  vi.stubEnv("DEMO_FARMER_EMAIL", "farmer@demo.test");
  vi.stubEnv("DEMO_FARMER_PASSWORD", "farmer-secret");
  vi.stubEnv("DEMO_MILL_EMAIL", "mill@demo.test");
  vi.stubEnv("DEMO_MILL_PASSWORD", "mill-secret");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  signInWithPassword.mockReset().mockResolvedValue({ error: null });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/auth/demo", () => {
  it("signs the farmer in and points at the localized dashboard", async () => {
    const res = await post({ role: "farmer", locale: "el" });
    expect(res.status).toBe(200);
    expect(signInWithPassword).toHaveBeenCalledWith({ email: "farmer@demo.test", password: "farmer-secret" });
    const text = await res.text();
    expect(JSON.parse(text).data.redirectTo).toBe("/el/farmer/dashboard");
    expect(text).not.toMatch(/demo\.test|secret/);
  });

  it("signs the mill in and points at the processor overview", async () => {
    const res = await post({ role: "mill", locale: "tr" });
    expect(signInWithPassword).toHaveBeenCalledWith({ email: "mill@demo.test", password: "mill-secret" });
    expect((await res.json()).data.redirectTo).toBe("/tr/processor/overview");
  });

  it("falls back to the default locale for an unknown one", async () => {
    const res = await post({ role: "farmer", locale: "//evil.example" });
    expect((await res.json()).data.redirectTo).toBe("/en/farmer/dashboard");
  });

  it("rejects other roles, bad JSON and non-JSON requests without signing in", async () => {
    expect((await post({ role: "admin" })).status).toBe(400);
    expect((await post("{")).status).toBe(400);
    expect((await post("role=farmer", "application/x-www-form-urlencoded")).status).toBe(415);
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("is unavailable when a variable is missing", async () => {
    vi.stubEnv("DEMO_MILL_PASSWORD", "");
    expect((await post({ role: "mill" })).status).toBe(404);
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("reports a failed sign-in without leaking credentials", async () => {
    signInWithPassword.mockResolvedValue({ error: { status: 400, code: "invalid_credentials", message: "x" } });
    const res = await post({ role: "farmer" });
    expect(res.status).toBe(401);
    expect(await res.text()).not.toMatch(/demo\.test|secret/);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toMatch(/demo\.test|secret/);
  });

  it("passes a rate limit through and survives a thrown error", async () => {
    signInWithPassword.mockResolvedValue({ error: { status: 429 } });
    expect((await post({ role: "farmer" })).status).toBe(429);
    signInWithPassword.mockRejectedValue(new Error("down"));
    expect((await post({ role: "farmer" })).status).toBe(502);
  });
});

describe("availableDemoRoles (which buttons show)", () => {
  it("lists only fully configured roles", () => {
    expect(availableDemoRoles()).toEqual(["farmer", "mill"]);
    vi.stubEnv("DEMO_FARMER_EMAIL", "");
    expect(availableDemoRoles()).toEqual(["mill"]);
    vi.stubEnv("DEMO_MILL_PASSWORD", "");
    expect(availableDemoRoles()).toEqual([]);
  });
});

describe("requestDemoLogin", () => {
  const answer = (status: number, body: unknown) =>
    (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

  it("returns the redirect target", async () => {
    const result = await requestDemoLogin("farmer", "en", answer(200, { ok: true, data: { redirectTo: "/en/x" } }));
    expect(result).toEqual({ ok: true, redirectTo: "/en/x" });
  });

  it("maps failures to message keys", async () => {
    expect(await requestDemoLogin("mill", "en", answer(401, { ok: false }))).toEqual({ ok: false, errorKey: "demoFailed" });
    expect(await requestDemoLogin("mill", "en", answer(429, { ok: false }))).toEqual({ ok: false, errorKey: "rateLimited" });
    const offline = (async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    expect(await requestDemoLogin("mill", "en", offline)).toEqual({ ok: false, errorKey: "network" });
  });

  it("has every message in en, el and tr", () => {
    for (const locale of LOCALES) {
      const flat = flattenMessages(loadMessages(locale));
      for (const key of [...DEMO_ERROR_KEYS, "demoFarmer", "demoMill"]) {
        expect(flat[`auth.${key}`], `${locale}:auth.${key}`).toBeTruthy();
      }
    }
  });
});
