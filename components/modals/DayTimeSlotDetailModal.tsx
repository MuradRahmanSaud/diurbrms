
import React, { useCallback, useState, useEffect, useMemo } from 'react';
import { DayOfWeek, FullRoutineData, RoomEntry, ClassDetail, DefaultTimeSlot, ScheduleOverrides, SemesterCloneInfo, ProgramEntry } from '../../types';
// Modal import removed as this component will now be the panel itself.
import { formatDefaultSlotToString as formatSlotObjectToString } from '../../App'; 

interface DayTimeSlotDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  day: DayOfWeek;
  selectedSlotObject: DefaultTimeSlot; 
  systemDefaultSlots: DefaultTimeSlot[]; 
  fullRoutineData: FullRoutineData;
  roomEntries: RoomEntry[];
  onRoomNameClick: (room: RoomEntry) => void;
  getProgramShortName: (pId?: string) => string;
  activeProgramIdInSidebar: string | null;
  scheduleOverrides: ScheduleOverrides;
  selectedDate: string | null; // Added prop
  allSemesterConfigurations: SemesterCloneInfo[];
  allPrograms: ProgramEntry[];
}

const colorMapping: { [key: string]: string } = {
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

const getAccentBarColorClass = (baseColor?: string): string => {
  if (baseColor && colorMapping[baseColor]) {
    return colorMapping[baseColor];
  }
  return 'bg-gray-400';
};

// Helper function to get the day of the week from an ISO date string
const getDayOfWeekFromISO = (isoDate: string): DayOfWeek | null => {
    if (!isoDate) return null;
    try {
        const date = new Date(isoDate + 'T00:00:00Z');
        const dayIndex = date.getUTCDay();
        const jsDayMap: { [key: number]: DayOfWeek } = { 
            0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday' 
        };
        return jsDayMap[dayIndex];
    } catch (e) {
        console.error("Failed to get day of week from ISO date", e);
        return null;
    }
};

interface RoomCardProps {
    room: RoomEntry;
    classInfo?: ClassDetail | null;
    isEffectivelyInactive: boolean;
    headerBadgeContent: React.ReactNode;
    headerBadgeTitle: string;
    onRoomNameClick: (room: RoomEntry) => void;
    isMakeup: boolean;
    makeupDate?: string;
    slotStartTime?: string;
    slotEndTime?: string;
}

const RoomCard: React.FC<RoomCardProps> = React.memo(({
    room, classInfo, isEffectivelyInactive, headerBadgeContent, headerBadgeTitle, onRoomNameClick,
    isMakeup, makeupDate, slotStartTime, slotEndTime
}) => {
    const [countdown, setCountdown] = useState<{ status: 'upcoming' | 'in_progress' | 'finished'; time?: { days: number; hours: number; minutes: number; seconds: number } } | null>(null);

    useEffect(() => {
        if (!isMakeup || !makeupDate || !slotStartTime || !slotEndTime) {
            setCountdown(null);
            return;
        }

        const startDateTime = new Date(`${makeupDate}T${slotStartTime}:00`);
        const endDateTime = new Date(`${makeupDate}T${slotEndTime}:00`);
        
        const calculateTime = () => {
            const now = new Date();
            const timeToStart = startDateTime.getTime() - now.getTime();
            const timeToEnd = endDateTime.getTime() - now.getTime();

            if (timeToStart > 0) {
                setCountdown({
                    status: 'upcoming',
                    time: {
                        days: Math.floor(timeToStart / (1000 * 60 * 60 * 24)),
                        hours: Math.floor((timeToStart / (1000 * 60 * 60)) % 24),
                        minutes: Math.floor((timeToStart / 1000 / 60) % 60),
                        seconds: Math.floor((timeToStart / 1000) % 60),
                    }
                });
            } else if (timeToEnd > 0) {
                setCountdown({
                    status: 'in_progress',
                    time: {
                        days: Math.floor(timeToEnd / (1000 * 60 * 60 * 24)),
                        hours: Math.floor((timeToEnd / (1000 * 60 * 60)) % 24),
                        minutes: Math.floor((timeToEnd / 1000 / 60) % 60),
                        seconds: Math.floor((timeToEnd / 1000) % 60),
                    }
                });
            } else {
                setCountdown({ status: 'finished' });
            }
        };
        
        calculateTime();
        const interval = setInterval(calculateTime, 1000);

        return () => clearInterval(interval);
    }, [isMakeup, makeupDate, slotStartTime, slotEndTime]);

    return (
        <div 
            key={room.id} 
            className="rounded-lg shadow-md bg-white flex flex-col overflow-hidden border border-gray-200 hover:shadow-lg transition-shadow duration-150 ease-in-out"
        >
            <div className="bg-gray-50 p-1.5 border-b border-gray-200">
                <div className="flex justify-between items-center gap-1">
                    <h5 
                        className="font-semibold text-xs text-teal-700 cursor-pointer hover:underline truncate"
                        onClick={() => onRoomNameClick(room)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onRoomNameClick(room); }}
                        role="button"
                        tabIndex={0}
                        title={`View details for room ${room.roomNumber}`}
                    >
                        {room.roomNumber}
                    </h5>
                    {headerBadgeContent && (
                        <span
                            className={`text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full whitespace-nowrap flex-shrink-0`}
                            title={headerBadgeTitle}
                        >
                            {headerBadgeContent}
                        </span>
                    )}
                </div>
            </div>
            <div className="p-0 flex-grow min-h-[80px] flex">
                {isEffectivelyInactive ? (
                    <div className="h-full w-full flex items-center justify-center text-xs text-gray-400 bg-gray-200 rounded-b-md p-2 italic opacity-60">
                        N/A
                    </div>
                ) : classInfo ? (
                    <div className="relative h-full w-full rounded-b-md bg-white flex overflow-hidden">
                        <div className={`w-1 ${getAccentBarColorClass(classInfo.color)} flex-shrink-0`}></div>
                        <div className="p-1.5 flex-grow flex flex-col justify-center items-center text-center overflow-hidden">
                            <p className="font-semibold text-gray-800 truncate text-[11px]" title={`${classInfo.courseCode} (${classInfo.section})`}>
                                {classInfo.courseCode} ({classInfo.section})
                            </p>
                            {isMakeup && countdown ? (
                                <div className="text-gray-600 text-[9px] mt-1 truncate w-full font-mono font-medium" title={`Make-up on ${makeupDate}`}>
                                    {countdown.status === 'finished' ? (
                                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">Finished</span>
                                    ) : countdown.status === 'upcoming' && countdown.time ? (
                                        <span className="text-blue-600">
                                            <span className="font-sans font-medium text-[8px]">Starts: </span>
                                            {countdown.time.days > 0 && `${countdown.time.days}d `}
                                            {`${String(countdown.time.hours).padStart(2, '0')}:${String(countdown.time.minutes).padStart(2, '0')}`}
                                        </span>
                                    ) : countdown.status === 'in_progress' && countdown.time ? (
                                        <span className="text-green-700 animate-pulse">
                                            <span className="font-sans font-medium text-[8px]">Ends: </span>
                                            {`${String(countdown.time.hours).padStart(2, '0')}:${String(countdown.time.minutes).padStart(2, '0')}`}
                                        </span>
                                    ) : null}
                                </div>
                            ) : (
                                <p className="text-gray-500 truncate text-[10px] mt-0.5" title={classInfo.teacher}>
                                    {classInfo.teacher}
                                </p>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="h-full w-full flex items-center justify-center text-xs text-green-700 bg-green-50 rounded-b-md p-2 italic font-medium">
                        Free
                    </div>
                )}
            </div>
        </div>
    );
});
RoomCard.displayName = 'RoomCard';

const DayTimeSlotDetailModal: React.FC<DayTimeSlotDetailModalProps> = ({
  isOpen,
  onClose,
  day,
  selectedSlotObject,
  systemDefaultSlots,
  fullRoutineData,
  roomEntries,
  onRoomNameClick,
  getProgramShortName,
  activeProgramIdInSidebar,
  scheduleOverrides,
  selectedDate,
  allSemesterConfigurations,
  allPrograms,
}) => {
  const [activeTab, setActiveTab] = useState<'booked' | 'free'>('booked');
  const slotStringForLookup = formatSlotObjectToString(selectedSlotObject);

  const isRoomActiveForSlot = useCallback((room: RoomEntry, slotObj: DefaultTimeSlot): boolean => {
    // A room's active slots are defined only by its own roomSpecificSlots array.
    // If this array is empty or undefined, the room is not active for any slot.
    const authoritativeSlots = room.roomSpecificSlots || [];
    return authoritativeSlots.some(
      roomSlot =>
        roomSlot.type === slotObj.type &&
        roomSlot.startTime === slotObj.startTime &&
        roomSlot.endTime === slotObj.endTime
    );
  }, []);

  const getAllDatesForDay = useCallback((
    targetDay: DayOfWeek,
    room: RoomEntry
  ): string[] => {
    const roomSemesterId = room.semesterId;
    if (!roomSemesterId) return [];
  
    const semesterConfig = allSemesterConfigurations.find(c => c.targetSemester === roomSemesterId);
    if (!semesterConfig) return [];
  
    const assignedProgram = allPrograms.find(p => p.pId === room.assignedToPId);
    if (!assignedProgram) return [];
  
    const systemType = assignedProgram.semesterSystem;
    const typeConfig = semesterConfig.typeConfigs.find(tc => tc.type === systemType);
    if (!typeConfig || !typeConfig.startDate || !typeConfig.endDate) return [];
  
    const { startDate, endDate } = typeConfig;
  
    const semesterStartDate = new Date(startDate + 'T00:00:00Z');
    const semesterEndDate = new Date(endDate + 'T00:00:00Z');
  
    const dates: string[] = [];
    const jsDayMap = { 'Saturday': 6, 'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5 };
    const targetJsDay = jsDayMap[targetDay];
    if (targetJsDay === undefined) return [];

    let currentDate = new Date(semesterStartDate.getTime());
    
    const dayDifference = (targetJsDay - currentDate.getUTCDay() + 7) % 7;
    currentDate.setUTCDate(currentDate.getUTCDate() + dayDifference);
    
    while (currentDate <= semesterEndDate) {
        const year = currentDate.getUTCFullYear();
        const month = (currentDate.getUTCMonth() + 1).toString().padStart(2, '0');
        const d = currentDate.getUTCDate().toString().padStart(2, '0');
        dates.push(`${year}-${month}-${d}`);
        currentDate.setUTCDate(currentDate.getUTCDate() + 7);
    }

    return dates;
  }, [allSemesterConfigurations, allPrograms]);
  
  const categorizedRooms = useMemo(() => {
    const free: RoomEntry[] = [];
    const booked: { room: RoomEntry; classInfo: ClassDetail; isMakeup: boolean; makeupDate?: string }[] = [];

    roomEntries.forEach(room => {
        // Only include rooms that are specifically active for this exact time slot.
        if (!isRoomActiveForSlot(room, selectedSlotObject)) {
            return; // Skip this room if it's not active for the selected slot.
        }

        let classInfo: ClassDetail | null | undefined;
        let isMakeupClass = false;
        let classDate: string | undefined = undefined;

        if (selectedDate) {
            const dayOfSelectedDate = getDayOfWeekFromISO(selectedDate);
            if (day !== dayOfSelectedDate) {
                classInfo = null;
            } else {
                const overrideInfo = scheduleOverrides[room.roomNumber]?.[slotStringForLookup]?.[selectedDate];
                const defaultClassInfo = fullRoutineData[day]?.[room.roomNumber]?.[slotStringForLookup];
                if (overrideInfo !== undefined) {
                    classInfo = overrideInfo;
                    isMakeupClass = true;
                    classDate = selectedDate;
                } else {
                    classInfo = defaultClassInfo;
                    isMakeupClass = false;
                }
            }
        } else {
            const defaultClass = fullRoutineData[day]?.[room.roomNumber]?.[slotStringForLookup];
            const allDatesForDay = getAllDatesForDay(day, room);
            
            let nextUpcomingMakeup: { classInfo: ClassDetail, date: string } | null = null;
            
            for (const date of allDatesForDay) {
                const overrideInfo = scheduleOverrides[room.roomNumber]?.[slotStringForLookup]?.[date];
                if (overrideInfo) {
                    const endDateTime = new Date(`${date}T${selectedSlotObject.endTime}:00`);
                    if (new Date() < endDateTime) {
                        nextUpcomingMakeup = { classInfo: overrideInfo, date: date };
                        break;
                    }
                }
            }

            if (nextUpcomingMakeup) {
                classInfo = nextUpcomingMakeup.classInfo;
                isMakeupClass = true;
                classDate = nextUpcomingMakeup.date;
            } else {
                classInfo = defaultClass;
                isMakeupClass = false;
                classDate = undefined;
            }
        }

        if (classInfo) {
            booked.push({ room, classInfo, isMakeup: isMakeupClass, makeupDate: classDate });
        } else {
            free.push(room);
        }
    });

    return { free, booked };
  }, [roomEntries, selectedSlotObject, day, selectedDate, scheduleOverrides, fullRoutineData, slotStringForLookup, getAllDatesForDay, isRoomActiveForSlot]);

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab('booked');
  }, [isOpen]);

  if (!isOpen) return null;

  const formatDateForDisplay = (dateString: string): string => {
    if (!dateString) return 'N/A';
    const parts = dateString.split('-');
    if (parts.length !== 3) return dateString;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const dayOfMonth = parseInt(parts[2], 10);
    const date = new Date(year, month, dayOfMonth);
    
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    }).format(date);
  };
  
  const modalTitle = `Schedule for ${day}`;
  const modalSubTitle = selectedDate ? `${slotStringForLookup} on ${formatDateForDisplay(selectedDate)}` : slotStringForLookup;
  
  const getTabButtonClasses = (tabName: 'booked' | 'free') => {
    const base = 'whitespace-nowrap pb-2 px-1 border-b-2 font-medium text-xs transition-colors flex items-center gap-1.5';
    if (activeTab === tabName) {
      return `${base} border-teal-500 text-teal-600`;
    }
    return `${base} border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300`;
  };

  const getTabBadgeClasses = () => 'px-1.5 py-0.5 rounded-full text-xs font-semibold bg-gray-200 text-gray-600';

  const getActiveTabBadgeClasses = () => 'px-1.5 py-0.5 rounded-full text-xs font-semibold bg-teal-500 text-white';

  return (
    <div 
      className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[85vh] flex flex-col overflow-hidden transform transition-all duration-300 ease-out"
      role="dialog"
      aria-modal="true"
      aria-labelledby="daytimeslot-modal-title"
      aria-describedby="daytimeslot-modal-subtitle"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between p-2.5 border-b border-gray-200 flex-shrink-0 bg-gray-50/70">
        <div className="flex-grow min-w-0">
          <h3 id="daytimeslot-modal-title" className="text-base font-semibold text-teal-700 truncate" title={modalTitle}>
            {modalTitle}
          </h3>
          <p id="daytimeslot-modal-subtitle" className="text-xs text-gray-500 mt-0.5 truncate" title={modalSubTitle}>
            {modalSubTitle}
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-red-600 p-1 rounded-full hover:bg-red-100 transition-colors ml-2 flex-shrink-0"
          aria-label="Close modal"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="p-3 flex-grow overflow-y-auto custom-scrollbar">
        <div className="border-b border-gray-200 mb-3">
            <nav className="-mb-px flex space-x-3" aria-label="Tabs">
                <button onClick={() => setActiveTab('booked')} className={getTabButtonClasses('booked')} aria-current={activeTab === 'booked' ? 'page' : undefined}>
                    Booked Rooms
                    <span className={activeTab === 'booked' ? getActiveTabBadgeClasses() : getTabBadgeClasses()}>
                        {categorizedRooms.booked.length}
                    </span>
                </button>
                <button onClick={() => setActiveTab('free')} className={getTabButtonClasses('free')} aria-current={activeTab === 'free' ? 'page' : undefined}>
                    Free Rooms
                    <span className={activeTab === 'free' ? getActiveTabBadgeClasses() : getTabBadgeClasses()}>
                        {categorizedRooms.free.length}
                    </span>
                </button>
            </nav>
        </div>
        <div>
            {activeTab === 'booked' && (
                <section aria-labelledby="booked-rooms-heading">
                    <h4 id="booked-rooms-heading" className="sr-only">Booked Rooms</h4>
                    {categorizedRooms.booked.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                            {categorizedRooms.booked.map(({room, classInfo, isMakeup, makeupDate}) => {
                                 const programShortName = getProgramShortName(room.assignedToPId);
                                 const headerBadgeContent = (programShortName && programShortName !== 'N/A') ? programShortName : null;
                                 const headerBadgeTitle = `Assigned Program: ${programShortName}`;
                                return <RoomCard key={room.id} room={room} classInfo={classInfo} isEffectivelyInactive={false} headerBadgeContent={headerBadgeContent} headerBadgeTitle={headerBadgeTitle} onRoomNameClick={onRoomNameClick} isMakeup={isMakeup} makeupDate={makeupDate} slotStartTime={selectedSlotObject.startTime} slotEndTime={selectedSlotObject.endTime} />
                            })}
                        </div>
                    ) : (
                        <div className="text-gray-500 italic text-center py-10">No rooms are booked for this slot.</div>
                    )}
                </section>
            )}
            {activeTab === 'free' && (
                <section aria-labelledby="free-rooms-heading">
                    <h4 id="free-rooms-heading" className="sr-only">Free Rooms</h4>
                    {categorizedRooms.free.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                            {categorizedRooms.free.map(room => {
                                const programShortName = getProgramShortName(room.assignedToPId);
                                const headerBadgeContent = (programShortName && programShortName !== 'N/A') ? programShortName : null;
                                const headerBadgeTitle = `Assigned Program: ${programShortName}`;
                                return <RoomCard key={room.id} room={room} classInfo={null} isEffectivelyInactive={false} headerBadgeContent={headerBadgeContent} headerBadgeTitle={headerBadgeTitle} onRoomNameClick={onRoomNameClick} isMakeup={false} />
                            })}
                        </div>
                    ) : (
                        <div className="text-gray-500 italic text-center py-10">No free rooms are available for this slot.</div>
                    )}
                </section>
            )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(DayTimeSlotDetailModal);
