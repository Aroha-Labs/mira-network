"use client";

import { WrenchScrewdriverIcon } from "@heroicons/react/24/outline";

const AdminDashboard = () => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-4 py-5 sm:p-6 text-center">
        <div className="flex flex-col items-center justify-center py-12">
          <WrenchScrewdriverIcon className="h-16 w-16 text-blue-500 mb-4" />
          <h3 className="text-xl font-medium text-gray-900 mb-2">
            Dashboard Under Construction
          </h3>
          <p className="text-gray-500 max-w-md">
            We&apos;re working on building an amazing admin dashboard. Check back soon for
            new features and insights.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
