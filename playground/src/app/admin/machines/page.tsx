"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "src/hooks/useSession";
import api from "src/lib/axios";
import {
  ArrowPathIcon,
  ComputerDesktopIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  KeyIcon,
} from "@heroicons/react/24/outline";
import Loading from "src/components/PageLoading";
import ErrorMessage from "src/components/ErrorMessage";
import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog } from "@headlessui/react";
import { Menu, Transition } from "@headlessui/react";
import { Fragment } from "react";
import CopyToClipboardIcon from "src/components/CopyToClipboardIcon";
import ConfirmModal from "src/components/ConfirmModal";

interface SystemSetting {
  id: number;
  name: string;
  value: Record<string, unknown>;
  description: string | null;
  created_at: string;
  updated_at: string;
}

interface Machine {
  id: number;
  network_ip: string;
  status: "online" | "offline";
  name?: string;
  description?: string;
  created_at: string;
  disabled: boolean;
  traffic_weight?: number;
  supported_models?: string[];
  auth_tokens?: MachineToken[];
}

interface RegisterMachineRequest {
  network_ip: string;
  name?: string;
  description?: string;
  traffic_weight?: number;
  supported_models?: string[];
}

interface UpdateMachineRequest {
  name?: string;
  description?: string;
  network_ip: string;
  disabled?: boolean;
  traffic_weight?: number;
  supported_models?: string[];
}

interface SortConfig {
  field: keyof Machine | null;
  direction: "asc" | "desc";
}

interface FilterState {
  status?: "online" | "offline" | "all";
  search: string;
  sort: SortConfig;
  includeDisabled: boolean; // Add this line
}

interface MachineToken {
  id: string;
  api_token: string;
  description: string | null;
  created_at: string;
  machine_id: number;
}

interface MachineTokenResponse {
  id: string;
  api_token: string;
  description?: string;
  created_at: string;
  machine_id: number;
}

const fetchMachines = async () => {
  const response = await api.get<Machine[]>("/machines", {
    params: { include_disabled: true }, // Always fetch all machines
  });
  return response.data;
};

const registerMachine = async (data: RegisterMachineRequest) => {
  const response = await api.post<Machine>("/admin/machines/register", data);
  return response.data;
};

const updateMachine = async (network_ip: string, data: UpdateMachineRequest) => {
  const response = await api.put<Machine>(`/admin/machines/${network_ip}`, data);
  return response.data;
};

const truncateString = (str: string, showLength: number = 4) => {
  if (str.length <= showLength * 2) return str;
  return `${str.slice(0, showLength)}...${str.slice(-showLength)}`;
};

