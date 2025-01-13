import Link from "next/link";
import { useState, Fragment } from "react";
import {
  Bars3Icon,
  XMarkIcon,
  UserCircleIcon,
  Cog6ToothIcon,
} from "@heroicons/react/24/outline";
import { useSession } from "src/hooks/useSession";
import { useLogout } from "src/hooks/useLogout";
import { Menu, Transition } from "@headlessui/react";

const UserProfile = () => {
  const { data: session, isLoading } = useSession();
  const logout = useLogout();

  if (isLoading) {
    return <div className="h-9 w-9 rounded-md bg-gray-100 animate-pulse" />;
  }

  if (!session) {
    return (
      <Link
        href="/login"
        className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
      >
        Sign in
      </Link>
    );
  }

  return (
    <Menu as="div" className="relative">
      <Menu.Button className="flex items-center gap-2 p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-50">
        <UserCircleIcon className="h-6 w-6" />
        <span className="hidden md:block text-sm">
          {session?.user?.email?.split("@")[0]}
        </span>
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
          <div className="py-1">
            <Menu.Item>
              {({ active }) => (
                <Link
                  href="/admin"
                  className={`${
                    active ? "bg-gray-50" : ""
                  } flex items-center px-4 py-2 text-sm text-gray-700`}
                >
                  <Cog6ToothIcon className="mr-3 h-4 w-4" />
                  Admin Panel
                </Link>
              )}
            </Menu.Item>
            <Menu.Item>
              {({ active }) => (
                <button
                  onClick={() => logout.mutate()}
                  className={`${
                    active ? "bg-red-50" : ""
                  } flex items-center w-full px-4 py-2 text-sm text-red-600`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="mr-3 h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    />
                  </svg>
                  Sign Out
                </button>
              )}
            </Menu.Item>
          </div>
        </Menu.Items>
      </Transition>
    </Menu>
  );
};

export const Header = () => {
  const { data: session } = useSession();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-10 bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center h-16">
          <div className="flex-1 flex items-center">
            <Link href="/" className="flex items-center gap-2">
              <img src="/img/logo.svg" alt="Mira" className="h-8 w-auto" />
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-medium">console</h3>
                <sup
                  className="text-xs font-light text-[#CBD5E1]"
                  style={{ marginLeft: "-8px" }}
                >
                  beta
                </sup>
              </div>
            </Link>
          </div>

          <nav className="hidden md:flex items-center gap-6">
            {session ? (
              <>
                <Link
                  href="/chat"
                  className="text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 px-3 py-2 rounded-md transition-colors"
                >
                  Console
                </Link>
                <Link
                  href="/terminal"
                  className="text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 px-3 py-2 rounded-md transition-colors"
                >
                  Terminal
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/pricing"
                  className="text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 px-3 py-2 rounded-md transition-colors"
                >
                  Pricing
                </Link>
                <Link
                  href="/docs"
                  className="text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 px-3 py-2 rounded-md transition-colors"
                >
                  Documentation
                </Link>
              </>
            )}
          </nav>

          <div className="ml-4 flex items-center gap-2">
            <UserProfile />
            {session && (
              <button
                className="md:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                {isMobileMenuOpen ? (
                  <XMarkIcon className="h-6 w-6" />
                ) : (
                  <Bars3Icon className="h-6 w-6" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {isMobileMenuOpen && session && (
        <div className="md:hidden border-t border-gray-200">
          <div className="px-2 pt-2 pb-3 space-y-1">
            <Link
              href="/chat"
              className="block text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 px-3 py-2 rounded-md"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Console
            </Link>
            <Link
              href="/terminal"
              className="block text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 px-3 py-2 rounded-md"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Terminal
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};
