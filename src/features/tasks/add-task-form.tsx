"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { createFarmerTask, type FarmerTask } from "@/features/tasks/use-farmer-tasks";
import { cn } from "@/shared/lib/utils";

type FieldOption = { id: string; name: string };

export function AddTaskForm({
  fields,
  onCreated,
  className,
}: {
  fields: FieldOption[];
  onCreated: (task: FarmerTask) => void;
  className?: string;
}) {
  const t = useTranslations("farmerTasks");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [fieldId, setFieldId] = useState(fields[0]?.id ?? "");
  const [busy, setBusy] = useState(false);

  const options = useMemo(() => fields, [fields]);

  if (options.length === 0) return null;

  async function submit() {
    if (!title.trim() || !fieldId || busy) return;
    setBusy(true);
    try {
      const result = await createFarmerTask({ fieldId, title, kind: "plain" });
      if (!result.ok) {
        toast.error(t(result.error === "needLogin" || result.error === "needSupabase" ? result.error : "actionFailed"));
        return;
      }
      toast.success(t("addedOk"));
      onCreated(result.task);
      setTitle("");
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setFieldId(options[0]?.id ?? "");
          setOpen(true);
        }}
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-card px-3 text-ap-pill font-bold text-ink",
          className,
        )}
      >
        <Plus className="size-4" aria-hidden />
        {t("addTask")}
      </button>
    );
  }

  return (
    <div className={cn("rounded-[18px] border border-line bg-card p-3", className)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-ap-body font-extrabold text-ink">{t("addTask")}</p>
        <button
          type="button"
          aria-label={t("cancel")}
          onClick={() => setOpen(false)}
          className="flex size-8 items-center justify-center rounded-full border border-line"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <label className="block text-ap-small font-bold text-muted-foreground">
        {t("taskTitle")}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("taskTitlePlaceholder")}
          className="mt-1 h-10 w-full rounded-xl border border-line bg-white px-3 text-ap-body text-ink outline-none focus:border-ink"
        />
      </label>
      <label className="mt-2 block text-ap-small font-bold text-muted-foreground">
        {t("taskField")}
        <select
          value={fieldId}
          onChange={(e) => setFieldId(e.target.value)}
          className="mt-1 h-10 w-full rounded-xl border border-line bg-white px-3 text-ap-body text-ink outline-none focus:border-ink"
        >
          {options.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        disabled={busy || !title.trim()}
        onClick={() => void submit()}
        className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-full bg-ink text-ap-pill font-bold text-white disabled:opacity-50"
      >
        {t("saveTask")}
      </button>
    </div>
  );
}
