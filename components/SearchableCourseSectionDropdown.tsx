import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { EnrollmentEntry } from '../types';

interface SearchableCourseSectionDropdownProps {
  courses: EnrollmentEntry[];
  selectedSectionIds: string[];
  onSelectionChange: (sectionIds: string[]) => void;
  buttonClassName?: string;
  dropdownClassName?: string;
  placeholderText?: string;
}

const ROW_HEIGHT = 38; // px, approximate height of a list item
const OVERSCAN_COUNT = 5; // Number of items to render above and below the visible area

const SearchableCourseSectionDropdown: React.FC<SearchableCourseSectionDropdownProps> = React.memo(({
  courses,
  selectedSectionIds,
  onSelectionChange,
  buttonClassName = "w-full flex items-center justify-between p-1 text-[11px] sm:text-xs rounded-md transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-[var(--color-accent-yellow-400)] focus:ring-offset-1 focus:ring-offset-teal-900 bg-teal-800 border border-teal-600 shadow-sm hover:bg-teal-700/50",
  dropdownClassName = "absolute z-20 w-full mt-1 bg-teal-900 rounded-md shadow-lg max-h-60 overflow-auto custom-scrollbar border border-teal-600",
  placeholderText = "Filter by Course Section",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [scrollTop, setScrollTop] = useState(0);
  const dropdownContainerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filteredCourses = useMemo(() => {
    if (!searchTerm) return courses;
    const lowerSearchTerm = searchTerm.toLowerCase();
    return courses.filter(course =>
        course.courseCode.toLowerCase().includes(lowerSearchTerm) ||
        course.courseTitle.toLowerCase().includes(lowerSearchTerm) ||
        course.section.toLowerCase().includes(lowerSearchTerm)
    );
  }, [courses, searchTerm]);
  
  // --- Virtualization Logic ---
  const totalHeight = filteredCourses.length * ROW_HEIGHT;
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN_COUNT);
  const visibleItemCount = Math.ceil(240 / ROW_HEIGHT); // 240px is from max-h-60
  const endIndex = Math.min(
    filteredCourses.length,
    startIndex + visibleItemCount + (2 * OVERSCAN_COUNT)
  );

  const visibleCourses = useMemo(() => 
    filteredCourses.slice(startIndex, endIndex),
    [filteredCourses, startIndex, endIndex]
  );
  const paddingTop = startIndex * ROW_HEIGHT;

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      searchInputRef.current?.focus();
    } else {
        setSearchTerm(''); // Reset search when closed
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
        setScrollTop(0);
        if(dropdownContainerRef.current) {
            dropdownContainerRef.current.scrollTop = 0;
        }
    }
  }, [isOpen]);

  const handleToggleSelection = (sectionId: string) => {
    const newSelection = selectedSectionIds.includes(sectionId)
      ? selectedSectionIds.filter(id => id !== sectionId)
      : [...selectedSectionIds, sectionId];
    onSelectionChange(newSelection);
  };

  const getButtonDisplay = () => {
    if (selectedSectionIds.length === 0) return placeholderText;
    if (selectedSectionIds.length === 1) {
        const course = courses.find(c => c.sectionId === selectedSectionIds[0]);
        return course ? `${course.courseCode} (${course.section})` : placeholderText;
    }
    return `${selectedSectionIds.length} sections selected`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button type="button" className={buttonClassName} onClick={() => setIsOpen(!isOpen)} aria-haspopup="listbox" aria-expanded={isOpen}>
        <span className="truncate">{getButtonDisplay()}</span>
        <svg className={`w-3 h-3 sm:w-3.5 sm:w-3.5 flex-shrink-0 transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
        </svg>
      </button>

      {isOpen && (
        <div
            ref={dropdownContainerRef}
            onScroll={handleScroll}
            className={dropdownClassName}
        >
          <div className="p-1.5 sticky top-0 bg-teal-900 z-10 border-b border-teal-700">
            <input
              ref={searchInputRef}
              type="search"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by code, title, section..."
              className="w-full px-1.5 py-1 text-xs border border-teal-600 rounded-md focus:ring-0 focus:border-teal-600 bg-teal-700 text-teal-100 placeholder-teal-300 transition-none"
            />
          </div>
          <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
            <ul
              role="listbox"
              aria-label="Course Sections"
              className="py-1"
              style={{ paddingTop: `${paddingTop}px`, position: 'absolute', top: 0, left: 0, width: '100%' }}
            >
              {visibleCourses.map(course => {
                const isSelected = selectedSectionIds.includes(course.sectionId);
                return (
                <li
                  key={course.sectionId}
                  className={`px-2 py-1 text-[11px] sm:text-xs cursor-pointer transition-colors duration-100 flex items-center justify-between ${isSelected ? 'bg-teal-500 text-white font-semibold' : 'text-teal-100 hover:bg-teal-700 hover:text-white'}`}
                  style={{ height: `${ROW_HEIGHT}px` }}
                  onClick={() => handleToggleSelection(course.sectionId)}
                  role="option"
                  aria-selected={isSelected}
                >
                  <div className="flex-grow min-w-0">
                      <div className="font-medium truncate" title={`${course.courseCode} (${course.section})`}>{course.courseCode} ({course.section})</div>
                      <div className={`text-[9px] sm:text-[10px] truncate ${isSelected ? 'text-teal-200' : 'text-teal-300'}`} title={course.courseTitle}>{course.courseTitle}</div>
                  </div>
                  <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      className="ml-3 h-4 w-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500 cursor-pointer pointer-events-none bg-teal-800"
                  />
                </li>
              )})}
              {filteredCourses.length === 0 && <li className="px-3 py-2 text-xs text-teal-300 text-center">No sections found.</li>}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
});

SearchableCourseSectionDropdown.displayName = 'SearchableCourseSectionDropdown';
export default SearchableCourseSectionDropdown;