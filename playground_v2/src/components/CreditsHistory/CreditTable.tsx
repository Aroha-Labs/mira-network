import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "src/components/Table";
import Card from "src/components/card";
import { CreditHistory } from "src/hooks/useCreditHistory";
import { cn } from "src/lib/utils";

const CreditTable = ({
  data,
  isLoading,
  error,
}: {
  data?: {
    history: CreditHistory[];
    total: number;
    page_size: number;
  };
  isLoading: boolean;
  error: Error | null;
}) => {
  if (isLoading) {
    return (
      <Card
        className={cn("w-[720px] h-[400px] flex justify-center items-center")}
      >
        Loading...
      </Card>
    );
  }

  if (error || data?.history?.length === 0) {
    return (
      <Card
        className={cn(
          "w-[720px] h-[400px] flex justify-center items-center text-[#303030] opacity-40"
        )}
      >
        *cricket noises*
      </Card>
    );
  }

  return (
    <Card contentClassName={cn("overflow-hidden")}>
      <Table
        className={cn("m-0 w-[625px]")}
        containerClassName={cn(
          "w-[620px] h-[400px] overflow-auto m-4 pb-[50px]"
        )}
      >
        <TableHeader className={cn("sticky top-0 bg-white z-10")}>
          <TableRow>
            <TableHead>Timestamp</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Description</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data?.history?.map((log) => (
            <TableRow key={log?.id}>
              <TableCell>
                {log?.created_at &&
                  format(new Date(log?.created_at), "MMM d, yyyy HH:mm")}
              </TableCell>
              <TableCell
                className={cn({
                  "text-green-500": log.amount > 0,
                  "text-red-500": log.amount < 0,
                  "text-black": log.amount === 0,
                })}
              >
                {log.amount?.toFixed(4)}
              </TableCell>
              <TableCell>{log.description}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
};

export default CreditTable;
