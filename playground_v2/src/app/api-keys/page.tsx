"use client";

import ApiKeyTable from "src/components/ApiKeys/ApiKeyTable";
import Header from "src/components/ApiKeys/Header";
import Footer from "src/components/Footer";
import { ApiKey } from "src/hooks/useApiTokens";

const ApiKeysPage = () => {
  const handleRowClick = (key: ApiKey) => {
    console.log(key);
  };

  return (
    <div className="container mx-auto p-4 max-w-fit">
      <Header />
      <ApiKeyTable onRowClick={handleRowClick} />
      <Footer />
    </div>
  );
};

export default ApiKeysPage;
