

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { usePrograms } from '../contexts/ProgramContext';
import { useRooms } from '../contexts/RoomContext';
import { ProgramEntry, DefaultTimeSlot, EnrollmentEntry, FullRoutineData, RoomEntry, SemesterCloneInfo, DayOfWeek, ProgramType, SemesterSystem, ClassDetail, RoomTypeEntry, ProgramSlotFilterType } from '../types';
import { formatDefaultSlotToString } from '../App';
import { SEED_DEFAULT_SLOTS_DATA, sortSlotsByTypeThenTime } from '../data/slotConstants';
import { DAYS_OF_WEEK } from '../data/routineConstants';
import DayTimeSlotDetailModal from "./modals/DayTimeSlotDetailModal";
import SearchableProgramDropdown from '../SearchableProgramDropdown';
import DaySelector from './DaySelector';
import { PROGRAM_TYPES, SEMESTER_SYSTEMS } from '../data/programConstants';
import { useAuth } from '../contexts/AuthContext';

// --- Reusable UI Components (modified for reduced height) ---

const InfoCard = ({ title, mainValue, icon, gradientClasses }: { title: string, mainValue: string | number, icon: React.ReactElement, gradientClasses?: string }) => {
    const isGradient = !!gradientClasses;

    return (
        <div className={`p-1.5 rounded-lg shadow-lg flex flex-col justify-between relative ${isGradient ? gradientClasses : 'bg-white'}`}>
            <div>
                <div className="flex items-start justify-between">
                    <div>
                        <p className={`text-[10px] font-medium ${isGradient ? 'text-white/80' : 'text-gray-500'}`}>{title}</p>
                        <p className={`text-lg font-bold ${isGradient ? 'text-white' : 'text-gray-800'}`}>{mainValue}</p>
                    </div>
                    <div className={`${isGradient ? 'bg-white/20 text-white' : 'bg-teal-100 text-teal-600'} p-1 rounded-md`}>
                        {React.cloneElement(icon as React.ReactElement<any>, { className: "h-3.5 w-3.5" })}
                    </div>
                </div>
            </div>
             {/* Reduced spacer height to make card shorter */}
            <div className="mt-1 h-1"></div>
        </div>
    );
};


const SummaryCell: React.FC<{ booked: number; total: number; label?: string; isGrandTotal?: boolean }> = ({ booked, total, label, isGrandTotal = false }) => {
    const occupancy = total > 0 ? booked / total : 0;
    let bgColor = 'bg-slate-200', textColor = 'text-slate-700', progressBgColor = 'bg-slate-400', borderColor = 'border-slate-300';
    if (isGrandTotal) {
      bgColor = 'bg-teal-200'; textColor = 'text-teal-800'; progressBgColor = 'bg-teal-500'; borderColor = 'border-teal-300';
    } else {
        if (total > 0) {
          if (occupancy === 0) { [bgColor, textColor, progressBgColor, borderColor] = ['bg-green-100', 'text-green-800', 'bg-green-500', 'border-green-200']; }
          else if (occupancy < 1) { [bgColor, textColor, progressBgColor, borderColor] = ['bg-amber-100', 'text-amber-800', 'bg-amber-500', 'border-amber-200']; }
          else { [bgColor, textColor, progressBgColor, borderColor] = ['bg-red-100', 'text-red-800', 'bg-red-500', 'border-red-200']; }
        }
    }

    return (
        <div className={`h-full w-full rounded-md shadow-sm p-1.5 flex flex-col justify-between border ${borderColor} ${bgColor}`}>
            <div>
                {label && <div className={`text-[10px] font-semibold mb-1 ${textColor}`}>{label}</div>}
                <div className="flex justify-between items-baseline">
                    <span className={`font-bold text-lg ${textColor}`}>{booked}</span>
                    <span className={`text-xs font-medium ${textColor}`}>/{total}</span>
                </div>
            </div>
            <div>
                <div className="text-right text-[10px] font-semibold text-gray-500 mb-1">
                    {total > 0 ? `${(occupancy * 100).toFixed(0)}% Full` : 'N/A'}
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1">
                    <div className={`${progressBgColor} h-1 rounded-full`} style={{ width: `${occupancy * 100}%` }}></div>
                </div>
            </div>
        </div>
    );
};

