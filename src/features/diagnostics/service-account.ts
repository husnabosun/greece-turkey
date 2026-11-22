import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export type ServiceAccount = { client_email: string; private_key: string };

/**
 * Parse a service-account key JSON. Hosts like Vercel often store the key on one line, with the
 * newlines of the private key as the two characters "\n" (or as real line breaks that break JSON),
 * so both are repaired. Returns null when it is not a usable key.
 */
export function parseServiceAccount(raw: string | null | undefined): ServiceAccount | null {
  let text = raw?.trim();
  if (!text) return null;
  // The whole value pasted inside quotes: '{"type": ...}' or "{...}"
  if ((text.startsWith("'") && text.endsWith("'")) || (text.startsWith('"') && text.endsWith('"') && text[1] === "{")) {
    text = text.slice(1, -1);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    try {
      // Real line breaks inside the private_key string make the JSON invalid.
      parsed = JSON.parse(text.replace(/\r?\n/g, "\\n"));
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== "object") return null;
  const { client_email, private_key } = parsed as Record<string, unknown>;
  if (typeof client_email !== "string" || typeof private_key !== "string") return null;
  const key = private_key.replace(/\\n/g, "\n").trim();
  if (!client_email.trim() || !key.includes("PRIVATE KEY")) return null;
  return { client_email: client_email.trim(), private_key: `${key}\n` };
}

/** gcp-service-account.json in the project root, or the file GOOGLE_APPLICATION_CREDENTIALS points to. */
export function resolveServiceAccountPath(credentialsEnv?: string | null): string | null {
  const candidates = [
    resolve(process.cwd(), "gcp-service-account.json"),
    credentialsEnv ? resolve(process.cwd(), credentialsEnv) : "",
  ];
  for (const path of candidates) {
    if (path && existsSync(path)) return path;
  }
  return null;
}

/**
 * The Vertex service account: GOOGLE_SERVICE_ACCOUNT_JSON first (works on Vercel, no file),
 * then the key file (local development).
 */
export function loadServiceAccount(env: {
  GOOGLE_SERVICE_ACCOUNT_JSON?: string | null;
  GOOGLE_APPLICATION_CREDENTIALS?: string | null;
}): ServiceAccount | null {
  const fromEnv = parseServiceAccount(env.GOOGLE_SERVICE_ACCOUNT_JSON);
  if (fromEnv) return fromEnv;
  const path = resolveServiceAccountPath(env.GOOGLE_APPLICATION_CREDENTIALS);
  if (!path) return null;
  try {
    return parseServiceAccount(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}
