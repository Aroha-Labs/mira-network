"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { API_BASE_URL } from "src/config";
import { useSession } from "src/hooks/useSession";
import ApiLogRow from "src/components/ApiLogRow";
import { useState } from "react";
import Modal from "src/components/Modal";
import { createPortal } from "react-dom";
import Loading from "src/components/Loading";

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

interface ApiLogsResponse {
  logs: ApiLog[];
  page: number;
  page_size: number;
  total: number;
}

const fetchApiLogs = async (
  token?: string,
  page: number = 1,
  pageSize: number = 100,
  startDate?: string,
  endDate?: string
): Promise<ApiLogsResponse> => {
  if (!token) {
    throw new Error("No token provided");
  }
  const response = await axios.get(`${API_BASE_URL}/api-logs`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    params: {
      page,
      page_size: pageSize,
      start_date: startDate,
      end_date: endDate,
    },
  });
  return response.data;
};

const ApiLogsPage = () => {
  const { data: userSession } = useSession();
  const [page, setPage] = useState(1);
  const [pageSize] = useState(100);
  const [startDate, setStartDate] = useState<string | undefined>(undefined);
  const [endDate, setEndDate] = useState<string | undefined>(undefined);

  const { data, error, isLoading } = useQuery({
    queryKey: ["apiLogs", page, startDate, endDate],
    queryFn: () =>
      fetchApiLogs(
        userSession?.access_token,
        page,
        pageSize,
        startDate,
        endDate
      ),
    enabled: !!userSession?.access_token,
  });

  const [selectedLog, setSelectedLog] = useState<ApiLog | null>(null);
  const [activeTab, setActiveTab] = useState<"messages" | "raw">("messages");

  const handleRowClick = (log: ApiLog) => {
    setSelectedLog(log);
  };

  const handleCloseModal = () => {
    setSelectedLog(null);
  };

  const handleNextPage = () => {
    if (data && page < Math.ceil(data.total / pageSize)) {
      setPage(page + 1);
    }
  };

  const handlePreviousPage = () => {
    if (page > 1) {
      setPage(page - 1);
    }
  };

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setStartDate(e.target.value);
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEndDate(e.target.value);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loading />
      </div>
    );
  }

  if (error) {
    return <div>Error loading API logs</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">API Logs</h1>
      <div className="mb-4 flex space-x-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Start Date
          </label>
          <input
            type="date"
            value={startDate || ""}
            onChange={handleStartDateChange}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            End Date
          </label>
          <input
            type="date"
            value={endDate || ""}
            onChange={handleEndDateChange}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200">
          <thead>
            <tr>
              <th className="px-4 py-2 text-left border-b">Timestamp</th>
              <th className="px-4 py-2 text-left border-b">Tokens</th>
              <th className="px-4 py-2 text-left border-b">Provider</th>
              <th className="px-4 py-2 text-left border-b">Model</th>
              <th className="px-4 py-2 text-left border-b">Cost</th>
              <th className="px-4 py-2 text-left border-b"></th>
            </tr>
          </thead>
          <tbody>
            {data?.logs?.map((log) => {
              const [provider, ...modelName] = log.model.split("/");
              return (
                <ApiLogRow
                  key={log.id}
                  log={{ ...log, model: modelName.join("/"), provider }}
                  onClick={() => handleRowClick(log)}
                />
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex justify-between mt-4">
        <button
          className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md"
          onClick={handlePreviousPage}
          disabled={page === 1}
        >
          Previous
        </button>
        <button
          className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md"
          onClick={handleNextPage}
          disabled={data && page >= Math.ceil(data.total / pageSize)}
        >
          Next
        </button>
      </div>
      {selectedLog &&
        createPortal(
          <Modal onClose={handleCloseModal} title="API Log Details">
            <div className="mb-4">
              <button
                className={`px-4 py-2 ${
                  activeTab === "messages"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200 text-gray-800"
                } rounded-l-md`}
                onClick={() => setActiveTab("messages")}
              >
                Messages
              </button>
              <button
                className={`px-4 py-2 ${
                  activeTab === "raw"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200 text-gray-800"
                } rounded-r-md`}
                onClick={() => setActiveTab("raw")}
              >
                Raw
              </button>
            </div>
            {activeTab === "messages" ? (
              <div className="space-y-4">
                {JSON.parse(selectedLog.payload).messages.map(
                  (
                    message: { role: string; content: string },
                    index: number
                  ) => (
                    <div
                      key={index}
                      className={`p-2 rounded-md ${
                        message.role === "user"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      <strong>{message.role}:</strong> {message.content}
                    </div>
                  )
                )}
                <div className="p-2 rounded-md bg-green-100 text-green-800">
                  <strong>Response:</strong> {selectedLog.response}
                </div>
              </div>
            ) : (
              <pre className="whitespace-pre-wrap bg-gray-100 p-4 rounded-md">
                {JSON.stringify(JSON.parse(selectedLog.payload), null, 2)}
              </pre>
            )}
          </Modal>,
          document.body
        )}
    </div>
  );
};

export default ApiLogsPage;
