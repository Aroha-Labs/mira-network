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
} from "@heroicons/react/24/outline";
import Loading from "src/components/PageLoading";
import MetricsModal from "src/components/MetricsModal";
import api from "src/lib/axios";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import toast from "react-hot-toast";
import CopyToClipboardIcon from "src/components/CopyToClipboardIcon";
import { Menu, Transition } from "@headlessui/react";
import { Fragment } from "react";

interface ApiKey {
  id: number;
  token: string;
  description: string;
  created_at: string;
}

const fetchApiKeys = async (): Promise<ApiKey[]> => {
  const response = await api.get("/api-tokens");
  return response.data;
};

const addApiKey = async (description: string) => {
  try {
    const response = await api.post("/api-tokens", { description });
    return response.data;
  } catch (e) {
    const error = e as AxiosError<{ detail: string }>;
    throw new Error(error.response?.data?.detail || error.message);
  }
};

const deleteApiKey = async (tokenId: string) => {
  const response = await api.delete(`/api-tons/${tokenId}`);
  return response.data;
};

const ApiKeyPage = () => {
  const { data: userSession } = useSession();
  const queryClient = useQueryClient();
  const { data, error, isLoading } = useQuery<ApiKey[]>({
    queryKey: ["apiKeys"],
    queryFn: fetchApiKeys,
    enabled: !!userSession?.access_token,
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [description, setDescription] = useState("");
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
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteApiKey,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["apiKeys"],
      });
      setTokenToDelete(null);
    },
  });

  const handleAddApiKey = () => {
    if (!description.trim()) {
      toast.error("Description is required");
      return;
    }
    addMutation.mutate(description.trim());
  };

  const handleDeleteApiKey = (tokenId: string) => {
    setTokenToDelete(tokenId);
  };

  const confirmDeleteApiKey = () => {
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
    const date = parseISO(dateString);
    const relativeTime = formatDistanceToNow(date, { addSuffix: true });
    const fullDate = format(date, "PPp");
    return { relativeTime, fullDate };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loading />
      </div>
    );
  }

  if (error) {
    return <div>Error loading API keys</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 divide-y divide-gray-200">
          <div className="p-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  API Keys
                </h1>
                <p className="mt-1 text-sm text-gray-500">
                  Manage your API keys for programmatic access
                </p>
              </div>
              <button
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
                onClick={() => setIsModalOpen(true)}
              >
                <PlusIcon className="h-4 w-4 mr-1.5" />
                New Key
              </button>
            </div>
          </div>

          {data?.length === 0 ? (
            <div className="p-6 text-center">
              <KeyIcon className="mx-auto h-10 w-10 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                No API keys
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Get started by creating a new API key.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {data?.map((apiKey) => {
                const { relativeTime, fullDate } = formatDate(
                  apiKey.created_at
                );
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
                          <code className="text-sm bg-gray-100 px-2 py-0.5 rounded text-gray-600">
                            {getTokenDisplay(apiKey.token)}
                          </code>
                          <CopyToClipboardIcon text={apiKey.token} />
                        </div>
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
                            <Menu.Items className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 focus:outline-none">
                              <div className="py-1">
                                <Menu.Item>
                                  {({ active }) => (
                                    <button
                                      onClick={() =>
                                        handleDeleteApiKey(apiKey.token)
                                      }
                                      className={`${
                                        active ? "bg-red-50" : ""
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
        </div>
      </div>

      {/* Modals */}
      {selectedApiKeyId && (
        <MetricsModal
          apiKeyId={selectedApiKeyId}
          onClose={() => setSelectedApiKeyId(null)}
        />
      )}

      {isModalOpen &&
        createPortal(
          <Modal onClose={() => setIsModalOpen(false)} title="Add API Key">
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
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
                <p className="mt-1 text-xs text-gray-500">
                  {description.length}/100 characters
                </p>
              </div>

              {addMutation.isPending && (
                <div className="text-blue-600 mb-4">Adding API key...</div>
              )}
              {addMutation.isError && (
                <div className="text-red-600 mb-4">
                  Error adding API key: {addMutation.error.message}
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleAddApiKey}
                  disabled={addMutation.isPending || !description.trim()}
                >
                  {addMutation.isPending ? (
                    <span className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Adding...
                    </span>
                  ) : (
                    "Add Key"
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
            title="Confirm Delete"
            onConfirm={confirmDeleteApiKey}
            onCancel={cancelDeleteApiKey}
          >
            Are you sure you want to delete this API key?
          </ConfirmModal>,
          document.body
        )}
    </div>
  );
};

export default ApiKeyPage;