const MachineCard = ({ machine }: { machine: Machine }) => {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAuthTokenModalOpen, setIsAuthTokenModalOpen] = useState(false);
  const [showStatusConfirmation, setShowStatusConfirmation] = useState(false);
  const queryClient = useQueryClient();

  const { mutate: updateStatus, isPending: isUpdatingStatus } = useMutation({
    mutationFn: () =>
      updateMachine(machine.network_ip, {
        network_ip: machine.network_ip,
        name: machine.name,
        description: machine.description,
        disabled: !machine.disabled, // Toggle the disabled state
        traffic_weight: machine.traffic_weight,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["machines"] });
      setShowStatusConfirmation(false);
    },
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = (status: string, disabled: boolean) => {
    if (disabled) return "bg-gray-100 text-gray-600";
    return status === "online"
      ? "bg-green-100 text-green-600"
      : "bg-red-100 text-red-600";
  };

  const getStatusText = (status: string, disabled: boolean) => {
    if (disabled) return "Disabled";
    return status === "online" ? "Online" : "Offline";
  };

  return (
    <>
      <div className="bg-white rounded-lg border border-gray-200 shadow-xs">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div className="flex gap-4 items-start">
              <div
                className={`p-3 rounded-lg ${getStatusColor(
                  machine.status,
                  machine.disabled
                )}`}
              >
                <ComputerDesktopIcon className="w-6 h-6" />
              </div>
              <div>
                <div className="flex gap-2 items-center">
                  <h3 className="text-base font-medium text-gray-900">
                    {machine.name || "Unnamed Machine"}
                  </h3>
                  <div
                    className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${getStatusColor(
                      machine.status,
                      machine.disabled
                    )}`}
                  >
                    {getStatusText(machine.status, machine.disabled)}
                  </div>
                </div>
                {machine.description && (
                  <p className="mt-2 text-sm text-gray-600">{machine.description}</p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowStatusConfirmation(true)}
                disabled={isUpdatingStatus}
                className={`p-1.5 rounded-md hover:bg-gray-50 ${
                  machine.disabled ? "text-gray-400" : "text-green-600"
                }`}
                title={`${machine.disabled ? "Enable" : "Disable"} machine`}
              >
                {isUpdatingStatus ? (
                  <svg
                    className="w-5 h-5 animate-spin"
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
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                ) : machine.disabled ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-5 h-5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                    />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-5 h-5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                    />
                  </svg>
                )}
              </button>
              <button
                onClick={() => setIsAuthTokenModalOpen(true)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-50"
                title="Manage auth tokens"
              >
                <KeyIcon className="w-5 h-5" />
              </button>
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-50"
                title="Edit machine"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-5 h-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                  />
                </svg>
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100">
            <dl className="grid grid-cols-1 gap-y-3 gap-x-6 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Network IP</dt>
                <dd className="mt-1 font-mono text-sm text-gray-900">
                  {machine.network_ip}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Created</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {formatDate(machine.created_at)}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Traffic Weight</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {Math.round(machine.traffic_weight * 100)}%
                  </span>
                </dd>
              </div>
              {machine.supported_models && machine.supported_models.length > 0 && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Supported Models</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    <div className="flex flex-wrap gap-1">
                      {machine.supported_models.slice(0, 3).map((model) => (
                        <span
                          key={model}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800"
                        >
                          {model}
                        </span>
                      ))}
                      {machine.supported_models.length > 3 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                          +{machine.supported_models.length - 3} more
                        </span>
                      )}
                    </div>
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-sm font-medium text-gray-500">Status</dt>
                <dd className="mt-1 text-sm">
                  {machine.disabled ? (
                    <span className="text-gray-500">Disabled</span>
                  ) : machine.status === "online" ? (
                    <span className="text-green-600">Active</span>
                  ) : (
                    <span className="text-red-600">Inactive</span>
                  )}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      <EditMachineModal
        machine={machine}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
      />
      <AuthTokenModal
        machine={machine}
        isOpen={isAuthTokenModalOpen}
        onClose={() => setIsAuthTokenModalOpen(false)}
      />

      {/* Status Change Confirmation Modal */}
      {showStatusConfirmation && (
        <ConfirmModal
          title={`${machine.disabled ? "Enable" : "Disable"} Machine`}
          onConfirm={() => updateStatus()}
          onCancel={() => setShowStatusConfirmation(false)}
          isLoading={isUpdatingStatus}
          confirmLabel={machine.disabled ? "Enable" : "Disable"}
          confirmLoadingLabel={machine.disabled ? "Enabling..." : "Disabling..."}
          confirmButtonClassName={
            machine.disabled
              ? "bg-green-600 hover:bg-green-700 focus:ring-green-500"
              : "bg-red-600 hover:bg-red-700 focus:ring-red-500"
          }
        >
          <p className="text-sm text-gray-500">
            Are you sure you want to {machine.disabled ? "enable" : "disable"} this
            machine?
          </p>
          <div className="p-3 mt-2 bg-gray-50 rounded-md">
            <p className="text-sm font-medium text-gray-900">
              {machine.name || "Unnamed Machine"}
            </p>
            <p className="mt-1 font-mono text-sm text-gray-500">{machine.network_ip}</p>
          </div>
          {!machine.disabled && (
            <p className="mt-3 text-sm text-red-500">
              Warning: Disabling this machine will prevent it from communicating with the
              server.
            </p>
          )}
        </ConfirmModal>
      )}
    </>
  );
};

const RegisterMachineModal = ({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) => {
  const [formData, setFormData] = useState<RegisterMachineRequest>({
    network_ip: "",
    name: "",
    description: "",
    traffic_weight: 0.5,
    supported_models: undefined,
  });
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const queryClient = useQueryClient();

  // Fetch available models from settings
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const response = await api.get("/admin/settings");
      return response.data;
    },
  });

  const availableModels = useMemo(() => {
    const supportedModels = settings?.find(
      (s: SystemSetting) => s.name === "SUPPORTED_MODELS"
    );
    if (supportedModels?.value) {
      return Object.keys(supportedModels.value);
    }
    return [];
  }, [settings]);

  const { mutate, isPending, error } = useMutation({
    mutationFn: registerMachine,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["machines"] });
      onClose();
      setFormData({
        network_ip: "",
        name: "",
        description: "",
        traffic_weight: 0.5,
        supported_models: undefined,
      });
      setSelectedModels([]);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutate({
      ...formData,
      supported_models: selectedModels.length > 0 ? selectedModels : undefined,
    });
  };

  const toggleModel = (model: string) => {
    setSelectedModels((prev) =>
      prev.includes(model) ? prev.filter((m) => m !== model) : [...prev, model]
    );
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="flex fixed inset-0 justify-center items-center p-4">
        <Dialog.Panel className="p-6 mx-auto w-full max-w-sm bg-white rounded-lg shadow-xl">
          <Dialog.Title className="mb-4 text-lg font-medium text-gray-900">
            Register New Machine
          </Dialog.Title>

          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="name"
                  className="block mb-1 text-sm font-medium text-gray-700"
                >
                  Name
                </label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="w-full rounded-md border-gray-300 shadow-xs focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Machine name"
                />
              </div>

              <div>
                <label
                  htmlFor="network_ip"
                  className="block mb-1 text-sm font-medium text-gray-700"
                >
                  Network IP
                  <span className="ml-1 text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="network_ip"
                  value={formData.network_ip}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, network_ip: e.target.value }))
                  }
                  className="w-full rounded-md border-gray-300 shadow-xs focus:border-blue-500 focus:ring-blue-500"
                  placeholder="192.168.1.100"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="description"
                  className="block mb-1 text-sm font-medium text-gray-700"
                >
                  Description
                </label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, description: e.target.value }))
                  }
                  rows={3}
                  className="w-full rounded-md border-gray-300 shadow-xs focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Machine description"
                />
              </div>

              <div>
                <label
                  htmlFor="traffic_weight"
                  className="block mb-1 text-sm font-medium text-gray-700"
                >
                  Traffic Weight: {Math.round((formData.traffic_weight || 0.5) * 100)}%
                </label>
                <div className="flex items-center space-x-3">
                  <span className="text-xs text-gray-500">0%</span>
                  <input
                    type="range"
                    id="traffic_weight"
                    min="0"
                    max="1"
                    step="0.1"
                    value={formData.traffic_weight || 0.5}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        traffic_weight: parseFloat(e.target.value),
                      }))
                    }
                    className="flex-1"
                  />
                  <span className="text-xs text-gray-500">100%</span>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Percentage of traffic this machine will handle
                </p>
              </div>

              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700">
                  Supported Models
                </label>
                <p className="mb-2 text-xs text-gray-500">
                  Select specific models this machine will handle. Leave empty to support
                  all models.
                </p>
                {availableModels.length > 0 ? (
                  <div className="overflow-y-auto p-2 space-y-2 max-h-40 rounded-md border border-gray-200">
                    {availableModels.map((model) => (
                      <label
                        key={model}
                        className="flex items-center p-1 space-x-2 rounded cursor-pointer hover:bg-gray-50"
                      >
                        <input
                          type="checkbox"
                          checked={selectedModels.includes(model)}
                          onChange={() => toggleModel(model)}
                          className="text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{model}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm italic text-gray-500">
                    Loading available models...
                  </p>
                )}
              </div>
            </div>

            {error && (
              <div className="mt-4 text-sm text-red-600">
                {error instanceof Error ? error.message : "Failed to register machine"}
              </div>
            )}

            <div className="flex gap-3 justify-end mt-6">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white rounded-md border border-gray-300 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? "Registering..." : "Register"}
              </button>
            </div>
          </form>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

const EditMachineModal = ({
  machine,
  isOpen,
  onClose,
}: {
  machine: Machine;
  isOpen: boolean;
  onClose: () => void;
}) => {
  const [formData, setFormData] = useState<UpdateMachineRequest>({
    name: machine.name || "",
    description: machine.description || "",
    network_ip: machine.network_ip,
    disabled: machine.disabled,
    traffic_weight: machine.traffic_weight || 0.5,
    supported_models: machine.supported_models, // Include existing supported_models
  });
  const [selectedModels, setSelectedModels] = useState<string[]>(
    machine.supported_models || []
  );

  const queryClient = useQueryClient();

  // Fetch available models from settings
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const response = await api.get("/admin/settings");
      return response.data;
    },
  });

  const availableModels = useMemo(() => {
    const supportedModels = settings?.find(
      (s: SystemSetting) => s.name === "SUPPORTED_MODELS"
    );
    if (supportedModels?.value) {
      return Object.keys(supportedModels.value);
    }
    return [];
  }, [settings]);

  const { mutate, isPending, error } = useMutation({
    mutationFn: (data: UpdateMachineRequest) => updateMachine(machine.network_ip, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["machines"] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutate({
      ...formData,
      supported_models: selectedModels.length > 0 ? selectedModels : undefined,
    });
  };

  const toggleModel = (model: string) => {
    setSelectedModels((prev) =>
      prev.includes(model) ? prev.filter((m) => m !== model) : [...prev, model]
    );
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="flex fixed inset-0 justify-center items-center p-4">
        <Dialog.Panel className="p-6 mx-auto w-full max-w-sm bg-white rounded-lg shadow-xl">
          <div className="flex justify-between items-center mb-6">
            <Dialog.Title className="text-lg font-medium text-gray-900">
              Edit Machine
            </Dialog.Title>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 rounded-full hover:text-gray-500 hover:bg-gray-50"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-5 h-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="space-y-5">
              <div>
                <label
                  htmlFor="edit-name"
                  className="block mb-1 text-sm font-medium text-gray-700"
                >
                  Name
                </label>
                <input
                  type="text"
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="w-full rounded-md border-gray-300 transition-colors shadow-xs focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Enter machine name"
                />
              </div>

              <div>
                <label
                  htmlFor="edit-network-ip"
                  className="block mb-1 text-sm font-medium text-gray-700"
                >
                  Network IP
                  <span className="ml-1 text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="edit-network-ip"
                  value={formData.network_ip}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, network_ip: e.target.value }))
                  }
                  className="w-full font-mono rounded-md border-gray-300 transition-colors shadow-xs focus:border-blue-500 focus:ring-blue-500"
                  placeholder="192.168.1.100"
                  required
                  pattern="^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$"
                  title="Please enter a valid IP address (e.g., 192.168.1.100)"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Enter the IPv4 address of the machine
                </p>
              </div>

              <div>
                <label
                  htmlFor="edit-description"
                  className="block mb-1 text-sm font-medium text-gray-700"
                >
                  Description
                </label>
                <textarea
                  id="edit-description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, description: e.target.value }))
                  }
                  rows={3}
                  className="w-full rounded-md border-gray-300 transition-colors resize-none shadow-xs focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Add a description for this machine..."
                />
                <p className="mt-1 text-sm text-gray-500">
                  Optional: Add details about this machine&apos;s purpose or location
                </p>
              </div>

              <div>
                <label
                  htmlFor="edit-traffic-weight"
                  className="block mb-1 text-sm font-medium text-gray-700"
                >
                  Traffic Weight: {Math.round((formData.traffic_weight || 0.5) * 100)}%
                </label>
                <div className="flex items-center space-x-3">
                  <span className="text-xs text-gray-500">0%</span>
                  <input
                    type="range"
                    id="edit-traffic-weight"
                    min="0"
                    max="1"
                    step="0.05"
                    value={formData.traffic_weight || 0.5}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        traffic_weight: parseFloat(e.target.value),
                      }))
                    }
                    className="flex-1"
                  />
                  <span className="text-xs text-gray-500">100%</span>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Adjust the percentage of traffic this machine handles. Lower values for
                  testing, higher for production machines.
                </p>
              </div>

              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700">
                  Supported Models
                </label>
                <div className="overflow-y-auto p-3 space-y-2 max-h-40 bg-gray-50 rounded-md">
                  {availableModels.length > 0 ? (
                    <>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs text-gray-600">
                          {selectedModels.length === 0
                            ? "All models supported"
                            : `${selectedModels.length} model${selectedModels.length === 1 ? "" : "s"} selected`}
                        </span>
                        {selectedModels.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setSelectedModels([])}
                            className="text-xs text-blue-600 hover:text-blue-700"
                          >
                            Clear all
                          </button>
                        )}
                      </div>
                      {availableModels.map((model) => (
                        <label
                          key={model}
                          className="flex items-center px-2 py-1 space-x-2 rounded cursor-pointer hover:bg-gray-100"
                        >
                          <input
                            type="checkbox"
                            checked={selectedModels.includes(model)}
                            onChange={() => toggleModel(model)}
                            className="text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">{model}</span>
                        </label>
                      ))}
                    </>
                  ) : (
                    <p className="text-sm text-gray-500">Loading models...</p>
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Select specific models this machine should support. Leave empty to
                  support all models.
                </p>
              </div>
            </div>

            {error && (
              <div className="p-3 mt-6 bg-red-50 rounded-md">
                <div className="flex gap-2 items-center text-sm text-red-700">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-5 h-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {error instanceof Error ? error.message : "Failed to update machine"}
                </div>
              </div>
            )}

            <div className="flex gap-3 justify-end mt-6">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white rounded-md border border-gray-300 transition-colors hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? (
                  <>
                    <svg
                      className="mr-2 -ml-1 w-4 h-4 text-white animate-spin"
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
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </button>
            </div>
          </form>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

const AuthTokenModal = ({
  machine,
  isOpen,
  onClose,
}: {
  machine: Machine;
  isOpen: boolean;
  onClose: () => void;
}) => {
  const [newTokenDescription, setNewTokenDescription] = useState("");
  const [tokenToDelete, setTokenToDelete] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Add handleDeleteClick function
  const handleDeleteClick = (api_token: string) => {
    setTokenToDelete(api_token);
  };

  const { data: tokens, isLoading } = useQuery<MachineTokenResponse[]>({
    queryKey: ["machine-tokens", machine.network_ip],
    queryFn: async () => {
      const response = await api.get<MachineTokenResponse[]>(
        `/admin/machines/${machine.network_ip}/auth-tokens`
      );
      return response.data;
    },
    enabled: isOpen,
  });

  const { mutate: createToken, isPending: isCreating } = useMutation<
    MachineTokenResponse,
    Error,
    void
  >({
    mutationFn: async () => {
      const response = await api.post<MachineTokenResponse>(
        `/admin/machines/${machine.network_ip}/auth-tokens`,
        {
          description: newTokenDescription || null,
        }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["machine-tokens", machine.network_ip] });
      setNewTokenDescription("");
    },
  });

  const { mutate: deleteToken, isPending: isDeleting } = useMutation({
    mutationFn: async (api_token: string) => {
      await api.delete(`/admin/machines/${machine.network_ip}/auth-tokens/${api_token}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["machine-tokens", machine.network_ip] });
      setTokenToDelete(null);
    },
  });

  return (
    <>
      <Dialog open={isOpen} onClose={onClose} className="relative z-50">
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="flex fixed inset-0 justify-center items-center p-4">
          <Dialog.Panel className="p-6 mx-auto w-full max-w-md bg-white rounded-lg shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <Dialog.Title className="text-lg font-medium text-gray-900">
                Manage Auth Tokens
              </Dialog.Title>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
                <span className="sr-only">Close</span>
                <svg
                  className="w-6 h-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-gray-900">Create New Token</h3>
                <div className="mt-2">
                  <input
                    type="text"
                    value={newTokenDescription}
                    onChange={(e) => setNewTokenDescription(e.target.value)}
                    placeholder="Token description (optional)"
                    className="w-full rounded-md border-gray-300 shadow-xs focus:border-blue-500 focus:ring-blue-500"
                  />
                  <button
                    onClick={() => createToken()}
                    disabled={isCreating}
                    className="inline-flex justify-center items-center px-4 py-2 mt-2 w-full text-sm font-medium text-white bg-blue-600 rounded-md border border-transparent hover:bg-blue-700 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {isCreating ? "Creating..." : "Create Token"}
                  </button>
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-medium text-gray-900">
                  Existing Tokens
                </h3>
                <div className="space-y-2">
                  {isLoading ? (
                    <div className="py-4 text-center">
                      <Loading />
                    </div>
                  ) : !tokens?.length ? (
                    <p className="text-sm text-gray-500">No tokens created yet</p>
                  ) : (
                    tokens.map((token) => (
                      <div
                        key={token.id}
                        className="flex justify-between items-center p-3 bg-gray-50 rounded-md"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">
                            {token.description || "Unnamed Token"}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <p className="font-mono text-xs text-gray-500 truncate">
                              {truncateString(token.api_token)}
                            </p>
                            <CopyToClipboardIcon
                              text={token.api_token}
                              className="text-gray-400"
                              tooltipText="Copy token"
                            />
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteClick(token.api_token)}
                          disabled={isDeleting}
                          className="ml-2 text-red-600 hover:text-red-700 shrink-0"
                        >
                          <span className="sr-only">Delete token</span>
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth="1.5"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                            />
                          </svg>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>

      {/* Confirmation Modal */}
      {tokenToDelete && (
        <ConfirmModal
          title="Delete Auth Token"
          onConfirm={() => deleteToken(tokenToDelete)}
          onCancel={() => setTokenToDelete(null)}
          isLoading={isDeleting}
          confirmLabel="Delete"
          confirmLoadingLabel="Deleting..."
          confirmButtonClassName="bg-red-600 hover:bg-red-700 focus:ring-red-500"
        >
          <p className="text-sm text-gray-500">
            Are you sure you want to delete this auth token? This action cannot be undone.
          </p>
          <div className="p-3 mt-2 bg-gray-50 rounded-md">
            <p className="mt-1 font-mono text-xs text-gray-500">
              {truncateString(tokenToDelete)}
            </p>
          </div>
        </ConfirmModal>
      )}
    </>
  );
};

const sortMachines = (machines: Machine[], sort: SortConfig) => {
  if (!sort.field) return machines;

  return [...machines].sort((a, b) => {
    const aValue = a[sort.field as keyof Machine];
    const bValue = b[sort.field as keyof Machine];

    if (aValue === undefined || bValue === undefined) return 0;

    let comparison = 0;
    if (typeof aValue === "string" && typeof bValue === "string") {
      comparison = aValue.localeCompare(bValue);
    } else if (aValue < bValue) {
      comparison = -1;
    } else if (aValue > bValue) {
      comparison = 1;
    }

    return sort.direction === "asc" ? comparison : -comparison;
  });
};

const AdminMachines = () => {
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    status: "all",
    search: "",
    sort: { field: "created_at", direction: "desc" },
    includeDisabled: false, // Add this line
  });
  const { data: userSession } = useSession();
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["machines"],
    queryFn: fetchMachines, // Use the fetchMachines function
    enabled: !!userSession?.access_token,
    refetchInterval: 30000,
  });

  const filteredAndSortedMachines = useMemo(() => {
    if (!data) return [];

    const result = data.filter((machine) => {
      // First filter by disabled status unless includeDisabled is true
      if (!filters.includeDisabled && machine.disabled) {
        return false;
      }

      // Then apply other filters
      if (filters.status && filters.status !== "all") {
        if (machine.status !== filters.status) return false;
      }

      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        return (
          machine.network_ip.toLowerCase().includes(searchLower) ||
          machine.name?.toLowerCase().includes(searchLower) ||
          machine.description?.toLowerCase().includes(searchLower)
        );
      }

      return true;
    });

    return sortMachines(result, filters.sort);
  }, [data, filters]);

  const handleSort = (field: keyof Machine) => {
    setFilters((prev) => ({
      ...prev,
      sort: {
        field,
        direction:
          prev.sort.field === field && prev.sort.direction === "asc" ? "desc" : "asc",
      },
    }));
  };

  const renderSortButton = (field: keyof Machine, label: string) => {
    const isActive = filters.sort.field === field;
    return (
      <button
        onClick={() => handleSort(field)}
        className={`inline-flex items-center gap-1 text-sm ${
          isActive ? "font-medium text-blue-600" : "text-gray-600"
        } hover:text-blue-600`}
      >
        {label}
        {isActive && (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className={`w-4 h-4 transition-transform ${
              filters.sort.direction === "desc" ? "rotate-180" : ""
            }`}
          >
            <path
              fillRule="evenodd"
              d="M14.77 12.79a.75.75 0 01-1.06-.02L10 8.832 6.29 12.77a.75.75 0 11-1.08-1.04l4.25-4.5a.75.75 0 011.08 0l4.25 4.5a.75.75 0 01-.02 1.06z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </button>
    );
  };

  const renderControls = () => (
    <div className="mb-6 space-y-4">
      {/* Top row: Search and Actions */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-[260px]">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 w-5 h-5 text-gray-400 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, IP, or description..."
              value={filters.search}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, search: e.target.value }))
              }
              className="py-2 pr-4 pl-10 w-full rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div className="flex gap-2 items-center">
          <Menu as="div" className="relative">
            <Menu.Button className="inline-flex gap-2 items-center px-4 py-2 text-sm bg-white rounded-lg border hover:bg-gray-50">
              <FunnelIcon className="w-4 h-4" />
              Status: {filters.status === "all" ? "All" : filters.status}
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
              <Menu.Items className="absolute right-0 z-10 mt-2 w-48 bg-white rounded-md ring-1 ring-black ring-opacity-5 shadow-lg origin-top-right focus:outline-hidden">
                <div className="py-1">
                  {["all", "online", "offline"].map((status) => (
                    <Menu.Item key={status}>
                      {({ active }) => (
                        <button
                          onClick={() =>
                            setFilters((prev) => ({
                              ...prev,
                              status: status as "all" | "online" | "offline",
                            }))
                          }
                          className={`
                            ${active ? "bg-gray-100" : ""} 
                            ${filters.status === status ? "font-medium" : ""}
                            block px-4 py-2 text-sm text-gray-700 w-full text-left capitalize
                          `}
                        >
                          {status}
                        </button>
                      )}
                    </Menu.Item>
                  ))}
                </div>
              </Menu.Items>
            </Transition>
          </Menu>

          {/* Include disabled toggle button without role check */}
          <button
            onClick={() =>
              setFilters((prev) => ({ ...prev, includeDisabled: !prev.includeDisabled }))
            }
            className={`px-4 py-2 text-sm border rounded-lg transition-colors ${
              filters.includeDisabled
                ? "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            {filters.includeDisabled ? "Including disabled" : "Show disabled"}
          </button>

          {(filters.status !== "all" || filters.search || filters.includeDisabled) && (
            <button
              onClick={() =>
                setFilters((prev) => ({
                  status: "all",
                  search: "",
                  sort: prev.sort,
                  includeDisabled: false,
                }))
              }
              className="px-3 py-2 text-sm text-gray-600 rounded-lg border border-gray-300 hover:text-gray-900 hover:bg-gray-50"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Bottom row: Sort controls and Results count */}
      <div className="flex gap-4 justify-between items-center pt-4 border-t border-gray-200">
        <div className="flex gap-4 items-center">
          <span className="text-sm text-gray-500">Sort by:</span>
          {renderSortButton("name", "Name")}
          {renderSortButton("status", "Status")}
          {renderSortButton("created_at", "Created")}
        </div>

        {data && (
          <div className="text-sm text-gray-600">
            {filteredAndSortedMachines.length === data.length ? (
              <span>Showing all {data.length} machines</span>
            ) : (
              <span>
                Showing{" "}
                <span className="font-medium">{filteredAndSortedMachines.length}</span> of{" "}
                <span className="font-medium">{data.length}</span> machines
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );

  if (!userSession?.access_token) {
    return (
      <div className="flex justify-center items-center h-64">
        Please log in to view machines.
      </div>
    );
  }

  return (
    <div className="px-4 py-4 mx-auto max-w-7xl sm:px-6 lg:px-8 sm:py-8">
      <div className="flex flex-col gap-4 mb-6 sm:mb-8 sm:flex-row sm:items-start sm:justify-between sm:gap-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            Machine Management
          </h1>
          <p className="mt-1 text-sm text-gray-600 sm:mt-2">
            Monitor and manage connected machines
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <button
            onClick={() => refetch()}
            disabled={isLoading || isFetching}
            className="p-2 text-gray-500 rounded-lg transition-colors hover:text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Refresh machines list"
          >
            <ArrowPathIcon className={`w-5 h-5 ${isFetching ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => setIsRegisterModalOpen(true)}
            className="inline-flex gap-2 items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <PlusIcon className="w-5 h-5" />
            Add Machine
          </button>
        </div>
      </div>

      {renderControls()}

      {isError ? (
        <ErrorMessage
          message={error instanceof Error ? error.message : "Failed to load machines"}
          retry={() => refetch()}
        />
      ) : (
        <div className="grid gap-4 sm:gap-6">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loading />
            </div>
          ) : !filteredAndSortedMachines.length ? (
            <div className="py-12 text-center bg-white rounded-xl border border-gray-200">
              <div className="text-gray-500">
                {data?.length
                  ? "No machines match the current filters"
                  : "No machines found"}
              </div>
            </div>
          ) : (
            <>
              {filteredAndSortedMachines.map((machine) => (
                <MachineCard key={machine.network_ip} machine={machine} />
              ))}
            </>
          )}
        </div>
      )}

      {/* Stats Summary - only show when no filters are active */}
      {data && data.length > 0 && !filters.search && filters.status === "all" && (
        <div className="grid grid-cols-1 gap-4 mt-8 sm:grid-cols-2 lg:grid-cols-3">
          <div className="p-6 bg-white rounded-lg border border-gray-200 shadow-xs">
            <h3 className="text-sm font-medium text-gray-500">Total Machines</h3>
            <p className="mt-2 text-3xl font-semibold text-gray-900">{data.length}</p>
          </div>
          <div className="p-6 bg-white rounded-lg border border-gray-200 shadow-xs">
            <h3 className="text-sm font-medium text-gray-500">Online Machines</h3>
            <p className="mt-2 text-3xl font-semibold text-green-600">
              {data.filter((m) => m.status === "online").length}
            </p>
          </div>
          <div className="p-6 bg-white rounded-lg border border-gray-200 shadow-xs">
            <h3 className="text-sm font-medium text-gray-500">Offline Machines</h3>
            <p className="mt-2 text-3xl font-semibold text-gray-600">
              {data.filter((m) => m.status === "offline").length}
            </p>
          </div>
        </div>
      )}

      <RegisterMachineModal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
      />
    </div>
  );
};

export default AdminMachines;
