import { BookOpenText, FileCheck2, Receipt, ShieldCheck, SquarePen } from "lucide-react";

import { Panel, SectionHeading, StatusBadge } from "@/components/ui";

const documentationSections = [
  {
    title: "Vue d'ensemble",
    icon: BookOpenText,
    points: [
      "Le tableau de bord sert a reperer les priorites du jour en moins de 30 secondes.",
      "Le projet actif et les actions visibles s'adaptent au role de l'utilisateur connecte.",
      "La recherche globale, les notifications et le changement de projet restent accessibles depuis le shell principal.",
    ],
  },
  {
    title: "Suivi chantier",
    icon: SquarePen,
    points: [
      "Commencer par le rapport journalier pour remonter l'effectif, la meteo et les activites du jour.",
      "Associer les photos a une zone, un lot ou une tache pour garder une trace exploitable.",
      "Utiliser les non-conformites pour affecter un responsable et suivre la levee dans les delais.",
    ],
  },
  {
    title: "Documents",
    icon: FileCheck2,
    points: [
      "Publier une nouvelle revision uniquement quand le plan est pret a etre diffuse.",
      "Suivre les accuses de lecture avant de lancer une intervention terrain sensible.",
      "Retirer les versions obsoletes du cache apres validation de la nouvelle version en vigueur.",
    ],
  },
  {
    title: "Finance",
    icon: Receipt,
    points: [
      "Generer le decompte mensuel depuis l'avancement saisi pour eviter les ressaisies.",
      "Valider et envoyer la facture rapidement pour raccourcir le cycle d'encaissement.",
      "Comparer chaque mois recettes prevues, encaissements reels et couts engages pour detecter les tensions de tresorerie.",
    ],
  },
  {
    title: "Roles et acces",
    icon: ShieldCheck,
    points: [
      "Chaque role voit uniquement les projets qui lui sont affectes.",
      "Les actions sensibles comme publier un plan, valider une facture ou cloturer une NC sont limitees par permission.",
      "Le menu lateral et les boutons d'action s'adaptent automatiquement au role de l'utilisateur.",
    ],
  },
];

export default function DocumentationPage() {
  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Documentation"
        title="Guides d'usage et bonnes pratiques"
        description="Retrouvez ici la documentation produit centralisee, sans surcharger les pages metier avec du contenu de demonstration."
        action={<StatusBadge tone="primary">Centralisee</StatusBadge>}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        {documentationSections.map((section) => {
          const Icon = section.icon;

          return (
            <Panel
              key={section.title}
              title={section.title}
              description="Repere rapide pour l'usage quotidien de la plateforme."
            >
              <div className="space-y-3">
                <div className="flex size-11 items-center justify-center rounded-2xl border border-stone-200 bg-stone-50 text-stone-800">
                  <Icon className="size-5" />
                </div>
                {section.points.map((point) => (
                  <div
                    key={point}
                    className="rounded-[20px] border border-stone-200 bg-stone-50 px-4 py-3 text-sm leading-6 text-stone-700"
                  >
                    {point}
                  </div>
                ))}
              </div>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
