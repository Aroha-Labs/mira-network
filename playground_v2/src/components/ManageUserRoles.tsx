import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import Modal from "src/components/Modal";
import api from "src/lib/axios";
import { useSession } from "src/hooks/useSession";

interface ManageUserRolesProps {
  userId: string;
  onClose: () => void;
}

const roles = ["admin", "user"];

const fetchUserRoles = async (userId: string) => {
  const response = await api.get(`/admin/user-claims/${userId}`);
  return response.data.roles || [];
};

const ManageUserRoles = ({ userId, onClose }: ManageUserRolesProps) => {
  const { user } = useSession();
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

  const { data: userRoles, isLoading } = useQuery({
    queryKey: ["userRoles", userId],
    queryFn: () => fetchUserRoles(userId),
    enabled: !!user,
  });

  useEffect(() => {
    if (userRoles) {
      setSelectedRoles(userRoles);
    }
  }, [userRoles]);

  const updateUserRolesMutation = useMutation({
    mutationFn: async (roles: string[]) => {
      await api.post(`/admin/user-claims/${userId}`, { roles });
    },
    onSuccess: () => {
      alert("Roles updated successfully");
      onClose();
    },
    onError: (error) => {
      console.error("Failed to update roles:", error);
      alert("Failed to update roles");
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
    updateUserRolesMutation.mutate(selectedRoles);
  };

  return (
    <Modal title="Manage User Roles" onClose={onClose}>
      {isLoading ? (
        <div>Loading...</div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
          {roles.map((role) => (
            <label key={role} className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={selectedRoles.includes(role)}
                onChange={() => handleRoleChange(role)}
              />
              <span>{role}</span>
            </label>
          ))}
          <button
            type="submit"
            className="bg-blue-500 text-white p-2 hover:bg-blue-600"
            disabled={updateUserRolesMutation.isPending}
          >
            {updateUserRolesMutation.isPending ? "Updating..." : "Update Roles"}
          </button>
        </form>
      )}
    </Modal>
  );
};

export default ManageUserRoles;
