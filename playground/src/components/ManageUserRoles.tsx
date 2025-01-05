import { useState, useEffect } from "react";
import axios from "axios";
import { API_BASE_URL } from "src/config";
import { useSession } from "src/hooks/useSession";
import { useMutation, useQuery } from "@tanstack/react-query";
import Modal from "src/components/Modal";

interface ManageUserRolesProps {
  userId: string;
  onClose: () => void;
}

const roles = ["admin", "user"];

const fetchUserRoles = async (userId: string, token: string) => {
  const response = await axios.get(
    `${API_BASE_URL}/admin/user-claims/${userId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response.data.claim.roles || [];
};

const ManageUserRoles = ({ userId, onClose }: ManageUserRolesProps) => {
  const { data: userSession } = useSession();
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

  const { data: userRoles, isLoading } = useQuery({
    queryKey: ["userRoles", userId],
    queryFn: () => fetchUserRoles(userId, userSession?.access_token || ""),
    enabled: !!userSession?.access_token,
  });

  useEffect(() => {
    if (userRoles) {
      setSelectedRoles(userRoles);
    }
  }, [userRoles]);

  const updateUserRolesMutation = useMutation({
    mutationFn: async (roles: string[]) => {
      if (!userSession?.access_token) return;

      await axios.post(
        `${API_BASE_URL}/admin/user-claims/${userId}`,
        { roles },
        {
          headers: {
            Authorization: `Bearer ${userSession.access_token}`,
          },
        }
      );
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
            className="bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
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
