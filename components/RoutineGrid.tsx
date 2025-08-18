import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { DailyRoutineData, FullRoutineData, ClassDetail, RoomEntry, DayOfWeek, RoutineViewMode, DefaultTimeSlot, ScheduleOverrides, SemesterCloneInfo, ProgramEntry, EnrollmentEntry, TimeSlot, AttendanceLogEntry, ConflictInfoForModal, PendingChange, User } from '../types';
import { DAYS_OF_WEEK } from '../data/routineConstants';
import { formatDefaultSlotToString as formatSlotObjectToString, formatTimeToAMPM } from '../App';
import { getAccentColor } from '../data/colorConstants';

interface ConflictDetails {
    teacherConflict: boolean;
    sectionConflict: boolean;
    messages: string[];
}

interface ClassCellProps {
  classInfo?: ClassDetail | null;
  isInactiveSlot?: boolean;
  allPrograms: ProgramEntry[];
  isMakeup?: boolean;
  makeupDate?: string;
  slotStartTime?: string;
  slotEndTime?: string;
  isDraggable: boolean;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd?: (e: React.DragEvent<HTMLDivElement>) => void;
  conflictDetails?: ConflictDetails;
  isHighlighted?: boolean;
  isDimmed?: boolean;
  studentCount?: number;
  onLogAttendanceClick?: () => void;
  isLoggable?: boolean;
  isLogActionDisabled?: boolean;
  logTooltip?: string;
  onConflictClick?: () => void;
}

const PendingCell: React.FC<{ change: PendingChange }> = React.memo(({ change }) => {
    const { requestedClassInfo, requesterName } = change;
    
    return (
        <div 
            className="h-full rounded-md shadow-lg flex flex-col justify-center items-center text-center overflow-hidden p-1 bg-gray-100 pending-cell-bg"
            title={`Pending change requested by ${requesterName}`}
        >
            <div className="font-semibold text-gray-800 text-xs md:text-sm leading-tight">
                Pending...
            </div>
            {requestedClassInfo ? (
                <>
                    <div className="text-gray-600 text-[10px] md:text-xs mt-0.5">
                       {requestedClassInfo.courseCode} ({requestedClassInfo.section})
                    </div>
                    <div className="text-gray-500 text-[9px] md:text-[10px] mt-0.5 truncate w-full" title={requestedClassInfo.teacher}>
                       {requestedClassInfo.teacher}
                    </div>
                </>
            ) : (
                <div className="text-gray-600 text-[10px] md:text-xs mt-0.5 italic">
                    Clear Slot
                </div>
            )}
            <div className="text-[9px] text-teal-700 font-medium mt-1 truncate w-full" title={`Requested by ${requesterName}`}>
                by {requesterName}
            </div>
        </div>
    );
});
PendingCell.displayName = 'PendingCell';


