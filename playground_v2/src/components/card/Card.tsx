import { FC, ReactNode } from "react";
import { cn } from "src/lib/utils";

interface CardProps {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

const Card: FC<CardProps> = ({ children, className, contentClassName }) => {
  return (
    <div
      className={cn(
        "relative bg-white p-[12px] w-full border border-[#306E564F]",
        className
      )}
    >
      <div className="absolute top-3 left-3 w-[6px] h-[6px] bg-[#D7E2DE]"></div>
      <div className="absolute top-3 right-3 w-[6px] h-[6px] bg-[#D7E2DE]"></div>
      <div className="absolute bottom-3 left-3 w-[6px] h-[6px] bg-[#D7E2DE]"></div>
      <div className="absolute bottom-3 right-3 w-[6px] h-[6px] bg-[#D7E2DE]"></div>

      <div className={cn("max-h-96 overflow-y-auto", contentClassName)}>
        {children}
      </div>
    </div>
  );
};

export default Card;
