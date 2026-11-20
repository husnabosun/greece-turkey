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
    <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-1">
        <h1 className="text-ap-title text-ink md:text-[32px] md:leading-[38px]">{title}</h1>
        {description ? (
          <p className="max-w-2xl text-ap-body font-medium text-muted-foreground text-pretty">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
