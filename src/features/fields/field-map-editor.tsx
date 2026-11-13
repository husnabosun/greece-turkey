"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import { MapPin, Navigation } from "lucide-react";
import { useTranslations } from "next-intl";
import "mapbox-gl/dist/mapbox-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import { formatStremmata } from "@/features/fields/area";
import {
  DRAW_LOCATE_ZOOM,
  initialMapView,
  LOCATE_ZOOM,
  requestDeviceLocation,
  writeLastMapCenter,
} from "@/features/fields/map-location";
import { SATELLITE_STYLE, type FieldPolygon } from "@/features/fields/satellite-style";
import { cn } from "@/shared/lib/utils";

export type { FieldPolygon };

type Props = {
  token: string;
  onPolygonChange?: (polygon: FieldPolygon | null, areaHa: number | null) => void;
  /** Fired when the map centers on device / last known location (for country filter). */
  onCenterChange?: (lon: number, lat: number) => void;
  className?: string;
  placeLabel?: string;
  /** Edge-to-edge map (no side radius / border). */
  fullBleed?: boolean;
};

/** Interactive satellite polygon drawer for olive grove boundaries. */
export function FieldMapEditor({
  token,
  onPolygonChange,
  onCenterChange,
  className,
  placeLabel,
  fullBleed,
}: Props) {
  const t = useTranslations("farmerFields");
  const shellRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);
  const onPolygonChangeRef = useRef(onPolygonChange);
  const onCenterChangeRef = useRef(onCenterChange);
  const [areaHa, setAreaHa] = useState<number | null>(null);
  const [mapError, setMapError] = useState(false);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    onPolygonChangeRef.current = onPolygonChange;
  }, [onPolygonChange]);

  useEffect(() => {
    onCenterChangeRef.current = onCenterChange;
  }, [onCenterChange]);

  useEffect(() => {
    const container = containerRef.current;
    const shell = shellRef.current;
    if (!container || !token) return;

    let removed = false;
    let map: mapboxgl.Map | null = null;
    let ro: ResizeObserver | null = null;
    const timers: number[] = [];

    const onChange = () => {
      const draw = drawRef.current;
      if (!draw) return;
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

    const goToDevice = async (zoom: number) => {
      try {
        setLocating(true);
        const pos = await requestDeviceLocation();
        if (removed || !mapRef.current) return;
        const center: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        writeLastMapCenter(center[0], center[1], zoom);
        onCenterChangeRef.current?.(center[0], center[1]);
        mapRef.current.easeTo({ center, zoom, duration: 900 });
      } catch {
        /* keep last / Greece fallback */
      } finally {
        if (!removed) setLocating(false);
      }
    };

    const boot = () => {
      if (removed || mapRef.current) return;
      // Wait for real layout size — Mapbox paints blank/black at 0×0.
      if (container.clientWidth < 2 || container.clientHeight < 2) return;

      mapboxgl.accessToken = token;
      const start = initialMapView();
      map = new mapboxgl.Map({
        container,
        style: SATELLITE_STYLE,
        center: start.center,
        zoom: start.zoom,
        attributionControl: false,
        collectResourceTiming: false,
        failIfMajorPerformanceCaveat: false,
      });
      mapRef.current = map;

      const draw = new MapboxDraw({
        displayControlsDefault: false,
        controls: { polygon: true, trash: true },
        defaultMode: "draw_polygon",
      });
      drawRef.current = draw;

      const resize = () => {
        if (!removed && mapRef.current) mapRef.current.resize();
      };

      map.on("load", () => {
        if (removed) return;
        setMapError(false);
        resize();
        map!.addControl(draw, "top-left");
        map!.on("draw.create", onChange);
        map!.on("draw.update", onChange);
        map!.on("draw.delete", onChange);
        timers.push(window.setTimeout(resize, 50));
        timers.push(window.setTimeout(resize, 250));
        void goToDevice(LOCATE_ZOOM);
      });
      map.on("error", () => {
        if (!removed) setMapError(true);
      });
    };

    boot();
    ro = new ResizeObserver(() => {
      boot();
      if (mapRef.current) mapRef.current.resize();
    });
    ro.observe(container);
    if (shell) ro.observe(shell);
    timers.push(window.setTimeout(boot, 0));
    timers.push(window.setTimeout(boot, 120));

    return () => {
      removed = true;
      for (const id of timers) window.clearTimeout(id);
      ro?.disconnect();
      map?.remove();
      mapRef.current = null;
      drawRef.current = null;
    };
  }, [token]);

  function useMyLocation() {
    if (!mapRef.current) return;
    setLocating(true);
    void requestDeviceLocation()
      .then((pos) => {
        const center: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        writeLastMapCenter(center[0], center[1], DRAW_LOCATE_ZOOM);
        onCenterChangeRef.current?.(center[0], center[1]);
        mapRef.current?.easeTo({ center, zoom: DRAW_LOCATE_ZOOM, duration: 700 });
      })
      .finally(() => setLocating(false));
  }

  return (
    <div className={cn("flex w-full flex-col", className)}>
      <div
        ref={shellRef}
        className={cn(
          "relative h-[58dvh] min-h-[320px] w-full overflow-hidden bg-muted md:h-[62dvh]",
          fullBleed ? "rounded-none border-y border-line" : "rounded-[18px] border border-line",
        )}
      >
        <div ref={containerRef} className="absolute inset-0 h-full w-full" />
        <button
          type="button"
          onClick={useMyLocation}
          disabled={locating}
          className="absolute top-2.5 right-2.5 z-10 inline-flex h-8 items-center gap-1.5 rounded-full bg-ink px-3 text-ap-pill font-bold text-white disabled:opacity-60"
        >
          <Navigation className="size-3.5" aria-hidden />
          {locating ? t("locating") : t("useMyLocation")}
        </button>
        <div className="absolute bottom-2.5 left-2.5 z-10 inline-flex max-w-[85%] items-center gap-1.5 rounded-full bg-white px-2.5 py-1.5 shadow-sm">
          <MapPin className="size-3.5 shrink-0 text-ink" aria-hidden />
          <span className="truncate text-ap-small font-bold text-ink">
            {areaHa != null
              ? t("areaWithHa", {
                  label: placeLabel ?? t("drawHintShort"),
                  n: formatStremmata(areaHa),
                })
              : (placeLabel ?? t("drawHintShort"))}
          </span>
        </div>
      </div>
      {mapError ? <p className="mt-1 text-sm text-destructive">{t("mapError")}</p> : null}
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
