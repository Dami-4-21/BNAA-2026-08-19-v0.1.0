"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
} from "react";

import { currentUser, workspaceProjects } from "@/lib/mock-data";

type WorkspaceProject = (typeof workspaceProjects)[number];

type WorkspaceContextValue = {
  currentUser: typeof currentUser;
  availableProjects: WorkspaceProject[];
  activeProject: WorkspaceProject;
  setActiveProjectId: (projectId: string) => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const availableProjects = useMemo(
    () =>
      workspaceProjects.filter((project) =>
        project.allowedRoles.includes(currentUser.role),
      ),
    [],
  );

  const [activeProjectId, setActiveProjectId] = useState(availableProjects[0]?.id ?? "");

  const activeProject =
    availableProjects.find((project) => project.id === activeProjectId) ??
    availableProjects[0];

  const value = useMemo(
    () => ({
      currentUser,
      availableProjects,
      activeProject,
      setActiveProjectId,
    }),
    [activeProject, availableProjects],
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
