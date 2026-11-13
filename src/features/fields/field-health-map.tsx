"use client";

import { useState } from "react";
import { Crosshair, Leaf, Minus, Plus } from "lucide-react";
import { colors } from "@/shared/theme/tokens";

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

const GREENS = ["#3F6B2F", "#4B7A36", "#35602A", "#56883E"];

function Aerial() {
  const crowns = [];
  for (let r = 0; r < 13; r++) {
    for (let c = 0; c < 21; c++) {
      crowns.push(
        <circle
          key={`${r}-${c}`}
          cx={3 + c * 4.8 + (r % 2 ? 2.4 : 0)}
          cy={3 + r * 6.2}
          r={2.1}
          fill={GREENS[(r * 3 + c) % GREENS.length]}
        />,
      );
    }
  }
  return (
    <svg className="h-full w-full" viewBox="0 0 100 80" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <rect width={100} height={80} fill="#7A8F4F" />
      {crowns}
      <polygon
        points="8,16 82,10 88,40 99,50 98,76 14,78"
        fill="none"
        stroke="#fff"
        strokeWidth={0.7}
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FieldHealthMap({
  trees,
  selectedId,
  onSelect,
  showHealth,
  onToggleHealth,
  onLocate,
  labels,
  className,
}: {
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
  };
  className?: string;
}) {
  const [zoom, setZoom] = useState(1);
  const legend: { key: MapTreeStatus; label: string }[] = [
    { key: "healthy", label: labels.healthy },
    { key: "suspicious", label: labels.suspicious },
    { key: "diseased", label: labels.diseased },
  ];

  return (
    <div className={`relative h-full min-h-[280px] overflow-hidden bg-[#4B7A36] ${className ?? "rounded-[18px]"}`}>
      <div
        className="absolute inset-0 origin-center"
        style={{ transform: `scale(${zoom})` }}
      >
        <Aerial />
        {showHealth
          ? trees.map((t) => {
              const sel = t.id === selectedId;
              const size = sel ? 22 : 16;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onSelect(t.id)}
                  aria-label={labels.tree(t.id)}
                  className="absolute flex items-center justify-center"
                  style={{
                    left: `${t.x}%`,
                    top: `${t.y}%`,
                    width: size,
                    height: size,
                    marginLeft: -size / 2,
                    marginTop: -size / 2,
                  }}
                >
                  <span
                    className="block rounded-full"
                    style={{
                      width: size - 2,
                      height: size - 2,
                      borderWidth: t.status === "healthy" ? 3 : 2,
                      borderStyle: "solid",
                      borderColor: t.status === "healthy" ? colors.good : "#fff",
                      backgroundColor: t.status === "healthy" ? "#fff" : STATUS_COLOR[t.status],
                    }}
                  />
                  {sel ? (
                    <span className="absolute -top-7 rounded-full bg-ink px-2 py-0.5 text-ap-small font-bold text-white">
                      #{t.id}
                    </span>
                  ) : null}
                </button>
              );
            })
          : null}
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={showHealth}
        onClick={() => onToggleHealth(!showHealth)}
        className="absolute top-2 left-2 flex h-8 items-center gap-1.5 rounded-full bg-white px-2.5"
      >
        <Leaf className="size-3.5 text-good" aria-hidden />
        <span className="text-ap-small font-semibold text-ink">{labels.aiLayer}</span>
        <span className={`flex h-5 w-8 items-center rounded-full px-0.5 ${showHealth ? "justify-end bg-primary" : "justify-start bg-line"}`}>
          <span className="size-4 rounded-full bg-white" />
        </span>
      </button>

      <div className="absolute top-2 right-2 flex flex-col gap-1 rounded-xl bg-white px-2.5 py-2">
        {legend.map((item) => (
          <div key={item.key} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: STATUS_COLOR[item.key] }} />
            <span className="text-ap-small font-semibold text-ink">{item.label}</span>
          </div>
        ))}
      </div>

      <div className="absolute right-2 bottom-2 flex flex-col gap-1.5">
        <button
          type="button"
          aria-label={labels.locate}
          onClick={onLocate}
          className="flex size-9 items-center justify-center rounded-xl bg-white"
        >
          <Crosshair className="size-[18px] text-ink" aria-hidden />
        </button>
        <div className="overflow-hidden rounded-xl bg-white">
          <button
            type="button"
            aria-label={labels.zoomIn}
            onClick={() => setZoom((z) => Math.min(2, z + 0.25))}
            className="flex size-9 items-center justify-center"
          >
            <Plus className="size-[18px] text-ink" aria-hidden />
          </button>
          <button
            type="button"
            aria-label={labels.zoomOut}
            onClick={() => setZoom((z) => Math.max(1, z - 0.25))}
            className="flex size-9 items-center justify-center"
          >
            <Minus className="size-[18px] text-ink" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
