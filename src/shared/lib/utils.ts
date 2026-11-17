import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Tailwind class merger (shadcn pattern).
 * Uses clsx + tailwind-merge so conflicting utilities (px-2 vs px-5, font-medium vs font-bold)
 * resolve correctly — the old `cn` package re-export could leave buttons/pills looking oversized
 * and not bold when classes conflicted.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
