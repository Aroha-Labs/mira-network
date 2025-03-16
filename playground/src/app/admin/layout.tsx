"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Bars4Icon,
  XMarkIcon,
  ChartBarSquareIcon,
  UsersIcon,
  Cog6ToothIcon,
  ComputerDesktopIcon,
} from "@heroicons/react/24/outline";
import { useStore } from "@tanstack/react-store";
import { userRolesState } from "src/state/userRolesState";

const AdminLayout = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const userRoles = useStore(userRolesState, (state) => state);

  const isAdmin = userRoles.includes("admin");

  const navigation = [
    {
      name: "Dashboard",
      href: "/admin",
      icon: ChartBarSquareIcon,
    },
    {
      name: "Users",
      href: "/admin/users",
      icon: UsersIcon,
    },
    {
      name: "Machines",
      href: "/admin/machines",
      icon: ComputerDesktopIcon,
    },
    {
      name: "Settings",
      href: "/admin/settings",
      icon: Cog6ToothIcon,
    },
  ];

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center flex-1 bg-gray-100">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-sm relative">
          <strong className="font-bold">Error: </strong>
          <div>You don&apos;t have permission to access this page</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 bg-gray-100">
      {/* Sidebar for desktop */}
      <aside
        className={`fixed inset-y-0 left-0 transform ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0 transition-transform duration-200 ease-in-out bg-white border-r border-gray-200 w-64 z-50 lg:relative`}
      >
        <div className="flex flex-col h-full">
          <div className="px-4 py-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800">Admin Panel</h2>
            <p className="mt-1 text-sm text-gray-500">Manage your application</p>
          </div>
          <nav className="flex-1 px-2 py-4 space-y-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors ${
                    isActive
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <item.icon
                    className={`h-5 w-5 ${isActive ? "text-blue-600" : "text-gray-400"}`}
                  />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-gray-600 bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden bg-white shadow-xs px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="text-gray-500 hover:text-gray-600"
          >
            {isSidebarOpen ? (
              <XMarkIcon className="h-6 w-6" />
            ) : (
              <Bars4Icon className="h-6 w-6" />
            )}
          </button>
          <h1 className="text-lg font-medium text-gray-900">Admin Panel</h1>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
