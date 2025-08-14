
import React, { useState, useEffect, useRef, useMemo } from 'react';

interface DropdownOption {
  id: string;
  name: string;
}

interface SearchableCreatableDropdownProps {
  options: DropdownOption[];
  value: string | null; // Currently selected option's ID
  onChange: (id: string | null) => void; // Called when an existing option is selected
  onCreate?: (name: string) => Promise<string | null>; // Called to create a new option, returns new ID or null
  placeholder?: string;
  disabled?: boolean;
  idPrefix?: string; // For unique DOM element IDs
  buttonClassName?: string;
  dropdownClassName?: string;
  listItemClassName?: string;
  allowCreation?: boolean; // New prop
}

const SearchableCreatableDropdown: React.FC<SearchableCreatableDropdownProps> = ({
  options,
  value,
  onChange,
  onCreate,
  placeholder = "Select or type to add...",
  disabled = false,
  idPrefix = "scd",
  buttonClassName = "w-full flex items-center justify-between p-2 text-sm border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900",
  dropdownClassName,
  listItemClassName,
  allowCreation = true, // Default to true for backward compatibility
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isLoadingCreate, setIsLoadingCreate] = useState(false);

  const selectedOption = useMemo(() => options.find(opt => opt.id === value), [options, value]);

  const filteredOptions = useMemo(() => {
    if (!searchTerm) {
      return options.sort((a,b) => a.name.localeCompare(b.name));
    }
    const lowerSearchTerm = searchTerm.toLowerCase();
    return options.filter(opt => opt.name.toLowerCase().includes(lowerSearchTerm))
                  .sort((a,b) => a.name.localeCompare(b.name));
  }, [options, searchTerm]);

  const canCreateNew = useMemo(() => {
    if (!searchTerm.trim()) return false;
    return !options.some(opt => opt.name.toLowerCase() === searchTerm.trim().toLowerCase());
  }, [options, searchTerm]);

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
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) document.addEventListener('keydown', handleEscapeKey);
    return () => document.removeEventListener('keydown', handleEscapeKey);
  }, [isOpen]);

  const handleSelectOption = (optionId: string | null) => {
    onChange(optionId);
    setSearchTerm('');
    setIsOpen(false);
  };

  const handleCreateNew = async () => {
    if (!searchTerm.trim() || !canCreateNew || isLoadingCreate || !onCreate) return;
    setIsLoadingCreate(true);
    const newId = await onCreate(searchTerm.trim());
    setIsLoadingCreate(false);
    if (newId) {
      onChange(newId); // Automatically select the newly created item
    }
    setSearchTerm('');
    setIsOpen(false);
  };
  
  const buttonId = `${idPrefix}-button`;
  const listboxId = `${idPrefix}-listbox`;

  const baseItemClass = listItemClassName || 'px-3 py-2 text-xs cursor-pointer transition-colors duration-100';

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        id={buttonId}
        type="button"
        disabled={disabled || isLoadingCreate}
        className={buttonClassName}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
      >
        <span className="truncate">{selectedOption?.name || placeholder}</span>
        <svg
          className={`w-4 h-4 ml-2 flex-shrink-0 transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''} ${disabled || isLoadingCreate ? 'text-gray-300' : 'text-gray-400'}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
        </svg>
      </button>

      {isOpen && (
        <div className={dropdownClassName || "absolute z-30 w-full mt-1 bg-white rounded-md shadow-lg max-h-60 overflow-auto custom-scrollbar border border-gray-300"}>
          <div className="p-2 sticky top-0 bg-white z-10 border-b border-gray-200">
            <input
              ref={searchInputRef}
              type="search"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search or type to add..."
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
              disabled={isLoadingCreate}
            />
          </div>
          <ul id={listboxId} role="listbox" aria-labelledby={buttonId} className="py-1">
            {allowCreation && !selectedOption && (
                <li
                    className={`${baseItemClass} text-gray-700 hover:bg-gray-100 italic`}
                    onClick={() => handleSelectOption(null)}
                    role="option"
                    aria-selected={value === null}
                >
                    {placeholder}
                </li>
            )}
            {filteredOptions.map(option => (
              <li
                key={option.id}
                className={`${baseItemClass} ${
                  value === option.id
                    ? 'bg-teal-600 text-white font-semibold'
                    : 'text-gray-900 hover:bg-teal-50 hover:text-teal-900'
                }`}
                onClick={() => handleSelectOption(option.id)}
                role="option"
                aria-selected={value === option.id}
              >
                {option.name}
              </li>
            ))}
            {allowCreation && canCreateNew && (
              <li
                className={`${baseItemClass} text-teal-600 hover:bg-teal-100 font-medium border-t border-gray-200`}
                onClick={handleCreateNew}
                role="option"
                aria-selected={false}
              >
                {isLoadingCreate ? 'Creating...' : `Add New: "${searchTerm.trim()}"`}
              </li>
            )}
            {!canCreateNew && filteredOptions.length === 0 && searchTerm && (
              <li className="px-3 py-2 text-xs text-gray-500 text-center">
                Item already exists or invalid.
              </li>
            )}
             {!searchTerm && filteredOptions.length === 0 && (
                <li className="px-3 py-2 text-xs text-gray-500 text-center">
                    No options available. Type to add.
                </li>
             )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default SearchableCreatableDropdown;
