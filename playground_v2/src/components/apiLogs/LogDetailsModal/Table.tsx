import { Table, TableBody, TableCell, TableRow } from "src/components/Table";
import { ApiLog } from "src/hooks/useApiLogs";

const LogsTable = ({ log }: { log: ApiLog }) => {
  const [provider, ...modelName] = log?.model?.split("/") ?? [];

  return (
    <Table>
      <TableBody>
        <TableRow>
          <TableCell>Model</TableCell>
          <TableCell>{modelName?.join?.("/")}</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>Model ID</TableCell>
          <TableCell>{modelName?.join?.("/")}</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>Provider</TableCell>
          <TableCell>{provider}</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>Moderation Latency</TableCell>
          <TableCell>{provider}</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>First token Latency</TableCell>
          <TableCell>{provider}</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>Throughput</TableCell>
          <TableCell>{provider}</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>Final Cost</TableCell>
          <TableCell>{provider}</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>Generation ID</TableCell>
          <TableCell>{provider}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
};

export default LogsTable;
