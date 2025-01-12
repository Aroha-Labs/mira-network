"use client";

import api from "src/lib/axios";
import { useSession } from "src/hooks/useSession";
import UserCard from "src/components/UserCard";
import { useInfiniteQuery } from "@tanstack/react-query";
import Loading from "src/components/PageLoading";
import { useState } from "react";
import MetricsModal from "src/components/MetricsModal";

interface User {
  id: string;
  user_metadata: {
    name: string;
    email: string;
    avatar_url: string;
  };
}

const fetchUsers = async ({ pageParam = 1 }) => {
  const response = await api.get<User[]>("/admin/users", {
    params: { page: pageParam },
  });
  return response.data;
};

const AdminUsers = () => {
  const { data: userSession } = useSession();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const {
    data,
    error,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["users"],
    queryFn: ({ pageParam }) => fetchUsers({ pageParam }),
    enabled: !!userSession?.access_token,
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) => {
      return lastPage.length ? pages.length + 1 : undefined;
    },
  });

  if (!userSession?.access_token) {
    return (
      <div className="flex items-center justify-center h-64">
        Please log in to view users.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loading />
      </div>
    );
  }

  if (error) {
    return <div>Error loading users</div>;
  }

  return (
    <>
      <div className=" px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          <p className="mt-2 text-sm text-gray-600">
            Manage users, their roles, credits, and view their usage metrics
          </p>
        </div>

        <div className="grid gap-6">
          {data?.pages.flatMap((page) =>
            page.map((user) => <UserCard key={user.id} user={user} />)
          )}
        </div>

        <div className="mt-8 flex justify-center">
          <button
            onClick={() => fetchNextPage()}
            className={`px-4 py-2 border rounded-md ${
              !hasNextPage || isFetchingNextPage
                ? "bg-gray-100 text-gray-500"
                : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
            disabled={!hasNextPage || isFetchingNextPage}
          >
            {isFetchingNextPage
              ? "Loading..."
              : hasNextPage
              ? "Load More"
              : "No More Users"}
          </button>
        </div>
      </div>

      {selectedUserId && (
        <MetricsModal
          userId={selectedUserId}
          title={`User Metrics`}
          onClose={() => setSelectedUserId(null)}
        />
      )}
    </>
  );
};

export default AdminUsers;
