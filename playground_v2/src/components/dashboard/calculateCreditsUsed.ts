import { CreditHistory } from "src/hooks/useUserCredits";

const calculatePercentageUsed = (history: CreditHistory[]): number => {
  try {
    if (!history || history.length === 0) return 0;

    const totalCredits = history.reduce((acc, record) => {
      return record.amount > 0 ? acc + record.amount : acc;
    }, 0);

    const totalDebits = history.reduce((acc, record) => {
      return record.amount < 0 ? acc + Math.abs(record.amount) : acc;
    }, 0);

    if (totalCredits === 0) return 0;

    return Number(((totalDebits / totalCredits) * 100).toFixed(2));
  } catch (error) {
    console.error("Error calculating percentage used: ", error);
    return 0;
  }
};

export default calculatePercentageUsed;
