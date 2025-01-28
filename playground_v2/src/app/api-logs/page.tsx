"use client";

import { useStore } from "@tanstack/react-store";
import { useEffect, useState } from "react";
import { Header } from "src/components/apiLogs";
import LogDetailsModal from "src/components/apiLogs/LogDetailsModal";
import LogsTable from "src/components/apiLogs/LogsTable";
import Footer from "src/components/Footer";
import Pagination from "src/components/Pagination";
import useApiLogs, { ApiLog } from "src/hooks/useApiLogs";
import {
  apiLogsParamsState,
  DEFAULT_PARAMS,
} from "src/state/apiLogsParamsState";

const ApiLogsPage = () => {
  const params = useStore(apiLogsParamsState, (state) => state);
  const { data, error, isLoading } = useApiLogs();
  const [selectedLog, setSelectedLog] = useState<ApiLog | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const handleRowClick = (log: ApiLog) => {
    setSelectedLog(log);
  };

  const handleCloseModal = () => {
    setSelectedLog(null);
  };

  useEffect(() => {
    apiLogsParamsState.setState(() => DEFAULT_PARAMS);
  }, []);

  if (error) {
    return <div>Error loading API logs</div>;
  }

  return (
    <div className="container mx-auto p-4 w-[720px]">
      <Header
        startDate={params.startDate}
        endDate={params.endDate}
        onOpenChange={setIsModalOpen}
      />
      <div className={isModalOpen ? "opacity-50" : ""}>
        <LogsTable
          onRowClick={handleRowClick}
          data={data}
          isLoading={isLoading}
          error={error}
        />
        {selectedLog && (
          <LogDetailsModal log={selectedLog} onClose={handleCloseModal} />
        )}
        <div className="flex justify-between">
          <Footer />
          <Pagination
            currentPage={params.page ?? 1}
            totalPages={Math.ceil((data?.total ?? 0) / (data?.page_size ?? 1))}
            handlePageChange={(pageNumber) =>
              apiLogsParamsState.setState(() => ({
                ...params,
                page: pageNumber,
              }))
            }
          />
        </div>
      </div>
    </div>
  );
};

export default ApiLogsPage;
