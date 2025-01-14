"use client";

import ApiKeyTable from "src/components/ApiKeys/ApiKeyTable";
import Header from "src/components/ApiKeys/Header";
import Footer from "src/components/Footer";

const ApiKeysPage = () => {
  return (
    <div className="container mx-auto p-4 w-[720px]">
      <Header />
      <ApiKeyTable />
      <Footer />
    </div>
  );
};

export default ApiKeysPage;
