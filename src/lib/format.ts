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
  return dateFormatter.format(new Date(value));
}

export function formatDate(value: string) {
  return fullDateFormatter.format(new Date(value));
}
