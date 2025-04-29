import Link from "next/link";
import { useState, Fragment } from "react";
import {
  Bars3Icon,
  XMarkIcon,
  UserCircleIcon,
  Cog6ToothIcon,
  CommandLineIcon,
  ChatBubbleBottomCenterTextIcon,
} from "@heroicons/react/24/outline";
import { useSession } from "src/hooks/useSession";
import { useLogout } from "src/hooks/useLogout";
import { Menu, Transition } from "@headlessui/react";
import { trackEvent } from "src/lib/mira";

const UserProfile = () => {
  const { data: session, isLoading } = useSession();
  const logout = useLogout();

  const handleSignInClick = () => {
    trackEvent('header_sign_in_click', {
      location: 'header'
    });
  };

  const handleLogoutClick = () => {
    trackEvent('user_logout', {
      location: 'header'
    });
    logout.mutate();
  };

  if (isLoading) {
    return <div className="bg-gray-100 rounded-md h-9 w-9 animate-pulse" />;
  }

  if (!session) {
    return (
      <Link
        href="/login"
        className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        onClick={handleSignInClick}
      >
        Sign in
      </Link>
    );
  }

  return (
    <Menu as="div" className="relative">
      <Menu.Button className="flex items-center gap-2 p-2 text-gray-600 rounded-md hover:text-gray-900 hover:bg-gray-50">
        <UserCircleIcon className="w-6 h-6" />
        <span className="hidden text-sm md:block">
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
        <Menu.Items className="absolute right-0 w-48 mt-2 bg-white border border-gray-200 rounded-md shadow-lg focus:outline-hidden">
          <div className="py-1">
            <Menu.Item>
              {({ active }) => (
                <Link
                  href="/admin"
                  className={`${active ? "bg-gray-50" : ""
                    } flex items-center px-4 py-2 text-sm text-gray-700`}
                >
                  <Cog6ToothIcon className="w-4 h-4 mr-3" />
                  Admin Panel
                </Link>
              )}
            </Menu.Item>
            <Menu.Item>
              {({ active }) => (
                <button
                  onClick={handleLogoutClick}
                  className={`${active ? "bg-red-50" : ""
                    } flex items-center w-full px-4 py-2 text-sm text-red-600`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-4 h-4 mr-3"
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleNavClick = (destination: string) => {
    trackEvent('navigation_click', {
      destination,
      mobile_menu: isMobileMenuOpen
    });
    if (isMobileMenuOpen) {
      setIsMobileMenuOpen(false);
    }
  };

  return (
    <header className="sticky top-0 z-10 bg-white border-b border-gray-200">
      <div className="px-4 mx-auto max-w-7xl sm:px-6">
        <div className="flex items-center h-16">
          <div className="flex items-center flex-1">
            <Link href="/" className="flex items-center gap-2">
              <img src="/img/logo.svg" alt="Mira" className="w-auto h-8" />
              <div className="flex items-center gap-1">
                <h3 className="text-lg font-medium">console</h3>
                <div className="px-1 ml-1 text-xs font-medium text-blue-600 border border-blue-200 rounded-sm bg-blue-50">
                  beta
                </div>
              </div>
            </Link>
          </div>

          <nav className="items-center hidden gap-2 md:flex">
            <Link
              href="/chat"
              onClick={() => handleNavClick('chat')}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 transition-colors rounded-md hover:text-gray-900 hover:bg-gray-50"
            >
              <ChatBubbleBottomCenterTextIcon className="w-5 h-5" />
              Chat
            </Link>
            <Link
              href="/terminal"
              onClick={() => handleNavClick('terminal')}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 transition-colors rounded-md hover:text-gray-900 hover:bg-gray-50"
            >
              <CommandLineIcon className="w-5 h-5" />
              Terminal
            </Link>
          </nav>

          <div className="flex items-center gap-2 ml-4">
            <UserProfile />
            <button
              className="p-2 text-gray-700 rounded-md md:hidden hover:text-gray-900 hover:bg-gray-50"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? (
                <XMarkIcon className="w-5 h-5" />
              ) : (
                <Bars3Icon className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div className="border-t border-gray-200 md:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1">
            <Link
              href="/chat"
              className="inline-flex items-center block gap-2 px-3 py-2 text-sm font-medium text-gray-700 rounded-md hover:text-gray-900 hover:bg-gray-50"
              onClick={() => handleNavClick('chat')}
            >
              <ChatBubbleBottomCenterTextIcon className="w-5 h-5" />
              Chat
            </Link>
            <Link
              href="/terminal"
              className="inline-flex items-center block gap-2 px-3 py-2 text-sm font-medium text-gray-700 rounded-md hover:text-gray-900 hover:bg-gray-50"
              onClick={() => handleNavClick('terminal')}
            >
              <CommandLineIcon className="w-5 h-5" />
              Terminal
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};
