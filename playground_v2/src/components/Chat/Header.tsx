import Link from "next/link";
import ModelDropdown from "./ModelDropdown";

interface HeaderProps {
  isModalOpen: boolean;
  setIsModalOpen: (isModalOpen: boolean) => void;
  selectedModel: string;
  setSelectedModel: (selectedModel: string) => void;
}

const Header = ({
  isModalOpen,
  setIsModalOpen,
  selectedModel,
  setSelectedModel,
}: HeaderProps) => {
  return (
    <div className="flex flex-wrap items-center justify-between mb-[16px] gap-[16px]">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="font-medium text-[13px] leading-[22px] tracking-[-0.013em] opacity-40"
        >
          <span className="underline">console</span>
          <sup className="text-xs font-light text-gray-500">beta</sup>
        </Link>

        <span className="text-[13px]">&gt;</span>

        <p className="text-[13px] leading-[22px] tracking-[-0.013em]">CHAT</p>
      </div>
      <div className="flex-grow border-t border-dashed border-[#9CB9AE] mx-0 flex-1 h-[2px]" />

      <ModelDropdown
        isModalOpen={isModalOpen}
        setIsModalOpen={setIsModalOpen}
        selectedModel={selectedModel}
        setSelectedModel={setSelectedModel}
      />
    </div>
  );
};

export default Header;
