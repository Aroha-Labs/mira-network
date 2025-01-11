"use client";

import { useState } from "react";
import Footer from "src/components/Footer";
import Header from "src/components/networkPage/Header";
import MachinesChart from "src/components/networkPage/MachinesChart";

const NetworkPage = () => {
  const [activeMachine, setActiveMachine] = useState<string>("");

  return (
    <div className="container mx-auto p-4 max-w-fit">
      <Header />
      <MachinesChart
        activeMachine={activeMachine}
        changeActiveMachine={setActiveMachine}
      />
      <Footer />
    </div>
  );
};

export default NetworkPage;
