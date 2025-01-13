"use client";

import { useState } from "react";
import axios, { AxiosError } from "axios";
import { useSession } from "src/hooks/useSession";
import { API_BASE_URL } from "src/config";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Loading from "src/components/PageLoading";
import Modal from "src/components/Modal";
import SettingEditor from "src/components/SettingEditor";
import SettingValue from "src/components/SettingValue";
import { toast } from "react-hot-toast";
import { JsonValue } from "src/types/json";
import { ClipboardDocumentIcon, CodeBracketIcon } from "@heroicons/react/24/outline";

interface SystemSetting {
  id: number;
  name: string;
  value: Record<string, JsonValue>;
  description: string | null;
  created_at: string;
  updated_at: string;
}

const AdminSettings = () => {
  const { data: userSession } = useSession();
  const queryClient = useQueryClient();
  const [editSetting, setEditSetting] = useState<SystemSetting | null>(null);
  const [rawJsonMap, setRawJsonMap] = useState<Record<number, boolean>>({});

  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const response = await axios.get<SystemSetting[]>(
        `${API_BASE_URL}/admin/settings`,
        {
          headers: {
            Authorization: `Bearer ${userSession?.access_token}`,
          },
        }
      );
      return response.data;
    },
    enabled: !!userSession?.access_token,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { name: string; value: unknown }) => {
      return axios.put(
        `${API_BASE_URL}/admin/settings/${data.name}`,
        { value: data.value },
        {
          headers: {
            Authorization: `Bearer ${userSession?.access_token}`,
          },
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setEditSetting(null);
      toast.success("Setting updated successfully");
    },
    onError: (error: AxiosError<{ detail: unknown }>) => {
      const detail = error.response?.data?.detail;
      const errorMessage =
        typeof detail === "string" ? detail : "Failed to update setting";
      toast.error(errorMessage);
    },
  });

  const toggleRawJson = (settingId: number) => {
    setRawJsonMap((prev) => ({
      ...prev,
      [settingId]: !prev[settingId],
    }));
  };

  if (!userSession?.access_token) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        Please log in to manage settings.
      </div>
    );
  }

  if (isLoading) {
    return <Loading fullPage />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">System Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Configure and manage system-wide settings
        </p>
      </div>

      {/* Settings List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 divide-y divide-gray-200">
        {settings?.map((setting) => (
          <div key={setting.id} className="p-6 transition-colors hover:bg-gray-50">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-gray-900">
                    {setting.name}
                  </h3>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
                    System
                  </span>
                </div>
                {setting.description && (
                  <p className="mt-1 text-sm text-gray-500">{setting.description}</p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(
                        JSON.stringify(setting.value, null, 2)
                      );
                      toast.success("Copied to clipboard");
                    }}
                    className="inline-flex items-center px-2 py-1 text-sm text-gray-600 hover:text-gray-900"
                  >
                    <ClipboardDocumentIcon className="h-4 w-4" />
                    <span className="ml-1 hidden sm:inline">Copy</span>
                  </button>
                  <button
                    onClick={() => toggleRawJson(setting.id)}
                    className="inline-flex items-center px-2 py-1 text-sm text-gray-600 hover:text-gray-900"
                  >
                    <CodeBracketIcon className="h-4 w-4" />
                    <span className="ml-1 hidden sm:inline">
                      {rawJsonMap[setting.id] ? "Show Formatted" : "Show Raw"}
                    </span>
                  </button>
                </div>
                <button
                  onClick={() => setEditSetting(setting)}
                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Edit Setting
                </button>
              </div>
            </div>

            <div className="mt-3">
              <SettingValue
                value={setting.value}
                showRaw={rawJsonMap[setting.id] || false}
              />
            </div>

            <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
              <span>Last updated:</span>
              <time dateTime={setting.updated_at}>
                {new Date(setting.updated_at).toLocaleString()}
              </time>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Modal */}
      {editSetting && (
        <Modal
          title={`Edit Setting: ${editSetting.name}`}
          onClose={() => !updateMutation.isPending && setEditSetting(null)}
        >
          <div className="space-y-4">
            <div className="bg-gray-50 px-4 py-3 rounded-md border border-gray-200 text-sm text-gray-500">
              {editSetting.description}
            </div>

            <div className="border rounded-md">
              <SettingEditor
                value={editSetting.value}
                onChange={(newValue) =>
                  setEditSetting({ ...editSetting, value: newValue })
                }
                disabled={updateMutation.isPending}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={() => setEditSetting(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                disabled={updateMutation.isPending}
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  updateMutation.mutate({
                    name: editSetting.name,
                    value: editSetting.value,
                  })
                }
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default AdminSettings;
