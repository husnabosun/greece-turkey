import type { CaptureMode } from "@/features/diagnostics/scan-types";
import type { FarmerTask } from "@/features/tasks/use-farmer-tasks";

type ScanCameraOpts = {
  fieldId?: string | null;
  treeId?: string | null;
  taskId?: string | null;
  mode?: CaptureMode;
};

/** Pick capture mode from a task (leaf/trap/fruit). */
export function scanModeForTask(task: FarmerTask): CaptureMode {
  if (task.kind === "recheck") return "leaf";
  if (task.kind !== "photo") return "leaf";
  const hay = `${task.title} ${task.meta ?? ""}`.toLowerCase();
  if (/trap|fly|παγίδ|δάκ|dakos|olive.?fly/.test(hay)) return "trap";
  if (/fruit|καρπ|στιγμ|sting/.test(hay)) return "fruit";
  return "leaf";
}

/** Build `/farmer/scan` path that opens the camera with field/task preselected. */
export function scanCameraHref(opts: ScanCameraOpts = {}): string {
  const params = new URLSearchParams();
  params.set("camera", "1");
  if (opts.fieldId) params.set("fieldId", opts.fieldId);
  if (opts.treeId) params.set("treeId", opts.treeId);
  if (opts.taskId) params.set("taskId", opts.taskId);
  if (opts.mode) params.set("mode", opts.mode);
  return `/farmer/scan?${params.toString()}`;
}

export function scanCameraHrefForTask(task: FarmerTask): string {
  return scanCameraHref({
    fieldId: task.fieldId,
    treeId: task.treeId,
    taskId: task.id,
    mode: scanModeForTask(task),
  });
}
