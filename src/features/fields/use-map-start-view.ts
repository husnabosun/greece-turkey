"use client";

import { useEffect, useState } from "react";
import { tryCreateBrowserClient } from "@/core/supabase/safe-client";
import { fitBoundsFor } from "@/features/fields/map-fit";
import { readLastMapCenter } from "@/features/fields/map-location";
import { resolveStartView, viewForLocale, type StartView } from "@/features/fields/start-view";
import type { Field } from "@/shared/types/database";

type KnownField = Pick<Field, "geom" | "lat" | "lon">;

/** Give up waiting for the profile / fields after this long and open on the locale default. */
const GIVE_UP_MS = 2500;

/**
 * Where a map should open: the user's fields, else their last map position, else their profile region,
 * else the area for the app language. `ready` turns true once the profile (and fields, unless passed in)
 * are known, so the map is created once at the right place.
 *
 * Pass `fields` when the screen already loaded them (use `undefined` while they are still loading).
 */
export function useMapStartView(locale: string, fields?: KnownField[]): { view: StartView; ready: boolean } {
  const [state, setState] = useState<{ place: string | null; ownFields: KnownField[] | null; profileDone: boolean; fieldsDone: boolean }>({
    place: null,
    ownFields: null,
    profileDone: false,
    fieldsDone: false,
  });
  const [timedOut, setTimedOut] = useState(false);
  const fieldsGiven = fields !== undefined;

  useEffect(() => {
    const timer = window.setTimeout(() => setTimedOut(true), GIVE_UP_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const supabase = tryCreateBrowserClient();
    if (!supabase) {
      setState((s) => ({ ...s, profileDone: true, fieldsDone: true }));
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        const [profile, own] = await Promise.all([
          supabase.from("profiles").select("place").eq("id", user.id).maybeSingle(),
          fieldsGiven
            ? Promise.resolve({ data: null })
            : supabase.from("fields").select("geom, lat, lon").eq("farmer_id", user.id).limit(100),
        ]);
        if (cancelled) return;
        setState({
          place: (profile.data?.place as string | null | undefined) ?? null,
          ownFields: (own.data as KnownField[] | null) ?? null,
          profileDone: true,
          fieldsDone: true,
        });
      } catch {
        if (!cancelled) setState((s) => ({ ...s, profileDone: true, fieldsDone: true }));
      } finally {
        if (!cancelled) setState((s) => ({ ...s, profileDone: true, fieldsDone: true }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fieldsGiven]);

  const list = fields ?? state.ownFields ?? [];
  const fieldBounds = fitBoundsFor({
    outlines: list.map((f) => ({ geom: f.geom })),
    points: list.map((f) => ({ lat: f.lat, lon: f.lon })),
  });

  const ready = timedOut || (state.profileDone && (fieldsGiven || state.fieldsDone));
  const view = ready
    ? resolveStartView({ fieldBounds, saved: readLastMapCenter(), profilePlace: state.place, locale })
    : { ...viewForLocale(locale), source: "locale" as const };

  return { view, ready };
}
