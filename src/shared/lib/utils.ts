import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * Tailwind class merger (shadcn pattern).
 * Custom `text-ap-*` tokens are font-size utilities — without extendTailwindMerge,
 * twMerge treats them as text-color and strips them when other text-* classes win.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["ap-title", "ap-card", "ap-body", "ap-small", "ap-pill", "ap-btn"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
