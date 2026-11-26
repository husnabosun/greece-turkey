import type { DemoRole } from "@/features/auth/demo-accounts";

/** Message keys (under `auth`) a failed demo sign-in can show. */
export const DEMO_ERROR_KEYS = ["demoFailed", "rateLimited", "network"] as const;
export type DemoErrorKey = (typeof DEMO_ERROR_KEYS)[number];

export type DemoLoginResult = { ok: true; redirectTo: string } | { ok: false; errorKey: DemoErrorKey };

/** Calls /api/auth/demo. Never throws. */
export async function requestDemoLogin(
  role: DemoRole,
  locale: string,
  fetchImpl: typeof fetch = fetch,
): Promise<DemoLoginResult> {
  let res: Response;
  try {
    res = await fetchImpl("/api/auth/demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, locale }),
    });
  } catch {
    return { ok: false, errorKey: "network" };
  }

  if (res.status === 429) return { ok: false, errorKey: "rateLimited" };
  const json = (await res.json().catch(() => null)) as { ok?: boolean; data?: { redirectTo?: string } } | null;
  const redirectTo = json?.data?.redirectTo;
  return res.ok && redirectTo ? { ok: true, redirectTo } : { ok: false, errorKey: "demoFailed" };
}
