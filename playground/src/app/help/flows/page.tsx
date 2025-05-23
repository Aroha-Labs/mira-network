"use client";

import Link from "next/link";
import {
  ArrowLeftIcon,
  PlayIcon,
  PlusIcon,
  CheckIcon,
} from "@heroicons/react/24/outline";
import { CodeBracketIcon, ChartBarIcon } from "@heroicons/react/24/outline";

export default function FlowsHelpPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl px-6 py-4 mx-auto">
          <div className="flex items-center space-x-4">
            <Link
              href="/"
              className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
            >
              <ArrowLeftIcon className="w-4 h-4 mr-1" />
              Back to Home
            </Link>
            <div className="text-gray-300">|</div>
            <Link
              href="/terminal"
              className="inline-flex items-center text-sm text-indigo-600 hover:text-indigo-800"
            >
              Open Terminal
              <PlayIcon className="w-4 h-4 ml-1" />
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl px-6 py-8 mx-auto">
        {/* Hero Section */}
        <div className="mb-12 text-center">
          <h1 className="mb-4 text-3xl font-bold text-gray-900">
            Getting Started with AI Flows
          </h1>
          <p className="max-w-2xl mx-auto text-lg text-gray-600">
            Learn how to create, configure, and deploy AI workflows using our interactive
            flow builder. Build powerful AI applications with just a few clicks.
          </p>
        </div>

        {/* Quick Start Steps */}
        <div className="mb-12">
          <h2 className="mb-6 text-2xl font-semibold text-gray-900">Quick Start Guide</h2>

          <div className="space-y-8">
            {/* Step 1 */}
            <div className="flex items-start space-x-4">
              <div className="flex items-center justify-center flex-shrink-0 w-8 h-8 text-sm font-medium text-white bg-indigo-600 rounded-full">
                1
              </div>
              <div className="flex-1">
                <h3 className="mb-2 text-lg font-medium text-gray-900">
                  Access the Flow Builder
                </h3>
                <p className="mb-3 text-gray-600">
                  Navigate to the terminal page and access the flow builder interface.
                </p>
                <div className="p-4 bg-gray-100 border-l-4 border-indigo-500 rounded-lg">
                  <p className="text-sm text-gray-700">
                    💡 <strong>Tip:</strong> You can access the flow builder from the home
                    page by clicking "Terminal" or directly at{" "}
                    <code className="px-1 bg-gray-200 rounded">/terminal</code>
                  </p>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex items-start space-x-4">
              <div className="flex items-center justify-center flex-shrink-0 w-8 h-8 text-sm font-medium text-white bg-indigo-600 rounded-full">
                2
              </div>
              <div className="flex-1">
                <h3 className="mb-2 text-lg font-medium text-gray-900">
                  Create a New Flow
                </h3>
                <p className="mb-3 text-gray-600">
                  Click the{" "}
                  <span className="inline-flex items-center px-2 py-1 text-sm text-indigo-800 bg-indigo-100 rounded">
                    <PlusIcon className="w-3 h-3 mr-1" />
                    New Flow
                  </span>{" "}
                  button in the left sidebar to create your first flow.
                </p>
                <div className="p-4 bg-white border border-gray-200 rounded-lg">
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>
                      A new flow will be created with the default name "New Flow"
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex items-start space-x-4">
              <div className="flex items-center justify-center flex-shrink-0 w-8 h-8 text-sm font-medium text-white bg-indigo-600 rounded-full">
                3
              </div>
              <div className="flex-1">
                <h3 className="mb-2 text-lg font-medium text-gray-900">
                  Rename Your Flow
                </h3>
                <p className="mb-3 text-gray-600">
                  Click the edit icon next to the flow name to rename it, then click the{" "}
                  <CheckIcon className="inline w-4 h-4 text-green-600" /> to confirm.
                </p>
                <div className="p-4 border border-yellow-200 rounded-lg bg-yellow-50">
                  <p className="text-sm text-yellow-800">
                    ⚠️ <strong>Remember:</strong> Click "Save Changes" button to persist
                    your flow name and configuration.
                  </p>
                </div>
              </div>
            </div>

            {/* Step 4 */}
            <div className="flex items-start space-x-4">
              <div className="flex items-center justify-center flex-shrink-0 w-8 h-8 text-sm font-medium text-white bg-indigo-600 rounded-full">
                4
              </div>
              <div className="flex-1">
                <h3 className="mb-2 text-lg font-medium text-gray-900">
                  Configure System Prompt
                </h3>
                <p className="mb-3 text-gray-600">
                  Write your system prompt in the "System Prompt" section. Use variables
                  with double curly braces for dynamic content.
                </p>
                <div className="p-4 font-mono text-sm text-gray-100 bg-gray-900 rounded-lg">
                  <div className="text-green-400"># Example System Prompt</div>
                  <div className="mt-2">
                    You are{" "}
                    <span className="px-1 bg-blue-600 rounded">{"{{person}}"}</span>, a
                    helpful assistant who specializes in{" "}
                    <span className="px-1 bg-blue-600 rounded">{"{{domain}}"}</span>.
                    <br />
                    Always respond in a{" "}
                    <span className="px-1 bg-blue-600 rounded">{"{{tone}}"}</span> tone.
                  </div>
                </div>
                <div className="p-4 mt-3 border border-blue-200 rounded-lg bg-blue-50">
                  <p className="text-sm text-blue-800">
                    ✨ <strong>Variables:</strong> When you use{" "}
                    <code>{"{{variable_name}}"}</code>, input fields will automatically
                    appear below the system prompt for you to fill in.
                  </p>
                </div>
              </div>
            </div>

            {/* Step 5 */}
            <div className="flex items-start space-x-4">
              <div className="flex items-center justify-center flex-shrink-0 w-8 h-8 text-sm font-medium text-white bg-indigo-600 rounded-full">
                5
              </div>
              <div className="flex-1">
                <h3 className="mb-2 text-lg font-medium text-gray-900">Add Messages</h3>
                <p className="mb-3 text-gray-600">
                  In the "Messages" section, click "Add Message" to create conversation
                  examples or context.
                </p>
                <div className="space-y-3">
                  <div className="p-3 border border-blue-200 rounded-lg bg-blue-50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="px-2 py-1 text-xs text-blue-700 bg-blue-100 rounded">
                        user
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">
                      What's the weather like today?
                    </p>
                  </div>
                  <div className="p-3 border border-gray-200 rounded-lg bg-gray-50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="px-2 py-1 text-xs text-gray-700 bg-gray-100 rounded">
                        assistant
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">
                      I'd be happy to help you with weather information...
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 6 */}
            <div className="flex items-start space-x-4">
              <div className="flex items-center justify-center flex-shrink-0 w-8 h-8 text-sm font-medium text-white bg-indigo-600 rounded-full">
                6
              </div>
              <div className="flex-1">
                <h3 className="mb-2 text-lg font-medium text-gray-900">
                  Generate Response
                </h3>
                <p className="mb-3 text-gray-600">
                  Fill in any required variables, then click the{" "}
                  <span className="inline-flex items-center px-2 py-1 text-sm text-white bg-indigo-600 rounded">
                    <PlayIcon className="w-3 h-3 mr-1" />
                    Generate
                  </span>{" "}
                  button to get an AI response.
                </p>
                <div className="p-4 border border-green-200 rounded-lg bg-green-50">
                  <p className="text-sm text-green-800">
                    🎉 <strong>Success:</strong> The AI response will appear in the
                    preview panel. You can regenerate, add it to the conversation, or
                    verify the response quality.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Advanced Features */}
        <div className="mb-12">
          <h2 className="mb-6 text-2xl font-semibold text-gray-900">Advanced Features</h2>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* API Integration */}
            <div className="p-6 bg-white border border-gray-200 rounded-lg">
              <div className="flex items-center mb-4 space-x-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <CodeBracketIcon className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-900">API Integration</h3>
              </div>
              <p className="mb-4 text-gray-600">
                Integrate your flows into applications using our REST API. View code
                examples for Node.js and Python.
              </p>
              <div className="p-3 rounded-lg bg-gray-50">
                <code className="text-sm text-gray-700">
                  POST /flows/{"{flow_id}"}/execute
                </code>
              </div>
            </div>

            {/* Analytics */}
            <div className="p-6 bg-white border border-gray-200 rounded-lg">
              <div className="flex items-center mb-4 space-x-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <ChartBarIcon className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-900">Analytics & Metrics</h3>
              </div>
              <p className="mb-4 text-gray-600">
                Monitor your flow performance with detailed metrics including cost, token
                usage, and response times.
              </p>
              <div className="flex space-x-2 text-sm text-gray-500">
                <span>• Token usage</span>
                <span>• Response time</span>
                <span>• Cost tracking</span>
              </div>
            </div>

            {/* Tools */}
            {/* <div className="p-6 bg-white border border-gray-200 rounded-lg">
              <div className="flex items-center mb-4 space-x-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <svg
                    className="w-6 h-6 text-orange-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900">Function Tools</h3>
              </div>
              <p className="mb-4 text-gray-600">
                Extend your AI capabilities by adding custom functions that can be called
                during conversations.
              </p>
              <div className="p-3 rounded-lg bg-gray-50">
                <code className="text-sm text-gray-700">
                  {`{ "type": "function", "function": {...} }`}
                </code>
              </div>
            </div> */}

            {/* Variables */}
            <div className="p-6 bg-white border border-gray-200 rounded-lg">
              <div className="flex items-center mb-4 space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <svg
                    className="w-6 h-6 text-blue-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM21 5a2 2 0 00-2-2h-4a2 2 0 00-2 2v12a4 4 0 004 4h4a2 2 0 002-2V5z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900">Dynamic Variables</h3>
              </div>
              <p className="mb-4 text-gray-600">
                Make your flows flexible by using variables that can be customized for
                different use cases.
              </p>
              <div className="p-3 rounded-lg bg-blue-50">
                <code className="text-sm text-blue-800">
                  You are {"{{role}}"} helping with {"{{task}}"}
                </code>
              </div>
            </div>
          </div>
        </div>

        {/* Best Practices */}
        <div className="mb-12">
          <h2 className="mb-6 text-2xl font-semibold text-gray-900">Best Practices</h2>

          <div className="p-6 bg-white border border-gray-200 rounded-lg">
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg
                    className="w-3 h-3 text-green-600"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">
                    Use Clear, Descriptive Names
                  </h4>
                  <p className="text-sm text-gray-600">
                    Name your flows and variables clearly to make them easy to understand
                    and maintain.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg
                    className="w-3 h-3 text-green-600"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">
                    Test with Sample Conversations
                  </h4>
                  <p className="text-sm text-gray-600">
                    Add example messages to test your flow behavior before deploying to
                    production.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg
                    className="w-3 h-3 text-green-600"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Monitor Performance</h4>
                  <p className="text-sm text-gray-600">
                    Regularly check your flow metrics to optimize cost and response times.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg
                    className="w-3 h-3 text-green-600"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Save Frequently</h4>
                  <p className="text-sm text-gray-600">
                    Remember to save your changes regularly to avoid losing your work.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <div className="p-8 text-white rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600">
            <h2 className="mb-4 text-2xl font-bold">Ready to Build Your First Flow?</h2>
            <p className="max-w-2xl mx-auto mb-6 text-indigo-100">
              Start creating powerful AI workflows today. Our intuitive interface makes it
              easy to build, test, and deploy AI applications.
            </p>
            <Link
              href="/terminal"
              className="inline-flex items-center px-6 py-3 font-medium text-indigo-600 transition-colors bg-white rounded-lg hover:bg-gray-50"
            >
              Open Terminal
              <PlayIcon className="w-5 h-5 ml-2" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
