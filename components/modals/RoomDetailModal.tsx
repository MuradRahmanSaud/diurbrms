import React, { useState, useEffect, useCallback, useMemo, ChangeEvent } from 'react';
import { RoomEntry, ProgramEntry, DefaultTimeSlot, RoomDetailSlotFilterType, FloorEntry, RoomCategoryEntry, RoomTypeEntry, FullRoutineData, DayOfWeek, ClassDetail, ScheduleOverrides, SemesterCloneInfo, BuildingEntry } from '../../types';
import Modal from '../Modal';
import { SEED_DEFAULT_SLOTS_DATA, sortSlotsByTypeThenTime } from '../../data/slotConstants';
import SearchableCreatableDropdown from '../SearchableCreatableDropdown';
import SearchableProgramDropdownForRooms from '../SearchableProgramDropdownForRooms';
import { DAYS_OF_WEEK } from '../../data/routineConstants'; 
import { formatDefaultSlotToString as formatSlotObjectToStringApp } from '../../App'; 
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '../../contexts/AuthContext';


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

// Helper to calculate duration in minutes
const calculateDuration = (startTime: string, endTime: string): number => {
  if (!startTime || !endTime) return 0;
  try {
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const startDate = new Date(0, 0, 0, startH, startM);
    const endDate = new Date(0, 0, 0, endH, endM);
    let diff = (endDate.getTime() - startDate.getTime()) / (1000 * 60);
    if (diff < 0) diff += 24 * 60;
    return diff;
  } catch (e) {
    return 0;
  }
};

const accentColorMapping: { [key: string]: string } = {
  'bg-sky-100': 'bg-sky-400',
  'bg-lime-100': 'bg-lime-400',
  'bg-amber-100': 'bg-amber-400',
  'bg-rose-100': 'bg-rose-400',
  'bg-teal-100': 'bg-teal-400',
  'bg-blue-100': 'bg-blue-400',
  'bg-green-100': 'bg-green-400',
  'bg-yellow-100': 'bg-yellow-400',
  'bg-purple-100': 'bg-purple-400',
  'bg-pink-100': 'bg-pink-400',
  'bg-orange-100': 'bg-orange-400',
  'bg-cyan-100': 'bg-cyan-400',
};

const getAccentBarColorClassModal = (color?: string): string => {
  if (color && accentColorMapping[color]) {
    return accentColorMapping[color];
  }
  return 'bg-gray-400'; 
};

const ClassCellModal: React.FC<{ classInfo?: ClassDetail, isInactiveSlot?: boolean }> = React.memo(({ classInfo, isInactiveSlot }) => {
  if (isInactiveSlot) {
    return (
      <div className="h-full flex items-center justify-center text-[10px] text-gray-400 bg-gray-200 rounded-md shadow-sm p-1 italic opacity-60">
        N/A
      </div>
    );
  }
  if (!classInfo) {
    return (
      <div className="h-full flex items-center justify-center text-[10px] text-gray-400 bg-gray-50 rounded-md shadow-sm p-1 italic">
        Free
      </div>
    );
  }
  return (
    <div className="h-full rounded-md shadow-md bg-white flex overflow-hidden hover:shadow-lg transition-shadow duration-150 ease-in-out">
      <div className={`w-1 ${getAccentBarColorClassModal(classInfo.color)} flex-shrink-0`}></div>
      <div className="p-1 flex-grow flex flex-col justify-center items-center text-center overflow-hidden">
        <div className="w-full">
          <p className="font-bold text-gray-800 truncate text-[9px] sm:text-[10px]" title={classInfo.courseName}>
            {classInfo.courseCode} <span className="font-medium text-gray-600">({classInfo.section})</span>
          </p>
          <p className="text-gray-500 truncate text-[8px] sm:text-[9px] mt-1" title={classInfo.teacher}>
            {classInfo.teacher}
          </p>
        </div>
      </div>
    </div>
  );
});
ClassCellModal.displayName = 'ClassCellModal';


interface RoomDetailModalProps {
  room: RoomEntry | null;
  isOpen: boolean;
  onClose: () => void;
  onSaveRoom: (updatedRoom: RoomEntry) => Promise<void>; 

  allPrograms: ProgramEntry[];
  allFloorsForBuilding: FloorEntry[];
  allCategories: RoomCategoryEntry[];
  allRoomTypes: RoomTypeEntry[];
  allBuildings: BuildingEntry[];
  onAddFloor: (name: string, buildingId: string) => Promise<string | null>;
  onAddCategory: (name: string) => Promise<string | null>;
  onAddRoomType: (name: string) => Promise<string | null>;

  getBuildingName: (buildingId: string) => string;
  getBuildingAddress: (buildingId: string) => string;
  getFloorName: (floorId: string) => string;
  getCategoryName: (categoryId: string) => string;
  getTypeName: (typeId: string) => string;
  getProgramShortName: (pId?: string) => string;

  fullRoutineData: { [semesterId: string]: FullRoutineData };
  systemDefaultSlots: DefaultTimeSlot[];
  uniqueSemesters: string[]; 
  scheduleOverrides: ScheduleOverrides;
  allSemesterConfigurations: SemesterCloneInfo[];
  zIndex?: number;
  heightClass?: string;
}

type ActiveModalTab = 'routine' | 'details' | 'slots';

