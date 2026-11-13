"use client";

import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

export function Chip({
  on,
  onClick,
  children,
  tone = "green",
  className,
}: {
  on: boolean;
  onClick?: () => void;
  children: ReactNode;
  tone?: "green" | "black";
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-[30px] flex-row items-center gap-1.5 rounded-full border px-3 whitespace-nowrap",
        on
          ? tone === "black"
            ? "border-ink bg-ink text-white"
            : "border-primary bg-primary text-white"
          : "border-line bg-card text-ink",
        className,
      )}
    >
      {children}
    </button>
  );
}

export type FieldChipItem = { id: string; name: string; color?: string };

export function FieldChips({
  fields,
  selected,
  onSelect,
  showAll = false,
  allLabel,
  tone = "green",
  trailing,
}: {
  fields: FieldChipItem[];
  selected: string | "all";
  onSelect: (id: string | "all") => void;
  showAll?: boolean;
  allLabel?: string;
  tone?: "green" | "black";
  trailing?: ReactNode;
}) {
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {showAll ? (
        <Chip on={selected === "all"} tone={tone} onClick={() => onSelect("all")}>
          <span className={cn("text-ap-pill font-bold", selected === "all" ? "text-white" : "text-ink")}>
            {allLabel ?? `All · ${fields.length}`}
          </span>
        </Chip>
      ) : null}
      {fields.map((f) => {
        const active = selected === f.id;
        return (
          <Chip key={f.id} on={active} tone={tone} onClick={() => onSelect(f.id)}>
            <span className="size-2 rounded-full" style={{ backgroundColor: f.color ?? "#3F6B2F" }} />
            <span className={cn("text-ap-pill font-bold", active ? "text-white" : "text-ink")}>{f.name}</span>
          </Chip>
        );
      })}
      {trailing}
    </div>
  );
}
