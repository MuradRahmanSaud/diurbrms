import React, { useState, useEffect, useCallback, ChangeEvent, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useBuildings } from '../contexts/BuildingContext';
import { useFloors } from '../contexts/FloorContext';
import { useRoomCategories } from '../contexts/RoomCategoryContext';
import { useRoomTypes } from '../contexts/RoomTypeContext';
import { useRooms } from '../contexts/RoomContext';
import { usePrograms } from '../contexts/ProgramContext';
import { RoomEntry, FloorEntry, RoomCategoryEntry, RoomTypeEntry, ProgramEntry, DefaultTimeSlot, RoomDetailSlotFilterType, FullRoutineData, DayOfWeek, ScheduleOverrides, SemesterCloneInfo, BuildingEntry, User } from '../types';
import Modal from './Modal'; 
import RoomDetailModal from './modals/RoomDetailModal'; 
import SearchableProgramDropdownForRooms from './SearchableProgramDropdownForRooms';
import SearchableCreatableDropdown from './SearchableCreatableDropdown'; 
import { SEED_DEFAULT_SLOTS_DATA, sortSlotsByTypeThenTime } from '../data/slotConstants';

interface BuildingRoomsViewProps {
  user: User | null;
  buildingId: string | null;
  uniqueSemesters: string[];
  routineData: { [semesterId: string]: FullRoutineData };
  onClose: () => void;
  selectedSemesterIdForRoutineView: string | null;
  setSelectedSemesterIdForRoutineView: (semesterId: string | null) => void;
  disableSemesterFilter?: boolean;
  layout?: 'default' | 'sidebar';
  activeProgramId?: string | null;
  allPrograms?: ProgramEntry[];
  systemDefaultSlots?: DefaultTimeSlot[];
  allRoomTypes?: RoomTypeEntry[];
  scheduleOverrides: ScheduleOverrides;
  allSemesterConfigurations: SemesterCloneInfo[];
}

const initialRoomFormState: Omit<RoomEntry, 'id' | 'buildingId' | 'roomSpecificSlots'> & { id?: string, roomSpecificSlots?: DefaultTimeSlot[], semesterId?: string } = {
  floorId: '',
  categoryId: '',
  typeId: '',
  roomNumber: '',
  capacity: 0,
  assignedToPId: undefined,
  sharedWithPIds: [],
  roomSpecificSlots: [],
  semesterId: undefined,
};

