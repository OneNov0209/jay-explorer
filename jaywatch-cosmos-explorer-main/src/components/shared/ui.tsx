import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("card-3d backdrop-blur-sm", className)}
      {...props}
    />
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <Card
      className={cn(
        "p-5 relative overflow-hidden group hover:border-primary/40 transition",
        accent && "shadow-glow",
      )}
    >
      <div className="absolute inset-0 bg-gradient-glow opacity-0 group-hover:opacity-100 transition" />
      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
          {icon && <div className="text-primary/70">{icon}</div>}
        </div>
        <div className="text-2xl font-bold tracking-tight">{value}</div>
        {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
      </div>
    </Card>
  );
}

export function Badge({
  children,
  variant = "default",
  className,
}: {
  children: React.ReactNode;
  variant?: "default" | "success" | "destructive" | "warning" | "muted";
  className?: string;
}) {
  const cls = {
    default: "bg-primary/15 text-primary border-primary/30",
    success: "bg-success/15 text-success border-success/30",
    destructive: "bg-destructive/15 text-destructive border-destructive/30",
    warning: "bg-warning/15 text-warning border-warning/30",
    muted: "bg-muted text-muted-foreground border-border",
  }[variant];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border",
        cls,
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <div
      className={cn(
        "h-4 w-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin",
        className,
      )}
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted/60", className)} />;
}
