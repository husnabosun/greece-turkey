import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadServiceAccount, parseServiceAccount } from "./service-account";

const KEY = "-----BEGIN PRIVATE KEY-----\nMIIabc\ndef\n-----END PRIVATE KEY-----\n";
const json = (over: Record<string, unknown> = {}) =>
  JSON.stringify({ type: "service_account", client_email: "sa@proj.iam.gserviceaccount.com", private_key: KEY, ...over });

afterEach(() => vi.restoreAllMocks());

describe("parseServiceAccount", () => {
  it("reads a normal key JSON", () => {
    expect(parseServiceAccount(json())).toEqual({ client_email: "sa@proj.iam.gserviceaccount.com", private_key: KEY });
  });

  it("repairs literal \\n in the private key (one-line env value)", () => {
    const oneLine = json().replace(/\\n/g, "\\\\n"); // private_key now holds backslash + n
    expect(oneLine).toContain("\\\\n");
    expect(parseServiceAccount(oneLine)?.private_key).toBe(KEY);
  });

  it("repairs real line breaks inside the private key", () => {
    const withBreaks = `{"client_email":"sa@p.iam.gserviceaccount.com","private_key":"${KEY.trimEnd()}"}`;
    expect(withBreaks).toContain("\n");
    expect(parseServiceAccount(withBreaks)?.private_key).toBe(KEY);
  });

  it("accepts a value wrapped in single or double quotes", () => {
    expect(parseServiceAccount(`'${json()}'`)?.client_email).toBe("sa@proj.iam.gserviceaccount.com");
  });

  it("returns null for empty, broken or incomplete values", () => {
    expect(parseServiceAccount("")).toBeNull();
    expect(parseServiceAccount(undefined)).toBeNull();
    expect(parseServiceAccount("{not json")).toBeNull();
    expect(parseServiceAccount(json({ private_key: "nope" }))).toBeNull();
    expect(parseServiceAccount(json({ client_email: undefined }))).toBeNull();
  });
});

describe("loadServiceAccount", () => {
  it("prefers the env var over the file", () => {
    const dir = mkdtempSync(join(tmpdir(), "sa-"));
    try {
      const file = join(dir, "key.json");
      writeFileSync(file, json({ client_email: "file@p.iam.gserviceaccount.com" }));
      vi.spyOn(process, "cwd").mockReturnValue(dir);
      const both = loadServiceAccount({
        GOOGLE_SERVICE_ACCOUNT_JSON: json({ client_email: "env@p.iam.gserviceaccount.com" }),
        GOOGLE_APPLICATION_CREDENTIALS: "key.json",
      });
      expect(both?.client_email).toBe("env@p.iam.gserviceaccount.com");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("falls back to the file when the env var is missing or broken", () => {
    const dir = mkdtempSync(join(tmpdir(), "sa-"));
    try {
      writeFileSync(join(dir, "key.json"), json({ client_email: "file@p.iam.gserviceaccount.com" }));
      vi.spyOn(process, "cwd").mockReturnValue(dir);
      for (const bad of [undefined, "", "{broken"]) {
        expect(
          loadServiceAccount({ GOOGLE_SERVICE_ACCOUNT_JSON: bad, GOOGLE_APPLICATION_CREDENTIALS: "key.json" })?.client_email,
        ).toBe("file@p.iam.gserviceaccount.com");
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns null when there is neither", () => {
    const dir = mkdtempSync(join(tmpdir(), "sa-"));
    try {
      vi.spyOn(process, "cwd").mockReturnValue(dir);
      expect(loadServiceAccount({})).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
