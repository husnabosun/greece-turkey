"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import { Crosshair, Leaf, Minus, Plus } from "lucide-react";
import "mapbox-gl/dist/mapbox-gl.css";
import { colors } from "@/shared/theme/tokens";
import { cn } from "@/shared/lib/utils";
import {
  DEFAULT_FIELD_CENTER,
  DEFAULT_FIELD_ZOOM,
  boundsFromPolygon,
  parseFieldPolygon,
  SATELLITE_STYLE,
  type FieldPolygon,
} from "@/features/fields/satellite-style";

export type MapTreeStatus = "healthy" | "suspicious" | "diseased";

export type MapTree = {
  id: number;
  x: number;
  y: number;
  status: MapTreeStatus;
};

const STATUS_COLOR: Record<MapTreeStatus, string> = {
  healthy: colors.good,
  suspicious: colors.warn,
  diseased: colors.risk,
};

const FIELD_SOURCE = "active-field";
const FIELD_FILL = "active-field-fill";
const FIELD_LINE = "active-field-line";

export type FieldOutline = {
  id: string;
  geom: unknown;
  color?: string;
};

type Props = {
  token: string | undefined;
  lat?: number | null;
  lon?: number | null;
  geom?: unknown;
  /** When set (e.g. “all fields”), draw every outline and fit to their bounds. */
  outlines?: FieldOutline[];
  trees: MapTree[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  showHealth: boolean;
  onToggleHealth: (v: boolean) => void;
  onLocate: () => void;
  labels: {
    aiLayer: string;
    healthy: string;
    suspicious: string;
    diseased: string;
    locate: string;
    zoomIn: string;
    zoomOut: string;
    tree: (id: number) => string;
    needToken?: string;
    loading?: string;
    failed?: string;
  };
  className?: string;
};

export function FieldHealthMap({
  token,
  lat,
  lon,
  geom,
  outlines,
  trees,
  selectedId,
  onSelect,
  showHealth,
  onToggleHealth,
  onLocate,
  labels,
  className,
}: Props) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapError, setMapError] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    const shell = shellRef.current;
    if (!container || !token) return;

    let removed = false;
    let map: mapboxgl.Map | null = null;
    let ro: ResizeObserver | null = null;
    const timers: number[] = [];

    const center: [number, number] =
      lon != null && lat != null && Number.isFinite(lon) && Number.isFinite(lat)
        ? [lon, lat]
        : DEFAULT_FIELD_CENTER;

    const boot = () => {
      if (removed || mapRef.current) return;
      // Wait until the flex layout gives the pane a real size — otherwise Mapbox paints black.
      if (container.clientWidth < 2 || container.clientHeight < 2) return;

      mapboxgl.accessToken = token;
      map = new mapboxgl.Map({
        container,
        style: SATELLITE_STYLE,
        center,
        zoom: DEFAULT_FIELD_ZOOM,
        attributionControl: true,
        collectResourceTiming: false,
        failIfMajorPerformanceCaveat: false,
      });
      mapRef.current = map;

      const resize = () => {
        if (!removed && mapRef.current) mapRef.current.resize();
      };

      map.on("load", () => {
        if (removed) return;
        setMapError(false);
        setReady(true);
        resize();
        const poly = parseFieldPolygon(geom);
        upsertFieldFeatures(
          map!,
          poly
            ? [{ type: "Feature", properties: { id: "active", color: "#ffffff" }, geometry: poly }]
            : [],
        );
        fitToField(map!, poly, center);
        timers.push(window.setTimeout(resize, 50));
        timers.push(window.setTimeout(resize, 250));
      });

      map.on("error", () => {
        if (!removed) setMapError(true);
      });

      ro = new ResizeObserver(() => resize());
      ro.observe(container);
      if (shell) ro.observe(shell);
    };

    // First paint may be 0×0 inside flex; observe until we can boot.
    ro = new ResizeObserver(() => {
      if (!mapRef.current) boot();
      else mapRef.current.resize();
    });
    ro.observe(container);
    if (shell) ro.observe(shell);
    boot();
    timers.push(window.setTimeout(boot, 0));
    timers.push(window.setTimeout(boot, 100));

    return () => {
      removed = true;
      timers.forEach((id) => window.clearTimeout(id));
      ro?.disconnect();
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map?.remove();
      mapRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !token || !ready) return;

    const apply = () => {
      const multi = outlines && outlines.length > 0;
      if (multi) {
        const features = outlines
          .map((o) => {
            const poly = parseFieldPolygon(o.geom);
            if (!poly) return null;
            return {
              type: "Feature" as const,
              properties: { id: o.id, color: o.color ?? "#ffffff" },
              geometry: poly,
            };
          })
          .filter(Boolean) as GeoJSON.Feature[];
        upsertFieldFeatures(map, features);
        fitToFeatures(map, features, null);
      } else {
        const poly = parseFieldPolygon(geom);
        upsertFieldFeatures(
          map,
          poly
            ? [{ type: "Feature", properties: { id: "active", color: "#ffffff" }, geometry: poly }]
            : [],
        );
        const center: [number, number] | null =
          lon != null && lat != null && Number.isFinite(lon) && Number.isFinite(lat) ? [lon, lat] : null;
        fitToField(map, poly, center);
      }
      map.resize();
    };

    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [token, lat, lon, geom, outlines, ready]);

  useEffect(() => {
    const map = mapRef.current;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    const poly = parseFieldPolygon(geom);
    if (!map || !ready || !showHealth || !poly || trees.length === 0) return;

    const bounds = boundsFromPolygon(poly);
    if (!bounds) return;
    const [[minLon, minLat], [maxLon, maxLat]] = bounds;
    const width = maxLon - minLon || 1;
    const height = maxLat - minLat || 1;

    for (const tree of trees) {
      const lng = minLon + (tree.x / 100) * width;
      const latPt = maxLat - (tree.y / 100) * height;
      const el = document.createElement("button");
      el.type = "button";
      el.setAttribute("aria-label", labels.tree(tree.id));
      el.className = "relative flex items-center justify-center border-0 bg-transparent p-0";
      const size = tree.id === selectedId ? 22 : 16;
      el.innerHTML = `<span style="display:block;width:${size - 2}px;height:${size - 2}px;border-radius:999px;border:${
        tree.status === "healthy" ? 3 : 2
      }px solid ${tree.status === "healthy" ? colors.good : "#fff"};background:${
        tree.status === "healthy" ? "#fff" : STATUS_COLOR[tree.status]
      }"></span>${
        tree.id === selectedId
          ? `<span style="position:absolute;top:-28px;left:50%;transform:translateX(-50%);border-radius:999px;background:#151515;color:#fff;padding:2px 8px;font-size:11px;font-weight:700;white-space:nowrap">#${tree.id}</span>`
          : ""
      }`;
      el.onclick = (e) => {
        e.stopPropagation();
        onSelect(tree.id);
      };
      markersRef.current.push(new mapboxgl.Marker({ element: el, anchor: "center" }).setLngLat([lng, latPt]).addTo(map));
    }
  }, [showHealth, trees, selectedId, geom, labels, onSelect, ready]);

  function zoomBy(delta: number) {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({ zoom: map.getZoom() + delta, duration: 200 });
  }

  function locate() {
    const map = mapRef.current;
    if (!map) {
      onLocate();
      return;
    }
    const poly = parseFieldPolygon(geom);
    const center: [number, number] | null =
      lon != null && lat != null && Number.isFinite(lon) && Number.isFinite(lat) ? [lon, lat] : null;
    fitToField(map, poly, center);
    onLocate();
  }

  const legend: { key: MapTreeStatus; label: string }[] = [
    { key: "healthy", label: labels.healthy },
    { key: "suspicious", label: labels.suspicious },
    { key: "diseased", label: labels.diseased },
  ];

  return (
    <div
      ref={shellRef}
      className={cn("relative h-full min-h-[58dvh] overflow-hidden bg-[#1a1a1a]", className ?? "rounded-[18px]")}
    >
      {token ? (
        <div ref={containerRef} className="absolute inset-0 h-full w-full [&_.mapboxgl-map]:h-full [&_.mapboxgl-map]:w-full [&_.mapboxgl-canvas]:outline-none" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-[#1B1B1B] px-6 text-center">
          <p className="text-ap-body font-semibold text-white/80">
            {labels.needToken ?? "Add NEXT_PUBLIC_MAPBOX_TOKEN to show the satellite map."}
          </p>
        </div>
      )}

      {token && !ready && !mapError ? (
        <div className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center bg-[#1a1a1a]/70">
          <p className="text-ap-body font-semibold text-white/80">{labels.loading ?? "…"}</p>
        </div>
      ) : null}

      {mapError ? (
        <div className="absolute inset-0 z-[5] flex items-center justify-center bg-[#1a1a1a] px-6 text-center">
          <p className="text-ap-body font-semibold text-white/80">{labels.failed ?? labels.needToken}</p>
        </div>
      ) : null}

      <button
        type="button"
        role="switch"
        aria-checked={showHealth}
        onClick={() => onToggleHealth(!showHealth)}
        className="absolute top-2 left-2 z-10 flex h-8 items-center gap-1.5 rounded-full bg-white px-2.5 shadow-sm"
      >
        <Leaf className="size-3.5 text-good" aria-hidden />
        <span className="text-ap-small font-semibold text-ink">{labels.aiLayer}</span>
        <span
          className={`flex h-5 w-8 items-center rounded-full px-0.5 ${showHealth ? "justify-end bg-primary" : "justify-start bg-line"}`}
        >
          <span className="size-4 rounded-full bg-white" />
        </span>
      </button>

      <div className="absolute top-2 right-2 z-10 flex flex-col gap-1 rounded-xl bg-white px-2.5 py-2 shadow-sm">
        {legend.map((item) => (
          <div key={item.key} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: STATUS_COLOR[item.key] }} />
            <span className="text-ap-small font-semibold text-ink">{item.label}</span>
          </div>
        ))}
      </div>

      <div className="absolute right-2 bottom-2 z-10 flex flex-col gap-1.5">
        <button
          type="button"
          aria-label={labels.locate}
          onClick={locate}
          className="flex size-9 items-center justify-center rounded-xl bg-white shadow-sm"
        >
          <Crosshair className="size-[18px] text-ink" aria-hidden />
        </button>
        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          <button type="button" aria-label={labels.zoomIn} onClick={() => zoomBy(0.6)} className="flex size-9 items-center justify-center">
            <Plus className="size-[18px] text-ink" aria-hidden />
          </button>
          <button type="button" aria-label={labels.zoomOut} onClick={() => zoomBy(-0.6)} className="flex size-9 items-center justify-center">
            <Minus className="size-[18px] text-ink" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}

function upsertFieldFeatures(map: mapboxgl.Map, features: GeoJSON.Feature[]) {
  const data: GeoJSON.FeatureCollection = { type: "FeatureCollection", features };

  const source = map.getSource(FIELD_SOURCE) as mapboxgl.GeoJSONSource | undefined;
  if (source) {
    source.setData(data);
    return;
  }

  map.addSource(FIELD_SOURCE, { type: "geojson", data });
  map.addLayer({
    id: FIELD_FILL,
    type: "fill",
    source: FIELD_SOURCE,
    paint: {
      "fill-color": ["coalesce", ["get", "color"], "#B9E09A"],
      "fill-opacity": 0.22,
    },
  });
  map.addLayer({
    id: FIELD_LINE,
    type: "line",
    source: FIELD_SOURCE,
    paint: {
      "line-color": ["coalesce", ["get", "color"], "#ffffff"],
      "line-width": 2.4,
    },
  });
}

function fitToFeatures(
  map: mapboxgl.Map,
  features: GeoJSON.Feature[],
  center: [number, number] | null,
) {
  const bounds = new mapboxgl.LngLatBounds();
  let any = false;
  for (const f of features) {
    if (f.geometry?.type !== "Polygon") continue;
    const poly = f.geometry as FieldPolygon;
    const b = boundsFromPolygon(poly);
    if (!b) continue;
    bounds.extend(b[0]);
    bounds.extend(b[1]);
    any = true;
  }
  if (any) {
    map.fitBounds(bounds, { padding: 56, maxZoom: 16, duration: 500 });
    return;
  }
  if (center) map.easeTo({ center, zoom: DEFAULT_FIELD_ZOOM, duration: 400 });
}

function fitToField(map: mapboxgl.Map, polygon: FieldPolygon | null, center: [number, number] | null) {
  const bounds = polygon ? boundsFromPolygon(polygon) : null;
  if (bounds) {
    map.fitBounds(bounds, { padding: 48, maxZoom: 18, duration: 500 });
    return;
  }
  if (center) map.easeTo({ center, zoom: DEFAULT_FIELD_ZOOM, duration: 400 });
}
