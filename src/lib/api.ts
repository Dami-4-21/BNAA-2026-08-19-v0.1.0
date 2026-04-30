"use client";

type ApiFetchOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
};

type ApiErrorShape = {
  error?: string;
};

export async function apiFetch<T>(
  input: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const response = await fetch(input, {
    credentials: "include",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    body:
      options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? ((await response.json()) as T | ApiErrorShape) : null;

  if (!response.ok) {
    throw new Error(
      (payload as ApiErrorShape | null)?.error ?? "Une erreur serveur est survenue.",
    );
  }

  return payload as T;
}

export async function apiUpload<T>(
  input: string,
  formData: FormData,
  options: Omit<RequestInit, "body" | "headers"> = {},
): Promise<T> {
  const response = await fetch(input, {
    credentials: "include",
    ...options,
    body: formData,
  });

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? ((await response.json()) as T | ApiErrorShape) : null;

  if (!response.ok) {
    throw new Error(
      (payload as ApiErrorShape | null)?.error ?? "Une erreur serveur est survenue.",
    );
  }

  return payload as T;
}
