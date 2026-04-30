import type { LucideIcon } from "lucide-react";

export type Tone = "neutral" | "primary" | "success" | "warning" | "danger";

export function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

const toneStyles: Record<Tone, string> = {
  neutral: "border-stone-200 bg-stone-100 text-stone-700",
  primary: "border-black/10 bg-black text-white",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  danger: "border-rose-200 bg-rose-50 text-rose-700",
};

const iconToneStyles: Record<Tone, string> = {
  neutral: "bg-stone-100 text-stone-700",
  primary: "bg-black text-white",
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  danger: "bg-rose-100 text-rose-700",
};

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="space-y-2">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
            {eyebrow}
          </p>
        ) : null}
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-stone-950 md:text-4xl">
            {title}
          </h1>
          {description ? (
            <p className="max-w-3xl text-sm leading-6 text-stone-600 md:text-base">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold tracking-wide",
        toneStyles[tone],
      )}
    >
      {children}
    </span>
  );
}

export function Panel({
  title,
  description,
  action,
  className,
  children,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cx("glass-panel rounded-[24px] p-5 md:p-6", className)}>
      {title || description || action ? (
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            {title ? (
              <h2 className="font-display text-xl font-semibold text-stone-950">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="max-w-2xl text-sm leading-6 text-stone-600">
                {description}
              </p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function MetricCard({
  label,
  value,
  helper,
  delta,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  helper: string;
  delta?: string;
  icon?: LucideIcon;
  tone?: Tone;
}) {
  return (
    <div className="glass-panel-soft rounded-[22px] p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-3">
          <p className="text-sm font-medium text-stone-600">{label}</p>
          <div className="space-y-1">
            <p className="font-display text-3xl font-semibold text-stone-950">
              {value}
            </p>
            {delta ? (
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-stone-500">
                {delta}
              </p>
            ) : null}
          </div>
        </div>
        {Icon ? (
          <div
            className={cx(
              "flex size-11 items-center justify-center rounded-2xl border border-stone-200",
              iconToneStyles[tone],
            )}
          >
            <Icon className="size-5" />
          </div>
        ) : null}
      </div>
      <p className="mt-4 text-sm leading-6 text-stone-600">{helper}</p>
    </div>
  );
}

export function ProgressBar({
  value,
  tone = "primary",
}: {
  value: number;
  tone?: Tone;
}) {
  const barTone: Record<Tone, string> = {
    neutral: "from-stone-300 to-stone-500",
    primary: "from-black to-stone-600",
    success: "from-emerald-500 to-emerald-400",
    warning: "from-amber-500 to-amber-400",
    danger: "from-rose-500 to-rose-400",
  };

  return (
    <div className="h-2 rounded-full bg-stone-200">
      <div
        className={cx("h-2 rounded-full bg-gradient-to-r", barTone[tone])}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

export function SimpleBarChart({
  data,
}: {
  data: Array<{ label: string; planned: number; actual: number }>;
}) {
  const max = Math.max(...data.flatMap((item) => [item.planned, item.actual]), 1);

  return (
    <div className="grid grid-cols-5 gap-3">
      {data.map((item) => (
        <div key={item.label} className="space-y-3">
          <div className="flex h-44 items-end justify-center gap-2 rounded-[18px] border border-stone-200 bg-stone-50 px-3 pb-3 pt-5">
            <div className="flex w-full items-end gap-2">
              <div className="flex-1">
                <div
                  className="w-full rounded-t-full bg-stone-300"
                  style={{ height: `${(item.planned / max) * 128}px` }}
                />
              </div>
              <div className="flex-1">
                <div
                  className="w-full rounded-t-full bg-gradient-to-t from-black to-stone-500"
                  style={{ height: `${(item.actual / max) * 128}px` }}
                />
              </div>
            </div>
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-stone-900">{item.label}</p>
            <p className="text-xs text-stone-500">
              Prev. {item.planned} / Reel {item.actual || "-"}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function AvatarStack({
  people,
}: {
  people: Array<{ initials: string; name: string; role?: string }>;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {people.map((person) => (
        <div
          key={person.name}
          className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-stone-50 px-3 py-2"
        >
          <div className="flex size-10 items-center justify-center rounded-2xl bg-black font-mono text-sm font-semibold text-white">
            {person.initials}
          </div>
          <div>
            <p className="text-sm font-semibold text-stone-950">{person.name}</p>
            {person.role ? (
              <p className="text-xs text-stone-500">{person.role}</p>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
