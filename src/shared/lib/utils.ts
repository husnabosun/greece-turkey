import { cn as cnBase } from "cn";

/** Tailwind class merger (shadcn `cn` engine). */
export function cn(...inputs: Parameters<typeof cnBase>) {
  return cnBase(...inputs);
}