const ClassCell: React.FC<ClassCellProps> = React.memo(({ classInfo, isInactiveSlot, allPrograms, isMakeup, makeupDate, slotStartTime, slotEndTime, isDraggable, onDragStart, onDragEnd, conflictDetails, isHighlighted, isDimmed, studentCount, onLogAttendanceClick, isLoggable, isLogActionDisabled, logTooltip, onConflictClick }) => {
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
          },
        });
      } else if (timeToEnd > 0) {
        setCountdown({
          status: 'in_progress',
          time: {
            days: Math.floor(timeToEnd / (1000 * 60 * 60 * 24)),
            hours: Math.floor((timeToEnd / (1000 * 60 * 60)) % 24),
            minutes: Math.floor((timeToEnd / 1000 / 60) % 60),
            seconds: Math.floor((timeToEnd / 1000) % 60),
          },
        });
      } else {
        setCountdown({ status: 'finished' });
      }
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);

    return () => clearInterval(interval);
  }, [isMakeup, makeupDate, slotStartTime, slotEndTime]);

  if (isInactiveSlot) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-gray-400 bg-gray-200 rounded-md shadow p-1.5 italic opacity-60">
        N/A
      </div>
    );
  }
  
  if (!classInfo) { // Handles both undefined (no data) and null (explicitly free)
    return (
      <div className={`h-full flex items-center justify-center text-xs text-gray-400 bg-gray-50 rounded-md shadow p-1.5 italic transition-opacity ${isDimmed ? 'opacity-40' : ''}`}>
        Free
      </div>
    );
  }
  
  const program = classInfo.pId ? allPrograms.find(p => p.pId === classInfo.pId) : null;
  const programShortName = program?.shortName || 'N/A';
  const status = isMakeup ? `Make-up on ${makeupDate}` : 'Regularly scheduled class';

  const tooltipParts = [
    `Course: ${classInfo.courseName}`,
    `Section: ${classInfo.section}`,
    `Teacher: ${classInfo.teacher}`,
    `Program: ${programShortName}`,
    `Level-Term: ${classInfo.levelTerm || 'N/A'}`,
    `Students: ${studentCount ?? 'N/A'}`,
    `Classes Taken: ${classInfo.classTaken ?? 'N/A'}`,
    `Status: ${status}`,
  ];
  if (isDimmed) {
    tooltipParts.push(`\n(Does not match current filter)`);
  }
  if (conflictDetails?.messages.length) {
    tooltipParts.push(`\n${conflictDetails.messages.join('\n')}`);
  }
  const tooltipString = tooltipParts.join('\n');
  const hasConflict = !!conflictDetails && (conflictDetails.teacherConflict || conflictDetails.sectionConflict);

  const courseCodeClasses = `font-semibold text-gray-800 text-xs md:text-sm leading-tight`;
  
  const sectionClasses = `text-gray-600 text-[10px] md:text-xs -mt-0.5 ${
    conflictDetails?.sectionConflict ? 'text-red-600 font-bold' : ''
  }`;
  
  const teacherNameClasses = `text-gray-500 text-[9px] md:text-[10px] mt-0.5 truncate w-full ${
    conflictDetails?.teacherConflict ? 'text-red-600 font-bold' : ''
  }`;

  return (
    <div 
        className={`relative group h-full rounded-md shadow-lg flex overflow-hidden hover:shadow-xl transition-all duration-150 ease-in-out ${classInfo.color || 'bg-white'} ${isDraggable ? 'cursor-grab' : ''} ${hasConflict ? 'schedule-conflict' : ''} ${isDimmed ? 'opacity-40 hover:opacity-100' : ''} ${isHighlighted ? 'cell-highlight' : ''}`}
        title={tooltipString}
        draggable={isDraggable}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
    >
      {hasConflict && (
          <button
              onClick={(e) => { e.stopPropagation(); onConflictClick?.(); }}
              title={`Conflict detected:\n${conflictDetails!.messages.join('\n')}`}
              className="absolute top-0.5 left-0.5 z-10 p-0.5 bg-red-100/80 backdrop-blur-sm rounded-full text-red-700 hover:bg-red-200 hover:text-red-900 focus:outline-none focus:ring-1 focus:ring-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
          >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.21 3.031-1.742 3.031H4.42c-1.532 0-2.492-1.697-1.742-3.031l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-8a1 1 0 00-1 1v3a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
          </button>
      )}
      {isLoggable && (
        <button
          onClick={(e) => { e.stopPropagation(); onLogAttendanceClick?.(); }}
          disabled={isLogActionDisabled}
          title={logTooltip}
          className="absolute top-0.5 right-0.5 z-10 p-0.5 bg-white/60 backdrop-blur-sm rounded-full text-teal-700 hover:bg-teal-100 hover:text-teal-900 focus:outline-none focus:ring-1 focus:ring-teal-500 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white/60 disabled:text-gray-400"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
        </button>
      )}
      <div className={`w-1.5 flex-shrink-0 ${getAccentColor(classInfo.color)}`}></div>
      <div className="flex-grow flex flex-col text-center justify-center items-center overflow-hidden p-1 bg-white">
          <p className={courseCodeClasses} title={classInfo.courseCode}>
              {classInfo.courseCode}
          </p>
           <p className={sectionClasses} title={`Level-Term: ${classInfo.levelTerm || 'N/A'}, Section: ${classInfo.section}`}>
              {classInfo.levelTerm ? `${classInfo.levelTerm.replace('T', '-T')} (${classInfo.section})` : `(${classInfo.section})`}
          </p>
          
          {isMakeup ? (
            <>
              <p className={teacherNameClasses} title={classInfo.teacher}>
                  {classInfo.teacher}
              </p>
              {countdown && (
                <div className="text-gray-600 text-[8px] sm:text-[9px] md:text-[10px] lg:text-xs mt-1 truncate w-full font-mono font-medium">
                  {countdown.status === 'finished' ? (
                      <span className="px-1.5 py-0.5 rounded-full font-bold bg-red-100 text-red-700">Finished</span>
                  ) : countdown.status === 'upcoming' && countdown.time ? (
                      <span className="text-blue-600">
                          {countdown.time.days > 0 && `${countdown.time.days}d `}
                          {`${String(countdown.time.hours).padStart(2, '0')}:${String(countdown.time.minutes).padStart(2, '0')}`}
                      </span>
                  ) : countdown.status === 'in_progress' && countdown.time ? (
                      <span className="text-green-700 animate-pulse">
                          {`Ends: ${String(countdown.time.hours).padStart(2, '0')}:${String(countdown.time.minutes).padStart(2, '0')}`}
                      </span>
                  ) : null}
                </div>
              )}
            </>
          ) : (
            <>
              <p className={teacherNameClasses} title={classInfo.teacher}>
                  {classInfo.teacher}
              </p>
            </>
          )}
      </div>
    </div>
  );
});

ClassCell.displayName = 'ClassCell';

interface RoutineGridProps {
  user: User | null;
  routineData: FullRoutineData; 
  selectedDayForRoomCentricView: DayOfWeek;
  roomEntries: RoomEntry[]; 
  headerSlotObjects: DefaultTimeSlot[]; 
  systemDefaultSlots: DefaultTimeSlot[]; 
  onRoomHeaderClick: (room: RoomEntry) => void;
  onDayTimeCellClick: (day: DayOfWeek, slotObject: DefaultTimeSlot) => void; 
  onSlotCellClick: (room: RoomEntry, slotObject: DefaultTimeSlot, day: DayOfWeek) => void;
  routineViewMode: RoutineViewMode;
  getBuildingName: (buildingId: string) => string;
  scheduleOverrides: ScheduleOverrides;
  pendingChanges: PendingChange[];
  allSemesterConfigurations: SemesterCloneInfo[];
  allPrograms: ProgramEntry[];
  selectedDate: string | null;
  coursesData: EnrollmentEntry[];
  selectedSemesterIdForRoutineView: string | null;
  activeProgramIdInSidebar: string | null;
  activeDays: DayOfWeek[];
  onMoveRoutineEntry: (
    source: { day: DayOfWeek; roomNumber: string; slotString: string },
    target: { day: DayOfWeek; roomNumber: string; slotString: string },
    classInfo: ClassDetail,
    semesterId: string
  ) => void;
  onAssignSectionToSlot: (
    sectionId: string,
    target: { day: DayOfWeek; roomNumber: string; slotString: string },
    semesterId: string
  ) => void;
  selectedLevelTermFilter: string | null;
  selectedSectionFilter: string | null;
  selectedTeacherIdFilter: string | null;
  selectedCourseSectionIdsFilter: string[];
  onLogAttendance: (logData: Omit<AttendanceLogEntry, 'id' | 'timestamp' | 'status' | 'makeupInfo'>) => void;
  onOpenConflictModal: (conflictInfo: ConflictInfoForModal) => void;
  isEditable: boolean;
}

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


