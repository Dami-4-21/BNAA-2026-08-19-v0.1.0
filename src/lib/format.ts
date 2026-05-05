const tndFormatter = new Intl.NumberFormat("fr-TN", {
  style: "currency",
  currency: "TND",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
});

const fullDateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function resolveDate(value: string) {
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

export function formatCurrency(value: number) {
  return tndFormatter.format(value);
}

export function formatCompact(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatPercent(value: number) {
  return `${value}%`;
}

export function formatShortDate(value: string) {
  const date = resolveDate(value);
  return date ? dateFormatter.format(date) : value;
}

export function formatDate(value: string) {
  const date = resolveDate(value);
  return date ? fullDateFormatter.format(date) : value;
}
