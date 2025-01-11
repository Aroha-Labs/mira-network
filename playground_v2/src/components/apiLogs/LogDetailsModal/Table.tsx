import { Table, TableBody, TableCell, TableRow } from "src/components/Table";
import { ApiLog } from "src/hooks/useApiLogs";
import calculateCosts from "../calculateCost";

const formatTime = (time: number) => {
  if (time < 1) {
    return `${(time * 1000).toFixed(0)}ms`;
  }
  return `${time.toFixed(2)}s`;
};

const calculateThroughput = (log: ApiLog) => {
  try {
    const totalTokenGenerationTime = log.total_response_time - log.ttft;
    if (totalTokenGenerationTime <= 0 || log.total_tokens <= 0) {
      return 0;
    }
    return (log.total_tokens / totalTokenGenerationTime)?.toFixed(2);
  } catch (error) {
    console.error("Error calculating throughput: ", error);
    return 0;
  }
};

const LogsTable = ({ log }: { log: ApiLog }) => {
  return (
    <Table>
      <TableBody>
        <TableRow>
          <TableCell>Model</TableCell>
          <TableCell>{log?.model}</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>Machine ID</TableCell>
          <TableCell>{log?.machine_id}</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>Response Time</TableCell>
          <TableCell>{formatTime(log?.total_response_time)}</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>First token Latency</TableCell>
          <TableCell>{log.ttft ? formatTime(log.ttft) : "-"}</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>Throughput</TableCell>
          <TableCell>{calculateThroughput(log)}</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>Final Cost</TableCell>
          <TableCell>${calculateCosts(log)}</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>Generation ID</TableCell>
          <TableCell>{log?.id}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
};

export default LogsTable;
