"use client";

import api from "src/lib/axios";
import { useSession } from "src/hooks/useSession";
import UserCard from "src/components/UserCard";
import { useQuery } from "@tanstack/react-query";
import Loading from "src/components/PageLoading";
import { useState, useEffect, Fragment } from "react";
import {
  MagnifyingGlassIcon,
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FlagIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  FunnelIcon,
  AdjustmentsHorizontalIcon,
} from "@heroicons/react/24/outline";
import { SortField, SortOrder, User } from "src/types/user";
import ErrorMessage from "src/components/ErrorMessage";
import { Menu, Transition } from "@headlessui/react";
import { useSearchParams, useRouter } from "next/navigation";

interface UsersResponse {
  users: User[];
  total: number; // Total number of users
  page: number; // Current page number
  per_page: number; // Number of users per page
}

interface Filters {
  minCredits?: number;
  maxCredits?: number;
}

const fetchUsers = async (
  page: number,
  search: string,
  sortBy?: SortField,
  sortOrder?: SortOrder,
  filters?: Filters
) => {
  const response = await api.get<UsersResponse>("/admin/users", {
    params: {
      page,
      search,
      sort_by: sortBy,
      sort_order: sortOrder,
      min_credits: filters?.minCredits,
      max_credits: filters?.maxCredits,
    },
  });
  return response.data;
};

// Add this helper function before the AdminUsers component
const calculateTotalPages = (total: number, perPage: number) => {
  return Math.ceil(total / perPage);
};

