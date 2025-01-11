import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { ApiLog } from "src/types/api-log";
import { API_BASE_URL } from "src/config";
import { useSession } from "src/hooks/useSession";
import Modal from "./Modal";

interface MetricsModalProps {
  onClose: () => void;
  machineId: string;
}

const MetricsModal = ({ onClose, machineId }: MetricsModalProps) => {
  const { data: userSession } = useSession();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data, isLoading, error } = useQuery<{ logs: ApiLog[] }>({
    queryKey: ["machine-logs", machineId],
    queryFn: async () => {
      if (!userSession?.access_token) throw new Error("No access token");
      const resp = await axios.get(`${API_BASE_URL}/api-logs`, {
        headers: { Authorization: `Bearer ${userSession.access_token}` },
        params: {
          machine_id: machineId,
          start_date: thirtyDaysAgo.toISOString().split("T")[0],
          page_size: 1000,
        },
      });
      return resp.data;
    },
    enabled: !!userSession?.access_token,
  });

  if (isLoading) {
    return (
      <Modal onClose={onClose} title={`Metrics for ${machineId}`}>
        <div className="flex justify-center items-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      </Modal>
    );
  }

  if (error) {
    return (
      <Modal onClose={onClose} title={`Metrics for ${machineId}`}>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p className="font-bold">Error loading metrics</p>
          <p>{(error as Error).message}</p>
        </div>
      </Modal>
    );
  }

  if (!data?.logs) {
    return (
      <Modal onClose={onClose} title={`Metrics for ${machineId}`}>
        <div className="text-center text-gray-600">No data available</div>
      </Modal>
    );
  }

  const calculateMetrics = () => {
    const logs = data.logs;
    const totalCalls = logs.length;
    const totalTokens = logs.reduce((sum, log) => sum + log.total_tokens, 0);
    const avgResponseTime =
      logs.reduce((sum, log) => sum + log.total_response_time, 0) / totalCalls;
    const totalCost = logs.reduce((sum, log) => {
      if (!log.model_pricing) return sum;
      return (
        sum +
        (log.prompt_tokens * log.model_pricing.prompt_token +
          log.completion_tokens * log.model_pricing.completion_token)
      );
    }, 0);

    const modelUsage = logs.reduce((acc, log) => {
      acc[log.model] = (acc[log.model] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return { totalCalls, totalTokens, avgResponseTime, totalCost, modelUsage };
  };

  const metrics = calculateMetrics();

  return (
    <Modal onClose={onClose} title={`Metrics for ${machineId}`}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-50 p-4 rounded">
            <h3 className="text-lg font-semibold">Total Calls</h3>
            <p className="text-2xl">{metrics.totalCalls}</p>
          </div>
          <div className="bg-gray-50 p-4 rounded">
            <h3 className="text-lg font-semibold">Total Tokens</h3>
            <p className="text-2xl">{metrics.totalTokens.toLocaleString()}</p>
          </div>
          <div className="bg-gray-50 p-4 rounded">
            <h3 className="text-lg font-semibold">Avg Response Time</h3>
            <p className="text-2xl">{metrics.avgResponseTime.toFixed(2)}ms</p>
          </div>
          <div className="bg-gray-50 p-4 rounded">
            <h3 className="text-lg font-semibold">Total Cost</h3>
            <p className="text-2xl">${metrics.totalCost.toFixed(4)}</p>
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded">
          <h3 className="text-lg font-semibold mb-2">Model Usage</h3>
          <div className="space-y-2">
            {Object.entries(metrics.modelUsage).map(([model, count]) => (
              <div key={model} className="flex justify-between">
                <span>{model}</span>
                <span>{count} calls</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default MetricsModal;
