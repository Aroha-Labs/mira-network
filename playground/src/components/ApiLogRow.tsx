import { ChevronRightIcon } from "@heroicons/react/24/outline";
import { format } from "date-fns";
import { ApiLog } from "src/types/api-log";
import CostCell from "./CostCell";
import TokenCell from "./TokenCell";
import TTFSCell from "./TTFSCell";
import ResponseTimeCell from "./ResponseTimeCell";

const ApiLogRow = ({ log, onClick }: { log: ApiLog; onClick: () => void }) => {
  const [provider, ...modelName] = log.model.split("/");

  return (
    <tr
      key={log.id}
      className="cursor-pointer hover:bg-gray-100 border-b"
      onClick={onClick}
    >
      <td className="px-4 py-2">{format(new Date(log.created_at), "PPp")}</td>
      <td>
        <TokenCell log={log} />
      </td>
      <td>
        <TTFSCell log={log} />
      </td>
      <td>
        <ResponseTimeCell log={log} />
      </td>
      <td className="px-4 py-2">{provider}</td>
      <td className="px-4 py-2">{modelName.join("/")}</td>
      <td className="px-4 py-2">{log.machine_id || "-"}</td>
      <td>
        <CostCell log={log} />
      </td>
      <td className="px-4 py-2 text-right">
        <ChevronRightIcon className="h-5 w-5 inline-block" />
      </td>
    </tr>
  );
};

export default ApiLogRow;
