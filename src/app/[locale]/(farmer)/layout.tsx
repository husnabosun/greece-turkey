import type { ReactNode } from "react";
import { FarmerShell } from "@/features/auth/farmer-shell";

export default function FarmerLayout({ children }: { children: ReactNode }) {
  return <FarmerShell>{children}</FarmerShell>;
}
