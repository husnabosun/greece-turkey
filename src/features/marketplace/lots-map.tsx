"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import mapboxgl from "mapbox-gl";
import { Crosshair, Minus, Plus } from "lucide-react";
import "mapbox-gl/dist/mapbox-gl.css";
import { SATELLITE_STYLE } from "@/features/fields/satellite-style";
import { colors } from "@/shared/theme/tokens";
import { cn } from "@/shared/lib/utils";

export type LotMapPoint = {
  id: string;
  lat: number;
  lon: number;
  label: string;
  score: number | null;
  /** Hover preview fields */
  title: string;
  subtitle: string;
  priceLabel: string;
  useLabel: string;
  harvestLabel: string;
};

type Props = {
  token: string | undefined;
  points: LotMapPoint[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  labels: {
    locate: string;
    zoomIn: string;
    zoomOut: string;
    needToken: string;
    empty: string;
    qualityScore: string;
    openLot: string;
  };
  className?: string;
};

const GREECE_CENTER: [number, number] = [22.5, 38.2];

/** Scales with the viewport so the map stays readable on laptop and desktop. */
const MAP_SHELL =
  "relative w-full overflow-hidden rounded-[18px] border border-line bg-ink " +
  "h-[min(58vh,560px)] min-h-[340px] " +
  "min-[900px]:h-[min(68vh,720px)] min-[900px]:min-h-[480px]";

export function LotsMap({ token, points, selectedId, onSelect, labels, className }: Props) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const preview = selectedId ? (points.find((p) => p.id === selectedId) ?? null) : null;

  useEffect(() => {
    if (!token || !containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = token;
    try {
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: SATELLITE_STYLE,
        center: GREECE_CENTER,
        zoom: 6.5,
        attributionControl: false,
      });
      map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");
      map.on("load", () => {
        map.resize();
        setReady(true);
      });
      map.on("error", () => setFailed(true));
      mapRef.current = map;
    } catch {
      setFailed(true);
    }
    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, [token]);

  useEffect(() => {
    const shell = shellRef.current;
    const map = mapRef.current;
    if (!shell || !map || !ready) return;
    const ro = new ResizeObserver(() => {
      map.resize();
    });
    ro.observe(shell);
    map.resize();
    return () => ro.disconnect();
  }, [ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    for (const point of points) {
      const el = document.createElement("button");
      el.type = "button";
      el.setAttribute("aria-label", point.label);
      const active = point.id === selectedId;
      el.style.cssText = [
        "width:36px",
        "height:36px",
        "border-radius:999px",
        `background:${active ? colors.ink : colors.good}`,
        `border:3px solid ${active ? "#fff" : colors.goodSoft}`,
        "box-shadow:0 3px 12px rgba(0,0,0,.4)",
        "cursor:pointer",
        "padding:0",
        active ? "transform:scale(1.12)" : "",
      ].join(";");
      if (point.score != null) {
        const score = document.createElement("span");
        score.textContent = String(point.score);
        score.style.cssText =
          "display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:#fff;font:800 12px/1 Inter,system-ui,sans-serif";
        el.appendChild(score);
      }
      el.addEventListener("mouseenter", () => onSelectRef.current(point.id));
      el.addEventListener("focus", () => onSelectRef.current(point.id));
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelectRef.current(point.id);
      });
      const marker = new mapboxgl.Marker({ element: el }).setLngLat([point.lon, point.lat]).addTo(map);
      markersRef.current.push(marker);
    }

    const selected = selectedId ? points.find((p) => p.id === selectedId) : null;
    if (selected) {
      map.easeTo({ center: [selected.lon, selected.lat], zoom: Math.max(map.getZoom(), 12), duration: 450 });
    } else if (points.length === 1) {
      map.easeTo({ center: [points[0]!.lon, points[0]!.lat], zoom: 12, duration: 500 });
    } else if (points.length > 1) {
      const bounds = new mapboxgl.LngLatBounds();
      for (const p of points) bounds.extend([p.lon, p.lat]);
      map.fitBounds(bounds, { padding: 72, maxZoom: 12, duration: 500 });
    }
  }, [points, ready, selectedId]);

  const locateMe = () => {
    const map = mapRef.current;
    if (!map || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        if (!userMarkerRef.current) {
          const el = document.createElement("div");
          el.style.cssText =
            "width:16px;height:16px;border-radius:999px;background:#2E6FB0;border:3px solid #fff;box-shadow:0 0 0 5px rgba(46,111,176,.28)";
          userMarkerRef.current = new mapboxgl.Marker({ element: el }).setLngLat([longitude, latitude]).addTo(map);
        } else {
          userMarkerRef.current.setLngLat([longitude, latitude]);
        }
        map.easeTo({ center: [longitude, latitude], zoom: Math.max(map.getZoom(), 11), duration: 600 });
      },
      () => {
        /* browser denied / unavailable */
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  if (!token) {
    return (
      <div
        className={cn(
          MAP_SHELL.replace("bg-ink", "bg-soft"),
          "flex items-center justify-center px-4 text-center text-[13px] font-semibold text-muted-foreground",
          className,
        )}
      >
        {labels.needToken}
      </div>
    );
  }

  return (
    <div ref={shellRef} className={cn(MAP_SHELL, className)}>
      <div ref={containerRef} className="absolute inset-0" />
      {failed ? (
        <div className="absolute inset-0 flex items-center justify-center bg-ink/70 px-4 text-center text-[13px] font-semibold text-white">
          {labels.needToken}
        </div>
      ) : null}
      {!failed && points.length === 0 ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 mx-auto max-w-[90%] rounded-full bg-card/95 px-3 py-1.5 text-center text-[12px] font-semibold text-muted-foreground">
          {labels.empty}
        </div>
      ) : null}

      {preview ? (
        <div className="pointer-events-none absolute bottom-3 left-3 z-10 w-[min(340px,calc(100%-5.5rem))] rounded-[18px] border border-line bg-card/95 p-3.5 shadow-[0_12px_32px_rgba(0,0,0,.28)] backdrop-blur-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] leading-5 font-extrabold text-ink">{preview.title}</p>
              <p className="mt-0.5 truncate text-[12px] leading-4 font-semibold text-muted-foreground">{preview.label}</p>
              <p className="mt-1 text-[12px] leading-4 font-medium text-muted-foreground">{preview.subtitle}</p>
              <p className="mt-0.5 text-[12px] leading-4 font-medium text-muted-foreground">
                {preview.useLabel} · {preview.harvestLabel}
              </p>
            </div>
            {preview.score != null ? (
              <div className="flex shrink-0 flex-col items-center rounded-lg bg-good-soft px-2 py-1">
                <span className="text-[9px] font-semibold text-good">{labels.qualityScore}</span>
                <span className="text-[16px] leading-5 font-extrabold text-good">{preview.score}</span>
              </div>
            ) : null}
          </div>
          <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-line pt-2.5">
            <p className="text-[14px] font-extrabold text-ink">{preview.priceLabel}</p>
            <span className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">{labels.openLot}</span>
          </div>
        </div>
      ) : null}

      <div className="absolute top-3 right-3 z-10 flex flex-col gap-2">
        <MapBtn ariaLabel={labels.locate} onClick={locateMe}>
          <Crosshair className="size-[18px]" />
        </MapBtn>
        <MapBtn ariaLabel={labels.zoomIn} onClick={() => mapRef.current?.zoomIn({ duration: 200 })}>
          <Plus className="size-[18px]" />
        </MapBtn>
        <MapBtn ariaLabel={labels.zoomOut} onClick={() => mapRef.current?.zoomOut({ duration: 200 })}>
          <Minus className="size-[18px]" />
        </MapBtn>
      </div>
    </div>
  );
}

function MapBtn({ children, onClick, ariaLabel }: { children: ReactNode; onClick: () => void; ariaLabel: string }) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className="flex size-11 items-center justify-center rounded-full border border-line bg-card text-ink shadow-sm hover:bg-soft"
    >
      {children}
    </button>
  );
}
