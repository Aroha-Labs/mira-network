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
import useApiLogs from "src/hooks/useApiLogs";

const LogsTable = ({ onRowClick }: { onRowClick: (log: ApiLog) => void }) => {
  const { data, isLoading, error } = useApiLogs();

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
            <TableHead>Provider</TableHead>
            <TableHead>Model</TableHead>
            <TableHead>Cost</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data?.logs?.map((log) => {
            const [provider, ...modelName] = log.model.split("/");
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
                <TableCell>{provider}</TableCell>
                <TableCell>{modelName.join("/")}</TableCell>
                <TableCell>${(log.total_tokens * 0.0003).toFixed(3)}</TableCell>
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
