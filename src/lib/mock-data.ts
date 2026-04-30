export const tenant = {
  name: "BnaaSaaS",
  sector: "Genie civil - Tunisie",
  users: 28,
  activeProjects: 4,
};

export const currentUser = {
  name: "Sara Ben Salah",
  role: "Comptable",
  initials: "SB",
};

export const workspaceProjects = [
  {
    id: "BN-042",
    name: "Residence El Wifak",
    code: "BN-042",
    client: "Groupe Al Menzah",
    location: "Tunis, Ariana",
    status: "En execution",
    progress: 68,
    budgetTnd: 2850000,
    spentTnd: 1925000,
    invoicesDue: 2,
    nextMilestone: "Voiles RDC - 03/05/2026",
    allowedRoles: [
      "Comptable",
      "Chef de projet",
      "Conductrice travaux",
      "Bureau d'etudes",
      "Maitre d'ouvrage",
      "Super Admin",
    ],
  },
  {
    id: "BN-039",
    name: "Pole Sante Lac 2",
    code: "BN-039",
    client: "Clinique El Amen",
    location: "Tunis, Lac 2",
    status: "En execution",
    progress: 42,
    budgetTnd: 4120000,
    spentTnd: 2018000,
    invoicesDue: 1,
    nextMilestone: "Visa CVC - 05/05/2026",
    allowedRoles: [
      "Comptable",
      "Chef de projet",
      "Bureau d'etudes",
      "Maitre d'ouvrage",
      "Super Admin",
    ],
  },
  {
    id: "BN-031",
    name: "Pont Mornag",
    code: "BN-031",
    client: "Ministere de l'equipement",
    location: "Ben Arous, Mornag",
    status: "Phase encaissement",
    progress: 79,
    budgetTnd: 6350000,
    spentTnd: 5084000,
    invoicesDue: 3,
    nextMilestone: "Facture lot tablier - 06/05/2026",
    allowedRoles: [
      "Comptable",
      "Chef de projet",
      "Maitre d'ouvrage",
      "Super Admin",
    ],
  },
];

export const currentProject = workspaceProjects[0];

export const dashboardMetrics = [
  {
    label: "Avancement physique",
    value: "68%",
    delta: "+6 pts cette semaine",
    helper: "Suivi terrain synchronise avec finance",
    tone: "primary" as const,
  },
  {
    label: "Plans en vigueur",
    value: "24",
    delta: "3 revisions diffusees",
    helper: "97% lus sous 48h",
    tone: "success" as const,
  },
  {
    label: "Factures ouvertes",
    value: "2",
    delta: "412 k TND a encaisser",
    helper: "1 validation maitre d'ouvrage en attente",
    tone: "warning" as const,
  },
  {
    label: "Non-conformites",
    value: "5",
    delta: "2 critiques a lever",
    helper: "Delai moyen de cloture 3,4 jours",
    tone: "danger" as const,
  },
];

export const teamMembers = [
  {
    name: "Amine Gharbi",
    role: "Chef de projet",
    initials: "AG",
    state: "Coordonne le lot gros oeuvre",
  },
  {
    name: "Nour Baccar",
    role: "Conductrice travaux",
    initials: "NB",
    state: "Rapport du jour soumis a 07:42",
  },
  {
    name: "Sara Ben Salah",
    role: "Comptable",
    initials: "SB",
    state: "Facture FAC-2026-042 prete pour validation",
  },
  {
    name: "Hichem Trabelsi",
    role: "Bureau d'etudes",
    initials: "HT",
    state: "Revision CVC Rev.C publiee",
  },
];

export const alerts = [
  {
    title: "Coffrage zone B en retard",
    detail: "Le glissement cumule atteint 2 jours sur le lot structure.",
    time: "Il y a 14 min",
    tone: "warning" as const,
  },
  {
    title: "Plan EXE-STR-021 Rev.C distribue",
    detail: "18 destinataires notifies, 15 confirmations deja recues.",
    time: "Il y a 29 min",
    tone: "primary" as const,
  },
  {
    title: "Facture FAC-2026-041 en echeance demain",
    detail: "Montant TTC 184 500 TND, acompte non encore enregistre.",
    time: "Il y a 1 h",
    tone: "danger" as const,
  },
  {
    title: "Panne grue mobile resolue",
    detail: "Incident cloture avec photo et signature du conducteur.",
    time: "Il y a 2 h",
    tone: "success" as const,
  },
];

export const siteReportDraft = {
  reportDate: "29/04/2026",
  weather: "Nuageux",
  workforce: 46,
  completedLots: ["Voiles RDC", "Reseaux EU/EP", "Ferraillage cage A"],
  blockers: "Attente validation detail acrottere facade nord.",
  note: "Prioriser la diffusion du plan structure Rev.C avant la releve de demain.",
};

export const siteReports = [
  {
    date: "2026-04-29",
    weather: "Nuageux",
    workforce: 46,
    progress: 74,
    author: "Nour Baccar",
    status: "Soumis",
    tone: "primary" as const,
    summary: "Beton voiles RDC coule, controle ferraillage valide.",
  },
  {
    date: "2026-04-28",
    weather: "Ensoleille",
    workforce: 43,
    progress: 66,
    author: "Nour Baccar",
    status: "Signe",
    tone: "success" as const,
    summary: "Reception ciment et mise a jour galerie photo facade est.",
  },
  {
    date: "2026-04-27",
    weather: "Vent fort",
    workforce: 38,
    progress: 61,
    author: "Nour Baccar",
    status: "A completer",
    tone: "warning" as const,
    summary: "Levage suspendu 2h, reprise l'apres-midi.",
  },
];

export const photoStream = [
  {
    title: "Ferraillage cage A",
    zone: "Niveau RDC",
    time: "07:18",
    accent: "from-sky-500/60 to-cyan-300/25",
  },
  {
    title: "Reseaux EP facade nord",
    zone: "Sous-sol",
    time: "09:42",
    accent: "from-amber-400/55 to-orange-300/20",
  },
  {
    title: "Control coffrage voile B2",
    zone: "Axe B",
    time: "11:07",
    accent: "from-emerald-400/55 to-teal-300/20",
  },
];

export const ncrItems = [
  {
    ref: "NC-021",
    title: "Epaisseur enrobage insuffisante",
    owner: "Lot structure",
    dueDate: "2026-05-01",
    severity: "Critique",
    status: "En cours",
    tone: "danger" as const,
  },
  {
    ref: "NC-020",
    title: "Absence etiquette sur lot gaines",
    owner: "CVC",
    dueDate: "2026-05-02",
    severity: "Mineure",
    status: "Planifiee",
    tone: "warning" as const,
  },
  {
    ref: "NC-019",
    title: "Photo de levee a confirmer",
    owner: "Second oeuvre",
    dueDate: "2026-04-30",
    severity: "Majeure",
    status: "Validation",
    tone: "primary" as const,
  },
];

export const siteModuleOverview = {
  weather: {
    label: "Nuageux",
    temperature: "22 deg",
    wind: "19 km/h",
    rainRisk: "15%",
    source: "API meteo Tunisie - mock live",
  },
  kpis: [
    {
      label: "Conformite RJC",
      value: "96%",
      helper: "3 rapports incomplets sur 71 ce mois-ci",
      tone: "success" as const,
    },
    {
      label: "FNC ouvertes",
      value: "5",
      helper: "2 critiques, 1 en validation MOE",
      tone: "danger" as const,
    },
    {
      label: "Delai moyen de levee",
      value: "3,4 j",
      helper: "Moyenne 30 derniers jours",
      tone: "warning" as const,
    },
    {
      label: "Derive planning",
      value: "+2 j",
      helper: "Lot structure en glissement cumule",
      tone: "primary" as const,
    },
  ],
};

export const siteLotProgress = [
  {
    lot: "Gros oeuvre",
    task: "Voiles RDC",
    progress: 74,
    planned: 78,
    owner: "Equipe structure",
    tone: "primary" as const,
  },
  {
    lot: "VRD",
    task: "Reseaux EU/EP",
    progress: 62,
    planned: 60,
    owner: "Sous-traitant VRD",
    tone: "success" as const,
  },
  {
    lot: "CVC",
    task: "Reseaux facade nord",
    progress: 38,
    planned: 44,
    owner: "Equipe fluides",
    tone: "warning" as const,
  },
  {
    lot: "Second oeuvre",
    task: "Preparation gaines",
    progress: 29,
    planned: 35,
    owner: "Equipe second oeuvre",
    tone: "danger" as const,
  },
];

