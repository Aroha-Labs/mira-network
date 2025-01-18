import { User } from "@supabase/supabase-js";
import Link from "next/link";
import React from "react";
import ProfileImage from "src/components/ProfileImage";
import { useLogout } from "src/hooks/useLogout";

interface UserInfoProps {
  user?: User;
  children?: React.ReactNode;
}

const UserInfo: React.FC<UserInfoProps> = ({ user, children }) => {
  const logoutMutation = useLogout();

  const handleLogout = async () => {
    logoutMutation.mutate();
  };

  const isLoggedIn = !!user;

  return (
    <div className="bg-white shadow w-full max-w-md">
      <div className="bg-gray-50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <ProfileImage
              src={
                isLoggedIn
                  ? user.user_metadata.avatar_url
                  : "/img/avatar-dummy.svg"
              }
              alt="Avatar"
              className="w-12 h-12 mr-4"
            />
            <div>
              <p className="font-bold">
                {isLoggedIn
                  ? user.user_metadata.full_name
                  : "Welcome to Playground"}
              </p>
              <p className="text-sm text-gray-600">
                {isLoggedIn ? user.email : "Sign in to access your console"}
              </p>
            </div>
          </div>
          {isLoggedIn ? (
            <button
              onClick={handleLogout}
              className={`flex items-center text-gray-700 px-3 py-1 border border-gray-300 text-sm  ${
                logoutMutation.isPending
                  ? "cursor-not-allowed opacity-50"
                  : "hover:bg-gray-200 active:bg-gray-300 transition"
              }`}
              disabled={logoutMutation.isPending}
            >
              {logoutMutation.isPending ? (
                <svg
                  className="animate-spin h-5 w-5 mr-1"
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
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  ></path>
                </svg>
              ) : (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 mr-1"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M3 10a1 1 0 011-1h8a1 1 0 110 2H4a1 1 0 01-1-1z"
                      clipRule="evenodd"
                    />
                    <path
                      fillRule="evenodd"
                      d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Logout
                </>
              )}
            </button>
          ) : (
            <Link
              href="/login"
              className="flex items-center text-white bg-green-500 px-3 py-1 border border-green-500 text-sm hover:bg-green-600 active:bg-green-700 transition"
            >
              Login
            </Link>
          )}
        </div>
      </div>
      {children}
    </div>
  );
};

export default UserInfo;
