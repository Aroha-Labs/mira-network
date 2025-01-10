"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useState } from "react";
import { createPortal } from "react-dom";
import { Header } from "src/components/apiLogs";
import LogDetailsModal from "src/components/apiLogs/LogDetailsModal";
import LogsTable from "src/components/apiLogs/LogsTable";
import Footer from "src/components/Footer";
import Loading from "src/components/PageLoading";
import { API_BASE_URL } from "src/config";
import { useSession } from "src/hooks/useSession";

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
  endDate?: string,
  orderBy: string = "created_at",
  order: string = "desc"
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
      order_by: orderBy,
      order,
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
  const [orderBy, setOrderBy] = useState<string>("created_at");
  const [order] = useState<string>("desc");

  const { data, error, isLoading } = useQuery({
    queryKey: ["apiLogs", page, startDate, endDate, orderBy, order],
    queryFn: () =>
      fetchApiLogs(
        userSession?.access_token,
        page,
        pageSize,
        startDate,
        endDate,
        orderBy,
        order
      ),
    enabled: !!userSession?.access_token,
  });

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
      <Header />
      <LogsTable onRowClick={handleRowClick} />
      {/* <PaginationControls
        page={page}
        pageSize={pageSize}
        total={data?.total}
        onNextPage={() => setPage(page + 1)}
        onPreviousPage={() => setPage(page - 1)}
      /> */}
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