export const siteSignatureQueue = [
  {
    role: "Conducteur de travaux",
    state: "Signe",
    note: "Signature sur le rapport du 29/04 a 07:43",
    tone: "success" as const,
  },
  {
    role: "Maitre d'oeuvre",
    state: "En attente",
    note: "Notification envoyee il y a 11 min",
    tone: "warning" as const,
  },
  {
    role: "Archivage PDF",
    state: "Pret",
    note: "Generation automatique des validation MOE",
    tone: "primary" as const,
  },
];

export const siteIncidentTemplates = [
  "Retard livraison materiaux",
  "Panne equipement",
  "Zone securite balisage",
  "Validation plan en attente",
];

export const sitePhotoLibrary = [
  {
    id: "PH-301",
    title: "Ferraillage cage A",
    zone: "Niveau RDC",
    lot: "Gros oeuvre",
    task: "Voiles RDC",
    time: "07:18",
    timestamp: "2026-04-29T07:18:00",
    geo: "36.8621, 10.1954",
    author: "Nour Baccar",
    accent: "from-sky-500/60 to-cyan-300/25",
  },
  {
    id: "PH-302",
    title: "Reseaux EP facade nord",
    zone: "Sous-sol",
    lot: "VRD",
    task: "Reseaux EU/EP",
    time: "09:42",
    timestamp: "2026-04-29T09:42:00",
    geo: "36.8624, 10.1951",
    author: "Nour Baccar",
    accent: "from-amber-400/55 to-orange-300/20",
  },
  {
    id: "PH-303",
    title: "Controle coffrage voile B2",
    zone: "Axe B",
    lot: "Gros oeuvre",
    task: "Voiles RDC",
    time: "11:07",
    timestamp: "2026-04-29T11:07:00",
    geo: "36.8620, 10.1958",
    author: "Nour Baccar",
    accent: "from-emerald-400/55 to-teal-300/20",
  },
  {
    id: "PH-304",
    title: "Cheminement gaines hall",
    zone: "Bloc C",
    lot: "CVC",
    task: "Gaines hall",
    time: "14:16",
    timestamp: "2026-04-28T14:16:00",
    geo: "36.8617, 10.1950",
    author: "Hichem Trabelsi",
    accent: "from-fuchsia-500/45 to-rose-300/20",
  },
];

export const siteNcrSeed = [
  {
    ref: "NC-021",
    title: "Epaisseur enrobage insuffisante",
    owner: "Lot structure",
    dueDate: "2026-05-01",
    severity: "Critique",
    status: "En cours",
    tone: "danger" as const,
    photoAttached: true,
    description:
      "Controle voile B2 : enrobage mesure a 2,1 cm au lieu de 3 cm sur zone haute.",
  },
  {
    ref: "NC-020",
    title: "Absence etiquette sur lot gaines",
    owner: "CVC",
    dueDate: "2026-05-02",
    severity: "Mineure",
    status: "Planifiee",
    tone: "warning" as const,
    photoAttached: false,
    description:
      "Les gaines du bloc C sont posees sans etiquetage directionnel pour la maintenance.",
  },
  {
    ref: "NC-019",
    title: "Photo de levee a confirmer",
    owner: "Second oeuvre",
    dueDate: "2026-04-30",
    severity: "Majeure",
    status: "Validation",
    tone: "primary" as const,
    photoAttached: true,
    description:
      "Levee proposee sur reserve peinture cage B, attente confirmation MOE.",
  },
];

export const siteRecentReportsDetailed = [
  {
    id: "RJC-2026-0429",
    date: "2026-04-29",
    weather: "Nuageux",
    workforce: 46,
    progress: 74,
    author: "Nour Baccar",
    status: "Soumis",
    tone: "primary" as const,
    summary: "Beton voiles RDC coule, controle ferraillage valide.",
    completeness: 100,
    pdfReady: false,
    signedByCt: true,
    signedByMoe: false,
  },
  {
    id: "RJC-2026-0428",
    date: "2026-04-28",
    weather: "Ensoleille",
    workforce: 43,
    progress: 66,
    author: "Nour Baccar",
    status: "Signe",
    tone: "success" as const,
    summary: "Reception ciment et mise a jour galerie photo facade est.",
    completeness: 100,
    pdfReady: true,
    signedByCt: true,
    signedByMoe: true,
  },
  {
    id: "RJC-2026-0427",
    date: "2026-04-27",
    weather: "Vent fort",
    workforce: 38,
    progress: 61,
    author: "Nour Baccar",
    status: "A completer",
    tone: "warning" as const,
    summary: "Levage suspendu 2h, reprise l'apres-midi.",
    completeness: 72,
    pdfReady: false,
    signedByCt: true,
    signedByMoe: false,
  },
];

export const documentFolders = [
  {
    title: "Plans d'execution",
    count: 84,
    currentRevision: "Rev.C",
    description: "Structure, archi, fluides et electricite.",
  },
  {
    title: "Documents chantier",
    count: 31,
    currentRevision: "J-0",
    description: "RJC, PV, fiches incident, visas et notes.",
  },
  {
    title: "Pieces contractuelles",
    count: 12,
    currentRevision: "Avenant 02",
    description: "CCAP, BPU, ordres de service, validation client.",
  },
];

export const documentVersions = [
  {
    name: "EXE-STR-021",
    discipline: "Structure",
    revision: "Rev.C",
    publishedBy: "Hichem Trabelsi",
    publishedAt: "2026-04-29",
    status: "Courante",
    tone: "success" as const,
    acknowledged: "15/18 lus",
  },
  {
    name: "EXE-CVC-009",
    discipline: "CVC",
    revision: "Rev.B",
    publishedBy: "Meriem Kefi",
    publishedAt: "2026-04-28",
    status: "Diffusion",
    tone: "primary" as const,
    acknowledged: "8/11 lus",
  },
  {
    name: "AR-FA-014",
    discipline: "Architecture",
    revision: "Rev.A",
    publishedBy: "Sarra Ben Youssef",
    publishedAt: "2026-04-26",
    status: "Obsolete",
    tone: "warning" as const,
    acknowledged: "Archive",
  },
];

export const distributionQueue = [
  {
    audience: "Conducteurs + sous-traitants structure",
    dueDate: "2026-04-30",
    acknowledgedRate: 83,
    file: "EXE-STR-021 Rev.C",
  },
  {
    audience: "Equipe CVC",
    dueDate: "2026-05-01",
    acknowledgedRate: 42,
    file: "EXE-CVC-009 Rev.B",
  },
  {
    audience: "Maitre d'ouvrage",
    dueDate: "2026-05-03",
    acknowledgedRate: 100,
    file: "PV chantier semaine 17",
  },
];

export const documentsModuleOverview = {
  kpis: [
    {
      label: "Volume documentaire",
      value: "18,4 Go",
      helper: "84 plans + 31 documents chantier + medias",
      tone: "primary" as const,
    },
    {
      label: "Lecture < 48h",
      value: "91%",
      helper: "Taux moyen de lecture sur les 15 dernieres diffusions",
      tone: "success" as const,
    },
    {
      label: "Versions actives",
      value: "24",
      helper: "Mesure la complexite documentaire du projet",
      tone: "warning" as const,
    },
    {
      label: "Docs non diffuses > 5j",
      value: "3",
      helper: "A traiter pour limiter le risque terrain",
      tone: "danger" as const,
    },
  ],
  offline: {
    syncedAt: "30/04/2026 16:10",
    cachedFiles: 17,
    coverage: "Dernieres revisions terrain + dossiers critiques",
  },
};

export const documentTree = [
  {
    title: "Residence El Wifak",
    nodes: [
      {
        label: "Gros oeuvre",
        phases: ["EXE", "DOE"],
      },
      {
        label: "CVC",
        phases: ["EXE", "Visa"],
      },
      {
        label: "Architecture",
        phases: ["APS", "APD", "EXE"],
      },
    ],
  },
];

