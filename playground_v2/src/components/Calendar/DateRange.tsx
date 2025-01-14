"use client";

import { CaretDown } from "@phosphor-icons/react";
import { format, isValid } from "date-fns";
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

interface DatePickerWithRangeProps {
  dateFrom: string;
  dateTo: string;
  onChange: (date: DateRange) => void;
  className?: string;
}

const validateDate = (dateString: string): Date | undefined => {
  const date = new Date(dateString);
  return isValid(date) ? date : undefined;
};

interface DatePickerWithRangeProps {
  dateFrom: string;
  dateTo: string;
  onChange: (date: DateRange) => void;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

const DatePickerWithRange = ({
  className,
  dateFrom,
  dateTo,
  onChange,
  onOpenChange,
}: DatePickerWithRangeProps) => {
  const [open, setOpen] = React.useState(false);
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

  const handleOpenChange = (open: boolean) => {
    setOpen(open);
    if (onOpenChange) {
      onOpenChange(open);
    }
  };

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant="ghost"
            className={cn(
              "justify-start text-left text-black text-[13px] p-0 m-0 font-normal font-medium leading-[22px] tracking-[-0.156px] underline opacity-60 h-fit",
              !date && "text-muted-foreground"
            )}
          >
            {formattedDate()}
            <CaretDown />
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
