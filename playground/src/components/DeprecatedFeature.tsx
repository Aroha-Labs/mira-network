"use client";

import { ExclamationTriangleIcon, ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";

interface DeprecatedFeatureProps {
  title: string;
  description: string;
  alternative?: {
    name: string;
    url: string;
    description: string;
  };
}

export const DeprecatedFeature = ({ title, description, alternative }: DeprecatedFeatureProps) => {
  return (
    <div className="flex items-center justify-center min-h-[60vh] p-6">
      <div className="max-w-lg w-full bg-white rounded-xl border border-amber-200 shadow-sm p-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-amber-100 rounded-lg">
            <ExclamationTriangleIcon className="w-6 h-6 text-amber-600" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        </div>

        <p className="text-gray-600 mb-6">{description}</p>

        {alternative && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-blue-900 mb-2">
              Use {alternative.name} instead
            </h3>
            <p className="text-sm text-blue-700 mb-3">{alternative.description}</p>
            <a
              href={alternative.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Open {alternative.name}
              <ArrowTopRightOnSquareIcon className="w-4 h-4" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeprecatedFeature;
