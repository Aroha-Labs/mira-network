import Link from "next/link";
import { DatePickerWithRange } from "src/components/Calendar";

const Header = ({
  startDate,
  endDate,
}: {
  startDate?: string;
  endDate?: string;
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between mb-8">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="font-medium text-md underline leading-[22px] tracking-[-0.013em] opacity-40"
        >
          console
        </Link>

        <span className="text-md">&gt;</span>

        <p className="text-md leading-[22px] tracking-[-0.013em]">API LOGS</p>
      </div>
      <div className="flex-grow border-t border-dashed border-[#9CB9AE] mx-4 flex-1 h-[2px]" />

      <DatePickerWithRange dateFrom={startDate ?? ""} dateTo={endDate ?? ""} />
    </div>
  );
};

export default Header;
