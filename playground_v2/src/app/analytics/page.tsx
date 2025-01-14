"use client";

import { useStore } from "@tanstack/react-store";
import { useEffect, useState } from "react";
import Chart from "src/components/Analytics/Chart";
import Header from "src/components/Analytics/Header";
import Footer from "src/components/Footer";
import {
  apiLogsParamsState,
  DEFAULT_PARAMS,
} from "src/state/apiLogsParamsState";

const NetworkPage = () => {
  const params = useStore(apiLogsParamsState, (state) => state);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    apiLogsParamsState.setState(() => DEFAULT_PARAMS);
  }, []);

  return (
    <div className="container mx-auto p-4 w-[720px]">
      <Header
        startDate={params.startDate}
        endDate={params.endDate}
        onOpenChange={setIsModalOpen}
      />
      <div className={isModalOpen ? "opacity-50" : ""}>
        <Chart />
        <Footer />
      </div>
    </div>
  );
};

export default NetworkPage;
