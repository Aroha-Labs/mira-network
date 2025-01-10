"use client";

import { format, isValid } from "date-fns";
import { CalendarIcon } from "lucide-react";
import * as React from "react";
import { DateRange } from "react-day-picker";

import { Button } from "src/components/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "src/components/popover";
import { cn } from "src/lib/utils";
import Calendar from "./calendar";

interface DatePickerWithRangeProps
  extends React.HTMLAttributes<HTMLDivElement> {
  dateFrom: string;
  dateTo: string;
}

const validateDate = (dateString: string): Date | undefined => {
  const date = new Date(dateString);
  return isValid(date) ? date : undefined;
};

const DatePickerWithRange = ({
  className,
  dateFrom,
  dateTo,
  onChange,
}: DatePickerWithRangeProps) => {
  const initialFrom = validateDate(dateFrom);
  const initialTo = validateDate(dateTo);

  const [date, setDate] = React.useState<DateRange | undefined>({
    from: initialFrom,
    to: initialTo,
  });

  const formattedDate = () => {
    if (date?.from) {
      if (date.to) {
        return `${format(date.from, "LLL dd, y")} - ${format(
          date.to,
          "LLL dd, y"
        )}`;
      }
      return format(date.from, "LLL dd, y");
    }
    return <span>Pick a date</span>;
  };

  const handleDateChange = (date?: DateRange) => {
    setDate(date);
    if (onChange) {
      onChange(date as never);
    }
  };

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-[300px] justify-start text-left font-normal rounded-sm",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon />
            {formattedDate()}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={handleDateChange}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default DatePickerWithRange;
export { DatePickerWithRange };
