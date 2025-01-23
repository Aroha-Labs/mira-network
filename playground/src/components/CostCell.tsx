import { useState } from "react";
import { ApiLog } from "src/types/api-log";

const CostCell = ({ log }: { log: ApiLog }) => {
  const [isHovered, setIsHovered] = useState(false);

  const calculateCosts = () => {
    if (!log.model_pricing) {
      const totalCost = log.total_tokens * 0.0003;
      return {
        promptCost: totalCost / 2,
        completionCost: totalCost / 2,
        total: totalCost,
      };
    }

    const promptCost = log.prompt_tokens * log.model_pricing.prompt_token;
    const completionCost = log.completion_tokens * log.model_pricing.completion_token;
    return {
      promptCost,
      completionCost,
      total: promptCost + completionCost,
    };
  };

  const costs = calculateCosts();

  return (
    <div
      className="relative px-4 py-2"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span className="border-b border-dotted border-gray-400">
        ${costs.total.toFixed(3)}
      </span>
      {isHovered && (
        <div className="absolute z-10 bg-gradient-to-b from-gray-50 to-white border shadow-lg rounded-md p-3 text-sm w-48 top-1/2 right-full mr-2 transform -translate-y-1/2">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Prompt:</span>
              <span>${costs.promptCost.toFixed(5)}</span>
            </div>
            <div className="flex justify-between">
              <span>Completion:</span>
              <span>${costs.completionCost.toFixed(5)}</span>
            </div>
            <div className="border-t pt-2 flex justify-between font-medium">
              <span>Total:</span>
              <span>${costs.total.toFixed(5)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CostCell;
