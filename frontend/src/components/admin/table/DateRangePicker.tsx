import React from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

export interface DateRangeValue {
  startDate: Date | null;
  endDate: Date | null;
}

export interface DateRangePickerProps {
  startDate: Date | null;
  endDate: Date | null;
  onChange: (range: DateRangeValue) => void;
  label?: string;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  startDate,
  endDate,
  onChange,
  label,
}) => {
  const [conflict, setConflict] = React.useState(false);

  const handleStartChange = (date: Date | null) => {
    if (date && endDate && date > endDate) {
      setConflict(true);
      onChange({ startDate: date, endDate: null });
    } else {
      setConflict(false);
      onChange({ startDate: date, endDate });
    }
  };

  const handleEndChange = (date: Date | null) => {
    if (date && startDate && date < startDate) {
      setConflict(true);
      onChange({ startDate, endDate: null });
    } else {
      setConflict(false);
      onChange({ startDate, endDate: date });
    }
  };

  return (
    <div className="flex flex-col gap-1">
      {label && <span className="text-xs font-medium text-gray-600">{label}</span>}
      <div className="flex items-center gap-2">
        <DatePicker
          selected={startDate}
          onChange={handleStartChange}
          selectsStart
          startDate={startDate ?? undefined}
          endDate={endDate ?? undefined}
          dateFormat="dd/MM/yyyy"
          placeholderText="Start date"
          className="w-36 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span className="text-gray-400 text-sm">–</span>
        <DatePicker
          selected={endDate}
          onChange={handleEndChange}
          selectsEnd
          startDate={startDate ?? undefined}
          endDate={endDate ?? undefined}
          minDate={startDate ?? undefined}
          dateFormat="dd/MM/yyyy"
          placeholderText="End date"
          className="w-36 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      {conflict && (
        <p className="text-xs text-red-600">End date must be after start date</p>
      )}
    </div>
  );
};

export default DateRangePicker;
