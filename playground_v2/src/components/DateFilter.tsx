interface DateFilterProps {
  startDate?: string;
  endDate?: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
}

const DateFilter: React.FC<DateFilterProps> = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
}) => (
  <div className="mb-4 flex space-x-4">
    <div>
      <label
        htmlFor="start-date"
        className="block text-sm font-medium text-gray-700"
      >
        Start Date
      </label>
      <input
        id="start-date"
        type="date"
        value={startDate ?? ""}
        onChange={(e) => onStartDateChange(e.target.value)}
        className="mt-1 block w-full border border-gray-300 shadow-xs focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
      />
    </div>
    <div>
      <label
        htmlFor="end-date"
        className="block text-sm font-medium text-gray-700"
      >
        End Date
      </label>
      <input
        id="end-date"
        type="date"
        value={endDate ?? ""}
        onChange={(e) => onEndDateChange(e.target.value)}
        className="mt-1 block w-full border border-gray-300 shadow-xs focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
      />
    </div>
  </div>
);

export default DateFilter;
