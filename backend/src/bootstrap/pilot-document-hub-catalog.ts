export type PilotDocumentVersionSeed = {
  fileKind: "pdf" | "text";
  fileLabel: string;
  mimeType: string;
  publishedAt: string;
  status: "Archive" | "Courante" | "Obsolete";
  version: string;
};

export type PilotDocumentRecipientSeed = {
  acknowledgedAt?: string;
  audience: string;
  email: string;
  status: "Lu" | "Non lu";
};

export type PilotDocumentSeed = {
  code: string;
  discipline: string;
  format: string;
  hubType: "audit" | "export" | "finance" | "plan";
  lot: string;
  offlineReady: boolean;
  phase: "APD" | "APS" | "DOE" | "EXE";
  priority: "high" | "low" | "medium";
  publishedAt: string;
  recipients: PilotDocumentRecipientSeed[];
  revision: string;
  sourceModule: "Audit" | "Documents" | "Finance" | "Systeme";
  sourceRecordId?: string;
  status: "Courante" | "Diffusion" | "Non diffuse" | "Obsolete";
  storageMode?: "inline" | "managed";
  title: string;
  versions: PilotDocumentVersionSeed[];
  visibilityScope: Array<"ADMIN" | "BE" | "CO" | "CP" | "CT" | "MO">;
  zone?: string;
};

export type PilotProjectDocumentHubSeed = {
  documents: PilotDocumentSeed[];
};

type ProjectLegacyId = "BN-031" | "BN-039" | "BN-042";

const completeProjectAudience = "Equipe projet complete";