const RoutineGrid: React.FC<RoutineGridProps> = React.memo((props) => {
  const { 
    user,
    routineData, 
    selectedDayForRoomCentricView,
    roomEntries, 
    headerSlotObjects, 
    systemDefaultSlots,
    onRoomHeaderClick,
    onDayTimeCellClick,
    onSlotCellClick,
    routineViewMode,
    getBuildingName,
    scheduleOverrides,
    allSemesterConfigurations,
    allPrograms,
    selectedDate,
    coursesData,
    selectedSemesterIdForRoutineView,
    activeProgramIdInSidebar,
    activeDays,
    onMoveRoutineEntry,
    onAssignSectionToSlot,
    selectedLevelTermFilter,
    selectedSectionFilter,
    selectedTeacherIdFilter,
    selectedCourseSectionIdsFilter,
    onLogAttendance,
    onOpenConflictModal,
    pendingChanges,
    isEditable,
  } = props;

  const [hoveredRowKey, setHoveredRowKey] = useState<string | null>(null); 
  const [hoveredColumnKey, setHoveredColumnKey] = useState<string | null>(null); // For column header
  const [hoveredCellKey, setHoveredCellKey] = useState<string | null>(null); // For individual cell effects (e.g., ring)
  const [dragOverCellKey, setDragOverCellKey] = useState<string | null>(null);
  
  const cellHeight = "h-14 min-h-14 max-h-14"; 
  const cellWidth = "w-20 min-w-20 max-w-20"; 
  const rowHeaderColumnWidth = "w-16 sm:w-20 min-w-16 sm:min-w-20 max-w-16 sm:max-w-20";
  
  const { cellConflictInfo, slotLevelConflicts } = useMemo(() => {
    const conflictInfo = new Map<string, ConflictDetails>(); // key: day-roomNumber-slotString
    const slotLevelConflicts = new Map<string, ConflictInfoForModal>(); // key: day-slotString-type-identifier

    if (!selectedSemesterIdForRoutineView || !routineData) {
        return { cellConflictInfo: conflictInfo, slotLevelConflicts };
    }

    const getOrCreateConflict = (key: string): ConflictDetails => {
        if (!conflictInfo.has(key)) {
            conflictInfo.set(key, { teacherConflict: false, sectionConflict: false, messages: [] });
        }
        return conflictInfo.get(key)!;
    };

    for (const day of Object.keys(routineData) as DayOfWeek[]) {
        const dayData = routineData[day];
        if (!dayData) continue;
        const assignmentsBySlot = new Map<string, { roomNumber: string; classInfo: ClassDetail }[]>();
        for (const roomNumber in dayData) {
            const roomSlots = dayData[roomNumber];
            for (const slotString in roomSlots) {
                const classInfo = roomSlots[slotString as TimeSlot];
                if (classInfo) {
                    if (!assignmentsBySlot.has(slotString)) assignmentsBySlot.set(slotString, []);
                    assignmentsBySlot.get(slotString)!.push({ roomNumber, classInfo });
                }
            }
        }
        for (const [slotString, assignments] of assignmentsBySlot.entries()) {
            const courseGroupsInSlot = new Map<string, { roomNumber: string; classInfo: ClassDetail }[]>();
            assignments.forEach(assignment => {
                const { pId, levelTerm, section } = assignment.classInfo;
                if (pId && levelTerm && section) {
                    const groupKey = `${pId}-${levelTerm}-${section}`;
                    if (!courseGroupsInSlot.has(groupKey)) courseGroupsInSlot.set(groupKey, []);
                    courseGroupsInSlot.get(groupKey)!.push(assignment);
                }
            });
            for (const [groupKey, conflictingAssignments] of courseGroupsInSlot.entries()) {
                if (conflictingAssignments.length > 1) {
                    const [pId, levelTerm, section] = groupKey.split('-');
                    const conflictMessage = `Conflict: Section ${section} is in multiple rooms.`;
                    const modalInfo: ConflictInfoForModal = {
                        day, slotString,
                        assignments: conflictingAssignments.map(a => ({ room: roomEntries.find(r => r.roomNumber === a.roomNumber)!, classInfo: a.classInfo })),
                        conflictType: 'section', identifier: groupKey,
                    };
                    slotLevelConflicts.set(`${day}-${slotString}-${groupKey}`, modalInfo);
                    conflictingAssignments.forEach(assignment => {
                        const cellKey = `${day}-${assignment.roomNumber}-${slotString}`;
                        const conflict = getOrCreateConflict(cellKey);
                        conflict.sectionConflict = true;
                        if(!conflict.messages.includes(conflictMessage)) conflict.messages.push(conflictMessage);
                    });
                }
            }
            const teacherGroupsInSlot = new Map<string, { roomNumber: string; classInfo: ClassDetail }[]>();
            assignments.forEach(assignment => {
                const enrollment = coursesData.find(c => 
                    c.pId === assignment.classInfo.pId && c.courseCode === assignment.classInfo.courseCode &&
                    c.section === assignment.classInfo.section && c.semester === selectedSemesterIdForRoutineView);
                if (enrollment && enrollment.teacherId) {
                    const teacherId = enrollment.teacherId;
                    if (!teacherGroupsInSlot.has(teacherId)) teacherGroupsInSlot.set(teacherId, []);
                    teacherGroupsInSlot.get(teacherId)!.push(assignment);
                }
            });
            for (const [teacherId, conflictingAssignments] of teacherGroupsInSlot.entries()) {
                if (conflictingAssignments.length > 1) {
                    const teacherName = conflictingAssignments[0].classInfo.teacher;
                    const conflictMessage = `Conflict: Teacher ${teacherName} is in multiple rooms.`;
                    const modalInfo: ConflictInfoForModal = {
                        day, slotString,
                        assignments: conflictingAssignments.map(a => ({ room: roomEntries.find(r => r.roomNumber === a.roomNumber)!, classInfo: a.classInfo })),
                        conflictType: 'teacher', identifier: teacherName,
                    };
                    slotLevelConflicts.set(`${day}-${slotString}-${teacherName}`, modalInfo);
                    conflictingAssignments.forEach(assignment => {
                        const cellKey = `${day}-${assignment.roomNumber}-${slotString}`;
                        const conflict = getOrCreateConflict(cellKey);
                        conflict.teacherConflict = true;
                        if(!conflict.messages.includes(conflictMessage)) conflict.messages.push(conflictMessage);
                    });
                }
            }
        }
    }
    return { cellConflictInfo: conflictInfo, slotLevelConflicts };
  }, [routineData, selectedSemesterIdForRoutineView, coursesData, roomEntries]);


  const getAllDatesForDay = useCallback((
    day: DayOfWeek,
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
    const targetJsDay = jsDayMap[day];
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

  const renderRoomCentricView = () => {
    
    const handleDrop = (e: React.DragEvent<HTMLTableCellElement>, targetRoom: RoomEntry, targetSlot: DefaultTimeSlot, isInactive: boolean) => {
        e.preventDefault();
        setDragOverCellKey(null);

        if (!isEditable || isInactive) {
            return; // Can't drop on inactive slots or in read-only mode.
        }

        try {
            const data = JSON.parse(e.dataTransfer.getData('application/json'));
            const targetSlotString = formatSlotObjectToString(targetSlot);
            if (!selectedSemesterIdForRoutineView) return;

            if (data.type === 'courseSectionDrop') {
                onAssignSectionToSlot(
                    data.sectionId,
                    { day: selectedDayForRoomCentricView, roomNumber: targetRoom.roomNumber, slotString: targetSlotString },
                    selectedSemesterIdForRoutineView
                );
            } else if (data.type === 'gridMove') {
                const { sourceRoom, sourceSlot, classInfo } = data;
                if (!classInfo || !sourceRoom || !sourceSlot) {
                    console.warn("Drag data for grid move is incomplete.");
                    return;
                }
                if (sourceRoom === targetRoom.roomNumber && sourceSlot === targetSlotString) {
                    return; // Dropped on itself
                }
                onMoveRoutineEntry(
                    { day: selectedDayForRoomCentricView, roomNumber: sourceRoom, slotString: sourceSlot },
                    { day: selectedDayForRoomCentricView, roomNumber: targetRoom.roomNumber, slotString: targetSlotString },
                    classInfo,
                    selectedSemesterIdForRoutineView
                );
            }
        } catch (err) {
            console.error("Error processing drop data:", err);
        }
    };
    
    return (
    <tbody className="bg-transparent">
      {roomEntries.map((room) => {
        const buildingName = getBuildingName(room.buildingId);
        // Performance Optimization: Calculate dates for the entire row once.
        const allDatesForDay = getAllDatesForDay(selectedDayForRoomCentricView, room);
        return (
        <tr key={room.id} className="group"> 
          <td 
            className={`sticky left-0 z-10 ${cellHeight} ${rowHeaderColumnWidth} p-0 align-middle`}
          >
            <div 
              className={`h-full flex flex-col items-center justify-center
              ${hoveredRowKey === room.id ? 'bg-[var(--color-primary-600)]' : 'bg-[var(--color-primary-700)]'} 
              text-white shadow-md rounded-md  
              p-1 text-center cursor-pointer 
              hover:bg-[var(--color-primary-600)] transition-colors duration-150
              focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-yellow-400)] focus:ring-offset-2 focus:ring-offset-[var(--color-primary-700)]`}
              onClick={() => onRoomHeaderClick(room)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onRoomHeaderClick(room); }}
              role="button"
              tabIndex={0}
              aria-label={`View details for room ${room.roomNumber} in ${buildingName}`}
              onMouseEnter={() => setHoveredRowKey(room.id)} // For row header highlight only
              onMouseLeave={() => setHoveredRowKey(null)}   // For row header highlight only
            >
               <span className="font-semibold text-[10px] sm:text-xs md:text-sm">{room.roomNumber}</span>
               <p className="text-[9px] md:text-[10px] lg:text-xs text-[var(--color-primary-200)] mt-0.5 truncate w-full" title={buildingName}>
                 {buildingName}
               </p>
            </div>
          </td>
          {headerSlotObjects.map((headerSlotObj) => {
            const programSlotString = formatSlotObjectToString(headerSlotObj);
            const currentCellKey = `${room.id}-${headerSlotObj.id}`; 
            
            const authoritativeSlotsForRoom = room.roomSpecificSlots || [];
            const roomCanHandleThisSlot = authoritativeSlotsForRoom.some(
                authoritativeSlot => 
                    formatSlotObjectToString(authoritativeSlot) === programSlotString && 
                    authoritativeSlot.type === headerSlotObj.type
            );
            
            const isInactiveSlot = !roomCanHandleThisSlot;

            const pendingChangeForThisCell = pendingChanges.find(p =>
                p.semesterId === selectedSemesterIdForRoutineView &&
                p.roomNumber === room.roomNumber &&
                p.slotString === programSlotString &&
                (p.isBulkUpdate ? p.day === selectedDayForRoomCentricView : (selectedDate ? p.dates?.includes(selectedDate) : false))
            );
            
            let finalClassInfo: ClassDetail | undefined | null = undefined;
            let isMakeupClass = false;
            let classDate: string | undefined = undefined;

            if (!isInactiveSlot) {
                if (selectedDate) {
                    const dayOfWeekOfSelectedDate = getDayOfWeekFromISO(selectedDate);
                    if (dayOfWeekOfSelectedDate === selectedDayForRoomCentricView) {
                        const overrideInfo = scheduleOverrides[room.roomNumber]?.[programSlotString]?.[selectedDate];
                        const defaultClass = routineData[selectedDayForRoomCentricView]?.[room.roomNumber]?.[programSlotString];
                        if (overrideInfo !== undefined) {
                            finalClassInfo = overrideInfo;
                            isMakeupClass = true; 
                            classDate = selectedDate;
                        } else {
                            finalClassInfo = defaultClass;
                            isMakeupClass = false; 
                        }
                    }
                } else {
                    finalClassInfo = routineData[selectedDayForRoomCentricView]?.[room.roomNumber]?.[programSlotString];
                    isMakeupClass = false;
                    classDate = undefined;

                    for (const date of allDatesForDay) {
                        const overrideInfo = scheduleOverrides[room.roomNumber]?.[programSlotString]?.[date];
                        if (overrideInfo) {
                            const endDateTime = new Date(`${date}T${headerSlotObj.endTime}:00`);
                            if (new Date() <= endDateTime) {
                                finalClassInfo = overrideInfo;
                                isMakeupClass = true;
                                classDate = date;
                                break; 
                            }
                        }
                    }
                }
            }
            
            const originalCourse = finalClassInfo ? coursesData.find(c =>
                c.semester === selectedSemesterIdForRoutineView &&
                c.pId === finalClassInfo!.pId &&
                c.courseCode === finalClassInfo!.courseCode &&
                c.section === finalClassInfo!.section
            ) : undefined;

            const isFilterActive = !!selectedLevelTermFilter || !!selectedSectionFilter || !!selectedTeacherIdFilter || selectedCourseSectionIdsFilter.length > 0;
            let isHighlighted = false;
            let isDimmed = false;

            if (isFilterActive) {
                if (finalClassInfo) {
                    if (originalCourse) {
                        const levelTermMatch = !selectedLevelTermFilter || originalCourse.levelTerm === selectedLevelTermFilter;
                        const sectionMatch = !selectedSectionFilter || originalCourse.section === selectedSectionFilter;
                        const teacherMatch = !selectedTeacherIdFilter || originalCourse.teacherId === selectedTeacherIdFilter;
                        const courseSectionMatch = selectedCourseSectionIdsFilter.length === 0 || selectedCourseSectionIdsFilter.includes(originalCourse.sectionId);
                        
                        if (levelTermMatch && sectionMatch && teacherMatch && courseSectionMatch) {
                            isHighlighted = true;
                        } else {
                            isDimmed = true;
                        }
                    } else {
                        isDimmed = true; 
                    }
                } else {
                    isDimmed = true; 
                }
            }
            
            const isDraggable = isEditable && !!finalClassInfo && !isMakeupClass && (user?.dashboardAccess?.canDragAndDrop === true);
            const isDropTarget = isEditable && !isInactiveSlot && !pendingChangeForThisCell;
            const isCellClickable = !isInactiveSlot;
            
            const cellKeyForConflictCheck = `${selectedDayForRoomCentricView}-${room.roomNumber}-${programSlotString}`;
            const conflictDetails = cellConflictInfo.get(cellKeyForConflictCheck);

            const handleConflictClick = () => {
                const day = selectedDayForRoomCentricView;
                const slotString = programSlotString;
                
                for (const [key, value] of slotLevelConflicts.entries()) {
                    if (key.startsWith(`${day}-${slotString}`)) {
                        const isRoomInConflict = value.assignments.some(a => a.room.roomNumber === room.roomNumber);
                        if (isRoomInConflict) {
                            onOpenConflictModal(value);
                            return; 
                        }
                    }
                }
            };


            const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
              if (!finalClassInfo) return;
              const payload = { type: 'gridMove', sourceRoom: room.roomNumber, sourceSlot: programSlotString, classInfo: finalClassInfo };
              e.dataTransfer.setData('application/json', JSON.stringify(payload));
              e.dataTransfer.effectAllowed = 'move';
              setTimeout(() => { (e.target as HTMLDivElement).classList.add('dragging'); }, 0);
            };
        
            const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
              (e.target as HTMLDivElement).classList.remove('dragging');
            };

            let hasLogPermission = false;
            const logPermissionLevel = user?.dashboardAccess?.classMonitoringAccess;
            if (user?.role === 'admin' || logPermissionLevel === 'full') {
                hasLogPermission = true;
            } else if (logPermissionLevel === 'own') {
                if (originalCourse && user?.employeeId === originalCourse.teacherId) {
                    hasLogPermission = true;
                }
            }
            
            const isLoggable = !!finalClassInfo && hasLogPermission;
            const isLogActionDisabled = !selectedDate;

            let logTooltip = "";
            if (!hasLogPermission) {
                logTooltip = "You do not have permission to log attendance.";
            } else if (!selectedDate) {
                logTooltip = `Select a specific date from the header to log attendance.`;
            } else if (finalClassInfo) {
                logTooltip = `Log attendance for ${finalClassInfo.courseCode} on ${selectedDate}`;
            }

            const handleLogAttendanceClick = () => {
                if (isLogActionDisabled || !finalClassInfo || !selectedDate) return;
                
                const enrollmentEntry = coursesData.find(c => 
                    c.semester === selectedSemesterIdForRoutineView &&
                    c.pId === finalClassInfo.pId &&
                    c.courseCode === finalClassInfo.courseCode &&
                    c.section === finalClassInfo.section
                );
                
                const logDataTemplate = {
                    date: selectedDate,
                    timeSlot: programSlotString,
                    roomNumber: room.roomNumber,
                    buildingName: getBuildingName(room.buildingId),
                    courseCode: finalClassInfo.courseCode,
                    courseTitle: finalClassInfo.courseName,
                    section: finalClassInfo.section,
                    teacherName: finalClassInfo.teacher,
                    teacherId: enrollmentEntry?.teacherId || 'N/A',
                    teacherDesignation: enrollmentEntry?.designation || 'N/A',
                    pId: finalClassInfo.pId || 'N/A',
                };
                onLogAttendance(logDataTemplate);
            };
            
            return (
              <td 
                key={currentCellKey} 
                className={`${cellHeight} ${cellWidth} p-0 align-top bg-transparent transition-all duration-100 ease-in-out
                            ${hoveredCellKey === currentCellKey ? 'ring-2 ring-[var(--color-primary-500)] ring-offset-1 ring-offset-[var(--color-bg-muted)] rounded-md' : ''}
                            ${isCellClickable ? 'cursor-pointer' : 'cursor-default'}
                            ${dragOverCellKey === currentCellKey ? 'drop-target-active' : ''}`}
                onClick={() => isCellClickable && onSlotCellClick(room, headerSlotObj, selectedDayForRoomCentricView)}
                onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && isCellClickable) onSlotCellClick(room, headerSlotObj, selectedDayForRoomCentricView); }}
                role={isCellClickable ? 'button' : undefined}
                tabIndex={isCellClickable ? 0 : -1}
                aria-label={isCellClickable ? `View details for slot ${programSlotString} in room ${room.roomNumber}` : `Slot inactive for this room`}
                onMouseEnter={() => {
                  setHoveredRowKey(room.id);
                  setHoveredColumnKey(headerSlotObj.id);
                  setHoveredCellKey(currentCellKey);
                }}
                onMouseLeave={() => {
                  setHoveredRowKey(null);
                  setHoveredColumnKey(null);
                  setHoveredCellKey(null);
                }}
                onDragOver={(e) => { if (isEditable && isDropTarget) e.preventDefault(); }}
                onDragEnter={(e) => { if (isEditable && isDropTarget) { e.preventDefault(); setDragOverCellKey(currentCellKey); } }}
                onDragLeave={() => setDragOverCellKey(null)}
                onDrop={(e) => handleDrop(e, room, headerSlotObj, isInactiveSlot)}
              >
                {pendingChangeForThisCell ? (
                    <PendingCell change={pendingChangeForThisCell} />
                ) : (
                    <ClassCell 
                        classInfo={finalClassInfo} 
                        isInactiveSlot={isInactiveSlot} 
                        allPrograms={allPrograms} 
                        isMakeup={isMakeupClass} 
                        makeupDate={classDate}
                        slotStartTime={headerSlotObj.startTime}
                        slotEndTime={headerSlotObj.endTime}
                        isDraggable={isDraggable}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        conflictDetails={conflictDetails}
                        isHighlighted={isHighlighted}
                        isDimmed={isDimmed}
                        studentCount={originalCourse?.studentCount}
                        isLoggable={isLoggable}
                        isLogActionDisabled={isLogActionDisabled}
                        logTooltip={logTooltip}
                        onLogAttendanceClick={handleLogAttendanceClick}
                        onConflictClick={handleConflictClick}
                    />
                )}
              </td>
            );
          })}
        </tr>
      )})}
      {headerSlotObjects.length > 0 && roomEntries.length === 0 && (
        <tr>
          <td colSpan={headerSlotObjects.length + 1} className="text-center py-8 text-gray-500 text-sm">
            <div className="p-4 bg-white rounded-md shadow-md">
              No rooms available for the selected program or filter.
            </div>
          </td>
        </tr>
      )}
       {headerSlotObjects.length === 0 && ( 
        <tr>
          <td colSpan={1} className="text-center py-8 text-gray-500 text-sm"> 
             <div className="p-4 bg-white rounded-md shadow-md">
              No time slots to display. Check program or system default slot configurations.
            </div>
          </td>
        </tr>
      )}
    </tbody>
  );
  }

  const renderDayCentricView = () => {
    const columnTotals = Array(headerSlotObjects.length).fill(0).map(() => ({ booked: 0, total: 0 }));

    const bodyRows = activeDays.map((day) => {
        const daySummary = { booked: 0, total: 0 };
        const dayCells = headerSlotObjects.map((headerSlotObj, slotIndex) => {
            const slotString = formatSlotObjectToString(headerSlotObj);
            let totalActiveRooms = 0;
            let bookedRooms = 0;
            roomEntries.forEach(room => {
                const roomSlots = room.roomSpecificSlots || [];
                const isActiveForThisSlot = roomSlots.some(s => s.type === headerSlotObj.type && s.startTime === headerSlotObj.startTime && s.endTime === headerSlotObj.endTime);

                if (isActiveForThisSlot) {
                    totalActiveRooms++;
                    let classForThisSlot: ClassDetail | null | undefined;
                    if (selectedDate) {
                        const dayOfSelectedDate = getDayOfWeekFromISO(selectedDate);
                        if (day === dayOfSelectedDate) {
                            classForThisSlot = scheduleOverrides[room.roomNumber]?.[slotString]?.[selectedDate] ?? routineData[day]?.[room.roomNumber]?.[slotString];
                        }
                    } else {
                        classForThisSlot = routineData[day]?.[room.roomNumber]?.[slotString];
                    }
                    if (classForThisSlot) bookedRooms++;
                }
            });

            daySummary.total += totalActiveRooms;
            daySummary.booked += bookedRooms;
            columnTotals[slotIndex].total += totalActiveRooms;
            columnTotals[slotIndex].booked += bookedRooms;

            const occupancy = totalActiveRooms > 0 ? bookedRooms / totalActiveRooms : 0;
            let bgColor = 'bg-gray-100', textColor = 'text-gray-500', progressBgColor = 'bg-gray-300', borderColor = 'border-gray-200', hoverBgColor = 'hover:bg-gray-200';
            if (totalActiveRooms > 0) {
                if (occupancy === 0) { [bgColor, textColor, progressBgColor, borderColor, hoverBgColor] = ['bg-green-50', 'text-green-700', 'bg-green-500', 'border-green-200', 'hover:bg-green-100']; }
                else if (occupancy < 1) { [bgColor, textColor, progressBgColor, borderColor, hoverBgColor] = ['bg-amber-50', 'text-amber-700', 'bg-amber-500', 'border-amber-200', 'hover:bg-amber-100']; }
                else { [bgColor, textColor, progressBgColor, borderColor, hoverBgColor] = ['bg-red-50', 'text-red-700', 'bg-red-500', 'border-red-200', 'hover:bg-red-100']; }
            }
            const isCellClickable = totalActiveRooms > 0;
            const currentCellKey = `${day}-${headerSlotObj.id}`;
            const ariaLabel = `View schedule for ${day}, ${slotString}. ${bookedRooms} of ${totalActiveRooms} rooms booked.`;

            return (
                <td key={currentCellKey} className={`${cellHeight} ${cellWidth} p-0.5 align-top bg-transparent transition-all duration-100 ease-in-out ${hoveredCellKey === currentCellKey ? 'ring-2 ring-[var(--color-primary-500)] ring-offset-1 ring-offset-[var(--color-bg-muted)] rounded-lg' : ''}`} onMouseEnter={() => { setHoveredRowKey(day); setHoveredColumnKey(headerSlotObj.id); setHoveredCellKey(currentCellKey); }} onMouseLeave={() => { setHoveredRowKey(null); setHoveredColumnKey(null); setHoveredCellKey(null); }}>
                    <div onClick={() => isCellClickable && onDayTimeCellClick(day, headerSlotObj)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { if (isCellClickable) onDayTimeCellClick(day, headerSlotObj); }}} role="button" tabIndex={isCellClickable ? 0 : -1} aria-label={ariaLabel} className={`h-full w-full rounded-md shadow-sm transition-all duration-150 p-1.5 flex flex-col justify-between border ${borderColor} ${bgColor} ${isCellClickable ? `cursor-pointer ${hoverBgColor}` : 'cursor-not-allowed'}`}>
                        <div className="flex justify-between items-baseline"><span className={`font-bold text-lg ${textColor}`}>{bookedRooms}</span><span className={`text-xs font-medium ${textColor}`}>/{totalActiveRooms}</span></div>
                        <div><div className="text-right text-[10px] font-semibold text-gray-500 mb-1">{totalActiveRooms > 0 ? `${(occupancy * 100).toFixed(0)}% Full` : 'N/A'}</div><div className="w-full bg-gray-200 rounded-full h-1"><div className={`${progressBgColor} h-1 rounded-full`} style={{ width: `${occupancy * 100}%` }}></div></div></div>
                    </div>
                </td>
            );
        });

        const daySummaryCell = (
            <td className={`${cellHeight} ${cellWidth} p-0.5 align-top`}>
                <SummaryCell booked={daySummary.booked} total={daySummary.total} />
            </td>
        );

        return (
            <tr key={day} className="group">
                <td className={`sticky left-0 z-10 ${cellHeight} ${rowHeaderColumnWidth} p-0 align-middle`}>
                    <div className={`h-full ${hoveredRowKey === day ? 'bg-[var(--color-primary-600)]' : 'bg-[var(--color-primary-700)]'} text-white shadow-md rounded-md flex items-center justify-center text-xs sm:text-sm font-medium p-1 text-center transition-colors duration-150`} onMouseEnter={() => setHoveredRowKey(day)} onMouseLeave={() => setHoveredRowKey(null)}>{day}</div>
                </td>
                {dayCells}
                {daySummaryCell}
            </tr>
        );
    });

    const grandTotal = columnTotals.reduce((acc, curr) => ({ booked: acc.booked + curr.booked, total: acc.total + curr.total }), { booked: 0, total: 0 });

    const footerRow = (
        <tr>
            <th className={`sticky left-0 z-10 ${cellHeight} ${rowHeaderColumnWidth} p-0 align-middle`}>
                <div className="h-full bg-slate-700 text-white shadow-md rounded-md flex items-center justify-center text-xs font-semibold p-1">Weekly Summary</div>
            </th>
            {columnTotals.map((colTotal, index) => (
                <td key={`col-total-${index}`} className={`${cellHeight} ${cellWidth} p-0.5 align-top`}>
                    <SummaryCell booked={colTotal.booked} total={colTotal.total} />
                </td>
            ))}
            <td className={`${cellHeight} ${cellWidth} p-0.5 align-top`}>
                <SummaryCell booked={grandTotal.booked} total={grandTotal.total} isGrandTotal={true} />
            </td>
        </tr>
    );

    return (
        <>
            <tbody className="bg-transparent">{bodyRows}</tbody>
            <tfoot className="sticky bottom-0 bg-gray-200/80 backdrop-blur-sm z-20">
                {footerRow}
            </tfoot>
        </>
    );
  };

  const firstColumnHeaderText = routineViewMode === 'roomCentric' ? "Room/Time" : "Day/Time";
  
  const commonThead = (
      <thead className="sticky top-0 z-30 bg-[var(--color-bg-muted)]">
        <tr>
          <th
            className={`sticky top-0 left-0 z-30 ${rowHeaderColumnWidth} 
            ${hoveredRowKey || hoveredColumnKey ? 'bg-[var(--color-primary-600)]' : 'bg-[var(--color-primary-700)]'} 
            text-white shadow-md rounded-md p-1 sm:p-1.5 text-center font-semibold transition-colors duration-150`}
            title={routineViewMode === 'roomCentric' ? "Room-Centric View" : "Day-Centric View"}
            aria-label={routineViewMode === 'roomCentric' ? "Currently in Room-Centric View" : "Currently in Day-Centric View"}
            >
            <div className="flex flex-row items-center justify-center h-full gap-2">
              <span aria-hidden="true" className="text-[var(--color-primary-200)]">
                {routineViewMode === 'roomCentric' ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                     <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                )}
              </span>
              <span className="text-[9px] sm:text-[10px] md:text-[11px] lg:text-xs font-semibold">
                {firstColumnHeaderText}
              </span>
            </div>
          </th>
          {headerSlotObjects.map((slotObj) => {
            const slotKey = slotObj.id; 
            const startTimeAMPM = formatTimeToAMPM(slotObj.startTime);
            const endTimeAMPM = formatTimeToAMPM(slotObj.endTime);
            return (
              <th
                key={slotKey}
                className={`${cellWidth} 
                ${hoveredColumnKey === slotKey ? 'bg-[var(--color-primary-600)]' : 'bg-[var(--color-primary-700)]'} 
                text-white shadow-md rounded-md px-1 py-1.5 sm:px-1.5 sm:py-2 text-center 
                text-[9px] sm:text-[10px] md:text-[11px] lg:text-xs font-semibold transition-colors duration-150`}
                style={{ whiteSpace: 'normal', wordBreak: 'break-word', hyphens: 'auto' }} 
              >
                {/* For large screens: "08:30 AM - 10:00 AM" */}
                <span className="hidden lg:inline">{startTimeAMPM} - {endTimeAMPM}</span>
                
                {/* For small screens: "08:30 AM" on top of "10:00 AM" */}
                <div className="lg:hidden flex flex-col leading-tight">
                    <span>{startTimeAMPM}</span>
                    <hr className="border-t border-teal-500 w-1/2 mx-auto my-0.5" />
                    <span>{endTimeAMPM}</span>
                </div>
              </th>
            );
          })}
           {routineViewMode === 'dayCentric' && (
              <th
                className={`${cellWidth} bg-slate-700 text-white shadow-md rounded-md px-1 py-1.5 sm:px-1.5 sm:py-2 text-center text-xs font-semibold`}
              >
                Daily Summary
              </th>
          )}
        </tr>
      </thead>
  );

  return routineViewMode === 'dayCentric' ? (
    <div className="h-full flex flex-col">
        <div className="flex-grow min-h-0 overflow-auto custom-scrollbar">
            <table className="min-w-full table-fixed border-separate" style={{ borderSpacing: '3px' }}>
                {commonThead}
                {renderDayCentricView()}
            </table>
        </div>
    </div>
  ) : (
     <table className="min-w-full table-fixed border-separate" style={{ borderSpacing: '3px' }}>
      {commonThead}
      {renderRoomCentricView()}
    </table>
  );
});

RoutineGrid.displayName = 'RoutineGrid';
export default RoutineGrid;