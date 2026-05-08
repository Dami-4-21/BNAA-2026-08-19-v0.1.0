"use client";

import {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useMemo,
} from "react";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/components/auth-context";
import { type AppPermission } from "@/lib/auth";
import {
  fetchWorkspace,
  readStoredActiveProjectId,
  workspaceQueryKey,
  writeStoredActiveProjectId,
} from "@/lib/queries/workspace";
import type { TenantRecord, WorkspaceProject } from "@/lib/backend/types";
import { useAppStore } from "@/store/app-store";

type WorkspaceContextValue = {
  isReady: boolean;
  hasProjects: boolean;
  error: string;
  tenant: TenantRecord;
  currentUser: NonNullable<ReturnType<typeof useAuth>["currentUser"]>;
  availableProjects: WorkspaceProject[];
  activeProject: WorkspaceProject;
  setActiveProjectId: (projectId: string) => void;
  refreshWorkspace: () => Promise<void>;
  permissions: AppPermission[];
  can: (permission: AppPermission) => boolean;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

const placeholderTenant: TenantRecord = {
  name: "BnaaSaaS",
  sector: "",
  users: 0,
  activeProjects: 0,
};

const placeholderProject: WorkspaceProject = {
  id: "",
  name: "",
  code: "",
  client: "",
  location: "",
  status: "",
  progress: 0,
  budgetTnd: 0,
  spentTnd: 0,
  invoicesDue: 0,
  nextMilestone: "",
  allowedRoles: [],
};

export function WorkspaceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { can, currentUser, permissions } = useAuth();
  if (!currentUser) {
    throw new Error("WorkspaceProvider requires an authenticated user");
  }
  const currentUserId = currentUser.id;
  const selectedProjectId = useAppStore(
    (state) => state.selectedProjectIds[currentUserId] ?? "",
  );
  const setSelectedProjectId = useAppStore((state) => state.setSelectedProjectId);
  const clearSelectedProjectId = useAppStore((state) => state.clearSelectedProjectId);

  const workspaceQuery = useQuery({
    queryKey: workspaceQueryKey(currentUserId),
    queryFn: fetchWorkspace,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const workspace = workspaceQuery.data ?? null;
  const error = workspaceQuery.error instanceof Error
    ? workspaceQuery.error.message
    : workspaceQuery.isError
      ? "Impossible de charger les projets accessibles."
      : "";

  const availableProjects = useMemo(() => workspace?.availableProjects ?? [], [workspace]);
  const fallbackProject = availableProjects[0] ?? null;
  const activeProjectId = useMemo(() => {
    if (availableProjects.some((project) => project.id === selectedProjectId)) {
      return selectedProjectId;
    }

    const storedProjectId = readStoredActiveProjectId(currentUserId);
    if (availableProjects.some((project) => project.id === storedProjectId)) {
      return storedProjectId;
    }

    return fallbackProject?.id ?? "";
  }, [availableProjects, currentUserId, fallbackProject?.id, selectedProjectId]);
  const activeProject =
    availableProjects.find((project) => project.id === activeProjectId) ?? fallbackProject;

  const hasPermission = useCallback(
    (permission: AppPermission) => can(permission),
    [can],
  );

  const setActiveProjectId = useCallback(
    (projectId: string) => {
      setSelectedProjectId(currentUserId, projectId);
      writeStoredActiveProjectId(currentUserId, projectId);
    },
    [currentUserId, setSelectedProjectId],
  );

  const refreshWorkspace = useCallback(async () => {
    await workspaceQuery.refetch();
  }, [workspaceQuery]);

  useEffect(() => {
    if (workspaceQuery.isPending) {
      return;
    }

    if (activeProjectId && activeProjectId !== selectedProjectId) {
      setSelectedProjectId(currentUserId, activeProjectId);
      return;
    }

    if (!activeProjectId && selectedProjectId) {
      clearSelectedProjectId(currentUserId);
    }
  }, [
    activeProjectId,
    clearSelectedProjectId,
    currentUserId,
    selectedProjectId,
    setSelectedProjectId,
    workspaceQuery.isPending,
  ]);

  const value = useMemo(
    () => ({
      isReady: workspaceQuery.isSuccess,
      hasProjects: availableProjects.length > 0,
      error,
      tenant: workspace?.tenant ?? placeholderTenant,
      currentUser,
      availableProjects,
      activeProject: activeProject ?? placeholderProject,
      setActiveProjectId,
      refreshWorkspace,
      permissions,
      can: hasPermission,
    }),
    [
      activeProject,
      availableProjects,
      currentUser,
      error,
      hasPermission,
      permissions,
      refreshWorkspace,
      setActiveProjectId,
      workspace,
      workspaceQuery.isSuccess,
    ],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);

  if (!context) {
    throw new Error("useWorkspace must be used inside WorkspaceProvider");
  }

  return context;
}
