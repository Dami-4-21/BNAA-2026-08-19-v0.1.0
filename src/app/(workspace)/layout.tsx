import { AppShell } from "@/components/app-shell";
import { WorkspaceProvider } from "@/components/workspace-context";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WorkspaceProvider>
      <AppShell>{children}</AppShell>
    </WorkspaceProvider>
  );
}
