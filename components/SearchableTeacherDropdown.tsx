
import React, { useState, useEffect, useRef, useMemo } from 'react';

export interface TeacherDataForDropdown {
    employeeId: string;
    teacherName: string;
    designation: string;
}

interface SearchableTeacherDropdownProps {
  teachers: TeacherDataForDropdown[];
  selectedTeacherId: string | null;
  onTeacherSelect: (teacherId: string | null) => void;
  icon?: React.ReactNode;
  buttonClassName?: string;
  dropdownClassName?: string;
  placeholderText?: string;
}

const SearchableTeacherDropdown: React.FC<SearchableTeacherDropdownProps> = React.memo(({
  teachers,
  selectedTeacherId,
  onTeacherSelect,
  icon,
  buttonClassName = "w-full flex items-center justify-between p-1 text-[11px] sm:text-xs rounded-md transition-colors duration-150 text-teal-100 hover:bg-teal-600 hover:text-white focus:outline-none focus:ring-1 focus:ring-yellow-400 focus:ring-offset-1 focus:ring-offset-teal-800",
  dropdownClassName = "absolute z-20 w-full mt-1 bg-teal-900 rounded-md shadow-md max-h-80 overflow-auto custom-scrollbar border border-teal-600",
  placeholderText = "Filter by Teacher",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedTeacher = useMemo(() => {
    return teachers.find(t => t.employeeId === selectedTeacherId);
  }, [teachers, selectedTeacherId]);

  const filteredTeachers = useMemo(() => {
    if (!searchTerm) return teachers;
    const lowerSearchTerm = searchTerm.toLowerCase();
    return teachers.filter(teacher =>
        teacher.teacherName.toLowerCase().includes(lowerSearchTerm) ||
        teacher.designation.toLowerCase().includes(lowerSearchTerm) ||
        teacher.employeeId.toLowerCase().includes(lowerSearchTerm)
    );
  }, [teachers, searchTerm]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      searchInputRef.current?.focus();
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (teacherId: string | null) => {
    onTeacherSelect(teacherId);
    setIsOpen(false);
    setSearchTerm('');
  };

  const getButtonDisplay = () => {
    if (selectedTeacher) {
      return selectedTeacher.teacherName;
    }
    return placeholderText;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button type="button" className={buttonClassName} onClick={() => setIsOpen(!isOpen)} aria-haspopup="listbox" aria-expanded={isOpen}>
        <span className="flex items-center min-w-0">
          {icon && <span className="mr-1 sm:mr-1.5 flex-shrink-0">{icon}</span>}
          <span className="truncate">{getButtonDisplay()}</span>
        </span>
        <svg className={`w-3 h-3 sm:w-3.5 sm:w-3.5 flex-shrink-0 transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
        </svg>
      </button>

      {isOpen && (
        <div className={dropdownClassName}>
          <div className="p-1.5 sticky top-0 bg-teal-900 z-10 border-b border-teal-700">
            <input
              ref={searchInputRef}
              type="search"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by name, ID, or designation..."
              className="w-full px-1.5 py-1 text-xs border border-teal-600 rounded-md focus:ring-0 focus:border-teal-600 bg-teal-700 text-teal-100 placeholder-teal-300 transition-none"
            />
          </div>
          <ul role="listbox" aria-label="Teachers" className="py-1">
            <li
              className={`px-2 py-1 text-[11px] sm:text-xs cursor-pointer transition-colors duration-100 ${selectedTeacherId === null ? 'bg-teal-500 text-white font-semibold' : 'text-teal-100 hover:bg-teal-700 hover:text-white'}`}
              onClick={() => handleSelect(null)}
              role="option"
              aria-selected={selectedTeacherId === null}
            >
              All Teachers
            </li>
            {filteredTeachers.map(teacher => (
              <li
                key={teacher.employeeId}
                className={`px-2 py-1 text-[11px] sm:text-xs cursor-pointer transition-colors duration-100 ${selectedTeacherId === teacher.employeeId ? 'bg-teal-500 text-white font-semibold' : 'text-teal-100 hover:bg-teal-700 hover:text-white'}`}
                onClick={() => handleSelect(teacher.employeeId)}
                role="option"
                aria-selected={selectedTeacherId === teacher.employeeId}
              >
                <div className="font-medium truncate" title={`${teacher.teacherName} (${teacher.designation})`}>{teacher.teacherName}</div>
                <div className={`text-[9px] sm:text-[10px] truncate ${selectedTeacherId === teacher.employeeId ? 'text-teal-200' : 'text-teal-300'}`} title={`ID: ${teacher.employeeId}`}>{teacher.designation} - ID: {teacher.employeeId}</div>
              </li>
            ))}
            {filteredTeachers.length === 0 && <li className="px-3 py-2 text-xs text-teal-300 text-center">No teachers found.</li>}
          </ul>
        </div>
      )}
    </div>
  );
});

SearchableTeacherDropdown.displayName = 'SearchableTeacherDropdown';
export default SearchableTeacherDropdown;