const RoomDetailModal: React.FC<RoomDetailModalProps> = ({
  room,
  isOpen,
  onClose,
  onSaveRoom,
  allPrograms,
  allFloorsForBuilding,
  allCategories,
  allRoomTypes,
  allBuildings,
  onAddFloor,
  onAddCategory,
  onAddRoomType,
  getBuildingName,
  getBuildingAddress,
  getFloorName,
  getCategoryName,
  getTypeName,
  getProgramShortName,
  fullRoutineData,
  systemDefaultSlots,
  uniqueSemesters,
  scheduleOverrides,
  allSemesterConfigurations,
  zIndex = 50,
}) => {
  const { user } = useAuth();
  const [internalRoomData, setInternalRoomData] = useState<RoomEntry | null>(null);
  
  const [currentDetailSlotType, setCurrentDetailSlotType] = useState<'Theory' | 'Lab' | null>(null);
  const [currentDetailStartTime, setCurrentDetailStartTime] = useState('');
  const [currentDetailEndTime, setCurrentDetailEndTime] = useState('');
  const [currentDetailSlotFormError, setCurrentDetailSlotFormError] = useState<string | null>(null);
  const [editingCurrentDetailSlotId, setEditingCurrentDetailSlotId] = useState<string | null>(null);
  const [activeDetailSlotFilterTab, setActiveDetailSlotFilterTab] = useState<RoomDetailSlotFilterType>('All');
  
  const [overallFormError, setOverallFormError] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  
  const [activeTab, setActiveTab] = useState<ActiveModalTab>('routine');

  const permissions = useMemo(() => {
    const defaultAccess = {
        canManageRoomManagement: false,
        canAddBuilding: false,
        canAddRoom: false,
        canEditAssignToProgram: false,
        canEditShareWithPrograms: false,
        canEditDetailsTab: false,
        canEditSlotsTab: false,
    };
    if (!user) return defaultAccess;
    if (user.role === 'admin') {
        return {
            canManageRoomManagement: true,
            canAddBuilding: true,
            canAddRoom: true,
            canEditAssignToProgram: true,
            canEditShareWithPrograms: true,
            canEditDetailsTab: true,
            canEditSlotsTab: true,
        };
    }
    return user.roomEditAccess || defaultAccess;
  }, [user]);

  const canSaveChanges = useMemo(() => {
    if (!internalRoomData || !room) return false;
    const detailsChanged = permissions.canEditDetailsTab && (
        internalRoomData.floorId !== room.floorId ||
        internalRoomData.categoryId !== room.categoryId ||
        internalRoomData.typeId !== room.typeId ||
        internalRoomData.roomNumber !== room.roomNumber ||
        internalRoomData.capacity !== room.capacity ||
        internalRoomData.semesterId !== room.semesterId
    );
    const assignChanged = permissions.canEditAssignToProgram && internalRoomData.assignedToPId !== room.assignedToPId;
    const shareChanged = permissions.canEditShareWithPrograms && JSON.stringify((internalRoomData.sharedWithPIds || []).sort()) !== JSON.stringify((room.sharedWithPIds || []).sort());
    const slotsChanged = permissions.canEditSlotsTab && JSON.stringify(internalRoomData.roomSpecificSlots) !== JSON.stringify(room.roomSpecificSlots);

    return detailsChanged || assignChanged || shareChanged || slotsChanged;
  }, [internalRoomData, room, permissions]);


  useEffect(() => {
    if (room && isOpen) {
      setInternalRoomData({ 
        ...room, 
        roomSpecificSlots: room.roomSpecificSlots ? [...room.roomSpecificSlots].sort(sortSlotsByTypeThenTime) : [],
        semesterId: room.semesterId || undefined 
      });
      resetDetailSlotManagerState();
      setOverallFormError(null);
      setFeedbackMessage(null);
      setActiveTab('routine'); 
    } else if (!isOpen) {
      // Delay clearing to allow for exit animation
      setTimeout(() => {
        setInternalRoomData(null);
      }, 300);
    }
  }, [room, isOpen]);
  
  const buildingForRoom = useMemo(() => {
    if (!internalRoomData?.buildingId || !allBuildings) return null;
    return allBuildings.find(b => b.id === internalRoomData.buildingId);
  }, [internalRoomData?.buildingId, allBuildings]);

  const isPrimaryProgramLocked = useMemo(() => {
    if (!internalRoomData?.roomNumber) return false;
    
    for (const semesterId in fullRoutineData) {
        const routine = fullRoutineData[semesterId];
        
        if (routine) {
            for (const day of Object.values(routine)) {
                if (day[internalRoomData.roomNumber] && Object.keys(day[internalRoomData.roomNumber]).length > 0) {
                    return true;
                }
            }
        }
    }
    
    return false;
  }, [internalRoomData?.roomNumber, fullRoutineData]);

  const isSlotLockedForEditing = useCallback((slotToCheck: DefaultTimeSlot): boolean => {
    if (!internalRoomData?.semesterId || !internalRoomData.roomNumber) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Check for future-dated overrides that are assignments (not null)
    const slotStringToCheck = formatSlotObjectToStringApp(slotToCheck);
    const roomOverrides = scheduleOverrides[internalRoomData.roomNumber];
    if (roomOverrides && roomOverrides[slotStringToCheck]) {
        for (const dateISO in roomOverrides[slotStringToCheck]) {
            // Use UTC parsing to avoid timezone shifts from date strings
            const overrideDate = new Date(dateISO + 'T00:00:00Z');
            if (overrideDate >= today && roomOverrides[slotStringToCheck][dateISO] !== null) {
                return true; 
            }
        }
    }

    // 2. Check if default routine exists for a semester that hasn't ended
    const semesterConfig = allSemesterConfigurations.find(c => c.targetSemester === internalRoomData.semesterId);
    if (!semesterConfig) return false;

    const assignedProgram = allPrograms.find(p => p.pId === internalRoomData.assignedToPId);
    if (!assignedProgram) return false;

    const systemType = assignedProgram.semesterSystem;
    const typeConfig = semesterConfig.typeConfigs.find(tc => tc.type === systemType);
    if (!typeConfig || !typeConfig.endDate) return false;

    const semesterEndDate = new Date(typeConfig.endDate + 'T00:00:00Z');
    if (semesterEndDate < today) {
        return false; // Semester is in the past
    }

    const semesterRoutine = fullRoutineData[internalRoomData.semesterId];
    if (!semesterRoutine) return false;

    for (const day of DAYS_OF_WEEK) {
        if (semesterRoutine[day]?.[internalRoomData.roomNumber]?.[slotStringToCheck]) {
            return true; // Found a default assignment in an active semester
        }
    }

    return false;
  }, [internalRoomData, scheduleOverrides, allSemesterConfigurations, allPrograms, fullRoutineData]);

  const handleRoomDataChange = (field: keyof RoomEntry, value: any) => {
    setInternalRoomData(prev => prev ? { ...prev, [field]: value } : null);
  };

  const handleRoomInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    handleRoomDataChange(name as keyof RoomEntry, name === 'capacity' ? (value === '' ? 0 : Number(value)) : value);
  };

  const handleAssignedProgramSelect = (pId: string | undefined) => {
    setInternalRoomData(prev => {
      if (!prev) return null;

      if (pId === undefined) {
        return { ...prev, assignedToPId: undefined, sharedWithPIds: [] };
      }
      return { ...prev, assignedToPId: pId, sharedWithPIds: prev.sharedWithPIds.filter(id => id !== pId) };
    });
  };

  const handleSharedProgramsChange = (pIds: string[]) => {
    handleRoomDataChange('sharedWithPIds', pIds);
  };
  
  const handleCreateFloorInModal = async (name: string): Promise<string | null> => {
    if (!internalRoomData?.buildingId) {
      setOverallFormError("Building context is lost for creating floor.");
      return null;
    }
    setFeedbackMessage(null);
    try {
      const newId = await onAddFloor(name, internalRoomData.buildingId);
      if (newId) setFeedbackMessage({ type: 'success', message: `Floor '${name}' created.` });
      return newId;
    } catch (e: any) {
      setOverallFormError(e.message || "Failed to add floor.");
      return null;
    }
  };

  const handleCreateCategoryInModal = async (name: string): Promise<string | null> => {
    setFeedbackMessage(null);
    try {
      const newId = await onAddCategory(name);
      if (newId) setFeedbackMessage({ type: 'success', message: `Category '${name}' created.` });
      return newId;
    } catch (e: any) {
      setOverallFormError(e.message || "Failed to add category.");
      return null;
    }
  };
  
  const handleCreateTypeInModal = async (name: string): Promise<string | null> => {
    setFeedbackMessage(null);
    try {
      const newId = await onAddRoomType(name);
      if (newId) setFeedbackMessage({ type: 'success', message: `Type '${name}' created.` });
      return newId;
    } catch (e: any) {
      setOverallFormError(e.message || "Failed to add type.");
      return null;
    }
  };

  const resetDetailSlotManagerState = useCallback(() => {
    setCurrentDetailSlotType(null);
    setCurrentDetailStartTime('');
    setCurrentDetailEndTime('');
    setCurrentDetailSlotFormError(null);
    setEditingCurrentDetailSlotId(null);
  }, []);

  useEffect(() => {
    if (!editingCurrentDetailSlotId && internalRoomData) {
        let suggestedStartTime = '';
        const currentSlots = internalRoomData.roomSpecificSlots || [];
        if (activeDetailSlotFilterTab === 'Theory') {
            setCurrentDetailSlotType('Theory');
            const theorySlots = currentSlots.filter(slot => slot.type === 'Theory');
            if (theorySlots.length > 0) suggestedStartTime = [...theorySlots].sort((a,b) => b.startTime.localeCompare(a.startTime))[0].endTime;
        } else if (activeDetailSlotFilterTab === 'Lab') {
            setCurrentDetailSlotType('Lab');
            const labSlots = currentSlots.filter(slot => slot.type === 'Lab');
            if (labSlots.length > 0) suggestedStartTime = [...labSlots].sort((a,b) => b.startTime.localeCompare(a.startTime))[0].endTime;
        } else setCurrentDetailSlotType(null);
        setCurrentDetailStartTime(suggestedStartTime);
        setCurrentDetailEndTime('');
    }
  }, [activeDetailSlotFilterTab, editingCurrentDetailSlotId, internalRoomData]);

  const handleDetailSlotSubmit = useCallback(() => {
    setCurrentDetailSlotFormError(null);
    setFeedbackMessage(null);
    if (!currentDetailSlotType) { setCurrentDetailSlotFormError('Slot Type is required.'); return; }
    if (!currentDetailStartTime || !currentDetailEndTime) { setCurrentDetailSlotFormError('Start and End times are required.'); return; }
    const duration = calculateDuration(currentDetailStartTime, currentDetailEndTime);
    if (duration <= 0) { setCurrentDetailSlotFormError('End time must be after start time.'); return; }
    if (duration < 30) { setCurrentDetailSlotFormError('Minimum slot duration is 30 minutes.'); return; }

    if (!internalRoomData) return;

    let updatedSlots;
    const currentRoomSpecificSlots = internalRoomData.roomSpecificSlots || [];
    if (editingCurrentDetailSlotId) {
      const originalSlot = currentRoomSpecificSlots.find(s => s.id === editingCurrentDetailSlotId);
      if (originalSlot && isSlotLockedForEditing(originalSlot)) {
          setCurrentDetailSlotFormError("Cannot edit a locked slot with future assignments.");
          return;
      }
      updatedSlots = currentRoomSpecificSlots.map(slot => slot.id === editingCurrentDetailSlotId ? { ...slot, type: currentDetailSlotType, startTime: currentDetailStartTime, endTime: currentDetailEndTime } : slot);
      setFeedbackMessage({type: 'success', message:"Slot updated in list."});
    } else {
      const newSlot: DefaultTimeSlot = { id: Date.now().toString() + Math.random().toString(16).substring(2), type: currentDetailSlotType, startTime: currentDetailStartTime, endTime: currentDetailEndTime };
      updatedSlots = [...currentRoomSpecificSlots, newSlot];
      setFeedbackMessage({type: 'success', message:"Slot added to list."});
    }
    setInternalRoomData(prev => prev ? { ...prev, roomSpecificSlots: updatedSlots.sort(sortSlotsByTypeThenTime) } : null);
    resetDetailSlotManagerState();
    setTimeout(() => setFeedbackMessage(null), 2000);
  }, [currentDetailSlotType, currentDetailStartTime, currentDetailEndTime, editingCurrentDetailSlotId, internalRoomData, isSlotLockedForEditing, resetDetailSlotManagerState]);

  const handleLoadDetailSlotForEdit = useCallback((slotToEdit: DefaultTimeSlot) => {
    if (isSlotLockedForEditing(slotToEdit)) {
        setFeedbackMessage({ type: 'error', message: "This slot cannot be modified as it has future assignments." });
        setTimeout(() => setFeedbackMessage(null), 3500);
        return;
    }
    setEditingCurrentDetailSlotId(slotToEdit.id);
    setCurrentDetailSlotType(slotToEdit.type);
    setCurrentDetailStartTime(slotToEdit.startTime);
    setCurrentDetailEndTime(slotToEdit.endTime);
    setCurrentDetailSlotFormError(null);
    setFeedbackMessage(null);
    document.getElementById('room-detail-slot-form-section')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [isSlotLockedForEditing]);

  const deleteDetailSlotById = useCallback((idToDelete: string) => {
    if (!internalRoomData) return;
    
    const slotToDelete = (internalRoomData.roomSpecificSlots || []).find(s => s.id === idToDelete);
    if (slotToDelete && isSlotLockedForEditing(slotToDelete)) {
        setFeedbackMessage({type: 'error', message:"Cannot delete a slot with future assignments."});
        setTimeout(() => setFeedbackMessage(null), 3000);
        return;
    }

    const updatedSlots = (internalRoomData.roomSpecificSlots || []).filter(slot => slot.id !== idToDelete);
    setInternalRoomData(prev => prev ? { ...prev, roomSpecificSlots: updatedSlots } : null);
    if (editingCurrentDetailSlotId === idToDelete) {
        resetDetailSlotManagerState();
    }
    setFeedbackMessage({type: 'success', message:"Slot removed from list."});
    setTimeout(() => setFeedbackMessage(null), 2000);
  }, [editingCurrentDetailSlotId, internalRoomData, isSlotLockedForEditing, resetDetailSlotManagerState]);
  
  const handleCancelDetailSlotEdit = useCallback(() => {
    resetDetailSlotManagerState();
  }, [resetDetailSlotManagerState]);

  const handleLoadTemplateForRoomSlots = useCallback(() => {
    setCurrentDetailSlotFormError(null);
    setFeedbackMessage(null);
    if (!internalRoomData) return;

    if (!internalRoomData.assignedToPId) {
        setCurrentDetailSlotFormError("A primary program must be assigned to the room before loading its slot template.");
        setTimeout(() => setCurrentDetailSlotFormError(null), 3500);
        return;
    }

    const assignedProgram = allPrograms.find(p => p.pId === internalRoomData.assignedToPId);

    if (!assignedProgram) {
        setCurrentDetailSlotFormError(`Program with P-ID '${internalRoomData.assignedToPId}' not found.`);
        setTimeout(() => setCurrentDetailSlotFormError(null), 3500);
        return;
    }

    const programTemplateSlots = assignedProgram.programSpecificSlots || [];

    if (programTemplateSlots.length === 0) {
        setInternalRoomData(prev => prev ? { ...prev, roomSpecificSlots: [] } : null);
        setFeedbackMessage({type: 'success', message: `Assigned program '${assignedProgram.shortName}' has no specific slots. Room's list has been cleared.`});
        setTimeout(() => setFeedbackMessage(null), 3000);
        resetDetailSlotManagerState();
        return;
    }
    
    const roomTypeName = getTypeName(internalRoomData.typeId).toLowerCase();
    
    let filteredTemplateSlots = programTemplateSlots;
    let feedbackType = 'all';

    if (roomTypeName.includes('theory') || (roomTypeName.includes('class') && !roomTypeName.includes('lab'))) {
        filteredTemplateSlots = programTemplateSlots.filter(slot => slot.type === 'Theory');
        feedbackType = 'Theory';
    } else if (roomTypeName.includes('lab')) {
        filteredTemplateSlots = programTemplateSlots.filter(slot => slot.type === 'Lab');
        feedbackType = 'Lab';
    }
    
    const newSlotsForRoom = filteredTemplateSlots.map(templateSlot => ({
        ...templateSlot,
        id: `room-slot-${Date.now()}-${Math.random().toString(16).substring(2)}`
    }));

    setInternalRoomData(prev => prev ? { ...prev, roomSpecificSlots: newSlotsForRoom.sort(sortSlotsByTypeThenTime) } : null);
    
    const feedbackMessageText = newSlotsForRoom.length > 0
        ? `${newSlotsForRoom.length} ${feedbackType !== 'all' ? feedbackType : ''} slot(s) loaded from program '${assignedProgram.shortName}'.`
        : `No matching ${feedbackType !== 'all' ? feedbackType : ''} slots found in the program template.`;

    setFeedbackMessage({type: 'success', message: feedbackMessageText});
    setTimeout(() => setFeedbackMessage(null), 3000);
    resetDetailSlotManagerState();
    
  }, [internalRoomData, allPrograms, getTypeName, resetDetailSlotManagerState]);

  const handleSaveAllChanges = async () => {
    if (!internalRoomData) return;
    setOverallFormError(null);
    setFeedbackMessage(null);

    if (!internalRoomData.floorId || !internalRoomData.categoryId || !internalRoomData.typeId || !internalRoomData.roomNumber.trim() || internalRoomData.capacity <= 0) {
      setOverallFormError('Floor, Category, Type, Room Number, and valid Capacity (>0) are required for the room.');
      if (activeTab !== 'details') {
        setActiveTab('details');
      }
      return;
    }

    try {
        await onSaveRoom(internalRoomData);
        // The modal will now close immediately upon successful save.
        onClose(); 
    } catch (e: any) {
        const errorMessage = e.message || "Failed to save room changes.";
        setOverallFormError(errorMessage);
        setFeedbackMessage({type: 'error', message: errorMessage});
        if (activeTab !== 'details' && (errorMessage.includes('Floor') || errorMessage.includes('Category') || errorMessage.includes('Type') || errorMessage.includes('Capacity'))) {
            setActiveTab('details');
        }
    }
  };

  const filteredDetailModalSlots = useMemo(() => {
    const currentSlots = internalRoomData?.roomSpecificSlots || [];
    if (activeDetailSlotFilterTab === 'All') return [...currentSlots].sort(sortSlotsByTypeThenTime);
    return currentSlots.filter(slot => slot.type === activeDetailSlotFilterTab).sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [internalRoomData?.roomSpecificSlots, activeDetailSlotFilterTab]);

  const getDetailModalSlotCount = (tabType: RoomDetailSlotFilterType): number => {
    const currentSlots = internalRoomData?.roomSpecificSlots || [];
    if (tabType === 'All') return currentSlots.length;
    return currentSlots.filter(slot => slot.type === tabType).length;
  };
  
  const floorOptions = useMemo(() => allFloorsForBuilding.map(f => ({ id: f.id, name: f.floorName })), [allFloorsForBuilding]);
  const categoryOptions = useMemo(() => allCategories.map(c => ({ id: c.id, name: c.categoryName })), [allCategories]);
  const roomTypeOptions = useMemo(() => allRoomTypes.map(t => ({ id: t.id, name: t.typeName })), [allRoomTypes]);

  // Content for "Edit Room Physical Details" Tab
  const roomEditFormContent = ( 
    <fieldset className="border border-gray-300 p-3 rounded-md" disabled={!permissions.canEditDetailsTab}>
      <legend className="text-sm font-medium text-gray-700 px-1">Room Physical Details</legend>
      <div className="mt-2 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-3 gap-y-2"> {/* Changed to 3 columns */}
            <div>
                <label htmlFor="floorId-scd-modal-details" className="block text-xs font-medium text-gray-700 mb-1">Floor *</label>
                <SearchableCreatableDropdown
                    idPrefix="floorId-modal-details" options={floorOptions} value={internalRoomData?.floorId || null}
                    onChange={(id) => handleRoomDataChange('floorId', id || '')}
                    onCreate={handleCreateFloorInModal} placeholder="Floor..."
                />
            </div>
            <div>
                <label htmlFor="categoryId-scd-modal-details" className="block text-xs font-medium text-gray-700 mb-1">Category *</label>
                <SearchableCreatableDropdown
                    idPrefix="categoryId-modal-details" options={categoryOptions} value={internalRoomData?.categoryId || null}
                    onChange={(id) => handleRoomDataChange('categoryId', id || '')}
                    onCreate={handleCreateCategoryInModal} placeholder="Category..."
                />
            </div>
            <div>
                <label htmlFor="typeId-scd-modal-details" className="block text-xs font-medium text-gray-700 mb-1">Type *</label>
                <SearchableCreatableDropdown
                    idPrefix="typeId-modal-details" options={roomTypeOptions} value={internalRoomData?.typeId || null}
                    onChange={(id) => handleRoomDataChange('typeId', id || '')}
                    onCreate={handleCreateTypeInModal} placeholder="Type..."
                />
            </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-3 gap-y-2"> {/* New row for Room No, Capacity, Semester */}
             <div>
                <label htmlFor="roomNumber-modal-details" className="block text-xs font-medium text-gray-700 mb-1">Room No. *</label>
                <input type="text" name="roomNumber" id="roomNumber-modal-details" value={internalRoomData?.roomNumber || ''} onChange={handleRoomInputChange} required
                       className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-1 focus:ring-teal-500 focus:border-teal-500"/>
            </div>
            <div>
                <label htmlFor="capacity-modal-details" className="block text-xs font-medium text-gray-700 mb-1">Capacity *</label>
                <input type="number" name="capacity" id="capacity-modal-details" value={internalRoomData?.capacity || 0} onChange={handleRoomInputChange} required min="1"
                       className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-1 focus:ring-teal-500 focus:border-teal-500"/>
            </div>
             <div>
                <label htmlFor="semesterId-modal-details" className="block text-xs font-medium text-gray-700 mb-1">Semester</label>
                <select
                    name="semesterId"
                    id="semesterId-modal-details"
                    value={internalRoomData?.semesterId || ''}
                    onChange={handleRoomInputChange}
                    className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-1 focus:ring-teal-500 focus:border-teal-500 text-sm h-[40px]" // Matched height of SearchableCreatableDropdown approx.
                >
                    <option value="">-- Select Semester --</option>
                    {uniqueSemesters.map(semester => (
                    <option key={semester} value={semester}>{semester}</option>
                    ))}
                </select>
            </div>
        </div>
      </div>
    </fieldset>
  );

  // Content for "Room Specific Time Slots" Tab
  const roomSpecificSlotsManager = (
    <fieldset className="border border-gray-300 p-3 rounded-md" disabled={!permissions.canEditSlotsTab}>
        <legend className="text-sm font-medium text-gray-700 px-1">Manage Room Specific Time Slots</legend>
        <div className="mt-2 flex flex-col md:flex-row gap-4">
            {/* Left Column: Input Form */}
            <div className="md:w-2/5 lg:w-1/3 space-y-3">
                <div id="room-detail-slot-form-section" className={`p-2 sm:p-2.5 rounded-md bg-gray-100 shadow-inner ${editingCurrentDetailSlotId ? 'border border-teal-300' : ''} space-y-2`}>
                    <div>
                        <label htmlFor="currentDetailSlotType" className="block text-[11px] font-medium text-gray-500 mb-0.5">Type</label>
                        <select id="currentDetailSlotType" value={currentDetailSlotType ?? ""} onChange={(e) => setCurrentDetailSlotType(e.target.value as 'Theory'|'Lab'|null)}
                            className="w-full p-1 rounded-md text-xs border border-gray-300 focus:ring-1 focus:ring-teal-500 focus:border-transparent h-[26px] bg-teal-50">
                            <option value="" disabled>Select Type...</option><option value="Theory">Theory</option><option value="Lab">Lab</option>
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                        <div>
                            <label htmlFor="currentDetailStartTime" className="block text-[11px] font-medium text-gray-500 mb-0.5">Start Time</label>
                            <input type="time" id="currentDetailStartTime" value={currentDetailStartTime} onChange={(e) => setCurrentDetailStartTime(e.target.value)}
                                className="w-full p-1 rounded-md text-xs border border-gray-300 focus:ring-1 focus:ring-teal-500 focus:border-transparent bg-teal-50 h-[26px]"/>
                        </div>
                        <div>
                            <label htmlFor="currentDetailEndTime" className="block text-[11px] font-medium text-gray-500 mb-0.5">End Time</label>
                            <input type="time" id="currentDetailEndTime" value={currentDetailEndTime} onChange={(e) => setCurrentDetailEndTime(e.target.value)}
                                className="w-full p-1 rounded-md text-xs border border-gray-300 focus:ring-1 focus:ring-teal-500 focus:border-transparent bg-teal-50 h-[26px]"/>
                        </div>
                    </div>
                     <div className="flex items-center justify-end gap-1.5 pt-1">
                        {editingCurrentDetailSlotId && (<>
                            <button onClick={handleCancelDetailSlotEdit} type="button" className="px-2.5 py-[5px] bg-gray-300 hover:bg-gray-400 text-gray-700 text-xs font-medium rounded transition-colors">Cancel</button>
                        </>)}
                        <button onClick={handleDetailSlotSubmit} type="button" className="px-2.5 py-[5px] bg-teal-500 hover:bg-teal-600 text-white text-xs font-medium rounded transition-colors">
                            {editingCurrentDetailSlotId ? 'Update Slot' : 'Add Slot'}
                        </button>
                    </div>
                </div>
                {currentDetailSlotFormError && !feedbackMessage?.message.includes(currentDetailSlotFormError) && <p className="text-xs text-red-600 p-1.5 bg-red-100 border border-red-300 rounded-md">{currentDetailSlotFormError}</p>}
            </div>

            {/* Right Column: Filter Tabs, Load Template & Table */}
            <div className="md:w-3/5 lg:w-2/3 flex flex-col">
                 <div className="flex-shrink-0 flex flex-col sm:flex-row justify-between items-center mb-1.5 pb-1 border-b border-gray-200 gap-2">
                    <div className="flex space-x-1">
                        {(['All', 'Theory', 'Lab'] as RoomDetailSlotFilterType[]).map(tabType => (
                            <button key={tabType} onClick={() => setActiveDetailSlotFilterTab(tabType)}
                                className={`px-2 py-0.5 text-[11px] font-medium rounded-t-md flex items-center transition-colors ${activeDetailSlotFilterTab === tabType ? 'bg-teal-600 text-white' : 'bg-teal-100 text-teal-700 hover:bg-teal-200'}`}
                                aria-pressed={activeDetailSlotFilterTab === tabType}>
                                {tabType}
                                <span className={`ml-1 text-[9px] px-1 py-0 rounded-full min-w-[14px] text-center ${activeDetailSlotFilterTab === tabType ? 'bg-white text-teal-600' : 'bg-teal-500 text-white'}`}>
                                    {getDetailModalSlotCount(tabType)}
                                </span>
                            </button>
                        ))}
                    </div>
                    <div className="mt-2 sm:mt-0">
                        <button
                            onClick={handleLoadTemplateForRoomSlots} type="button"
                            className="px-2.5 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-medium rounded-md transition-colors flex items-center justify-center"
                            title="Load template slots into this room's list">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                            Load Template Slots
                        </button>
                    </div>
                </div>
                
                <div className="flex-grow min-h-0">
                  {(internalRoomData?.roomSpecificSlots || []).length === 0 ? (
                      <div className="flex-grow flex flex-col items-center justify-center text-center p-4 text-gray-400 text-xs italic h-full">
                          No room-specific slots defined. Add slots using the form or load a template.
                      </div>
                  ) : filteredDetailModalSlots.length === 0 ? (
                      <div className="flex-grow flex flex-col items-center justify-center text-center p-4 text-gray-400 text-xs italic h-full">
                          No {activeDetailSlotFilterTab.toLowerCase()} slots found. Try a different filter or add slots.
                      </div>
                  ) : (
                    <div className="overflow-y-auto custom-scrollbar max-h-60 border border-gray-200 rounded-md shadow-sm">
                      <table className="min-w-full divide-y divide-gray-200 text-xs">
                        <thead className="bg-gray-50 sticky top-0 z-10">
                          <tr>
                            <th scope="col" className="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Type</th>
                            <th scope="col" className="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Start</th>
                            <th scope="col" className="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">End</th>
                            <th scope="col" className="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">Duration</th>
                            <th scope="col" className="px-3 py-2 text-right font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {filteredDetailModalSlots.map(slot => {
                            const isLocked = isSlotLockedForEditing(slot);
                            return (
                                <tr key={slot.id} className={`transition-colors ${isLocked ? 'bg-slate-100 text-gray-500' : 'hover:bg-gray-50'}`}>
                                <td className={`px-3 py-2 whitespace-nowrap font-medium ${isLocked ? '' : slot.type === 'Lab' ? 'text-blue-600' : 'text-green-600'}`}>{slot.type}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-gray-700">{formatTimeToAMPM(slot.startTime)}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-gray-700">{formatTimeToAMPM(slot.endTime)}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-gray-500 hidden sm:table-cell">{calculateDuration(slot.startTime, slot.endTime)} min</td>
                                <td className="px-3 py-2 whitespace-nowrap text-right space-x-2">
                                  {isLocked && (
                                      <span className="inline-block" title="Slot has future assignments and cannot be modified.">
                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline-block text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                                              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                          </svg>
                                      </span>
                                  )}
                                  <button onClick={() => handleLoadDetailSlotForEdit(slot)} disabled={isLocked} className="text-teal-600 hover:text-teal-800 p-0.5 rounded focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:text-gray-300 disabled:cursor-not-allowed" title={isLocked ? "Cannot edit: Slot is in use" : "Edit Slot"} aria-label={isLocked ? `Cannot edit slot ${slot.type}` : `Edit slot ${slot.type}`} >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>
                                  </button>
                                  <button onClick={(e) => { e.stopPropagation(); deleteDetailSlotById(slot.id); }} disabled={isLocked} className="text-red-500 hover:text-red-700 p-0.5 rounded focus:outline-none focus:ring-1 focus:ring-red-500 disabled:text-gray-300 disabled:cursor-not-allowed" title={isLocked ? "Cannot delete: Slot is in use" : "Delete Slot"} aria-label={isLocked ? `Cannot delete slot ${slot.type}` : `Delete slot ${slot.type}`} >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                  </button>
                                </td>
                            </tr>
                          );})}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
            </div>
        </div>
    </fieldset>
  );

  const handlePreviewRoutinePDF = useCallback(() => {
    if (!internalRoomData) return;

    const doc = new jsPDF({ orientation: 'landscape' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageMargin = 14;

    const buildingName = getBuildingName(internalRoomData.buildingId);
    const roomNumber = internalRoomData.roomNumber;
    const assignedProgram = allPrograms.find(p => p.pId === internalRoomData.assignedToPId);
    const programName = assignedProgram ? assignedProgram.shortName : 'Not Assigned';

    let currentY = 12;
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text("Daffodil International University", pageWidth / 2, currentY, { align: 'center' });
    currentY += 7;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Class Routine (${internalRoomData.semesterId || 'N/A'})`, pageWidth / 2, currentY, { align: 'center' });
    currentY += 8;
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`${buildingName} - Room: ${roomNumber}`, pageWidth / 2, currentY, { align: 'center' });
    currentY += 5;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Assigned Program: ${programName}`, pageWidth / 2, currentY, { align: 'center' });
    currentY += 4;
    doc.text(`Capacity: ${internalRoomData.capacity} | Type: ${getTypeName(internalRoomData.typeId)}`, pageWidth / 2, currentY, { align: 'center' });
    
    const tableStartY = currentY + 7;

    const slotsForHeaders = ((internalRoomData.roomSpecificSlots?.length ?? 0) > 0 
      ? internalRoomData.roomSpecificSlots 
      : systemDefaultSlots) || [];
    
    const theorySlots = slotsForHeaders.filter(s => s.type === 'Theory').sort(sortSlotsByTypeThenTime);
    const labSlots = slotsForHeaders.filter(s => s.type === 'Lab').sort(sortSlotsByTypeThenTime);
    
    const formatSlotHeader = (slot: DefaultTimeSlot) => formatSlotObjectToStringApp(slot).replace(' - ', '\n');

    const head: any[] = [];
    const headRow1: any[] = [{ content: 'Day', rowSpan: 2, styles: { valign: 'middle' } }];
    const headRow2: string[] = [];
    
    if (theorySlots.length > 0) {
        headRow1.push({ content: 'Theory Slots', colSpan: theorySlots.length, styles: { halign: 'center' } });
        headRow2.push(...theorySlots.map(formatSlotHeader));
    }
    if (labSlots.length > 0) {
        headRow1.push({ content: 'Lab Slots', colSpan: labSlots.length, styles: { halign: 'center' } });
        headRow2.push(...labSlots.map(formatSlotHeader));
    }
    head.push(headRow1, headRow2);

    const semesterData = internalRoomData.semesterId ? fullRoutineData[internalRoomData.semesterId] : {};
    
    const tableBody = DAYS_OF_WEEK.map(day => {
        const row: (string)[] = [day];
        [...theorySlots, ...labSlots].forEach(slotObj => {
            const slotStringForLookup = formatSlotObjectToStringApp(slotObj);
            const classInfo = semesterData[day as DayOfWeek]?.[internalRoomData.roomNumber]?.[slotStringForLookup];
            row.push(classInfo ? `${classInfo.courseCode} (${classInfo.section})\n${classInfo.teacher}` : "-");
        });
        return row;
    });
    
    autoTable(doc, {
        head: head,
        body: tableBody,
        startY: tableStartY,
        theme: 'grid',
        styles: { 
            fontSize: 9, cellPadding: 0.8, halign: 'center', valign: 'middle',
            font: 'helvetica', lineColor: [0, 0, 0], lineWidth: 0.2,
        },
        headStyles: { 
            fontSize: 9, fillColor: '#dbdbdb', textColor: [0, 0, 0], fontStyle: 'bold' 
        },
        columnStyles: { 
            0: { fontStyle: 'bold', cellWidth: 25, fontSize: 9, fillColor: '#dbdbdb', textColor: [0, 0, 0] } 
        },
        didDrawPage: (data) => {
            const pageCount = (doc as any).internal.getNumberOfPages();
            let footerY = doc.internal.pageSize.getHeight() - 25;
            
            doc.setFontSize(8);
            doc.text(`Page ${data.pageNumber} of ${pageCount}`, pageWidth - pageMargin, doc.internal.pageSize.height - 10, { align: 'right' });
            
            doc.setLineWidth(0.2);
            doc.line(pageMargin, footerY, pageMargin + 50, footerY);
            footerY += 4;
            doc.setFont('helvetica', 'normal');
            doc.text("Authority Signature", pageMargin, footerY);

            footerY = doc.internal.pageSize.getHeight() - 25;
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text(roomNumber, pageWidth - pageMargin, footerY, { align: 'right' });
            footerY += 4.5;
            doc.setFont('helvetica', 'normal');
            doc.text(buildingName, pageWidth - pageMargin, footerY, { align: 'right' });
            footerY += 4.5;
            doc.text(`Assigned: ${programName}`, pageWidth - pageMargin, footerY, { align: 'right' });
        },
    });

    const pdfDataUri = doc.output('datauristring');
    const newWindow = window.open();
    if (newWindow) {
        newWindow.document.write(`<html style="height:100%;"><body style="margin:0;height:100%;"><iframe width='100%' height='100%' src='${pdfDataUri}' title='PDF Preview'></iframe></body></html>`);
        newWindow.document.title = `Room_${internalRoomData.roomNumber}_Routine.pdf`;
    } else {
        alert("Please allow pop-ups for this website to preview the PDF.");
    }
  }, [internalRoomData, systemDefaultSlots, activeDetailSlotFilterTab, fullRoutineData, getBuildingName, getTypeName, allPrograms]);


   // Content for "Class Routine" Tab
   const classRoutineTabContent = useMemo(() => {
    if (!internalRoomData) return null;

    const semesterData = internalRoomData.semesterId ? fullRoutineData[internalRoomData.semesterId] : {};
    
    const slotsForHeaders = ((internalRoomData.roomSpecificSlots?.length ?? 0) > 0 
      ? internalRoomData.roomSpecificSlots 
      : systemDefaultSlots) || [];
      
    const roomTypeName = getTypeName(internalRoomData.typeId).toLowerCase();
    let filterAppliedMessage: string;
    let headerSlotsForRoutineTab: DefaultTimeSlot[];

    if (roomTypeName.includes('theory')) {
        headerSlotsForRoutineTab = slotsForHeaders.filter(s => s.type === 'Theory');
        filterAppliedMessage = `Theory Slots`;
    } else if (roomTypeName.includes('lab')) {
        headerSlotsForRoutineTab = slotsForHeaders.filter(s => s.type === 'Lab');
        filterAppliedMessage = `Lab Slots`;
    } else {
        headerSlotsForRoutineTab = (activeDetailSlotFilterTab === 'All' 
            ? slotsForHeaders 
            : slotsForHeaders.filter(s => s.type === activeDetailSlotFilterTab)
        );
        filterAppliedMessage = `${activeDetailSlotFilterTab} Slots`;
    }
    
    headerSlotsForRoutineTab = headerSlotsForRoutineTab.sort(sortSlotsByTypeThenTime);

    if (headerSlotsForRoutineTab.length === 0) {
      return (
        <div className="text-center py-6 text-gray-500 italic">
          No applicable time slots to display for the current filter ({filterAppliedMessage}).
        </div>
      );
    }
    
    const cellHeight = "h-12 min-h-12 max-h-12"; 
    const cellWidth = "w-24 min-w-24 max-w-24"; 
    const dayHeaderWidth = "w-24 min-w-24 max-w-24";


    return (
      <div className="space-y-2">
        <div className="overflow-auto custom-scrollbar p-1 bg-gray-100 rounded-md">
            <table className="min-w-full table-fixed border-separate border-spacing-1">
            <thead className="sticky top-0 z-10 bg-gray-100">
                <tr>
                <th className={`sticky left-0 z-20 ${dayHeaderWidth} bg-teal-700 text-white shadow-sm rounded-md px-1 py-1 text-[9px] font-semibold`}>Day/Time</th>
                {headerSlotsForRoutineTab.map(slotObj => (
                    <th key={slotObj.id} className={`${cellWidth} bg-teal-700 text-white shadow-sm rounded-md px-1 py-1 text-[9px] font-semibold whitespace-normal break-words`}>
                    {formatSlotObjectToStringApp(slotObj).replace(/\s*-\s*/, '-')}
                    </th>
                ))}
                </tr>
            </thead>
            <tbody className="bg-transparent">
                {DAYS_OF_WEEK.map(day => (
                <tr key={day}>
                    <td className={`sticky left-0 z-10 ${cellHeight} ${dayHeaderWidth} p-0 align-middle`}>
                    <div className="h-full flex items-center justify-center bg-teal-600 text-white shadow-sm rounded-md text-[9px] font-medium p-1 text-center">
                        {day}
                    </div>
                    </td>
                    {headerSlotsForRoutineTab.map(slotObj => {
                    const slotStringForLookup = formatSlotObjectToStringApp(slotObj);
                    const classInfo = semesterData[day as DayOfWeek]?.[internalRoomData.roomNumber]?.[slotStringForLookup];
                    
                    let isSlotEffectivelyInactive = false;
                    const roomActiveSlots = ((internalRoomData.roomSpecificSlots?.length ?? 0) > 0 
                                                ? internalRoomData.roomSpecificSlots 
                                                : systemDefaultSlots) || [];
                    
                    const isSlotListedForRoom = roomActiveSlots.some(roomSlot => 
                        roomSlot.type === slotObj.type && 
                        roomSlot.startTime === slotObj.startTime && 
                        roomSlot.endTime === slotObj.endTime
                    );

                    if(!isSlotListedForRoom) {
                        isSlotEffectivelyInactive = true;
                    }

                    return (
                        <td key={`${day}-${slotObj.id}`} className={`${cellHeight} ${cellWidth} p-0 align-top bg-transparent`}>
                        <ClassCellModal classInfo={classInfo} isInactiveSlot={isSlotEffectivelyInactive}/>
                        </td>
                    );
                    })}
                </tr>
                ))}
            </tbody>
            </table>
        </div>
      </div>
    );
  }, [internalRoomData, systemDefaultSlots, activeDetailSlotFilterTab, fullRoutineData, getTypeName]);


  const modalContent = internalRoomData ? (
    <div className="flex flex-col h-full bg-gray-50">
      {buildingForRoom && (
        <div className="relative h-44 flex-shrink-0 overflow-hidden group">
            <img 
                src={buildingForRoom.thumbnailUrl} 
                alt={`Cover for ${buildingForRoom.buildingName}`} 
                className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/80"></div>
            
            <button
                onClick={onClose}
                className="absolute top-2 right-2 z-10 text-white/70 hover:text-white bg-black/20 hover:bg-black/40 p-1.5 rounded-full transition-colors"
                aria-label="Close modal"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
            
            <div className="absolute inset-0 p-4 flex items-center justify-center">
                <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4 text-center text-white">
                    <h3 className="text-4xl md:text-5xl font-bold text-shadow-md">
                        {internalRoomData.roomNumber}
                    </h3>
                    <p className="mt-2 text-sm text-gray-200 text-shadow">
                        <span title={`Floor: ${getFloorName(internalRoomData.floorId)}`}>{getFloorName(internalRoomData.floorId) || 'N/A Floor'}</span>
                        <span className="text-gray-400 mx-2" aria-hidden="true">|</span>
                        <span title={`Type: ${getTypeName(internalRoomData.typeId)}`}>{getTypeName(internalRoomData.typeId) || 'N/A Type'}</span>
                        <span className="text-gray-400 mx-2" aria-hidden="true">|</span>
                        <span title={`Capacity: ${internalRoomData.capacity} students`}>Capacity: {internalRoomData.capacity}</span>
                        {internalRoomData.semesterId && (
                            <>
                                <span className="text-gray-400 mx-2" aria-hidden="true">|</span>
                                <span title={`Semester: ${internalRoomData.semesterId}`}>Sem: {internalRoomData.semesterId}</span>
                            </>
                        )}
                    </p>
                </div>
            </div>
             <button
                onClick={handlePreviewRoutinePDF}
                className="absolute bottom-3 left-3 z-10 px-3 py-1.5 bg-white/20 backdrop-blur-sm text-white text-xs font-medium rounded-md shadow-sm hover:bg-white/30 transition-colors flex items-center"
                aria-label="Preview routine as PDF"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1.5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                    <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.022 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                </svg>
                Preview PDF
            </button>
        </div>
      )}
      <div className="flex-grow overflow-y-auto custom-scrollbar p-3 sm:p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div title={isPrimaryProgramLocked ? "Cannot change primary program as this room has scheduled classes." : ""}>
              <label className="block text-xs font-medium text-gray-700 mb-1">Assign to Program (Primary)</label>
              <SearchableProgramDropdownForRooms
                  idSuffix="assign-modal"
                  programs={allPrograms}
                  selectedProgramPId={internalRoomData.assignedToPId}
                  onProgramSelect={handleAssignedProgramSelect}
                  placeholderText="Select Primary Program"
                  disabled={isPrimaryProgramLocked || !permissions.canEditAssignToProgram}
              />
          </div>
          <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Share with Programs (Optional)</label>
              <SearchableProgramDropdownForRooms
                  idSuffix="share-modal"
                  programs={allPrograms}
                  selectedPIds={internalRoomData.sharedWithPIds}
                  onPIdsChange={handleSharedProgramsChange}
                  multiSelect={true}
                  filterOutPId={internalRoomData.assignedToPId}
                  placeholderText="Select Shared Programs"
                  disabled={!internalRoomData.assignedToPId || !permissions.canEditShareWithPrograms}
              />
          </div>
        </div>
        <div className="space-y-4 mt-4">
          {/* Tab Buttons */}
          <div className="mb-3 border-b border-gray-200">
            <nav className="-mb-px flex space-x-3" aria-label="Tabs">
              {[
                { id: 'routine' as ActiveModalTab, label: 'Class Routine' },
                { id: 'details' as ActiveModalTab, label: 'Edit Details', permission: permissions.canEditDetailsTab },
                { id: 'slots' as ActiveModalTab, label: 'Specific Slots', permission: permissions.canEditSlotsTab },
              ].map(tab => {
                if (tab.permission === false) return null; // Don't render the tab if permission is explicitly false

                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`whitespace-nowrap py-2.5 px-1 border-b-2 font-medium text-sm transition-colors
                      ${activeTab === tab.id
                        ? 'border-teal-500 text-teal-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    aria-current={activeTab === tab.id ? 'page' : undefined}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="mt-2">
            {activeTab === 'details' && roomEditFormContent}
            {activeTab === 'slots' && roomSpecificSlotsManager}
            {activeTab === 'routine' && classRoutineTabContent}
          </div>

          {overallFormError && (
            <p className="text-xs text-red-600 mt-2 p-2 bg-red-100 border border-red-300 rounded-md">
                {overallFormError}
            </p>
          )}
          {feedbackMessage && !overallFormError && ( 
             <p className={`text-xs mt-2 p-2 rounded-md border ${feedbackMessage.type === 'success' ? 'bg-green-100 border-green-300 text-green-700' : 'bg-red-100 border-red-300 text-red-700'}`}>
               {feedbackMessage.message}
             </p>
          )}
        </div>
      </div>
    </div>
  ) : null;
  
  const footerContent = internalRoomData ? (
      <div className="flex justify-end gap-3">
          <button 
              type="button" 
              onClick={onClose} 
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md border border-gray-300"
          >
              Close
          </button>
          <button 
              type="button" 
              onClick={handleSaveAllChanges}
              disabled={!canSaveChanges}
              className="px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-md border border-transparent disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
              Save
          </button>
      </div>
  ) : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      hideHeader={true}
      footerContent={footerContent}
      zIndex={zIndex}
      maxWidthClass="max-w-6xl"
      bodyClassName="p-0 flex-grow overflow-hidden"
    >
      {modalContent || <div className="p-8 text-center text-gray-500">Loading...</div>}
    </Modal>
  );
};

export default RoomDetailModal;