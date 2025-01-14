import { useStore } from "@tanstack/react-store";
import { format } from "date-fns";
import Link from "next/link";
import { DatePickerWithRange } from "src/components/Calendar";
import { apiLogsParamsState } from "src/state/apiLogsParamsState";

const Header = ({
  startDate,
  endDate,
  onOpenChange,
}: {
  startDate?: string;
  endDate?: string;
  onOpenChange?: (open: boolean) => void;
}) => {
  const params = useStore(apiLogsParamsState, (state) => state);

  return (
    <div className="flex flex-wrap items-center justify-between mb-[16px]">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="text-black text-[13px] font-normal font-medium leading-[22px] tracking-[-0.156px] opacity-40"
        >
          <span className="underline">console</span>
          <sup className="text-xs font-light text-gray-500">beta</sup>
        </Link>

        <span className="text-md">&gt;</span>

        <p className="text-black text-[13px] font-normal font-medium leading-[22px] tracking-[-0.156px]">
          API LOGS
        </p>
      </div>
      <div className="flex-grow border-t border-dashed border-[#9CB9AE] mx-4 flex-1 h-[2px]" />

      <DatePickerWithRange
        dateFrom={startDate ?? ""}
        dateTo={endDate ?? ""}
        onChange={(date) => {
          if (date.from && date.to) {
            apiLogsParamsState.setState(() => ({
              ...params,
              startDate: format(date.from ?? new Date(), "yyyy-MM-dd"),
              endDate: format(date.to ?? new Date(), "yyyy-MM-dd"),
            }));
          }
        }}
        onOpenChange={onOpenChange}
      />
    </div>
  );
};

export default Header;
