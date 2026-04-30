"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { LockKeyhole, ShieldAlert } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Panel, StatusBadge } from "@/components/ui";
import { WorkspaceProvider, useWorkspace } from "@/components/workspace-context";
import { useAuth } from "@/components/auth-context";
import { getRequiredPermissionForPath } from "@/lib/auth";

export function WorkspaceGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { can, currentUser, homePath, isAuthenticated, isReady } = useAuth();

  useEffect(() => {
    if (!isReady || isAuthenticated) {
      return;
    }

    router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [isAuthenticated, isReady, pathname, router]);

  if (!isReady || !isAuthenticated || !currentUser) {
    return (
      <div className="workspace-light flex min-h-screen items-center justify-center px-4">
        <Panel className="w-full max-w-lg">
          <div className="flex items-start gap-4">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-black text-white">
              <LockKeyhole className="size-5" />
            </div>
            <div className="space-y-2">
              <h1 className="font-display text-2xl font-semibold text-stone-950">
                Chargement de votre espace
              </h1>
              <p className="text-sm leading-6 text-stone-600">
                Verification de la session et preparation des acces projet.
              </p>
            </div>
          </div>
        </Panel>
      </div>
    );
  }

  const requiredPermission = getRequiredPermissionForPath(pathname);
  const isAuthorized = can(requiredPermission);

  if (!isAuthorized) {
    return (
      <div className="workspace-light flex min-h-screen items-center justify-center px-4">
        <Panel className="w-full max-w-xl">
          <div className="flex items-start gap-4">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-700">
              <ShieldAlert className="size-5" />
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <StatusBadge tone="danger">Acces limite</StatusBadge>
                <h1 className="font-display text-2xl font-semibold text-stone-950">
                  Cette page n&apos;est pas disponible pour votre role
                </h1>
                <p className="text-sm leading-6 text-stone-600">
                  Votre compte {currentUser.role.toLowerCase()} n&apos;a pas les droits
                  necessaires pour ouvrir cette section.
                </p>
              </div>
              <Link
                href={homePath}
                className="inline-flex rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white hover:bg-stone-800"
              >
                Retour a votre espace
              </Link>
            </div>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <WorkspaceProvider>
      <WorkspaceReadyShell>{children}</WorkspaceReadyShell>
    </WorkspaceProvider>
  );
}

function WorkspaceReadyShell({ children }: { children: React.ReactNode }) {
  const workspace = useWorkspace();

  if (workspace.error) {
    return (
      <div className="workspace-light flex min-h-screen items-center justify-center px-4">
        <Panel className="w-full max-w-lg">
          <div className="flex items-start gap-4">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-700">
              <ShieldAlert className="size-5" />
            </div>
            <div className="space-y-2">
              <h1 className="font-display text-2xl font-semibold text-stone-950">
                Impossible de charger votre espace
              </h1>
              <p className="text-sm leading-6 text-stone-600">{workspace.error}</p>
            </div>
          </div>
        </Panel>
      </div>
    );
  }

  if (!workspace.isReady) {
    return (
      <div className="workspace-light flex min-h-screen items-center justify-center px-4">
        <Panel className="w-full max-w-lg">
          <div className="flex items-start gap-4">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-black text-white">
              <LockKeyhole className="size-5" />
            </div>
            <div className="space-y-2">
              <h1 className="font-display text-2xl font-semibold text-stone-950">
                Chargement des projets accessibles
              </h1>
              <p className="text-sm leading-6 text-stone-600">
                Synchronisation de votre espace de travail et des permissions projet.
              </p>
            </div>
          </div>
        </Panel>
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
