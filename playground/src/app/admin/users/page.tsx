"use client";

import { useState } from "react";
import axios from "axios";
import { useSession } from "src/hooks/useSession";
import { API_BASE_URL } from "src/config";
import UserCard from "src/components/UserCard";
import { useQuery } from "@tanstack/react-query";

interface User {
  id: string;
  user_metadata: {
    name: string;
    email: string;
    avatar_url: string;
  };
}

const fetchUsers = async (token: string, page: number) => {
  const response = await axios.get<User[]>(`${API_BASE_URL}/admin/users`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    params: {
      page,
    },
  });
  return response.data;
};

const AdminUsers = () => {
  const { data: userSession } = useSession();
  const [page, setPage] = useState(1);

  const {
    data: users,
    error,
    isLoading,
  } = useQuery({
    queryKey: ["users", page],
    queryFn: () => fetchUsers(userSession?.access_token || "", page),
    enabled: !!userSession?.access_token,
  });

  if (!userSession?.access_token) {
    return <div>Please log in to view users.</div>;
  }

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error loading users</div>;
  }

  return (
    <div className="p-6 bg-white rounded shadow-md">
      <h1 className="text-3xl font-bold mb-4">Admin Users</h1>
      <p className="text-gray-700 mb-4">Manage users here.</p>
      <ul className="space-y-2">
        {users?.map((user) => (
          <UserCard key={user.id} user={user} />
        ))}
      </ul>
      <div className="flex justify-between mt-4">
        <button
          onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
          className="bg-gray-300 text-gray-700 p-2 rounded hover:bg-gray-400"
          disabled={page === 1}
        >
          Previous
        </button>
        <button
          onClick={() => setPage((prev) => prev + 1)}
          className="bg-gray-300 text-gray-700 p-2 rounded hover:bg-gray-400"
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default AdminUsers;
