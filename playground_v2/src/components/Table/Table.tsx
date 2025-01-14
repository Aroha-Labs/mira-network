import * as React from "react";
import Skeleton from "src/components/Skelton";
import { v4 as uuidv4 } from "uuid";

import { cn } from "src/lib/utils";

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-auto">
    <table
      ref={ref}
      className={cn("w-full caption-bottom text-sm border-b pb-16", className)}
      {...props}
    />
  </div>
));
Table.displayName = "Table";

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("", className)} {...props} />
));
TableHeader.displayName = "TableHeader";

interface TableBodyProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  loading?: boolean;
  rows?: number;
  columns?: number;
}

const TableBody = React.forwardRef<HTMLTableSectionElement, TableBodyProps>(
  ({ className, loading = false, rows = 5, columns = 10, ...props }, ref) => {
    if (loading) {
      return (
        <tbody
          ref={ref}
          className={cn(
            "[&_tr]:border-b [&_tr:last-child]:border-0",
            className
          )}
        >
          {Array.from({ length: rows }).map(() => (
            <TableRow key={uuidv4()}>
              {Array.from({ length: columns }).map(() => (
                <TableCell key={uuidv4()}>
                  <Skeleton className="h-6" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </tbody>
      );
    }
    return (
      <tbody
        ref={ref}
        className={cn("[&_tr:last-child]:border-0", className)}
        {...props}
      />
    );
  }
);
TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
      className
    )}
    {...props}
  />
));
TableFooter.displayName = "TableFooter";

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted border-b",
      className
    )}
    {...props}
  />
));
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-12 px-4 text-left align-middle font-medium text-[var(--base-muted-foreground,#71717A)] font-[JetBrains Mono] text-[10px] font-normal font-[var(--font-weight-medium,500)] leading-[var(--typography-base-sizes-small-line-height,20px)] tracking-[0.1em] uppercase",
      className
    )}
    {...props}
  />
));
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      "p-4 align-middle overflow-hidden text-[var(--base-foreground,#18181B)] text-ellipsis text-[10px] font-normal font-[var(--font-weight-medium,500)] leading-[var(--typography-base-sizes-small-line-height,20px)] [&:has([role=checkbox])]:pr-0 display-webkit-box webkit-box-orient-vertical webkit-line-clamp-1",
      className
    )}
    {...props}
  />
));
TableCell.displayName = "TableCell";

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-sm text-muted-foreground", className)}
    {...props}
  />
));
TableCaption.displayName = "TableCaption";

export {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
};
