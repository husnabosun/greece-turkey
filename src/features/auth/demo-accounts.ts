/**
 * Demo accounts offered on the login page. SERVER ONLY: client code may import the `DemoRole`
 * type from here, never the functions.
 */
export const DEMO_ROLES = ["farmer", "mill"] as const;
export type DemoRole = (typeof DEMO_ROLES)[number];

/** Credentials from server env, or null when either variable is missing. */
export function demoCredentials(role: DemoRole): { email: string; password: string } | null {
  // Read here, not in core/config/env: that module is also bundled for the browser.
  const env = process.env;
  const email = (role === "farmer" ? env.DEMO_FARMER_EMAIL : env.DEMO_MILL_EMAIL)?.trim();
  const password = role === "farmer" ? env.DEMO_FARMER_PASSWORD : env.DEMO_MILL_PASSWORD;
  return email && password ? { email, password } : null;
}

/** Roles whose button should be shown. */
export function availableDemoRoles(): DemoRole[] {
  return DEMO_ROLES.filter((role) => demoCredentials(role) !== null);
}
