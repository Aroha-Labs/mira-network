import { useState } from "react";
import { ToolCall, ToolResponse } from "src/utils/chat";
import ReactMarkdown from "src/components/ReactMarkdown";

interface ToolCallDisplayProps {
  toolCall: ToolCall;
  response?: ToolResponse;
}

export default function ToolCallDisplay({ toolCall, response }: ToolCallDisplayProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-2 border rounded-md overflow-hidden">
      <div
        className="flex items-center justify-between p-2 bg-gray-50 cursor-pointer hover:bg-gray-100"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center space-x-2">
          <span className="font-medium">{toolCall.name}</span>
        </div>
        <button className="text-gray-600 hover:text-gray-800">
          {expanded ? "Hide" : "Show"}
        </button>
      </div>

      {expanded && (
        <div className="p-3 space-y-3">
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-1">Arguments:</h4>
            <pre className="text-sm bg-gray-50 p-2 rounded">
              {JSON.stringify(toolCall.arguments, null, 2)}
            </pre>
          </div>

          {response && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-1">Response:</h4>
              <div className="text-sm bg-gray-50 p-2 rounded">
                <ReactMarkdown>{response.content}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
