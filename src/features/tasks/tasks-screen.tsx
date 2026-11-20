"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Bell, Check, ChevronLeft } from "lucide-react";
import { scanCameraHrefForTask } from "@/features/diagnostics/open-scan-camera";
import { useFarmerFields } from "@/features/fields/use-farmer-fields";
import { AddTaskForm } from "@/features/tasks/add-task-form";
import { TaskCard } from "@/features/tasks/task-card";
import { completeTask, dismissTask, useFarmerTasks } from "@/features/tasks/use-farmer-tasks";
import { Link, useRouter } from "@/shared/i18n/navigation";

export function TasksScreen() {
  const t = useTranslations("farmerTasks");
  const router = useRouter();
  const { fields } = useFarmerFields();
  const { tasks, loading, reload, markLocalDone, removeLocal, prependLocal } = useFarmerTasks();
  const [busyId, setBusyId] = useState<string | null>(null);

  const open = tasks.filter((task) => !task.done);
  const done = tasks.filter((task) => task.done);
  const total = tasks.length;
  const doneCount = done.length;
  const pct = total ? Math.round((doneCount / total) * 100) : 0;

  async function markDone(taskId: string, message?: string) {
    setBusyId(taskId);
    markLocalDone(taskId);
    try {
      const result = await completeTask(taskId);
      if (!result.ok) {
        toast.error(result.error ?? t("actionFailed"));
        await reload();
        return;
      }
      toast.success(message ?? t("markedDone"));
    } finally {
      setBusyId(null);
    }
  }

  async function dismiss(taskId: string) {
    setBusyId(taskId);
    removeLocal(taskId);
    try {
      const result = await dismissTask(taskId);
      if (!result.ok) {
        toast.error(result.error ?? t("actionFailed"));
        await reload();
        return;
      }
      toast.success(t("dismissed"));
    } finally {
      setBusyId(null);
    }
  }

  const labels = {
    takePhoto: t("takePhoto"),
    yesAdd: t("yesAdd"),
    no: t("no"),
    recheckNow: t("recheckNow"),
    markDone: t("markDone"),
    dismiss: t("dismiss"),
  };

  return (
    <div className="w-full flex-1">
      <div className="flex items-center gap-3">
        <Link
          href="/farmer/dashboard"
          aria-label={t("back")}
          className="flex size-10 items-center justify-center rounded-full border border-line bg-card"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </Link>
        <h1 className="flex-1 text-[22px] font-extrabold tracking-tight text-ink">{t("thisWeek")}</h1>
        <Link
          href="/farmer/alerts"
          aria-label={t("alerts")}
          className="flex size-10 items-center justify-center rounded-full border border-line bg-card"
        >
          <Bell className="size-[18px]" aria-hidden />
        </Link>
      </div>

      <div className="mt-3 flex items-center gap-3 rounded-[18px] border border-line bg-card p-3.5">
        <div className="min-w-0">
          <p className="text-ap-small text-muted-foreground">{t("checksDone")}</p>
          <p className="text-ap-card font-extrabold text-ink">
            {doneCount} {t("of")} {total}
          </p>
        </div>
        <div className="mx-1 h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-soft">
          <div className="h-full rounded-full bg-good" style={{ width: `${pct}%` }} />
        </div>
        <span className="shrink-0 text-ap-body font-extrabold text-good">{t("scorePlus", { n: doneCount })}</span>
      </div>

      <div className="mt-3">
        <AddTaskForm
          fields={fields.map((f) => ({ id: f.id, name: f.name }))}
          onCreated={(task) => prependLocal(task)}
        />
      </div>

      {loading ? (
        <div className="mt-4 space-y-3">
          <div className="h-28 animate-pulse rounded-[18px] bg-soft" />
          <div className="h-28 animate-pulse rounded-[18px] bg-soft" />
        </div>
      ) : (
        <>
          {open.length === 0 ? (
            <div className="mt-4 rounded-[18px] border border-line bg-card px-4 py-6 text-center text-ap-body font-semibold text-good">
              {t("allDone")}
            </div>
          ) : null}

          <div className="mt-4 space-y-3">
            {open.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                busy={busyId === task.id}
                onPhoto={() => router.push(scanCameraHrefForTask(task))}
                onSprayYes={() => {
                  void (async () => {
                    await markDone(task.id, t("sprayNoted"));
                    router.push(`/farmer/logbook?add=1&fieldId=${encodeURIComponent(task.fieldId)}`);
                  })();
                }}
                onSprayNo={() => void markDone(task.id, t("noSprayNoted"))}
                onRecheck={() => router.push(scanCameraHrefForTask(task))}
                onPlain={() => void markDone(task.id)}
                onDismiss={() => void dismiss(task.id)}
                labels={labels}
              />
            ))}
          </div>

          <div className="mt-5">
            <p className="mb-2 text-ap-small font-bold tracking-wide text-muted-foreground uppercase">
              {t("completed")}
            </p>
            {done.length === 0 ? (
              <div className="rounded-[18px] border border-line bg-card px-4 py-6 text-center text-ap-body text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <Check className="size-4 text-good" />
                  {t("noCompleted")}
                </span>
              </div>
            ) : (
              <div className="space-y-2">
                {done.map((task) => (
                  <div
                    key={task.id}
                    className="flex h-11 items-center gap-2.5 rounded-2xl bg-[#F4F3EF] px-3"
                  >
                    <Check className="size-3.5 shrink-0 text-good" strokeWidth={3} aria-hidden />
                    <p className="min-w-0 flex-1 truncate text-ap-body font-semibold text-[#555] line-through">
                      {task.title}
                    </p>
                    <span className="shrink-0 text-ap-small text-muted-foreground">{task.fieldName ?? ""}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
