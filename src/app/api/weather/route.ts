import { ZodError } from "zod";
import { weatherRequest } from "@/features/diagnostics/schemas";
import { getFieldWeather } from "@/features/weather-risk/weather";
import { memoryWeatherStorage } from "@/features/weather-risk/server-cache";
import { fromZodError, jsonError, jsonOk } from "@/shared/lib/api/http";

export const runtime = "nodejs";

const memory = new Map<string, import("@/features/weather-risk/weather").FieldWeather>();

/** Open-Meteo proxy with 1h cache (live → cached → demo). */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const parsed = weatherRequest.parse({
      fieldId: url.searchParams.get("fieldId") ?? "field",
      lat: Number(url.searchParams.get("lat")),
      lon: Number(url.searchParams.get("lon")),
      force: url.searchParams.get("force") === "1",
    });

    const weather = await getFieldWeather(
      { id: parsed.fieldId, lat: parsed.lat, lon: parsed.lon },
      { storage: memoryWeatherStorage, memory },
      { force: parsed.force },
    );

    return jsonOk(weather);
  } catch (err) {
    if (err instanceof ZodError) return fromZodError(err);
    return jsonError("Weather lookup failed", 500);
  }
}

export async function POST(request: Request) {
  try {
    const body = weatherRequest.parse(await request.json());
    const weather = await getFieldWeather(
      { id: body.fieldId, lat: body.lat, lon: body.lon },
      { storage: memoryWeatherStorage, memory },
      { force: body.force },
    );
    return jsonOk(weather);
  } catch (err) {
    if (err instanceof ZodError) return fromZodError(err);
    return jsonError("Weather lookup failed", 500);
  }
}
