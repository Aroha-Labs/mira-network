import Link from "next/link";

const Header = () => {
  return (
    <div className="flex flex-wrap items-center justify-between mb-[16px]">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="text-black text-[13px] font-normal leading-[22px] tracking-[-0.156px] opacity-40"
        >
          <span className="underline">console</span>
          <sup className="text-xs font-light text-gray-500">beta</sup>
        </Link>

        <span className="text-md">&gt;</span>

        <p className="text-black text-[13px] font-normal leading-[22px] tracking-[-0.156px]">
          CREDIT HISTORY
        </p>
      </div>
      <div className="flex-grow border-t border-dashed border-[#9CB9AE] mx-4 flex-1 h-[2px]" />
    </div>
  );
};

export default Header;
