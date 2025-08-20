import React, { useMemo, useState, useEffect, useRef } from 'react';
import { RoomEntry, DefaultTimeSlot, DayOfWeek, FullRoutineData, ClassDetail, SemesterCloneInfo, ProgramEntry, EnrollmentEntry, ScheduleOverrides, AssignAccessLevel, PendingChange, ScheduleLogEntry } from '../../types';
import { formatDefaultSlotToString } from '../../App';
import { useAuth } from '../../contexts/AuthContext';
import { getLevelTermColor } from '../../data/colorConstants';

interface SlotDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  slotData: {
    room: RoomEntry;
    slot: DefaultTimeSlot;
    day: DayOfWeek;
  };
  getBuildingName: (buildingId: string) => string;
  getProgramDisplayString: (pId?: string) => string;
  fullRoutineData: { [semesterId: string]: FullRoutineData };
  allSemesterConfigurations: SemesterCloneInfo[];
  allPrograms: ProgramEntry[];
  coursesData: EnrollmentEntry[];
  scheduleOverrides: ScheduleOverrides;
  scheduleHistory: ScheduleLogEntry[];
  onUpdateOverrides: (roomNumber: string, slotString: string, newAssignments: Record<string, ClassDetail | null>, defaultClassForSlot: ClassDetail | undefined) => void;
  onUpdateDefaultRoutine: (day: DayOfWeek, roomNumber: string, slotString: string, newClass: ClassDetail | null, semesterId: string) => void;
  activeProgramIdInSidebar: string | null;
  selectedSemesterIdForRoutineView: string | null;
  pendingChanges: PendingChange[];
  setPendingChanges: React.Dispatch<React.SetStateAction<PendingChange[]>>;
  isEditable: boolean;
}

const colorMapping: { [key: string]: string } = {
  'bg-sky-100': 'text-sky-800 bg-sky-100 border-sky-300',
  'bg-lime-100': 'text-lime-800 bg-lime-100 border-lime-300',
  'bg-amber-100': 'text-amber-800 bg-amber-100 border-amber-300',
  'bg-rose-100': 'text-rose-800 bg-rose-100 border-rose-300',
  'bg-teal-100': 'text-teal-800 bg-teal-100 border-teal-300',
  'bg-blue-100': 'text-blue-800 bg-blue-100 border-blue-300',
  'bg-green-100': 'text-green-800 bg-green-100 border-green-300',
  'bg-yellow-100': 'text-yellow-800 bg-yellow-100 border-yellow-300',
  'bg-purple-100': 'text-purple-800 bg-purple-100 border-purple-300',
  'bg-pink-100': 'text-pink-800 bg-pink-100 border-pink-300',
  'bg-orange-100': 'text-orange-800 bg-orange-100 border-orange-300',
  'bg-cyan-100': 'text-cyan-800 bg-cyan-100 border-cyan-300',
};

const getInfoCardColorClass = (baseColor?: string): string => {
  if (baseColor && colorMapping[baseColor]) {
    return colorMapping[baseColor];
  }
  return 'text-gray-800 bg-gray-100 border-gray-300';
};

const formatDateForDisplay = (dateString: string): string => {
    if (!dateString) return 'N/A';
    const parts = dateString.split('-');
    if (parts.length !== 3) return dateString; // Fallback for invalid format
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
    const day = parseInt(parts[2], 10);
    const date = new Date(Date.UTC(year, month, day));
    
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(date);
};

const generateClassDetailFromEnrollment = (enrollment: EnrollmentEntry): ClassDetail => {
    return {
        courseCode: enrollment.courseCode,
        courseName: enrollment.courseTitle,
        teacher: enrollment.teacherName,
        section: enrollment.section,
        color: getLevelTermColor(enrollment.levelTerm),
        pId: enrollment.pId,
        classTaken: enrollment.classTaken,
        levelTerm: enrollment.levelTerm,
    };
};

const calculateDurationInMinutes = (startTime: string, endTime: string): number => {
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

const formatMinutesToHHMM = (totalMinutes: number): string => {
  if (totalMinutes <= 0) return "00:00";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);
  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  return `${hh}:${mm}`;
};


type AssignmentMode = 'bulk' | 'specific';

const DROPDOWN_INITIAL_ITEMS = 50;
const DROPDOWN_LOAD_MORE_COUNT = 25;

