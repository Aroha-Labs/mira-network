import { Fragment, useState } from "react";
import api from "src/lib/axios";
import CopyToClipboardIcon from "src/components/CopyToClipboardIcon";
import { useSession } from "src/hooks/useSession";
import Modal from "src/components/Modal";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import ProfileImage from "./ProfileImage";
import { Menu, Transition } from "@headlessui/react";
import {
  ChevronDownIcon as MenuIcon,
  ChartBarIcon,
} from "@heroicons/react/24/outline";
import ManageUserRoles from "src/components/ManageUserRoles";
import { USDollar } from "src/utils/currency";
import MetricsModal from "./MetricsModal";
import { toast } from "react-hot-toast";

interface User {
  id: string;
  user_metadata: {
    name: string;
    email: string;
    avatar_url: string;
  };
}

const fetchUserCredits = async (userId: string) => {
  const response = await api.get(`/admin/user-credits/${userId}`);
  return response.data.credits;
};

const fetchUserRoles = async (userId: string) => {
  const response = await api.get(`/admin/user-claims/${userId}`);
  return response.data?.claim?.roles || [];
};

const UserCard = ({ user }: { user: User }) => {
  const { data: userSession } = useSession();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRolesModalOpen, setIsRolesModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [credits, setCredits] = useState(0);
  const queryClient = useQueryClient();

  const { data: userCredits, isLoading: isCreditsLoading } = useQuery({
    queryKey: ["userCredits", user.id],
    queryFn: () => fetchUserCredits(user.id),
    enabled: !!userSession?.access_token,
  });

  const { data: userRoles, isLoading: isRolesLoading } = useQuery({
    queryKey: ["userRoles", user.id],
    queryFn: () => fetchUserRoles(user.id),
    enabled: !!userSession?.access_token,
  });

  const addCreditsMutation = useMutation({
    mutationFn: async (amount: number) => {
      await api.post("/admin/add-credit", {
        user_id: user.id,
        amount,
        description: "Admin added credits",
      });
    },
    onSuccess: () => {
      toast.success("Credits added successfully");
      setIsModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["userCredits", user.id] });
    },
    onError: (error) => {
      console.error("Failed to add credits:", error);
      toast.error("Failed to add credits");
    },
  });

  const handleAddCredits = (e: React.FormEvent) => {
    e.preventDefault();
    addCreditsMutation.mutate(credits);
  };

  const handleManageRoles = () => {
    setIsRolesModalOpen(true);
  };

  const getUserStatus = (roles: string[] | undefined, isLoading: boolean) => {
    if (isLoading) return { text: "Loading...", color: "text-gray-500" };
    if (!roles || roles.length === 0)
      return { text: "Inactive", color: "text-red-600" };
    return { text: "Active", color: "text-green-600" };
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden transition hover:shadow-md">
      <div className="p-6">
        <div className="sm:flex sm:items-start sm:justify-between">
          <div className="flex items-start space-x-4">
            <ProfileImage
              src={user.user_metadata.avatar_url}
              alt={user.user_metadata.name}
              className="w-12 h-12 rounded-full border border-gray-200"
            />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {user.user_metadata.name}
              </h3>
              <p className="text-sm text-gray-500">
                {user.user_metadata.email}
              </p>
              <div className="mt-1 flex items-center space-x-2">
                <span className="text-xs text-gray-500">{user.id}</span>
                <CopyToClipboardIcon text={user.id} />
              </div>
            </div>
          </div>

          <div className="mt-4 sm:mt-0 flex items-center space-x-3">
            <button
              onClick={() => setSelectedUserId(user.id)}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              <ChartBarIcon className="h-4 w-4 mr-1.5" />
              Metrics
            </button>
            <Menu as="div" className="relative">
              <Menu.Button className="flex items-center text-gray-500 hover:text-gray-700">
                <MenuIcon className="h-5 w-5" />
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
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        onClick={() => handleManageRoles()}
                        className={`${
                          active ? "bg-gray-100" : ""
                        } w-full text-left px-4 py-2 text-sm text-gray-700`}
                      >
                        Manage Roles
                      </button>
                    )}
                  </Menu.Item>
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        onClick={() => setIsModalOpen(true)}
                        className={`${
                          active ? "bg-gray-100" : ""
                        } w-full text-left px-4 py-2 text-sm text-gray-700`}
                      >
                        Add Credits
                      </button>
                    )}
                  </Menu.Item>
                </Menu.Items>
              </Transition>
            </Menu>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="bg-gray-50 px-4 py-2 rounded-md">
            <p className="text-xs font-medium text-gray-500">Credits</p>
            {isCreditsLoading ? (
              <div className="h-5 w-20 bg-gray-200 animate-pulse rounded mt-1"></div>
            ) : (
              <p className="mt-1 font-semibold text-gray-900">
                {USDollar.format(userCredits)}
              </p>
            )}
          </div>
          <div className="bg-gray-50 px-4 py-2 rounded-md">
            <p className="text-xs font-medium text-gray-500">Roles</p>
            {isRolesLoading ? (
              <div className="h-5 w-20 bg-gray-200 animate-pulse rounded mt-1"></div>
            ) : (
              <p className="mt-1 font-semibold text-gray-900">
                {userRoles?.length ? userRoles.join(", ") : "No roles"}
              </p>
            )}
          </div>
          <div className="bg-gray-50 px-4 py-2 rounded-md">
            <p className="text-xs font-medium text-gray-500">Status</p>
            {isRolesLoading ? (
              <div className="h-5 w-20 bg-gray-200 animate-pulse rounded mt-1"></div>
            ) : (
              <p
                className={`mt-1 font-semibold ${
                  getUserStatus(userRoles, isRolesLoading).color
                }`}
              >
                {getUserStatus(userRoles, isRolesLoading).text}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {isModalOpen && (
        <Modal
          title={`Add Credits for ${user.user_metadata.name}`}
          onClose={() => setIsModalOpen(false)}
        >
          <form onSubmit={handleAddCredits} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Amount (USD)
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">$</span>
                </div>
                <input
                  type="number"
                  value={credits}
                  onChange={(e) => setCredits(Number(e.target.value))}
                  className="block w-full pl-7 pr-12 py-2 border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">USD</span>
                </div>
              </div>
            </div>

            {addCreditsMutation.isError && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">
                      Error adding credits
                    </h3>
                    <div className="mt-2 text-sm text-red-700">
                      {addCreditsMutation.error.message}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={addCreditsMutation.isPending || credits <= 0}
              >
                {addCreditsMutation.isPending ? (
                  <span className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Adding...
                  </span>
                ) : (
                  "Add Credits"
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {isRolesModalOpen && (
        <ManageUserRoles
          userId={user.id}
          onClose={() => setIsRolesModalOpen(false)}
        />
      )}
      {selectedUserId && (
        <MetricsModal
          userId={selectedUserId}
          title={`Metrics for ${user.user_metadata.name}`}
          onClose={() => setSelectedUserId(null)}
        />
      )}
    </div>
  );
};

export default UserCard;
