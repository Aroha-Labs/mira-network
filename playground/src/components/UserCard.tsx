import { Fragment, useState } from "react";
import axios from "axios";
import CopyToClipboardIcon from "src/components/CopyToClipboardIcon";
import { API_BASE_URL } from "src/config";
import { useSession } from "src/hooks/useSession";
import Modal from "src/components/Modal";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import ProfileImage from "./ProfileImage";
import {
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
  Transition,
} from "@headlessui/react";
import { ChevronDownIcon as MenuIcon } from "@heroicons/react/24/outline";
import ManageUserRoles from "src/components/ManageUserRoles";
import { USDollar } from "src/utils/currency";

interface User {
  id: string;
  user_metadata: {
    name: string;
    email: string;
    avatar_url: string;
  };
}

const fetchUserCredits = async (userId: string, token: string) => {
  const response = await axios.get(
    `${API_BASE_URL}/admin/user-credits/${userId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response.data.credits;
};

const fetchUserRoles = async (userId: string, token: string) => {
  const response = await axios.get(
    `${API_BASE_URL}/admin/user-claims/${userId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response.data?.claim?.roles || [];
};

const UserCard = ({ user }: { user: User }) => {
  const { data: userSession } = useSession();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRolesModalOpen, setIsRolesModalOpen] = useState(false);
  const [credits, setCredits] = useState(0);
  const queryClient = useQueryClient();

  const {
    data: userCredits,
    error: creditsError,
    isLoading: isCreditsLoading,
  } = useQuery({
    queryKey: ["userCredits", user.id],
    queryFn: () => fetchUserCredits(user.id, userSession?.access_token || ""),
    enabled: !!userSession?.access_token,
  });

  const {
    data: userRoles,
    isLoading: isRolesLoading,
    error: rolesError,
  } = useQuery({
    queryKey: ["userRoles", user.id],
    queryFn: () => fetchUserRoles(user.id, userSession?.access_token || ""),
    enabled: !!userSession?.access_token,
  });

  const addCreditsMutation = useMutation({
    mutationFn: async (amount: number) => {
      if (!userSession?.access_token) return;

      await axios.post(
        `${API_BASE_URL}/add-credit`,
        {
          user_id: user.id,
          amount,
          description: "Admin added credits",
        },
        {
          headers: {
            Authorization: `Bearer ${userSession.access_token}`,
          },
        }
      );
    },
    onSuccess: () => {
      alert("Credits added successfully");
      setIsModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["userCredits", user.id] });
    },
    onError: (error) => {
      console.error("Failed to add credits:", error);
      alert("Failed to add credits");
    },
  });

  const handleAddCredits = (e: React.FormEvent) => {
    e.preventDefault();
    addCreditsMutation.mutate(credits);
  };

  const handleManageRoles = () => {
    setIsRolesModalOpen(true);
  };

  return (
    <li className="p-4 bg-gray-100 rounded shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-4">
          <ProfileImage
            src={user.user_metadata.avatar_url}
            alt={user.user_metadata.name}
            className="w-10 h-10 rounded-full"
          />
          <div>
            <p className="font-bold">{user.user_metadata.name}</p>
            <p className="text-gray-600">{user.user_metadata.email}</p>
            <div className="flex items-center space-x-2">
              <span className="text-gray-500 text-sm">{user.id}</span>
              <CopyToClipboardIcon text={user.id} />
            </div>
            <div className="mt-2 flex items-center space-x-2">
              {isCreditsLoading ? (
                <div className="w-24 h-4 bg-gray-200 animate-pulse rounded"></div>
              ) : creditsError ? (
                <span className="text-red-500 text-sm">
                  Error loading credits
                </span>
              ) : (
                <span className="text-gray-500 text-sm">
                  Credits:{" "}
                  <strong className="text-orange-900">
                    {USDollar.format(userCredits)}
                  </strong>
                </span>
              )}
            </div>
            <div className="mt-2 flex items-center space-x-2">
              {isRolesLoading ? (
                <div className="w-24 h-4 bg-gray-200 animate-pulse rounded"></div>
              ) : rolesError ? (
                <span className="text-red-500 text-sm">
                  Error loading roles
                </span>
              ) : userRoles.length === 0 ? (
                <span className="text-gray-500 text-sm">No access</span>
              ) : (
                <span className="text-gray-500 text-sm">
                  Roles:{" "}
                  <strong className="text-orange-900">
                    {userRoles.join(", ")}
                  </strong>
                </span>
              )}
            </div>
          </div>
        </div>
        <Menu as="div" className="relative">
          <MenuButton className="flex items-center text-gray-500 hover:text-gray-700">
            <MenuIcon className="h-5 w-5" />
          </MenuButton>
          <Transition
            as={Fragment}
            enter="transition ease-out duration-100"
            enterFrom="transform opacity-0 scale-95"
            enterTo="transform opacity-100 scale-100"
            leave="transition ease-in duration-75"
            leaveFrom="transform opacity-100 scale-100"
            leaveTo="transform opacity-0 scale-95"
          >
            <MenuItems className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded shadow-lg">
              <MenuItem>
                {({ active }) => (
                  <button
                    onClick={handleManageRoles}
                    className={`${
                      active ? "bg-gray-100" : ""
                    } w-full text-left px-4 py-2 text-sm text-gray-700`}
                  >
                    Manage Roles
                  </button>
                )}
              </MenuItem>
              <MenuItem>
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
              </MenuItem>
            </MenuItems>
          </Transition>
        </Menu>
      </div>
      {isModalOpen && (
        <Modal title="Add Credits" onClose={() => setIsModalOpen(false)}>
          <form onSubmit={handleAddCredits} className="flex flex-col space-y-4">
            <input
              type="number"
              value={credits}
              onChange={(e) => setCredits(Number(e.target.value))}
              className="border border-gray-300 p-2 rounded"
              placeholder="Credits"
            />
            <button
              type="submit"
              className="bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
              disabled={addCreditsMutation.isPending}
            >
              {addCreditsMutation.isPending ? "Adding..." : "Add Credits"}
            </button>
          </form>
        </Modal>
      )}
      {isRolesModalOpen && (
        <ManageUserRoles
          userId={user.id}
          onClose={() => setIsRolesModalOpen(false)}
        />
      )}
    </li>
  );
};

export default UserCard;
