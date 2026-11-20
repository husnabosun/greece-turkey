"use client";

import { create } from "zustand";
import type { UserRole } from "@/core/config/constants";

interface UiState {
  activeRole: UserRole | null;
  activeFieldId: string | null;
  setActiveRole: (role: UserRole | null) => void;
  setActiveFieldId: (fieldId: string | null) => void;
}

/** Client UI state only — domain data lives in Supabase. */
export const useUiStore = create<UiState>((set) => ({
  activeRole: null,
  activeFieldId: null,
  setActiveRole: (activeRole) => set({ activeRole }),
  setActiveFieldId: (activeFieldId) => set({ activeFieldId }),
}));