export const documentFileSeed = [
  {
    id: "DOC-101",
    code: "EXE-STR-021",
    title: "Voiles RDC - plan de ferraillage",
    discipline: "Structure",
    lot: "Gros oeuvre",
    phase: "EXE",
    format: "PDF",
    revision: "Rev.C",
    fileSizeMb: 12.8,
    uploadedBy: "Hichem Trabelsi",
    publishedAt: "2026-04-29",
    status: "Courante",
    tone: "success" as const,
    isCurrent: true,
    offlineReady: true,
    lastDistributedAt: "2026-04-29",
    readCount: 15,
    recipients: 18,
    storage: "S3 /plans/exe/str/021-revc.pdf",
    versions: [
      { version: "Rev.A", publishedAt: "2026-04-12", status: "Archive" },
      { version: "Rev.B", publishedAt: "2026-04-20", status: "Obsolete" },
      { version: "Rev.C", publishedAt: "2026-04-29", status: "Courante" },
    ],
    compareWith: "Rev.B",
  },
  {
    id: "DOC-102",
    code: "EXE-CVC-009",
    title: "Cheminement gaines hall principal",
    discipline: "CVC",
    lot: "Fluides",
    phase: "EXE",
    format: "DWG",
    revision: "Rev.B",
    fileSizeMb: 8.4,
    uploadedBy: "Meriem Kefi",
    publishedAt: "2026-04-28",
    status: "Diffusion",
    tone: "primary" as const,
    isCurrent: true,
    offlineReady: true,
    lastDistributedAt: "2026-04-28",
    readCount: 8,
    recipients: 11,
    storage: "S3 /plans/exe/cvc/009-revb.dwg",
    versions: [
      { version: "Rev.A", publishedAt: "2026-04-17", status: "Obsolete" },
      { version: "Rev.B", publishedAt: "2026-04-28", status: "Courante" },
    ],
    compareWith: "Rev.A",
  },
  {
    id: "DOC-103",
    code: "AR-FA-014",
    title: "Facade nord - details menuiserie",
    discipline: "Architecture",
    lot: "Facade",
    phase: "EXE",
    format: "PDF",
    revision: "Rev.A",
    fileSizeMb: 4.9,
    uploadedBy: "Sarra Ben Youssef",
    publishedAt: "2026-04-26",
    status: "Obsolete",
    tone: "warning" as const,
    isCurrent: false,
    offlineReady: false,
    lastDistributedAt: "2026-04-21",
    readCount: 9,
    recipients: 9,
    storage: "S3 /plans/exe/archi/fa-014-reva.pdf",
    versions: [
      { version: "Rev.0", publishedAt: "2026-04-11", status: "Archive" },
      { version: "Rev.A", publishedAt: "2026-04-26", status: "Obsolete" },
    ],
    compareWith: "Rev.0",
  },
  {
    id: "DOC-104",
    code: "DOE-LOT-001",
    title: "Dossier recollement VRD",
    discipline: "VRD",
    lot: "VRD",
    phase: "DOE",
    format: "XLSX",
    revision: "v1.0",
    fileSizeMb: 2.1,
    uploadedBy: "Amine Gharbi",
    publishedAt: "2026-04-24",
    status: "Non diffuse",
    tone: "danger" as const,
    isCurrent: true,
    offlineReady: false,
    lastDistributedAt: "2026-04-24",
    readCount: 0,
    recipients: 6,
    storage: "S3 /doe/vrd/001-v1.xlsx",
    versions: [
      { version: "v0.9", publishedAt: "2026-04-19", status: "Archive" },
      { version: "v1.0", publishedAt: "2026-04-24", status: "Courante" },
    ],
    compareWith: "v0.9",
  },
];

export const documentRecipientSeed = [
  {
    id: "REC-101",
    documentId: "DOC-101",
    name: "Nour Baccar",
    role: "Conductrice travaux",
    status: "Lu",
    acknowledgedAt: "2026-04-29 11:03",
  },
  {
    id: "REC-102",
    documentId: "DOC-101",
    name: "Karim Abidi",
    role: "Sous-traitant structure",
    status: "Lu",
    acknowledgedAt: "2026-04-29 12:26",
  },
  {
    id: "REC-103",
    documentId: "DOC-101",
    name: "Moez Saidi",
    role: "Sous-traitant structure",
    status: "Non lu",
    acknowledgedAt: "",
  },
  {
    id: "REC-104",
    documentId: "DOC-102",
    name: "Rym Ben Amor",
    role: "Equipe CVC",
    status: "Lu",
    acknowledgedAt: "2026-04-28 17:15",
  },
  {
    id: "REC-105",
    documentId: "DOC-102",
    name: "Walid Karray",
    role: "Equipe CVC",
    status: "Non lu",
    acknowledgedAt: "",
  },
];

export const invoiceMetrics = [
  {
    label: "Facture ce mois",
    value: 684000,
    helper: "HT genere depuis avancement terrain",
    tone: "primary" as const,
  },
  {
    label: "Paiements encaisses",
    value: 412000,
    helper: "2 reglements enregistres",
    tone: "success" as const,
  },
  {
    label: "Encours client",
    value: 272000,
    helper: "Echeances sur 9 jours",
    tone: "warning" as const,
  },
  {
    label: "Retard critique",
    value: 184500,
    helper: "1 facture depassee de 1 jour",
    tone: "danger" as const,
  },
];

export const invoices = [
  {
    number: "FAC-2026-042",
    project: "Residence El Wifak",
    amount: 184500,
    dueDate: "2026-04-30",
    status: "Validation client",
    tone: "warning" as const,
  },
  {
    number: "FAC-2026-041",
    project: "Residence El Wifak",
    amount: 227500,
    dueDate: "2026-04-28",
    status: "En retard",
    tone: "danger" as const,
  },
  {
    number: "FAC-2026-036",
    project: "Pole Sante Lac 2",
    amount: 96000,
    dueDate: "2026-04-26",
    status: "Payee",
    tone: "success" as const,
  },
  {
    number: "FAC-2026-035",
    project: "Pont Mornag",
    amount: 176000,
    dueDate: "2026-05-06",
    status: "Envoyee",
    tone: "primary" as const,
  },
];

export const cashflowSeries = [
  { label: "Jan", planned: 180, actual: 168 },
  { label: "Fev", planned: 220, actual: 214 },
  { label: "Mar", planned: 265, actual: 252 },
  { label: "Avr", planned: 310, actual: 288 },
  { label: "Mai", planned: 340, actual: 0 },
];

export const paymentChecklist = [
  {
    label: "Avancement terrain valide",
    detail: "Les quantites du lot structure sont synchronisees.",
    done: true,
  },
  {
    label: "Pieces justificatives jointes",
    detail: "RJC, galerie photo et note de situation presentes.",
    done: true,
  },
  {
    label: "Validation maitre d'ouvrage",
    detail: "Action attendue sur FAC-2026-042.",
    done: false,
  },
  {
    label: "Reglement enregistre",
    detail: "Automatique des qu'un paiement est saisi.",
    done: false,
  },
];

export const financeModuleOverview = {
  kpis: [
    {
      label: "DSO",
      value: "24 j",
      helper: "Delai moyen de reglement client sur les 90 derniers jours",
      tone: "warning" as const,
    },
    {
      label: "Facturation dans les delais",
      value: "88%",
      helper: "Respect des echeances contractuelles de facturation",
      tone: "success" as const,
    },
    {
      label: "Ecart budget / reel",
      value: "-3,2%",
      helper: "Projet encore rentable mais sous surveillance",
      tone: "primary" as const,
    },
    {
      label: "TVA collectee / declaree",
      value: "97%",
      helper: "3% d'ajustement avant declaration mensuelle",
      tone: "danger" as const,
    },
  ],
  treasuryAlert:
    "Tension de tresorerie projetee sur la deuxieme semaine de mai si FAC-2026-042 n'est pas reglee.",
};

