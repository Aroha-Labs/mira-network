"use client";

import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useSession } from "src/hooks/useSession";
import { useState } from "react";
import Modal from "src/components/Modal";
import ConfirmModal from "src/components/ConfirmModal";
import { createPortal } from "react-dom";
import {
  EllipsisVerticalIcon,
  PlusIcon,
  ChartBarIcon,
  KeyIcon,
  TrashIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";
import MetricsModal from "src/components/MetricsModal";
import api from "src/lib/axios";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import toast from "react-hot-toast";
import CopyToClipboardIcon from "src/components/CopyToClipboardIcon";
import { Menu, Transition } from "@headlessui/react";
import { Fragment } from "react";
import { trackEvent } from "src/lib/mira";

interface ApiKey {
  id: number;
  token: string;
  description: string;
  meta_data: Record<string, unknown>;
  created_at: string;
}

interface PaginatedApiKeys {
  items: ApiKey[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

const fetchApiKeys = async (page?: number, pageSize?: number) => {
  const params = new URLSearchParams();
  if (page) params.append("page", page.toString());
  if (pageSize) params.append("page_size", pageSize.toString());

  const response = await api.get<ApiKey[] | PaginatedApiKeys>("/api-tokens", {
    params,
  });
  return response.data;
};

const addApiKey = async (params: {
  description: string;
  meta_data?: Record<string, unknown>;
}) => {
  try {
    const response = await api.post("/api-tokens", params);
    return response.data;
  } catch (e) {
    const error = e as AxiosError<{ detail: string }>;
    throw new Error(error.response?.data?.detail || error.message);
  }
};

const deleteApiKey = async (tokenId: string) => {
  const response = await api.delete(`/api-tokens/${tokenId}`);
  return response.data;
};

type MetaDataEntry = {
  key: string;
  value: string;
};

const ApiKeyPage = () => {
  const { data: userSession } = useSession();
  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10; // Fixed page size

  const { data, error, isLoading } = useQuery<PaginatedApiKeys | ApiKey[]>({
    queryKey: ["apiKeys", currentPage, pageSize],
    queryFn: () => fetchApiKeys(currentPage, pageSize),
    enabled: !!userSession?.access_token,
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [metaDataEntries, setMetaDataEntries] = useState<MetaDataEntry[]>([]);
  const [tokenToDelete, setTokenToDelete] = useState<string | null>(null);
  const [selectedApiKeyId, setSelectedApiKeyId] = useState<number | null>(null);

  const addMutation = useMutation({
    mutationFn: addApiKey,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["apiKeys"],
      });
      setIsModalOpen(false);
      setDescription("");
      toast.success("API key created successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create API key");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteApiKey,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["apiKeys"],
      });
      setTokenToDelete(null);
      toast.success("API key deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete API key");
      setTokenToDelete(null);
    },
  });

  const handleAddApiKey = () => {
    trackEvent('api_key_add_modal_open', {});
    if (!description.trim()) {
      toast.error("Description is required");
      return;
    }

    // Convert entries to metadata object
    const metadata: Record<string, unknown> = {};
    metaDataEntries.forEach((entry) => {
      if (entry.key.trim()) {
        try {
          // Attempt to parse value as JSON if it looks like a JSON value
          const value = entry.value.trim();
          if (
            value.startsWith("{") ||
            value.startsWith("[") ||
            value === "true" ||
            value === "false" ||
            !isNaN(Number(value))
          ) {
            metadata[entry.key.trim()] = JSON.parse(value);
          } else {
            metadata[entry.key.trim()] = value;
          }
        } catch {
          metadata[entry.key.trim()] = entry.value.trim();
        }
      }
    });

    addMutation.mutate({
      description: description.trim(),
      meta_data: Object.keys(metadata).length > 0 ? metadata : undefined,
    });
  };

  const handleAddMetaDataEntry = () => {
    setMetaDataEntries([...metaDataEntries, { key: "", value: "" }]);
  };

  const handleRemoveMetaDataEntry = (index: number) => {
    setMetaDataEntries(metaDataEntries.filter((_, i) => i !== index));
  };

  const handleMetaDataChange = (index: number, field: "key" | "value", value: string) => {
    const newEntries = [...metaDataEntries];
    newEntries[index][field] = value;
    setMetaDataEntries(newEntries);
  };

  const handleDeleteApiKey = (tokenId: string) => {
    trackEvent('api_key_delete_click', {});
    setTokenToDelete(tokenId);
  };

  const confirmDeleteApiKey = () => {
    trackEvent('api_key_delete_confirm', {});
    if (tokenToDelete) {
      deleteMutation.mutate(tokenToDelete);
    }
  };

  const cancelDeleteApiKey = () => {
    setTokenToDelete(null);
  };

  const getTokenDisplay = (token: string) => {
    return `${token.slice(0, 4)}...${token.slice(-4)}`;
  };

  const formatDate = (dateString: string) => {
    // Append 'Z' to indicate UTC if the string doesn't include timezone info
    const utcString = dateString.endsWith("Z") ? dateString : `${dateString}Z`;
    const date = parseISO(utcString);
    const relativeTime = formatDistanceToNow(date, { addSuffix: true });
    const fullDate = format(date, "PPp");
    return { relativeTime, fullDate };
  };

  const isPaginated = data && !Array.isArray(data);
  const items = isPaginated ? data.items : data;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="bg-white rounded-lg shadow-xs border border-gray-200 divide-y divide-gray-200">
            <div className="p-6">
              <div className="flex justify-between items-center">
                <div className="space-y-3">
                  <div className="h-6 w-24 bg-gray-200 rounded-sm animate-pulse"></div>
                  <div className="h-4 w-48 bg-gray-200 rounded-sm animate-pulse"></div>
                </div>
                <div className="h-10 w-24 bg-gray-200 rounded-sm animate-pulse"></div>
              </div>
            </div>
            <div className="p-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="mb-6 last:mb-0">
                  <div className="space-y-3">
                    <div className="h-5 w-32 bg-gray-200 rounded-sm animate-pulse"></div>
                    <div className="h-8 w-48 bg-gray-200 rounded-sm animate-pulse"></div>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 bg-gray-50">
              <div className="flex justify-between items-center">
                <div className="w-20 h-8 bg-gray-200 rounded-sm animate-pulse"></div>
                <div className="w-32 h-8 bg-gray-200 rounded-sm animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="bg-white rounded-lg shadow-xs border border-gray-200 p-6 text-center">
            <div className="text-red-500 mb-2">
              <svg
                className="mx-auto h-12 w-12"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Error Loading API Keys
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              There was a problem loading your API keys. Please try again later.
            </p>
            <button
              onClick={() => queryClient.invalidateQueries({ queryKey: ["apiKeys"] })}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-xs text-white bg-blue-600 hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="bg-white rounded-lg shadow-xs border border-gray-200 divide-y divide-gray-200">
          {/* API Keys header */}
          <div className="p-6">
            <div className="flex flex-wrap sm:flex-nowrap justify-between items-center gap-4">
              <div>
                <h1 className="text-xl font-semibold text-gray-900">API Keys</h1>
                <p className="mt-1 text-sm text-gray-500">
                  Manage your API keys for programmatic access
                </p>
              </div>
              <button
                className="shrink-0 inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-xs text-white bg-blue-600 hover:bg-blue-700"
                onClick={() => setIsModalOpen(true)}
              >
                <PlusIcon className="h-4 w-4 mr-1.5" />
                New Key
              </button>
            </div>
          </div>

          {/* JWT Token section */}
          <div className="p-6 bg-gray-50">
            <div className="sm:flex sm:justify-between sm:items-start">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-medium text-gray-900">
                    Web Authentication Usage
                  </h3>
                  <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium bg-blue-100 text-blue-800">
                    Browser Sessions
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  Usage metrics for browser-based authentication
                </p>
              </div>
              <div className="mt-4 sm:mt-0">
                <button
                  onClick={() => setSelectedApiKeyId(-1)}
                  className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  <ChartBarIcon className="h-4 w-4 mr-1.5" />
                  View Usage
                </button>
              </div>
            </div>
          </div>

          {/* API keys list */}
          {items?.length === 0 ? (
            <div className="p-6 text-center">
              <KeyIcon className="mx-auto h-10 w-10 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No API keys</h3>
              <p className="mt-1 text-sm text-gray-500">
                Get started by creating a new API key.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {items?.map((apiKey) => {
                const { relativeTime, fullDate } = formatDate(apiKey.created_at);
                return (
                  <div key={apiKey.token} className="p-6">
                    <div className="sm:flex sm:justify-between sm:items-start">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3
                            className="text-base font-medium text-gray-900 truncate max-w-[300px]"
                            title={apiKey.description || "Unnamed API Key"}
                          >
                            {apiKey.description || (
                              <span className="italic text-gray-400">
                                Unnamed API Key
                              </span>
                            )}
                          </h3>
                          <span
                            className="text-xs text-gray-500 hover:text-gray-700 shrink-0"
                            title={fullDate}
                          >
                            · {relativeTime}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <code className="text-sm bg-gray-100 px-2 py-0.5 rounded-sm text-gray-600">
                            {getTokenDisplay(apiKey.token)}
                          </code>
                          <CopyToClipboardIcon text={apiKey.token} />
                        </div>
                        {Object.keys(apiKey.meta_data || {}).length > 0 && (
                          <div className="mt-2">
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(apiKey.meta_data).map(([key, value]) => (
                                <span
                                  key={key}
                                  className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium bg-gray-100 text-gray-800"
                                  title={`${key}: ${JSON.stringify(value)}`}
                                >
                                  {key}: {JSON.stringify(value)}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="mt-4 sm:mt-0 flex items-center gap-3">
                        <button
                          onClick={() => setSelectedApiKeyId(apiKey.id)}
                          className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                        >
                          <ChartBarIcon className="h-4 w-4 mr-1.5" />
                          Metrics
                        </button>
                        <Menu as="div" className="relative">
                          <Menu.Button className="flex items-center text-gray-400 hover:text-gray-600">
                            <EllipsisVerticalIcon className="h-5 w-5" />
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
                            <Menu.Items className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 focus:outline-hidden">
                              <div className="py-1">
                                <Menu.Item>
                                  {({ active }) => (
                                    <button
                                      onClick={() => handleDeleteApiKey(apiKey.token)}
                                      className={`${active ? "bg-red-50" : ""
                                        } group flex items-center w-full px-4 py-2 text-sm text-red-600 hover:text-red-700`}
                                    >
                                      <TrashIcon className="mr-3 h-4 w-4" />
                                      Delete Key
                                    </button>
                                  )}
                                </Menu.Item>
                              </div>
                            </Menu.Items>
                          </Transition>
                        </Menu>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {isPaginated && data.total > 0 && (
            <div className="p-4 bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Showing{" "}
                  <span className="font-medium">
                    {(data.page - 1) * data.page_size + 1}
                  </span>{" "}
                  to{" "}
                  <span className="font-medium">
                    {Math.min(data.page * data.page_size, data.total)}
                  </span>{" "}
                  of <span className="font-medium">{data.total}</span> results
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={data.page <= 1}
                    className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeftIcon className="h-4 w-4 mr-1" />
                    Previous
                  </button>
                  <button
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(prev + 1, data.total_pages))
                    }
                    disabled={data.page >= data.total_pages}
                    className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                    <ChevronRightIcon className="h-4 w-4 ml-1" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {selectedApiKeyId !== null && (
        <MetricsModal
          apiKeyId={selectedApiKeyId}
          onClose={() => setSelectedApiKeyId(null)}
        />
      )}

      {isModalOpen &&
        createPortal(
          <Modal
            onClose={() => !addMutation.isPending && setIsModalOpen(false)}
            title="Add API Key"
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Description
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g., Production API Key"
                  maxLength={100}
                  disabled={addMutation.isPending}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-xs focus:outline-hidden focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-50 disabled:text-gray-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  {description.length}/100 characters
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Metadata (optional)
                </label>
                <div className="mt-1 space-y-2">
                  {metaDataEntries.map((entry, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={entry.key}
                        onChange={(e) =>
                          handleMetaDataChange(index, "key", e.target.value)
                        }
                        placeholder="Key"
                        disabled={addMutation.isPending}
                        className="block w-1/3 px-3 py-2 border border-gray-300 rounded-md shadow-xs focus:outline-hidden focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-50 disabled:text-gray-500"
                      />
                      <input
                        type="text"
                        value={entry.value}
                        onChange={(e) =>
                          handleMetaDataChange(index, "value", e.target.value)
                        }
                        placeholder="Value"
                        disabled={addMutation.isPending}
                        className="block flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-xs focus:outline-hidden focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-50 disabled:text-gray-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveMetaDataEntry(index)}
                        disabled={addMutation.isPending}
                        className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                      >
                        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path
                            fillRule="evenodd"
                            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={handleAddMetaDataEntry}
                    disabled={addMutation.isPending}
                    className="mt-2 inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                  >
                    <PlusIcon className="h-4 w-4 mr-1.5" />
                    Add Metadata Field
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Add key/value pairs for additional metadata
                </p>
              </div>

              {addMutation.isError && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-sm">
                  {addMutation.error.message}
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={addMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleAddApiKey}
                  disabled={addMutation.isPending || !description.trim()}
                >
                  {addMutation.isPending ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Creating...
                    </>
                  ) : (
                    "Create Key"
                  )}
                </button>
              </div>
            </div>
          </Modal>,
          document.body
        )}
      {tokenToDelete &&
        createPortal(
          <ConfirmModal
            title="Delete API Key"
            onConfirm={confirmDeleteApiKey}
            onCancel={cancelDeleteApiKey}
            isLoading={deleteMutation.isPending}
          >
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                This action cannot be undone. The API key will be permanently deleted and
                any applications using it will stop working.
              </p>
              {deleteMutation.isError && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-sm">
                  {deleteMutation.error.message}
                </div>
              )}
            </div>
          </ConfirmModal>,
          document.body
        )}
    </div>
  );
};

export default ApiKeyPage;
