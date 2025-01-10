"use client";

import ApiKeyTable from "src/components/ApiKeys/ApiKeyTable";
import Header from "src/components/ApiKeys/Header";
import Footer from "src/components/Footer";

const ApiKeysPage = () => {
  return (
    <div className="container mx-auto p-4 max-w-fit">
      <Header />
      <ApiKeyTable />
      <Footer />
    </div>
  );
};

export default ApiKeysPage;
