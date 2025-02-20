import { useState } from "react";
import { User } from "src/types/user";
import CopyToClipboardIcon from "src/components/CopyToClipboardIcon";
import ProfileImage from "./ProfileImage";
import {
  ChartBarIcon,
  UserGroupIcon,
  CurrencyDollarIcon,
} from "@heroicons/react/24/outline";
import ManageUserRoles from "src/components/ManageUserRoles";
import { USDollar } from "src/utils/currency";
import MetricsModal from "./MetricsModal";
import AddCreditsModal from "src/components/AddCreditsModal";
import { formatDateTime, formatRelativeTime } from "src/utils/date";

const RoleTag = ({ role }: { role: string }) => {
  const roleStyles = {
    admin: {
      container: "bg-purple-50 text-purple-700 border border-purple-200",
      icon: "text-purple-500",
    },
    user: {
      container: "bg-blue-50 text-blue-700 border border-blue-200",
      icon: "text-blue-500",
    },
  }[role.toLowerCase()] || {
    container: "bg-gray-50 text-gray-700 border border-gray-200",
    icon: "text-gray-500",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${roleStyles.container}`}
    >
      {role === "admin" ? (
        <svg
          className={`h-3 w-3 ${roleStyles.icon}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M10 2a2 2 0 012 2v2h3a1 1 0 110 2h-.08A9 9 0 0117 12c0 2.2-.8 4.2-2.12 5.76a1 1 0 11-1.56-1.25A7 7 0 0010 18a7 7 0 00-3.32-5.94 1 1 0 11.95-1.75l.01-.01A2 2 0 019 9.5V4a2 2 0 011-1.73V2z"
            clipRule="evenodd"
          />
        </svg>
      ) : (
        <svg
          className={`h-3 w-3 ${roleStyles.icon}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
            clipRule="evenodd"
          />
        </svg>
      )}
      <span>{role.charAt(0).toUpperCase() + role.slice(1)}</span>
    </span>
  );
};

const CreditTag = ({ amount }: { amount: number }) => {
  const getCreditsStyle = () => {
    if (amount === 0) return "bg-red-50 text-red-700 border-red-200";
    if (amount < 2) return "bg-yellow-50 text-yellow-700 border-yellow-200";
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  };

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border ${getCreditsStyle()}`}
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span className="text-sm font-medium">{USDollar.format(amount)}</span>
      <span className="text-xs opacity-75">credits</span>
    </div>
  );
};

const UserCard = ({ user }: { user: User }) => {
  const [isAddCreditsModalOpen, setIsAddCreditsModalOpen] = useState(false);
  const [isRolesModalOpen, setIsRolesModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const handleManageRoles = () => {
    setIsRolesModalOpen(true);
  };

  const statusColors = {
    active: {
      dot: "bg-green-500",
      bg: "bg-green-50",
      text: "text-green-700",
    },
    inactive: {
      dot: "bg-red-500",
      bg: "bg-red-50",
      text: "text-red-700",
    },
    loading: {
      dot: "bg-gray-500",
      bg: "bg-gray-50",
      text: "text-gray-700",
    },
  };

  const getStatusColor = (roles: string[] | undefined, isLoading: boolean) => {
    if (isLoading) return statusColors.loading;
    if (!roles || roles.length === 0) return statusColors.inactive;
    return statusColors.active;
  };

  const userRoles = user.custom_claim?.roles || [];
  const status = getStatusColor(userRoles, false);

  return (
    <div className="bg-white rounded-xl border border-gray-200 transition-colors hover:border-gray-300 overflow-hidden">
      <div className="p-4 lg:p-5">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Left Column - Avatar & Basic Info */}
          <div className="flex gap-3 flex-1 min-w-0">
            <div className="relative shrink-0">
              <ProfileImage
                src={user.avatar_url}
                alt={user.full_name}
                className="w-11 h-11 rounded-lg ring-1 ring-gray-200 shadow-xs"
              />
            </div>

            <div className="min-w-0 flex-1">
              {/* Header Section */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-900 truncate">
                      {user.full_name}
                    </h3>
                    <div className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                  </div>
                  <p className="text-sm text-gray-500 truncate mt-0.5">{user.email}</p>
                </div>

                {/* Desktop Actions */}
                <div className="hidden lg:flex items-center gap-1">
                  <button
                    onClick={() => setSelectedUserId(user.user_id)}
                    className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-md transition-colors"
                    title="View Metrics"
                  >
                    <ChartBarIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleManageRoles()}
                    className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-md transition-colors"
                    title="Manage Roles"
                  >
                    <UserGroupIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setIsAddCreditsModalOpen(true)}
                    className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-md transition-colors"
                    title="Add Credits"
                  >
                    <CurrencyDollarIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Info Section */}
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {userRoles.length > 0 ? (
                    userRoles.map((role) => <RoleTag key={role} role={role} />)
                  ) : (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-xs font-medium bg-gray-50 text-gray-600 border border-gray-200">
                      No roles
                    </span>
                  )}
                </div>
                <CreditTag amount={user.credits} />
              </div>
            </div>
          </div>

          {/* Mobile Actions */}
          <div className="lg:hidden flex items-center justify-between border-t border-gray-100 pt-3 mt-1">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedUserId(user.user_id)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-md transition-colors"
                title="View Metrics"
              >
                <ChartBarIcon className="w-5 h-5" />
              </button>
              <button
                onClick={() => handleManageRoles()}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-md transition-colors"
                title="Manage Roles"
              >
                <UserGroupIcon className="w-5 h-5" />
              </button>
              <button
                onClick={() => setIsAddCreditsModalOpen(true)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-md transition-colors"
                title="Add Credits"
              >
                <CurrencyDollarIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="text-xs text-gray-400">
              <span>Last login: </span>
              <time
                dateTime={user.last_login_at || ""}
                className="text-gray-500 font-medium"
                title={user.last_login_at ? formatDateTime(user.last_login_at) : ""}
              >
                {user.last_login_at ? formatRelativeTime(user.last_login_at) : "Never"}
              </time>
            </div>
          </div>
        </div>

        {/* Desktop Footer */}
        <div className="hidden lg:flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
          <div className="text-xs text-gray-400">
            <span>Last login: </span>
            <time
              dateTime={user.last_login_at || ""}
              className="text-gray-500 font-medium"
              title={user.last_login_at ? formatDateTime(user.last_login_at) : ""}
            >
              {user.last_login_at ? formatRelativeTime(user.last_login_at) : "Never"}
            </time>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span>ID: </span>
            <span className="font-mono">{user.id}</span>
            <CopyToClipboardIcon
              text={user.id}
              tooltipText="Copy ID"
              className="text-gray-400"
            />
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
