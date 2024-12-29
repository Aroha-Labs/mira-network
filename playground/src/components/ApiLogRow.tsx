import { ChevronRightIcon } from "@heroicons/react/24/outline";

interface ApiLog {
  user_id: string;
  payload: string;
  prompt_tokens: number;
  total_tokens: number;
  model: string;
  provider: string;
  id: number;
  response: string;
  completion_tokens: number;
  total_response_time: number;
  created_at: string;
}

const ApiLogRow = ({ log, onClick }: { log: ApiLog; onClick: () => void }) => (
  <tr
    key={log.id}
    className="cursor-pointer hover:bg-gray-100 border-b"
    onClick={onClick}
  >
    <td className="px-4 py-2">{new Date(log.created_at).toLocaleString()}</td>
    <td className="px-4 py-2">{log.total_tokens}</td>
    <td className="px-4 py-2">{log.provider}</td>
    <td className="px-4 py-2">{log.model}</td>
    <td className="px-4 py-2">${(log.total_tokens * 0.0003).toFixed(3)}</td>
    <td className="px-4 py-2 text-right">
      <ChevronRightIcon className="h-5 w-5 inline-block" />
    </td>
  </tr>
);

export default ApiLogRow;
