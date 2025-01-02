"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { API_BASE_URL } from "src/config";
import { useSession } from "src/hooks/useSession";
import { format } from "date-fns";
import Loading from "src/components/Loading";

interface CreditHistory {
  id: number;
  user_id: string;
  amount: number;
  description: string;
  created_at: string;
}

const fetchCreditHistory = async (token: string): Promise<CreditHistory[]> => {
  const response = await axios.get(`${API_BASE_URL}/user-credits-history`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};

const CreditHistoryPage = () => {
  const { data: userSession } = useSession();
  const { data, error, isLoading } = useQuery({
    queryKey: ["creditHistory"],
    queryFn: () => {
      if (!userSession?.access_token) {
        throw new Error("User session not found");
      }
      return fetchCreditHistory(userSession.access_token);
    },
    enabled: !!userSession?.access_token,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loading />
      </div>
    );
  }

  if (error) {
    return <div>Error loading credit history</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Credit History</h1>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200">
          <thead>
            <tr>
              <th className="px-4 py-2 text-left border-b">Timestamp</th>
              <th className="px-4 py-2 text-left border-b">Amount</th>
              <th className="px-4 py-2 text-left border-b">Description</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((entry) => (
              <tr key={entry.id}>
                <td className="px-4 py-2 border-b">
                  {format(new Date(entry.created_at), "yyyy-MM-dd HH:mm:ss")}
                </td>
                <td
                  className={`px-4 py-2 border-b ${
                    entry.amount > 0 ? "text-green-500" : "text-red-500"
                  }`}
                >
                  {entry.amount > 0 ? "+" : ""}
                  {entry.amount.toFixed(2)}
                </td>
                <td className="px-4 py-2 border-b">{entry.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CreditHistoryPage;
