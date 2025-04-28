import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Modal from "src/components/Modal";
import { CheckIcon } from "@heroicons/react/24/outline";
import { toast } from "react-hot-toast";
import api from "src/lib/axios";
import { User } from "src/types/user";
import { trackEvent } from "src/lib/mira";

interface ManageUserRolesProps {
  user: User;
  onClose: () => void;
}

const roles = ["admin", "user"];

const ManageUserRoles = ({ user, onClose }: ManageUserRolesProps) => {
  console.log("===>", user);

  const queryClient = useQueryClient();

  const [selectedRoles, setSelectedRoles] = useState<string[]>(
    user.custom_claim?.roles || []
  );

  const updateUserRolesMutation = useMutation({
    mutationFn: async (roles: string[]) => {
      await api.post(`/admin/user-claims/${user.user_id}`, { roles });
    },
    onSuccess: () => {
      toast.success("Roles updated successfully");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      onClose();
    },
    onError: (error) => {
      console.error("Failed to update roles:", error);
      toast.error("Failed to update roles");
    },
  });

  const handleRoleChange = (role: string) => {
    setSelectedRoles((prevRoles) =>
      prevRoles.includes(role)
        ? prevRoles.filter((r) => r !== role)
        : [...prevRoles, role]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    trackEvent('admin_update_user_roles', {
      user_id: user.user_id,
      previous_roles: user.custom_claim?.roles || [],
      new_roles: selectedRoles
    });

    updateUserRolesMutation.mutate(selectedRoles);
  };

  return (
    <Modal title="Manage User Roles" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="space-y-3">
          {roles.map((role) => (
            <label
              key={role}
              className={`flex items-center justify-between p-3 rounded-lg border ${selectedRoles.includes(role)
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 hover:border-gray-300"
                } cursor-pointer transition-colors duration-150`}
            >
              <div className="flex items-center">
                <div className="ml-3">
                  <div className="text-sm font-medium text-gray-900 capitalize">
                    {role}
                  </div>
                  <div className="text-xs text-gray-500">
                    {role === "admin"
                      ? "Full access to all features and user management"
                      : "Basic access to platform features"}
                  </div>
                </div>
              </div>
              <div
                className={`shrink-0 h-6 w-6 rounded-full border-2 flex items-center justify-center ${selectedRoles.includes(role)
                  ? "border-blue-500 bg-blue-500"
                  : "border-gray-300"
                  }`}
                onClick={() => handleRoleChange(role)}
              >
                {selectedRoles.includes(role) && (
                  <CheckIcon className="h-4 w-4 text-white" />
                )}
              </div>
            </label>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={updateUserRolesMutation.isPending}
          >
            {updateUserRolesMutation.isPending ? (
              <span className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Updating...
              </span>
            ) : (
              "Save Changes"
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default ManageUserRoles;
