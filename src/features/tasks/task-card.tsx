"use client";

import type { ReactNode } from "react";
import { Camera, Check, Droplet, RefreshCw, Sparkles, Trash2 } from "lucide-react";
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
  dismiss: string;
};

export function TaskCard({
  task,
  busy,
  onPhoto,
  onSprayYes,
  onSprayNo,
  onRecheck,
  onPlain,
  onDismiss,
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
  onDismiss: () => void;
  labels: TaskCardLabels;
  compact?: boolean;
}) {
  const icon = ICON[task.kind] ?? ICON.plain;
  const detail = [task.meta, task.dueOn].filter(Boolean).join(" · ");

  return (
    <div
      className={cn(
        "relative rounded-[18px] border border-line bg-card transition-colors duration-150 hover:border-ink/20",
        compact ? "p-3" : "p-3.5",
        task.urgent && "border-[#EDBBAA] bg-[#FDF5F1] hover:border-[#E09A84]",
      )}
    >
      <div className="flex items-start gap-2.5">
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", icon.bg)}>
          {icon.node}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 pr-8">
              <p className="text-ap-body font-extrabold text-ink">{task.title}</p>
              {task.fieldName ? (
                <p className="text-ap-small font-bold text-ink/80">{task.fieldName}</p>
              ) : null}
              {detail ? <p className="text-ap-small text-muted-foreground">{detail}</p> : null}
            </div>
            <span className="absolute top-3 right-3 rounded-lg bg-good-soft px-2 py-0.5 text-ap-small font-extrabold text-good">
              +1
            </span>
          </div>
          {task.why ? (
            <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-soft p-2">
              <Sparkles className="mt-0.5 size-3.5 shrink-0 text-good" aria-hidden />
              <p className="text-ap-small text-ink">{task.why}</p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="relative z-10 mt-3 flex items-end justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {task.kind === "photo" ? (
            <ActionBtn disabled={busy} onClick={onPhoto} icon={<Camera className="size-4" />}>
              {labels.takePhoto}
            </ActionBtn>
          ) : null}
          {task.kind === "spray" ? (
            <>
              <ActionBtn disabled={busy} onClick={onSprayYes}>
                {labels.yesAdd}
              </ActionBtn>
              <ActionBtn disabled={busy} outline onClick={onSprayNo}>
                {labels.no}
              </ActionBtn>
            </>
          ) : null}
          {task.kind === "recheck" ? (
            <ActionBtn disabled={busy} onClick={onRecheck} icon={<RefreshCw className="size-4" />}>
              {labels.recheckNow}
            </ActionBtn>
          ) : null}
          {task.kind === "plain" ? (
            <ActionBtn disabled={busy} onClick={onPlain}>
              {labels.markDone}
            </ActionBtn>
          ) : null}
        </div>

        <button
          type="button"
          disabled={busy}
          aria-label={labels.dismiss}
          title={labels.dismiss}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (busy) return;
            onDismiss();
          }}
          className={cn(
            "relative z-10 ml-auto flex size-10 shrink-0 touch-manipulation items-center justify-center rounded-full border border-transparent text-[#9A6B62] transition-colors duration-150",
            "hover:border-[#EDBBAA] hover:bg-[#FDF5F1] hover:text-[#C44B3A]",
            "active:scale-95 active:bg-[#F8E8E2]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E09A84]/60",
            "disabled:pointer-events-none disabled:opacity-40",
          )}
        >
          <Trash2 className="size-[18px]" aria-hidden />
        </button>
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
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (disabled) return;
        onClick();
      }}
      className={cn(
        "relative z-10 inline-flex min-h-10 min-w-[4.5rem] touch-manipulation items-center justify-center gap-1.5 rounded-full px-4 text-ap-pill font-bold select-none transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/25",
        "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
        outline
          ? "border-2 border-ink/20 bg-white text-ink hover:border-ink/45 hover:bg-soft"
          : "bg-ink text-white hover:bg-[#2A2A2A] hover:shadow-[0_2px_8px_rgba(0,0,0,0.18)]",
      )}
    >
      {icon}
      {children}
    </button>
  );
}