export const financeInvoiceSeed = [
  {
    id: "INV-042",
    projectId: "BN-042",
    invoiceNumber: "FAC-2026-042",
    project: "Residence El Wifak",
    periodMonth: "2026-04-01",
    amountHt: 155042,
    tvaRate: 19,
    tvaAmount: 29458,
    amountTtc: 184500,
    dueDate: "2026-04-30",
    paidAt: "",
    status: "Brouillon",
    tone: "warning" as const,
    retentionAmount: 7752,
    advanceDeduction: 4200,
    sourceProgress: 68,
    validatedByMoe: true,
    validatedByMo: false,
  },
  {
    id: "INV-041",
    projectId: "BN-042",
    invoiceNumber: "FAC-2026-041",
    project: "Residence El Wifak",
    periodMonth: "2026-03-01",
    amountHt: 191176,
    tvaRate: 19,
    tvaAmount: 36324,
    amountTtc: 227500,
    dueDate: "2026-04-28",
    paidAt: "",
    status: "Envoyee",
    tone: "danger" as const,
    retentionAmount: 9558,
    advanceDeduction: 4600,
    sourceProgress: 61,
    validatedByMoe: true,
    validatedByMo: false,
  },
  {
    id: "INV-036",
    projectId: "BN-039",
    invoiceNumber: "FAC-2026-036",
    project: "Pole Sante Lac 2",
    periodMonth: "2026-03-01",
    amountHt: 80672,
    tvaRate: 19,
    tvaAmount: 15328,
    amountTtc: 96000,
    dueDate: "2026-04-26",
    paidAt: "2026-04-25T10:00:00",
    status: "Payee",
    tone: "success" as const,
    retentionAmount: 4033,
    advanceDeduction: 3000,
    sourceProgress: 42,
    validatedByMoe: true,
    validatedByMo: true,
  },
  {
    id: "INV-035",
    projectId: "BN-031",
    invoiceNumber: "FAC-2026-035",
    project: "Pont Mornag",
    periodMonth: "2026-04-01",
    amountHt: 147899,
    tvaRate: 19,
    tvaAmount: 28101,
    amountTtc: 176000,
    dueDate: "2026-05-06",
    paidAt: "",
    status: "Validee",
    tone: "primary" as const,
    retentionAmount: 7395,
    advanceDeduction: 1800,
    sourceProgress: 79,
    validatedByMoe: true,
    validatedByMo: true,
  },
];

export const financePaymentSeed = [
  {
    id: "PAY-201",
    invoiceId: "INV-036",
    invoiceNumber: "FAC-2026-036",
    amount: 96000,
    method: "Virement",
    reference: "VIR-TN-2504",
    paidAt: "2026-04-25T10:00:00",
  },
  {
    id: "PAY-202",
    invoiceId: "INV-034",
    invoiceNumber: "FAC-2026-034",
    amount: 316000,
    method: "Cheque",
    reference: "CHQ-889102",
    paidAt: "2026-04-14T15:20:00",
  },
];

export const financeCashflowDetailed = [
  { label: "Jan", plannedReceipts: 180, actualReceipts: 168, actualCosts: 124 },
  { label: "Fev", plannedReceipts: 220, actualReceipts: 214, actualCosts: 152 },
  { label: "Mar", plannedReceipts: 265, actualReceipts: 252, actualCosts: 181 },
  { label: "Avr", plannedReceipts: 310, actualReceipts: 288, actualCosts: 226 },
  { label: "Mai", plannedReceipts: 340, actualReceipts: 174, actualCosts: 240 },
];

export const financeVatRegimes = [
  {
    id: "standard",
    label: "TVA 19%",
    rate: 19,
    helper: "Prestations de service standard en Tunisie",
  },
  {
    id: "reduced",
    label: "TVA reduite 7%",
    rate: 7,
    helper: "Projet eligible a taux reduit",
  },
  {
    id: "exempt",
    label: "Exonere",
    rate: 0,
    helper: "Regime special / projet exonere",
  },
];

export const financeDeclarationSeed = {
  month: "Avril 2026",
  collectedTva: 63883,
  declaredTva: 62020,
  variance: 1863,
  status: "A finaliser",
};

export const projects = [
  {
    name: "Residence El Wifak",
    code: "BN-042",
    location: "Ariana",
    progress: 68,
    budget: 2850000,
    health: "Sous controle",
    tone: "success" as const,
    nextMilestone: "Voiles RDC",
  },
  {
    name: "Pole Sante Lac 2",
    code: "BN-039",
    location: "Tunis",
    progress: 42,
    budget: 4120000,
    health: "Attention docs",
    tone: "warning" as const,
    nextMilestone: "Visa CVC",
  },
  {
    name: "Pont Mornag",
    code: "BN-031",
    location: "Ben Arous",
    progress: 79,
    budget: 6350000,
    health: "Encaissement critique",
    tone: "danger" as const,
    nextMilestone: "Facture lot tablier",
  },
];

export const notifications = [
  {
    title: "Document a confirmer",
    detail: "EXE-CVC-009 Rev.B doit etre lu par 3 sous-traitants.",
    channel: "In-app + email",
    when: "Maintenant",
  },
  {
    title: "Rapport journalier soumis",
    detail: "Residence El Wifak - 29/04/2026",
    channel: "In-app",
    when: "07:42",
  },
  {
    title: "Facture en attente de validation",
    detail: "FAC-2026-042 transmise au maitre d'ouvrage.",
    channel: "Email",
    when: "09:15",
  },
];

export const roleMatrix = [
  {
    role: "Conducteur de travaux",
    access: "Rapports, photos, NCR, lecture plans courants",
  },
  {
    role: "Chef de projet",
    access: "Vision projet, diffusion docs, arbitrage priorites",
  },
  {
    role: "Bureau d'etudes",
    access: "Upload revisions, historique, diffusion controlee",
  },
  {
    role: "Comptable",
    access: "Factures, paiements, synthese financiere",
  },
  {
    role: "Maitre d'ouvrage",
    access: "Lecture, validations, tableaux de bord",
  },
];

export const auditTrail = [
  {
    actor: "Hichem Trabelsi",
    action: "a publie EXE-STR-021 Rev.C",
    context: "Distribution automatique a 18 destinataires",
    at: "29/04/2026 10:22",
  },
  {
    actor: "Nour Baccar",
    action: "a soumis le RJC du 29/04",
    context: "46 ouvriers, 12 photos, 1 incident mineur",
    at: "29/04/2026 07:42",
  },
  {
    actor: "Sara Ben Salah",
    action: "a genere FAC-2026-042",
    context: "Decompte Avril, 184 500 TND TTC",
    at: "28/04/2026 18:10",
  },
];

type WorkspaceProjectId = (typeof workspaceProjects)[number]["id"];
type SiteModuleData = {
  overview: typeof siteModuleOverview;
  lotProgress: typeof siteLotProgress;
  signatureQueue: typeof siteSignatureQueue;
  incidentTemplates: typeof siteIncidentTemplates;
  photoLibrary: typeof sitePhotoLibrary;
  ncrs: typeof siteNcrSeed;
  reports: typeof siteRecentReportsDetailed;
  reportDraft: typeof siteReportDraft;
  draftPhoto: {
    title: string;
    zone: string;
    lot: string;
    task: string;
    geo: string;
  };
  draftNcr: {
    title: string;
    owner: string;
    dueDate: string;
    severity: string;
    description: string;
    photoAttached: boolean;
  };
};
type DocumentsModuleData = {
  overview: typeof documentsModuleOverview;
  tree: typeof documentTree;
  files: typeof documentFileSeed;
  recipients: typeof documentRecipientSeed;
  draftVersion: {
    revision: string;
    format: string;
    audience: string;
  };
};
type FinanceModuleData = {
  overview: typeof financeModuleOverview;
  invoices: Array<(typeof financeInvoiceSeed)[number]>;
  payments: Array<(typeof financePaymentSeed)[number]>;
  cashflow: Array<(typeof financeCashflowDetailed)[number]>;
  declaration: typeof financeDeclarationSeed;
  defaultVatRegimeId: (typeof financeVatRegimes)[number]["id"];
  dmDraft: {
    periodMonth: string;
    progressPct: number;
    baseAmountHt: number;
    retentionPct: number;
    advanceDeduction: number;
  };
  paymentDraft: {
    amount: string;
    method: string;
    reference: string;
  };
};

