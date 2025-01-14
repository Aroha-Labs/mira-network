"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import axios from "axios";
import Loading from "src/components/PageLoading";
import UserCard from "src/components/UserCard";
import { API_BASE_URL } from "src/config";
import { useSession } from "src/hooks/useSession";

interface User {
  id: string;
  user_metadata: {
    name: string;
    email: string;
    avatar_url: string;
  };
}

const fetchUsers = async ({
  pageParam = 1,
  token,
}: {
  pageParam: number;
  token: string;
}) => {
  const response = await axios.get<User[]>(`${API_BASE_URL}/admin/users`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    params: {
      page: pageParam,
    },
  });
  return response.data;
};

const AdminUsers = () => {
  const { data: userSession } = useSession();

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
      if (!userSession?.access_token) {
        return Promise.reject("No user session");
      }

      return fetchUsers({
        pageParam,
        token: userSession.access_token,
      });
    },
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
    <div className="p-6 pb-32 bg-white shadow-md">
      <h1 className="text-3xl font-bold mb-4">Users</h1>
      <p className="text-gray-700 mb-4">Manage users here.</p>
      <ul className="space-y-2">
        {data?.pages.flatMap((page) =>
          page.map((user) => <UserCard key={user.id} user={user} />)
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
