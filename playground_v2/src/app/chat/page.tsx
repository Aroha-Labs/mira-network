"use client";

import { useState } from "react";
import ChatSection from "src/components/Chat/ChatSection";
import Header from "src/components/Chat/Header";
import Footer from "src/components/Footer";

const ChatPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="container mx-auto p-4 w-[720px]">
      <Header isModalOpen={isModalOpen} setIsModalOpen={setIsModalOpen} />
      <div className={isModalOpen ? "opacity-40" : ""}>
        <ChatSection />
        <Footer />
      </div>
    </div>
  );
};

export default ChatPage;
