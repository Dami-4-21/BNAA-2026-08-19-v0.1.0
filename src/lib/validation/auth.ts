"use client";

import { z } from "zod";

export const loginFormSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "L'email est requis.")
    .email("Saisissez un email valide."),
  password: z
    .string()
    .min(1, "Le mot de passe est requis."),
});

export type LoginFormValues = z.infer<typeof loginFormSchema>;
