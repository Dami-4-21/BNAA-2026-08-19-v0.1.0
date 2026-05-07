import { UserRole } from "@prisma/client";

export const pilotTenant = {
  name: "BnaaSaaS Pilot",
  slug: "bnaasaas-pilot",
};

export const pilotUsers: Array<{
  email: string;
  fullName: string;
  password: string;
  role: UserRole;
}> = [
  {
    email: "admin@bnaa.com",
    fullName: "Admin BNAA",
    password: "admin123",
    role: UserRole.ADMIN,
  },
  {
    email: "sara@bnaasaas.tn",
    fullName: "Sara Ben Salah",
    password: "bnaasaas2026",
    role: UserRole.CO,
  },
  {
    email: "amine@bnaasaas.tn",
    fullName: "Amine Gharbi",
    password: "bnaasaas2026",
    role: UserRole.CP,
  },
  {
    email: "nour@bnaasaas.tn",
    fullName: "Nour Baccar",
    password: "bnaasaas2026",
    role: UserRole.CT,
  },
  {
    email: "hichem@bnaasaas.tn",
    fullName: "Hichem Trabelsi",
    password: "bnaasaas2026",
    role: UserRole.BE,
  },
  {
    email: "salma@bnaasaas.tn",
    fullName: "Salma Ben Salem",
    password: "bnaasaas2026",
    role: UserRole.MO,
  },
  {
    email: "adel@bnaasaas.tn",
    fullName: "Adel Mansouri",
    password: "bnaasaas2026",
    role: UserRole.ADMIN,
  },
];

export const pilotProjects: Array<{
  city: string;
  governorate: string;
  memberEmails: string[];
  name: string;
  type: string;
}> = [
  {
    city: "Ariana",
    governorate: "Tunis",
    memberEmails: [
      "admin@bnaa.com",
      "adel@bnaasaas.tn",
      "sara@bnaasaas.tn",
      "amine@bnaasaas.tn",
      "nour@bnaasaas.tn",
      "hichem@bnaasaas.tn",
      "salma@bnaasaas.tn",
    ],
    name: "Residence El Wifak",
    type: "residential",
  },
  {
    city: "Lac 2",
    governorate: "Tunis",
    memberEmails: [
      "admin@bnaa.com",
      "adel@bnaasaas.tn",
      "sara@bnaasaas.tn",
      "amine@bnaasaas.tn",
      "hichem@bnaasaas.tn",
      "salma@bnaasaas.tn",
    ],
    name: "Pole Sante Lac 2",
    type: "healthcare",
  },
  {
    city: "Mornag",
    governorate: "Ben Arous",
    memberEmails: [
      "admin@bnaa.com",
      "adel@bnaasaas.tn",
      "sara@bnaasaas.tn",
      "amine@bnaasaas.tn",
      "salma@bnaasaas.tn",
    ],
    name: "Pont Mornag",
    type: "infrastructure",
  },
];
