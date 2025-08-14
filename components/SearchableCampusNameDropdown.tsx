
import React, { useState, useEffect, useRef, useMemo } from 'react';

interface SearchableCampusNameDropdownProps {
  allCampusNames: string[];
  currentCampusName: string;
  onCampusNameSelect: (campusName: string) => void;
  placeholderText?: string;
  buttonClassName?: string;
  dropdownClassName?: string;
}

const SearchableCampusNameDropdown: React.FC<SearchableCampusNameDropdownProps> = ({
  allCampusNames,
  currentCampusName,
  onCampusNameSelect,
  placeholderText = "Select or type Campus Name",
  buttonClassName = "w-full flex items-center justify-between p-2 text-sm border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900",
  dropdownClassName = "absolute z-20 w-full mt-1 bg-white rounded-md shadow-lg max-h-60 overflow-auto custom-scrollbar border border-gray-300",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const normalizedAllCampusNames = useMemo(() => allCampusNames.map(name => name.toLowerCase()), [allCampusNames]);

  const filteredDisplayCampusNames = useMemo(() => {
    if (!searchTerm) {
      return allCampusNames.sort();
    }
    const lowerSearchTerm = searchTerm.toLowerCase();
    return allCampusNames.filter(name => name.toLowerCase().includes(lowerSearchTerm)).sort();
  }, [allCampusNames, searchTerm]);

  const showAddNewOption = useMemo(() => {
    return searchTerm.trim() !== '' && !normalizedAllCampusNames.includes(searchTerm.trim().toLowerCase());
  }, [searchTerm, normalizedAllCampusNames]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // setSearchTerm(''); // Optionally clear search term when opening
      searchInputRef.current?.focus();
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    if (isOpen) {
        document.addEventListener('keydown', handleEscapeKey);
    }
    return () => {
        document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isOpen]);

  const handleSelect = (name: string) => {
    onCampusNameSelect(name);
    setIsOpen(false);
    setSearchTerm(''); 
  };
  
  const handleAddNew = () => {
    if (searchTerm.trim() !== '') {
        onCampusNameSelect(searchTerm.trim());
        setIsOpen(false);
        setSearchTerm('');
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        className={buttonClassName}
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="truncate">{currentCampusName || placeholderText}</span>
        <svg
          className={`w-4 h-4 ml-2 flex-shrink-0 transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
        </svg>
      </button>

      {isOpen && (
        <div className={dropdownClassName}>
          <div className="p-2 sticky top-0 bg-white z-10 border-b border-gray-200">
            <input
              ref={searchInputRef}
              type="search"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search or type new campus..."
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <ul role="listbox" aria-label="Campus Names" className="py-1">
            {filteredDisplayCampusNames.map(name => (
              <li
                key={name}
                className={`px-3 py-2 text-sm cursor-pointer transition-colors duration-100 ${
                  currentCampusName === name
                    ? 'bg-indigo-600 text-white font-semibold'
                    : 'text-gray-900 hover:bg-indigo-50 hover:text-indigo-900'
                }`}
                onClick={() => handleSelect(name)}
                role="option"
                aria-selected={currentCampusName === name}
              >
                {name}
              </li>
            ))}
            {showAddNewOption && (
              <li
                className="px-3 py-2 text-sm cursor-pointer transition-colors duration-100 text-indigo-600 hover:bg-indigo-100 font-medium border-t border-gray-200"
                onClick={handleAddNew}
                role="option"
                aria-selected={false}
              >
                Add New: "{searchTerm.trim()}"
              </li>
            )}
            {!showAddNewOption && filteredDisplayCampusNames.length === 0 && (
              <li className="px-3 py-2 text-sm text-gray-500 text-center">
                No matching campuses found.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default SearchableCampusNameDropdown;
