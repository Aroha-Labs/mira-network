import { CaretRight } from "@phosphor-icons/react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "src/components/Table";
import Card from "src/components/card";
import { ApiLog, ApiLogsResponse } from "src/hooks/useApiLogs";
import calculateCosts from "./calculateCost";

const LogsTable = ({
  onRowClick,
  data,
  isLoading,
  error,
}: {
  onRowClick: (log: ApiLog) => void;
  data?: ApiLogsResponse;
  isLoading: boolean;
  error: Error | null;
}) => {
  if (isLoading) {
    return (
      <Card className="w-[720px] h-[400px] flex justify-center items-center">
        Loading...
      </Card>
    );
  }

  if (error || data?.logs?.length === 0) {
    return (
      <Card className="w-[720px] h-[400px] flex justify-center items-center text-[#303030] opacity-40">
        *cricket noises*
      </Card>
    );
  }

  return (
    <Card>
      <Table className="m-4">
        <TableHeader>
          <TableRow>
            <TableHead>Timestamp</TableHead>
            <TableHead>Tokens</TableHead>
            <TableHead>Node</TableHead>
            <TableHead>Model</TableHead>
            <TableHead>Cost</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data?.logs?.map((log) => {
            return (
              <TableRow
                key={log?.id}
                onClick={() => onRowClick(log)}
                className="cursor-pointer"
              >
                <TableCell>
                  {new Date(log.created_at).toLocaleString()}
                </TableCell>
                <TableCell>{log.total_tokens}</TableCell>
                <TableCell>{log?.machine_id}</TableCell>
                <TableCell>{log?.model}</TableCell>
                <TableCell>${calculateCosts(log)?.toFixed(3)}</TableCell>
                <TableCell>
                  <CaretRight className="h-5 w-5 inline-block" />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
};

export default LogsTable;
