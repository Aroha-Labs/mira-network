import { useState } from "react";
import {
  Message,
  VerificationRequest,
  VerificationResponse,
  verifyMessages,
} from "src/utils/chat";
import { CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/solid";
import { Spinner } from "./PageLoading";

interface MessageVerificationProps {
  messages: Message[];
  models: string[];
  minYes?: number;
  systemMessage?: string;
}

export const MessageVerification = ({
  messages,
  models,
  minYes: defaultMinYes = 1,
}: MessageVerificationProps) => {
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] =
    useState<VerificationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedModels, setSelectedModels] = useState<string[]>([models[0]]);
  const [minYes, setMinYes] = useState(defaultMinYes);

  const handleVerify = async () => {
    if (selectedModels.length === 0) {
      setError("Please select at least one model");
      return;
    }
    if (minYes > selectedModels.length) {
      setError(
        `Min-yes cannot be greater than selected models (${selectedModels.length})`
      );
      return;
    }
    setIsVerifying(true);
    setError(null);
    try {
      const request: VerificationRequest = {
        messages,
        models: selectedModels,
        min_yes: minYes,
      };
      const result = await verifyMessages(request);
      setVerificationResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setIsVerifying(false);
    }
  };

  const toggleModel = (model: string) => {
    setSelectedModels((prev) =>
      prev.includes(model) ? prev.filter((m) => m !== model) : [...prev, model]
    );
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="flex-none p-6 bg-white border-b border-gray-200">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-600">
              Select Models for Verification
            </div>
            <button
              onClick={handleVerify}
              disabled={isVerifying}
              className="flex items-center px-4 py-2 space-x-2 text-sm text-white bg-blue-600 rounded-lg shadow-xs hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isVerifying ? (
                <>
                  <Spinner className="w-4 h-4" />
                  <span>Verifying...</span>
                </>
              ) : (
                <span>Verify with Selected Models</span>
              )}
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {models.map((model) => (
              <button
                key={model}
                onClick={() => toggleModel(model)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  selectedModels.includes(model)
                    ? "bg-blue-100 text-blue-700 hover:bg-blue-200 shadow-xs"
                    : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                }`}
              >
                {model}
              </button>
            ))}
          </div>

          <div className="flex items-center pt-2 space-x-4">
            <label className="text-sm font-medium text-gray-600">
              Minimum Required Verifications:
            </label>
            <select
              value={minYes}
              onChange={(e) => setMinYes(Number(e.target.value))}
              className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 bg-white text-gray-700 hover:border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {Array.from({ length: selectedModels.length || 1 }, (_, i) => i + 1).map(
                (num) => (
                  <option key={num} value={num}>
                    {num} {num === 1 ? "verification" : "verifications"}
                  </option>
                )
              )}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex-none px-6 py-3 border-b border-red-200 bg-red-50">
          <div className="text-sm text-red-600">{error}</div>
        </div>
      )}

      <div className="flex-1 p-6 overflow-y-auto">
        {verificationResult && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-white border border-gray-200 shadow-xs rounded-xl">
              <div className="font-medium text-gray-900">Overall Verification Status</div>
              <div
                className={`flex items-center px-4 py-2 rounded-lg ${
                  verificationResult.result === "yes"
                    ? "text-green-700 bg-green-50 border border-green-200"
                    : "text-red-700 bg-red-50 border border-red-200"
                }`}
              >
                {verificationResult.result === "yes" ? (
                  <>
                    <CheckCircleIcon className="w-5 h-5 mr-2" />
                    <span className="font-medium">Verified</span>
                  </>
                ) : (
                  <>
                    <XCircleIcon className="w-5 h-5 mr-2" />
                    <span className="font-medium">Not Verified</span>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-3">
              {verificationResult.results.map((result, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-xl bg-white border ${
                    result.result === "yes" ? "border-green-200" : "border-red-200"
                  } shadow-sm`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="px-3 py-1 text-sm font-medium text-gray-900 bg-gray-100 rounded-lg">
                          {result.model}
                        </div>
                        {/* <div className="text-sm text-gray-500">
                          via {result.machine[0].machine_uid}
                        </div> */}
                      </div>
                      <div
                        className={`flex items-center px-3 py-1 rounded-lg text-sm ${
                          result.result === "yes"
                            ? "text-green-700 bg-green-50 border border-green-200"
                            : "text-red-700 bg-red-50 border border-red-200"
                        }`}
                      >
                        {result.result === "yes" ? (
                          <CheckCircleIcon className="w-4 h-4 mr-1.5" />
                        ) : (
                          <XCircleIcon className="w-4 h-4 mr-1.5" />
                        )}
                        <span className="font-medium">{result.result.toUpperCase()}</span>
                      </div>
                    </div>

                    {/* <div className="text-sm text-gray-500">
                      Machine: {result.response.machine_uid}
                    </div> */}

                    <div
                      className={`p-3 rounded-lg text-sm ${
                        result.result === "yes"
                          ? "bg-green-50 text-green-700"
                          : "bg-red-50 text-red-700"
                      }`}
                    >
                      <div className="mb-1 font-medium">Response:</div>
                      <div className="whitespace-pre-wrap">{result.response.content}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