// --- Helper Functions ---
const formatTimeToAMPM = (time24: string): string => {
  if (!time24) return 'N/A';
  try {
    const [hours, minutes] = time24.split(':');
    let h = parseInt(hours, 10);
    const m = parseInt(minutes, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12; h = h ? h : 12; 
    const hStr = h < 10 ? '0' + h : h.toString();
    const mStr = m < 10 ? '0' + m : m.toString();
    return `${hStr}:${mStr} ${ampm}`;
  } catch (e) {
    return 'Invalid Time';
  }
};

const formatSlotObjectToString = (slot: DefaultTimeSlot): string => {
  if (!slot || !slot.startTime || !slot.endTime) return 'Invalid Slot';
  return `${formatTimeToAMPM(slot.startTime)} - ${formatTimeToAMPM(slot.endTime)}`;
};


// --- Sub-components ---

const MultiSelectFilterDropdown = ({ title, options, selectedValues, onSelectionChange }: { title: string; options: {id: string; name: string}[]; selectedValues: string[]; onSelectionChange: (id: string) => void }) => {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [ref]);

    const getButtonLabel = () => {
        if (selectedValues.length === 0) return title;
        if (selectedValues.length === 1) {
            const selectedOption = options.find(opt => opt.id === selectedValues[0]);
            return selectedOption?.name || title;
        }
        return `${selectedValues.length} ${title.endsWith('s') ? title : title + 's'} selected`;
    };

    return (
        <div className="relative" ref={ref}>
            <button onClick={() => setIsOpen(!isOpen)} className="w-full text-left text-xs bg-white border border-gray-300 rounded-md shadow-sm p-1 flex justify-between items-center hover:bg-gray-50 h-7">
                <span className="truncate">{getButtonLabel()}</span>
                <svg className={`w-3 h-3 text-gray-500 transform transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </button>
            {isOpen && (
                <div className="absolute z-20 mt-1 w-full bg-white rounded-md shadow-lg border border-gray-200 max-h-48 overflow-y-auto custom-scrollbar">
                    {options.length === 0 ? <div className="p-1.5 text-xs text-gray-400 italic">No options</div> : options.map(option => (
                        <label key={option.id} className="flex items-center gap-2 p-1.5 text-xs hover:bg-gray-100 cursor-pointer">
                            <input type="checkbox" checked={selectedValues.includes(option.id)} onChange={() => onSelectionChange(option.id)} className="h-3 w-3 rounded text-teal-600 focus:ring-teal-500 border-gray-300"/>
                            <span className="truncate">{option.name}</span>
                        </label>
                    ))}
                </div>
            )}
        </div>
    );
};


const BuildingRoomsView: React.FC<BuildingRoomsViewProps> = ({ 
    user,
    buildingId, 
    uniqueSemesters, 
    routineData, 
    onClose, 
    selectedSemesterIdForRoutineView, 
    setSelectedSemesterIdForRoutineView, 
    disableSemesterFilter = false,
    layout = 'default',
    activeProgramId,
    allPrograms = [],
    systemDefaultSlots = [],
    allRoomTypes = [],
    scheduleOverrides,
    allSemesterConfigurations,
}) => {
  const { buildings, getBuildingById: getBuildingByIdContext , loading: buildingsLoading } = useBuildings(); 
  const { floors, getFloorsByBuildingId, addFloor: addFloorContextGlobally, loading: floorsLoading } = useFloors(); // Renamed addFloor from context
  const { categories, addCategory: addRoomCategoryGlobally, loading: categoriesLoading } = useRoomCategories();
  const { roomTypes, addRoomType: addRoomTypeGlobally, loading: typesLoading } = useRoomTypes();
  const { rooms: allRooms, getRoomsByBuildingId: getContextRoomsByBuildingId, addRoom, updateRoom, deleteRoom: deleteRoomContext, loading: roomsLoading, getRoomById } = useRooms();
  const { programs, loading: programsLoading } = usePrograms();

  const [isRoomFormModalOpen, setIsRoomFormModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<RoomEntry | null>(null);
  const [roomFormState, setRoomFormState] = useState<Omit<RoomEntry, 'id' | 'buildingId' | 'roomSpecificSlots'> & { id?: string, roomSpecificSlots?: DefaultTimeSlot[], semesterId?: string }>(initialRoomFormState);
  const [formError, setFormError] = useState<string | null>(null);
  const [submissionStatus, setSubmissionStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [isReusableRoomDetailModalOpen, setIsReusableRoomDetailModalOpen] = useState(false);
  const [selectedRoomForReusableModal, setSelectedRoomForReusableModal] = useState<RoomEntry | null>(null);
  
  // New state for filters
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(layout === 'sidebar' ? false : true); // Closed by default in sidebar mode
  const [buildingFilter, setBuildingFilter] = useState<string[]>([]);
  const [floorFilter, setFloorFilter] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [assignedProgramFilter, setAssignedProgramFilter] = useState<string[]>([]);
  const [sharedProgramFilter, setSharedProgramFilter] = useState<string[]>([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [capacityFilter, setCapacityFilter] = useState<{ min: number | '', max: number | '' }>({ min: '', max: '' });

  const building = buildingId ? getBuildingByIdContext(buildingId) : null;
  
  const canAddRoom = useMemo(() => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    return user.roomEditAccess?.canAddRoom === true;
  }, [user]);

  useEffect(() => {
    // Auto-generate room number only when adding a new room, and when a floor is selected.
    if (isRoomFormModalOpen && !editingRoom && buildingId && roomFormState.floorId) {
        const building = getBuildingByIdContext(buildingId);
        const floor = floors.find(f => f.id === roomFormState.floorId);

        if (building && floor) {
            const buildingShortName = building.buildingShortName;

            let floorCode = 'X';
            const floorName = floor.floorName.toLowerCase();
            if (floorName.includes('ground')) {
                floorCode = 'G';
            } else {
                const matches = floorName.match(/\d+/);
                if (matches) {
                    floorCode = matches[0];
                } else if (floor.floorName) {
                    floorCode = floor.floorName.charAt(0).toUpperCase();
                }
            }

            const roomsOnFloor = allRooms.filter(r => r.buildingId === buildingId && r.floorId === roomFormState.floorId);
            
            let maxSerial = 0;
            const prefix = `${buildingShortName}-${floorCode}`;
            
            roomsOnFloor.forEach(r => {
                if (r.roomNumber.startsWith(prefix)) {
                    const serialPart = r.roomNumber.substring(prefix.length);
                    const serialNum = parseInt(serialPart, 10);
                    if (!isNaN(serialNum) && serialNum > maxSerial) {
                        maxSerial = serialNum;
                    }
                }
            });

            const newSerial = maxSerial + 1;
            const paddedSerial = String(newSerial).padStart(2, '0');
            const newRoomNumber = `${prefix}${paddedSerial}`;

            setRoomFormState(prev => ({ ...prev, roomNumber: newRoomNumber }));
        }
    } else if (isRoomFormModalOpen && !editingRoom) {
        // Clear room number if floor is not selected or other conditions aren't met
        setRoomFormState(prev => ({ ...prev, roomNumber: '' }));
    }
}, [isRoomFormModalOpen, editingRoom, buildingId, roomFormState.floorId, getBuildingByIdContext, floors, allRooms]);


  const getBuildingName = useCallback((bId: string) => buildings.find(b => b.id === bId)?.buildingName || 'N/A', [buildings]);
  
  const getFloorNameLocal = useCallback((fId: string) => floors.find(f => f.id === fId)?.floorName || 'N/A', [floors]);
  const getCategoryNameLocal = useCallback((cId: string) => categories.find(c => c.id === cId)?.categoryName || 'N/A', [categories]);
  const getTypeNameLocal = useCallback((tId: string) => (allRoomTypes.find(t => t.id === tId) || roomTypes.find(t => t.id === tId))?.typeName || 'N/A', [allRoomTypes, roomTypes]);
  const getProgramShortNameLocal = useCallback((pId?: string) => programs.find(p => p.pId === pId)?.shortName || 'N/A', [programs]);
  const getBuildingAddressLocal = useCallback((bId: string) => buildings.find(b => b.id === bId)?.address || 'N/A', [buildings]);

  // Memo for available filter options based on the current building's rooms
  const availableFilterOptions = useMemo(() => {
      const roomsInScope = buildingId ? getContextRoomsByBuildingId(buildingId) : allRooms;
      
      const floorIds = new Set(roomsInScope.map(r => r.floorId));
      const categoryIds = new Set(roomsInScope.map(r => r.categoryId));
      const typeIds = new Set(roomsInScope.map(r => r.typeId));

      return {
          floors: floors.filter(f => floorIds.has(f.id)).map(f => ({ id: f.id, name: f.floorName })).sort((a, b) => a.name.localeCompare(b.name)),
          categories: categories.filter(c => categoryIds.has(c.id)).map(c => ({ id: c.id, name: c.categoryName })).sort((a, b) => a.name.localeCompare(b.name)),
          types: roomTypes.filter(t => typeIds.has(t.id)).map(t => ({ id: t.id, name: t.typeName })).sort((a, b) => a.name.localeCompare(b.name)),
      };
  }, [buildingId, allRooms, getContextRoomsByBuildingId, floors, categories, roomTypes]);

  const flatRoomList = useMemo(() => {
    let baseRooms = buildingId ? getContextRoomsByBuildingId(buildingId) : allRooms;

    if (!selectedSemesterIdForRoutineView) {
        // When "All Semesters" is selected, deduplicate rooms based on physical location
        const uniqueRooms = new Map<string, RoomEntry>();
        baseRooms.forEach(room => {
            const key = `${room.buildingId}-${room.roomNumber}`;
            if (!uniqueRooms.has(key)) {
                uniqueRooms.set(key, room);
            }
        });
        baseRooms = Array.from(uniqueRooms.values());
    } else {
        // When a specific semester is selected, only show rooms for that semester
        baseRooms = baseRooms.filter(room => room.semesterId === selectedSemesterIdForRoutineView);
    }

    let filtered = baseRooms;

    if (layout === 'sidebar' && activeProgramId) {
        const activeProgram = allPrograms.find(p => p.id === activeProgramId);
        if (activeProgram) {
            filtered = filtered.filter(r => 
                r.assignedToPId === activeProgram.pId || r.sharedWithPIds.includes(activeProgram.pId)
            );
        }
    } else if (layout === 'default') {
        const hasAssignedFilter = assignedProgramFilter.length > 0;
        const hasSharedFilter = sharedProgramFilter.length > 0;
        if (hasAssignedFilter || hasSharedFilter) {
            const RESERVED_ROOM_ID = '__RESERVED__';
            const hasReservedFilter = assignedProgramFilter.includes(RESERVED_ROOM_ID);
            const normalAssignedFilters = assignedProgramFilter.filter(id => id !== RESERVED_ROOM_ID);
            
            filtered = filtered.filter(r => {
                let passesAssignedCheck = false;
                if (hasAssignedFilter) {
                    const isReservedMatch = hasReservedFilter && (!r.assignedToPId || r.assignedToPId.trim() === '');
                    const isProgramMatch = normalAssignedFilters.length > 0 && r.assignedToPId ? normalAssignedFilters.includes(r.assignedToPId) : false;
                    passesAssignedCheck = isReservedMatch || isProgramMatch;
                }

                let passesSharedCheck = false;
                if (hasSharedFilter) {
                    passesSharedCheck = r.sharedWithPIds.some(spid => sharedProgramFilter.includes(spid));
                }
                
                if (hasAssignedFilter && hasSharedFilter) {
                    return passesAssignedCheck || passesSharedCheck;
                } else if (hasAssignedFilter) {
                    return passesAssignedCheck;
                } else if (hasSharedFilter) {
                    return passesSharedCheck;
                }
                return false;
            });
        }
    }

    if (buildingFilter.length > 0) {
        filtered = filtered.filter(r => buildingFilter.includes(r.buildingId));
    }

    if (searchFilter) {
        const lowerSearch = searchFilter.toLowerCase();
        filtered = filtered.filter(r => r.roomNumber.toLowerCase().includes(lowerSearch));
    }
    if (floorFilter.length > 0) {
        filtered = filtered.filter(r => floorFilter.includes(r.floorId));
    }
    if (categoryFilter.length > 0) {
        filtered = filtered.filter(r => categoryFilter.includes(r.categoryId));
    }
    if (typeFilter.length > 0) {
        filtered = filtered.filter(r => typeFilter.includes(r.typeId));
    }
    
    const minCap = capacityFilter.min !== '' ? Number(capacityFilter.min) : 0;
    const maxCap = capacityFilter.max !== '' ? Number(capacityFilter.max) : Infinity;
    if (minCap > 0 || maxCap < Infinity) {
        filtered = filtered.filter(r => r.capacity >= minCap && r.capacity <= maxCap);
    }
    
    return filtered;
  }, [
      buildingId, allRooms, getContextRoomsByBuildingId, 
      selectedSemesterIdForRoutineView, layout, activeProgramId, allPrograms,
      assignedProgramFilter, sharedProgramFilter, buildingFilter, searchFilter,
      floorFilter, categoryFilter, typeFilter, capacityFilter
  ]);

  const groupedRooms = useMemo((): [string, RoomEntry[]][] => {
    if (buildingId) {
        return [[buildingId, flatRoomList]];
    }
    const grouped: { [buildingId: string]: RoomEntry[] } = {};
    flatRoomList.forEach(room => {
        if (!grouped[room.buildingId]) {
            grouped[room.buildingId] = [];
        }
        grouped[room.buildingId].push(room);
    });
    return Object.entries(grouped).sort((a, b) => getBuildingName(a[0]).localeCompare(getBuildingName(b[0])));
  }, [flatRoomList, buildingId, getBuildingName]);

  const totalRoomsInView = useMemo(() => flatRoomList.length, [flatRoomList]);

  const resetFilters = useCallback(() => {
    setBuildingFilter([]);
    setFloorFilter([]);
    setCategoryFilter([]);
    setTypeFilter([]);
    setAssignedProgramFilter([]);
    setSharedProgramFilter([]);
    setSearchFilter('');
    setCapacityFilter({ min: '', max: '' });
  }, []);

  useEffect(() => {
    resetFilters();
  }, [buildingId, resetFilters]);

  const resetFormAndCloseModal = useCallback(() => {
    setRoomFormState(initialRoomFormState);
    setEditingRoom(null);
    setFormError(null);
    setSubmissionStatus(null);
    setIsRoomFormModalOpen(false);
  }, []);
  
  const handleOpenAddRoomModal = () => {
    if (!buildingId) return;
    setEditingRoom(null);
    setRoomFormState({ 
      ...initialRoomFormState,
      semesterId: selectedSemesterIdForRoutineView || undefined 
    }); 
    setFormError(null);
    setSubmissionStatus(null);
    setIsRoomFormModalOpen(true);
  };

  const handleOpenEditRoomModal = (room: RoomEntry) => {
    setEditingRoom(room);
    setRoomFormState({
      id: room.id,
      floorId: room.floorId,
      categoryId: room.categoryId,
      typeId: room.typeId,
      roomNumber: room.roomNumber,
      capacity: room.capacity,
      assignedToPId: room.assignedToPId,
      sharedWithPIds: room.sharedWithPIds || [],
      roomSpecificSlots: room.roomSpecificSlots ? [...room.roomSpecificSlots] : [],
      semesterId: room.semesterId,
    });
    setFormError(null);
    setSubmissionStatus(null);
    setIsRoomFormModalOpen(true);
  };
  
  const handleOpenReusableRoomDetailModal = (room: RoomEntry) => {
    if (user?.role === 'admin' || user?.roomEditAccess?.canViewRoomDetail) {
      setSelectedRoomForReusableModal(room);
      setIsReusableRoomDetailModalOpen(true);
    }
  };

  const handleCloseReusableRoomDetailModal = () => {
    setIsReusableRoomDetailModalOpen(false);
    setSelectedRoomForReusableModal(null);
  };
  
  const handleRoomInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { 
    const { name, value } = e.target;
    setRoomFormState(prev => ({
      ...prev,
      [name]: name === 'capacity' ? (value === '' ? 0 : Number(value)) : value,
    }));
  };
  
  const handleAssignedProgramSelect = (pId: string | undefined) => {
    setRoomFormState(prev => ({ ...prev, assignedToPId: pId, sharedWithPIds: prev.sharedWithPIds.filter(id => id !== pId) })); 
  };

  const handleSharedProgramsChange = (pIds: string[]) => {
    setRoomFormState(prev => ({ ...prev, sharedWithPIds: pIds }));
  };

  const handleCreateFloorLocal = async (name: string): Promise<string | null> => {
    if (!buildingId) {
      setFormError("Building context is lost for creating floor.");
      return null;
    }
    try {
      const newFloor = await addFloorContextGlobally({ buildingId, floorName: name });
      setFormError(null);
      return newFloor.id;
    } catch (e: any) {
      setFormError(e.message || "Failed to add floor.");
      return null;
    }
  };

  const handleCreateCategoryLocal = async (name: string): Promise<string | null> => {
    try {
      const newCategory = await addRoomCategoryGlobally({ categoryName: name });
      setFormError(null);
      return newCategory.id;
    } catch (e: any) {
      setFormError(e.message || "Failed to add category.");
      return null;
    }
  };
  
  const handleCreateTypeLocal = async (name: string): Promise<string | null> => {
    try {
      const newType = await addRoomTypeGlobally({ typeName: name });
      setFormError(null);
      return newType.id;
    } catch (e: any) {
      setFormError(e.message || "Failed to add type.");
      return null;
    }
  };


  const handleRoomSubmit = async () => {
    if (!buildingId) {
      setFormError("Building context is lost. Please refresh.");
      return;
    }
    setFormError(null);
    setSubmissionStatus(null);

    if (!roomFormState.floorId || !roomFormState.categoryId || !roomFormState.typeId || !roomFormState.roomNumber.trim() || roomFormState.capacity <= 0 || !roomFormState.semesterId) {
      setFormError('Floor, Category, Type, Room Number, valid Capacity (>0), and Semester are required.');
      return;
    }

    const payload: Omit<RoomEntry, 'id'> = {
      buildingId: buildingId,
      floorId: roomFormState.floorId,
      categoryId: roomFormState.categoryId,
      typeId: roomFormState.typeId,
      roomNumber: roomFormState.roomNumber.trim(),
      capacity: roomFormState.capacity,
      assignedToPId: roomFormState.assignedToPId,
      sharedWithPIds: roomFormState.sharedWithPIds,
      roomSpecificSlots: (roomFormState.roomSpecificSlots || []).sort(sortSlotsByTypeThenTime),
      semesterId: roomFormState.semesterId || undefined,
    };

    try {
      if (editingRoom && editingRoom.id) {
        await updateRoom({ ...payload, id: editingRoom.id });
      } else {
        await addRoom(payload);
      }
      resetFormAndCloseModal();
    } catch (e: any) {
      setFormError(e.message || 'Failed to save room.');
      setSubmissionStatus({ type: 'error', message: e.message || 'Failed to save room.' });
    }
  };

  const handleDeleteRoom = useCallback((roomToDelete: RoomEntry) => {
    for (const semesterId in routineData) {
        const semesterRoutine = routineData[semesterId];
        if (semesterRoutine) {
            for (const day of Object.values(semesterRoutine)) {
                if (day[roomToDelete.roomNumber] && Object.keys(day[roomToDelete.roomNumber]).length > 0) {
                    alert(`Cannot delete Room ${roomToDelete.roomNumber}. It has classes assigned in the "${semesterId}" semester routine.`);
                    return;
                }
            }
        }
    }
    if (window.confirm(`Are you sure you want to delete Room ${roomToDelete.roomNumber}? This action cannot be undone.`)) {
        deleteRoomContext(roomToDelete.id);
    }
  }, [routineData, deleteRoomContext]);
  
  const handleSaveRoomFromReusableModal = async (updatedRoomData: RoomEntry) => {
    try {
        await updateRoom(updatedRoomData);
        const refreshedRoom = getRoomById(updatedRoomData.id);
        if (refreshedRoom) {
            setSelectedRoomForReusableModal(refreshedRoom);
        } else {
            setSelectedRoomForReusableModal(updatedRoomData); 
        }
    } catch (error) {
        console.error("Failed to update room from reusable modal:", error);
        throw error; 
    }
  };
  
  const isLoading = buildingsLoading || floorsLoading || categoriesLoading || typesLoading || roomsLoading || programsLoading;
  
  const systemDefaultSlotsForReusableModal = useMemo(() => {
    const savedSlotsJson = localStorage.getItem('defaultTimeSlots');
    if (savedSlotsJson) {
        try {
            const rawSlots = JSON.parse(savedSlotsJson);
            if (Array.isArray(rawSlots)) {
                const validated = rawSlots.filter(s => s.id && s.type && s.startTime && s.endTime) as DefaultTimeSlot[];
                if (validated.length > 0) return validated.sort(sortSlotsByTypeThenTime);
            }
        } catch (e) { console.warn("BRV: Error parsing system defaults", e); }
    }
    return SEED_DEFAULT_SLOTS_DATA.map((s, i) => ({...s, id: `seed-brv-${i}`})).sort(sortSlotsByTypeThenTime);
  }, []);
  
  const floorOptionsForForm = useMemo(() => {
    if (editingRoom) {
      return floors.filter(f => f.buildingId === editingRoom.buildingId)
                   .map(f => ({ id: f.id, name: f.floorName }));
    }
    if (buildingId) {
      const currentBuildingFloors = getFloorsByBuildingId(buildingId);
      return currentBuildingFloors.map(f => ({ id: f.id, name: f.floorName }));
    }
    return [];
  }, [editingRoom, buildingId, floors, getFloorsByBuildingId]);

  const floorsForDetailModal = useMemo(() => {
    if (selectedRoomForReusableModal) {
      return floors.filter(f => f.buildingId === selectedRoomForReusableModal.buildingId);
    }
    return [];
  }, [selectedRoomForReusableModal, floors]);

  const categoryOptionsForForm = useMemo(() => categories.map(c => ({ id: c.id, name: c.categoryName })), [categories]);
  const roomTypeOptionsForForm = useMemo(() => roomTypes.map(t => ({ id: t.id, name: t.typeName })), [roomTypes]);

  const viewTitle = building ? `${building.buildingName} - Rooms` : "All Buildings & Rooms";

  const getOccupancyStats = useCallback((room: RoomEntry) => {
      const program = allPrograms.find(p => p.pId === room.assignedToPId);
      if (!program || !program.activeDays || program.activeDays.length === 0) {
          return { theory: { booked: 0, total: 0 }, lab: { booked: 0, total: 0 } };
      }

      const activeDays = program.activeDays;
      const applicableSlots = (room.roomSpecificSlots?.length ?? 0) > 0 ? room.roomSpecificSlots : systemDefaultSlots;
      const routineForSemester = routineData[room.semesterId || ''] || {};

      let totalTheory = 0;
      let totalLab = 0;
      let bookedTheory = 0;
      let bookedLab = 0;

      applicableSlots.forEach(slot => {
          if (slot.type === 'Theory') totalTheory++;
          if (slot.type === 'Lab') totalLab++;
      });

      totalTheory *= activeDays.length;
      totalLab *= activeDays.length;

      if (Object.keys(routineForSemester).length > 0) {
          activeDays.forEach(day => {
              const daySchedule = routineForSemester[day as DayOfWeek];
              if (daySchedule && daySchedule[room.roomNumber]) {
                  Object.keys(daySchedule[room.roomNumber]).forEach(slotString => {
                      const classInfo = daySchedule[room.roomNumber][slotString as keyof typeof daySchedule[string]];
                      if (classInfo) { // If there's any class, it's booked.
                         const correspondingSlot = applicableSlots.find(s => formatSlotObjectToString(s) === slotString);
                          if (correspondingSlot) {
                              if (correspondingSlot.type === 'Theory') bookedTheory++;
                              if (correspondingSlot.type === 'Lab') bookedLab++;
                          }
                      }
                  });
              }
          });
      }
      return {
          theory: { booked: bookedTheory, total: totalTheory },
          lab: { booked: bookedLab, total: totalLab }
      };
  }, [allPrograms, systemDefaultSlots, routineData]);

  const roomCardJSX = (room: RoomEntry) => {
    const occupancy = getOccupancyStats(room);
    const roomTypeName = getTypeNameLocal(room.typeId).toLowerCase();
    
    let statsToShow: { label: string; data: { booked: number; total: number }; colorClass: string } | null = null;
  
    if (roomTypeName.includes('lab')) {
        statsToShow = { label: 'Lab Slots', data: occupancy.lab, colorClass: 'text-blue-700' };
    } else { // Default to theory for "Theory", "Standard Classroom", etc.
        statsToShow = { label: 'Theory Slots', data: occupancy.theory, colorClass: 'text-green-700' };
    }
  
    const OccupancyBar = ({ label, booked, total, colorClass }: { label: string, booked: number, total: number, colorClass: string }) => {
        const occupancyPercent = total > 0 ? (booked / total) * 100 : 0;
        const progressBarColor = occupancyPercent >= 100 ? 'bg-red-500' : 'bg-teal-500';
  
        return (
            <div className="w-full">
                <div className="flex justify-between items-baseline mb-1">
                    <span className={`text-[10px] font-semibold ${colorClass}`}>{label}</span>
                    <span className="text-[10px] font-bold text-gray-600">{booked} / {total}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div
                        className={`h-1.5 rounded-full ${progressBarColor}`}
                        style={{ width: `${occupancyPercent}%` }}
                    ></div>
                </div>
            </div>
        );
    };

    return (
        <div 
          key={room.id} 
          className="relative bg-white p-2 rounded-lg shadow-md border border-gray-200 hover:shadow-lg focus-within:ring-2 focus-within:ring-teal-500 focus-within:ring-offset-1 transition-all duration-150 h-32 flex flex-col"
          onClick={() => handleOpenReusableRoomDetailModal(room)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleOpenReusableRoomDetailModal(room); }}
          tabIndex={0}
          role="button"
          aria-label={`View details for room ${room.roomNumber}`}
        >
          <div className="flex justify-between items-start text-sm">
              <div className="flex items-center gap-1 font-semibold text-gray-700" title={`Capacity: ${room.capacity}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                  </svg>
                  <span className="font-bold text-gray-800">{room.capacity}</span>
              </div>
              <div className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-semibold truncate max-w-[100px]" title={`Assigned: ${getProgramShortNameLocal(room.assignedToPId)}`}>
                  {getProgramShortNameLocal(room.assignedToPId)}
              </div>
          </div>
  
          <div className="flex-grow flex flex-col items-center justify-center text-center -mt-1">
              <h4 className={`font-bold text-teal-700 text-xl`}>{room.roomNumber}</h4>
              <p className={`text-xs text-gray-600 mt-0.5 truncate max-w-full`} title={`${getTypeNameLocal(room.typeId)}`}>
                {getTypeNameLocal(room.typeId)}
              </p>
          </div>
  
          <div className="pt-1.5 border-t border-gray-200 flex justify-around items-center text-[10px] gap-2">
              {statsToShow && (
                  <OccupancyBar 
                      label={statsToShow.label} 
                      booked={statsToShow.data.booked} 
                      total={statsToShow.data.total}
                      colorClass={statsToShow.colorClass}
                  />
              )}
          </div>
            {user?.roomEditAccess?.canDeleteRoom && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteRoom(room);
                    }}
                    className="absolute top-1 right-1 z-10 p-1 bg-white/70 backdrop-blur-sm text-red-500 hover:bg-red-100 hover:text-red-700 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    title={`Delete Room ${room.roomNumber}`}
                    aria-label={`Delete room ${room.roomNumber}`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                </button>
            )}
        </div>
    );
  }

  const modalFormContent = (
    <div className="space-y-4 text-sm">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
                <label htmlFor="floorId-scd-bld" className="block text-xs font-medium text-gray-700 mb-1">Floor *</label>
                <SearchableCreatableDropdown
                    idPrefix="floorId-bld"
                    options={floorOptionsForForm}
                    value={roomFormState.floorId || null}
                    onChange={(id) => setRoomFormState(prev => ({...prev, floorId: id || ''}))}
                    onCreate={handleCreateFloorLocal}
                    placeholder="Search or Add New Floor..."
                />
            </div>
            <div>
                <label htmlFor="categoryId-scd-bld" className="block text-xs font-medium text-gray-700 mb-1">Category *</label>
                <SearchableCreatableDropdown
                    idPrefix="categoryId-bld"
                    options={categoryOptionsForForm}
                    value={roomFormState.categoryId || null}
                    onChange={(id) => setRoomFormState(prev => ({...prev, categoryId: id || ''}))}
                    onCreate={handleCreateCategoryLocal}
                    placeholder="Search or Add New Category..."
                />
            </div>
            <div>
                <label htmlFor="typeId-scd-bld" className="block text-xs font-medium text-gray-700 mb-1">Type *</label>
                <SearchableCreatableDropdown
                    idPrefix="typeId-bld"
                    options={roomTypeOptionsForForm}
                    value={roomFormState.typeId || null}
                    onChange={(id) => setRoomFormState(prev => ({...prev, typeId: id || ''}))}
                    onCreate={handleCreateTypeLocal}
                    placeholder="Search or Add New Type..."
                />
            </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
                <label htmlFor="roomNumber" className="block text-xs font-medium text-gray-700 mb-1">Room Number *</label>
                <input type="text" name="roomNumber" id="roomNumber" value={roomFormState.roomNumber} onChange={handleRoomInputChange} required 
                        className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-1 focus:ring-teal-500 focus:border-teal-500 h-9"
                        placeholder="e.g. KT-101"
                />
            </div>
            <div>
                <label htmlFor="capacity" className="block text-xs font-medium text-gray-700 mb-1">Capacity *</label>
                <input type="number" name="capacity" id="capacity" value={roomFormState.capacity} onChange={handleRoomInputChange} required min="1"
                        className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-1 focus:ring-teal-500 focus:border-teal-500 h-9"/>
            </div>
             <div>
                <label htmlFor="semesterId" className="block text-xs font-medium text-gray-700 mb-1">Semester *</label>
                <select
                    name="semesterId"
                    id="semesterId"
                    value={roomFormState.semesterId || ''}
                    onChange={handleRoomInputChange}
                    required
                    className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-1 focus:ring-teal-500 focus:border-teal-500 text-sm h-9"
                >
                    <option value="" disabled>-- Select Semester --</option>
                    {uniqueSemesters.map(semester => (
                        <option key={semester} value={semester}>{semester}</option>
                    ))}
                </select>
            </div>
        </div>

        {formError && <p className="text-xs text-red-600 p-2 bg-red-100 border border-red-300 rounded-md">{formError}</p>}
        {submissionStatus && (
            <p className={`text-xs p-2 rounded-md border ${submissionStatus.type === 'success' ? 'bg-green-100 border-green-300 text-green-700' : 'bg-red-100 border-red-300 text-red-700'}`}>
                {submissionStatus.message}
            </p>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 mt-4">
            <button type="button" onClick={resetFormAndCloseModal} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md border border-gray-300">Cancel</button>
            <button type="button" onClick={handleRoomSubmit} className="px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-md border border-transparent">
            Add Room
            </button>
        </div>
    </div>
  );
  
  let viewContent;

  if (layout === 'sidebar') {
      const renderFilterPanel = () => (
          <div className="flex-grow overflow-y-auto filter-panel-scrollbar space-y-2">
              <div className="px-2">
                  {!buildingId && (
                      <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Building</label><MultiSelectFilterDropdown title="All Buildings" options={buildings.map(b => ({ id: b.id, name: b.buildingName })).sort((a, b) => a.name.localeCompare(b.name))} selectedValues={buildingFilter} onSelectionChange={(id) => setBuildingFilter(prev => prev.includes(id) ? prev.filter(fId => fId !== id) : [...prev, id])} /></div>
                  )}
                  <div className="mt-2"><label className="text-xs font-semibold text-gray-700 mb-1 block">Floor</label><MultiSelectFilterDropdown title="All Floors" options={availableFilterOptions.floors} selectedValues={floorFilter} onSelectionChange={(id) => setFloorFilter(prev => prev.includes(id) ? prev.filter(fId => fId !== id) : [...prev, id])} /></div>
                  <div className="mt-2"><label className="text-xs font-semibold text-gray-700 mb-1 block">Category</label><MultiSelectFilterDropdown title="All Categories" options={availableFilterOptions.categories} selectedValues={categoryFilter} onSelectionChange={(id) => setCategoryFilter(prev => prev.includes(id) ? prev.filter(cId => cId !== id) : [...prev, id])} /></div>
                  <div className="mt-2"><label className="text-xs font-semibold text-gray-700 mb-1 block">Type</label><MultiSelectFilterDropdown title="All Types" options={availableFilterOptions.types} selectedValues={typeFilter} onSelectionChange={(id) => setTypeFilter(prev => prev.includes(id) ? prev.filter(tId => tId !== id) : [...prev, id])} /></div>
                  <div className="mt-2"><label className="text-xs font-semibold text-gray-700 mb-1 block">Capacity</label><div className="flex items-center gap-1"><input type="number" placeholder="Min" value={capacityFilter.min} onChange={e => setCapacityFilter(f => ({ ...f, min: e.target.value ? Number(e.target.value) : '' }))} className="w-full text-xs p-1 border border-gray-300 rounded-md h-7" /><input type="number" placeholder="Max" value={capacityFilter.max} onChange={e => setCapacityFilter(f => ({ ...f, max: e.target.value ? Number(e.target.value) : '' }))} className="w-full text-xs p-1 border border-gray-300 rounded-md h-7" /></div></div>
              </div>
          </div>
      );
      viewContent = (
          <div className="h-full flex flex-col">
              <div className="flex-shrink-0 flex justify-between items-center px-4 py-2 border-b border-gray-200 bg-white shadow-sm z-10">
                  <div className="flex items-center gap-2">
                      <button onClick={() => setIsFilterPanelOpen(prev => !prev)} className="p-1.5 text-gray-600 hover:bg-gray-200 rounded-md" aria-label="Toggle filters" title="Toggle filters">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                      </button>
                      <div className="relative">
                          <svg xmlns="http://www.w3.org/2000/svg" className="absolute top-1/2 left-2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>
                          <input type="search" placeholder="Search rooms..." value={searchFilter} onChange={e => setSearchFilter(e.target.value)} className="w-48 p-1.5 pl-7 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-teal-500" />
                      </div>
                  </div>
                  <h2 className="text-lg font-bold text-teal-700">Room List ({totalRoomsInView})</h2>
                  <button onClick={onClose} className="p-1.5 text-gray-500 hover:text-red-700 hover:bg-red-100 rounded-full" aria-label="Close room list">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                  </button>
              </div>
              <div className="flex-grow flex overflow-hidden">
                  {isFilterPanelOpen && (
                      <aside className="w-48 flex-shrink-0 border-r border-gray-200 px-2 pb-2 pt-2 flex flex-col animate-slide-in-filters bg-gray-50">
                          <style>{`
                            @keyframes slide-in-filters { from { transform: translateX(-100%); } to { transform: translateX(0); } }
                            .animate-slide-in-filters { animation: slide-in-filters 0.3s ease-out forwards; }
                        `}</style>
                          <div className="flex justify-between items-center mb-1 flex-shrink-0">
                              <h3 className="text-sm font-semibold text-gray-800 px-2">Filters</h3>
                          </div>
                          {renderFilterPanel()}
                          <div className="flex-shrink-0 pt-2 border-t border-gray-200">
                              <button onClick={resetFilters} className="w-full text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 p-1.5 rounded-md shadow-sm border border-red-200">Reset Filters</button>
                          </div>
                      </aside>
                  )}
                  <main className="flex-grow overflow-y-auto custom-scrollbar p-3">
                      {isLoading ? (
                          <div className="text-center p-4 text-gray-500">Loading room data...</div>
                      ) : totalRoomsInView === 0 ? (
                          <div className="flex flex-col items-center justify-center h-full text-gray-500">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                              <p className="font-semibold">No rooms found.</p>
                          </div>
                      ) : (
                          groupedRooms.map(([bId, buildingRoomsList]) => (
                            <div key={bId}>
                                <h4 className="text-sm font-semibold text-gray-700 mb-2 p-1.5 bg-gray-200 rounded-md">{getBuildingName(bId)}</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2">
                                    {(buildingRoomsList as RoomEntry[]).sort((a,b) => a.roomNumber.localeCompare(b.roomNumber)).map(room => roomCardJSX(room))}
                                </div>
                            </div>
                          ))
                      )}
                  </main>
              </div>
          </div>
      );
  } else {
    viewContent = (
      <div className="h-full flex flex-col relative overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 z-20 text-gray-500 hover:text-red-600 bg-white/70 backdrop-blur-sm p-1 rounded-full hover:bg-red-100 transition-colors"
          aria-label="Close building rooms view"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {buildingId && building ? (
          <>
            <div className="relative h-48 md:h-56 flex-shrink-0 bg-gray-300">
              <img 
                src={building.thumbnailUrl}
                alt={`Cover image for ${building.buildingName}`}
                className="w-full h-full object-cover"
                onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = "data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22100%25%22%20height%3D%22100%25%22%20viewBox%3D%220%200%20100%2080%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Crect%20width%3D%22100%25%22%20height%3D%22100%25%22%20fill%3D%22%23e2e8f0%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2250%25%22%20font-family%3D%22sans-serif%22%20font-size%3D%2210%22%20fill%3D%22%2394a3b8%22%20text-anchor%3D%22middle%22%20dominant-baseline%3D%22middle%22%3EError%3C%2Ftext%3E%3C%2Fsvg%3E";
                    target.onerror = null; 
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent" />
              <div className="absolute inset-0 p-4 flex flex-col justify-between text-white">
                  <div className="self-end">
                      <select
                          value={selectedSemesterIdForRoutineView || ''}
                          onChange={(e) => setSelectedSemesterIdForRoutineView(e.target.value || null)}
                          className="bg-black/30 backdrop-blur-sm text-white border border-white/30 rounded-md p-1.5 text-xs focus:ring-yellow-400 focus:outline-none focus:border-yellow-400"
                          style={{ colorScheme: 'dark' }}
                          aria-label="Filter rooms by semester"
                          disabled={disableSemesterFilter}
                      >
                          <option value="">All Semesters</option>
                          {uniqueSemesters.map(sem => (
                              <option key={sem} value={sem} className="bg-gray-800 text-white">{sem}</option>
                          ))}
                      </select>
                  </div>
                  <div>
                      <h2 className="text-2xl sm:text-3xl font-bold text-shadow-md truncate" title={building.buildingName}>
                        {building.buildingName}
                      </h2>
                      <p className="text-sm text-gray-200 text-shadow mt-1" title={building.address}>
                        {building.address}
                      </p>
                  </div>
              </div>
            </div>
            
            <div className="flex-shrink-0 mb-3 px-3 sm:px-4">
              <button 
                onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)} 
                className="w-full flex justify-between items-center p-2 bg-gray-100 rounded-t-md border-b border-gray-200"
                aria-expanded={isFilterPanelOpen}
                aria-controls="filter-panel-content"
              >
                  <div className="flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                      <span className="font-semibold text-gray-700 text-sm">Filter Rooms ({totalRoomsInView})</span>
                  </div>
                  <svg className={`w-4 h-4 text-gray-500 transform transition-transform ${isFilterPanelOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </button>
              {isFilterPanelOpen && (
                  <div id="filter-panel-content" className="bg-gray-100 p-2 rounded-b-md grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 items-end">
                      <div className="lg:col-span-1"><label className="text-[10px] font-medium text-gray-600 block mb-0.5">Floor</label><MultiSelectFilterDropdown title="All Floors" options={availableFilterOptions.floors} selectedValues={floorFilter} onSelectionChange={(id) => setFloorFilter(prev => prev.includes(id) ? prev.filter(fId => fId !== id) : [...prev, id])} /></div>
                      <div className="lg:col-span-1"><label className="text-[10px] font-medium text-gray-600 block mb-0.5">Category</label><MultiSelectFilterDropdown title="All Categories" options={availableFilterOptions.categories} selectedValues={categoryFilter} onSelectionChange={(id) => setCategoryFilter(prev => prev.includes(id) ? prev.filter(cId => cId !== id) : [...prev, id])} /></div>
                      <div className="lg:col-span-1"><label className="text-[10px] font-medium text-gray-600 block mb-0.5">Type</label><MultiSelectFilterDropdown title="All Types" options={availableFilterOptions.types} selectedValues={typeFilter} onSelectionChange={(id) => setTypeFilter(prev => prev.includes(id) ? prev.filter(tId => tId !== id) : [...prev, id])} /></div>
                      <div className="lg:col-span-1"><label className="text-[10px] font-medium text-gray-600 block mb-0.5">Assigned Program</label><SearchableProgramDropdownForRooms showReservedRoomOption={true} idSuffix="bldg-view-assign-filter" programs={programs} selectedPIds={assignedProgramFilter} onPIdsChange={setAssignedProgramFilter} multiSelect={true} placeholderText="Any Assigned" /></div>
                      <div className="lg:col-span-1"><label className="text-[10px] font-medium text-gray-600 block mb-0.5">Shared with</label><SearchableProgramDropdownForRooms idSuffix="bldg-view-share-filter" programs={programs} selectedPIds={sharedProgramFilter} onPIdsChange={setSharedProgramFilter} multiSelect={true} placeholderText="Any Shared" /></div>
                      <div className="lg:col-span-1"><label className="text-[10px] font-medium text-gray-600 block mb-0.5">Capacity</label><div className="flex gap-1"><input type="number" placeholder="Min" value={capacityFilter.min} onChange={e => setCapacityFilter(f => ({...f, min: e.target.value ? Number(e.target.value) : ''}))} className="w-full text-xs p-1.5 border border-gray-300 rounded-md h-7" /><input type="number" placeholder="Max" value={capacityFilter.max} onChange={e => setCapacityFilter(f => ({...f, max: e.target.value ? Number(e.target.value) : ''}))} className="w-full text-xs p-1.5 border border-gray-300 rounded-md h-7" /></div></div>
                      <div className="lg:col-span-1"><label className="text-[10px] font-medium text-gray-600 block mb-0.5">Search Room No.</label><input type="text" placeholder="e.g., 101" value={searchFilter} onChange={e => setSearchFilter(e.target.value)} className="w-full text-xs p-1.5 border border-gray-300 rounded-md h-7" /></div>
                      <div className="lg:col-span-1"><button onClick={resetFilters} className="w-full text-xs bg-red-500 text-white p-1.5 rounded-md hover:bg-red-600 h-7">Reset</button></div>
                  </div>
              )}
          </div>

            <div className="flex-grow p-3 sm:p-4 overflow-y-auto custom-scrollbar">
              {isLoading ? (
                 <div className="text-center p-4 text-gray-500">Loading room data...</div>
              ) : totalRoomsInView === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                      <p className="font-semibold">No rooms found for the current filters.</p>
                  </div>
              ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
                     {(groupedRooms[0]?.[1] as RoomEntry[]).sort((a,b) => a.roomNumber.localeCompare(b.roomNumber)).map(room => roomCardJSX(room))}
                  </div>
              )}
            </div>
            
            {buildingId && (
                <button
                onClick={handleOpenAddRoomModal}
                className="absolute bottom-4 right-4 bg-teal-600 hover:bg-teal-700 text-white font-semibold p-3 rounded-full shadow-lg transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed z-10"
                aria-label={"Add New Room"}
                title={!canAddRoom ? "You do not have permission to add rooms" : "Add New Room"}
                disabled={!buildingId || !canAddRoom}
                >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                </button>
            )}
          </>
        ) : (
          <div className="p-3 sm:p-4 h-full flex flex-col">
              <div className="flex-shrink-0 mb-3 pb-2 border-b border-gray-300 pr-8">
                  <h2 className="text-xl sm:text-2xl font-bold text-teal-700 truncate" title={viewTitle}>
                  {viewTitle}
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">{`A comprehensive list of all rooms${selectedSemesterIdForRoutineView ? ` for semester ${selectedSemesterIdForRoutineView}` : ''}.`}</p>
              </div>
              
              <div className="flex-shrink-0 mb-3 px-3 sm:px-4">
                  <button 
                  onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)} 
                  className="w-full flex justify-between items-center p-2 bg-gray-100 rounded-t-md border-b border-gray-200"
                  aria-expanded={isFilterPanelOpen}
                  aria-controls="filter-panel-content"
                  >
                      <div className="flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                          <span className="font-semibold text-gray-700 text-sm">Filter Rooms ({totalRoomsInView})</span>
                      </div>
                      <svg className={`w-4 h-4 text-gray-500 transform transition-transform ${isFilterPanelOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                  </button>
                  {isFilterPanelOpen && (
                      <div id="filter-panel-content" className="bg-gray-100 p-2 rounded-b-md grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 items-end">
                          <div className="lg:col-span-1"><label className="text-[10px] font-medium text-gray-600 block mb-0.5">Floor</label><MultiSelectFilterDropdown title="All Floors" options={availableFilterOptions.floors} selectedValues={floorFilter} onSelectionChange={(id) => setFloorFilter(prev => prev.includes(id) ? prev.filter(fId => fId !== id) : [...prev, id])} /></div>
                          <div className="lg:col-span-1"><label className="text-[10px] font-medium text-gray-600 block mb-0.5">Category</label><MultiSelectFilterDropdown title="All Categories" options={availableFilterOptions.categories} selectedValues={categoryFilter} onSelectionChange={(id) => setCategoryFilter(prev => prev.includes(id) ? prev.filter(cId => cId !== id) : [...prev, id])} /></div>
                          <div className="lg:col-span-1"><label className="text-[10px] font-medium text-gray-600 block mb-0.5">Type</label><MultiSelectFilterDropdown title="All Types" options={availableFilterOptions.types} selectedValues={typeFilter} onSelectionChange={(id) => setTypeFilter(prev => prev.includes(id) ? prev.filter(tId => tId !== id) : [...prev, id])} /></div>
                          <div className="lg:col-span-1"><label className="text-[10px] font-medium text-gray-600 block mb-0.5">Assigned Program</label><SearchableProgramDropdownForRooms showReservedRoomOption={true} idSuffix="bldg-view-assign-filter" programs={programs} selectedPIds={assignedProgramFilter} onPIdsChange={setAssignedProgramFilter} multiSelect={true} placeholderText="Any Assigned" /></div>
                          <div className="lg:col-span-1"><label className="text-[10px] font-medium text-gray-600 block mb-0.5">Shared with</label><SearchableProgramDropdownForRooms idSuffix="bldg-view-share-filter" programs={programs} selectedPIds={sharedProgramFilter} onPIdsChange={setSharedProgramFilter} multiSelect={true} placeholderText="Any Shared" /></div>
                          <div className="lg:col-span-1"><label className="text-[10px] font-medium text-gray-600 block mb-0.5">Capacity</label><div className="flex gap-1"><input type="number" placeholder="Min" value={capacityFilter.min} onChange={e => setCapacityFilter(f => ({...f, min: e.target.value ? Number(e.target.value) : ''}))} className="w-full text-xs p-1.5 border border-gray-300 rounded-md h-7" /><input type="number" placeholder="Max" value={capacityFilter.max} onChange={e => setCapacityFilter(f => ({...f, max: e.target.value ? Number(e.target.value) : ''}))} className="w-full text-xs p-1.5 border border-gray-300 rounded-md h-7" /></div></div>
                          <div className="lg:col-span-1"><label className="text-[10px] font-medium text-gray-600 block mb-0.5">Search Room No.</label><input type="text" placeholder="e.g., 101" value={searchFilter} onChange={e => setSearchFilter(e.target.value)} className="w-full text-xs p-1.5 border border-gray-300 rounded-md h-7" /></div>
                          <div className="lg:col-span-1"><button onClick={resetFilters} className="w-full text-xs bg-red-500 text-white p-1.5 rounded-md hover:bg-red-600 h-7">Reset</button></div>
                      </div>
                  )}
              </div>
              <div className="flex-grow overflow-y-auto custom-scrollbar pr-1 -mr-1 space-y-4">
              {isLoading ? (
                  <div className="text-center p-4 text-gray-500">Loading room data...</div>
              ) : totalRoomsInView === 0 ? (
                  <div className="flex-grow flex flex-col items-center justify-center text-gray-500">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                      <p className="font-semibold">No rooms found for the current filters.</p>
                  </div>
              ) : (
                    groupedRooms.map(([bId, buildingRoomsList]) => (
                      <div key={bId}>
                          {!buildingId && (
                              <h4 className="text-md font-semibold text-gray-700 mb-2 p-2 bg-gray-100 rounded-md">{getBuildingName(bId)}</h4>
                          )}
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
                              {(buildingRoomsList as RoomEntry[]).sort((a,b) => a.roomNumber.localeCompare(b.roomNumber)).map(room => roomCardJSX(room))}
                          </div>
                      </div>
                    ))
              )}
              </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {viewContent}
      <Modal isOpen={isRoomFormModalOpen} onClose={resetFormAndCloseModal} title={editingRoom ? `Edit Room: ${editingRoom.roomNumber}` : "Add New Room"}>
        {modalFormContent}
      </Modal>
      {selectedRoomForReusableModal && (
        <RoomDetailModal
            room={selectedRoomForReusableModal}
            isOpen={isReusableRoomDetailModalOpen}
            onClose={handleCloseReusableRoomDetailModal}
            onSaveRoom={handleSaveRoomFromReusableModal} 
            allPrograms={programs}
            allBuildings={buildings}
            allFloorsForBuilding={floorsForDetailModal} 
            allCategories={categories}
            allRoomTypes={roomTypes}
            onAddFloor={handleCreateFloorLocal} 
            onAddCategory={handleCreateCategoryLocal}
            onAddRoomType={handleCreateTypeLocal}
            getBuildingName={getBuildingName}
            getBuildingAddress={getBuildingAddressLocal}
            getFloorName={getFloorNameLocal}
            getCategoryName={getCategoryNameLocal}
            getTypeName={getTypeNameLocal}
            getProgramShortName={getProgramShortNameLocal}
            fullRoutineData={routineData} 
            systemDefaultSlots={systemDefaultSlotsForReusableModal} 
            uniqueSemesters={uniqueSemesters}
            scheduleOverrides={scheduleOverrides}
            allSemesterConfigurations={allSemesterConfigurations}
            heightClass="min-h-[75vh] max-h-[85vh]"
        />
      )}
    </>
  );
};

export default BuildingRoomsView;