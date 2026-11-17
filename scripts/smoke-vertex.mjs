/**
 * Standalone Vertex smoke test via regional REST (no @google/genai SDK).
 * Usage: node scripts/smoke-vertex.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { GoogleAuth, JWT } from "google-auth-library";

const DEFAULT_MODEL = "gemini-3.5-flash";
const FALLBACK_MODEL = "gemini-3.8-flash";
const DEFAULT_LOCATION = "global";

const keyFilename = resolve(process.cwd(), "gcp-service-account.json");
if (!existsSync(keyFilename)) {
  console.error("MISSING", keyFilename);
  process.exit(1);
}

const fileEnv = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m) fileEnv[m[1]] = m[2];
}

delete process.env.GEMINI_API_KEY;
delete process.env.GOOGLE_API_KEY;
delete process.env.GOOGLE_GENAI_API_KEY;

const project = process.env.GOOGLE_CLOUD_PROJECT || fileEnv.GOOGLE_CLOUD_PROJECT;
const location =
  process.env.GOOGLE_CLOUD_LOCATION || fileEnv.GOOGLE_CLOUD_LOCATION || DEFAULT_LOCATION;
const primary = (
  process.env.GEMINI_MODEL ||
  fileEnv.GEMINI_MODEL ||
  DEFAULT_MODEL
).replace(/^models\//, "");
const models = primary === FALLBACK_MODEL ? [primary] : [primary, FALLBACK_MODEL];

function urlFor(model) {
  if (location === "global") {
    return `https://aiplatform.googleapis.com/v1/projects/${project}/locations/global/publishers/google/models/${model}:generateContent`;
  }
  return `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:generateContent`;
}

console.log(
  JSON.stringify(
    {
      keyFilename,
      keyExists: existsSync(keyFilename),
      project,
      location,
      models,
      urlPrimary: urlFor(models[0]),
      hasStudioKeyInEnv: Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
    },
    null,
    2,
  ),
);

try {
  const credentials = JSON.parse(readFileSync(keyFilename, "utf8"));
  const auth = new GoogleAuth({
    authClient: new JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    }),
  });
  const client = await auth.getClient();
  const tokenRes = await client.getAccessToken();
  const accessToken = typeof tokenRes === "string" ? tokenRes : tokenRes?.token;
  if (!accessToken) throw new Error("No access token from GoogleAuth");

  let ok = false;
  for (const model of models) {
    const url = urlFor(model);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: 'Reply with JSON only: {"ok":true}' }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0,
        },
      }),
    });

    const rawBody = await res.text();
    console.log("---", model);
    console.log("URL", url);
    console.log("HTTP_STATUS", res.status);
    console.log("RAW_BODY", rawBody.slice(0, 2000));

    if (!res.ok) continue;

    let parsed;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      console.log("RESULT", "fail");
      console.log("ERROR", "response was not JSON");
      process.exitCode = 1;
      process.exit();
    }

    const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
    console.log("CANDIDATE_TEXT", text);
    console.log("RESULT", "ok");
    ok = true;
    break;
  }

  if (!ok) {
    console.log("RESULT", "fail");
    process.exitCode = 1;
  }
} catch (err) {
  console.log("RESULT", "fail");
  console.log("ERROR_NAME", err?.name);
  console.log("ERROR_MESSAGE", String(err?.message || err).slice(0, 1200));
  if (err?.stack) console.log("ERROR_STACK_TOP", String(err.stack).split("\n").slice(0, 6).join("\n"));
  process.exitCode = 1;
}
