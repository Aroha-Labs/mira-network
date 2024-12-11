import { createFileRoute } from "@tanstack/react-router";
import Layout from "../components/Layout";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ROUTER_BASE_URL } from "../config/llm";
import c from "clsx";
import { useModels } from "../hooks/useModels";
import axios from "axios";
import NetworkSelector from "../components/NetworkSelector";
import { useValueSelectedProvider } from "../recoil/atoms";

type VerifyResponse = {
  result: "yes" | "no";
};

// Add error type
type ApiError = {
  detail: string;
};

interface VerifyPromptProps {
  minYes: number;
  prompt: string;
  models: string[];
}

// Modify verifyPrompt to handle non-OK responses
async function verifyPrompt({ prompt, minYes, models }: VerifyPromptProps) {
  try {
    const { data } = await axios.post<VerifyResponse>(
      `${ROUTER_BASE_URL}/v1/verify`,
      {
        stream: false,
        models: models,
        messages: [{ role: "user", content: prompt }],
        min_yes: minYes,
      }
    );
    return data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data) {
      throw new Error((error.response.data as ApiError).detail);
    }
    throw new Error("An unexpected error occurred");
  }
}

const autoResizeTextArea = (element: HTMLTextAreaElement) => {
  element.style.height = "auto";
  element.style.height = element.scrollHeight + "px";
};

export const Route = createFileRoute("/verify")({
  component: RouteComponent,
});

