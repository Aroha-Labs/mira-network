import { cn } from "src/lib/utils";

function Skeleton({
  className,
  ...props
}: Readonly<React.HTMLAttributes<HTMLDivElement>>) {
  return (
    <div className={cn("animate-pulse bg-primary/10", className)} {...props} />
  );
}

export { Skeleton };
