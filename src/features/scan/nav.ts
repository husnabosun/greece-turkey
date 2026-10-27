import type { useRouter } from 'expo-router';
import type { ScanMode } from '@/data/mock';

type Router = ReturnType<typeof useRouter>;

/** Opens the camera with field, tree and mode preselected. */
export function openCamera(router: Router, opts: { fieldId?: string; treeId?: number; mode?: ScanMode } = {}) {
  router.push({
    pathname: '/scan/camera',
    params: {
      mode: opts.mode ?? 'leaf',
      ...(opts.fieldId ? { fieldId: opts.fieldId } : {}),
      ...(opts.treeId ? { treeId: String(opts.treeId) } : {}),
    },
  });
}
