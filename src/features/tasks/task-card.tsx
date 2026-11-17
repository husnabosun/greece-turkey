"use client";

import type { ReactNode } from "react";
import { Camera, Check, Droplet, RefreshCw, Sparkles } from "lucide-react";
import type { FarmerTask } from "@/features/tasks/use-farmer-tasks";
import { colors } from "@/shared/theme/tokens";
import { cn } from "@/shared/lib/utils";

const ICON: Record<FarmerTask["kind"], { bg: string; node: ReactNode }> = {
  photo: { bg: "bg-risk-soft", node: <Camera className="size-[18px]" style={{ color: colors.risk }} /> },
  spray: { bg: "bg-warn-soft", node: <Droplet className="size-[18px]" style={{ color: "#A9831F" }} /> },
  recheck: { bg: "bg-ap-accent-soft", node: <RefreshCw className="size-[18px]" style={{ color: colors.accent }} /> },
  plain: { bg: "bg-good-soft", node: <Check className="size-[18px]" style={{ color: colors.good }} /> },
};

export type TaskCardLabels = {
  takePhoto: string;
  yesAdd: string;
  no: string;
  recheckNow: string;
  markDone: string;
};

export function TaskCard({
  task,
  busy,
  onPhoto,
  onSprayYes,
  onSprayNo,
  onRecheck,
  onPlain,
  labels,
  compact,
}: {
  task: FarmerTask;
  busy: boolean;
  onPhoto: () => void;
  onSprayYes: () => void;
  onSprayNo: () => void;
  onRecheck: () => void;
  onPlain: () => void;
  labels: TaskCardLabels;
  /** Slightly tighter padding for Home. */
  compact?: boolean;
}) {
  const icon = ICON[task.kind] ?? ICON.plain;
  const meta = [task.meta, task.fieldName, task.dueOn].filter(Boolean).join(" · ");

  return (
    <div
      className={cn(
        "rounded-[18px] border border-line bg-card",
        compact ? "p-3" : "p-3.5",
        task.urgent && "border-[#EDBBAA] bg-[#FDF5F1]",
      )}
    >
      <div className="flex items-start gap-2.5">
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", icon.bg)}>
          {icon.node}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-ap-body font-extrabold text-ink">{task.title}</p>
              {meta ? <p className="text-ap-small text-muted-foreground">{meta}</p> : null}
            </div>
            <span className="rounded-lg bg-good-soft px-2 py-0.5 text-ap-small font-extrabold text-good">+1</span>
          </div>
          {task.why ? (
            <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-soft p-2">
              <Sparkles className="mt-0.5 size-3.5 shrink-0 text-good" aria-hidden />
              <p className="text-ap-small text-ink">{task.why}</p>
            </div>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            {task.kind === "photo" ? (
              <ActionBtn disabled={busy} onClick={onPhoto} icon={<Camera className="size-4" />}>
                {labels.takePhoto}
              </ActionBtn>
            ) : task.kind === "spray" ? (
              <>
                <ActionBtn disabled={busy} onClick={onSprayYes}>
                  {labels.yesAdd}
                </ActionBtn>
                <ActionBtn disabled={busy} outline onClick={onSprayNo}>
                  {labels.no}
                </ActionBtn>
              </>
            ) : task.kind === "recheck" ? (
              <ActionBtn disabled={busy} onClick={onRecheck} icon={<RefreshCw className="size-4" />}>
                {labels.recheckNow}
              </ActionBtn>
            ) : (
              <ActionBtn disabled={busy} onClick={onPlain}>
                {labels.markDone}
              </ActionBtn>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionBtn({
  children,
  onClick,
  disabled,
  outline,
  icon,
}: {
  children: string;
  onClick: () => void;
  disabled?: boolean;
  outline?: boolean;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-1.5 rounded-full px-4 text-ap-pill font-bold disabled:opacity-50",
        outline ? "border border-line bg-card text-ink" : "bg-ink text-white",
      )}
    >
      {icon}
      {children}
    </button>
  );
}
