"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { publicEnv } from "@/core/config/env";
import { SATELLITE_STYLE } from "@/features/fields/satellite-style";
import { colors } from "@/shared/theme/tokens";
import { MARKET_REGIONS, REGION_CENTERS, regionLabel, resolveMarketRegion } from "./regions";

function toggleValue(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/** Clickable region map for the buy-request form. Loaded lazily (Mapbox is heavy). */
export function RegionMap({
  values,
  onChange,
  locale,
  label,
  needTokenLabel,
}: {
  values: string[];
  onChange: (regions: string[]) => void;
  locale: string;
  label: string;
  needTokenLabel: string;
}) {
  const token = publicEnv.NEXT_PUBLIC_MAPBOX_TOKEN || undefined;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const valuesRef = useRef(values);
  valuesRef.current = values;
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!token || !containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = token;
    try {
      const bounds = new mapboxgl.LngLatBounds();
      for (const r of MARKET_REGIONS) bounds.extend(REGION_CENTERS[r]);
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: SATELLITE_STYLE,
        bounds,
        fitBoundsOptions: { padding: 28 },
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
        cooperativeGestures: true,
      });
      map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");
      map.on("load", () => {
        map.resize();
        setReady(true);
      });
      // Only a failure before the style loads means "no map"; a single bad tile later is harmless.
      map.on("error", () => {
        if (!map.loaded()) setFailed(true);
      });
      mapRef.current = map;
    } catch {
      setFailed(true);
    }
    // The dialog animates/lays out after mount — keep the canvas in sync with the box size.
    const ro = new ResizeObserver(() => mapRef.current?.resize());
    ro.observe(containerRef.current);
    return () => {
      ro.disconnect();
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, [token]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    const selected = new Set(
      values.map((v) => resolveMarketRegion(v)).filter((r): r is NonNullable<typeof r> => r != null),
    );

    for (const region of MARKET_REGIONS) {
      const active = selected.has(region);
      const name = regionLabel(region, locale);
      const el = document.createElement("button");
      el.type = "button";
      el.setAttribute("aria-label", name);
      el.setAttribute("aria-pressed", String(active));
      el.title = name;
      el.style.cssText = [
        "display:flex",
        "align-items:center",
        "gap:6px",
        "padding:0",
        "border:0",
        "background:transparent",
        "cursor:pointer",
        "position:relative",
        active ? "z-index:2" : "z-index:1",
      ].join(";");
      const pin = document.createElement("span");
      pin.style.cssText = "position:relative;display:inline-flex;align-items:center;justify-content:center;width:52px;height:52px;flex-shrink:0;";
      if (active) {
        const shade = document.createElement("span");
        shade.setAttribute("aria-hidden", "true");
        shade.style.cssText = [
          "position:absolute",
          "inset:0",
          "border-radius:999px",
          `background:${colors.good}`,
          "opacity:0.3",
          "box-shadow:0 0 0 12px rgba(63,107,47,0.18), 0 10px 28px rgba(0,0,0,0.4)",
          "pointer-events:none",
        ].join(";");
        pin.appendChild(shade);
      }
      const dot = document.createElement("span");
      dot.style.cssText = [
        "position:relative",
        `width:${active ? 18 : 14}px`,
        `height:${active ? 18 : 14}px`,
        "border-radius:999px",
        `background:${active ? colors.ink : colors.good}`,
        "border:3px solid #fff",
        active
          ? "box-shadow:0 4px 14px rgba(0,0,0,.55), 0 0 0 4px rgba(63,107,47,0.4)"
          : "box-shadow:0 2px 8px rgba(0,0,0,.45)",
      ].join(";");
      pin.appendChild(dot);
      el.appendChild(pin);
      if (active) {
        const tag = document.createElement("span");
        tag.textContent = name;
        tag.style.cssText =
          "position:relative;padding:3px 8px;border-radius:999px;background:#fff;color:" +
          colors.ink +
          ";font:800 12px/16px Inter,system-ui,sans-serif;white-space:nowrap;box-shadow:0 4px 14px rgba(0,0,0,.35)";
        el.appendChild(tag);
      }
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onChangeRef.current(toggleValue(valuesRef.current, region));
      });
      const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat(REGION_CENTERS[region])
        .addTo(map);
      markersRef.current.push(marker);
    }
  }, [ready, values, locale]);

  if (!token || failed) {
    return (
      <div
        style={{ height: 200 }}
        className="flex shrink-0 items-center justify-center rounded-xl border border-line bg-soft px-4 text-center text-[13px] font-semibold text-muted-foreground">
        {needTokenLabel}
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label={label}
      style={{ height: 220 }}
      className="relative w-full shrink-0 overflow-hidden rounded-xl border border-line bg-ink"
    >
      <div ref={containerRef} className="absolute inset-0" />
    </div>
  );
}
