
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { SEED_DEFAULT_SLOTS_DATA, sortSlotsByTypeThenTime } from '../../data/slotConstants'; // Import seed data and sorter
import { DefaultTimeSlot as GlobalDefaultTimeSlot } from '../../types'; // Use global type

// Use the globally defined DefaultTimeSlot type
interface DefaultTimeSlot extends GlobalDefaultTimeSlot {}


// Helper to calculate duration in minutes
const calculateDuration = (startTime: string, endTime: string): number => {
  if (!startTime || !endTime) return 0;
  try {
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const startDate = new Date(0, 0, 0, startH, startM);
    const endDate = new Date(0, 0, 0, endH, endM);
    let diff = (endDate.getTime() - startDate.getTime()) / (1000 * 60); // Difference in minutes
    if (diff < 0) diff += 24 * 60; 
    return diff;
  } catch (e) {
    return 0; 
  }
};

// Helper function to format HH:MM (24-hour) time to hh:mm AM/PM
const formatTimeToAMPM = (time24: string): string => {
  if (!time24) return 'N/A';
  try {
    const [hours, minutes] = time24.split(':');
    let h = parseInt(hours, 10);
    const m = parseInt(minutes, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    h = h ? h : 12; 
    const hStr = h < 10 ? '0' + h : h.toString();
    const mStr = m < 10 ? '0' + m : m.toString();
    return `${hStr}:${mStr} ${ampm}`;
  } catch (e) {
    return 'Invalid Time';
  }
};

type SlotFilterType = 'All' | 'Theory' | 'Lab';

// initialDefaultSlots is now derived from SEED_DEFAULT_SLOTS_DATA
const generateInitialSlotsFromSeed = (): DefaultTimeSlot[] => {
    return SEED_DEFAULT_SLOTS_DATA.map((slot, index) => ({
        ...slot,
        id: `seed-${Date.now()}-${index}-${Math.random().toString(16).substring(2)}` // Ensure unique IDs for initial list
    })).sort(sortSlotsByTypeThenTime);
};


const DefaultTimeSlotManager: React.FC = () => {
  const [slots, setSlots] = useState<DefaultTimeSlot[]>(() => {
    const savedSlotsJson = localStorage.getItem('defaultTimeSlots');
    if (savedSlotsJson) {
        try {
            const rawSlots = JSON.parse(savedSlotsJson);
            if (Array.isArray(rawSlots)) {
                const validatedSlots: DefaultTimeSlot[] = rawSlots
                    .map((slot: any): DefaultTimeSlot | null => {
                        const typeIsValid = slot.type === 'Theory' || slot.type === 'Lab';
                        if (
                            typeof slot.id === 'string' &&
                            typeIsValid &&
                            typeof slot.startTime === 'string' &&
                            typeof slot.endTime === 'string'
                        ) {
                            return {
                                id: slot.id,
                                type: slot.type as 'Theory' | 'Lab', 
                                startTime: slot.startTime,
                                endTime: slot.endTime,
                            };
                        }
                        return null; 
                    })
                    .filter((slot): slot is DefaultTimeSlot => slot !== null); 

                if (validatedSlots.length > 0) {
                    return validatedSlots.sort(sortSlotsByTypeThenTime);
                }
                 // If validatedSlots is empty, it means localStorage had "[]" or only invalid items.
                 // In this case, we still want to return an empty array to respect user's choice of having no slots,
                 // rather than re-populating with seed. Seed is for truly empty/corrupt storage.
                 // However, the original logic would fall through to seed.
                 // Let's refine: if parsing was successful and result is empty array, return it.
                if (rawSlots.length === 0 && validatedSlots.length === 0) {
                    return []; // User explicitly saved an empty list
                }
            }
        } catch (e) {
            console.warn("Failed to parse defaultTimeSlots from localStorage or data was invalid, using initial seed data:", e);
        }
    }
    // Fallback to seed data if localStorage is null, parsing fails, or validatedSlots from non-empty rawSlots is empty.
    return generateInitialSlotsFromSeed();
  });

  const [slotType, setSlotType] = useState<'Theory' | 'Lab' | null>(null); // Can be null for "Select Type..."
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [activeFilterTab, setActiveFilterTab] = useState<SlotFilterType>('All');
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);


  useEffect(() => {
    try {
      localStorage.setItem('defaultTimeSlots', JSON.stringify(slots));
    } catch (e) {
      console.error("Failed to save default slots to localStorage:", e);
      alert("Could not save default time slots. Your browser storage might be full.");
    }
  }, [slots]);

  // Effect to update form's slotType and suggest startTime based on active tab, if not editing
  useEffect(() => {
    if (!editingSlotId) { // Only change if not in edit mode
      let suggestedStartTime = '';
      if (activeFilterTab === 'Theory') {
        setSlotType('Theory');
        const theorySlots = slots.filter(slot => slot.type === 'Theory');
        if (theorySlots.length > 0) {
          const latestTheorySlot = [...theorySlots].sort((a,b) => b.startTime.localeCompare(a.startTime))[0];
          suggestedStartTime = latestTheorySlot.endTime;
        }
      } else if (activeFilterTab === 'Lab') {
        setSlotType('Lab');
        const labSlots = slots.filter(slot => slot.type === 'Lab');
        if (labSlots.length > 0) {
          const latestLabSlot = [...labSlots].sort((a,b) => b.startTime.localeCompare(a.startTime))[0];
          suggestedStartTime = latestLabSlot.endTime;
        }
      } else { // 'All' tab
        setSlotType(null); // Set to null to show placeholder
      }
      setStartTime(suggestedStartTime);
      if (suggestedStartTime) { // If start time is suggested, clear end time
        setEndTime('');
      } else { // If no suggestion (e.g., no existing slots of type, or 'All' tab), also clear end time
        setEndTime('');
      }
    }
  }, [activeFilterTab, editingSlotId, slots]);

  const resetForm = useCallback(() => {
    setEndTime('');
    setFormError(null);
    setEditingSlotId(null); 
    // When form resets (e.g. after submit or cancel), re-evaluate suggestions based on current tab
    // This logic is already in the useEffect for [activeFilterTab, editingSlotId, slots]
    // No, we need to manually trigger the suggestion logic here or rely on the useEffect.
    // Forcing re-evaluation:
    const currentActiveTab = activeFilterTab; // Capture current tab
    setActiveFilterTab('' as SlotFilterType); // Temporarily change to force useEffect
    setTimeout(() => setActiveFilterTab(currentActiveTab), 0); // Restore it
  }, [activeFilterTab]);

  const handleSubmit = useCallback(() => {
    setFormError(null);
    setSaveSuccessMessage(null); 

    if (!slotType) { 
      setFormError('Slot Type is required.');
      return;
    }
    if (!startTime || !endTime) {
      setFormError('Start and End times are required.');
      return;
    }
    const duration = calculateDuration(startTime, endTime);
    if (duration <= 0) {
      setFormError('End time must be after start time.');
      return;
    }
    if (duration < 30) {
        setFormError('Minimum slot duration is 30 minutes.');
        return;
    }

    const isUpdating = !!editingSlotId;

    if (isUpdating) { 
      setSlots(prevSlots => 
        prevSlots.map(slot => 
          slot.id === editingSlotId 
            ? { ...slot, type: slotType, startTime, endTime } 
            : slot
        ).sort(sortSlotsByTypeThenTime)
      );
    } else { 
      const newSlot: DefaultTimeSlot = {
        id: Date.now().toString() + Math.random().toString(16).substring(2),
        type: slotType, 
        startTime,
        endTime,
      };
      setSlots(prevSlots => [...prevSlots, newSlot].sort(sortSlotsByTypeThenTime));
    }
    
    setSaveSuccessMessage(isUpdating ? 'Default slot updated successfully!' : 'Default slot added successfully!');
    setTimeout(() => {
        setSaveSuccessMessage(null);
    }, 3000);

    resetForm();
  }, [slotType, startTime, endTime, editingSlotId, resetForm]);

  const handleLoadSlotForEdit = useCallback((slotToEdit: DefaultTimeSlot) => {
    setEditingSlotId(slotToEdit.id);
    setSlotType(slotToEdit.type); 
    setStartTime(slotToEdit.startTime);
    setEndTime(slotToEdit.endTime);
    setFormError(null); 
    setSaveSuccessMessage(null);
    const formElement = document.getElementById('slot-form-section');
    formElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);
  
  const deleteSlotById = useCallback((idToDelete: string) => {
    setSlots(prevSlots => prevSlots.filter(slot => slot.id !== idToDelete)); 
    setSaveSuccessMessage('Default slot deleted.'); // Provide feedback for deletion
    setTimeout(() => {
        setSaveSuccessMessage(null);
    }, 3000);
    if (editingSlotId === idToDelete) { 
      resetForm();
    }
  }, [editingSlotId, resetForm]);

  const handleDeleteSlotFromForm = useCallback(() => {
    if (editingSlotId) {
      deleteSlotById(editingSlotId); 
    }
  }, [editingSlotId, deleteSlotById]);

  const handleCancelEdit = useCallback(() => {
    resetForm();
    setSaveSuccessMessage(null);
  }, [resetForm]);

  const filteredSlots = useMemo(() => {
    let currentSlots = [...slots]; 
    if (activeFilterTab === 'All') {
      return currentSlots.sort(sortSlotsByTypeThenTime);
    } else { 
      currentSlots = currentSlots.filter(slot => slot.type === activeFilterTab);
      return currentSlots.sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
  }, [slots, activeFilterTab]);

  const totalSlotsCount = slots.length;
  const theorySlotsCount = slots.filter(slot => slot.type === 'Theory').length;
  const labSlotsCount = slots.filter(slot => slot.type === 'Lab').length;

  const getTabCount = (tabType: SlotFilterType): number => {
    switch (tabType) {
      case 'All': return totalSlotsCount;
      case 'Theory': return theorySlotsCount;
      case 'Lab': return labSlotsCount;
      default: return 0;
    }
  };


  return (
    <div className="p-1 sm:p-1.5 rounded-md bg-slate-100 flex flex-col h-full"> 
      
      <div id="slot-form-section" className={`flex-shrink-0 space-y-2 mb-3 p-2 sm:p-2.5 rounded-md bg-gray-50 shadow-sm ${editingSlotId ? 'border border-teal-300' : ''}`}>
        <h3 className="text-sm font-semibold text-gray-700 mb-1">{editingSlotId ? 'Edit Time Slot' : 'Add New Time Slot'}</h3>
        <div className="space-y-2"> 
          <div> 
            <label htmlFor="slotType" className="block text-xs font-medium text-gray-600 mb-0.5">Type</label>
            <select
              id="slotType"
              value={slotType ?? ""} 
              onChange={(e) => {
                const value = e.target.value;
                if (value === "Theory" || value === "Lab") {
                  const newSlotType = value as 'Theory' | 'Lab';
                  setSlotType(newSlotType);
                  if (activeFilterTab === 'All' && !editingSlotId) { // Auto-switch tab only if on 'All' and not editing
                    if (newSlotType === 'Theory') {
                      setActiveFilterTab('Theory');
                    } else if (newSlotType === 'Lab') {
                      setActiveFilterTab('Lab');
                    }
                  }
                } 
              }}
              className="w-full p-1 rounded-md text-xs border border-gray-300 focus:ring-1 focus:ring-teal-500 focus:border-transparent h-[26px] bg-teal-50 transition-none"
            >
              <option value="" disabled>Select Type...</option>
              <option value="Theory">Theory</option>
              <option value="Lab">Lab</option>
            </select>
          </div>
          
          <div className="grid grid-cols-2 gap-2 sm:gap-3"> 
            <div>
              <label htmlFor="startTime" className="block text-xs font-medium text-gray-600 mb-0.5">Start Time</label>
              <input
                type="time"
                id="startTime"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full p-1 rounded-md text-xs border border-gray-300 focus:ring-1 focus:ring-teal-500 focus:border-transparent bg-teal-50 h-[26px] transition-none"
              />
            </div>
            <div>
              <label htmlFor="endTime" className="block text-xs font-medium text-gray-600 mb-0.5">End Time</label>
              <input
                type="time"
                id="endTime"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full p-1 rounded-md text-xs border border-gray-300 focus:ring-1 focus:ring-teal-500 focus:border-transparent bg-teal-50 h-[26px] transition-none"
              />
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap justify-end items-center gap-2 pt-2"> 
           {editingSlotId && (
            <>
              <button
                onClick={handleCancelEdit}
                type="button"
                className="px-3 py-1.5 bg-gray-300 hover:bg-gray-400 text-gray-700 hover:text-gray-800 text-xs font-medium rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSlotFromForm}
                type="button"
                className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded-md transition-colors"
              >
                Delete
              </button>
            </>
          )}
          <button
            onClick={handleSubmit}
            type="button"
            className="px-3 py-1.5 bg-teal-500 hover:bg-teal-600 text-white text-xs font-medium rounded-md transition-colors"
          >
            {editingSlotId ? 'Update' : 'Add Slot'}
          </button>
        </div>
      </div>

      {formError && <p className="flex-shrink-0 text-xs text-red-600 mb-2 p-1.5 bg-red-100 border border-red-300 rounded-md">{formError}</p>}
      {saveSuccessMessage && (
        <p className="flex-shrink-0 text-sm text-green-800 font-medium mb-2 p-2 bg-green-100 border border-green-400 rounded-md flex items-center animate-pulse">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-green-600 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          {saveSuccessMessage}
        </p>
      )}

      
      <div className="flex-shrink-0 mt-1 flex flex-col flex-grow min-h-0">
        
        <div className="flex-shrink-0 flex space-x-1 mb-1.5 pb-1 border-b border-gray-200">
          {([
            { type: 'All', label: 'All' },
            { type: 'Theory', label: 'Theory' },
            { type: 'Lab', label: 'Lab' }
          ] as { type: SlotFilterType, label: string }[]).map(tabInfo => (
            <button
              key={tabInfo.type}
              onClick={() => setActiveFilterTab(tabInfo.type)}
              className={`px-2.5 py-1 text-xs font-medium rounded-t-md flex items-center transition-colors
                ${activeFilterTab === tabInfo.type
                  ? 'bg-teal-600 text-white' 
                  : 'bg-teal-100 text-teal-700 hover:bg-teal-200 hover:text-teal-800'
                }
              `}
              aria-pressed={activeFilterTab === tabInfo.type}
            >
              {tabInfo.label}
              <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center
                ${activeFilterTab === tabInfo.type
                  ? 'bg-white text-teal-600' 
                  : 'bg-teal-500 text-white'
                }
              `}>
                {getTabCount(tabInfo.type)}
              </span>
            </button>
          ))}
        </div>

        
        {slots.length === 0 ? (
           <div className="flex-grow flex flex-col items-center justify-center text-center p-3 text-gray-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="font-semibold">No Default Slots</p>
                <p className="text-xs italic">Add default time slots using the form above, or they will be seeded on next load if storage is empty.</p>
           </div>
        ) : filteredSlots.length === 0 ? (
           <div className="flex-grow flex flex-col items-center justify-center text-center p-3 text-gray-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 10a.01.01 0 01.01-.01H10a.01.01 0 010 .02zm.01 0a.01.01 0 00-.01.01v.01a.01.01 0 00.01-.01z" />
                </svg>
                <p className="font-semibold">No Matching Slots</p>
                <p className="text-xs italic">No {activeFilterTab.toLowerCase()} slots found. Try a different filter.</p>
           </div>
        ) : (
          <div className="flex-grow min-h-0 overflow-y-auto custom-scrollbar pr-1 space-y-1.5">
            {filteredSlots.map(slot => (
              <div 
                key={slot.id}
                onClick={() => handleLoadSlotForEdit(slot)}
                className={`
                  flex items-center p-1.5 rounded-md text-xs gap-x-1.5 cursor-pointer transition-all
                  ${editingSlotId === slot.id 
                    ? 'bg-teal-100 border border-teal-400 shadow-sm' 
                    : 'bg-gray-50 hover:bg-gray-100 border border-transparent hover:border-gray-300'
                  }
                `}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleLoadSlotForEdit(slot);}}
                aria-pressed={editingSlotId === slot.id}
                aria-label={`Load slot for editing: ${slot.type} from ${formatTimeToAMPM(slot.startTime)} to ${formatTimeToAMPM(slot.endTime)}`}
              >
                <div className="w-14 truncate">
                  <span className={`font-semibold ${slot.type === 'Lab' ? 'text-blue-600' : 'text-green-600'}`}>{slot.type}</span>
                </div>
                <div className="flex-grow text-center truncate text-gray-700 min-w-0">
                  {formatTimeToAMPM(slot.startTime)} - {formatTimeToAMPM(slot.endTime)}
                </div>
                <div className="w-16 text-right truncate text-gray-500 hidden sm:block">
                  ({calculateDuration(slot.startTime, slot.endTime)} min)
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DefaultTimeSlotManager;
