import { ShieldCheck, Users2 } from "lucide-react";

import { AvatarStack, Panel, SectionHeading, StatusBadge } from "@/components/ui";
import { auditTrail, roleMatrix, teamMembers } from "@/lib/mock-data";

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Tenant Admin"
        title="Une administration lisible, meme sans equipe IT dediee"
        description="Le MVP admin doit rester simple: utilisateurs, roles, acces projet, traces d'audit. Pas de complexite gratuite, mais suffisamment de controle pour rassurer un client BTP."
        action={<StatusBadge tone="success">Audit trail active</StatusBadge>}
      />

      <div className="grid gap-6 2xl:grid-cols-[0.95fr_1.05fr]">
        <Panel title="Equipe active" description="Base de travail pour les invitations et la future gestion fine des permissions.">
          <AvatarStack
            people={teamMembers.map((member) => ({
              initials: member.initials,
              name: member.name,
              role: member.role,
            }))}
          />
        </Panel>

        <Panel title="Matrice des roles" description="Vue synthese des acces MVP par persona.">
          <div className="space-y-3">
            {roleMatrix.map((role) => (
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

      <Panel title="Journal d'audit" description="Les actions sensibles du MVP remontent ici pour renforcer la confiance et la tracabilite.">
        <div className="space-y-3">
          {auditTrail.map((entry) => (
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
