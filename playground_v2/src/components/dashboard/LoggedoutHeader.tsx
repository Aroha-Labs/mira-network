import cn from "clsx";
import { Inter } from "next/font/google";
import Image from "next/image";

const inter = Inter({ subsets: ["latin"] });

const LoggedoutHeader = () => (
  <div className="flex items-center justify-between mb-4">
    <Image src="/img/logo.png" alt="Logo" width={50} height={50} />
    <div className="flex-grow border-t border-dashed border-[#9CB9AE] mx-4 h-[1px]" />
    <span
      className={cn(
        inter.className,
        "text-md font-bold leading-[22px] tracking-[-0.013em] text-[#303030]"
      )}
    >
      console
    </span>
  </div>
);

export default LoggedoutHeader;
