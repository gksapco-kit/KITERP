import { ReactNode } from "react";

export function Section({
  step,
  title,
  description,
  action,
  children,
}: {
  step?: number;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="ck-surface ck-border ck-radius-md p-4 md:p-6">
      <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          {step !== undefined && (
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center text-xs font-medium"
              style={{
                borderRadius: "999px",
                background: "hsl(var(--brand-primary))",
                color: "hsl(var(--brand-primary-foreground))",
              }}
            >
              {step}
            </span>
          )}
          <div>
            <h2 className="text-base font-semibold leading-tight">{title}</h2>
            {description && <p className="ck-text-muted mt-0.5 text-sm">{description}</p>}
          </div>
        </div>
        {action && <div className="shrink-0 sm:self-center">{action}</div>}
      </header>
      {children}
    </section>
  );
}
