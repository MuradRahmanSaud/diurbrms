

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ProgramEntry } from '../types'; 

interface SearchableProgramDropdownForRoomsProps {
  programs: ProgramEntry[];
  
  // Single select mode (used for "Assign To")
  selectedProgramPId?: string | undefined; 
  onProgramSelect?: (pId: string | undefined) => void;
  
  // Multi select mode (used for "Share To")
  selectedPIds?: string[];
  onPIdsChange?: (pIds: string[]) => void;
  multiSelect?: boolean;
  filterOutPId?: string; // P-ID to exclude from the list (e.g., the one from "Assign To")

  placeholderText?: string;
  idSuffix?: string; 
  disabled?: boolean;
  showReservedRoomOption?: boolean; // New prop
  buttonClassName?: string;
}

const RESERVED_ROOM_ID = '__RESERVED__';

const SearchableProgramDropdownForRooms: React.FC<SearchableProgramDropdownForRoomsProps> = ({
  programs,
  selectedProgramPId,
  onProgramSelect,
  selectedPIds = [], // Default for multiSelect mode
  onPIdsChange,
  multiSelect = false,
  filterOutPId,
  placeholderText = "Select Program",
  idSuffix = "",
  disabled = false,
  showReservedRoomOption = false,
  buttonClassName = "w-full flex items-center justify-between p-1.5 text-xs border border-gray-300 rounded-md shadow-sm focus:ring-1 focus:ring-teal-500 focus:border-teal-500 bg-white disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed h-8",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedProgramForSingleMode = useMemo(() => {
    if (multiSelect) return null;
    return programs.find(p => p.pId === selectedProgramPId);
  }, [programs, selectedProgramPId, multiSelect]);

  const availablePrograms = useMemo(() => {
    return programs.filter(p => p.pId !== filterOutPId);
  }, [programs, filterOutPId]);

  const filteredPrograms = useMemo(() => {
    let searchFiltered = availablePrograms;
    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      searchFiltered = availablePrograms.filter(
        program =>
          program.pId.toLowerCase().includes(lowerSearchTerm) ||
          program.shortName.toLowerCase().includes(lowerSearchTerm) ||
          program.fullName.toLowerCase().includes(lowerSearchTerm)
      );
    }

    if (multiSelect && selectedPIds.length > 0) {
      return [...searchFiltered].sort((a, b) => {
        const aIsSelected = selectedPIds.includes(a.pId);
        const bIsSelected = selectedPIds.includes(b.pId);

        if (aIsSelected && !bIsSelected) return -1;
        if (!aIsSelected && bIsSelected) return 1;
        
        // If both are selected or both are not selected, sort by P-ID
        return a.pId.localeCompare(b.pId, undefined, { numeric: true, sensitivity: 'base' });
      });
    }

    // Default sort by P-ID for single-select or if no prioritized items in multi-select
    return [...searchFiltered].sort((a, b) => 
      a.pId.localeCompare(b.pId, undefined, { numeric: true, sensitivity: 'base' })
    );
  }, [availablePrograms, searchTerm, multiSelect, selectedPIds]);

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

  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
     if (isOpen) document.addEventListener('keydown', handleEscapeKey);
    return () => document.removeEventListener('keydown', handleEscapeKey);
  }, [isOpen]);


  const handleSingleSelect = (pId: string | undefined) => {
    if (onProgramSelect) {
      onProgramSelect(pId);
    }
    setIsOpen(false);
    setSearchTerm(''); 
  };
  
  const handleMultiSelectToggle = (pId: string) => {
    if (onPIdsChange) {
      const newSelectedPIds = selectedPIds.includes(pId)
        ? selectedPIds.filter(id => id !== pId)
        : [...selectedPIds, pId];
      onPIdsChange(newSelectedPIds);
    }
    // setSearchTerm(''); // Keep dropdown open for multi-select
  };


  const getButtonDisplay = () => {
    if (multiSelect) {
      if (selectedPIds.length === 0) return placeholderText;
      if (selectedPIds.length === 1) {
          if (selectedPIds[0] === RESERVED_ROOM_ID) {
              return 'Reserved Room';
          }
          const prog = programs.find(p => p.pId === selectedPIds[0]);
          return prog ? `${prog.pId} - ${prog.shortName}` : placeholderText;
      }

      const hasReserved = selectedPIds.includes(RESERVED_ROOM_ID);
      const programCount = selectedPIds.filter(id => id !== RESERVED_ROOM_ID).length;

      if (hasReserved && programCount > 0) {
          return `Reserved + ${programCount} program${programCount > 1 ? 's' : ''}`;
      }
      if (hasReserved) {
          return 'Reserved Room';
      }
      return `${programCount} program${programCount > 1 ? 's' : ''} selected`;
    }
    // Single select mode
    if (selectedProgramForSingleMode) {
      return `${selectedProgramForSingleMode.pId} - ${selectedProgramForSingleMode.shortName}`;
    }
    return placeholderText;
  };

  const buttonId = `spdr-button-${idSuffix}`;
  const listboxId = `spdr-listbox-${idSuffix}`;

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        id={buttonId}
        type="button"
        disabled={disabled}
        className={buttonClassName}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
      >
        <span className="truncate">{getButtonDisplay()}</span>
        <svg
          className={`w-4 h-4 ml-2 flex-shrink-0 transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''} ${disabled ? 'text-gray-300' : 'text-gray-400'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-30 w-full mt-1 bg-white rounded-md shadow-lg max-h-60 overflow-auto custom-scrollbar border border-gray-300">
          <div className="p-2 sticky top-0 bg-white z-10 border-b border-gray-200">
            <input
              ref={searchInputRef}
              type="search"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search P-ID or Name..."
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
              aria-label="Search programs"
            />
          </div>
          <ul id={listboxId} role="listbox" aria-labelledby={buttonId} className="py-1">
            {!multiSelect && ( // Option to clear selection for single-select mode
                <li 
                    className={`px-3 py-2 text-xs cursor-pointer transition-colors duration-100 text-gray-700 hover:bg-teal-50 hover:text-teal-900 italic`}
                    onClick={() => handleSingleSelect(undefined)}
                    role="option"
                    aria-selected={selectedProgramPId === undefined}
                >
                    Clear selection
                </li>
            )}
             {showReservedRoomOption && (
                <li
                    key={RESERVED_ROOM_ID}
                    className={`px-3 py-2 text-xs cursor-pointer transition-colors duration-100 flex items-center justify-between ${
                        selectedPIds.includes(RESERVED_ROOM_ID)
                        ? 'bg-teal-600 text-white font-semibold'
                        : 'text-gray-900 hover:bg-teal-50 hover:text-teal-900'
                    }`}
                    onClick={() => handleMultiSelectToggle(RESERVED_ROOM_ID)}
                    role="option"
                    aria-selected={selectedPIds.includes(RESERVED_ROOM_ID)}
                    title="Rooms with no assigned program"
                >
                    <div className="flex-grow min-w-0">
                        <div className="font-medium truncate">Reserved Room</div>
                        <div className={`text-[10px] truncate ${selectedPIds.includes(RESERVED_ROOM_ID) ? 'text-teal-200' : 'text-gray-500'}`}>
                            Unassigned rooms
                        </div>
                    </div>
                    {multiSelect && (
                        <input
                            type="checkbox"
                            checked={selectedPIds.includes(RESERVED_ROOM_ID)}
                            readOnly
                            className="ml-3 h-4 w-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500 cursor-pointer pointer-events-none"
                        />
                    )}
                </li>
             )}
            {filteredPrograms.length > 0 ? (
              filteredPrograms.map(program => {
                const isSelected = multiSelect ? selectedPIds.includes(program.pId) : selectedProgramPId === program.pId;
                return (
                <li
                  key={program.id} 
                  className={`px-3 py-2 text-xs cursor-pointer transition-colors duration-100 flex items-center justify-between ${
                    isSelected
                      ? 'bg-teal-600 text-white font-semibold'
                      : 'text-gray-900 hover:bg-teal-50 hover:text-teal-900'
                  }`}
                  onClick={() => multiSelect ? handleMultiSelectToggle(program.pId) : handleSingleSelect(program.pId)}
                  role="option"
                  aria-selected={isSelected}
                  title={`${program.pId} - ${program.fullName}`}
                >
                  <div className="flex-grow min-w-0">
                    <div className="font-medium truncate">{program.pId} - {program.shortName}</div>
                    <div className={`text-[10px] truncate ${isSelected ? 'text-teal-200' : 'text-gray-500'}`}>
                      {program.fullName}
                    </div>
                  </div>
                  {multiSelect && (
                    <input
                        type="checkbox"
                        checked={isSelected}
                        readOnly
                        className="ml-3 h-4 w-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500 cursor-pointer pointer-events-none"
                    />
                  )}
                </li>
              )})
            ) : (
                !showReservedRoomOption && <li className="px-3 py-2 text-xs text-gray-500 text-center">No programs found.</li>
            )}
            {searchTerm && filteredPrograms.length === 0 && (
                 <li className="px-3 py-2 text-xs text-gray-500 text-center">No matching programs.</li>
            )}
          </ul>
           {multiSelect && (
            <div className="p-2 border-t border-gray-200 sticky bottom-0 bg-white z-10">
              <button 
                onClick={() => setIsOpen(false)}
                className="w-full px-3 py-1.5 text-xs bg-teal-500 text-white rounded-md hover:bg-teal-600"
              >
                Done
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchableProgramDropdownForRooms;
