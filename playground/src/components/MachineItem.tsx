import { useState } from "react";
import CopyToClipboardIcon from "./CopyToClipboardIcon";
import MetricsModal from "./MetricsModal";

interface MachineProps {
  id: number; // Added id field
  network_ip: string;
  name: string | null;
  description: string | null;
  status: "online" | "offline";
}

const MachineItem = ({ id, network_ip, name, description, status }: MachineProps) => {
  const [showMetrics, setShowMetrics] = useState(false);

  return (
    <div
      className={`bg-white rounded-lg shadow-sm border transition-shadow duration-200 
      ${status === "online" ? "border-gray-200" : "border-gray-200"} hover:shadow-md`}
    >
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {/* Machine Name and Status */}
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-gray-900 truncate">
                {name || "Unnamed Machine"}
              </h3>
              <span
                className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                  status === "online"
                    ? "bg-green-100 text-green-800"
                    : "bg-yellow-100 text-yellow-800"
                }`}
              >
                {status}
              </span>
            </div>

            {/* IP Address with Copy Button */}
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm text-gray-500">{network_ip}</p>
              <CopyToClipboardIcon
                text={network_ip}
                className="w-4 h-4 text-gray-400 hover:text-gray-600"
              />
            </div>

            {/* Description */}
            {description && (
              <p className="text-sm text-gray-600 mt-1 line-clamp-2">{description}</p>
            )}

            {/* Status Indicator */}
            <div className="flex items-center mt-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  status === "online" ? "bg-green-500 animate-pulse" : "bg-yellow-500"
                }`}
              />
              <p
                className={`text-sm ml-2 ${
                  status === "online" ? "text-green-600" : "text-yellow-600"
                }`}
              >
                {status === "online" ? "Active" : "Temporarily Offline"}
              </p>
            </div>
          </div>
        </div>
        <div className="mt-4">
          <button
            onClick={() => setShowMetrics(true)}
            className={`inline-flex items-center px-3 py-1.5 border text-sm font-medium rounded-md 
            ${
              status === "online"
                ? "border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
                : "border-gray-200 text-gray-600 bg-white hover:bg-gray-50"
            } focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
          >
            View Metrics {status === "offline" && "(Historical)"}
          </button>
        </div>
      </div>

      {showMetrics && (
        <MetricsModal
          machineId={id} // Changed from machineIP={network_ip}
          onClose={() => setShowMetrics(false)}
          title={`Metrics for ${name || "Unnamed Machine"} (${network_ip})`}
        />
      )}
    </div>
  );
};

export default MachineItem;
