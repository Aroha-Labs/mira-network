import Link from "next/link";
import ActiveMachines from "./ActiveMachines";
import NetworkPopover from "./NetworkPopover";
import TotalInferenceCalls from "./TotalInferenceCalls";
import TotalTokens from "./TotalTokens";

const Header = () => {
  return (
    <div className="flex flex-wrap items-center justify-between mb-8 gap-8">
      <div className="flex items-center gap-3 w-full md:w-auto">
        <Link
          href="/"
          className="font-medium text-[13px] leading-[22px] tracking-[-0.013em] opacity-40"
        >
          <span className="underline">console</span>
          <sup className="text-xs font-light text-gray-500">beta</sup>
        </Link>

        <span className="text-[13px] hidden md:block">&gt;</span>

        <p className="text-[13px] leading-[22px] tracking-[-0.013em] hidden md:block">
          NETWORK
        </p>
        <div className="w-full border-t border-dashed border-[#9CB9AE] mx-4 h-[2px] block md:hidden" />

        <div className="block md:hidden">
          <NetworkPopover />
        </div>
      </div>
      <div className="hidden md:flex-grow md:border-t md:border-dashed md:border-[#9CB9AE] md:mx-4 md:flex-1 md:h-[2px]" />

      <div className="md:flex gap-4 items-center hidden">
        <TotalInferenceCalls />
        <TotalTokens />
        <ActiveMachines />
      </div>
    </div>
  );
};

export default Header;
