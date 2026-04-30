"use client";

import { useEffect, useState } from "react";
import { CheckCheck, ShieldCheck, ShieldUser, UserPlus2, Users2 } from "lucide-react";

import { AvatarStack, Panel, SectionHeading, StatusBadge, cx } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import type { UserRole } from "@/lib/auth";
import type { AdminPageData } from "@/lib/backend/types";

const roleOptions: UserRole[] = [
  "Super Admin",
  "Chef de projet",
  "Conductrice travaux",
  "Bureau d'etudes",
  "Comptable",
  "Maitre d'ouvrage",
];

export default function AdminPage() {
  const [data, setData] = useState<AdminPageData | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "Comptable" as UserRole,
    projectIds: [] as string[],
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

  async function handleCreateUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const payload = await apiFetch<{
        users: AdminPageData["users"];
        auditTrail: AdminPageData["auditTrail"];
        tenant: AdminPageData["tenant"];
      }>("/api/admin", {
        method: "POST",
        body: form,
      });

      setData((current) =>
        current
          ? {
              ...current,
              users: payload.users,
              auditTrail: payload.auditTrail,
              tenant: payload.tenant,
            }
          : current,
      );
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
        title="Controle complet des acces et des utilisateurs"
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
            <MetricCard label="Projets" value={`${data.availableProjects.length}`} />
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
        <div className="space-y-3">
          {data.users.map((user) => (
            <div
              key={user.id}
              className="rounded-[22px] border border-white/8 bg-white/4 p-4"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-white">{user.name}</p>
                    <StatusBadge tone={user.role === "Super Admin" ? "success" : "primary"}>
                      {user.role}
                    </StatusBadge>
                  </div>
                  <p className="mt-1 text-sm text-slate-300">{user.email}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {user.projectIds.includes("*") ? (
                    <StatusBadge tone="success">Tous les projets</StatusBadge>
                  ) : (
                    user.projectIds.map((projectId) => (
                      <StatusBadge key={`${user.id}-${projectId}`} tone="neutral">
                        {projectId}
                      </StatusBadge>
                    ))
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Journal d'audit">
        <div className="space-y-3">
          {data.auditTrail.map((entry) => (
            <div
              key={`${entry.actor}-${entry.at}`}
              className="rounded-[22px] border border-white/8 bg-white/4 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <Users2 className="mt-1 size-4 text-slate-400" />
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {entry.actor} {entry.action}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      {entry.context}
                    </p>
                  </div>
                </div>
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                  {entry.at}
                </p>
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