// A more robust, searchable dropdown component for selecting courses
const SearchableCourseDropdown = React.memo(({
  courses,
  selectedCourseId,
  onChange,
  disabled,
}: {
  courses: EnrollmentEntry[];
  selectedCourseId: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [displayCount, setDisplayCount] = useState(DROPDOWN_INITIAL_ITEMS);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedCourse = useMemo(() => {
    return courses.find(c => c.sectionId === selectedCourseId);
  }, [courses, selectedCourseId]);

  const filteredCourses = useMemo(() => {
    if (!searchTerm) {
      return courses;
    }
    const lowerSearchTerm = searchTerm.toLowerCase();
    return courses.filter(
      course =>
        course.courseCode.toLowerCase().includes(lowerSearchTerm) ||
        course.courseTitle.toLowerCase().includes(lowerSearchTerm) ||
        course.section.toLowerCase().includes(lowerSearchTerm) ||
        course.teacherName.toLowerCase().includes(lowerSearchTerm)
    );
  }, [courses, searchTerm]);
  
  // Reset display count when filter changes
  useEffect(() => {
    setDisplayCount(DROPDOWN_INITIAL_ITEMS);
  }, [searchTerm]);

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
        setSearchTerm(''); // Reset search term when dropdown closes
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSelect = (sectionId: string) => {
    onChange(sectionId);
    setIsOpen(false);
  };

  const handleScroll = () => {
    if (listRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = listRef.current;
        if (scrollTop + clientHeight >= scrollHeight - 5) { // -5px buffer
             setDisplayCount(prev => Math.min(prev + DROPDOWN_LOAD_MORE_COUNT, filteredCourses.length));
        }
    }
  };

  const getButtonDisplay = () => {
    if (selectedCourseId === 'mixed') return "Mixed Assignments";
    if (selectedCourse) return `${selectedCourse.courseCode} - ${selectedCourse.section}`;
    if (disabled) return "Select dates first...";
    return "Select a course...";
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled}
        className="w-full flex items-center justify-between p-2 text-sm border border-gray-300 rounded-md shadow-sm focus:ring-1 focus:ring-teal-500 focus:border-teal-500 bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="truncate">{getButtonDisplay()}</span>
        <svg className="w-5 h-5 ml-2 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
      </button>

      {isOpen && (
        <div className="absolute z-30 w-full mt-1 bg-white rounded-md shadow-lg max-h-60 overflow-hidden flex flex-col border border-gray-300">
          <div className="p-2 sticky top-0 bg-white z-10 border-b border-gray-200">
            <input
              ref={searchInputRef}
              type="search"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search courses..."
              className="w-full px-2 py-1.5 text-xs border-gray-300 rounded-md focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>
          <ul ref={listRef} onScroll={handleScroll} role="listbox" className="flex-grow overflow-y-auto custom-scrollbar">
            <li
              className={`px-3 py-2 text-sm cursor-pointer transition-colors duration-100 flex items-center justify-between ${selectedCourseId === 'free' ? 'bg-red-600 text-white font-semibold' : 'text-red-600 hover:bg-red-50'}`}
              onClick={() => handleSelect('free')}
              role="option"
              aria-selected={selectedCourseId === 'free'}
            >
              Clear
              {selectedCourseId === 'free' && <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
            </li>
            {filteredCourses.slice(0, displayCount).map(course => (
              <li
                key={course.sectionId}
                className={`px-3 py-2 text-sm cursor-pointer transition-colors duration-100 flex items-center justify-between ${selectedCourseId === course.sectionId ? 'bg-teal-600 text-white' : 'text-gray-900 hover:bg-teal-100'}`}
                onClick={() => handleSelect(course.sectionId)}
                role="option"
                aria-selected={selectedCourseId === course.sectionId}
              >
                <div className="flex-grow min-w-0">
                    <div className="font-medium truncate">{course.courseCode} - {course.section}</div>
                    <div className={`text-xs truncate ${selectedCourseId === course.sectionId ? 'text-teal-200' : 'text-gray-500'}`}>{course.courseTitle}</div>
                </div>
                {selectedCourseId === course.sectionId && <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0 ml-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
              </li>
            ))}
            {displayCount < filteredCourses.length && (
                <li className="px-3 py-2 text-xs text-gray-500 text-center italic">Loading more...</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
});
SearchableCourseDropdown.displayName = 'SearchableCourseDropdown';

const formatDateForCompactDisplay = (dateISO: string): { month: string; day: string } => {
    // Adding 'T00:00:00Z' ensures the date is parsed as UTC, avoiding timezone shifts.
    const date = new Date(dateISO + 'T00:00:00Z');
    const month = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' }).format(date);
    const day = date.getUTCDate().toString();
    return { month, day };
};


const HistoryItem = ({ entry }: { entry: ScheduleLogEntry }) => {
    const renderClassInfo = (classInfo: ClassDetail | null) => {
        if (!classInfo) {
            return <span className="italic text-gray-500">Cleared</span>;
        }
        return (
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${getInfoCardColorClass(classInfo.color)}`}>
                {classInfo.courseCode} ({classInfo.section})
            </span>
        );
    };

    const changeDetail = entry.isOverride
        ? `Override for ${formatDateForDisplay(entry.dateISO!)}`
        : `Default for ${entry.day}`;

    return (
        <tr className="hover:bg-gray-50">
            <td className="px-1 py-1.5 text-xs text-gray-500 whitespace-nowrap">
                {new Date(entry.timestamp).toLocaleString([], { year: '2-digit', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </td>
            <td className="px-1 py-1.5 text-xs text-gray-800">
                <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {entry.userAvatar && entry.userAvatar.startsWith('data:image') ? (
                            <img src={entry.userAvatar} alt={entry.userName} className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-sm">{entry.userAvatar || '👤'}</span>
                        )}
                    </div>
                    <span className="truncate">{entry.userName}</span>
                </div>
            </td>
            <td className="px-1 py-1.5 text-xs text-gray-600">
                {changeDetail}
            </td>
            <td className="px-1 py-1.5 text-xs">
                <div className="flex items-center justify-center gap-1">
                    {renderClassInfo(entry.from)}
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                    {renderClassInfo(entry.to)}
                </div>
            </td>
        </tr>
    );
};

const HistoryView = ({ history }: { history: ScheduleLogEntry[] }) => {
    if (history.length === 0) {
        return (
            <div className="text-center py-10 text-gray-500 italic h-full flex items-center justify-center">
                <p>No change history found for this slot.</p>
            </div>
        );
    }
    return (
        <div className="h-full overflow-y-auto custom-scrollbar pr-2 -mr-2">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                    <tr>
                        <th className="px-1 py-1 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider w-1/4">Timestamp</th>
                        <th className="px-1 py-1 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider w-1/4">User</th>
                        <th className="px-1 py-1 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider w-1/4">Type</th>
                        <th className="px-1 py-1 text-center text-[10px] font-bold text-gray-500 uppercase tracking-wider w-1/4">Change</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                    {history.map(entry => <HistoryItem key={entry.logId} entry={entry} />)}
                </tbody>
            </table>
        </div>
    );
};


const SlotDetailModal: React.FC<SlotDetailModalProps> = React.memo(({
  isOpen,
  onClose,
  slotData,
  getBuildingName,
  getProgramDisplayString,
  fullRoutineData,
  allSemesterConfigurations,
  allPrograms,
  coursesData,
  scheduleOverrides,
  scheduleHistory,
  onUpdateOverrides,
  onUpdateDefaultRoutine,
  activeProgramIdInSidebar,
  selectedSemesterIdForRoutineView,
  pendingChanges,
  setPendingChanges,
  isEditable,
}) => {
    const { user } = useAuth();
    const [selectedDates, setSelectedDates] = useState<string[]>([]);
    const [dateAssignments, setDateAssignments] = useState<Record<string, ClassDetail | null>>({});
    const [selectedCourseId, setSelectedCourseId] = useState<string>('');
    const [assignmentMode, setAssignmentMode] = useState<AssignmentMode>('bulk');
    const [stagedDefaultClass, setStagedDefaultClass] = useState<ClassDetail | null | undefined>(undefined);
    const [hasMadeChanges, setHasMadeChanges] = useState(false);
    const [activeTab, setActiveTab] = useState<'assignment' | 'history'>('assignment');
    
    const { room, slot, day } = slotData;
    const slotString = formatDefaultSlotToString(slot);

    const canViewHistory = useMemo(() => {
        if (!user) return false;
        if (user.role === 'admin') return true;
        return user.dashboardAccess?.canViewSlotHistory === true;
    }, [user]);
    
    const canAssignCourses = useMemo(() => {
      if (!user) return false;
      if (user.role === 'admin') return true;
      return user.makeupSlotBookingAccess !== 'none' || user.bulkAssignAccess !== 'none';
    }, [user]);
    
    const canDoBulkAssign = useMemo(() => {
        if (!user) return false;
        if (user.role === 'admin') return true;
        return user.bulkAssignAccess !== 'none';
    }, [user]);

    const canDoSpecificAssign = useMemo(() => {
        if (!user) return false;
        if (user.role === 'admin') return true;
        return user.makeupSlotBookingAccess !== 'none';
    }, [user]);

    const isAssignmentDisabled = useMemo(() => {
        if (!isEditable) {
            return { disabled: true, reason: "Viewing published routine. Switch to 'Draft' mode to make changes." };
        }
        if (!selectedSemesterIdForRoutineView) {
            return { disabled: true, reason: "Please select a specific semester from the sidebar to assign courses." };
        }
        if (!canAssignCourses) {
            return { disabled: true, reason: "You do not have permission to assign courses." };
        }
        return { disabled: false, reason: "" };
    }, [canAssignCourses, selectedSemesterIdForRoutineView, isEditable]);

    const weeklyDates = useMemo(() => {
        if (!isOpen) return []; // Don't compute if not open
        const assignedProgram = allPrograms.find(p => p.pId === room.assignedToPId);
        const semesterSystemType = assignedProgram?.semesterSystem;
        const semesterConfig = allSemesterConfigurations.find(c => c.targetSemester === room.semesterId);
        let typeConfig: SemesterCloneInfo['typeConfigs'][0] | undefined;
        if (semesterSystemType && semesterConfig) {
            typeConfig = semesterConfig.typeConfigs.find(tc => tc.type === semesterSystemType);
        }

        if (!typeConfig || !typeConfig.startDate || !typeConfig.endDate) {
            return [];
        }
    
        const jsDayMap = {
            'Saturday': 6, 'Sunday': 0, 'Monday': 1, 'Tuesday': 2,
            'Wednesday': 3, 'Thursday': 4, 'Friday': 5
        };
        const targetJsDay = jsDayMap[day as keyof typeof jsDayMap];
        if (targetJsDay === undefined) return [];
    
        const dates: Date[] = [];
        const [startYear, startMonth, startDay] = typeConfig.startDate.split('-').map(Number);
        const [endYear, endMonth, endDay] = typeConfig.endDate.split('-').map(Number);
        
        const startDate = new Date(Date.UTC(startYear, startMonth - 1, startDay));
        const endDate = new Date(Date.UTC(endYear, endMonth - 1, endDay));
    
        let currentDate = new Date(startDate);
    
        while (currentDate <= endDate) {
            if (currentDate.getUTCDay() === targetJsDay) {
                dates.push(new Date(currentDate)); // Push a copy
            }
            currentDate.setUTCDate(currentDate.getUTCDate() + 1);
        }
        
        return dates;
      }, [isOpen, room.assignedToPId, room.semesterId, allPrograms, allSemesterConfigurations, day]);

    const totalClassHours = useMemo(() => {
      if (!isOpen || weeklyDates.length === 0 || !slot) return '00:00';
      const durationMinutes = calculateDurationInMinutes(slot.startTime, slot.endTime);
      const totalMinutes = durationMinutes * weeklyDates.length;
      return formatMinutesToHHMM(totalMinutes);
    }, [isOpen, weeklyDates, slot]);


    const defaultClassInfo: ClassDetail | undefined = useMemo(() => {
        if (!room.semesterId) return undefined;
        return fullRoutineData[room.semesterId]?.[day]?.[room.roomNumber]?.[slotString];
    }, [fullRoutineData, room.semesterId, day, room.roomNumber, slotString]);

    useEffect(() => {
        if (isOpen) {
            const existingOverrides = scheduleOverrides[room.roomNumber]?.[slotString] || {};
            setDateAssignments(existingOverrides);
            setSelectedCourseId('');
            setAssignmentMode(canDoBulkAssign ? 'bulk' : 'specific');
            setHasMadeChanges(false);
            setStagedDefaultClass(undefined);
            setActiveTab('assignment');
        }
    }, [isOpen, scheduleOverrides, room.roomNumber, slotString, canDoBulkAssign]);

    // Effect to auto-select dates based on the mode
    useEffect(() => {
        if (isOpen) {
            if (assignmentMode === 'bulk') {
                const initialOverrides = scheduleOverrides[room.roomNumber]?.[slotString] || {};
                const datesForBulkMode = weeklyDates
                    .map(date => date.toISOString().split('T')[0])
                    .filter(dateISO => !initialOverrides[dateISO]); // This is true if key is missing (undefined) or value is null
                setSelectedDates(datesForBulkMode);
            } else { // 'specific' mode
                setSelectedDates([]);
            }
        }
    }, [assignmentMode, isOpen, weeklyDates, scheduleOverrides, room.roomNumber, slotString]);

  const buildingName = getBuildingName(room.buildingId);
  const programDisplay = getProgramDisplayString(room.assignedToPId);
  
  const effectiveDefaultClassInfo = useMemo(() => {
    // If a bulk change is staged, show it. Otherwise, show the original default.
    return stagedDefaultClass !== undefined ? stagedDefaultClass : defaultClassInfo;
  }, [stagedDefaultClass, defaultClassInfo]);

  const assignedProgram = allPrograms.find(p => p.pId === room.assignedToPId);
  const semesterSystemType = assignedProgram?.semesterSystem;
  const semesterConfig = allSemesterConfigurations.find(c => c.targetSemester === room.semesterId);

  let typeConfig: SemesterCloneInfo['typeConfigs'][0] | undefined;
  if (semesterSystemType && semesterConfig) {
      typeConfig = semesterConfig.typeConfigs.find(tc => tc.type === semesterSystemType);
  }

  let semesterDateString: string | null = null;
  if (typeConfig && typeConfig.startDate && typeConfig.endDate) {
    semesterDateString = `${typeConfig.type}: ${formatDateForDisplay(typeConfig.startDate)} to ${formatDateForDisplay(typeConfig.endDate)}`;
  }

  const courseOptions = useMemo(() => {
    let filteredCourses = coursesData;
    const semesterToFilterBy = selectedSemesterIdForRoutineView || room.semesterId;
    if (semesterToFilterBy) {
        filteredCourses = filteredCourses.filter(c => c.semester === semesterToFilterBy);
    }
    
    // Base list filtered by program scope
    let baseList: EnrollmentEntry[];
    if (activeProgramIdInSidebar) {
        const selectedProgram = allPrograms.find(p => p.id === activeProgramIdInSidebar);
        if (selectedProgram) {
            baseList = filteredCourses.filter(c => c.pId === selectedProgram.pId);
        } else {
            baseList = [];
        }
    } else if (user && user.role !== 'admin') {
        const isTeacher = user.employeeId && coursesData.some(course => course.teacherId === user.employeeId && course.semester === semesterToFilterBy);
        let accessiblePIds: Set<string>;
        if (isTeacher) {
            accessiblePIds = new Set(coursesData.filter(course => course.teacherId === user.employeeId && course.semester === semesterToFilterBy).map(course => course.pId));
        } else {
            accessiblePIds = new Set(user.accessibleProgramPIds || []);
        }
        baseList = filteredCourses.filter(c => accessiblePIds.has(c.pId));
    } else {
        baseList = filteredCourses;
    }
    
    // Apply fine-grained permissions
    if (!canAssignCourses || !user) return [];
    
    const accessLevel = assignmentMode === 'bulk' ? user.bulkAssignAccess : user.makeupSlotBookingAccess;
    
    if (user.role === 'admin' || accessLevel === 'full') {
        // Return unique list
    } else if (accessLevel === 'own') {
        if (!user.employeeId) return [];
        baseList = baseList.filter(course => course.teacherId === user.employeeId);
    } else {
        return [];
    }

    const uniqueCourses: EnrollmentEntry[] = [];
    const seen = new Set<string>();
    baseList.forEach(course => {
        if (!seen.has(course.sectionId)) {
            uniqueCourses.push(course);
            seen.add(course.sectionId);
        }
    });

    return uniqueCourses.sort((a,b) => a.courseCode.localeCompare(b.courseCode) || a.section.localeCompare(b.section));
  }, [coursesData, selectedSemesterIdForRoutineView, room.semesterId, activeProgramIdInSidebar, allPrograms, user, canAssignCourses, assignmentMode]);

  const getAssignmentForDate = (dateISO: string): ClassDetail | null | undefined => {
    if (dateISO in dateAssignments) {
        return dateAssignments[dateISO];
    }
    return defaultClassInfo;
  };

  useEffect(() => {
    if (assignmentMode === 'specific' && selectedDates.length === 0) {
        setSelectedCourseId('');
        return;
    }

    if (assignmentMode === 'bulk') {
        const assignment = effectiveDefaultClassInfo; // Use the staged or original default
        const assignmentId = assignment ? courseOptions.find(c => c.courseCode === assignment.courseCode && c.section === assignment.section)?.sectionId || 'unknown' : 'free';
        setSelectedCourseId(assignmentId);
    } else { // specific mode
        const firstDateAssignment = getAssignmentForDate(selectedDates[0]);
        const firstAssignmentId = firstDateAssignment ? courseOptions.find(c => c.courseCode === firstDateAssignment.courseCode && c.section === firstDateAssignment.section)?.sectionId || 'unknown' : 'free';

        const allSame = selectedDates.every(date => {
            const currentAssignment = getAssignmentForDate(date);
            const currentId = currentAssignment ? courseOptions.find(c => c.courseCode === currentAssignment.courseCode && c.section === currentAssignment.section)?.sectionId || 'unknown' : 'free';
            return currentId === firstAssignmentId;
        });

        if (allSame) {
            setSelectedCourseId(firstAssignmentId);
        } else {
            setSelectedCourseId('mixed');
        }
    }
  }, [selectedDates, dateAssignments, courseOptions, effectiveDefaultClassInfo, assignmentMode, getAssignmentForDate]);

  const handleDateClick = (dateISO: string, event: React.MouseEvent) => {
    if (assignmentMode !== 'specific') return;

    // Ctrl/Cmd click to toggle multiple selections
    if (event.ctrlKey || event.metaKey) {
        setSelectedDates(prev => {
            const newSelection = new Set(prev);
            if (newSelection.has(dateISO)) {
                newSelection.delete(dateISO);
            } else {
                newSelection.add(dateISO);
            }
            return Array.from(newSelection);
        });
    } else if (event.shiftKey && selectedDates.length > 0) {
        // Shift click for range selection
        const sortedWeeklyDatesISO = weeklyDates.map(d => d.toISOString().split('T')[0]);
        const lastSelectedDate = selectedDates[selectedDates.length - 1];
        const lastIndex = sortedWeeklyDatesISO.indexOf(lastSelectedDate);
        const currentIndex = sortedWeeklyDatesISO.indexOf(dateISO);

        if (lastIndex !== -1 && currentIndex !== -1) {
            const start = Math.min(lastIndex, currentIndex);
            const end = Math.max(lastIndex, currentIndex);
            const range = sortedWeeklyDatesISO.slice(start, end + 1);
            const newSelection = new Set([...selectedDates, ...range]);
            setSelectedDates(Array.from(newSelection));
        } else {
              // Fallback to single selection if range logic fails
              setSelectedDates([dateISO]);
        }
    } else {
        // Normal click for single selection/deselection
        setSelectedDates(prev => {
            if (prev.length === 1 && prev[0] === dateISO) {
                return []; // Deselect if it's the only one selected
            }
            return [dateISO]; // Otherwise, select only this one
        });
    }
  };

  const applyAssignment = (newIdentifier: string) => {
    if (isAssignmentDisabled.disabled) return;

    let newAssignment: ClassDetail | null = null;
    if (newIdentifier === 'free') {
        newAssignment = null;
    } else if (newIdentifier && newIdentifier !== 'mixed') {
        const courseEnrollment = courseOptions.find(c => c.sectionId === newIdentifier);
        if (courseEnrollment) {
            newAssignment = generateClassDetailFromEnrollment(courseEnrollment);
        }
    } else {
        return; // 'mixed' or invalid, do nothing
    }

    if (assignmentMode === 'bulk') {
        if (!canDoBulkAssign) return;
        setStagedDefaultClass(newAssignment);
        setHasMadeChanges(true); // Enable save button
    } else { // 'specific' mode
        if (!canDoSpecificAssign) return;
        const newAssignments = { ...dateAssignments };
        selectedDates.forEach(date => {
            newAssignments[date] = newAssignment;
        });
        setDateAssignments(newAssignments);
        setHasMadeChanges(true); // Enable save button
    }
  };
  
  const hasDirectEditPermission = useMemo(() => {
    if (!user || !room) return false;
    if (user.role === 'admin') return true;

    const roomProgramPId = room.assignedToPId;
    if (!roomProgramPId) {
        // If room is unassigned, anyone with makeup/bulk access can edit directly
        return user.makeupSlotBookingAccess !== 'none' || user.bulkAssignAccess !== 'none';
    }

    return (
        user.notificationAccess?.canApproveSlots &&
        (user.accessibleProgramPIds || []).includes(roomProgramPId)
    );
  }, [user, room]);

  const handleSaveChanges = () => {
    if (!room.semesterId || !user) {
        console.error("Cannot save: Missing semesterId on room or user is not logged in.");
        return;
    }
  
    if (hasDirectEditPermission) {
        // Direct update logic
        if (stagedDefaultClass !== undefined) {
            onUpdateDefaultRoutine(day, room.roomNumber, slotString, stagedDefaultClass, room.semesterId);
        }
        onUpdateOverrides(room.roomNumber, slotString, dateAssignments, effectiveDefaultClassInfo);
    } else {
        // Request approval logic
        if (assignmentMode === 'bulk' && stagedDefaultClass !== undefined) {
            const newChange: PendingChange = {
                id: `pc-${Date.now()}`,
                requesterId: user.id,
                requesterName: user.name,
                timestamp: new Date().toISOString(),
                requestedClassInfo: stagedDefaultClass,
                semesterId: room.semesterId,
                roomNumber: room.roomNumber,
                slotString: slotString,
                isBulkUpdate: true,
                day: day,
            };
            setPendingChanges(prev => [...prev, newChange]);
        }
  
        if (assignmentMode === 'specific' && Object.keys(dateAssignments).length > 0) {
            const changesByClass = new Map<string, { classInfo: ClassDetail | null, dates: string[] }>();
            
            Object.entries(dateAssignments).forEach(([dateISO, classInfo]) => {
                const classKey = JSON.stringify(classInfo);
                if (!changesByClass.has(classKey)) {
                    changesByClass.set(classKey, { classInfo, dates: [] });
                }
                changesByClass.get(classKey)!.dates.push(dateISO);
            });

            const newChanges: PendingChange[] = Array.from(changesByClass.values()).map(data => ({
                id: `pc-${Date.now()}-${Math.random()}`,
                requesterId: user.id,
                requesterName: user.name,
                timestamp: new Date().toISOString(),
                requestedClassInfo: data.classInfo,
                semesterId: room.semesterId!,
                roomNumber: room.roomNumber,
                slotString: slotString,
                isBulkUpdate: false,
                day: day, // context for which day's overrides are being changed
                dates: data.dates,
            }));

            setPendingChanges(prev => [...prev, ...newChanges]);
        }
        alert('Your change request has been submitted for approval.');
    }
    onClose();
  };
  
  
  const relevantHistory = useMemo(() => {
    if (!isOpen) return [];
    const weeklyDatesISO = weeklyDates.map(d => d.toISOString().split('T')[0]);
    
    const defaultRoutineChanges = scheduleHistory.filter(entry =>
        entry.roomNumber === room.roomNumber &&
        entry.slotString === slotString &&
        entry.semesterId === room.semesterId &&
        entry.isOverride === false &&
        entry.day === day
    );

    const overrideChanges = scheduleHistory.filter(entry =>
        entry.roomNumber === room.roomNumber &&
        entry.slotString === slotString &&
        entry.semesterId === room.semesterId &&
        entry.isOverride === true &&
        entry.dateISO &&
        weeklyDatesISO.includes(entry.dateISO)
    );

    return [...defaultRoutineChanges, ...overrideChanges]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [isOpen, scheduleHistory, room.roomNumber, slotString, room.semesterId, day, weeklyDates]);

  const modalHeaderContent = (
      <div className="text-center w-full">
          <p id="slot-detail-modal-title" className="text-lg sm:text-xl font-bold text-teal-700">{day}, {slotString}</p>
          <div className="text-xs sm:text-sm text-gray-500 mt-1 flex justify-center items-center flex-wrap gap-x-2">
              <span>{buildingName}</span>
              <span className="text-gray-300" aria-hidden="true">|</span>
              <span className="font-semibold">{room.roomNumber}</span>
              <span className="text-gray-300" aria-hidden="true">|</span>
              <span>{programDisplay}</span>
          </div>
          <div className="text-xs mt-1 flex justify-center items-center flex-wrap gap-x-2">
            {semesterDateString && (
              <span className="text-indigo-600">{semesterDateString}</span>
            )}
            {weeklyDates.length > 0 && (
              <>
                {semesterDateString && <span className="text-gray-400 mx-1" aria-hidden="true">|</span>}
                <span className="text-gray-600" title={`This class slot occurs ${weeklyDates.length} times during the semester.`}>Class Week: <span className="font-bold text-gray-700">{weeklyDates.length}</span></span>
                 {totalClassHours !== '00:00' &&
                    <>
                      <span className="text-gray-400 mx-1" aria-hidden="true">|</span>
                      <span className="text-gray-600" title={`Total class hours for this slot over the semester.`}>Total Hours: <span className="font-bold text-gray-700">{totalClassHours}</span></span>
                    </>
                  }
              </>
            )}
          </div>
      </div>
  );
  
  const selectedCourseDetails = useMemo(() => {
    // For bulk mode, the displayed details should reflect the staged change.
    if (assignmentMode === 'bulk') {
        if (!effectiveDefaultClassInfo) return null;
        return courseOptions.find(c => c.courseCode === effectiveDefaultClassInfo.courseCode && c.section === effectiveDefaultClassInfo.section) || null;
    }

    // Specific mode logic remains the same
    if (!selectedCourseId || selectedCourseId === 'free' || selectedCourseId === 'mixed') {
        return null;
    }
    return courseOptions.find(c => c.sectionId === selectedCourseId);
  }, [selectedCourseId, courseOptions, assignmentMode, effectiveDefaultClassInfo]);

  const footerContent = (
    <div className="flex justify-between items-center">
        <div>
            {canViewHistory && (
                <button
                    type="button"
                    onClick={() => setActiveTab(prev => prev === 'assignment' ? 'history' : 'assignment')}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md border border-gray-300 flex items-center gap-2"
                >
                    {activeTab === 'assignment' ? (
                        <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            View History
                        </>
                    ) : (
                        <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            Assignment
                        </>
                    )}
                </button>
            )}
        </div>
        <div className="flex justify-end gap-3">
             <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md border border-gray-300"
            >
                Close
            </button>
            <button
                onClick={handleSaveChanges}
                disabled={isAssignmentDisabled.disabled || !hasMadeChanges}
                className="px-4 py-2 bg-teal-600 text-white font-medium rounded-md shadow-sm hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
                {hasDirectEditPermission ? 'Save Changes' : 'Submit for Approval'}
            </button>
        </div>
    </div>
);
  const pendingChangeForThisSlot = useMemo(() => {
    return pendingChanges.find(p =>
      p.semesterId === room.semesterId &&
      p.roomNumber === room.roomNumber &&
      p.slotString === slotString &&
      p.day === day
    );
  }, [pendingChanges, room, slotString, day]);


  return (
    <div
        className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden transform transition-all duration-300 ease-out"
        role="dialog"
        aria-modal="true"
        aria-labelledby="slot-detail-modal-title"
        onClick={(e) => e.stopPropagation()}
    >
        <div className="flex items-start justify-between p-3 border-b border-gray-200 flex-shrink-0 bg-gray-50/70 backdrop-blur-sm">
            <div className="flex-grow min-w-0">
                {modalHeaderContent}
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
        
        <div className="p-3 sm:p-4 flex-grow min-h-0 flex flex-col">
          {pendingChangeForThisSlot ? (
            <div className="flex-grow flex items-center justify-center text-center p-4 bg-yellow-50 border-2 border-dashed border-yellow-300 rounded-lg">
                <div>
                    <h3 className="text-lg font-bold text-yellow-800">Change Pending Approval</h3>
                    <p className="mt-1 text-sm text-yellow-700">
                        A change for this slot has been requested by <span className="font-semibold">{pendingChangeForThisSlot.requesterName}</span> and is awaiting approval.
                    </p>
                    <div className="mt-3 p-2 bg-white rounded-md text-xs">
                        {pendingChangeForThisSlot.requestedClassInfo ? (
                           <>
                            <p><strong>Action:</strong> Assign</p>
                            <p><strong>Course:</strong> {pendingChangeForThisSlot.requestedClassInfo.courseCode} ({pendingChangeForThisSlot.requestedClassInfo.section})</p>
                           </>
                        ) : (
                             <p><strong>Action:</strong> Clear Slot</p>
                        )}
                         <p><strong>Scope:</strong> {pendingChangeForThisSlot.isBulkUpdate ? `Default for all ${pendingChangeForThisSlot.day}s` : `Specific dates: ${(pendingChangeForThisSlot.dates || []).join(', ')}`}</p>
                    </div>
                </div>
            </div>
          ) : activeTab === 'assignment' ? (
            <div className="flex flex-col md:grid md:grid-cols-5 lg:grid-cols-9 gap-4 lg:gap-6 flex-grow min-h-0">
                {/* Center column: Course Assignment */}
                <div className={`md:col-span-2 lg:col-span-4 flex-shrink-0 flex flex-col min-h-0 relative ${isAssignmentDisabled.disabled ? 'opacity-50' : ''}`}>
                    { isAssignmentDisabled.disabled && 
                        <div className="absolute inset-0 bg-gray-100/50 backdrop-blur-sm z-20 flex items-center justify-center p-4 rounded-lg">
                            <p className="text-center text-sm font-semibold text-gray-600">{isAssignmentDisabled.reason}</p>
                        </div>
                    }
                    <div className={`flex-shrink-0 space-y-3 ${isAssignmentDisabled.disabled ? 'pointer-events-none' : ''}`}>
                         <h3 className="text-md font-semibold text-gray-700">Assign Course</h3>
                        <SearchableCourseDropdown
                            courses={courseOptions}
                            selectedCourseId={selectedCourseId}
                            onChange={applyAssignment}
                            disabled={isAssignmentDisabled.disabled || (selectedDates.length === 0 && assignmentMode === 'specific')}
                        />
                        <div className="flex w-full rounded-md bg-gray-200 p-0.5">
                            <button
                                onClick={() => setAssignmentMode('bulk')}
                                className={`flex-1 px-3 py-1 text-sm font-medium rounded-md transition-colors text-center ${
                                    assignmentMode === 'bulk' ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-600 hover:bg-gray-300'
                                } ${!canDoBulkAssign ? 'opacity-50 cursor-not-allowed' : ''}`}
                                aria-pressed={assignmentMode === 'bulk'}
                                disabled={!canDoBulkAssign}
                                title={!canDoBulkAssign ? "Permission required for Bulk Assign" : "Bulk Assign Mode"}
                            >
                                Bulk Assign
                            </button>
                            <button
                                onClick={() => {
                                    setAssignmentMode('specific');
                                    // When switching to specific dates, discard any staged bulk assignment.
                                    setStagedDefaultClass(undefined);
                                }}
                                className={`flex-1 px-3 py-1 text-sm font-medium rounded-md transition-colors text-center ${
                                    assignmentMode === 'specific' ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-600 hover:bg-gray-300'
                                } ${!canDoSpecificAssign ? 'opacity-50 cursor-not-allowed' : ''}`}
                                aria-pressed={assignmentMode === 'specific'}
                                disabled={!canDoSpecificAssign}
                                title={!canDoSpecificAssign ? "Permission required for Make-up Slot Booking" : "Specific Dates Mode"}
                            >
                                Specific Dates
                            </button>
                        </div>
                    </div>
                    <div className={`flex-grow overflow-y-auto custom-scrollbar pr-2 -mr-2 mt-4 space-y-3 ${isAssignmentDisabled.disabled ? 'pointer-events-none' : ''}`}>
                        <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs space-y-2">
                            <h4 className="font-semibold text-sm text-gray-800 mb-2 border-b border-gray-200 pb-1">Course Details</h4>
                            <dl className="space-y-1">
                                <div className="sm:grid sm:grid-cols-3 sm:gap-2"><dt className="font-medium text-gray-500">Code</dt><dd className="text-gray-800 sm:col-span-2 font-semibold">{selectedCourseDetails?.courseCode ?? 'N/A'}</dd></div>
                                <div className="sm:grid sm:grid-cols-3 sm:gap-2"><dt className="font-medium text-gray-500">Title</dt><dd className="text-gray-800 sm:col-span-2">{selectedCourseDetails?.courseTitle ?? 'N/A'}</dd></div>
                                <div className="sm:grid sm:grid-cols-3 sm:gap-2"><dt className="font-medium text-gray-500">Section</dt><dd className="text-gray-800 sm:col-span-2">{selectedCourseDetails?.section ?? 'N/A'}</dd></div>
                                <div className="sm:grid sm:grid-cols-3 sm:gap-2"><dt className="font-medium text-gray-500">Credit</dt><dd className="text-gray-800 sm:col-span-2">{selectedCourseDetails?.credit ?? 'N/A'}</dd></div>
                                <div className="sm:grid sm:grid-cols-3 sm:gap-2"><dt className="font-medium text-gray-500">Type</dt><dd className="text-gray-800 sm:col-span-2">{selectedCourseDetails?.type ?? 'N/A'}</dd></div>
                                <div className="sm:grid sm:grid-cols-3 sm:gap-2"><dt className="font-medium text-gray-500">Students</dt><dd className="text-gray-800 sm:col-span-2">{selectedCourseDetails?.studentCount ?? 'N/A'}</dd></div>
                                <div className="sm:grid sm:grid-cols-3 sm:gap-2"><dt className="font-medium text-gray-500">Classes Taken</dt><dd className="text-gray-800 sm:col-span-2">{selectedCourseDetails?.classTaken ?? 'N/A'}</dd></div>
                                <div className="sm:grid sm:grid-cols-3 sm:gap-2"><dt className="font-medium text-gray-500">Teacher</dt><dd className="text-gray-800 sm:col-span-2">{selectedCourseDetails ? `${selectedCourseDetails.teacherName}, ${selectedCourseDetails.designation}` : 'N/A'}</dd></div>
                            </dl>
                        </div>
                        {selectedCourseId === 'mixed' && (<p className="text-xs text-orange-600 mt-1.5">Selected dates have different assignments. Please select dates with the same assignment to modify them together.</p>)}
                    </div>
                </div>

                {/* Right side: Weekly Dates */}
                <div className="md:col-span-3 lg:col-span-5 flex-grow min-w-0 flex flex-col">
                    {weeklyDates.length > 0 ? (
                        <div className="flex flex-col h-full">
                            <h3 className="text-md font-semibold text-gray-700 mb-2 flex-shrink-0">Weekly Dates for this Slot</h3>
                            <div className="flex-grow overflow-y-auto custom-scrollbar p-2 bg-gray-50 rounded-md min-h-0 border border-gray-200">
                                <div className="grid grid-cols-4 gap-1.5">
                                    {weeklyDates.map((date, index) => {
                                        const dateISO = date.toISOString().split('T')[0];
                                        const pendingChangeForThisDate = pendingChanges.find(p =>
                                            p.semesterId === room.semesterId &&
                                            p.roomNumber === room.roomNumber &&
                                            p.slotString === slotString &&
                                            !p.isBulkUpdate &&
                                            p.dates?.includes(dateISO)
                                        );
                                        const isSelected = selectedDates.includes(dateISO);
                                        const hasOverride = dateISO in dateAssignments;
                                        const assignment = getAssignmentForDate(dateISO);
                                        const isFree = !assignment;
                                        const { month, day: dayNum } = formatDateForCompactDisplay(dateISO);
                                        
                                        if (pendingChangeForThisDate) {
                                            return (
                                                <div key={index}
                                                    className="p-1 rounded-lg border-2 border-dashed border-gray-400 shadow-sm flex flex-col items-center justify-center h-10 w-full relative group bg-gray-100 pending-cell-bg cursor-not-allowed"
                                                    title={`Pending change by ${pendingChangeForThisDate.requesterName}. Action: ${pendingChangeForThisDate.requestedClassInfo ? 'Assign' : 'Clear'}`} >
                                                    <div className="flex flex-row items-baseline gap-1">
                                                        <span className="text-[9px] font-semibold text-gray-500">{month}</span>
                                                        <span className="text-sm font-bold leading-tight text-gray-600">{dayNum}</span>
                                                    </div>
                                                    <div className="w-full text-center h-[12px] mt-0.5 flex items-center justify-center">
                                                        <p className="text-[9px] font-bold tracking-tighter truncate text-yellow-800 bg-yellow-200 px-1 rounded" title={`Requested by ${pendingChangeForThisDate.requesterName}`}>
                                                            PENDING
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        }

                                        return (
                                            <button
                                                key={index}
                                                onClick={(e) => handleDateClick(dateISO, e)}
                                                disabled={assignmentMode !== 'specific'}
                                                className={`p-1 rounded-lg border-2 shadow-sm transition-all duration-150 ease-in-out flex flex-col items-center justify-center h-10 w-full relative group
                                                    ${isSelected 
                                                        ? 'bg-teal-500 border-teal-600' 
                                                        : isFree 
                                                            ? 'bg-white border-green-700 hover:bg-gray-50' 
                                                            : 'bg-white border-red-600 hover:bg-gray-50'
                                                    }
                                                    ${assignmentMode !== 'specific' ? 'opacity-60 cursor-not-allowed' : ''}`}
                                                title={assignment ? `${assignment.courseCode} - Sec: ${assignment.section}` : 'Free'}
                                            >
                                                {hasOverride ? (
                                                    <span className="absolute top-1 right-1 h-1.5 w-1.5 bg-blue-500 rounded-full border border-white" title="This date has a specific override."></span>
                                                ) : !assignment ? (
                                                    <span className="absolute top-1 right-1 h-1.5 w-1.5 bg-green-400 rounded-full" title="Free (matches default schedule)"></span>
                                                ) : null}

                                                <div className="flex flex-row items-baseline gap-1">
                                                    <span className={`text-[9px] font-semibold transition-colors ${isSelected ? 'text-teal-100' : (isFree ? 'text-green-700' : 'text-gray-500')}`}>{month}</span>
                                                    <span className={`text-sm font-bold leading-tight transition-colors ${isSelected ? 'text-white' : (isFree ? 'text-green-700' : 'text-gray-800')}`}>{dayNum}</span>
                                                </div>
                                                
                                                <div className="w-full text-center h-[12px] mt-0.5 flex items-center justify-center">
                                                    {assignment ? (
                                                        <p className={`text-[8px] font-bold tracking-tighter truncate transition-colors px-0.5 ${isSelected ? 'text-white' : 'text-gray-700'}`} title={`${assignment.courseCode} - ${assignment.section}`}>
                                                            {assignment.courseCode}-{assignment.section}
                                                        </p>
                                                    ) : (
                                                        <span className={`text-[9px] font-medium transition-colors ${isSelected ? 'text-teal-200' : 'text-green-700'}`}>Free</span>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    ) : (
                         <div className="text-center text-xs text-gray-500 italic p-4 bg-gray-50 rounded-md h-full flex items-center justify-center border border-gray-200">
                           No weekly dates found for this slot. Check semester configuration.
                        </div>
                    )}
                </div>
            </div>
          ) : (
            <div className="flex-grow min-h-0">
              <HistoryView history={relevantHistory} />
            </div>
          )}
        </div>

        <div className="p-2 flex-shrink-0 border-t border-gray-200 flex justify-between items-center">
            <div>
                {canViewHistory && (
                    <button
                        type="button"
                        onClick={() => setActiveTab(prev => prev === 'assignment' ? 'history' : 'assignment')}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md border border-gray-300 flex items-center gap-2"
                    >
                        {activeTab === 'assignment' ? (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                View History
                            </>
                        ) : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                Assignment
                            </>
                        )}
                    </button>
                )}
            </div>
            <div className="flex justify-end gap-3">
                 <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md border border-gray-300"
                >
                    Close
                </button>
                <button
                    onClick={handleSaveChanges}
                    disabled={isAssignmentDisabled.disabled || !hasMadeChanges}
                    className="px-4 py-2 bg-teal-600 text-white font-medium rounded-md shadow-sm hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                    {hasDirectEditPermission ? 'Save Changes' : 'Submit for Approval'}
                </button>
            </div>
        </div>
    </div>
  );
});

SlotDetailModal.displayName = 'SlotDetailModal';

export default SlotDetailModal;