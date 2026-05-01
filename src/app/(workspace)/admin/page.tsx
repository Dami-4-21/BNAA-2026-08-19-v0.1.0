"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  CheckCheck,
  CheckSquare,
  FolderKanban,
  Layers3,
  MapPinned,
  Save,
  ShieldCheck,
  ShieldUser,
  Users,
  UserCog,
  UserPlus2,
  Users2,
} from "lucide-react";

import { AvatarStack, Panel, SectionHeading, StatusBadge, cx } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import type { UserRole } from "@/lib/auth";
import type { AdminPageData } from "@/lib/backend/types";
import { useWorkspace } from "@/components/workspace-context";

const roleOptions: UserRole[] = [
  "Super Admin",
  "Chef de projet",
  "Conductrice travaux",
  "Bureau d'etudes",
  "Comptable",
  "Maitre d'ouvrage",
];

const projectStatusOptions = ["Configuration", "En execution", "Phase encaissement"];

type UserDrafts = Record<
  string,
  {
    projectIds: string[];
    role: UserRole;
  }
>;

type ProjectDrafts = Record<
  string,
  {
    budgetTnd: string;
    client: string;
    location: string;
    lots: string[];
    memberIds: string[];
    name: string;
    nextMilestone: string;
    phases: string[];
    status: string;
    zones: string[];
  }
>;

function buildUserDrafts(users: AdminPageData["users"]): UserDrafts {
  return Object.fromEntries(
    users.map((user) => [
      user.id,
      {
        role: user.role,
        projectIds: [...user.projectIds],
      },
    ]),
  );
}

function sameProjectIds(left: string[], right: string[]) {
  return left.length === right.length && left.every((value) => right.includes(value));
}

function buildProjectDrafts(projects: AdminPageData["projects"]): ProjectDrafts {
  return Object.fromEntries(
    projects.map((project) => [
      project.summary.id,
      {
        name: project.summary.name,
        client: project.summary.client,
        location: project.summary.location,
        status: project.summary.status,
        budgetTnd: `${project.summary.budgetTnd}`,
        nextMilestone: project.summary.nextMilestone,
        lots: [...project.setup.lots],
        phases: [...project.setup.phases],
        zones: [...project.setup.zones],
        memberIds: [...project.setup.memberIds],
      },
    ]),
  );
}

function sameStringList(left: string[], right: string[]) {
  return left.length === right.length && left.every((value) => right.includes(value));
}

