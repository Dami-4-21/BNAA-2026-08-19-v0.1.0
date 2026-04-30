"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  CheckCheck,
  FolderKanban,
  Save,
  ShieldCheck,
  ShieldUser,
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

export default function AdminPage() {
  const { currentUser, refreshWorkspace } = useWorkspace();
  const [data, setData] = useState<AdminPageData | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [closingProjectId, setClosingProjectId] = useState("");
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

  function applyAdminPayload(payload: AdminPageData) {
    setData(payload);
    setUserDrafts(buildUserDrafts(payload.users));
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

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Panel title="Portefeuille accessible">
          <div className="space-y-3">
            {data.availableProjects.map((project) => (
              <div
                key={project.id}
                className="rounded-[22px] border border-white/8 bg-white/4 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <FolderKanban className="mt-1 size-4 text-slate-400" />
                    <div>
                      <p className="text-sm font-semibold text-white">{project.name}</p>
                      <p className="mt-1 text-sm text-slate-300">
                        {project.code} - {project.client}
                      </p>
                      <p className="mt-2 text-sm text-slate-400">
                        {project.location} - {project.nextMilestone}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge tone={project.status === "Cloture" ? "success" : "primary"}>
                      {project.status}
                    </StatusBadge>
                    <StatusBadge tone="neutral">{project.progress}%</StatusBadge>
                    {project.status !== "Cloture" ? (
                      <button
                        onClick={() => void archiveProject(project.id)}
                        disabled={closingProjectId === project.id}
                        className={cx(
                          "rounded-full px-4 py-1.5 text-xs font-semibold",
                          closingProjectId === project.id
                            ? "cursor-not-allowed bg-stone-200 text-stone-500"
                            : "bg-black text-white hover:bg-stone-800",
                        )}
                      >
                        {closingProjectId === project.id ? "Cloture..." : "Cloturer"}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

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
      </div>

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
