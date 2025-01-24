import React, { useEffect, useState } from "react";
import { XCircleIcon, DocumentCheckIcon } from "@heroicons/react/24/outline";
import c from "clsx";
import AutoGrowTextarea from "./AutoGrowTextarea";
import { API_BASE_URL } from "../config";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";

interface SystemPromptInputProps {
  onChange: (formattedPrompt: string) => void;
}

export default function SystemPromptInput({ onChange }: SystemPromptInputProps) {
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [variables, setVariables] = useState<{ [key: string]: string }>({});
  const [systemPrompt, setSystemPrompt] = useState("");
  const [flowName, setFlowName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const variableMatches = systemPrompt.match(/{{(.*?)}}/g);
    if (variableMatches) {
      const oldVars = { ...variables };
      const vars = variableMatches.reduce(
        (acc, match) => {
          const varName = match.replace(/{{|}}/g, "").trim();
          acc[varName] = oldVars[varName] || "";
          return acc;
        },
        {} as { [key: string]: string }
      );
      setVariables(vars);
    } else {
      setVariables({});
    }
  }, [systemPrompt]);

  const saveFlowMutation = useMutation({
    mutationFn: async () => {
      const response = await axios.post(`${API_BASE_URL}/flows`, {
        name: flowName,
        system_prompt: systemPrompt,
      });

      if (response.status !== 200) {
        throw new Error("Failed to save flow");
      }

      return response.data;
    },
    onSuccess: () => {
      console.log("Flow saved successfully");
    },
    onError: (error) => {
      console.error("Error saving flow:", error);
      setError("Failed to save flow. Please try again.");
    },
  });

  const handleSaveFlow = () => {
    if (!flowName.trim() || !systemPrompt.trim()) {
      setError("Flow name & prompt are required.");
      return;
    }
    setError("");
    saveFlowMutation.mutate();
  };

  const toggleFormVisibility = () => {
    setIsFormVisible(!isFormVisible);
  };

  const handleVariableChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>,
    varName: string
  ) => {
    const newVariables = {
      ...variables,
      [varName]: e.target.value,
    };
    setVariables(newVariables);

    const formattedPrompt = systemPrompt.replace(/{{(.*?)}}/g, (_, varName) => {
      return newVariables[varName.trim()] || `{{${varName.trim()}}}`;
    });

    onChange(formattedPrompt);
  };

  const handleSystemPromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setSystemPrompt(e.target.value);
    const formattedPrompt = e.target.value.replace(/{{(.*?)}}/g, (_, v) => {
      return variables[v.trim()] || `{{${v.trim()}}}`;
    });
    onChange(formattedPrompt);
  };

  return (
    <div className="w-full p-4">
      <div className="max-w-2xl p-4 mx-auto bg-white shadow-md rounded-lg relative">
        <button
          className={c(
            "text-blue-500 focus:outline-none",
            isFormVisible ? "absolute top-4 right-4" : ""
          )}
          onClick={toggleFormVisibility}
        >
          {isFormVisible ? (
            <XCircleIcon className=" h-6 w-6" />
          ) : systemPrompt ? (
            "Update system prompt"
          ) : (
            "Add system prompt"
          )}
        </button>
        {isFormVisible && (
          <>
            <label
              htmlFor="flowName"
              className="block text-md font-medium text-gray-700 mt-4"
            >
              Name
            </label>
            <input
              id="flowName"
              className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
              value={flowName}
              onChange={(e) => setFlowName(e.target.value)}
              placeholder="Flow name..."
              disabled={saveFlowMutation.isPending}
            />
            <label
              htmlFor="systemPrompt"
              className="block text-md font-medium text-gray-700"
            >
              System prompt
            </label>
            <AutoGrowTextarea
              id="systemPrompt"
              className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none mt-1"
              value={systemPrompt}
              onChange={handleSystemPromptChange}
              placeholder="System prompt... (Shift+Enter for new line)"
              disabled={saveFlowMutation.isPending}
            />
            {error && <div className="text-red-500 text-sm mt-2">{error}</div>}
            <div className="flex justify-end mt-2">
              <button
                className="bg-blue-500 text-white py-1 px-2 rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center gap-2"
                onClick={handleSaveFlow}
                disabled={saveFlowMutation.isPending}
              >
                <DocumentCheckIcon className="h-4 w-4" />
                {saveFlowMutation.isPending ? "Saving..." : "Save flow"}
              </button>
            </div>
          </>
        )}

        {Object.keys(variables).length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-gray-700">Flow data</h3>
            {Object.keys(variables).map((varName) => (
              <div key={varName} className="flex items-start mt-2">
                <label
                  htmlFor={varName}
                  className="block text-sm font-medium text-gray-700 mr-2 mt-1"
                >
                  {varName}
                </label>
                <AutoGrowTextarea
                  id={varName}
                  className="flex-1 border border-gray-300 p-1 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  value={variables[varName]}
                  onChange={(e) => handleVariableChange(e, varName)}
                  disabled={saveFlowMutation.isPending}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
