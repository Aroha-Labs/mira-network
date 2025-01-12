import { ApiLog } from "src/hooks/useApiLogs";

const calculateCosts = (log: ApiLog) => {
  if (!log.model_pricing) {
    const totalCost = log.total_tokens * 0.0003;
    return totalCost;
  }

  const promptCost = log.prompt_tokens * log.model_pricing.prompt_token;
  const completionCost =
    log.completion_tokens * log.model_pricing.completion_token;
  return promptCost + completionCost;
};

export default calculateCosts;
