"use client";

import Footer from "src/components/Footer";
import Header from "src/components/Verify/Header";
import VerifySection from "src/components/Verify/VerifySection";

const VerifyPage = () => {
  return (
    <div className="container mx-auto p-4 w-full max-w-5xl">
      <Header />
      <VerifySection />
      <Footer />
    </div>
  );
};

export default VerifyPage;
