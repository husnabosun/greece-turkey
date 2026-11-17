import { tryCreateBrowserClient } from "@/core/supabase/safe-client";
import type { QualityResult } from "@/features/quality/score-engine";

type RefreshInput = {
  fieldId: string;
  proofLevel: "self_reported" | "evidence_based" | "lab_verified";
  peakRiskScore: number;
  stage?: "growing" | "almost" | "harvested";
};

type RefreshResult =
  | { ok: true; data: QualityResult }
  | { ok: false; error: string };

/** Gather live signals, compute score via API, persist to `quality_scores`. */
export async function refreshFieldQuality(input: RefreshInput): Promise<RefreshResult> {
  const supabase = tryCreateBrowserClient();
  if (!supabase) return { ok: false, error: "needSupabase" };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "needLogin" };

  const since = new Date();
  since.setFullYear(since.getFullYear() - 1);
  const sinceIso = since.toISOString();

  const [treesRes, spraysRes, scansRes, lastLogRes] = await Promise.all([
    supabase.from("field_trees").select("status").eq("field_id", input.fieldId),
    supabase
      .from("logbook_entries")
      .select("eu_banned")
      .eq("field_id", input.fieldId)
      .eq("kind", "spray")
      .gte("applied_at", sinceIso),
    supabase
      .from("scans")
      .select("confidence, diagnosis, captured_at")
      .eq("field_id", input.fieldId)
      .order("captured_at", { ascending: false })
      .limit(10),
    supabase
      .from("logbook_entries")
      .select("applied_at")
      .eq("field_id", input.fieldId)
      .order("applied_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const trees = treesRes.data ?? [];
  const healthy = trees.filter((t) => t.status === "healthy").length;
  const healthyTreeShare = trees.length ? healthy / trees.length : 0.7;

  const sprays = spraysRes.data ?? [];
  const hasBannedSpray = sprays.some((s) => s.eu_banned);
  const sprayCount12m = sprays.length;

  const scans = scansRes.data ?? [];
  let scanHealth = 70;
  if (scans.length) {
    const scores = scans.map((s) => {
      const conf = typeof s.confidence === "number" ? s.confidence : 0.6;
      const dx = s.diagnosis as { presented?: { pillKey?: string } } | null;
      const pill = dx?.presented?.pillKey;
      if (pill === "healthy") return 92 * conf + 8;
      if (pill === "highRisk") return 35 * conf + 10;
      if (pill === "watch") return 58 * conf + 15;
      return 65;
    });
    scanHealth = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }

  let daysSinceLastRecord: number | null = null;
  if (lastLogRes.data?.applied_at) {
    daysSinceLastRecord = Math.max(
      0,
      Math.floor((Date.now() - new Date(lastLogRes.data.applied_at).getTime()) / 86_400_000),
    );
  }

  const res = await fetch("/api/quality/score", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      scanHealth,
      healthyTreeShare,
      sprayCount12m,
      hasBannedSpray,
      daysSinceLastRecord,
      proofLevel: input.proofLevel,
      peakRiskScore: input.peakRiskScore,
      stage: input.stage ?? "growing",
    }),
  });
  const json = (await res.json()) as { ok?: boolean; data?: QualityResult; error?: string };
  if (!json.ok || !json.data) {
    return { ok: false, error: json.error ?? "scoreFailed" };
  }

  const { error } = await supabase.from("quality_scores").insert({
    field_id: input.fieldId,
    farmer_id: user.id,
    score: json.data.score,
    breakdown: json.data.breakdown,
    plan: json.data.plan,
    engine_version: json.data.engineVersion,
    computed_at: new Date().toISOString(),
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: json.data };
}
