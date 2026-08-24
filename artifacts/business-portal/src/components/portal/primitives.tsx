/**
 * Shared visual primitives for the Business CRM shell + pages, adapted from
 * the Lovable "Aorane Business CRM" reference design (see docs discussion).
 * Pure presentation only — no data fetching, no routing. Ports the same
 * component API (NeuCard/CardShell/PageHeader/StatCard/etc.) so every CRM
 * page can be restyled consistently without re-inventing these each time.
 *
 * Reuses the neumorphic/glass/tone-* utilities already ported into
 * index.css ("PORTAL/CRM DESIGN TOKENS" block) instead of inventing a new
 * token set.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

/* ---------------- Surfaces ---------------- */

export function NeuCard({
  className,
  children,
  variant = "raised",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { variant?: "raised" | "flat" | "inset" | "glass" }) {
  return (
    <div
      className={cn(
        "rounded-3xl",
        variant === "raised" && "neu",
        variant === "flat" && "neu-flat",
        variant === "inset" && "neu-inset",
        variant === "glass" && "glass",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardShell({
  title,
  description,
  action,
  children,
  className,
  contentClassName,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <NeuCard className={cn("flex flex-col p-5 sm:p-6", className)}>
      {(title || action) && (
        <div className="mb-5 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="min-w-0">
            {title && (
              <h3 className="truncate text-base font-semibold tracking-tight text-foreground">
                {title}
              </h3>
            )}
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          </div>
          {action ? <div className="shrink-0">{action}</div> : <span />}
        </div>
      )}
      <div className={cn("min-w-0 flex-1", contentClassName)}>{children}</div>
    </NeuCard>
  );
}

/* ---------------- Page header ---------------- */

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {title}
        </h1>
        {description && <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div>}
    </header>
  );
}

/* ---------------- Stats ---------------- */

const toneMap = {
  primary: "tone-primary",
  mint: "tone-mint",
  teal: "tone-teal",
  lavender: "tone-lavender",
  amber: "tone-amber",
} as const;

export type Tone = keyof typeof toneMap;

export function toneClasses(tone: Tone) {
  return toneMap[tone];
}

export function StatCard({
  label,
  value,
  delta,
  hint,
  icon,
  tone = "primary",
  footer,
}: {
  label: string;
  value: string | number;
  delta?: number;
  hint?: string;
  icon?: ReactNode;
  tone?: Tone;
  footer?: ReactNode;
}) {
  const positive = (delta ?? 0) >= 0;
  return (
    <NeuCard className="p-5 transition-shadow duration-300 hover:shadow-[var(--portal-neu-raised-lg)]">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <p className="min-w-0 truncate text-sm font-medium text-muted-foreground">{label}</p>
        {icon && (
          <span
            className={cn(
              "grid size-10 shrink-0 place-items-center rounded-2xl [&_svg]:size-[18px]",
              toneMap[tone],
            )}
          >
            {icon}
          </span>
        )}
      </div>
      <p className="mt-3 text-3xl font-bold tracking-tight text-foreground">{value}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {delta !== undefined && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
              positive ? "tone-mint" : "tone-danger",
            )}
          >
            {positive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            {positive ? "+" : ""}
            {delta}%
          </span>
        )}
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {footer && <div className="mt-4">{footer}</div>}
    </NeuCard>
  );
}

/* ---------------- Misc ---------------- */

export function Avatar({
  name,
  tone = "primary",
  size = "md",
}: {
  name: string;
  tone?: Tone;
  size?: "sm" | "md" | "lg";
}) {
  const initials = (name || "?")
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-2xl font-semibold",
        toneMap[tone],
        size === "sm" && "size-8 text-[11px]",
        size === "md" && "size-10 text-xs",
        size === "lg" && "size-14 rounded-3xl text-base",
      )}
    >
      {initials || "?"}
    </span>
  );
}

export function ProgressBar({
  value,
  tone = "primary",
  className,
}: {
  value: number;
  tone?: Tone;
  className?: string;
}) {
  const bg = {
    primary: "bg-primary",
    mint: "bg-[oklch(0.78_0.11_168)]",
    teal: "bg-secondary",
    lavender: "bg-[oklch(0.7_0.1_292)]",
    amber: "bg-[oklch(0.79_0.13_78)]",
  }[tone];
  return (
    <div className={cn("neu-inset-sm h-2.5 w-full overflow-hidden rounded-full", className)}>
      <div
        className={cn("h-full rounded-full transition-[width] duration-700 ease-out", bg)}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-3xl px-6 py-14 text-center">
      {icon && (
        <span className="neu-inset grid size-14 place-items-center rounded-3xl text-muted-foreground [&_svg]:size-6">
          {icon}
        </span>
      )}
      <h4 className="text-base font-semibold text-foreground">{title}</h4>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action}
    </div>
  );
}

export function LoadingRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="neu-inset-sm h-12 animate-pulse rounded-2xl" />
      ))}
    </div>
  );
}

export function StatusDot({ tone }: { tone: "success" | "warning" | "danger" | "muted" }) {
  const cls = {
    success: "bg-[oklch(0.68_0.12_162)]",
    warning: "bg-[oklch(0.8_0.13_80)]",
    danger: "bg-destructive",
    muted: "bg-muted-foreground/50",
  }[tone];
  return <span className={cn("inline-block size-2 shrink-0 rounded-full", cls)} />;
}

export function PrivacyNote({ children }: { children: ReactNode }) {
  return (
    <div className="text-xs leading-relaxed text-muted-foreground">
      <Badge variant="outline" className="mr-2 align-middle">
        Privacy
      </Badge>
      {children}
    </div>
  );
}