export const pilotDocumentHubCatalog: Record<ProjectLegacyId, PilotProjectDocumentHubSeed> = {
  "BN-042": {
    documents: [
      {
        code: "EXE-STR-021",
        discipline: "Structure",
        format: "PDF",
        hubType: "plan",
        lot: "Gros oeuvre",
        offlineReady: true,
        phase: "EXE",
        priority: "high",
        publishedAt: "2026-04-29",
        recipients: [
          {
            acknowledgedAt: "2026-04-29T11:03:00.000Z",
            audience: completeProjectAudience,
            email: "nour@bnaasaas.tn",
            status: "Lu",
          },
          {
            acknowledgedAt: "2026-04-29T12:26:00.000Z",
            audience: completeProjectAudience,
            email: "amine@bnaasaas.tn",
            status: "Lu",
          },
          {
            audience: completeProjectAudience,
            email: "salma@bnaasaas.tn",
            status: "Non lu",
          },
        ],
        revision: "Rev.C",
        sourceModule: "Documents",
        sourceRecordId: "EXE-STR-021",
        status: "Courante",
        title: "Voiles RDC - plan de ferraillage",
        versions: [
          {
            fileKind: "pdf",
            fileLabel: "Plan structure Rev.A",
            mimeType: "application/pdf",
            publishedAt: "2026-04-12",
            status: "Archive",
            version: "Rev.A",
          },
          {
            fileKind: "pdf",
            fileLabel: "Plan structure Rev.B",
            mimeType: "application/pdf",
            publishedAt: "2026-04-20",
            status: "Obsolete",
            version: "Rev.B",
          },
          {
            fileKind: "pdf",
            fileLabel: "Plan structure Rev.C",
            mimeType: "application/pdf",
            publishedAt: "2026-04-29",
            status: "Courante",
            version: "Rev.C",
          },
        ],
        visibilityScope: ["ADMIN", "BE", "CP", "CT", "MO"],
        zone: "Niveau RDC",
      },
      {
        code: "EXE-CVC-009",
        discipline: "CVC",
        format: "PDF",
        hubType: "plan",
        lot: "Fluides",
        offlineReady: true,
        phase: "EXE",
        priority: "high",
        publishedAt: "2026-04-28",
        recipients: [
          {
            acknowledgedAt: "2026-04-28T17:15:00.000Z",
            audience: "Lot Fluides",
            email: "amine@bnaasaas.tn",
            status: "Lu",
          },
          {
            audience: "Lot Fluides",
            email: "nour@bnaasaas.tn",
            status: "Non lu",
          },
        ],
        revision: "Rev.B",
        sourceModule: "Documents",
        sourceRecordId: "EXE-CVC-009",
        status: "Diffusion",
        title: "Cheminement gaines hall principal",
        versions: [
          {
            fileKind: "pdf",
            fileLabel: "Plan CVC Rev.A",
            mimeType: "application/pdf",
            publishedAt: "2026-04-17",
            status: "Obsolete",
            version: "Rev.A",
          },
          {
            fileKind: "pdf",
            fileLabel: "Plan CVC Rev.B",
            mimeType: "application/pdf",
            publishedAt: "2026-04-28",
            status: "Courante",
            version: "Rev.B",
          },
        ],
        visibilityScope: ["ADMIN", "BE", "CP", "CT"],
        zone: "Hall principal",
      },
      {
        code: "FIN-FAC-042",
        discipline: "Finance",
        format: "PDF",
        hubType: "finance",
        lot: "Justificatifs finance",
        offlineReady: false,
        phase: "EXE",
        priority: "high",
        publishedAt: "2026-04-30",
        recipients: [
          {
            acknowledgedAt: "2026-04-30T16:18:00.000Z",
            audience: "Validation finance",
            email: "sara@bnaasaas.tn",
            status: "Lu",
          },
          {
            audience: "Validation finance",
            email: "salma@bnaasaas.tn",
            status: "Non lu",
          },
        ],
        revision: "v1.0",
        sourceModule: "Finance",
        sourceRecordId: "FAC-2026-042",
        status: "Diffusion",
        title: "Facture client FAC-2026-042 et preuves associees",
        versions: [
          {
            fileKind: "pdf",
            fileLabel: "Justificatif finance v1.0",
            mimeType: "application/pdf",
            publishedAt: "2026-04-30",
            status: "Courante",
            version: "v1.0",
          },
        ],
        visibilityScope: ["ADMIN", "CO", "CP", "MO"],
      },
      {
        code: "AUD-RJC-042",
        discipline: "Audit",
        format: "PDF",
        hubType: "audit",
        lot: "Archivage",
        offlineReady: false,
        phase: "DOE",
        priority: "medium",
        publishedAt: "2026-04-29",
        recipients: [
          {
            acknowledgedAt: "2026-04-29T18:04:00.000Z",
            audience: "Audit documentaire",
            email: "salma@bnaasaas.tn",
            status: "Lu",
          },
        ],
        revision: "v1.0",
        sourceModule: "Systeme",
        sourceRecordId: "AUDIT-BN-042-0429",
        status: "Courante",
        title: "Archive signee - rapport journalier 29/04/2026",
        versions: [
          {
            fileKind: "pdf",
            fileLabel: "Archive signee",
            mimeType: "application/pdf",
            publishedAt: "2026-04-29",
            status: "Courante",
            version: "v1.0",
          },
        ],
        visibilityScope: ["ADMIN", "CP", "MO"],
      },
    ],
  },
  "BN-039": {
    documents: [
      {
        code: "EXE-CVC-014",
        discipline: "CVC",
        format: "PDF",
        hubType: "plan",
        lot: "Fluides",
        offlineReady: true,
        phase: "EXE",
        priority: "high",
        publishedAt: "2026-04-30",
        recipients: [
          {
            acknowledgedAt: "2026-04-30T11:08:00.000Z",
            audience: completeProjectAudience,
            email: "amine@bnaasaas.tn",
            status: "Lu",
          },
          {
            audience: completeProjectAudience,
            email: "salma@bnaasaas.tn",
            status: "Non lu",
          },
        ],
        revision: "Rev.C",
        sourceModule: "Documents",
        sourceRecordId: "EXE-CVC-014",
        status: "Courante",
        title: "Reseaux CTA et gaines niveau 1",
        versions: [
          {
            fileKind: "pdf",
            fileLabel: "Plan CTA Rev.A",
            mimeType: "application/pdf",
            publishedAt: "2026-04-12",
            status: "Archive",
            version: "Rev.A",
          },
          {
            fileKind: "pdf",
            fileLabel: "Plan CTA Rev.B",
            mimeType: "application/pdf",
            publishedAt: "2026-04-22",
            status: "Obsolete",
            version: "Rev.B",
          },
          {
            fileKind: "pdf",
            fileLabel: "Plan CTA Rev.C",
            mimeType: "application/pdf",
            publishedAt: "2026-04-30",
            status: "Courante",
            version: "Rev.C",
          },
        ],
        visibilityScope: ["ADMIN", "BE", "CP", "CT", "MO"],
        zone: "Niveau 1",
      },
      {
        code: "ELE-BT-006",
        discipline: "Electricite",
        format: "PDF",
        hubType: "plan",
        lot: "Electricite",
        offlineReady: true,
        phase: "EXE",
        priority: "medium",
        publishedAt: "2026-04-28",
        recipients: [
          {
            acknowledgedAt: "2026-04-29T17:41:00.000Z",
            audience: "Lot Electricite",
            email: "amine@bnaasaas.tn",
            status: "Lu",
          },
        ],
        revision: "Rev.B",
        sourceModule: "Documents",
        sourceRecordId: "ELE-BT-006",
        status: "Diffusion",
        title: "Colonnes montantes bloc B",
        versions: [
          {
            fileKind: "pdf",
            fileLabel: "Plan electrique Rev.A",
            mimeType: "application/pdf",
            publishedAt: "2026-04-16",
            status: "Obsolete",
            version: "Rev.A",
          },
          {
            fileKind: "pdf",
            fileLabel: "Plan electrique Rev.B",
            mimeType: "application/pdf",
            publishedAt: "2026-04-28",
            status: "Courante",
            version: "Rev.B",
          },
        ],
        visibilityScope: ["ADMIN", "BE", "CP", "CT"],
        zone: "Bloc B",
      },
      {
        code: "FIN-FAC-136",
        discipline: "Finance",
        format: "PDF",
        hubType: "finance",
        lot: "Justificatifs finance",
        offlineReady: false,
        phase: "EXE",
        priority: "high",
        publishedAt: "2026-04-30",
        recipients: [
          {
            acknowledgedAt: "2026-04-30T15:12:00.000Z",
            audience: "Validation finance",
            email: "sara@bnaasaas.tn",
            status: "Lu",
          },
          {
            audience: "Validation finance",
            email: "salma@bnaasaas.tn",
            status: "Non lu",
          },
        ],
        revision: "v1.0",
        sourceModule: "Finance",
        sourceRecordId: "FAC-2026-136",
        status: "Diffusion",
        title: "Situation et facture client FAC-2026-136",
        versions: [
          {
            fileKind: "pdf",
            fileLabel: "Situation client v1.0",
            mimeType: "application/pdf",
            publishedAt: "2026-04-30",
            status: "Courante",
            version: "v1.0",
          },
        ],
        visibilityScope: ["ADMIN", "CO", "CP", "MO"],
      },
    ],
  },
  "BN-031": {
    documents: [
      {
        code: "EXE-TAB-018",
        discipline: "Ouvrages d'art",
        format: "PDF",
        hubType: "plan",
        lot: "Ouvrages d'art",
        offlineReady: true,
        phase: "EXE",
        priority: "high",
        publishedAt: "2026-04-29",
        recipients: [
          {
            acknowledgedAt: "2026-04-29T10:11:00.000Z",
            audience: completeProjectAudience,
            email: "amine@bnaasaas.tn",
            status: "Lu",
          },
          {
            audience: completeProjectAudience,
            email: "salma@bnaasaas.tn",
            status: "Non lu",
          },
        ],
        revision: "Rev.E",
        sourceModule: "Documents",
        sourceRecordId: "EXE-TAB-018",
        status: "Courante",
        title: "Etancheite et coupes tablier central",
        versions: [
          {
            fileKind: "pdf",
            fileLabel: "Plan tablier Rev.C",
            mimeType: "application/pdf",
            publishedAt: "2026-04-10",
            status: "Archive",
            version: "Rev.C",
          },
          {
            fileKind: "pdf",
            fileLabel: "Plan tablier Rev.D",
            mimeType: "application/pdf",
            publishedAt: "2026-04-21",
            status: "Obsolete",
            version: "Rev.D",
          },
          {
            fileKind: "pdf",
            fileLabel: "Plan tablier Rev.E",
            mimeType: "application/pdf",
            publishedAt: "2026-04-29",
            status: "Courante",
            version: "Rev.E",
          },
        ],
        visibilityScope: ["ADMIN", "CP", "CT", "MO"],
        zone: "Travee centrale",
      },
      {
        code: "EXE-APP-005",
        discipline: "Structure",
        format: "PDF",
        hubType: "plan",
        lot: "Appuis",
        offlineReady: true,
        phase: "EXE",
        priority: "medium",
        publishedAt: "2026-04-26",
        recipients: [
          {
            audience: "Equipe tablier + MOE",
            email: "amine@bnaasaas.tn",
            status: "Non lu",
          },
        ],
        revision: "Rev.B",
        sourceModule: "Documents",
        sourceRecordId: "EXE-APP-005",
        status: "Diffusion",
        title: "Details appareils d'appui P2/P3",
        versions: [
          {
            fileKind: "pdf",
            fileLabel: "Plan appuis Rev.A",
            mimeType: "application/pdf",
            publishedAt: "2026-04-14",
            status: "Obsolete",
            version: "Rev.A",
          },
          {
            fileKind: "pdf",
            fileLabel: "Plan appuis Rev.B",
            mimeType: "application/pdf",
            publishedAt: "2026-04-26",
            status: "Courante",
            version: "Rev.B",
          },
        ],
        visibilityScope: ["ADMIN", "CP", "CT", "MO"],
        zone: "Pile P2/P3",
      },
      {
        code: "FIN-FAC-235",
        discipline: "Finance",
        format: "PDF",
        hubType: "finance",
        lot: "Justificatifs finance",
        offlineReady: false,
        phase: "EXE",
        priority: "high",
        publishedAt: "2026-04-30",
        recipients: [
          {
            acknowledgedAt: "2026-04-30T14:04:00.000Z",
            audience: "Validation finance",
            email: "sara@bnaasaas.tn",
            status: "Lu",
          },
          {
            audience: "Validation finance",
            email: "salma@bnaasaas.tn",
            status: "Non lu",
          },
        ],
        revision: "v1.0",
        sourceModule: "Finance",
        sourceRecordId: "FAC-2026-235",
        status: "Diffusion",
        title: "Facture et situation de travaux FAC-2026-235",
        versions: [
          {
            fileKind: "pdf",
            fileLabel: "Facture client v1.0",
            mimeType: "application/pdf",
            publishedAt: "2026-04-30",
            status: "Courante",
            version: "v1.0",
          },
        ],
        visibilityScope: ["ADMIN", "CO", "CP", "MO"],
      },
    ],
  },
};

export function getPilotDocumentHubSeedByLegacyId(projectLegacyId: string) {
  return pilotDocumentHubCatalog[projectLegacyId as ProjectLegacyId] ?? null;
}
