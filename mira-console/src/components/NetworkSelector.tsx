import React, { useState } from "react";
import { ChevronDownIcon, XMarkIcon } from "@heroicons/react/24/solid";
import { useStateSelectedProvider } from "../recoil/atoms";

const NetworkSelector = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useStateSelectedProvider();
  const [tempSelectedProvider, setTempSelectedProvider] = useState(
    selectedProvider.name
  );
  const [tempCustomProviderUrl, setTempCustomProviderUrl] = useState(
    selectedProvider.baseUrl || ""
  );
  const [tempCustomProviderApiKey, setTempCustomProviderApiKey] = useState(
    selectedProvider.apiKey || ""
  );
  const [error, setError] = useState("");

  const handleNetworkSelectorClick = () => {
    setIsModalOpen(true);
  };

  const handleProviderChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    setTempSelectedProvider(event.target.value as any);
    setError(""); // Clear error when provider changes
  };

  const validateUrl = (url: string) => {
    const urlPattern = new RegExp(
      "^(https?:\\/\\/)?" + // protocol
        "((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.?)+[a-z]{2,}|" + // domain name
        "((\\d{1,3}\\.){3}\\d{1,3}))" + // OR ip (v4) address
        "(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*" + // port and path
        "(\\?[;&a-z\\d%_.~+=-]*)?" + // query string
        "(\\#[-a-z\\d_]*)?$",
      "i"
    ); // fragment locator
    return !!urlPattern.test(url);
  };

  const validateApiKey = (apiKey: string) => {
    const apiKeyPattern = /^[a-zA-Z0-9-_]{4,}$/; // Minimum 4 characters, alphanumeric, dashes, and underscores allowed
    return apiKeyPattern.test(apiKey);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (tempSelectedProvider === "Mira Network") {
      setSelectedProvider({ name: tempSelectedProvider });
      setIsModalOpen(false);
    } else {
      if (!tempCustomProviderUrl || !tempCustomProviderApiKey) {
        setError("Both Provider Base URL and Provider API Key are required.");
        return;
      }
      if (!validateUrl(tempCustomProviderUrl)) {
        setError("Invalid Provider Base URL.");
        return;
      }
      if (!validateApiKey(tempCustomProviderApiKey)) {
        setError("Invalid Provider API Key.");
        return;
      }
      // Handle custom provider logic here
      console.log("Custom Provider URL:", tempCustomProviderUrl);
      console.log("Custom Provider API Key:", tempCustomProviderApiKey);
      setSelectedProvider({
        name: tempSelectedProvider,
        baseUrl: tempCustomProviderUrl,
        apiKey: tempCustomProviderApiKey,
      });
      setIsModalOpen(false);
    }
  };

  const handleUrlClick = (url: string, api_key?: string) => {
    setTempCustomProviderUrl(url);
    if (api_key) setTempCustomProviderApiKey(api_key);
  };

  return (
    <>
      <button
        onClick={handleNetworkSelectorClick}
        className="text-white text-left"
      >
        <div className="text-xl flex items-center">
          {selectedProvider.name}
          <ChevronDownIcon className="ml-2 h-5 w-5" />
        </div>
        <div className="text-xs text-white opacity-50">
          {selectedProvider.baseUrl}
        </div>
      </button>

      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex justify-center items-center">
          <div className="bg-white p-6 rounded shadow-lg w-11/12 max-w-md relative">
            <button
              className="absolute top-2 right-2 text-gray-600"
              onClick={() => setIsModalOpen(false)}
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
            <h2 className="text-xl mb-4">Choose a LLM Provider</h2>
            <form onSubmit={handleSubmit}>
              <label
                htmlFor="provider-select"
                className="block mb-1 text-sm font-medium text-gray-700"
              >
                Select Provider
              </label>
              <select
                id="provider-select"
                value={tempSelectedProvider}
                onChange={handleProviderChange}
                className="mb-4 p-2 border rounded w-full"
              >
                <option value="Mira Network">Mira Network</option>
                <option value="Custom Provider">Custom Provider</option>
              </select>
              {tempSelectedProvider === "Custom Provider" && (
                <>
                  <label
                    htmlFor="provider-url"
                    className="block mb-1 text-sm font-medium text-gray-700"
                  >
                    Provider Base URL
                  </label>
                  <input
                    id="provider-url"
                    type="text"
                    placeholder="Provider Base URL"
                    value={tempCustomProviderUrl}
                    onChange={(e) => setTempCustomProviderUrl(e.target.value)}
                    className="mb-1 p-2 border rounded w-full"
                    required
                  />
                  <div className="mb-4 flex space-x-2 text-sm">
                    <button
                      type="button"
                      className="text-blue-600 hover:underline"
                      onClick={() =>
                        handleUrlClick("https://api.openai.com/v1")
                      }
                    >
                      OpenAI
                    </button>
                    <button
                      type="button"
                      className="text-blue-600 hover:underline"
                      onClick={() =>
                        handleUrlClick("https://openrouter.ai/api/v1")
                      }
                    >
                      Openrouter
                    </button>
                    <button
                      type="button"
                      className="text-blue-600 hover:underline"
                      onClick={() =>
                        handleUrlClick("http://localhost:11434/v1", "sk-local")
                      }
                    >
                      Ollama
                    </button>
                    <button
                      type="button"
                      className="text-blue-600 hover:underline"
                      onClick={() =>
                        handleUrlClick("https://api.groq.com/openai/v1")
                      }
                    >
                      Groq
                    </button>
                    <button
                      type="button"
                      className="text-blue-600 hover:underline"
                      onClick={() =>
                        handleUrlClick("https://llm.arohalabs.tech/v1")
                      }
                    >
                      ArohaLabs
                    </button>
                  </div>
                  <label
                    htmlFor="provider-api-key"
                    className="block mb-1 text-sm font-medium text-gray-700"
                  >
                    Provider API Key
                  </label>
                  <input
                    id="provider-api-key"
                    type="text"
                    placeholder="Provider API Key"
                    value={tempCustomProviderApiKey}
                    onChange={(e) =>
                      setTempCustomProviderApiKey(e.target.value)
                    }
                    className="mb-4 p-2 border rounded w-full"
                    required
                  />
                  {error && <div className="text-red-500 mb-4">{error}</div>}
                </>
              )}
              <button
                type="submit"
                className="bg-blue-600 text-white p-2 rounded w-full"
              >
                Submit
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default NetworkSelector;
