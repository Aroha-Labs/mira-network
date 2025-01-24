import { forwardRef, ReactNode } from "react";
import { cn } from "src/lib/utils";

interface CardProps {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

// Using forwardRef to pass ref from parent
const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ children, className, contentClassName }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "relative bg-white p-[12px] w-full border border-[#306E564F]",
          className
        )}
      >
        <div className="absolute top-3 left-3 w-[6px] h-[6px] bg-[#D7E2DE] rounded-full "></div>
        <div className="absolute top-3 right-3 w-[6px] h-[6px] bg-[#D7E2DE] rounded-full"></div>
        <div className="absolute bottom-3 left-3 w-[6px] h-[6px] bg-[#D7E2DE] rounded-full"></div>
        <div className="absolute bottom-3 right-3 w-[6px] h-[6px] bg-[#D7E2DE] rounded-full"></div>

        <div className={cn("max-h-96 overflow-y-auto", contentClassName)}>
          {children}
        </div>
      </div>
    );
  }
);

Card.displayName = "Card";

export default Card;
