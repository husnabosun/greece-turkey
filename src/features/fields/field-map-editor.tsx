"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl, { type StyleSpecification } from "mapbox-gl";
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

/**
 * True satellite basemap without Mapbox raster tiles.
 * Mapbox free-tier was returning 429 on mapbox.satellite → black map + false "rate limit" UI.
 * Esri World Imagery serves real orthophoto tiles (Mapbox GL still needs a token for the JS SDK).
 */
const SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  name: "AgroPulse Satellite",
  sources: {
    "esri-world-imagery": {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution:
        "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: "esri-world-imagery",
      type: "raster",
      source: "esri-world-imagery",
      minzoom: 0,
      maxzoom: 22,
    },
  ],
};

/** Interactive satellite polygon drawer for olive grove boundaries. */
export function FieldMapEditor({ token, onPolygonChange }: Props) {
  const t = useTranslations("farmerFields");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onPolygonChangeRef = useRef(onPolygonChange);
  const [areaHa, setAreaHa] = useState<number | null>(null);
  const [mapError, setMapError] = useState(false);

  useEffect(() => {
    onPolygonChangeRef.current = onPolygonChange;
  }, [onPolygonChange]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !token) return;

    let removed = false;
    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container,
      style: SATELLITE_STYLE,
      center: [26.7, 39.325],
      zoom: 14,
      attributionControl: true,
      // No Mapbox-hosted styles/tiles → no Mapbox 429 storm on load.
      collectResourceTiming: false,
    });

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: { polygon: true, trash: true },
      defaultMode: "draw_polygon",
    });

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

    const onMapError = () => {
      if (!removed) setMapError(true);
    };

    map.on("load", () => {
      if (removed) return;
      setMapError(false);
      map.addControl(draw);
      map.addControl(new mapboxgl.NavigationControl({ visualizePitch: false }), "top-right");
      map.on("draw.create", onChange);
      map.on("draw.update", onChange);
      map.on("draw.delete", onChange);
    });
    map.on("error", onMapError);

    return () => {
      removed = true;
      map.remove();
    };
  }, [token]);

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className="h-80 w-full overflow-hidden rounded-xl border bg-muted md:h-[min(70vh,40rem)]"
      />
      {mapError ? <p className="text-sm text-destructive">{t("mapError")}</p> : null}
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
