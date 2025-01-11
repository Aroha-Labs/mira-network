"use client";

import { useStore } from "@tanstack/react-store";
import { useState } from "react";
import { createPortal } from "react-dom";
import { Header } from "src/components/apiLogs";
import LogDetailsModal from "src/components/apiLogs/LogDetailsModal";
import LogsTable from "src/components/apiLogs/LogsTable";
import Footer from "src/components/Footer";
import Loading from "src/components/PageLoading";
import Pagination from "src/components/Pagination";
import useApiLogs from "src/hooks/useApiLogs";
import { apiLogsParamsState } from "src/state/apiLogsParamsState";

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
  machine_id: string;
}

const ApiLogsPage = () => {
  const params = useStore(apiLogsParamsState, (state) => state);
  const { data, error, isLoading } = useApiLogs();
  const [selectedLog, setSelectedLog] = useState<ApiLog | null>(null);

  const handleRowClick = (log: ApiLog) => {
    setSelectedLog(log);
  };

  const handleCloseModal = () => {
    setSelectedLog(null);
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
    <div className="container mx-auto p-4 max-w-fit">
      <Header startDate={params.startDate} endDate={params.endDate} />
      <LogsTable
        onRowClick={handleRowClick}
        data={data}
        isLoading={isLoading}
        error={error}
      />
      <Pagination
        currentPage={params.page ?? 1}
        totalPages={Number((data?.total ?? 0) / (data?.page_size ?? 1))}
        handlePageChange={(pageNumber) =>
          apiLogsParamsState.setState(() => ({ ...params, page: pageNumber }))
        }
      />
      {selectedLog &&
        createPortal(
          <LogDetailsModal log={selectedLog} onClose={handleCloseModal} />,
          document.body
        )}
      <Footer />
    </div>
  );
};

export default ApiLogsPage;
