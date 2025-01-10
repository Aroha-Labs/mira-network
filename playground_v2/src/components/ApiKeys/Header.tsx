import Link from "next/link";

const Header = () => {
  return (
    <div className="flex flex-wrap items-center justify-between mb-8">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="font-medium text-md underline leading-[22px] tracking-[-0.013em] opacity-40"
        >
          playground
        </Link>

        <span className="text-md">&gt;</span>

        <p className="text-md leading-[22px] tracking-[-0.013em]">
          MANAGE API KEYS
        </p>
      </div>
      <div className="flex-grow border-t border-dashed border-[#9CB9AE] mx-4 flex-1 h-[2px]" />
    </div>
  );
};

export default Header;
