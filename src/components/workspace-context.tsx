"use client";

import {
  useCallback,
  createContext,
  useContext,
  useMemo,
  useState,
} from "react";

import { useAuth } from "@/components/auth-context";
import {
  canAccessProject,
  type AppPermission,
} from "@/lib/auth";
import { workspaceProjects } from "@/lib/mock-data";

type WorkspaceProject = (typeof workspaceProjects)[number];

type WorkspaceContextValue = {
  currentUser: NonNullable<ReturnType<typeof useAuth>["currentUser"]>;
  availableProjects: WorkspaceProject[];
  activeProject: WorkspaceProject;
  setActiveProjectId: (projectId: string) => void;
  permissions: AppPermission[];
  can: (permission: AppPermission) => boolean;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { can, currentUser, permissions } = useAuth();
  if (!currentUser) {
    throw new Error("WorkspaceProvider requires an authenticated user");
  }

  const availableProjects = useMemo(
    () =>
      workspaceProjects.filter((project) =>
        project.allowedRoles.includes(currentUser.role) &&
        canAccessProject(currentUser, project.id),
      ),
    [currentUser],
  );

  const [selectedProjectId, setSelectedProjectId] = useState(availableProjects[0]?.id ?? "");

  const fallbackProject = availableProjects[0] ?? workspaceProjects[0];
  const activeProjectId = availableProjects.some((project) => project.id === selectedProjectId)
    ? selectedProjectId
    : fallbackProject.id;
  const activeProject =
    availableProjects.find((project) => project.id === activeProjectId) ??
    fallbackProject;

  const hasPermission = useCallback(
    (permission: AppPermission) => can(permission),
    [can],
  );

  const value = useMemo(
    () => ({
      currentUser,
      availableProjects,
      activeProject,
      setActiveProjectId: setSelectedProjectId,
      permissions,
      can: hasPermission,
    }),
    [activeProject, availableProjects, currentUser, hasPermission, permissions],
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
