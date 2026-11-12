import { ZodError } from "zod";
import {
  adviseRequest,
  advicePrompt,
  adviceResult,
  demoAdvice,
  geminiJson,
  isAdviceSafe,
  numbersIn,
} from "@/features/diagnostics";
import { aiRateLimiter } from "@/shared/lib/api/rate-limit";
import { fromZodError, jsonError, jsonOk } from "@/shared/lib/api/http";

export const runtime = "nodejs";

function clientKey(request: Request): string {
  return request.headers.get("x-device-id") ?? request.headers.get("x-forwarded-for") ?? "anon";
}

function allowedNumbers(body: ReturnType<typeof adviseRequest.parse>): number[] {
  const nums: number[] = [];
  for (const r of body.risks) {
    nums.push(r.score);
    nums.push(...numbersIn(r.threat), ...r.drivers.flatMap(numbersIn));
  }
  if (body.weather.temperatureC != null) nums.push(body.weather.temperatureC);
  if (body.weather.rainTomorrowMm != null) nums.push(body.weather.rainTomorrowMm);
  for (const s of body.recentScans) {
    nums.push(s.daysAgo);
    if (s.flies != null) nums.push(s.flies);
  }
  for (const s of body.recentSprays) nums.push(s.daysAgo);
  return nums;
}

/** Risk-engine explainer (EN / TR / EL) with chemical-safety filter. */
export async function POST(request: Request) {
  try {
    if (!aiRateLimiter.allow(`advise:${clientKey(request)}`)) {
      return jsonError("Rate limit exceeded", 429);
    }

    const body = adviseRequest.parse(await request.json());
    const live = await geminiJson({
      prompt: advicePrompt(body),
      schema: adviceResult,
    });

    if (live && isAdviceSafe(live, allowedNumbers(body))) {
      return jsonOk({ advice: live, source: "gemini" as const });
    }

    return jsonOk({ advice: demoAdvice(body.field.name), source: "demo" as const });
  } catch (err) {
    if (err instanceof ZodError) return fromZodError(err);
    return jsonError("Advice failed", 500);
  }
}