const AdminUsers = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: userSession } = useSession();
  const [searchQuery, setSearchQuery] = useState<string>(searchParams.get("q") || "");
  const [submittedQuery, setSubmittedQuery] = useState<string>(
    searchParams.get("q") || ""
  );
  const [currentPage, setCurrentPage] = useState(Number(searchParams.get("page")) || 1);
  const [sortBy, setSortBy] = useState<SortField>(
    (searchParams.get("sort_by") as SortField) || "created_at"
  );
  const [sortOrder, setSortOrder] = useState<SortOrder>(
    (searchParams.get("sort_order") as SortOrder) || "desc"
  );
  const [filters, setFilters] = useState<Filters>({
    minCredits: searchParams.get("min_credits")
      ? Number(searchParams.get("min_credits"))
      : undefined,
    maxCredits: searchParams.get("max_credits")
      ? Number(searchParams.get("max_credits"))
      : undefined,
  });

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["users", submittedQuery, currentPage, sortBy, sortOrder, filters],
    queryFn: () => fetchUsers(currentPage, submittedQuery, sortBy, sortOrder, filters),
    enabled: !!userSession?.access_token,
    retry: 2,
  });

  const updateURL = (params: Record<string, string | undefined>) => {
    const url = new URL(window.location.href);
    Object.entries(params).forEach(([key, value]) => {
      if (value) {
        url.searchParams.set(key, value);
      } else {
        url.searchParams.delete(key);
      }
    });
    router.push(url.pathname + url.search);
  };

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCurrentPage(1);
    setSubmittedQuery(searchQuery);
    updateURL({
      q: searchQuery,
      page: "1",
      sort_by: sortBy,
      sort_order: sortOrder,
      min_credits: filters.minCredits?.toString(),
      max_credits: filters.maxCredits?.toString(),
    });
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setSubmittedQuery("");
    setCurrentPage(1);
    updateURL({
      q: undefined,
      page: "1",
      sort_by: sortBy,
      sort_order: sortOrder,
      min_credits: filters.minCredits?.toString(),
      max_credits: filters.maxCredits?.toString(),
    });
  };

  const handleSort = (field: SortField) => {
    const newOrder = sortBy === field && sortOrder === "asc" ? "desc" : "asc";
    setSortBy(field);
    setSortOrder(newOrder);
    updateURL({
      q: submittedQuery,
      page: currentPage.toString(),
      sort_by: field,
      sort_order: newOrder,
      min_credits: filters.minCredits?.toString(),
      max_credits: filters.maxCredits?.toString(),
    });
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    updateURL({
      q: submittedQuery,
      page: newPage.toString(),
      sort_by: sortBy,
      sort_order: sortOrder,
      min_credits: filters.minCredits?.toString(),
      max_credits: filters.maxCredits?.toString(),
    });
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

  const renderSortingAndFilters = () => (
    <div className="flex flex-wrap items-center gap-4 mb-6">
      <Menu as="div" className="relative">
        <Menu.Button className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-white border rounded-lg hover:bg-gray-50">
          <AdjustmentsHorizontalIcon className="w-4 h-4" />
          Sort by: {sortBy}
          {sortOrder === "asc" ? (
            <ArrowUpIcon className="w-4 h-4" />
          ) : (
            <ArrowDownIcon className="w-4 h-4" />
          )}
        </Menu.Button>
        <Transition
          as={Fragment}
          enter="transition ease-out duration-100"
          enterFrom="transform opacity-0 scale-95"
          enterTo="transform opacity-100 scale-100"
          leave="transition ease-in duration-75"
          leaveFrom="transform opacity-100 scale-100"
          leaveTo="transform opacity-0 scale-95"
        >
          <Menu.Items className="absolute left-0 z-10 w-56 mt-2 origin-top-left bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-hidden">
            <div className="py-1">
              {["created_at", "last_login_at", "credits", "email", "full_name"].map(
                (field) => (
                  <Menu.Item key={field}>
                    {({ active }) => (
                      <button
                        onClick={() => handleSort(field as SortField)}
                        className={`
                        ${active ? "bg-gray-100" : ""} 
                        ${sortBy === field ? "font-medium" : ""}
                        block px-4 py-2 text-sm text-gray-700 w-full text-left
                      `}
                      >
                        {field.replace("_", " ")}
                      </button>
                    )}
                  </Menu.Item>
                )
              )}
            </div>
          </Menu.Items>
        </Transition>
      </Menu>

      <Menu as="div" className="relative">
        <Menu.Button className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-white border rounded-lg hover:bg-gray-50">
          <FunnelIcon className="w-4 h-4" />
          Filters
          {Object.keys(filters).length > 0 && (
            <span className="ml-1 px-2 py-0.5 text-xs bg-blue-100 text-blue-600 rounded-full">
              {Object.keys(filters).length}
            </span>
          )}
        </Menu.Button>
        <Transition
          as={Fragment}
          enter="transition ease-out duration-100"
          enterFrom="transform opacity-0 scale-95"
          enterTo="transform opacity-100 scale-100"
          leave="transition ease-in duration-75"
          leaveFrom="transform opacity-100 scale-100"
          leaveTo="transform opacity-0 scale-95"
        >
          <Menu.Items className="absolute left-0 z-10 p-4 mt-2 origin-top-left bg-white rounded-md shadow-lg w-72 ring-1 ring-black ring-opacity-5 focus:outline-hidden">
            <div className="space-y-4">
              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700">
                  Credits Range
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    className="w-full border-gray-300 rounded-md shadow-xs focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    value={filters.minCredits || ""}
                    onChange={(e) =>
                      setFilters((f) => ({
                        ...f,
                        minCredits: Number(e.target.value) || undefined,
                      }))
                    }
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    className="w-full border-gray-300 rounded-md shadow-xs focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    value={filters.maxCredits || ""}
                    onChange={(e) =>
                      setFilters((f) => ({
                        ...f,
                        maxCredits: Number(e.target.value) || undefined,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="text-sm text-gray-600 hover:text-gray-900"
                  onClick={() => setFilters({})}
                >
                  Clear all
                </button>
                <button
                  type="button"
                  className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                  onClick={() => refetch()}
                >
                  Apply
                </button>
              </div>
            </div>
          </Menu.Items>
        </Transition>
      </Menu>
    </div>
  );

  if (!userSession?.access_token) {
    return (
      <div className="flex items-center justify-center h-64">
        Please log in to view users.
      </div>
    );
  }

  return (
    <div className="flex-1">
      <div className="px-4 py-4 mx-auto max-w-7xl sm:px-6 lg:px-8 sm:py-8">
        <div className="flex flex-col gap-4 mb-6 sm:mb-8 sm:flex-row sm:items-start sm:justify-between sm:gap-0">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
              User Management
            </h1>
            <p className="mt-1 text-sm text-gray-600 sm:mt-2">
              Manage users, their roles, credits, and view their usage metrics
            </p>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isLoading || isFetching}
            className="relative p-2 text-gray-500 transition-colors rounded-lg hover:text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Refresh users list"
          >
            <ArrowPathIcon className={`w-5 h-5 ${isFetching ? "animate-spin" : ""}`} />
            {isFetching && (
              <span className="absolute px-2 py-1 text-xs text-white -translate-y-1/2 bg-gray-900 rounded-sm shadow-xs top-1/2 -left-24 whitespace-nowrap">
                Refreshing...
              </span>
            )}
          </button>
        </div>

        <form onSubmit={handleSearch} className="mb-6 sm:mb-8">
          <div className="relative max-w-2xl mx-auto">
            <div className="flex items-center transition-shadow duration-200 bg-white border border-gray-300 rounded-lg shadow-xs hover:shadow-md">
              <div className="pl-4">
                <MagnifyingGlassIcon className="w-5 h-5 text-gray-400" />
              </div>
              <input
                id="user-search"
                type="text"
                placeholder='Search users... (Press "/" to focus)'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-3 text-gray-900 placeholder-gray-500 bg-transparent border-0 focus:ring-0 focus:outline-hidden"
              />
              <div className="flex items-center pr-2 space-x-2">
                {(searchQuery || submittedQuery) && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="p-1.5 text-gray-500 hover:text-gray-700 rounded-md hover:bg-gray-100 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-5 h-5"
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
                <div className="w-px h-6 bg-gray-300"></div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  {isLoading ? <Loading size="sm" className="text-white" /> : "Search"}
                </button>
              </div>
            </div>
          </div>
          {submittedQuery && (
            <div className="mt-3 text-sm text-center text-gray-600">
              Showing results for: &quot;{submittedQuery}&quot;
            </div>
          )}
        </form>

        {renderSortingAndFilters()}

        {isError ? (
          <div className="max-w-2xl mx-auto">
            <ErrorMessage
              message={error instanceof Error ? error.message : "Failed to load users"}
              retry={() => refetch()}
            />
          </div>
        ) : (
          <div className="grid gap-4 sm:gap-6">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loading />
              </div>
            ) : data?.users.length === 0 ? (
              <div className="py-12 text-center bg-white border border-gray-200 rounded-xl">
                <div className="text-gray-500">
                  No users found {submittedQuery && `for "${submittedQuery}"`}
                </div>
              </div>
            ) : (
              data?.users.map((user) => <UserCard key={user.id} user={user} />)
            )}
          </div>
        )}

        {/* End of Results Message */}
        {!isError &&
          data &&
          data.total > 0 &&
          data.page >= calculateTotalPages(data.total, data.per_page) && (
            <div className="mt-8 mb-6 text-center">
              <div className="inline-flex items-center gap-3">
                <div className="w-12 h-px bg-gray-200"></div>
                <span className="text-sm text-gray-500 font-medium inline-flex items-center gap-1.5">
                  <FlagIcon className="w-4 h-4" />
                  End of results
                </span>
                <div className="w-12 h-px bg-gray-200"></div>
              </div>
            </div>
          )}

        {/* Pagination Controls */}
        {!isError && data && (
          <div className="flex items-center justify-center gap-3 mt-6">
            <button
              onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1 || isLoading}
              className="inline-flex items-center gap-1 px-4 py-2 transition-colors bg-white border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              <ChevronLeftIcon className="w-4 h-4" />
              Previous
            </button>
            <div className="text-sm text-gray-600">
              {isLoading ? (
                <Loading size="sm" />
              ) : !data ? (
                "No data"
              ) : data.total === 0 ? (
                "No results"
              ) : (
                `Page ${data.page} of ${calculateTotalPages(data.total, data.per_page)}`
              )}
            </div>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={
                !data ||
                data.page >= calculateTotalPages(data.total, data.per_page) ||
                isLoading
              }
              className="inline-flex items-center gap-1 px-4 py-2 transition-colors bg-white border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Next
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminUsers;
