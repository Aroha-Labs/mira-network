import { useState } from "react";
import CopyToClipboardIcon from "./CopyToClipboardIcon";
import MetricsModal from "./MetricsModal";

interface MachineProps {
  machine_uid: string;
  network_ip: string;
  status: "online" | "offline";
}

const MachineItem = ({ machine_uid, network_ip, status }: MachineProps) => {
  const [showMetrics, setShowMetrics] = useState(false);

  return (
    <div
      className={`bg-white rounded-lg shadow-sm border transition-shadow duration-200 
      ${status === "online" ? "border-gray-200" : "border-gray-200"} hover:shadow-md`}
    >
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <h3 className="font-medium text-gray-900 truncate">{machine_uid}</h3>
              <CopyToClipboardIcon text={machine_uid} />
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
            <p className="text-sm text-gray-500 mt-1">{network_ip}</p>
            <div className="flex items-center mt-1 space-x-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  status === "online" ? "bg-green-500 animate-pulse" : "bg-yellow-500"
                }`}
              />
              <p
                className={`text-sm ${
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
        <MetricsModal machineId={machine_uid} onClose={() => setShowMetrics(false)} />
      )}
    </div>
  );
};

export default MachineItem;
