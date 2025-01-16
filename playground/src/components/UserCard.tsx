import { Fragment, useState } from "react";
import { User } from "src/types/user";
import CopyToClipboardIcon from "src/components/CopyToClipboardIcon";
import ProfileImage from "./ProfileImage";
import { Menu, Transition } from "@headlessui/react";
import { ChevronDownIcon as MenuIcon, ChartBarIcon } from "@heroicons/react/24/outline";
import ManageUserRoles from "src/components/ManageUserRoles";
import { USDollar } from "src/utils/currency";
import MetricsModal from "./MetricsModal";
import AddCreditsModal from "src/components/AddCreditsModal";

const UserCard = ({ user }: { user: User }) => {
  const [isAddCreditsModalOpen, setIsAddCreditsModalOpen] = useState(false);
  const [isRolesModalOpen, setIsRolesModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const handleManageRoles = () => {
    setIsRolesModalOpen(true);
  };

  const getUserStatus = (roles: string[] | undefined, isLoading: boolean) => {
    if (isLoading) return { text: "Loading...", color: "text-gray-500" };
    if (!roles || roles.length === 0) return { text: "Inactive", color: "text-red-600" };
    return { text: "Active", color: "text-green-600" };
  };

  const userRoles = user.custom_claim?.roles || [];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden transition hover:shadow-md">
      <div className="p-6">
        <div className="sm:flex sm:items-start sm:justify-between">
          <div className="flex items-start space-x-4">
            <ProfileImage
              src={user.avatar_url}
              alt={user.full_name}
              className="w-12 h-12 rounded-full border border-gray-200"
            />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{user.full_name}</h3>
              <p className="text-sm text-gray-500">{user.email}</p>
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
                        onClick={() => setIsAddCreditsModalOpen(true)}
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
            <p className="mt-1 font-semibold text-gray-900">
              {USDollar.format(user.credits)}
            </p>
          </div>
          <div className="bg-gray-50 px-4 py-2 rounded-md">
            <p className="text-xs font-medium text-gray-500">Roles</p>
            <p className="mt-1 font-semibold text-gray-900">
              {userRoles.length ? userRoles.join(", ") : "No roles"}
            </p>
          </div>
          <div className="bg-gray-50 px-4 py-2 rounded-md">
            <p className="text-xs font-medium text-gray-500">Status</p>
            <p className={`mt-1 font-semibold ${getUserStatus(userRoles, false).color}`}>
              {getUserStatus(userRoles, false).text}
            </p>
          </div>
        </div>
      </div>

      {/* Modals */}
      {isAddCreditsModalOpen && (
        <AddCreditsModal
          userId={user.user_id}
          userName={user.full_name}
          onClose={() => setIsAddCreditsModalOpen(false)}
        />
      )}
      {isRolesModalOpen && (
        <ManageUserRoles user={user} onClose={() => setIsRolesModalOpen(false)} />
      )}
      {selectedUserId && (
        <MetricsModal
          userId={selectedUserId}
          title={`Metrics for ${user.full_name}`}
          onClose={() => setSelectedUserId(null)}
        />
      )}
    </div>
  );
};

export default UserCard;
