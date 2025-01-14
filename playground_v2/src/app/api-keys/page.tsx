"use client";

import { useState } from "react";
import ApiKeyTable from "src/components/ApiKeys/ApiKeyTable";
import Header from "src/components/ApiKeys/Header";
import Footer from "src/components/Footer";

const ApiKeysPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="container mx-auto p-4 w-[720px]">
      <Header />
      <div className={isModalOpen ? "opacity-40" : ""}>
        <ApiKeyTable setIsModalOpen={setIsModalOpen} />
        <Footer />
      </div>
    </div>
  );
};

export default ApiKeysPage;
