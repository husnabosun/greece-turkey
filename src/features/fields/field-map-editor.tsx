"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import { useTranslations } from "next-intl";
import "mapbox-gl/dist/mapbox-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";

export type FieldPolygon = {
  type: "Polygon";
  coordinates: [number, number][][];
};

type Props = {
  token: string;
  onPolygonChange?: (polygon: FieldPolygon | null, areaHa: number | null) => void;
};

type MapboxAjaxLike = { status?: number; message?: string; statusText?: string };

function isMapboxRateLimit(error: unknown): boolean {
  const e = error as MapboxAjaxLike | string | undefined;
  if (!e) return false;
  if (typeof e === "string") return /too many requests|429/i.test(e);
  return e.status === 429 || /too many requests/i.test(e.message ?? e.statusText ?? "");
}

/** Interactive Mapbox polygon drawer for olive grove boundaries. */
export function FieldMapEditor({ token, onPolygonChange }: Props) {
  const t = useTranslations("farmerFields");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onPolygonChangeRef = useRef(onPolygonChange);
  const [areaHa, setAreaHa] = useState<number | null>(null);
  const [mapError, setMapError] = useState<"rate-limit" | "generic" | null>(null);

  useEffect(() => {
    onPolygonChangeRef.current = onPolygonChange;
  }, [onPolygonChange]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !token) return;

    // Mapbox calls console.error on every failed tile; Next.js 15 turns that into a
    // full-screen "Console Error" overlay. Suppress only rate-limit noise while the map lives.
    const prevConsoleError = console.error;
    console.error = (...args: unknown[]) => {
      if (args.some((arg) => isMapboxRateLimit(arg))) return;
      prevConsoleError(...(args as Parameters<typeof console.error>));
    };

    mapboxgl.accessToken = token;
    // Fewer parallel satellite tiles → less likely to trip free-tier 429s.
    if (mapboxgl.config) {
      mapboxgl.config.MAX_PARALLEL_IMAGE_REQUESTS = 6;
    }

    const map = new mapboxgl.Map({
      container,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center: [26.7, 39.325],
      zoom: 13,
      attributionControl: true,
    });

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: { polygon: true, trash: true },
      defaultMode: "draw_polygon",
    });

    map.addControl(draw);
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: false }), "top-right");

    const onChange = () => {
      const data = draw.getAll();
      const feature = data.features[0];
      if (!feature || feature.geometry.type !== "Polygon") {
        setAreaHa(null);
        onPolygonChangeRef.current?.(null, null);
        return;
      }
      const ring = feature.geometry.coordinates[0] as [number, number][];
      const ha = Number(polygonAreaHa(ring).toFixed(2));
      setAreaHa(ha);
      onPolygonChangeRef.current?.(
        { type: "Polygon", coordinates: feature.geometry.coordinates as [number, number][][] },
        ha,
      );
    };

    const onMapError = (event: { error?: Error }) => {
      if (isMapboxRateLimit(event.error)) {
        setMapError("rate-limit");
        return;
      }
      setMapError("generic");
    };

    map.on("draw.create", onChange);
    map.on("draw.update", onChange);
    map.on("draw.delete", onChange);
    map.on("error", onMapError);
    map.once("load", () => setMapError(null));

    return () => {
      console.error = prevConsoleError;
      map.off("error", onMapError);
      map.remove();
    };
  }, [token]);

  return (
    <div className="space-y-2">
      <div ref={containerRef} className="h-72 w-full overflow-hidden rounded-xl border" />
      {mapError === "rate-limit" ? (
        <p className="text-sm text-amber-800">{t("mapRateLimit")}</p>
      ) : null}
      {mapError === "generic" ? (
        <p className="text-sm text-destructive">{t("mapError")}</p>
      ) : null}
      {areaHa != null ? (
        <p className="text-sm font-medium">
          ≈ {areaHa} ha · {(areaHa * 10).toFixed(1)} stremmata
        </p>
      ) : null}
    </div>
  );
}

/** Spherical excess approximation for small polygons (ha). */
function polygonAreaHa(ring: [number, number][]) {
  if (ring.length < 3) return 0;
  const R = 6378137;
  let total = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [lon1, lat1] = ring[i];
    const [lon2, lat2] = ring[i + 1];
    total +=
      ((lon2 * Math.PI) / 180 - (lon1 * Math.PI) / 180) *
      (2 + Math.sin((lat1 * Math.PI) / 180) + Math.sin((lat2 * Math.PI) / 180));
  }
  const areaM2 = Math.abs((total * R * R) / 2);
  return areaM2 / 10_000;
}
