"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import Loading from "src/components/PageLoading";
import UserCard from "src/components/UserCard";
import api from "src/lib/axios";
import { useSession } from "src/hooks/useSession";

interface User {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  avatar_url: string;
}

interface UsersResponse {
  users: User[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

const fetchUsers = async ({ pageParam = 1 }: { pageParam: number }) => {
  const response = await api.get<UsersResponse>(`/admin/users`, {
    params: {
      page: pageParam,
    },
  });
  return response.data;
};

const AdminUsers = () => {
  const { user } = useSession();

  const {
    data,
    error,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["users"],
    queryFn: ({ pageParam }) => {
      return fetchUsers({ pageParam });
    },
    enabled: !!user,
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      return lastPage.page < lastPage.total_pages
        ? lastPage.page + 1
        : undefined;
    },
  });

  if (!user) {
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
    <div className="p-6 pb-32 bg-white shadow-md">
      <h1 className="text-3xl font-bold mb-4">Users</h1>
      <p className="text-gray-700 mb-4">Manage users here.</p>
      <ul className="space-y-2">
        {data?.pages.flatMap((page) =>
          page.users.map((user) => <UserCard key={user.id} user={user} />)
        )}
      </ul>
      <div className="flex justify-center mt-4">
        <button
          onClick={() => fetchNextPage()}
          className={`bg-gray-300 text-gray-700 p-2 px-6 ${
            !hasNextPage || isFetchingNextPage ? "" : "hover:bg-gray-400"
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
  );
};

export default AdminUsers;
