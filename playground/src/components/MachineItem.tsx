import { useState } from "react";
import CopyToClipboardIcon from "./CopyToClipboardIcon";
import MetricsModal from "./MetricsModal";

interface MachineProps {
  machine_uid: string;
  network_ip: string;
  status: "online" | "offline";
}

const MachineItem = ({ machine_uid, status }: MachineProps) => {
  const [showMetrics, setShowMetrics] = useState(false);

  return (
    <div className="border rounded p-4 mb-4 hover:bg-gray-50">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center">
            <p className="font-bold mr-2">{machine_uid}</p>
            <CopyToClipboardIcon text={machine_uid} />
          </div>
          <p className="text-sm text-gray-600">{status}</p>
          <button
            onClick={() => setShowMetrics(true)}
            className="text-blue-500 hover:text-blue-700 text-sm mt-2"
          >
            View Metrics
          </button>
        </div>
        <div
          className={`w-2 h-2 rounded-full ml-2 ${
            status === "online" ? "bg-green-500 animate-pulse" : "bg-gray-400"
          }`}
        />
      </div>

      {showMetrics && (
        <MetricsModal
          machineId={machine_uid}
          onClose={() => setShowMetrics(false)}
        />
      )}
    </div>
  );
};

export default MachineItem;
