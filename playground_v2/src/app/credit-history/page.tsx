"use client";

import CreditTable from "src/components/CreditsHistory/CreditTable";
import Header from "src/components/CreditsHistory/Header";
import Footer from "src/components/Footer";
import useCreditHistory from "src/hooks/useCreditHistory";

const CreditHistoryPage = () => {
  const { data, error, isLoading } = useCreditHistory();

  console.log("coming in darta", data);

  return (
    <div className="container mx-auto p-4 w-[720px]">
      <Header />
      <div>
        <CreditTable data={data} isLoading={isLoading} error={error} />
        <div className="flex justify-between">
          <Footer />
        </div>
      </div>
    </div>
  );
};

export default CreditHistoryPage;
