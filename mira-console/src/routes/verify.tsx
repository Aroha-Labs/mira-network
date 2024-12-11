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
      <main className="flex flex-col flex-grow p-4 gap-2 sm:container sm:mx-auto">
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
              className="mt-1 block max-w-xl rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-3"
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
              className="mt-1 block max-w-xl rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-3"
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
              className="w-full h-32 p-2 border rounded"
              placeholder="Enter verification input..."
            />
          </div>
          <div className="flex justify-end gap-2">
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
                "font-bold uppercase",
                mutation.data.result === "yes"
                  ? "text-green-700"
                  : "text-red-700"
              )}
            >
              {mutation.data.result}
            </span>
          </div>
        )}
      </main>
    </Layout>
  );
}
