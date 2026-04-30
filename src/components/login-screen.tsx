"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Building2, KeyRound, Mail } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { useAuth } from "@/components/auth-context";
import { Panel, StatusBadge } from "@/components/ui";
import { appUsers } from "@/lib/auth";
import { tenant } from "@/lib/mock-data";

export function LoginScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { homePath, isAuthenticated, isReady, signIn } = useAuth();
  const [email, setEmail] = useState(appUsers[0]?.email ?? "");
  const [password, setPassword] = useState("bnaasaas2026");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nextPath = useMemo(() => searchParams.get("next") ?? homePath, [homePath, searchParams]);

  useEffect(() => {
    if (!isReady || !isAuthenticated) {
      return;
    }

    router.replace(nextPath);
  }, [isAuthenticated, isReady, nextPath, router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    const result = await signIn({ email, password });
    setIsSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setError("");

    router.replace(searchParams.get("next") ?? homePath);
  }

  return (
    <div className="workspace-light min-h-screen px-4 py-8 md:px-6 md:py-10">
      <div className="mx-auto grid max-w-6xl gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Panel className="bg-[radial-gradient(circle_at_top_left,rgba(0,0,0,0.08),transparent_48%),linear-gradient(180deg,#ffffff,#f5f5f4)]">
          <div className="space-y-6">
            <StatusBadge tone="primary">BnaaSaaS</StatusBadge>
            <div className="space-y-3">
              <h1 className="font-display text-4xl font-semibold tracking-tight text-stone-950">
                Connectez-vous a votre espace projet
              </h1>
              <p className="max-w-xl text-sm leading-7 text-stone-600">
                Terrain, documents et finance restent regroupes dans une interface simple,
                avec une navigation et des projets filtres selon le role de chaque utilisateur.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {[
                {
                  label: "Tenant",
                  value: tenant.name,
                  helper: tenant.sector,
                },
                {
                  label: "Utilisateurs",
                  value: `${tenant.users}`,
                  helper: "Acces geres par role",
                },
                {
                  label: "Projets actifs",
                  value: `${tenant.activeProjects}`,
                  helper: "Selection selon habilitation",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-[22px] border border-stone-200 bg-white/80 p-4"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
                    {item.label}
                  </p>
                  <p className="mt-3 font-display text-2xl font-semibold text-stone-950">
                    {item.value}
                  </p>
                  <p className="mt-2 text-sm text-stone-600">{item.helper}</p>
                </div>
              ))}
            </div>

            <div className="rounded-[24px] border border-stone-200 bg-white/80 p-5">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-black text-white">
                  <Building2 className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-stone-950">
                    Comptes disponibles sur cet environnement
                  </p>
                  <p className="text-sm text-stone-600">
                    Mot de passe commun: <span className="font-semibold">bnaasaas2026</span>
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {appUsers.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => {
                      setEmail(user.email);
                      setPassword(user.password);
                      setError("");
                    }}
                    className="flex w-full items-center justify-between rounded-[20px] border border-stone-200 bg-stone-50 px-4 py-3 text-left hover:bg-stone-100"
                  >
                    <div>
                      <p className="text-sm font-semibold text-stone-950">{user.name}</p>
                      <p className="mt-1 text-sm text-stone-600">
                        {user.role} - {user.email}
                      </p>
                    </div>
                    <StatusBadge tone="neutral">
                      {user.projectIds.includes("*") ? "Tous projets" : `${user.projectIds.length} projets`}
                    </StatusBadge>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Panel>

        <Panel className="self-center">
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <StatusBadge tone="success">Acces securise</StatusBadge>
              <h2 className="font-display text-3xl font-semibold text-stone-950">
                Ouvrir une session
              </h2>
              <p className="text-sm leading-6 text-stone-600">
                Les projets accessibles, les actions et les modules visibles s&apos;adaptent
                automatiquement a votre role.
              </p>
            </div>

            <label className="block rounded-[24px] border border-stone-200 bg-stone-50 p-4">
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
                <Mail className="size-4" />
                Email
              </span>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-3 w-full bg-transparent text-base text-stone-950 outline-none"
                placeholder="vous@entreprise.tn"
              />
            </label>

            <label className="block rounded-[24px] border border-stone-200 bg-stone-50 p-4">
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
                <KeyRound className="size-4" />
                Mot de passe
              </span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-3 w-full bg-transparent text-base text-stone-950 outline-none"
                placeholder="Votre mot de passe"
              />
            </label>

            {error ? (
              <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-[22px] bg-black px-4 py-4 text-sm font-semibold text-white hover:bg-stone-800"
            >
              {isSubmitting ? "Connexion..." : "Continuer"}
              <ArrowRight className="size-4" />
            </button>
          </form>
        </Panel>
      </div>
    </div>
  );
}
