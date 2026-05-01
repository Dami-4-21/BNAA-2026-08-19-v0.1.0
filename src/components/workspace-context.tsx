"use client";

import {
  useEffect,
  useCallback,
  createContext,
  useContext,
  useMemo,
  useState,
} from "react";

import { useAuth } from "@/components/auth-context";
import { type AppPermission } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import type { TenantRecord, WorkspacePayload, WorkspaceProject } from "@/lib/backend/types";

type WorkspaceContextValue = {
  isReady: boolean;
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

  const [workspace, setWorkspace] = useState<WorkspacePayload | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [error, setError] = useState("");

  const refreshWorkspace = useCallback(async () => {
    try {
      setError("");
      const payload = await apiFetch<WorkspacePayload>("/api/workspace", {
        method: "GET",
      });

      const storedProjectId = window.localStorage.getItem(
        `bnaasaas-active-project:${currentUserId}`,
      );

      setWorkspace(payload);
      setSelectedProjectId(
        payload.availableProjects.some((project) => project.id === storedProjectId)
          ? (storedProjectId ?? "")
          : (payload.availableProjects[0]?.id ?? ""),
      );
    } catch (nextError) {
      setWorkspace(null);
      setSelectedProjectId("");
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Impossible de charger les projets accessibles.",
      );
    }
  }, [currentUserId]);

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspace() {
      await refreshWorkspace();
      if (cancelled) {
        return;
      }
    }

    void loadWorkspace();

    return () => {
      cancelled = true;
    };
  }, [currentUserId, refreshWorkspace]);

  useEffect(() => {
    function syncOnForeground() {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }

      void refreshWorkspace();
    }

    window.addEventListener("focus", syncOnForeground);
    document.addEventListener("visibilitychange", syncOnForeground);

    return () => {
      window.removeEventListener("focus", syncOnForeground);
      document.removeEventListener("visibilitychange", syncOnForeground);
    };
  }, [refreshWorkspace]);

  const availableProjects = useMemo(
    () => workspace?.availableProjects ?? [],
    [workspace],
  );
  const fallbackProject = availableProjects[0] ?? null;
  const activeProjectId = availableProjects.some((project) => project.id === selectedProjectId)
    ? selectedProjectId
    : fallbackProject?.id ?? "";
  const activeProject =
    availableProjects.find((project) => project.id === activeProjectId) ?? fallbackProject;

  const hasPermission = useCallback(
    (permission: AppPermission) => can(permission),
    [can],
  );

  const setActiveProjectId = useCallback(
    (projectId: string) => {
      setSelectedProjectId(projectId);
      window.localStorage.setItem(`bnaasaas-active-project:${currentUserId}`, projectId);
    },
    [currentUserId],
  );

  const value = useMemo(
    () => ({
      isReady: Boolean(workspace && activeProject),
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