function cloneData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const siteModuleDataByProject: Record<WorkspaceProjectId, SiteModuleData> = {
  "BN-042": {
    overview: siteModuleOverview,
    lotProgress: siteLotProgress,
    signatureQueue: siteSignatureQueue,
    incidentTemplates: siteIncidentTemplates,
    photoLibrary: sitePhotoLibrary,
    ncrs: siteNcrSeed,
    reports: siteRecentReportsDetailed,
    reportDraft: siteReportDraft,
    draftPhoto: {
      title: "Point de controle facade ouest",
      zone: "Facade ouest",
      lot: "Gros oeuvre",
      task: "Voiles RDC",
      geo: "36.8623, 10.1952",
    },
    draftNcr: {
      title: "Fixation garde-corps incomplete",
      owner: "Lot structure",
      dueDate: "2026-05-03",
      severity: "Majeure",
      description:
        "Deux platines restent non scellees au niveau dalle haute bloc B.",
      photoAttached: true,
    },
  },
  "BN-039": {
    overview: {
      weather: {
        label: "Ensoleille",
        temperature: "24 deg",
        wind: "14 km/h",
        rainRisk: "5%",
        source: "API meteo Tunisie - mock live",
      },
      kpis: [
        {
          label: "Conformite RJC",
          value: "93%",
          helper: "5 rapports incomplets sur 67 ce mois-ci",
          tone: "warning" as const,
        },
        {
          label: "FNC ouvertes",
          value: "3",
          helper: "1 majeure sur les zones techniques",
          tone: "warning" as const,
        },
        {
          label: "Delai moyen de levee",
          value: "4,1 j",
          helper: "Levee plus lente sur les interfaces fluides",
          tone: "warning" as const,
        },
        {
          label: "Derive planning",
          value: "+1 j",
          helper: "Visa CVC encore attendu",
          tone: "primary" as const,
        },
      ],
    },
    lotProgress: [
      {
        lot: "Fluides",
        task: "Reseaux CTA niveau 1",
        progress: 51,
        planned: 56,
        owner: "Equipe CVC",
        tone: "warning" as const,
      },
      {
        lot: "Electricite",
        task: "Colonnes montantes",
        progress: 47,
        planned: 44,
        owner: "Sous-traitant elec",
        tone: "success" as const,
      },
      {
        lot: "Facade",
        task: "Menuiseries bloc B",
        progress: 38,
        planned: 40,
        owner: "Equipe facade",
        tone: "primary" as const,
      },
      {
        lot: "Architecture",
        task: "Cloisons zone consultation",
        progress: 34,
        planned: 37,
        owner: "Second oeuvre",
        tone: "danger" as const,
      },
    ],
    signatureQueue: [
      {
        role: "Conducteur de travaux",
        state: "Signe",
        note: "Rapport du 30/04 signe a 08:11",
        tone: "success" as const,
      },
      {
        role: "Maitre d'oeuvre",
        state: "Signe",
        note: "Validation MOE recue a 10:02",
        tone: "success" as const,
      },
      {
        role: "Archivage PDF",
        state: "Archive",
        note: "PDF journalier stocke dans le dossier chantier",
        tone: "primary" as const,
      },
    ],
    incidentTemplates: [
      "Visa CVC en attente",
      "Retard equipement technique",
      "Acces zone sterile a coordonner",
      "Point SECURITE a rebaliser",
    ],
    photoLibrary: [
      {
        id: "PH-401",
        title: "Passage gaines CTA",
        zone: "Bloc B - niveau 1",
        lot: "Fluides",
        task: "Reseaux CTA niveau 1",
        time: "08:12",
        timestamp: "2026-04-30T08:12:00",
        geo: "36.8436, 10.2741",
        author: "Meriem Kefi",
        accent: "from-cyan-500/55 to-sky-300/20",
      },
      {
        id: "PH-402",
        title: "Colonnes montantes elec",
        zone: "Noyau central",
        lot: "Electricite",
        task: "Colonnes montantes",
        time: "10:33",
        timestamp: "2026-04-30T10:33:00",
        geo: "36.8432, 10.2745",
        author: "Rym Ben Amor",
        accent: "from-amber-400/55 to-orange-300/20",
      },
      {
        id: "PH-403",
        title: "Pose menuiseries facade",
        zone: "Bloc B",
        lot: "Facade",
        task: "Menuiseries bloc B",
        time: "14:08",
        timestamp: "2026-04-29T14:08:00",
        geo: "36.8434, 10.2738",
        author: "Amine Gharbi",
        accent: "from-emerald-400/55 to-teal-300/20",
      },
    ],
    ncrs: [
      {
        ref: "NC-108",
        title: "Trappe technique mal repertee",
        owner: "Lots techniques",
        dueDate: "2026-05-02",
        severity: "Majeure",
        status: "En cours",
        tone: "warning" as const,
        photoAttached: true,
        description:
          "Repere non conforme entre plan EXE-CVC-014 et pose terrain dans le noyau B.",
      },
      {
        ref: "NC-107",
        title: "Support chemin de cable a reprendre",
        owner: "Electricite",
        dueDate: "2026-05-04",
        severity: "Mineure",
        status: "Planifiee",
        tone: "primary" as const,
        photoAttached: false,
        description:
          "Deux supports restent a recaler avant fermeture du faux plafond.",
      },
      {
        ref: "NC-106",
        title: "Etiquetage CTA incomplet",
        owner: "CVC",
        dueDate: "2026-04-30",
        severity: "Mineure",
        status: "Validation",
        tone: "primary" as const,
        photoAttached: true,
        description:
          "Le conducteur a propose la levee avec photo, en attente MOE.",
      },
    ],
    reports: [
      {
        id: "RJC-2026-0390",
        date: "2026-04-30",
        weather: "Ensoleille",
        workforce: 39,
        progress: 45,
        author: "Meriem Kefi",
        status: "Signe",
        tone: "success" as const,
        summary: "Coordination fluides/electricite realisee sur le bloc B.",
        completeness: 100,
        pdfReady: true,
        signedByCt: true,
        signedByMoe: true,
      },
      {
        id: "RJC-2026-0389",
        date: "2026-04-29",
        weather: "Nuageux",
        workforce: 36,
        progress: 42,
        author: "Meriem Kefi",
        status: "Soumis",
        tone: "primary" as const,
        summary: "Pose gaines CTA et reprise des reservations en zone consultation.",
        completeness: 96,
        pdfReady: false,
        signedByCt: true,
        signedByMoe: false,
      },
      {
        id: "RJC-2026-0388",
        date: "2026-04-28",
        weather: "Vent fort",
        workforce: 34,
        progress: 39,
        author: "Meriem Kefi",
        status: "A completer",
        tone: "warning" as const,
        summary: "Livraison equipements techniques partiellement reportee.",
        completeness: 74,
        pdfReady: false,
        signedByCt: false,
        signedByMoe: false,
      },
    ],
    reportDraft: {
      reportDate: "30/04/2026",
      weather: "Ensoleille",
      workforce: 39,
      completedLots: [
        "Passage gaines CTA niveau 1",
        "Colonnes montantes bloc B",
        "Pose menuiseries salle d'attente",
      ],
      blockers: "Visa CVC lot fluides encore attendu pour zone consultation.",
      note: "Prioriser l'envoi du plan technique Rev.C aux equipes terrain avant 18h.",
    },
    draftPhoto: {
      title: "Controle faux plafond consultation",
      zone: "Zone consultation",
      lot: "Architecture",
      task: "Cloisons zone consultation",
      geo: "36.8433, 10.2740",
    },
    draftNcr: {
      title: "Repere gaine incorrect sur noyau B",
      owner: "CVC",
      dueDate: "2026-05-04",
      severity: "Majeure",
      description:
        "La gaine G-14 ne suit pas le repere revise sur la derniere diffusion EXE-CVC-014.",
      photoAttached: true,
    },
  },
  "BN-031": {
    overview: {
      weather: {
        label: "Vent fort",
        temperature: "20 deg",
        wind: "28 km/h",
        rainRisk: "12%",
        source: "API meteo Tunisie - mock live",
      },
      kpis: [
        {
          label: "Conformite RJC",
          value: "98%",
          helper: "1 rapport incomplet sur 53 ce mois-ci",
          tone: "success" as const,
        },
        {
          label: "FNC ouvertes",
          value: "4",
          helper: "2 sur l'etancheite du tablier",
          tone: "danger" as const,
        },
        {
          label: "Delai moyen de levee",
          value: "2,8 j",
          helper: "Traitement rapide sur le lot ouvrages d'art",
          tone: "success" as const,
        },
        {
          label: "Derive planning",
          value: "+3 j",
          helper: "Etancheite tablier a securiser avant recepissage",
          tone: "danger" as const,
        },
      ],
    },
    lotProgress: [
      {
        lot: "Ouvrages d'art",
        task: "Etancheite tablier",
        progress: 82,
        planned: 87,
        owner: "Equipe tablier",
        tone: "danger" as const,
      },
      {
        lot: "Appuis",
        task: "Reprise appareils d'appui",
        progress: 91,
        planned: 90,
        owner: "Equipe structure",
        tone: "success" as const,
      },
      {
        lot: "Drainage",
        task: "Caniveaux lateraux",
        progress: 76,
        planned: 74,
        owner: "VRD",
        tone: "success" as const,
      },
      {
        lot: "Signalisation",
        task: "Pre-signalisation provisoire",
        progress: 58,
        planned: 61,
        owner: "Equipement routier",
        tone: "warning" as const,
      },
    ],
    signatureQueue: [
      {
        role: "Conducteur de travaux",
        state: "Signe",
        note: "Rapport ouvrage d'art signe a 06:58",
        tone: "success" as const,
      },
      {
        role: "Maitre d'oeuvre",
        state: "En attente",
        note: "Validation attendue avant reunion hebdo de 17h",
        tone: "warning" as const,
      },
      {
        role: "Archivage PDF",
        state: "Pret",
        note: "Archive automatique des que la contre-signature arrive",
        tone: "primary" as const,
      },
    ],
    incidentTemplates: [
      "Vent fort sur tablier",
      "Blocage circulation chantier",
      "Controle appuis a revalider",
      "Betonage reporte",
    ],
    photoLibrary: [
      {
        id: "PH-501",
        title: "Etancheite travée centrale",
        zone: "Tablier - axe 3",
        lot: "Ouvrages d'art",
        task: "Etancheite tablier",
        time: "06:40",
        timestamp: "2026-04-30T06:40:00",
        geo: "36.6802, 10.2913",
        author: "Lotfi Dridi",
        accent: "from-slate-500/55 to-zinc-300/20",
      },
      {
        id: "PH-502",
        title: "Controle appareils d'appui",
        zone: "Pile P2",
        lot: "Appuis",
        task: "Reprise appareils d'appui",
        time: "09:26",
        timestamp: "2026-04-30T09:26:00",
        geo: "36.6800, 10.2910",
        author: "Walid Ben Romdhane",
        accent: "from-orange-500/55 to-amber-300/20",
      },
      {
        id: "PH-503",
        title: "Caniveaux lateraux",
        zone: "Rive sud",
        lot: "Drainage",
        task: "Caniveaux lateraux",
        time: "13:44",
        timestamp: "2026-04-29T13:44:00",
        geo: "36.6804, 10.2916",
        author: "Lotfi Dridi",
        accent: "from-emerald-500/55 to-lime-300/20",
      },
    ],
    ncrs: [
      {
        ref: "NC-205",
        title: "Reprise membrane tablier incomplete",
        owner: "Ouvrages d'art",
        dueDate: "2026-05-02",
        severity: "Critique",
        status: "En cours",
        tone: "danger" as const,
        photoAttached: true,
        description:
          "Deux zones de recouvrement restent sous tolerance sur la travée centrale.",
      },
      {
        ref: "NC-204",
        title: "Joint de caniveau a reprendre",
        owner: "Drainage",
        dueDate: "2026-05-01",
        severity: "Majeure",
        status: "Validation",
        tone: "primary" as const,
        photoAttached: true,
        description:
          "Photo de levee transmise, controle MOE encore en attente.",
      },
      {
        ref: "NC-203",
        title: "Balisage provisoire incomplet",
        owner: "Signalisation",
        dueDate: "2026-05-04",
        severity: "Mineure",
        status: "Planifiee",
        tone: "warning" as const,
        photoAttached: false,
        description:
          "Le balisage rive nord doit etre complete avant intervention nocturne.",
      },
    ],
    reports: [
      {
        id: "RJC-2026-0319",
        date: "2026-04-30",
        weather: "Vent fort",
        workforce: 52,
        progress: 79,
        author: "Lotfi Dridi",
        status: "Soumis",
        tone: "primary" as const,
        summary: "Controle etancheite tablier et reprise drainage rive sud.",
        completeness: 98,
        pdfReady: false,
        signedByCt: true,
        signedByMoe: false,
      },
      {
        id: "RJC-2026-0318",
        date: "2026-04-29",
        weather: "Nuageux",
        workforce: 49,
        progress: 77,
        author: "Lotfi Dridi",
        status: "Signe",
        tone: "success" as const,
        summary: "Reprise appareils d'appui P2 finalisee.",
        completeness: 100,
        pdfReady: true,
        signedByCt: true,
        signedByMoe: true,
      },
      {
        id: "RJC-2026-0317",
        date: "2026-04-28",
        weather: "Ensoleille",
        workforce: 47,
        progress: 75,
        author: "Lotfi Dridi",
        status: "Signe",
        tone: "success" as const,
        summary: "Pose caniveaux lateraux et controle signalisation provisoire.",
        completeness: 100,
        pdfReady: true,
        signedByCt: true,
        signedByMoe: true,
      },
    ],
    reportDraft: {
      reportDate: "30/04/2026",
      weather: "Vent fort",
      workforce: 52,
      completedLots: [
        "Etancheite travée centrale",
        "Controle appareils d'appui P2",
        "Caniveaux lateraux rive sud",
      ],
      blockers: "Fenetre meteo a surveiller avant intervention de nuit sur signalisation.",
      note: "Verifier la levee NC-205 avant cloture hebdomadaire.",
    },
    draftPhoto: {
      title: "Controle rive nord",
      zone: "Rive nord",
      lot: "Signalisation",
      task: "Pre-signalisation provisoire",
      geo: "36.6801, 10.2915",
    },
    draftNcr: {
      title: "Recouvrement membrane a corriger",
      owner: "Ouvrages d'art",
      dueDate: "2026-05-02",
      severity: "Critique",
      description:
        "Le recouvrement de membrane reste insuffisant sur la travée centrale cote est.",
      photoAttached: true,
    },
  },
};

