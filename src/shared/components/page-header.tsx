import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-3">
      <div className="space-y-1">
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {description ? <p className="text-sm text-muted-foreground text-pretty">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
