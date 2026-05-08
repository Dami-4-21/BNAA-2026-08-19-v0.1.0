const tndFormatter = new Intl.NumberFormat("fr-TN", {
  style: "currency",
  currency: "TND",
  maximumFractionDigits: 0,
});

const compactFormatter = new Intl.NumberFormat("fr-FR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const shortDateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
});

const fullDateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const shortTimeFormatter = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
});

function resolveDate(value: string | Date) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const monthYearMatch = value.match(/^(\d{2})\/(\d{4})$/);
  if (monthYearMatch) {
    const [, month, year] = monthYearMatch;
    const parsed = new Date(`${year}-${month}-01T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const monthInputMatch = value.match(/^(\d{4})-(\d{2})$/);
  if (monthInputMatch) {
    const [, year, month] = monthInputMatch;
    const parsed = new Date(`${year}-${month}-01T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatTND(value: number) {
  return tndFormatter.format(value);
}

export function formatCurrency(value: number) {
  return formatTND(value);
}

export function formatCompact(value: number) {
  return compactFormatter.format(value);
}

export function formatPercent(value: number) {
  return `${value}%`;
}

export function formatShortDate(value: string | Date) {
  const date = resolveDate(value);
  return date ? shortDateFormatter.format(date) : String(value);
}

export function formatDate(value: string | Date) {
  const date = resolveDate(value);
  return date ? fullDateFormatter.format(date) : String(value);
}

export function timeAgo(value: string | Date, now: Date = new Date()) {
  const date = resolveDate(value);
  if (!date) {
    return String(value);
  }

  const deltaMs = now.getTime() - date.getTime();
  const deltaMinutes = Math.round(Math.abs(deltaMs) / 60_000);
  const isPast = deltaMs >= 0;

  if (deltaMinutes < 1) {
    return "a l'instant";
  }

  if (deltaMinutes < 60) {
    return `${deltaMinutes} min ${isPast ? "plus tot" : "a venir"}`;
  }

  const deltaHours = Math.round(deltaMinutes / 60);
  if (deltaHours < 24) {
    return `${deltaHours} h ${isPast ? "plus tot" : "a venir"}`;
  }

  const deltaDays = Math.round(deltaHours / 24);
  if (deltaDays < 7) {
    return `${deltaDays} j ${isPast ? "plus tot" : "a venir"}`;
  }

  return `${formatDate(date)} · ${shortTimeFormatter.format(date)}`;
}

export function formatVersion(value: string) {
  const version = value.trim();
  if (!version) {
    return "Revision a definir";
  }

  if (/^rev[\s.-]*/i.test(version)) {
    return version.replace(/^rev[\s.-]*/i, "Rev. ");
  }

  return version.toLowerCase().startsWith("v")
    ? version.toUpperCase()
    : `Rev. ${version.toUpperCase()}`;
}