const documentsModuleDataByProject: Record<WorkspaceProjectId, DocumentsModuleData> = {
  "BN-042": {
    overview: documentsModuleOverview,
    tree: documentTree,
    files: documentFileSeed,
    recipients: documentRecipientSeed,
    draftVersion: {
      revision: "Rev.D",
      format: "PDF",
      audience: "Conducteurs + sous-traitants structure",
    },
  },
  "BN-039": {
    overview: {
      kpis: [
        {
          label: "Volume documentaire",
          value: "12,1 Go",
          helper: "CVC, elec, architecture et notes de coordination",
          tone: "primary" as const,
        },
        {
          label: "Lecture < 48h",
          value: "87%",
          helper: "Diffusions techniques encore en progression",
          tone: "warning" as const,
        },
        {
          label: "Versions actives",
          value: "18",
          helper: "Complexite moderee mais beaucoup d'interfaces fluides",
          tone: "warning" as const,
        },
        {
          label: "Docs non diffuses > 5j",
          value: "2",
          helper: "Surtout des dossiers DOE de lots secondaires",
          tone: "danger" as const,
        },
      ],
      offline: {
        syncedAt: "30/04/2026 16:22",
        cachedFiles: 11,
        coverage: "Plans techniques niveau 1 et revisions critiques bloc B",
      },
    },
    tree: [
      {
        title: "Pole Sante Lac 2",
        nodes: [
          { label: "Fluides", phases: ["EXE", "Visa", "DOE"] },
          { label: "Electricite", phases: ["EXE", "DOE"] },
          { label: "Architecture", phases: ["APD", "EXE"] },
        ],
      },
    ],
    files: [
      {
        id: "DOC-201",
        code: "EXE-CVC-014",
        title: "Reseaux CTA et gaines niveau 1",
        discipline: "CVC",
        lot: "Fluides",
        phase: "EXE",
        format: "PDF",
        revision: "Rev.C",
        fileSizeMb: 9.4,
        uploadedBy: "Meriem Kefi",
        publishedAt: "2026-04-30",
        status: "Courante",
        tone: "success" as const,
        isCurrent: true,
        offlineReady: true,
        lastDistributedAt: "2026-04-30",
        readCount: 10,
        recipients: 12,
        storage: "S3 /plans/exe/cvc/014-revc.pdf",
        versions: [
          { version: "Rev.A", publishedAt: "2026-04-12", status: "Archive" },
          { version: "Rev.B", publishedAt: "2026-04-22", status: "Obsolete" },
          { version: "Rev.C", publishedAt: "2026-04-30", status: "Courante" },
        ],
        compareWith: "Rev.B",
      },
      {
        id: "DOC-202",
        code: "ELE-BT-006",
        title: "Colonnes montantes bloc B",
        discipline: "Electricite",
        lot: "Electricite",
        phase: "EXE",
        format: "DWG",
        revision: "Rev.B",
        fileSizeMb: 6.7,
        uploadedBy: "Rym Ben Amor",
        publishedAt: "2026-04-28",
        status: "Diffusion",
        tone: "primary" as const,
        isCurrent: true,
        offlineReady: true,
        lastDistributedAt: "2026-04-29",
        readCount: 7,
        recipients: 10,
        storage: "S3 /plans/exe/ele/006-revb.dwg",
        versions: [
          { version: "Rev.A", publishedAt: "2026-04-16", status: "Obsolete" },
          { version: "Rev.B", publishedAt: "2026-04-28", status: "Courante" },
        ],
        compareWith: "Rev.A",
      },
      {
        id: "DOC-203",
        code: "AR-BLOCB-022",
        title: "Amenagement bloc B - cloisonnement",
        discipline: "Architecture",
        lot: "Architecture",
        phase: "EXE",
        format: "PDF",
        revision: "Rev.A",
        fileSizeMb: 5.6,
        uploadedBy: "Sarra Ben Youssef",
        publishedAt: "2026-04-24",
        status: "Obsolete",
        tone: "warning" as const,
        isCurrent: false,
        offlineReady: false,
        lastDistributedAt: "2026-04-24",
        readCount: 8,
        recipients: 8,
        storage: "S3 /plans/exe/archi/blocb-022-reva.pdf",
        versions: [
          { version: "Rev.0", publishedAt: "2026-04-10", status: "Archive" },
          { version: "Rev.A", publishedAt: "2026-04-24", status: "Obsolete" },
        ],
        compareWith: "Rev.0",
      },
    ],
    recipients: [
      {
        id: "REC-201",
        documentId: "DOC-201",
        name: "Amine Gharbi",
        role: "Chef de projet",
        status: "Lu",
        acknowledgedAt: "2026-04-30 11:08",
      },
      {
        id: "REC-202",
        documentId: "DOC-201",
        name: "Equipe CVC",
        role: "Liste de diffusion",
        status: "Lu",
        acknowledgedAt: "2026-04-30 12:20",
      },
      {
        id: "REC-203",
        documentId: "DOC-201",
        name: "Sous-traitant fluides",
        role: "Execution",
        status: "Non lu",
        acknowledgedAt: "",
      },
      {
        id: "REC-204",
        documentId: "DOC-202",
        name: "Walid Karray",
        role: "Chef chantier elec",
        status: "Lu",
        acknowledgedAt: "2026-04-29 17:41",
      },
      {
        id: "REC-205",
        documentId: "DOC-202",
        name: "Equipe synthese",
        role: "Coordination",
        status: "Non lu",
        acknowledgedAt: "",
      },
    ],
    draftVersion: {
      revision: "Rev.D",
      format: "PDF",
      audience: "Equipe fluides + coordination",
    },
  },
  "BN-031": {
    overview: {
      kpis: [
        {
          label: "Volume documentaire",
          value: "15,7 Go",
          helper: "Plans tablier, ouvrages d'art, drainage et DOE",
          tone: "primary" as const,
        },
        {
          label: "Lecture < 48h",
          value: "95%",
          helper: "Bonne discipline documentaire sur le chantier pont",
          tone: "success" as const,
        },
        {
          label: "Versions actives",
          value: "14",
          helper: "Projet plus resserre mais critiques sur le tablier",
          tone: "warning" as const,
        },
        {
          label: "Docs non diffuses > 5j",
          value: "1",
          helper: "Un dossier environnement attend encore validation",
          tone: "warning" as const,
        },
      ],
      offline: {
        syncedAt: "30/04/2026 15:54",
        cachedFiles: 9,
        coverage: "Derniers plans du tablier et controle ouvrages d'art",
      },
    },
    tree: [
      {
        title: "Pont Mornag",
        nodes: [
          { label: "Ouvrages d'art", phases: ["EXE", "DOE"] },
          { label: "Drainage", phases: ["EXE", "DOE"] },
          { label: "Signalisation", phases: ["EXE"] },
        ],
      },
    ],
    files: [
      {
        id: "DOC-301",
        code: "EXE-TAB-018",
        title: "Etancheite et coupes tablier central",
        discipline: "Ouvrages d'art",
        lot: "Ouvrages d'art",
        phase: "EXE",
        format: "PDF",
        revision: "Rev.E",
        fileSizeMb: 14.2,
        uploadedBy: "Walid Ben Romdhane",
        publishedAt: "2026-04-29",
        status: "Courante",
        tone: "success" as const,
        isCurrent: true,
        offlineReady: true,
        lastDistributedAt: "2026-04-29",
        readCount: 9,
        recipients: 9,
        storage: "S3 /pont/tablier/018-reve.pdf",
        versions: [
          { version: "Rev.C", publishedAt: "2026-04-10", status: "Archive" },
          { version: "Rev.D", publishedAt: "2026-04-21", status: "Obsolete" },
          { version: "Rev.E", publishedAt: "2026-04-29", status: "Courante" },
        ],
        compareWith: "Rev.D",
      },
      {
        id: "DOC-302",
        code: "EXE-APP-005",
        title: "Details appareils d'appui P2/P3",
        discipline: "Structure",
        lot: "Appuis",
        phase: "EXE",
        format: "DWG",
        revision: "Rev.B",
        fileSizeMb: 7.9,
        uploadedBy: "Lotfi Dridi",
        publishedAt: "2026-04-26",
        status: "Diffusion",
        tone: "primary" as const,
        isCurrent: true,
        offlineReady: true,
        lastDistributedAt: "2026-04-27",
        readCount: 6,
        recipients: 8,
        storage: "S3 /pont/appuis/005-revb.dwg",
        versions: [
          { version: "Rev.A", publishedAt: "2026-04-14", status: "Obsolete" },
          { version: "Rev.B", publishedAt: "2026-04-26", status: "Courante" },
        ],
        compareWith: "Rev.A",
      },
      {
        id: "DOC-303",
        code: "ENV-CH-002",
        title: "Plan de balisage environnemental chantier",
        discipline: "Environnement",
        lot: "Signalisation",
        phase: "EXE",
        format: "PDF",
        revision: "Rev.A",
        fileSizeMb: 3.1,
        uploadedBy: "Karim Mzoughi",
        publishedAt: "2026-04-18",
        status: "Non diffuse",
        tone: "danger" as const,
        isCurrent: true,
        offlineReady: false,
        lastDistributedAt: "2026-04-18",
        readCount: 0,
        recipients: 5,
        storage: "S3 /pont/env/002-reva.pdf",
        versions: [
          { version: "Rev.A", publishedAt: "2026-04-18", status: "Courante" },
        ],
        compareWith: "Rev.A",
      },
    ],
    recipients: [
      {
        id: "REC-301",
        documentId: "DOC-301",
        name: "Lotfi Dridi",
        role: "Conducteur de travaux",
        status: "Lu",
        acknowledgedAt: "2026-04-29 10:11",
      },
      {
        id: "REC-302",
        documentId: "DOC-301",
        name: "Equipe tablier",
        role: "Execution",
        status: "Lu",
        acknowledgedAt: "2026-04-29 11:44",
      },
      {
        id: "REC-303",
        documentId: "DOC-302",
        name: "MOE Pont",
        role: "Validation",
        status: "Non lu",
        acknowledgedAt: "",
      },
      {
        id: "REC-304",
        documentId: "DOC-303",
        name: "QSE chantier",
        role: "Diffusion",
        status: "Non lu",
        acknowledgedAt: "",
      },
    ],
    draftVersion: {
      revision: "Rev.F",
      format: "PDF",
      audience: "Equipe tablier + MOE",
    },
  },
};

