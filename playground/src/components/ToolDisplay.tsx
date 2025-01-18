import React from "react";

import ReactMarkdown from "react-markdown";
import { ToolCall, ToolResponse } from "src/utils/chat";

interface ToolDisplayProps {
  toolCalls?: ToolCall[];
  toolResponses?: ToolResponse[];
}

const ToolDisplay: React.FC<ToolDisplayProps> = ({ toolCalls, toolResponses }) => {
  if (!toolCalls?.length && !toolResponses?.length) return null;

  const formatArguments = (args: string) => {
    try {
      // If args is already an object, stringify it
      if (typeof args === "object" && args !== null) {
        return JSON.stringify(args, null, 2);
      }

      // If it's a string that looks like JSON, parse and format it
      if (
        typeof args === "string" &&
        (args.trim().startsWith("{") || args.trim().startsWith("["))
      ) {
        const parsed = JSON.parse(args);
        return JSON.stringify(parsed, null, 2);
      }

      // For other types, convert to string
      return String(args);
    } catch (error) {
      console.warn("Error formatting tool arguments:", error);
      // If parsing fails, return the original string
      return String(args);
    }
  };

  const formatResponse = (content: string) => {
    try {
      // Check if the content is markdown (contains markdown formatting)
      if (content.includes("```") || content.includes("**")) {
        return <ReactMarkdown>{content}</ReactMarkdown>;
      }

      // Try parsing as JSON if it looks like JSON
      if (content.trim().startsWith("{") || content.trim().startsWith("[")) {
        const parsed = JSON.parse(content);
        return (
          <pre className="bg-white rounded p-2 overflow-x-auto">
            <code>{JSON.stringify(parsed, null, 2)}</code>
          </pre>
        );
      }

      // Return as plain text
      return content;
    } catch (error) {
      console.warn("Error formatting tool response:", error);
      return content;
    }
  };

  return (
    <div className="flex flex-col gap-2 mt-2">
      {toolCalls?.map((tool) => {
        // Skip incomplete tool calls
        if (!tool.id || !tool.name || !tool.arguments) {
          return null;
        }

        console.log("Rendering tool call:", tool); // Debug log
        return (
          <div key={`${tool.name}-${tool.index}`} className="bg-gray-100 rounded-lg p-4">
            <div className="font-semibold text-sm text-gray-700">
              Tool Call: {tool.name}
            </div>
            <div className="text-xs text-gray-500 mb-2">ID: {tool.id}</div>
            <pre className="mt-2 text-sm bg-white rounded p-2 overflow-x-auto">
              <code>{formatArguments(tool.arguments)}</code>
            </pre>
            {tool.response && (
              <div className="mt-2 text-sm text-gray-600">
                <div className="font-medium mb-1">Response:</div>
                {formatResponse(tool.response)}
              </div>
            )}
          </div>
        );
      })}
      {toolResponses?.map((response, idx) => (
        <div key={idx} className="bg-blue-50 rounded-lg p-4">
          <div className="text-sm text-gray-600">{formatResponse(response.content)}</div>
        </div>
      ))}
    </div>
  );
};

export default ToolDisplay;
