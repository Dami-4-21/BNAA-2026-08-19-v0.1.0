"use client";

import { create } from "zustand";

import type { SafeUser } from "@/lib/auth";

type AppStoreState = {
  currentUser: SafeUser | null;
  isAuthReady: boolean;
  selectedProjectIds: Record<string, string>;
  setCurrentUser: (user: SafeUser | null) => void;
  setAuthReady: (isReady: boolean) => void;
  resetAuthState: () => void;
  setSelectedProjectId: (userId: string, projectId: string) => void;
  clearSelectedProjectId: (userId: string) => void;
};

export const useAppStore = create<AppStoreState>((set) => ({
  currentUser: null,
  isAuthReady: false,
  selectedProjectIds: {},
  setCurrentUser: (user) => set({ currentUser: user }),
  setAuthReady: (isReady) => set({ isAuthReady: isReady }),
  resetAuthState: () =>
    set({
      currentUser: null,
      isAuthReady: false,
    }),
  setSelectedProjectId: (userId, projectId) =>
    set((state) => ({
      selectedProjectIds: {
        ...state.selectedProjectIds,
        [userId]: projectId,
      },
    })),
  clearSelectedProjectId: (userId) =>
    set((state) => {
      const nextSelectedProjectIds = { ...state.selectedProjectIds };
      delete nextSelectedProjectIds[userId];

      return {
        selectedProjectIds: nextSelectedProjectIds,
      };
    }),
}));
