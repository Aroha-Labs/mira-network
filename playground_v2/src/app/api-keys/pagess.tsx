"use client";

import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios, { AxiosError } from "axios";
import { API_BASE_URL } from "src/config";
import { useSession } from "src/hooks/useSession";
import { useState } from "react";
import Modal from "src/components/Modal";
import ConfirmModal from "src/components/ConfirmModal";
import { createPortal } from "react-dom";
import {
  ClipboardIcon,
  EllipsisVerticalIcon,
  PlusIcon,
} from "@heroicons/react/24/outline"; // Import ClipboardIcon, EllipsisVerticalIcon, and PlusIcon
import { Menu, MenuItem, MenuItems, Transition } from "@headlessui/react"; // Import Menu and Transition from @headlessui/react
import Loading from "src/components/PageLoading";

interface ApiKey {
  token: string;
  description: string;
  created_at: string;
}

const fetchApiKeys = async (token?: string): Promise<ApiKey[]> => {
  if (!token) {
    throw new Error("No token provided");
  }
  const response = await axios.get(`${API_BASE_URL}/api-tokens`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

const addApiKey = async (token: string, description: string) => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/api-tokens`,
      { description },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  } catch (e) {
    const error = e as AxiosError<{ detail: string }>;
    throw new Error(error.response?.data?.detail || error.message);
  }
};

const deleteApiKey = async (token: string, tokenId: string) => {
  const response = await axios.delete(`${API_BASE_URL}/api-tokens/${tokenId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};

const ApiKeyPage = () => {
  const { data: userSession } = useSession();
  const queryClient = useQueryClient();
  const { data, error, isLoading } = useQuery<ApiKey[]>({
    queryKey: ["apiKeys"],
    queryFn: () => fetchApiKeys(userSession?.access_token),
    enabled: !!userSession?.access_token,
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [tokenToDelete, setTokenToDelete] = useState<string | null>(null);

  const addMutation = useMutation({
    mutationFn: (description: string) => {
      if (!userSession?.access_token) {
        throw new Error("User session not found");
      }
      return addApiKey(userSession.access_token, description);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["apiKeys"],
      });
      setIsModalOpen(false);
      setDescription("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (tokenId: string) => {
      if (!userSession?.access_token) {
        throw new Error("User session not found");
      }
      return deleteApiKey(userSession.access_token, tokenId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["apiKeys"],
      });
      setTokenToDelete(null);
    },
  });

  const handleAddApiKey = () => {
    addMutation.mutate(description);
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

  const handleCopyToClipboard = (token: string) => {
    navigator.clipboard.writeText(token);
  };

  const getTokenDisplay = (token: string) => {
    return `${token.slice(0, 4)}...${token.slice(-4)}`;
  };

  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loading />
      </div>
    );
  }

  if (error) {
    return <div>Error loading API keys</div>;
  }

  return (
    <div className="container mx-auto p-4 max-w-lg">
      {userSession?.user && (
        <div className="bg-gray-50 p-4 rounded-lg shadow-sm border border-gray-300 mb-4">
          <div className="text-gray-600">
            <strong>User ID:</strong> {userSession.user.id}
          </div>
        </div>
      )}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-semibold">API keys</h1>
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded-md flex items-center gap-2 hover:bg-blue-700"
          onClick={() => setIsModalOpen(true)}
        >
          <PlusIcon className="h-5 w-5" />
          Add API Key
        </button>
      </div>
      {deleteMutation.isPending && (
        <div className="text-blue-600 mb-4">Deleting API key...</div>
      )}
      {deleteMutation.isError && (
        <div className="text-red-600 mb-4">
          Error deleting API key: {deleteMutation.error.message}
        </div>
      )}
      <div className="grid grid-cols-1 gap-4">
        {data?.map((apiKey) => (
          <div
            key={apiKey.token}
            className="bg-gray-50 p-4 rounded-lg shadow-sm border border-gray-300 relative"
          >
            <Menu as="div" className="absolute top-2 right-2 text-left">
              <Menu.Button className="p-1 text-gray-600 rounded-md hover:bg-gray-200">
                <span className="sr-only">Open options</span>
                <EllipsisVerticalIcon className="h-5 w-5" />
              </Menu.Button>
              <Transition
                as={React.Fragment}
                enter="transition ease-out duration-100"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-75"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
              >
                <MenuItems className="absolute right-0 mt-2 w-56 origin-top-right bg-white border border-gray-300 divide-y divide-gray-100 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                  <div className="py-1">
                    <MenuItem>
                      {({ active }) => (
                        <button
                          className={`${
                            active ? "bg-red-600 text-white" : "text-gray-700"
                          } group flex items-center px-4 py-2 text-sm w-full`}
                          onClick={() => handleDeleteApiKey(apiKey.token)}
                        >
                          Delete
                        </button>
                      )}
                    </MenuItem>
                  </div>
                </MenuItems>
              </Transition>
            </Menu>
            <h2 className="text-lg font-medium mb-2">{apiKey.description}</h2>
            <div className="flex items-center mb-2">
              <span className="text-gray-600">
                {getTokenDisplay(apiKey.token)}
              </span>
              <button
                className="ml-2 p-1 bg-gray-200 text-gray-600 rounded-md hover:bg-gray-300"
                onClick={() => handleCopyToClipboard(apiKey.token)}
              >
                <ClipboardIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="text-sm text-gray-500 mb-2">
              Created At: {formatDate(apiKey.created_at)}
            </div>
          </div>
        ))}
      </div>
      {isModalOpen &&
        createPortal(
          <Modal onClose={() => setIsModalOpen(false)} title="Add API Key">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700">
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>

            {addMutation.isPending && (
              <div className="text-blue-600 mb-4">Adding API key...</div>
            )}
            {addMutation.isError && (
              <div className="text-red-600 mb-4">
                Error adding API key: {addMutation.error.message}
              </div>
            )}

            <button
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              onClick={handleAddApiKey}
              disabled={addMutation.isPending}
            >
              {addMutation.isPending ? "Adding..." : "Add"}
            </button>
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