const financeModuleDataByProject: Record<WorkspaceProjectId, FinanceModuleData> = {
  "BN-042": {
    overview: financeModuleOverview,
    invoices: financeInvoiceSeed.filter((invoice) => invoice.projectId === "BN-042"),
    payments: financePaymentSeed.filter((payment) =>
      ["INV-042", "INV-041"].includes(payment.invoiceId),
    ),
    cashflow: financeCashflowDetailed,
    declaration: financeDeclarationSeed,
    defaultVatRegimeId: "standard",
    dmDraft: {
      periodMonth: "2026-04-01",
      progressPct: 68,
      baseAmountHt: 162000,
      retentionPct: 5,
      advanceDeduction: 4200,
    },
    paymentDraft: {
      amount: "184500",
      method: "Virement",
      reference: "VIR-TN-3004",
    },
  },
  "BN-039": {
    overview: {
      kpis: [
        {
          label: "DSO",
          value: "19 j",
          helper: "Reglement client plus rapide sur les deux derniers mois",
          tone: "success" as const,
        },
        {
          label: "Facturation dans les delais",
          value: "91%",
          helper: "Cycle DM -> facture bien tenu",
          tone: "success" as const,
        },
        {
          label: "Ecart budget / reel",
          value: "-1,4%",
          helper: "Projet encore sous controle financier",
          tone: "primary" as const,
        },
        {
          label: "TVA collectee / declaree",
          value: "99%",
          helper: "Une ecriture de regularisation reste a passer",
          tone: "warning" as const,
        },
      ],
      treasuryAlert:
        "Tension moderee sur fin mai si la facture FAC-2026-136 reste en attente au-dela du 12/05.",
    },
    invoices: [
      {
        id: "INV-136",
        projectId: "BN-039",
        invoiceNumber: "FAC-2026-136",
        project: "Pole Sante Lac 2",
        periodMonth: "2026-04-01",
        amountHt: 168224,
        tvaRate: 19,
        tvaAmount: 31966,
        amountTtc: 200190,
        dueDate: "2026-05-12",
        paidAt: "",
        status: "Envoyee",
        tone: "primary" as const,
        retentionAmount: 8411,
        advanceDeduction: 12000,
        sourceProgress: 42,
        validatedByMoe: true,
        validatedByMo: false,
      },
      {
        id: "INV-132",
        projectId: "BN-039",
        invoiceNumber: "FAC-2026-132",
        project: "Pole Sante Lac 2",
        periodMonth: "2026-03-01",
        amountHt: 141176,
        tvaRate: 19,
        tvaAmount: 26824,
        amountTtc: 168000,
        dueDate: "2026-04-21",
        paidAt: "2026-04-19T14:10:00",
        status: "Payee",
        tone: "success" as const,
        retentionAmount: 7059,
        advanceDeduction: 9800,
        sourceProgress: 37,
        validatedByMoe: true,
        validatedByMo: true,
      },
    ],
    payments: [
      {
        id: "PAY-301",
        invoiceId: "INV-132",
        invoiceNumber: "FAC-2026-132",
        amount: 168000,
        method: "Virement",
        reference: "VIR-TN-1904",
        paidAt: "2026-04-19T14:10:00",
      },
    ],
    cashflow: [
      { label: "Jan", plannedReceipts: 150, actualReceipts: 146, actualCosts: 118 },
      { label: "Fev", plannedReceipts: 178, actualReceipts: 171, actualCosts: 139 },
      { label: "Mar", plannedReceipts: 205, actualReceipts: 198, actualCosts: 156 },
      { label: "Avr", plannedReceipts: 224, actualReceipts: 208, actualCosts: 173 },
      { label: "Mai", plannedReceipts: 246, actualReceipts: 126, actualCosts: 181 },
    ],
    declaration: {
      month: "Avril 2026",
      collectedTva: 58790,
      declaredTva: 58100,
      variance: 690,
      status: "Controle comptable",
    },
    defaultVatRegimeId: "standard",
    dmDraft: {
      periodMonth: "2026-04-01",
      progressPct: 42,
      baseAmountHt: 198000,
      retentionPct: 5,
      advanceDeduction: 12000,
    },
    paymentDraft: {
      amount: "200190",
      method: "Virement",
      reference: "VIR-TN-1205",
    },
  },
  "BN-031": {
    overview: {
      kpis: [
        {
          label: "DSO",
          value: "31 j",
          helper: "Encaissement plus lent sur le marche public",
          tone: "danger" as const,
        },
        {
          label: "Facturation dans les delais",
          value: "74%",
          helper: "Des validations tardent sur les situations de travaux",
          tone: "warning" as const,
        },
        {
          label: "Ecart budget / reel",
          value: "-5,8%",
          helper: "Glissement cout sur les reprises tablier",
          tone: "danger" as const,
        },
        {
          label: "TVA collectee / declaree",
          value: "100%",
          helper: "Projet gere sous regime d'exoneration",
          tone: "success" as const,
        },
      ],
      treasuryAlert:
        "Le projet reste rentable mais la tension cash devient forte si FAC-2026-235 ne passe pas en payee avant le 15/05.",
    },
    invoices: [
      {
        id: "INV-235",
        projectId: "BN-031",
        invoiceNumber: "FAC-2026-235",
        project: "Pont Mornag",
        periodMonth: "2026-04-01",
        amountHt: 214600,
        tvaRate: 0,
        tvaAmount: 0,
        amountTtc: 214600,
        dueDate: "2026-05-15",
        paidAt: "",
        status: "Validee",
        tone: "primary" as const,
        retentionAmount: 10730,
        advanceDeduction: 6500,
        sourceProgress: 79,
        validatedByMoe: true,
        validatedByMo: true,
      },
      {
        id: "INV-231",
        projectId: "BN-031",
        invoiceNumber: "FAC-2026-231",
        project: "Pont Mornag",
        periodMonth: "2026-03-01",
        amountHt: 186200,
        tvaRate: 0,
        tvaAmount: 0,
        amountTtc: 186200,
        dueDate: "2026-04-18",
        paidAt: "2026-04-24T09:05:00",
        status: "Payee",
        tone: "success" as const,
        retentionAmount: 9310,
        advanceDeduction: 6200,
        sourceProgress: 73,
        validatedByMoe: true,
        validatedByMo: true,
      },
    ],
    payments: [
      {
        id: "PAY-401",
        invoiceId: "INV-231",
        invoiceNumber: "FAC-2026-231",
        amount: 186200,
        method: "Virement",
        reference: "VIR-MAR-PONT-24",
        paidAt: "2026-04-24T09:05:00",
      },
    ],
    cashflow: [
      { label: "Jan", plannedReceipts: 240, actualReceipts: 210, actualCosts: 168 },
      { label: "Fev", plannedReceipts: 278, actualReceipts: 246, actualCosts: 193 },
      { label: "Mar", plannedReceipts: 302, actualReceipts: 281, actualCosts: 224 },
      { label: "Avr", plannedReceipts: 326, actualReceipts: 186, actualCosts: 257 },
      { label: "Mai", plannedReceipts: 352, actualReceipts: 0, actualCosts: 266 },
    ],
    declaration: {
      month: "Avril 2026",
      collectedTva: 0,
      declaredTva: 0,
      variance: 0,
      status: "Exonere",
    },
    defaultVatRegimeId: "exempt",
    dmDraft: {
      periodMonth: "2026-04-01",
      progressPct: 79,
      baseAmountHt: 231830,
      retentionPct: 5,
      advanceDeduction: 6500,
    },
    paymentDraft: {
      amount: "214600",
      method: "Virement",
      reference: "VIR-PONT-1505",
    },
  },
};

export function getSiteModuleData(projectId: string): SiteModuleData {
  return cloneData(
    siteModuleDataByProject[(projectId as WorkspaceProjectId) ?? currentProject.id] ??
      siteModuleDataByProject[currentProject.id],
  );
}

export function getDocumentsModuleData(projectId: string): DocumentsModuleData {
  return cloneData(
    documentsModuleDataByProject[(projectId as WorkspaceProjectId) ?? currentProject.id] ??
      documentsModuleDataByProject[currentProject.id],
  );
}

export function getFinanceModuleData(projectId: string): FinanceModuleData {
  return cloneData(
    financeModuleDataByProject[(projectId as WorkspaceProjectId) ?? currentProject.id] ??
      financeModuleDataByProject[currentProject.id],
  );
}
