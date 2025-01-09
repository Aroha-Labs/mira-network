import { FC, ReactNode } from "react";
import { cn } from "src/lib/utils";

interface CardProps {
  children: ReactNode;
  className?: string;
}

const Card: FC<CardProps> = ({ children, className }) => {
  return (
    <div
      className={cn(
        "relative bg-white p-4 w-full border border-[#306E564F]",
        className
      )}
    >
      <div className="absolute top-3 left-3 w-[6px] h-[6px] bg-[#D7E2DE] rounded-full"></div>
      <div className="absolute top-3 right-3 w-[6px] h-[6px] bg-[#D7E2DE] rounded-full"></div>
      <div className="absolute bottom-3 left-3 w-[6px] h-[6px] bg-[#D7E2DE] rounded-full"></div>
      <div className="absolute bottom-3 right-3 w-[6px] h-[6px] bg-[#D7E2DE] rounded-full"></div>
      {children}
    </div>
  );
};

export default Card;
