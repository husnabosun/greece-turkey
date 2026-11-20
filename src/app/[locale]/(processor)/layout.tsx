import type { ReactNode } from "react";
import { ProcessorShell } from "@/features/auth/processor-shell";

export default function ProcessorLayout({ children }: { children: ReactNode }) {
  return <ProcessorShell>{children}</ProcessorShell>;
}
