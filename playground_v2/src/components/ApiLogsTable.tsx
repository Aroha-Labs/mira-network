import ApiLogRow from "src/components/ApiLogRow";

interface ApiLog {
  user_id: string;
  payload: string;
  prompt_tokens: number;
  total_tokens: number;
  model: string;
  id: number;
  response: string;
  completion_tokens: number;
  total_response_time: number;
  created_at: string;
}

interface ApiLogsTableProps {
  logs?: ApiLog[];
  orderBy: string;
  order: string;
  onOrderByChange: (field: string) => void;
  onRowClick: (log: ApiLog) => void;
}

const ApiLogsTable: React.FC<ApiLogsTableProps> = ({
  logs,
  orderBy,
  order,
  onOrderByChange,
  onRowClick,
}) => {
  const getOrderIcon = (field: string) => {
    if (orderBy === field) {
      return order === "asc" ? "▲" : "▼";
    }
    return "";
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-white border border-gray-200">
        <thead>
          <tr>
            <th
              className="px-4 py-2 text-left border-b cursor-pointer"
              onClick={() => onOrderByChange("created_at")}
            >
              Timestamp {getOrderIcon("created_at")}
            </th>
            <th
              className="px-4 py-2 text-left border-b cursor-pointer"
              onClick={() => onOrderByChange("total_tokens")}
            >
              Tokens {getOrderIcon("total_tokens")}
            </th>
            <th className="px-4 py-2 text-left border-b">Provider</th>
            <th className="px-4 py-2 text-left border-b">Model</th>
            <th
              className="px-4 py-2 text-left border-b cursor-pointer"
              onClick={() => onOrderByChange("total_response_time")}
            >
              Cost {getOrderIcon("total_response_time")}
            </th>
            <th className="px-4 py-2 text-left border-b"></th>
          </tr>
        </thead>
        <tbody>
          {logs?.map((log) => {
            const [provider, ...modelName] = log.model.split("/");
            return (
              <ApiLogRow
                key={log.id}
                log={{ ...log, model: modelName.join("/"), provider }}
                onClick={() => onRowClick(log)}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default ApiLogsTable;
