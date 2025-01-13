"use client";

import api from "src/lib/axios";
import { useSession } from "src/hooks/useSession";
import UserCard from "src/components/UserCard";
import { useInfiniteQuery } from "@tanstack/react-query";
import Loading from "src/components/PageLoading";
import { useState, useEffect } from "react";
import MetricsModal from "src/components/MetricsModal";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { User } from "src/types/user";
import ErrorMessage from "src/components/ErrorMessage";

const fetchUsers = async ({ pageParam = 1, search = "" }) => {
  const response = await api.get<{ users: User[] }>("/admin/users", {
    params: { page: pageParam, search },
  });
  return response.data.users;
};

const AdminUsers = () => {
  const { data: userSession } = useSession();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [submittedQuery, setSubmittedQuery] = useState<string>("");

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isError,
    error,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["users", submittedQuery],
    queryFn: ({ pageParam }) => fetchUsers({ pageParam, search: submittedQuery }),
    enabled: !!userSession?.access_token,
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) => {
      const lastPageLength = lastPage.length;
      return lastPageLength === 10 ? pages.length + 1 : undefined;
    },
    retry: 2,
  });

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmittedQuery(searchQuery);
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setSubmittedQuery("");
  };

  // Add keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const searchInput = document.getElementById("user-search");
        searchInput?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (!userSession?.access_token) {
    return (
      <div className="flex items-center justify-center h-64">
        Please log in to view users.
      </div>
    );
  }

  return (
    <>
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          <p className="mt-2 text-sm text-gray-600">
            Manage users, their roles, credits, and view their usage metrics
          </p>
        </div>

        <form onSubmit={handleSearch} className="mb-8">
          <div className="relative max-w-2xl mx-auto">
            <div className="flex items-center bg-white shadow-sm border border-gray-300 rounded-lg hover:shadow-md transition-shadow duration-200">
              <div className="pl-4">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="user-search"
                type="text"
                placeholder='Search users... (Press "/" to focus)'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-3 bg-transparent border-0 focus:ring-0 focus:outline-none text-gray-900 placeholder-gray-500"
              />
              <div className="flex items-center pr-2 space-x-2">
                {(searchQuery || submittedQuery) && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="p-1.5 text-gray-500 hover:text-gray-700 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                )}
                <div className="h-6 w-px bg-gray-300"></div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  {isLoading ? <Loading size="sm" className="text-white" /> : "Search"}
                </button>
              </div>
            </div>
          </div>
          {submittedQuery && (
            <div className="mt-3 text-sm text-gray-600 text-center">
              Showing results for: &quot;{submittedQuery}&quot;
            </div>
          )}
        </form>

        {isError ? (
          <div className="max-w-2xl mx-auto">
            <ErrorMessage
              message={error instanceof Error ? error.message : "Failed to load users"}
              retry={() => refetch()}
            />
          </div>
        ) : (
          <div className="grid gap-6">
            {isLoading ? (
              <div className="flex justify-center">
                <Loading />
              </div>
            ) : data?.pages[0].length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No users found {submittedQuery && `for "${submittedQuery}"`}
              </div>
            ) : (
              <>
                {data?.pages.flatMap((page) =>
                  page.map((user) => <UserCard key={user.id} user={user} />)
                )}
                <div className="mt-8 flex justify-center">
                  {hasNextPage && (
                    <button
                      onClick={() => fetchNextPage()}
                      className={`px-4 py-2 border rounded-md ${
                        isFetchingNextPage
                          ? "bg-gray-100 text-gray-500"
                          : "bg-white text-gray-700 hover:bg-gray-50"
                      }`}
                      disabled={isFetchingNextPage}
                    >
                      {isFetchingNextPage ? <Loading size="sm" /> : "Load More"}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
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
