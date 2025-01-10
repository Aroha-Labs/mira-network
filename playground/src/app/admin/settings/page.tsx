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

  if (!userSession?.access_token) {
    return (
      <div className="flex items-center justify-center h-64">
        Please log in to manage settings.
      </div>
    );
  }

  if (isLoading) {
    return <Loading />;
  }

  return (
    <div className="p-6 bg-white rounded shadow-md">
      <h1 className="text-2xl font-bold mb-4">System Settings</h1>
      <div className="space-y-4">
        {settings?.map((setting) => (
          <div key={setting.id} className="border p-4 rounded hover:bg-gray-50">
            <div className="flex justify-between items-start">
              <div className="space-y-2 flex-1">
                <div className="font-bold text-lg">{setting.name}</div>
                {setting.description && (
                  <div className="text-sm text-gray-500">
                    {setting.description}
                  </div>
                )}
                <div className="bg-white rounded p-3 border">
                  <SettingValue value={setting.value} />
                </div>
              </div>
              <button
                onClick={() => setEditSetting(setting)}
                className="ml-4 text-blue-500 hover:text-blue-600 font-medium"
              >
                Edit
              </button>
            </div>
          </div>
        ))}
      </div>

      {editSetting && (
        <Modal
          title={`Edit Setting: ${editSetting.name}`}
          onClose={() => !updateMutation.isPending && setEditSetting(null)}
          footer={
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setEditSetting(null)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50"
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
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
          }
        >
          <SettingEditor
            value={editSetting.value}
            onChange={(newValue) =>
              setEditSetting({ ...editSetting, value: newValue })
            }
            disabled={updateMutation.isPending}
          />
        </Modal>
      )}
    </div>
  );
};

export default AdminSettings;
