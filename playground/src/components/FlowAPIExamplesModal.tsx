import React, { useState } from "react";
import {
  XMarkIcon,
  DocumentDuplicateIcon,
  CodeBracketIcon,
} from "@heroicons/react/24/outline";
import { CheckIcon } from "@heroicons/react/24/solid";

interface FlowAPIExamplesModalProps {
  onClose: () => void;
  flowId: string;
  flowName: string;
  variables?: string[];
  tools?: any[];
}

export default function FlowAPIExamplesModal({
  onClose,
  flowId,
  flowName,
  variables = [],
  tools = [],
}: FlowAPIExamplesModalProps) {
  const [activeTab, setActiveTab] = useState<"nodejs" | "python">("nodejs");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCode(type);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // Generate variables object for examples
  const variablesExample = variables.reduce(
    (acc, variable) => {
      acc[variable] = `"your_${variable}_value"`;
      return acc;
    },
    {} as Record<string, string>
  );

  const nodejsExample = `const response = await fetch('${process.env.MIRA_API_BASE_URL || "https://api.mira.com"}/flows/${flowId}/execute', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_API_KEY'
  },
  body: JSON.stringify({
    model: "llama-3.3-70b-instruct",
    messages: [{ role: "user", content: "Hello!" }],${
      variables.length > 0
        ? `
    variables: ${JSON.stringify(variablesExample, null, 4)},`
        : ""
    }
    stream: false
  })
});

const data = await response.json();
console.log(data);`;

  const pythonExample = `import requests

response = requests.post(
    "${process.env.MIRA_API_BASE_URL || "https://api.mira.com"}/flows/${flowId}/execute",
    headers={
        "Content-Type": "application/json",
        "Authorization": "Bearer YOUR_API_KEY"
    },
    json={
        "model": "llama-3.3-70b-instruct",
        "messages": [{"role": "user", "content": "Hello!"}],${
          variables.length > 0
            ? `
        "variables": ${JSON.stringify(variablesExample, null, 8)},`
            : ""
        }
        "stream": False
    }
)

print(response.json())`;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen p-4">
        <div
          className="fixed inset-0 transition-opacity bg-black bg-opacity-50"
          onClick={onClose}
        />

        <div className="relative w-full max-w-4xl mx-auto bg-white rounded-lg shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <CodeBracketIcon className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">API Integration</h2>
                <p className="text-sm text-gray-500">
                  Call "{flowName}" flow programmatically
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 transition-colors rounded-lg hover:text-gray-600 hover:bg-gray-100"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Tabs */}
            <div className="flex p-1 mb-6 space-x-1 bg-gray-100 rounded-lg">
              <button
                onClick={() => setActiveTab("nodejs")}
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === "nodejs"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Node.js
              </button>
              <button
                onClick={() => setActiveTab("python")}
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === "python"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Python
              </button>
            </div>

            {/* Environment Variables Info */}
            <div className="p-4 mb-6 border border-blue-200 rounded-lg bg-blue-50">
              <h3 className="mb-2 text-sm font-medium text-blue-900">Setup</h3>
              <div className="text-sm text-blue-800">
                Replace <code className="px-1 bg-blue-100 rounded">YOUR_API_KEY</code>{" "}
                with your actual API key
              </div>
            </div>

            {/* Flow Details */}
            <div className="grid grid-cols-1 gap-4 mb-6 md:grid-cols-3">
              <div className="p-3 rounded-lg bg-gray-50">
                <div className="text-xs font-medium tracking-wide text-gray-500 uppercase">
                  Flow ID
                </div>
                <div className="mt-1 font-mono text-sm text-gray-900">{flowId}</div>
              </div>

              {variables.length > 0 && (
                <div className="p-3 rounded-lg bg-gray-50">
                  <div className="text-xs font-medium tracking-wide text-gray-500 uppercase">
                    Variables
                  </div>
                  <div className="mt-1 space-y-1">
                    {variables.map((variable, index) => (
                      <div key={index} className="font-mono text-sm text-gray-900">
                        {variable}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {tools.length > 0 && (
                <div className="p-3 rounded-lg bg-gray-50">
                  <div className="text-xs font-medium tracking-wide text-gray-500 uppercase">
                    Tools
                  </div>
                  <div className="mt-1 text-sm text-gray-900">
                    {tools.length} tool(s) configured
                  </div>
                </div>
              )}
            </div>

            {/* Code Examples */}
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-medium text-gray-900">
                  {activeTab === "nodejs" ? "Node.js Example" : "Python Example"}
                </h3>
                <button
                  onClick={() =>
                    copyToClipboard(
                      activeTab === "nodejs" ? nodejsExample : pythonExample,
                      activeTab
                    )
                  }
                  className="flex items-center px-3 py-1.5 text-sm text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                >
                  {copiedCode === activeTab ? (
                    <>
                      <CheckIcon className="w-4 h-4 mr-1.5 text-green-600" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <DocumentDuplicateIcon className="w-4 h-4 mr-1.5" />
                      Copy Code
                    </>
                  )}
                </button>
              </div>

              <div className="relative">
                <pre className="p-4 overflow-x-auto text-sm text-gray-100 bg-gray-900 rounded-lg max-h-96">
                  <code>{activeTab === "nodejs" ? nodejsExample : pythonExample}</code>
                </pre>
              </div>
            </div>

            {/* Additional Notes */}
            <div className="p-4 mt-6 border border-yellow-200 rounded-lg bg-yellow-50">
              <h4 className="mb-2 text-sm font-medium text-yellow-900">Notes</h4>
              <ul className="space-y-1 text-sm text-yellow-800 list-disc list-inside">
                <li>Replace YOUR_API_KEY with your actual API key</li>
                <li>Change the model if needed</li>
                {variables.length > 0 && (
                  <li>Variables required: {variables.join(", ")}</li>
                )}
                <li>Set stream: true for real-time responses</li>
              </ul>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 rounded-b-lg bg-gray-50">
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 transition-colors bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
