import { useState } from "react";
import { ApiLog } from "src/types/api-log";

const TokenCell = ({ log }: { log: ApiLog }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="relative px-4 py-2"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span className="border-b border-dotted border-gray-400">
        {log.total_tokens}
      </span>
      {isHovered && (
        <div className="absolute z-10 bg-gradient-to-b from-gray-50 to-white border shadow-lg rounded-md p-3 text-sm w-48 top-1/2 right-full mr-2 transform -translate-y-1/2">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Prompt:</span>
              <span>{log.prompt_tokens}</span>
            </div>
            <div className="flex justify-between">
              <span>Completion:</span>
              <span>{log.completion_tokens}</span>
            </div>
            <div className="border-t pt-2 flex justify-between font-medium">
              <span>Total:</span>
              <span>{log.total_tokens}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TokenCell;
