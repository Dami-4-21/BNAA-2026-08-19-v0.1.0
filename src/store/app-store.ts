"use client";

import { create } from "zustand";

import type { SafeUser } from "@/lib/auth";

type AppStoreState = {
  currentUser: SafeUser | null;
  isAuthReady: boolean;
  profileOpen: boolean;
  notificationsOpen: boolean;
  searchOpen: boolean;
  searchQuery: string;
  selectedProjectIds: Record<string, string>;
  sidebarCollapsed: boolean;
  setCurrentUser: (user: SafeUser | null) => void;
  setAuthReady: (isReady: boolean) => void;
  resetAuthState: () => void;
  setSelectedProjectId: (userId: string, projectId: string) => void;
  clearSelectedProjectId: (userId: string) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setProfileOpen: (open: boolean) => void;
  setNotificationsOpen: (open: boolean) => void;
  setSearchOpen: (open: boolean) => void;
  setSearchQuery: (query: string) => void;
};

export const useAppStore = create<AppStoreState>((set) => ({
  currentUser: null,
  isAuthReady: false,
  sidebarCollapsed: false,
  profileOpen: false,
  notificationsOpen: false,
  searchOpen: false,
  searchQuery: "",
  selectedProjectIds: {},
  setCurrentUser: (user) => set({ currentUser: user }),
  setAuthReady: (isReady) => set({ isAuthReady: isReady }),
  resetAuthState: () =>
    set({
      currentUser: null,
      isAuthReady: false,
      profileOpen: false,
      notificationsOpen: false,
      searchOpen: false,
      searchQuery: "",
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
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
  setProfileOpen: (profileOpen) => set({ profileOpen }),
  setNotificationsOpen: (notificationsOpen) => set({ notificationsOpen }),
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
}));
