export type PilotLegacyRole =
  | "Comptable"
  | "Chef de projet"
  | "Conductrice travaux"
  | "Bureau d'etudes"
  | "Maitre d'ouvrage"
  | "Super Admin";

export type PilotBackendRole = "ADMIN" | "BE" | "CO" | "CP" | "CT" | "MO";

export type PilotTenantSeed = {
  name: string;
  sector: string;
  slug: string;
};

export type PilotUserSeed = {
  backendId: string;
  email: string;
  fullName: string;
  initials: string;
  legacyId: string;
  legacyRole: PilotLegacyRole;
  password: string;
  role: PilotBackendRole;
};

export type PilotProjectSeed = {
  allowedRoles: PilotLegacyRole[];
  backendId: string;
  budgetTnd: number;
  city: string;
  client: string;
  code: string;
  governorate: string;
  invoicesDue: number;
  legacyId: string;
  location: string;
  memberLegacyIds: string[];
  name: string;
  nextMilestone: string;
  progress: number;
  spentTnd: number;
  status: string;
  type: string;
};

export const pilotTenant: PilotTenantSeed = {
  name: "BnaaSaaS",
  sector: "Genie civil - Tunisie",
  slug: "bnaasaas-pilot",
};

export const pilotUsers: PilotUserSeed[] = [
  {
    backendId: "10000000-0000-4000-8000-000000000000",
    email: "admin@bnaa.com",
    fullName: "Admin BNAA",
    initials: "AD",
    legacyId: "USR-000",
    legacyRole: "Super Admin",
    password: "admin123",
    role: "ADMIN",
  },
  {
    backendId: "10000000-0000-4000-8000-000000000001",
    email: "sara@bnaasaas.tn",
    fullName: "Sara Ben Salah",
    initials: "SB",
    legacyId: "USR-001",
    legacyRole: "Comptable",
    password: "bnaasaas2026",
    role: "CO",
  },
  {
    backendId: "10000000-0000-4000-8000-000000000002",
    email: "amine@bnaasaas.tn",
    fullName: "Amine Gharbi",
    initials: "AG",
    legacyId: "USR-002",
    legacyRole: "Chef de projet",
    password: "bnaasaas2026",
    role: "CP",
  },
  {
    backendId: "10000000-0000-4000-8000-000000000003",
    email: "nour@bnaasaas.tn",
    fullName: "Nour Baccar",
    initials: "NB",
    legacyId: "USR-003",
    legacyRole: "Conductrice travaux",
    password: "bnaasaas2026",
    role: "CT",
  },
  {
    backendId: "10000000-0000-4000-8000-000000000004",
    email: "hichem@bnaasaas.tn",
    fullName: "Hichem Trabelsi",
    initials: "HT",
    legacyId: "USR-004",
    legacyRole: "Bureau d'etudes",
    password: "bnaasaas2026",
    role: "BE",
  },
  {
    backendId: "10000000-0000-4000-8000-000000000005",
    email: "salma@bnaasaas.tn",
    fullName: "Salma Ben Salem",
    initials: "SS",
    legacyId: "USR-005",
    legacyRole: "Maitre d'ouvrage",
    password: "bnaasaas2026",
    role: "MO",
  },
  {
    backendId: "10000000-0000-4000-8000-000000000006",
    email: "adel@bnaasaas.tn",
    fullName: "Adel Mansouri",
    initials: "AM",
    legacyId: "USR-006",
    legacyRole: "Super Admin",
    password: "bnaasaas2026",
    role: "ADMIN",
  },
];

export const pilotProjects: PilotProjectSeed[] = [
  {
    allowedRoles: [
      "Comptable",
      "Chef de projet",
      "Conductrice travaux",
      "Bureau d'etudes",
      "Maitre d'ouvrage",
      "Super Admin",
    ],
    backendId: "20000000-0000-4000-8000-000000000042",
    budgetTnd: 2850000,
    city: "Ariana",
    client: "Groupe Al Menzah",
    code: "BN-042",
    governorate: "Tunis",
    invoicesDue: 2,
    legacyId: "BN-042",
    location: "Tunis, Ariana",
    memberLegacyIds: [
      "USR-000",
      "USR-001",
      "USR-002",
      "USR-003",
      "USR-004",
      "USR-005",
      "USR-006",
    ],
    name: "Residence El Wifak",
    nextMilestone: "Voiles RDC - 03/05/2026",
    progress: 68,
    spentTnd: 1925000,
    status: "En execution",
    type: "residential",
  },
  {
    allowedRoles: [
      "Comptable",
      "Chef de projet",
      "Bureau d'etudes",
      "Maitre d'ouvrage",
      "Super Admin",
    ],
    backendId: "20000000-0000-4000-8000-000000000039",
    budgetTnd: 4120000,
    city: "Lac 2",
    client: "Clinique El Amen",
    code: "BN-039",
    governorate: "Tunis",
    invoicesDue: 1,
    legacyId: "BN-039",
    location: "Tunis, Lac 2",
    memberLegacyIds: ["USR-000", "USR-001", "USR-002", "USR-004", "USR-005", "USR-006"],
    name: "Pole Sante Lac 2",
    nextMilestone: "Visa CVC - 05/05/2026",
    progress: 42,
    spentTnd: 2018000,
    status: "En execution",
    type: "healthcare",
  },
  {
    allowedRoles: ["Comptable", "Chef de projet", "Maitre d'ouvrage", "Super Admin"],
    backendId: "20000000-0000-4000-8000-000000000031",
    budgetTnd: 6350000,
    city: "Mornag",
    client: "Ministere de l'equipement",
    code: "BN-031",
    governorate: "Ben Arous",
    invoicesDue: 3,
    legacyId: "BN-031",
    location: "Ben Arous, Mornag",
    memberLegacyIds: ["USR-000", "USR-001", "USR-002", "USR-005", "USR-006"],
    name: "Pont Mornag",
    nextMilestone: "Facture lot tablier - 06/05/2026",
    progress: 79,
    spentTnd: 5084000,
    status: "Phase encaissement",
    type: "infrastructure",
  },
];
