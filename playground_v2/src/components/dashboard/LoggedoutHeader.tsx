import cn from "clsx";
import Image from "next/image";

const LoggedoutHeader = () => (
  <div className="flex items-center justify-between mb-4">
    <div className="flex items-center">
      <Image src="/img/logo.png" alt="Logo" width={50} height={50} />
      <sup className="text-xs font-light text-gray-500">beta</sup>
    </div>
    <div className="flex-grow border-t border-dashed border-[#9CB9AE] mx-4 h-[1px]" />
    <span
      className={cn(
        "text-md font-bold leading-[22px] tracking-[-0.013em] text-[#303030]"
      )}
    >
      console
    </span>
  </div>
);

export default LoggedoutHeader;
