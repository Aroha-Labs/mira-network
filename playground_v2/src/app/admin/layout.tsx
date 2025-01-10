"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Bars4Icon, XMarkIcon } from "@heroicons/react/24/outline";
import { useStore } from "@tanstack/react-store";
import { userRolesState } from "src/state/userRolesState";

const AdminLayout = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const userRoles = useStore(userRolesState, (state) => state);

  const isAdmin = userRoles.includes("admin");

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center flex-1 bg-gray-100">
        <div
          className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative"
          role="alert"
        >
          <strong className="font-bold">Error: </strong>
          <div>You don&apos;t have permission to access this page</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 bg-gray-100">
      <aside
        className={`fixed inset-y-0 left-0 transform ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        } transition-transform duration-200 ease-in-out bg-gray-800 text-white w-64 z-50 lg:relative lg:translate-x-0`}
      >
        <div className="p-4 text-center text-2xl font-bold border-b border-gray-700">
          Admin Panel
        </div>
        <nav className="p-4">
          <ul className="space-y-2">
            <li className={pathname === "/admin" ? "font-bold" : ""}>
              <Link
                href="/admin"
                className="block p-2 rounded hover:bg-gray-700"
              >
                Dashboard
              </Link>
            </li>
            <li className={pathname === "/admin/users" ? "font-bold" : ""}>
              <Link
                href="/admin/users"
                className="block p-2 rounded hover:bg-gray-700"
              >
                Users
              </Link>
            </li>
            <li className={pathname === "/admin/settings" ? "font-bold" : ""}>
              <Link
                href="/admin/settings"
                className="block p-2 rounded hover:bg-gray-700"
              >
                Settings
              </Link>
            </li>
          </ul>
        </nav>
      </aside>
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}
      <div className="flex-1">
        <header className="bg-white shadow-md p-4 flex items-center justify-between lg:hidden">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="text-gray-500 hover:text-gray-700"
          >
            {isSidebarOpen ? (
              <XMarkIcon className="h-6 w-6" />
            ) : (
              <Bars4Icon className="h-6 w-6" />
            )}
          </button>
          {/* <h1 className="text-xl font-bold">Admin Panel</h1> */}
        </header>
        <main className="container mx-auto">{children}</main>
      </div>
    </div>
  );
};

export default AdminLayout;