export default function AdminPage() {
  const { currentUser, refreshWorkspace } = useWorkspace();
  const [data, setData] = useState<AdminPageData | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [closingProjectId, setClosingProjectId] = useState("");
  const [projectDrafts, setProjectDrafts] = useState<ProjectDrafts>({});
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [savingProjectId, setSavingProjectId] = useState("");
  const [savingMembersProjectId, setSavingMembersProjectId] = useState("");
  const [savingUserId, setSavingUserId] = useState("");
  const [userDrafts, setUserDrafts] = useState<UserDrafts>({});
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "Comptable" as UserRole,
    projectIds: [] as string[],
  });
  const [projectForm, setProjectForm] = useState({
    name: "",
    code: "",
    client: "",
    location: "",
    status: "Configuration",
    budgetTnd: "",
    nextMilestone: "",
    lots: "",
    phases: "",
    zones: "",
  });

  useEffect(() => {
    let cancelled = false;

    async function loadAdmin() {
      try {
        const payload = await apiFetch<AdminPageData>("/api/admin", {
          method: "GET",
        });

        if (!cancelled) {
          setData(payload);
          setUserDrafts(buildUserDrafts(payload.users));
          setProjectDrafts(buildProjectDrafts(payload.projects));
          setSelectedProjectId((current) => current || payload.projects[0]?.summary.id || "");
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : "Chargement admin impossible.");
        }
      }
    }

    void loadAdmin();

    return () => {
      cancelled = true;
    };
  }, []);

  const projectCountLabel = useMemo(
    () => `${data?.availableProjects.length ?? 0}`,
    [data?.availableProjects.length],
  );
  const selectedProject = useMemo(
    () => data?.projects.find((project) => project.summary.id === selectedProjectId) ?? data?.projects[0],
    [data?.projects, selectedProjectId],
  );
  const selectedProjectDraft = selectedProject
    ? projectDrafts[selectedProject.summary.id]
    : null;

  function applyAdminPayload(payload: AdminPageData) {
    setData(payload);
    setUserDrafts(buildUserDrafts(payload.users));
    setProjectDrafts(buildProjectDrafts(payload.projects));
    setSelectedProjectId((current) =>
      payload.projects.some((project) => project.summary.id === current)
        ? current
        : (payload.projects[0]?.summary.id ?? ""),
    );
  }

  async function handleCreateUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const payload = await apiFetch<AdminPageData>("/api/admin", {
        method: "POST",
        body: {
          action: "create-user",
          payload: form,
        },
      });

      applyAdminPayload(payload);
      setSuccess("Utilisateur cree avec succes.");
      setForm({
        name: "",
        email: "",
        password: "",
        role: "Comptable",
        projectIds: [],
      });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Creation utilisateur impossible.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCreateProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCreatingProject(true);
    setError("");
    setSuccess("");

    try {
      const payload = await apiFetch<AdminPageData>("/api/admin", {
        method: "POST",
        body: {
          action: "create-project",
          payload: {
            ...projectForm,
            budgetTnd: Number(projectForm.budgetTnd || 0),
          },
        },
      });

      applyAdminPayload(payload);
      await refreshWorkspace();
      setSuccess("Projet cree et ajoute au portefeuille.");
      setProjectForm({
        name: "",
        code: "",
        client: "",
        location: "",
        status: "Configuration",
        budgetTnd: "",
        nextMilestone: "",
        lots: "",
        phases: "",
        zones: "",
      });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Creation projet impossible.");
    } finally {
      setIsCreatingProject(false);
    }
  }

  function toggleProject(projectId: string) {
    setForm((current) => ({
      ...current,
      projectIds: current.projectIds.includes(projectId)
        ? current.projectIds.filter((item) => item !== projectId)
        : [...current.projectIds, projectId],
    }));
  }

  function handleRoleChange(role: UserRole) {
    setForm((current) => ({
      ...current,
      role,
      projectIds: role === "Super Admin" ? ["*"] : current.projectIds.filter((id) => id !== "*"),
    }));
  }

  function updateUserDraft(userId: string, patch: Partial<UserDrafts[string]>) {
    setUserDrafts((current) => ({
      ...current,
      [userId]: {
        ...(current[userId] ?? { role: "Comptable" as UserRole, projectIds: [] }),
        ...patch,
      },
    }));
  }

  function toggleUserProject(userId: string, projectId: string) {
    const currentDraft = userDrafts[userId];
    if (!currentDraft || currentDraft.role === "Super Admin") {
      return;
    }

    updateUserDraft(userId, {
      projectIds: currentDraft.projectIds.includes(projectId)
        ? currentDraft.projectIds.filter((item) => item !== projectId)
        : [...currentDraft.projectIds, projectId],
    });
  }

  function updateProjectDraft(
    projectId: string,
    patch: Partial<ProjectDrafts[string]>,
  ) {
    setProjectDrafts((current) => ({
      ...current,
      [projectId]: {
        ...(current[projectId] ?? {
          name: "",
          client: "",
          location: "",
          status: "Configuration",
          budgetTnd: "",
          nextMilestone: "",
          lots: [],
          phases: [],
          zones: [],
          memberIds: [],
        }),
        ...patch,
      },
    }));
  }

  function toggleProjectMember(projectId: string, userId: string) {
    const currentDraft = projectDrafts[projectId];
    if (!currentDraft) {
      return;
    }

    updateProjectDraft(projectId, {
      memberIds: currentDraft.memberIds.includes(userId)
        ? currentDraft.memberIds.filter((entry) => entry !== userId)
        : [...currentDraft.memberIds, userId],
    });
  }

  async function saveProjectSetup(projectId: string) {
    const draft = projectDrafts[projectId];
    if (!draft) {
      return;
    }

    setSavingProjectId(projectId);
    setError("");
    setSuccess("");

    try {
      const payload = await apiFetch<AdminPageData>("/api/admin", {
        method: "POST",
        body: {
          action: "update-project-setup",
          payload: {
            projectId,
            name: draft.name,
            client: draft.client,
            location: draft.location,
            status: draft.status,
            budgetTnd: Number(draft.budgetTnd || 0),
            nextMilestone: draft.nextMilestone,
            lots: draft.lots,
            phases: draft.phases,
            zones: draft.zones,
          },
        },
      });

      applyAdminPayload(payload);
      await refreshWorkspace();
      setSuccess("Parametrage projet mis a jour.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Parametrage projet impossible.");
    } finally {
      setSavingProjectId("");
    }
  }

  async function saveProjectMembers(projectId: string) {
    const draft = projectDrafts[projectId];
    if (!draft) {
      return;
    }

    setSavingMembersProjectId(projectId);
    setError("");
    setSuccess("");

    try {
      const payload = await apiFetch<AdminPageData>("/api/admin", {
        method: "POST",
        body: {
          action: "update-project-members",
          payload: {
            projectId,
            memberIds: draft.memberIds,
          },
        },
      });

      applyAdminPayload(payload);
      await refreshWorkspace();
      setSuccess("Affectation equipe mise a jour.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Affectation equipe impossible.");
    } finally {
      setSavingMembersProjectId("");
    }
  }

  async function saveUser(userId: string) {
    const draft = userDrafts[userId];
    if (!draft) {
      return;
    }

    setSavingUserId(userId);
    setError("");
    setSuccess("");

    try {
      const payload = await apiFetch<AdminPageData>("/api/admin", {
        method: "POST",
        body: {
          action: "update-user",
          payload: {
            userId,
            role: draft.role,
            projectIds: draft.projectIds,
          },
        },
      });

      applyAdminPayload(payload);
      if (userId === currentUser.id) {
        await refreshWorkspace();
      }
      setSuccess("Acces utilisateur mis a jour.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Mise a jour utilisateur impossible.");
    } finally {
      setSavingUserId("");
    }
  }

  async function archiveProject(projectId: string) {
    setClosingProjectId(projectId);
    setError("");
    setSuccess("");

    try {
      const payload = await apiFetch<AdminPageData>("/api/admin", {
        method: "POST",
        body: {
          action: "archive-project",
          payload: {
            projectId,
          },
        },
      });

      applyAdminPayload(payload);
      await refreshWorkspace();
      setSuccess("Projet cloture avec succes.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Cloture projet impossible.");
    } finally {
      setClosingProjectId("");
    }
  }

  if (!data && !error) {
    return (
      <div className="space-y-6">
        <SectionHeading
          eyebrow="Administration"
          title="Chargement de l'espace administrateur"
          action={<StatusBadge tone="neutral">Synchronisation</StatusBadge>}
        />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <SectionHeading
          eyebrow="Administration"
          title="L'administration est indisponible"
          action={<StatusBadge tone="danger">Erreur</StatusBadge>}
        />
        <Panel>{error}</Panel>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Administration"
        title="Controle complet des acces et des projets"
        action={<StatusBadge tone="success">Super Admin</StatusBadge>}
      />

      {error ? (
        <div className="rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-700">
          {success}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel title="Acces administrateur">
          <div className="grid gap-4 md:grid-cols-3">
            <CredentialCard label="Identifiant" value="admin@bnaa.com" />
            <CredentialCard label="Mot de passe" value="admin123" />
            <CredentialCard label="Couverture" value="Acces total" />
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <MetricCard label="Utilisateurs" value={`${data.tenant.users}`} />
            <MetricCard label="Projets" value={projectCountLabel} />
            <MetricCard label="Portee" value="Modules et permissions" />
          </div>
        </Panel>

        <Panel title="Equipe active">
          <AvatarStack
            people={data.teamMembers.map((member) => ({
              initials: member.initials,
              name: member.name,
              role: member.role,
            }))}
          />
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Panel title="Creer un utilisateur">
          <form className="space-y-4" onSubmit={handleCreateUser}>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                label="Nom complet"
                value={form.name}
                onChange={(value) => setForm((current) => ({ ...current, name: value }))}
              />
              <FormField
                label="Email"
                value={form.email}
                onChange={(value) => setForm((current) => ({ ...current, email: value }))}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-[1fr_0.8fr]">
              <FormField
                label="Mot de passe"
                value={form.password}
                onChange={(value) => setForm((current) => ({ ...current, password: value }))}
              />
              <label className="rounded-[22px] border border-white/8 bg-white/4 p-4">
                <span className="text-xs uppercase tracking-[0.16em] text-slate-500">Role</span>
                <select
                  value={form.role}
                  onChange={(event) => handleRoleChange(event.target.value as UserRole)}
                  className="mt-3 w-full rounded-2xl border border-white/8 bg-black/20 px-3 py-3 text-sm text-white outline-none"
                >
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="rounded-[22px] border border-white/8 bg-white/4 p-4">
              <div className="flex items-center gap-2">
                <ShieldUser className="size-4 text-slate-400" />
                <p className="text-sm font-semibold text-white">Accessibilite projet</p>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Choisissez les projets visibles dans le SaaS pour cet utilisateur. Le super admin
                garde automatiquement l&apos;acces complet.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {data.availableProjects.map((project) => {
                  const checked =
                    form.role === "Super Admin" || form.projectIds.includes(project.id);

                  return (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() => (form.role === "Super Admin" ? null : toggleProject(project.id))}
                      className={cx(
                        "rounded-full border px-4 py-2 text-sm font-semibold",
                        checked
                          ? "border-emerald-400/30 bg-emerald-400/12 text-emerald-100"
                          : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/8",
                        form.role === "Super Admin" && "cursor-not-allowed opacity-70",
                      )}
                    >
                      {checked ? <CheckCheck className="mr-2 inline size-4" /> : null}
                      {project.name} - {project.code}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-[22px] bg-sky-400 px-4 py-4 text-sm font-semibold text-slate-950 hover:bg-sky-300"
            >
              <UserPlus2 className="size-4" />
              {isSubmitting ? "Creation en cours..." : "Creer l'utilisateur"}
            </button>
          </form>
        </Panel>

        <Panel title="Creer un projet">
          <form className="space-y-4" onSubmit={handleCreateProject}>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                label="Nom du projet"
                value={projectForm.name}
                onChange={(value) => setProjectForm((current) => ({ ...current, name: value }))}
              />
              <FormField
                label="Code projet"
                value={projectForm.code}
                onChange={(value) => setProjectForm((current) => ({ ...current, code: value }))}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                label="Client"
                value={projectForm.client}
                onChange={(value) => setProjectForm((current) => ({ ...current, client: value }))}
              />
              <FormField
                label="Localisation"
                value={projectForm.location}
                onChange={(value) => setProjectForm((current) => ({ ...current, location: value }))}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-[0.9fr_1.1fr_1fr]">
              <label className="rounded-[22px] border border-white/8 bg-white/4 p-4">
                <span className="text-xs uppercase tracking-[0.16em] text-slate-500">Statut</span>
                <select
                  value={projectForm.status}
                  onChange={(event) =>
                    setProjectForm((current) => ({ ...current, status: event.target.value }))
                  }
                  className="mt-3 w-full rounded-2xl border border-white/8 bg-black/20 px-3 py-3 text-sm text-white outline-none"
                >
                  {projectStatusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <FormField
                label="Budget (TND)"
                value={projectForm.budgetTnd}
                onChange={(value) =>
                  setProjectForm((current) => ({ ...current, budgetTnd: value }))
                }
              />
              <FormField
                label="Prochain jalon"
                value={projectForm.nextMilestone}
                onChange={(value) =>
                  setProjectForm((current) => ({ ...current, nextMilestone: value }))
                }
              />
            </div>

            <div className="grid gap-4">
              <FormField
                label="Lots (separes par des virgules)"
                value={projectForm.lots}
                onChange={(value) => setProjectForm((current) => ({ ...current, lots: value }))}
              />
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  label="Phases documentaires"
                  value={projectForm.phases}
                  onChange={(value) =>
                    setProjectForm((current) => ({ ...current, phases: value }))
                  }
                />
                <FormField
                  label="Zones chantier"
                  value={projectForm.zones}
                  onChange={(value) =>
                    setProjectForm((current) => ({ ...current, zones: value }))
                  }
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isCreatingProject}
              className="flex w-full items-center justify-center gap-2 rounded-[22px] bg-black px-4 py-4 text-sm font-semibold text-white hover:bg-stone-800"
            >
              <Building2 className="size-4" />
              {isCreatingProject ? "Creation du projet..." : "Creer le projet"}
            </button>
          </form>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Panel title="Portefeuille accessible">
          <div className="space-y-3">
            {data.projects.map((project) => (
              <div
                key={project.summary.id}
                className="rounded-[22px] border border-white/8 bg-white/4 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <FolderKanban className="mt-1 size-4 text-slate-400" />
                    <div>
                      <p className="text-sm font-semibold text-white">{project.summary.name}</p>
                      <p className="mt-1 text-sm text-slate-300">
                        {project.summary.code} - {project.summary.client}
                      </p>
                      <p className="mt-2 text-sm text-slate-400">
                        {project.summary.location} - {project.summary.nextMilestone}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
                        <span>{project.setup.lots.length} lot(s)</span>
                        <span>{project.setup.zones.length} zone(s)</span>
                        <span>{project.setup.phases.length} phase(s)</span>
                        <span>{project.memberCount} membre(s)</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge
                      tone={project.summary.status === "Cloture" ? "success" : "primary"}
                    >
                      {project.summary.status}
                    </StatusBadge>
                    <StatusBadge tone="neutral">{project.summary.progress}%</StatusBadge>
                    <button
                      type="button"
                      onClick={() => setSelectedProjectId(project.summary.id)}
                      className={cx(
                        "rounded-full px-4 py-1.5 text-xs font-semibold",
                        selectedProject?.summary.id === project.summary.id
                          ? "bg-sky-400 text-slate-950"
                          : "bg-white/10 text-white hover:bg-white/15",
                      )}
                    >
                      Configurer
                    </button>
                    {project.summary.status !== "Cloture" ? (
                      <button
                        onClick={() => void archiveProject(project.summary.id)}
                        disabled={closingProjectId === project.summary.id}
                        className={cx(
                          "rounded-full px-4 py-1.5 text-xs font-semibold",
                          closingProjectId === project.summary.id
                            ? "cursor-not-allowed bg-stone-200 text-stone-500"
                            : "bg-black text-white hover:bg-stone-800",
                        )}
                      >
                        {closingProjectId === project.summary.id ? "Cloture..." : "Cloturer"}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title="Parametrage projet"
          description="Structurez les lots, phases, zones et l'equipe d'un projet pour que le reste du SaaS reutilise ce parametre directement."
        >
          {selectedProject && selectedProjectDraft ? (
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  label="Nom du projet"
                  value={selectedProjectDraft.name}
                  onChange={(value) =>
                    updateProjectDraft(selectedProject.summary.id, { name: value })
                  }
                />
                <FormField
                  label="Client"
                  value={selectedProjectDraft.client}
                  onChange={(value) =>
                    updateProjectDraft(selectedProject.summary.id, { client: value })
                  }
                />
              </div>

              <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
                <FormField
                  label="Localisation"
                  value={selectedProjectDraft.location}
                  onChange={(value) =>
                    updateProjectDraft(selectedProject.summary.id, { location: value })
                  }
                />
                <label className="rounded-[22px] border border-white/8 bg-white/4 p-4">
                  <span className="text-xs uppercase tracking-[0.16em] text-slate-500">
                    Statut
                  </span>
                  <select
                    value={selectedProjectDraft.status}
                    onChange={(event) =>
                      updateProjectDraft(selectedProject.summary.id, {
                        status: event.target.value,
                      })
                    }
                    className="mt-3 w-full rounded-2xl border border-white/8 bg-black/20 px-3 py-3 text-sm text-white outline-none"
                  >
                    {projectStatusOptions.map((status) => (
                      <option key={`${selectedProject.summary.id}-${status}`} value={status}>
                        {status}
                      </option>
                    ))}
                    <option value="Cloture">Cloture</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-[0.85fr_1.15fr]">
                <FormField
                  label="Budget (TND)"
                  value={selectedProjectDraft.budgetTnd}
                  onChange={(value) =>
                    updateProjectDraft(selectedProject.summary.id, { budgetTnd: value })
                  }
                />
                <FormField
                  label="Prochain jalon"
                  value={selectedProjectDraft.nextMilestone}
                  onChange={(value) =>
                    updateProjectDraft(selectedProject.summary.id, {
                      nextMilestone: value,
                    })
                  }
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <TokenEditor
                  label="Lots"
                  icon={Layers3}
                  values={selectedProjectDraft.lots}
                  onChange={(values) =>
                    updateProjectDraft(selectedProject.summary.id, { lots: values })
                  }
                />
                <TokenEditor
                  label="Phases"
                  icon={FolderKanban}
                  values={selectedProjectDraft.phases}
                  onChange={(values) =>
                    updateProjectDraft(selectedProject.summary.id, { phases: values })
                  }
                />
                <TokenEditor
                  label="Zones"
                  icon={MapPinned}
                  values={selectedProjectDraft.zones}
                  onChange={(values) =>
                    updateProjectDraft(selectedProject.summary.id, { zones: values })
                  }
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => void saveProjectSetup(selectedProject.summary.id)}
                  disabled={
                    savingProjectId === selectedProject.summary.id ||
                    (selectedProjectDraft.name === selectedProject.summary.name &&
                      selectedProjectDraft.client === selectedProject.summary.client &&
                      selectedProjectDraft.location === selectedProject.summary.location &&
                      selectedProjectDraft.status === selectedProject.summary.status &&
                      selectedProjectDraft.budgetTnd === `${selectedProject.summary.budgetTnd}` &&
                      selectedProjectDraft.nextMilestone === selectedProject.summary.nextMilestone &&
                      sameStringList(selectedProjectDraft.lots, selectedProject.setup.lots) &&
                      sameStringList(selectedProjectDraft.phases, selectedProject.setup.phases) &&
                      sameStringList(selectedProjectDraft.zones, selectedProject.setup.zones))
                  }
                  className={cx(
                    "inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold",
                    savingProjectId === selectedProject.summary.id
                      ? "cursor-not-allowed bg-stone-200 text-stone-500"
                      : "bg-black text-white hover:bg-stone-800",
                  )}
                >
                  <Save className="size-4" />
                  {savingProjectId === selectedProject.summary.id
                    ? "Enregistrement..."
                    : "Enregistrer le parametrage"}
                </button>
              </div>

              <div className="rounded-[24px] border border-white/8 bg-white/4 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">Affectation equipe</p>
                    <p className="mt-1 text-sm text-slate-300">
                      Choisissez les utilisateurs qui doivent voir et exploiter ce projet dans le SaaS.
                    </p>
                  </div>
                  <StatusBadge tone="primary">
                    {selectedProjectDraft.memberIds.length} membre(s)
                  </StatusBadge>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {data.users.map((user) => {
                    const isAllowedRole =
                      selectedProject.summary.allowedRoles.includes(user.role) ||
                      user.role === "Super Admin";
                    const checked =
                      user.role === "Super Admin" ||
                      selectedProjectDraft.memberIds.includes(user.id);

                    return (
                      <button
                        key={`${selectedProject.summary.id}-${user.id}`}
                        type="button"
                        onClick={() =>
                          user.role === "Super Admin" || !isAllowedRole
                            ? null
                            : toggleProjectMember(selectedProject.summary.id, user.id)
                        }
                        className={cx(
                          "rounded-[20px] border p-4 text-left",
                          checked
                            ? "border-emerald-400/30 bg-emerald-400/12"
                            : "border-white/8 bg-black/10 hover:bg-white/6",
                          (!isAllowedRole || user.role === "Super Admin") &&
                            "cursor-not-allowed opacity-70",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white">{user.name}</p>
                            <p className="mt-1 text-sm text-slate-300">{user.role}</p>
                            <p className="mt-2 text-xs text-slate-400">{user.email}</p>
                          </div>
                          {checked ? (
                            <CheckSquare className="size-5 text-emerald-300" />
                          ) : (
                            <Users className="size-5 text-slate-500" />
                          )}
                        </div>
                        {!isAllowedRole ? (
                          <p className="mt-3 text-xs text-amber-300">
                            Role non prevu pour ce projet.
                          </p>
                        ) : user.role === "Super Admin" ? (
                          <p className="mt-3 text-xs text-slate-400">
                            Acces conserve automatiquement.
                          </p>
                        ) : null}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => void saveProjectMembers(selectedProject.summary.id)}
                    disabled={
                      savingMembersProjectId === selectedProject.summary.id ||
                      sameStringList(selectedProjectDraft.memberIds, selectedProject.setup.memberIds)
                    }
                    className={cx(
                      "inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold",
                      savingMembersProjectId === selectedProject.summary.id
                        ? "cursor-not-allowed bg-stone-200 text-stone-500"
                        : "bg-sky-400 text-slate-950 hover:bg-sky-300",
                    )}
                  >
                    <Users className="size-4" />
                    {savingMembersProjectId === selectedProject.summary.id
                      ? "Affectation..."
                      : "Enregistrer l'equipe"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-[22px] border border-dashed border-white/10 bg-white/4 px-4 py-8 text-center text-sm text-slate-300">
              Selectionnez un projet pour modifier sa structure et ses membres.
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Matrice des roles">
        <div className="space-y-3">
          {data.roleMatrix.map((role) => (
            <div
              key={role.role}
              className="rounded-[22px] border border-white/8 bg-white/4 p-4"
            >
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-1 size-4 text-slate-400" />
                <div>
                  <p className="text-sm font-semibold text-white">{role.role}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{role.access}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Utilisateurs et acces">
        <div className="space-y-4">
          {data.users.map((user) => {
            const draft = userDrafts[user.id] ?? {
              role: user.role,
              projectIds: [...user.projectIds],
            };
            const hasChanges =
              draft.role !== user.role || !sameProjectIds(draft.projectIds, user.projectIds);

            return (
              <div
                key={user.id}
                className="rounded-[22px] border border-white/8 bg-white/4 p-4"
              >
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-white">{user.name}</p>
                        <StatusBadge tone={draft.role === "Super Admin" ? "success" : "primary"}>
                          {draft.role}
                        </StatusBadge>
                      </div>
                      <p className="mt-1 text-sm text-slate-300">{user.email}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <label className="inline-flex items-center gap-3 rounded-2xl border border-white/8 bg-black/20 px-3 py-2">
                        <UserCog className="size-4 text-slate-400" />
                        <select
                          value={draft.role}
                          onChange={(event) => {
                            const role = event.target.value as UserRole;
                            updateUserDraft(user.id, {
                              role,
                              projectIds: role === "Super Admin" ? ["*"] : draft.projectIds.filter((id) => id !== "*"),
                            });
                          }}
                          className="bg-transparent text-sm text-white outline-none"
                        >
                          {roleOptions.map((role) => (
                            <option key={`${user.id}-${role}`} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        onClick={() => void saveUser(user.id)}
                        disabled={!hasChanges || savingUserId === user.id}
                        className={cx(
                          "inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold",
                          hasChanges && savingUserId !== user.id
                            ? "bg-black text-white hover:bg-stone-800"
                            : "cursor-not-allowed bg-stone-200 text-stone-500",
                        )}
                      >
                        <Save className="size-4" />
                        {savingUserId === user.id ? "Enregistrement..." : "Enregistrer"}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {data.availableProjects.map((project) => {
                      const checked =
                        draft.role === "Super Admin" || draft.projectIds.includes(project.id);

                      return (
                        <button
                          key={`${user.id}-${project.id}`}
                          type="button"
                          onClick={() => toggleUserProject(user.id, project.id)}
                          className={cx(
                            "rounded-full border px-4 py-2 text-sm font-semibold",
                            checked
                              ? "border-emerald-400/30 bg-emerald-400/12 text-emerald-100"
                              : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/8",
                            draft.role === "Super Admin" && "cursor-not-allowed opacity-70",
                          )}
                        >
                          {checked ? <CheckCheck className="mr-2 inline size-4" /> : null}
                          {project.code}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel title="Journal d'audit">
        <div className="space-y-3">
          {data.auditTrail.map((entry) => (
            <div
              key={`${entry.actor}-${entry.at}-${entry.context}`}
              className="rounded-[22px] border border-white/8 bg-white/4 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <Users2 className="mt-1 size-4 text-slate-400" />
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {entry.actor} {entry.action}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{entry.context}</p>
                  </div>
                </div>
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{entry.at}</p>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function CredentialCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-white/8 bg-white/4 p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function TokenEditor({
  icon: Icon,
  label,
  onChange,
  values,
}: {
  icon: typeof Layers3;
  label: string;
  onChange: (values: string[]) => void;
  values: string[];
}) {
  const [draft, setDraft] = useState("");

  function addToken() {
    const nextValue = draft.trim();
    if (!nextValue || values.includes(nextValue)) {
      setDraft("");
      return;
    }

    onChange([...values, nextValue]);
    setDraft("");
  }

  return (
    <div className="rounded-[22px] border border-white/8 bg-white/4 p-4">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-slate-400" />
        <p className="text-sm font-semibold text-white">{label}</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {values.map((value) => (
          <button
            key={`${label}-${value}`}
            type="button"
            onClick={() => onChange(values.filter((entry) => entry !== value))}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10"
          >
            {value} <span className="ml-1 text-slate-400">×</span>
          </button>
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              addToken();
            }
          }}
          placeholder={`Ajouter ${label.toLowerCase()}`}
          className="w-full rounded-2xl border border-white/8 bg-black/20 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500"
        />
        <button
          type="button"
          onClick={addToken}
          className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-slate-100"
        >
          Ajouter
        </button>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-white/8 bg-white/4 p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 font-display text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

function FormField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="rounded-[22px] border border-white/8 bg-white/4 p-4">
      <span className="text-xs uppercase tracking-[0.16em] text-slate-500">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-3 w-full bg-transparent text-white outline-none"
      />
    </label>
  );
}