// --- Main Component ---

interface ProgramDetailViewProps {
  programId: string;
  onClose: () => void;
  coursesData: EnrollmentEntry[];
  fullRoutineData: { [semesterId: string]: FullRoutineData };
  rooms: RoomEntry[];
  systemDefaultSlots: DefaultTimeSlot[];
  allSemesterConfigurations: SemesterCloneInfo[];
  allPrograms: ProgramEntry[];
  allRoomTypes: RoomTypeEntry[];
  activeGridDisplayType: 'Theory' | 'Lab' | 'All';
  selectedSemesterId: string | null;
}

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
const calculateDuration = (startTime: string, endTime: string): number => {
    if (!startTime || !endTime) return 0;
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    return ((endH * 60 + endM) - (startH * 60 + startM));
};

const ProgramDetailView: React.FC<ProgramDetailViewProps> = ({
  programId,
  onClose,
  coursesData,
  fullRoutineData,
  rooms,
  systemDefaultSlots,
  allSemesterConfigurations,
  allPrograms,
  allRoomTypes,
  activeGridDisplayType,
  selectedSemesterId,
}) => {
  const { getProgramById, updateProgram, loading: programsLoading } = usePrograms();
  const { user: currentUser } = useAuth();
  const program = getProgramById(programId);

  const [isEditing, setIsEditing] = useState(false);
  const [programForm, setProgramForm] = useState<Partial<ProgramEntry>>({});
  const [programFormError, setProgramFormError] = useState<string | null>(null);

  // State for embedded slot manager
  const [slotType, setSlotType] = useState<'Theory' | 'Lab' | null>(null);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [slotFormError, setSlotFormError] = useState<string | null>(null);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [slotFilterTab, setSlotFilterTab] = useState<ProgramSlotFilterType>('All');
  const [slotSaveSuccessMessage, setSlotSaveSuccessMessage] = useState<string | null>(null);


  const resetSlotManagerForm = useCallback(() => {
    setSlotType(null);
    setStartTime('');
    setEndTime('');
    setSlotFormError(null);
    setEditingSlotId(null);
  }, []);

  useEffect(() => {
    if (isEditing && program) {
        setProgramForm(program);
        resetSlotManagerForm();
        setProgramFormError(null);
    } else {
        setProgramForm({});
    }
  }, [isEditing, program, resetSlotManagerForm]);

  const handleSlotSubmit = useCallback(() => {
    setSlotFormError(null);
    setSlotSaveSuccessMessage(null);
    if (!slotType) { setSlotFormError('Slot Type is required.'); return; }
    if (!startTime || !endTime) { setSlotFormError('Start and End times are required.'); return; }
    if (calculateDuration(startTime, endTime) <= 0) { setSlotFormError('End time must be after start time.'); return; }

    let updatedSlots = [...(programForm.programSpecificSlots || [])];
    const newSlot: DefaultTimeSlot = { id: `prog-slot-${Date.now()}`, type: slotType, startTime, endTime };
    
    if (editingSlotId) {
      updatedSlots = updatedSlots.map(s => s.id === editingSlotId ? { ...s, ...newSlot, id: s.id } : s);
      setSlotSaveSuccessMessage('Slot updated.');
    } else {
      updatedSlots.push(newSlot);
      setSlotSaveSuccessMessage('Slot added.');
    }
    setProgramForm(prev => ({...prev, programSpecificSlots: updatedSlots.sort(sortSlotsByTypeThenTime)}));
    resetSlotManagerForm();
    setTimeout(() => setSlotSaveSuccessMessage(null), 2000);
  }, [slotType, startTime, endTime, editingSlotId, programForm.programSpecificSlots, resetSlotManagerForm]);

  const handleLoadSlotForEdit = useCallback((slot: DefaultTimeSlot) => {
    setEditingSlotId(slot.id);
    setSlotType(slot.type);
    setStartTime(slot.startTime);
    setEndTime(slot.endTime);
    setSlotFormError(null);
  }, []);

  const deleteSlot = (id: string) => {
    setProgramForm(prev => ({...prev, programSpecificSlots: (prev.programSpecificSlots || []).filter(s => s.id !== id)}));
    if (editingSlotId === id) resetSlotManagerForm();
  };
  
  const getSystemDefaultSlotsForTemplate = (): DefaultTimeSlot[] => {
    const savedSlotsJson = localStorage.getItem('defaultTimeSlots');
    if (savedSlotsJson) {
        try {
            const rawSlots = JSON.parse(savedSlotsJson);
            if (Array.isArray(rawSlots)) return rawSlots;
        } catch (e) { console.error("Could not parse default slots for template:", e); }
    }
    return SEED_DEFAULT_SLOTS_DATA.map(s => ({...s, id: `seed-${Math.random()}`}));
  };

  const handleLoadTemplate = () => {
    const systemSlots = getSystemDefaultSlotsForTemplate();
    const currentSlots = programForm.programSpecificSlots || [];
    
    const newSlotsToAdd = systemSlots.filter(
        systemSlot => !currentSlots.some(
            progSlot => progSlot.type === systemSlot.type && progSlot.startTime === systemSlot.startTime && progSlot.endTime === systemSlot.endTime
        )
    ).map(s => ({...s, id: `prog-slot-${Date.now()}-${Math.random()}`}));

    if (newSlotsToAdd.length > 0) {
        setProgramForm(prev => ({...prev, programSpecificSlots: [...currentSlots, ...newSlotsToAdd].sort(sortSlotsByTypeThenTime)}));
        setSlotSaveSuccessMessage(`${newSlotsToAdd.length} template slot(s) loaded.`);
    } else {
        setSlotFormError("All template slots are already in the list.");
    }
    setTimeout(() => {
      setSlotSaveSuccessMessage(null);
      setSlotFormError(null);
    }, 2500);
  };
  
  const handleSaveChanges = async () => {
    setProgramFormError(null);
    if (!programForm.id || !programForm.faculty || !programForm.pId || !programForm.fullName || !programForm.shortName) {
      setProgramFormError("Faculty, P-ID, Full Name, and Short Name are required.");
      return;
    }
    try {
      await updateProgram(programForm as ProgramEntry);
      setIsEditing(false);
    } catch (e: any) {
      setProgramFormError(e.message || 'Failed to update program.');
    }
  };

  const filteredSlots = useMemo(() => {
    const slots = programForm.programSpecificSlots || [];
    if (slotFilterTab === 'All') return slots;
    return slots.filter(s => s.type === slotFilterTab);
  }, [programForm.programSpecificSlots, slotFilterTab]);
  
  const stats = useMemo(() => {
    if (!program) return {};

    let relevantCourses = coursesData.filter(c => c.pId === program.pId);
    let allRelevantRooms = rooms.filter(r => r.assignedToPId === program.pId || r.sharedWithPIds.includes(program.pId));

    if (selectedSemesterId) {
        relevantCourses = relevantCourses.filter(c => c.semester === selectedSemesterId);
        allRelevantRooms = allRelevantRooms.filter(r => r.semesterId === selectedSemesterId);
    }
    
    const filteredCourses = activeGridDisplayType === 'All'
        ? relevantCourses
        : relevantCourses.filter(c => c.courseType === activeGridDisplayType);
    
    const roomSupportsSlotType = (room: RoomEntry, type: 'Theory' | 'Lab') => {
        const slotsToCheck = (room.roomSpecificSlots?.length ?? 0) > 0 ? room.roomSpecificSlots : systemDefaultSlots;
        return slotsToCheck.some(s => s.type === type);
    };

    const filteredRooms = allRelevantRooms.filter(room => activeGridDisplayType === 'All' || roomSupportsSlotType(room, activeGridDisplayType));

    const uniqueCoursesMap = new Map<string, EnrollmentEntry>();
    filteredCourses.forEach(course => {
        if (!uniqueCoursesMap.has(course.courseCode)) {
            uniqueCoursesMap.set(course.courseCode, course);
        }
    });
    const uniqueCourseList = Array.from(uniqueCoursesMap.values());
    
    const assignedRoomList = filteredRooms.filter(r => r.assignedToPId === program.pId);
    const sharedRoomList = filteredRooms.filter(r => r.sharedWithPIds.includes(program.pId));
    
    const uniqueAssignedRooms = new Map<string, RoomEntry>();
    assignedRoomList.forEach(room => {
        const key = `${room.buildingId}-${room.roomNumber}`;
        if (!uniqueAssignedRooms.has(key)) {
            uniqueAssignedRooms.set(key, room);
        }
    });

    const uniqueSharedRooms = new Map<string, RoomEntry>();
    sharedRoomList.forEach(room => {
        const key = `${room.buildingId}-${room.roomNumber}`;
        if (!uniqueSharedRooms.has(key)) {
            uniqueSharedRooms.set(key, room);
        }
    });
    
    const weeklyClassSum = filteredCourses.reduce((sum, course) => sum + (course.weeklyClass || 0), 0);
    
    const totalUniqueTeacherIds = new Set(relevantCourses.map(c => c.teacherId));
    const totalCreditHours = relevantCourses.reduce((sum, course) => sum + course.credit, 0);

    let totalSlots = 0;
    
    const uniqueFilteredRooms = new Map<string, RoomEntry>();
    filteredRooms.forEach(room => {
        const key = `${room.buildingId}-${room.roomNumber}`;
        if (!uniqueFilteredRooms.has(key)) {
            uniqueFilteredRooms.set(key, room);
        }
    });
    
    uniqueFilteredRooms.forEach(room => {
        const activeDaysCount = program?.activeDays?.length || 0;
        if (activeDaysCount > 0) {
            const slotsForRoom = (room.roomSpecificSlots?.length ?? 0) > 0 ? room.roomSpecificSlots : systemDefaultSlots;
            slotsForRoom.forEach(slot => {
                if (activeGridDisplayType === 'All' || slot.type === activeGridDisplayType) {
                    totalSlots += activeDaysCount;
                }
            });
        }
    });

    let bookedSlots = 0;
    const routineForSemester = selectedSemesterId ? fullRoutineData[selectedSemesterId] || {} : {};
    
    const roomNumbersInScope = new Set(filteredRooms.map(r => r.roomNumber));

    (program?.activeDays || []).forEach(day => {
        const dayData = routineForSemester[day as DayOfWeek];
        if (dayData) {
            Object.entries(dayData).forEach(([roomNumber, roomSlots]) => {
                if (roomNumbersInScope.has(roomNumber)) {
                    Object.values(roomSlots).forEach(classInfo => {
                        if (classInfo && classInfo.pId === program.pId) {
                            const course = filteredCourses.find(c =>
                                c.courseCode === classInfo.courseCode &&
                                c.section === classInfo.section
                            );
                            if (course) { 
                                bookedSlots++;
                            }
                        }
                    });
                }
            });
        }
    });

    return {
        teacherCount: totalUniqueTeacherIds.size,
        courseCount: uniqueCourseList.length,
        sectionCount: filteredCourses.length,
        assignedRoomCount: uniqueAssignedRooms.size,
        sharedRoomCount: uniqueSharedRooms.size,
        creditHours: totalCreditHours,
        weeklyClassSum: weeklyClassSum,
        totalSlotCount: totalSlots,
        bookedSlotCount: bookedSlots,
    };
  }, [program, coursesData, rooms, selectedSemesterId, activeGridDisplayType, systemDefaultSlots, fullRoutineData, allRoomTypes]);
  
  const routineOverviewData = useMemo(() => {
    if (!program) return { overview: {}, headerSlotsForGrid: [], activeDaysForGrid: [], columnTotals: [], daySummaries: {}, grandTotal: { booked: 0, total: 0 } };

    let relevantRooms = rooms.filter(r => r.assignedToPId === program.pId || r.sharedWithPIds.includes(program.pId));
    if (selectedSemesterId) {
      relevantRooms = relevantRooms.filter(r => r.semesterId === selectedSemesterId);
    }

    const headerSlotsForGrid = (program.programSpecificSlots?.length ? program.programSpecificSlots : systemDefaultSlots)
      .filter(slot => {
        if (activeGridDisplayType === 'All' || activeGridDisplayType === 'Theory') {
            return slot.type === 'Theory';
        }
        return slot.type === activeGridDisplayType;
      })
      .sort(sortSlotsByTypeThenTime);
        
    const routineForSemester = selectedSemesterId ? fullRoutineData[selectedSemesterId] || {} : {};
    
    const activeDaysForGrid = program.activeDays?.length ? program.activeDays : DAYS_OF_WEEK;

    const columnTotals = Array(headerSlotsForGrid.length).fill(0).map(() => ({ booked: 0, total: 0 }));
    const overview: { [day: string]: { [slot: string]: { total: number, booked: number } } } = {};
    const daySummaries: { [day: string]: { booked: number; total: number } } = {};

    activeDaysForGrid.forEach(day => {
        overview[day] = {};
        const daySummary = { booked: 0, total: 0 };
        headerSlotsForGrid.forEach((slotObj, slotIndex) => {
            const slotString = formatDefaultSlotToString(slotObj);

            let totalActiveRoomsForSlot = 0;
            let bookedRoomsForSlot = 0;

            relevantRooms.forEach(room => {
                const roomOperatingSlots = (room.roomSpecificSlots?.length ?? 0) > 0 
                    ? room.roomSpecificSlots 
                    : systemDefaultSlots;

                const isRoomActiveForThisSlot = roomOperatingSlots.some(
                    roomSlot => roomSlot.type === slotObj.type && 
                                roomSlot.startTime === slotObj.startTime && 
                                roomSlot.endTime === slotObj.endTime
                );

                if (isRoomActiveForThisSlot) {
                    totalActiveRoomsForSlot++;
                    const classInSlot = routineForSemester[day as DayOfWeek]?.[room.roomNumber]?.[slotString];
                    if (classInSlot && classInSlot.pId === program.pId) {
                        bookedRoomsForSlot++;
                    }
                }
            });

            overview[day][slotString] = { total: totalActiveRoomsForSlot, booked: bookedRoomsForSlot };

            daySummary.total += totalActiveRoomsForSlot;
            daySummary.booked += bookedRoomsForSlot;
            columnTotals[slotIndex].total += totalActiveRoomsForSlot;
            columnTotals[slotIndex].booked += bookedRoomsForSlot;
        });
        daySummaries[day] = daySummary;
    });

    const grandTotal = columnTotals.reduce((acc, curr) => ({ booked: acc.booked + curr.booked, total: acc.total + curr.total }), { booked: 0, total: 0 });
    
    return { overview, headerSlotsForGrid, activeDaysForGrid, columnTotals, daySummaries, grandTotal };
  }, [program, selectedSemesterId, rooms, fullRoutineData, systemDefaultSlots, activeGridDisplayType]);

  const renderDashboard = () => (
    <div className="bg-white rounded-lg shadow-inner border border-gray-200 p-2 flex-grow flex flex-col min-h-0">
       <div className="flex-grow min-h-0 overflow-auto custom-scrollbar -m-1 p-1">
        <table className="min-w-full table-fixed border-separate" style={{ borderSpacing: '3px' }}>
          <thead className="sticky top-0 bg-slate-100 z-10">
              <tr>
                  <th className="w-20 p-1 text-center text-[11px] font-bold text-white uppercase bg-teal-700 rounded-md shadow-sm">Day/Time</th>
                  {routineOverviewData.headerSlotsForGrid.map(slot => (
                      <th key={slot.id} className="w-24 p-1 text-center text-[9px] font-bold text-white uppercase break-words bg-teal-700 rounded-md shadow-sm">{formatDefaultSlotToString(slot).replace(/\s*-\s*/, '-')}</th>
                  ))}
                  <th className="w-24 p-1 text-center text-[11px] font-bold text-white uppercase bg-teal-800 rounded-md shadow-sm">Daily Summary</th>
              </tr>
          </thead>
          <tbody>{routineOverviewData.activeDaysForGrid.map(day => {
            const daySummary = routineOverviewData.daySummaries[day];
            return (
            <tr key={day}>
                <th className="p-1.5 text-xs font-bold text-white bg-teal-600 rounded-md shadow-sm h-6">{day}</th>
                {routineOverviewData.headerSlotsForGrid.map(slot => {
                  const slotString = formatDefaultSlotToString(slot);
                  const data = routineOverviewData.overview[day]?.[slotString];
                  return (<td key={slot.id} className="p-0.5 h-6"><SummaryCell booked={data?.booked ?? 0} total={data?.total ?? 0} /></td>);
                })}
                <td className="p-0.5 h-6"><SummaryCell booked={daySummary.booked} total={daySummary.total} isGrandTotal={true}/></td>
            </tr>);})}
          </tbody>
          <tfoot className="sticky bottom-0 bg-white/80 backdrop-blur-sm">
              <tr>
                  <th className="p-1.5 text-xs font-bold text-white bg-slate-800 rounded-md h-6">Total</th>
                  {routineOverviewData.columnTotals.map((colTotal, index) => (
                  <td key={`total-${index}`} className="p-0.5 h-6"><SummaryCell booked={colTotal.booked} total={colTotal.total} isGrandTotal={true} /></td>))}
                  <td className="p-0.5 h-6"><SummaryCell booked={routineOverviewData.grandTotal.booked} total={routineOverviewData.grandTotal.total} isGrandTotal={true} /></td>
              </tr>
          </tfoot>
        </table>
       </div>
    </div>
  );

  const renderEditForm = () => (
    <div className="bg-white rounded-lg shadow-inner border border-gray-200 p-3 flex-grow flex flex-col min-h-0 overflow-y-auto custom-scrollbar">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
        {/* Left Column */}
        <div className="space-y-6 flex flex-col">
          {programFormError && <p className="text-red-500 text-sm">{programFormError}</p>}
          
          <fieldset className="border border-gray-300 p-3 rounded-md">
            <legend className="text-sm font-medium text-gray-700 px-1">Program Details</legend>
            <div className="space-y-4 pt-2">
              <input type="text" placeholder="Faculty" value={programForm.faculty || ''} onChange={e => setProgramForm({...programForm, faculty: e.target.value})} className="w-full p-2 border rounded" />
              <input type="text" placeholder="Program ID (e.g., 15)" value={programForm.pId || ''} onChange={e => setProgramForm({...programForm, pId: e.target.value})} className="w-full p-2 border rounded" />
              <input type="text" placeholder="Full Program Name" value={programForm.fullName || ''} onChange={e => setProgramForm({...programForm, fullName: e.target.value})} className="w-full p-2 border rounded" />
              <input type="text" placeholder="Short Name (e.g., B.Sc. in CSE)" value={programForm.shortName || ''} onChange={e => setProgramForm({...programForm, shortName: e.target.value})} className="w-full p-2 border rounded" />
              <select value={programForm.type} onChange={e => setProgramForm({...programForm, type: e.target.value as ProgramType})} className="w-full p-2 border rounded">
                  {PROGRAM_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
              </select>
              <select value={programForm.semesterSystem} onChange={e => setProgramForm({...programForm, semesterSystem: e.target.value as SemesterSystem})} className="w-full p-2 border rounded">
                  {SEMESTER_SYSTEMS.map(sys => <option key={sys} value={sys}>{sys}</option>)}
              </select>
            </div>
          </fieldset>
          
          <fieldset className="border border-gray-300 p-3 rounded-md">
            <legend className="text-sm font-medium text-gray-700 px-1">Active Days</legend>
            <div className="pt-2">
              <DaySelector days={DAYS_OF_WEEK} selectedDays={programForm.activeDays || []} onDayClick={(day) => setProgramForm({ ...programForm, activeDays: (programForm.activeDays || []).includes(day) ? (programForm.activeDays || []).filter(d => d !== day) : [...(programForm.activeDays || []), day] })}/>
            </div>
          </fieldset>
        </div>

        {/* Right Column */}
        <div className="flex flex-col h-full">
          <fieldset className="border border-gray-300 p-3 rounded-md flex flex-col flex-grow h-full">
            <legend className="text-sm font-medium text-gray-700 px-1">Program-Specific Time Slots</legend>
            <div className="flex flex-col gap-4 mt-2 flex-grow h-full">
              {/* Form for adding/editing slots */}
              <div className="flex-shrink-0 p-3 bg-gray-50 rounded-lg border border-gray-200 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Add New Program Slot</h3>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex-grow min-w-[150px]">
                    <label htmlFor="slotType-program" className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                    <select id="slotType-program" value={slotType ?? ""} onChange={e => setSlotType(e.target.value as 'Theory'|'Lab'|null)} className="w-full p-1.5 rounded-md text-xs border-gray-300 shadow-sm focus:ring-teal-500 focus:border-teal-500 h-9 bg-teal-50/50">
                      <option value="" disabled>Select Type...</option><option value="Theory">Theory</option><option value="Lab">Lab</option>
                    </select>
                  </div>
                  <div className="flex-grow min-w-[120px]">
                    <label htmlFor="startTime-program" className="block text-xs font-medium text-gray-700 mb-1">Start Time</label>
                      <div className="relative">
                      <input id="startTime-program" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full p-1.5 pr-8 rounded-md text-xs border-gray-300 shadow-sm focus:ring-teal-500 focus:border-teal-500 h-9 bg-teal-50/50"/>
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none"><svg className="h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.414-1.415L11 9.586V6z" clipRule="evenodd" /></svg></div>
                    </div>
                  </div>
                  <div className="flex-grow min-w-[120px]">
                    <label htmlFor="endTime-program" className="block text-xs font-medium text-gray-700 mb-1">End Time</label>
                      <div className="relative">
                      <input id="endTime-program" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full p-1.5 pr-8 rounded-md text-xs border-gray-300 shadow-sm focus:ring-teal-500 focus:border-teal-500 h-9 bg-teal-50/50"/>
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none"><svg className="h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.414-1.415L11 9.586V6z" clipRule="evenodd" /></svg></div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                      {editingSlotId && (<button onClick={resetSlotManagerForm} className="px-4 py-2 bg-gray-200 text-gray-700 text-xs font-medium rounded-md hover:bg-gray-300">Cancel</button>)}
                      <button onClick={handleSlotSubmit} className="px-4 py-2 bg-teal-600 text-white text-xs font-semibold rounded-md hover:bg-teal-700 transition-colors">{editingSlotId ? 'Update Slot' : 'Add Slot'}</button>
                  </div>
                </div>
                {slotFormError && <p className="text-xs text-red-600 mt-2">{slotFormError}</p>}
              </div>
              
              {/* List of slots */}
              <div className="flex-grow flex flex-col min-h-0 bg-gray-50 p-3 rounded-lg border border-gray-200 shadow-sm mt-4">
                <div className="flex-shrink-0 flex items-center justify-between border-b pb-2 mb-2"><div className="flex items-center gap-2"><h3 className="text-sm font-semibold text-gray-700">Program Slots</h3><div className="flex space-x-1">{(['All', 'Theory', 'Lab'] as ProgramSlotFilterType[]).map(tab => (<button key={tab} onClick={() => setSlotFilterTab(tab)} className={`px-2 py-1 text-xs rounded-md flex items-center gap-1.5 ${slotFilterTab === tab ? 'bg-teal-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>{tab} <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${slotFilterTab === tab ? 'bg-white text-teal-600' : 'bg-gray-400 text-white'}`}>{(programForm.programSpecificSlots || []).filter(s => tab === 'All' || s.type === tab).length}</span></button>))}</div></div><div className="flex items-center gap-2">{slotSaveSuccessMessage && <p className="text-xs text-green-600 animate-pulse">{slotSaveSuccessMessage}</p>}<button onClick={handleLoadTemplate} className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-md hover:bg-blue-700 flex items-center justify-center gap-1"><svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>Load Template</button></div></div>
                <div className="flex-grow overflow-y-auto custom-scrollbar pr-2 -mr-2 space-y-1.5 max-h-56">
                  {filteredSlots.length > 0 ? filteredSlots.map(slot => (<div key={slot.id} className="flex items-center p-1.5 rounded-md bg-white border cursor-pointer hover:bg-teal-50/50" onClick={() => handleLoadSlotForEdit(slot)}><div className={`font-semibold text-xs w-12 ${slot.type === 'Lab' ? 'text-blue-600' : 'text-green-600'}`}>{slot.type}</div><div className="flex-grow text-center text-xs text-gray-700">{formatTimeToAMPM(slot.startTime)} - {formatTimeToAMPM(slot.endTime)}</div><div className="text-xs text-gray-500 w-16 text-right">({calculateDuration(slot.startTime, slot.endTime)} min)</div><button onClick={(e) => { e.stopPropagation(); deleteSlot(slot.id); }} className="ml-2 p-1 text-red-500 hover:bg-red-100 rounded-full"><svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg></button></div>)) : (<div className="text-center text-xs text-gray-500 italic py-6">No slots for this filter.</div>)}
                </div>
              </div>
            </div>
          </fieldset>
        </div>
      </div>
    </div>
  );

  if (programsLoading) {
    return <div className="p-6 text-center text-gray-500">Loading program details...</div>;
  }
  if (!program) {
    return <div className="p-6 bg-white rounded-lg shadow-xl text-center"><h2 className="text-xl font-semibold text-red-600">Program Not Found</h2><p className="text-gray-600 mt-2">ID: {programId}</p></div>;
  }

  const gradients = [
    'bg-gradient-to-br from-blue-500 to-indigo-600', 'bg-gradient-to-br from-green-500 to-teal-600',
    'bg-gradient-to-br from-purple-500 to-pink-600', 'bg-gradient-to-br from-yellow-500 to-orange-600',
    'bg-gradient-to-br from-cyan-500 to-sky-600', 'bg-gradient-to-br from-slate-500 to-slate-700',
    'bg-gradient-to-br from-rose-500 to-red-600', 'bg-gradient-to-br from-fuchsia-500 to-purple-600',
  ];

  return (
    <div className="bg-slate-100 p-3 rounded-lg h-full flex flex-col relative">
      <div className="flex-shrink-0 mb-3 pb-3 border-b border-gray-200 flex justify-between items-center">
        <div>
            <h2 className="text-xl font-semibold text-teal-700 truncate">{program.fullName}</h2>
            <p className="text-xs text-gray-500">{program.faculty} ({program.pId})</p>
        </div>
        <div className="flex items-center gap-2">
            {isEditing ? (
                <>
                    <button onClick={() => setIsEditing(false)} className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-md">Cancel</button>
                    <button onClick={handleSaveChanges} className="px-3 py-1.5 text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-md">Save Changes</button>
                </>
            ) : (
                <button 
                  onClick={() => setIsEditing(true)} 
                  disabled={!currentUser?.programManagementAccess?.canEditProgram}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-md flex items-center gap-1.5 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  title={!currentUser?.programManagementAccess?.canEditProgram ? "You do not have permission to edit programs" : ""}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>
                    Edit Program
                </button>
            )}
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-red-700 hover:bg-red-100 rounded-full transition-colors" aria-label="Close program details">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
        </div>
      </div>
      
      <main className="flex-grow flex flex-col min-h-0 pt-2">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 mb-3">
            <InfoCard title="Total Teachers" mainValue={stats.teacherCount ?? 0} icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm-9 3a2 2 0 11-4 0 2 2 0 014 0z" /></svg>} gradientClasses={gradients[7]} />
            <InfoCard title="Total Courses" mainValue={stats.courseCount ?? 0} icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>} gradientClasses={gradients[0]} />
            <InfoCard title="Total Sections" mainValue={stats.sectionCount ?? 0} icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>} gradientClasses={gradients[1]} />
            <InfoCard title="Assigned Rooms" mainValue={stats.assignedRoomCount ?? 0} icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>} gradientClasses={gradients[2]} />
            <InfoCard title="Shared Rooms" mainValue={stats.sharedRoomCount ?? 0} icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.862 13.045 9 12.736 9 12.42c0-1.043-.483-2-1.316-2.65-1.053-.82-2.684-1.23-4.184-1.23-1.5 0-3.13.41-4.184 1.23C-.483 10.42 0 11.377 0 12.42c0 .316.138.625.316.922m10.368 0a4.5 4.5 0 01-8.714 0M12 6a3.5 3.5 0 11-7 0 3.5 3.5 0 017 0z" /></svg>} gradientClasses={gradients[3]} />
            <InfoCard title="Total Credits" mainValue={stats.creditHours ?? 0} icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>} gradientClasses={gradients[4]} />
            <InfoCard title="Slot Requirement" mainValue={stats.weeklyClassSum ?? 0} icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h5m-5 2a9 9 0 001.378 5.622M20 20v-5h-5m5 2a9 9 0 00-1.378-5.622" /></svg>} gradientClasses={gradients[6]} />
            <InfoCard 
                title="Slot Usage"
                mainValue={`${stats.bookedSlotCount ?? 0} / ${stats.totalSlotCount ?? 0}`}
                icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                gradientClasses={gradients[6]}
            />
          </div>

          {isEditing ? renderEditForm() : renderDashboard()}
      </main>
    </div>
  );
};

export default ProgramDetailView;