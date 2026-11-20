import { ZodError } from "zod";
import { ndviRequest } from "@/features/diagnostics/schemas";
import { fetchNdviHistory } from "@/features/fields/agromonitoring";
import { fromZodError, jsonError, jsonOk } from "@/shared/lib/api/http";
import { requireApiUser } from "@/shared/lib/api/require-user";

export const runtime = "nodejs";

/** AgroMonitoring NDVI/EVI history for a field polygon (demo fallback without key). */
export async function POST(request: Request) {
  try {
    const auth = await requireApiUser();
    if (!auth.ok) return auth.response;

    const body = ndviRequest.parse(await request.json());
    const data = await fetchNdviHistory({
      name: body.name,
      coordinates: body.coordinates,
      start: body.start,
      end: body.end,
    });
    return jsonOk(data);
  } catch (err) {
    if (err instanceof ZodError) return fromZodError(err);
    return jsonError("NDVI lookup failed", 500);
  }
}
