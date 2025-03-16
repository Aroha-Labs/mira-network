"use client";

import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import * as React from "react";
import { DayPicker } from "react-day-picker";
import { buttonVariants } from "src/components/button";
import { cn } from "src/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker> & {
  customClassNames?: Record<string, string>;
};

export const IconLeft = ({
  className,
  ...props
}: React.SVGProps<SVGSVGElement>) => (
  <CaretLeft className={cn("h-4 w-4", className)} {...props} />
);

export const IconRight = ({
  className,
  ...props
}: React.SVGProps<SVGSVGElement>) => (
  <CaretRight className={cn("h-4 w-4", className)} {...props} />
);

export const Chevron = (props: {
  className?: string;
  size?: number;
  disabled?: boolean;
  orientation?: "up" | "down" | "left" | "right";
}) => {
  if (props.orientation === "left") {
    return <IconLeft {...props} />;
  }
  return <IconRight {...props} />;
};

const Calendar = ({
  className,
  customClassNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) => {
  const defaultClassNames = {
    months:
      "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0 relative",
    month: "space-y-4",
    month_caption: "flex justify-center pt-1 relative items-center",
    caption_label: "text-sm font-medium",
    nav: "space-x-1 flex items-center absolute w-full justify-between z-10",
    button_previous: cn(
      buttonVariants({ variant: "outline" }),
      "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 cursor-pointer"
    ),
    button_next: cn(
      buttonVariants({ variant: "outline" }),
      "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 cursor-pointer"
    ),
    table: "w-full border-collapse space-y-1",
    weekdays: "flex",
    weekday: "text-muted-foreground  w-8 font-normal text-[0.8rem]",
    week: "flex w-full mt-2",
    day_button: cn(
      "relative p-0 cursor-pointer text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent [&:has([aria-selected].day-outside)]:bg-accent/50"
    ),
    day: cn(
      buttonVariants({ variant: "ghost" }),
      "h-8 w-8 p-0 font-normal aria-selected:opacity-100"
    ),
    range_start: "day-range-start",
    range_end: "day-range-end",
    selected:
      "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
    today: "bg-accent text-accent-foreground",
    outside:
      "day-outside text-muted-foreground aria-selected:bg-accent/50 aria-selected:text-muted-foreground",
    disabled: "text-muted-foreground opacity-50",
    range_middle:
      "aria-selected:bg-accent aria-selected:text-accent-foreground",
    hidden: "invisible",
    ...customClassNames,
  };

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={defaultClassNames}
      components={{
        Chevron,
      }}
      {...props}
    />
  );
};

Calendar.displayName = "Calendar";

export default Calendar;
