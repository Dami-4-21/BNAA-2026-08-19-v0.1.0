"use client";

import { z } from "zod";

import type { UserRole } from "@/lib/auth";

const roleSchema = z.custom<UserRole>((value) => typeof value === "string" && value.length > 0, {
  message: "Selectionnez un role.",
});

export const createUserFormSchema = z
  .object({
    email: z.email("Renseignez un email valide."),
    name: z.string().trim().min(3, "Le nom complet est requis."),
    password: z.string().trim().min(6, "Le mot de passe doit contenir au moins 6 caracteres."),
    projectIds: z.array(z.string()).default([]),
    role: roleSchema,
  })
  .superRefine((value, context) => {
    if (value.role !== "Super Admin" && value.projectIds.length === 0) {
      context.addIssue({
        code: "custom",
        message: "Choisissez au moins un projet accessible pour ce role.",
        path: ["projectIds"],
      });
    }
  });

export const createProjectFormSchema = z.object({
  budgetTnd: z
    .string()
    .trim()
    .refine((value) => value === "" || !Number.isNaN(Number(value)), {
      message: "Le budget doit etre numerique.",
    }),
  client: z.string().trim().min(2, "Le client est requis."),
  code: z.string().trim().min(2, "Le code projet est requis."),
  location: z.string().trim().min(2, "La localisation est requise."),
  lots: z.string().trim().min(2, "Ajoutez au moins un lot."),
  name: z.string().trim().min(3, "Le nom du projet est requis."),
  nextMilestone: z.string().trim().min(2, "Le prochain jalon est requis."),
  phases: z.string().trim().min(2, "Ajoutez au moins une phase."),
  status: z.string().trim().min(2, "Le statut est requis."),
  zones: z.string().trim().min(2, "Ajoutez au moins une zone."),
});

export type CreateProjectFormValues = z.output<typeof createProjectFormSchema>;
export type CreateUserFormInput = z.input<typeof createUserFormSchema>;
export type CreateUserFormValues = z.output<typeof createUserFormSchema>;
