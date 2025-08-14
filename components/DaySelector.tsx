import React from 'react';
import { DayOfWeek } from '../types';

interface DaySelectorProps {
  days: DayOfWeek[];
  selectedDays: DayOfWeek[];
  onDayClick: (day: DayOfWeek) => void;
  isHeaderContext?: boolean; // Optional prop to indicate rendering in header
  disabled?: boolean;
}

const DaySelector: React.FC<DaySelectorProps> = React.memo(({ days, selectedDays, onDayClick, isHeaderContext, disabled }) => {
  const getButtonClasses = (day: DayOfWeek) => {
    const baseClasses = `px-1.5 py-0.5 sm:px-2 sm:py-1 text-xs sm:text-sm font-medium rounded-md transition-all duration-150 ease-in-out whitespace-nowrap`; // Removed focus:outline-none, focus:ring-2, focus:ring-offset-1
    
    if (disabled) {
      return `${baseClasses} bg-[var(--color-primary-800)] text-[var(--color-primary-400)] opacity-60 cursor-not-allowed`;
    }

    const isSelected = selectedDays.includes(day);

    if (isHeaderContext) {
      if (isSelected) {
        return `${baseClasses} bg-white text-[var(--color-primary-700)] hover:bg-gray-100`;
      }
      return `${baseClasses} text-[var(--color-primary-100)] hover:bg-[var(--color-primary-500)] hover:text-white border border-[var(--color-primary-500)] hover:border-[var(--color-primary-400)]`;
    }
    // Default styles for non-header context
    if (isSelected) {
      return `${baseClasses} bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)]`;
    }
    return `${baseClasses} bg-gray-200 text-gray-700 hover:bg-gray-300 border border-gray-300 hover:border-gray-400`;
  };

  return (
    // Changed to a non-wrapping flex layout that can shrink
    <div className="flex flex-wrap justify-end gap-1 sm:gap-1.5 min-w-0">
      {days.map((day) => (
        <button
          key={day}
          onClick={() => onDayClick(day)}
          className={getButtonClasses(day)}
          aria-pressed={selectedDays.includes(day)}
          aria-label={day}
          disabled={disabled}
        >
          <span className="sm:hidden">{day.substring(0, 3)}</span>
          <span className="hidden sm:inline">{day}</span>
        </button>
      ))}
    </div>
  );
});

DaySelector.displayName = 'DaySelector';
export default DaySelector;