// In RouteComponent, add error state
function RouteComponent() {
  const [input, setInput] = useState("");
  const [minYes, setMinYes] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const { data: models, isLoading } = useModels();
  const selectedProvider = useValueSelectedProvider();

  // Update mutation with better error handling
  const mutation = useMutation({
    mutationFn: verifyPrompt,
    onError: (error) => {
      setError(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (selectedProvider.name !== "Mira Network") {
      setError(
        "Please select Mira Network provider to verify queries and messages"
      );
      return;
    }

    mutation.mutate({
      prompt: input,
      minYes,
      models: selectedModels,
    });
  };

  // Add error display to JSX
  return (
    <Layout headerLeft={<NetworkSelector />}>
      <main
        className="flex flex-col flex-grow p-4 gap-2 sm:container sm:mx-auto"
        style={{ maxWidth: 900 }}
      >
        {(mutation.error || error) && (
          <div className="p-4 mb-4 text-red-700 bg-red-100 rounded-lg">
            {mutation.error?.message || error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="models"
              className="block text-sm font-medium text-gray-300"
            >
              Select Models
            </label>
            <select
              multiple
              id="models"
              value={selectedModels}
              onChange={(e) => {
                const selected = Array.from(
                  e.target.selectedOptions,
                  (option) => option.value
                );
                setSelectedModels(selected);
              }}
              className="mt-1 block w-full max-w-sm rounded-md border border-gray-700 bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-3 text-gray-200"
            >
              {isLoading ? (
                <option disabled>Loading models...</option>
              ) : (
                models?.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.id}
                  </option>
                ))
              )}
            </select>
          </div>
          <div>
            <label
              htmlFor="min-yes"
              className="block text-sm font-medium text-gray-300"
            >
              Minimum Positive consensus
            </label>
            <input
              type="number"
              id="min-yes"
              min="1"
              value={minYes}
              onChange={(e) => setMinYes(Number(e.target.value))}
              className="mt-1 block max-w-xl rounded-md border border-gray-700 bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-3 text-gray-200"
            />
          </div>
          <div>
            <label
              htmlFor="input"
              className="block text-sm font-medium text-gray-300"
            >
              Verification Input
            </label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="w-full h-32 p-2 border border-gray-700 bg-gray-800 rounded text-gray-200"
              placeholder="Enter verification input..."
              ref={(el) => {
                if (el) autoResizeTextArea(el);
              }}
            />
          </div>
          <div className="flex justify-start gap-2">
            <button
              type="submit"
              disabled={mutation.isPending || !input}
              className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
            >
              {mutation.isPending ? "Verifying..." : "Verify"}
            </button>
          </div>
        </form>

        {mutation.data && (
          <div
            className={`mt-4 p-4 rounded ${
              mutation.data.result === "yes" ? "bg-green-100" : "bg-red-100"
            }`}
          >
            Result:{" "}
            <span
              className={c(
                "font-bold",
                mutation.data.result === "yes"
                  ? "text-green-700"
                  : "text-red-700"
              )}
            >
              {mutation.data.result === "yes" ? "Valid ✅" : "Invalid ❌"}
            </span>
          </div>
        )}

        {/* Add after the form and result display */}
        <div className="mt-8 p-6 bg-gray-800 rounded-lg border border-gray-700">
          <h3 className="text-lg font-semibold mb-1 text-gray-200">
            Verify Prompt Examples
          </h3>
          <p className="text-gray-500 mb-6 text-sm">
            Below are examples of how to structure your prompts. Follow the Do's
            for effective prompts and avoid the Don'ts.
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-green-400 font-medium mb-2 flex items-center">
                <svg
                  className="w-5 h-5 mr-2"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                Do's
              </h4>
              <p className="text-gray-500 mb-4 text-sm">
                These are examples of well-structured statements that provide
                clear and direct information.
              </p>
              <ul className="space-y-2">
                <li className="p-2 bg-gray-700 rounded text-gray-200">
                  Delhi is capital of India
                </li>
                <li className="p-2 bg-gray-700 rounded text-gray-200">
                  Earth has one moon
                </li>
                <li className="p-2 bg-gray-700 rounded text-gray-200">
                  Water boils at 100 degrees Celsius
                </li>
                <li className="p-2 bg-gray-700 rounded text-gray-200">
                  1 + 1 = 2
                </li>
                <li className="p-2 bg-gray-700 rounded text-gray-200">
                  The square root of 9 is 3
                </li>
                <li className="p-2 bg-gray-700 rounded text-gray-200">
                  The capital of France is Paris
                </li>
                <li className="p-2 bg-gray-700 rounded text-gray-200">
                  Which of the following is a fruit?
                  <ul className="list-disc list-inside ml-4">
                    <li>Apple</li>
                    <li>Carrot</li>
                    <li>Broccoli</li>
                  </ul>
                  Answer: Apple
                </li>
                <li className="p-2 bg-gray-700 rounded text-gray-200">
                  What is the largest planet in our solar system?
                  <ul className="list-disc list-inside ml-4">
                    <li>Earth</li>
                    <li>Mars</li>
                    <li>Jupiter</li>
                    <li>Saturn</li>
                  </ul>
                  Answer: Jupiter
                </li>
                <li className="p-2 bg-gray-700 rounded text-gray-200">
                  Which element has the chemical symbol 'O'?
                  <ul className="list-disc list-inside ml-4">
                    <li>Oxygen</li>
                    <li>Gold</li>
                    <li>Silver</li>
                    <li>Iron</li>
                  </ul>
                  Answer: Oxygen
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-red-400 font-medium mb-2 flex items-center">
                <svg
                  className="w-5 h-5 mr-2"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                Don'ts
              </h4>
              <p className="text-gray-500 mb-4 text-sm">
                Avoid these types of prompts as they are incomplete, unclear, or
                in question form.
              </p>
              <ul className="space-y-2">
                <li className="p-2 bg-gray-700 rounded text-gray-200">
                  Which city is capital of India?
                </li>
                <li className="p-2 bg-gray-700 rounded text-gray-200">
                  How many moons earth has?
                </li>
                <li className="p-2 bg-gray-700 rounded text-gray-200">
                  What is water's boiling point?
                </li>
                <li className="p-2 bg-gray-700 rounded text-gray-200">
                  What is 1 + 1?
                </li>
                <li className="p-2 bg-gray-700 rounded text-gray-200">
                  Calculate the square root of 9
                </li>
                <li className="p-2 bg-gray-700 rounded text-gray-200">
                  What is the capital of France?
                </li>
                <li className="p-2 bg-gray-700 rounded text-gray-200">
                  Which of the following is a fruit?
                  <ul className="list-disc list-inside ml-4">
                    <li>Apple</li>
                    <li>Carrot</li>
                    <li>Broccoli</li>
                    <li>None of the above</li>
                  </ul>
                </li>
                <li className="p-2 bg-gray-700 rounded text-gray-200">
                  What is the largest planet in our solar system?
                  <ul className="list-disc list-inside ml-4">
                    <li>Earth</li>
                    <li>Mars</li>
                    <li>Jupiter</li>
                    <li>Saturn</li>
                  </ul>
                </li>
                <li className="p-2 bg-gray-700 rounded text-gray-200">
                  Which element has the chemical symbol 'O'?
                  <ul className="list-disc list-inside ml-4">
                    <li>Oxygen</li>
                    <li>Gold</li>
                    <li>Silver</li>
                    <li>Iron</li>
                  </ul>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>
      <div className="mt-32">&nbsp;</div>
    </Layout>
  );
}
