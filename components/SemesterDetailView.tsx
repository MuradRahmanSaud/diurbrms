

import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useRooms } from '../contexts/RoomContext';
import { useRoomCategories } from '../contexts/RoomCategoryContext';
import { useRoomTypes } from '../contexts/RoomTypeContext';
import { useFloors } from '../contexts/FloorContext';
import { EnrollmentEntry, FullRoutineData, RoomEntry, DefaultTimeSlot, ProgramEntry, CourseType, SemesterSystem, RoomTypeEntry, ProgramType, DayOfWeek, ScheduleOverrides, SemesterCloneInfo, ClassDetail, BuildingEntry, FloorEntry } from '../types';
import { formatDefaultSlotToString } from '../App';
import { sortSlotsByTypeThenTime } from '../data/slotConstants';
import { DAYS_OF_WEEK } from '../data/routineConstants';
import DayTimeSlotDetailModal from "../modals/DayTimeSlotDetailModal";
import TeacherListView, { TeacherData } from './semester-detail-views/TeacherListView';
import CourseListView from './semester-detail-views/CourseListView';
import FullSectionListView from './semester-detail-views/FullSectionListView';
import RoomListView from './semester-detail-views/RoomListView';
import TeacherViewDetailModal from './modals/TeacherViewDetailModal';
import RoomDetailModal from './modals/RoomDetailModal';


// --- Helper Function ---
// Helper function to count occurrences of a specific day of the week within a date range.
const countDayOccurrences = (dayOfWeek: DayOfWeek, startDateStr: string, endDateStr: string): number => {
    if (!startDateStr || !endDateStr) return 0;
    const jsDayMap = { 'Saturday': 6, 'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5 };
    const targetJsDay = jsDayMap[dayOfWeek];
    if (targetJsDay === undefined) return 0;

    try {
        const startDate = new Date(startDateStr + 'T00:00:00Z');
        const endDate = new Date(endDateStr + 'T00:00:00Z');
        let count = 0;
        let currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            if (currentDate.getUTCDay() === targetJsDay) {
                count++;
            }
            currentDate.setUTCDate(currentDate.getUTCDate() + 1);
        }
        return count;
    } catch(e) {
        console.error("Error counting day occurrences:", e);
        return 0;
    }
};

const getFullCourseTypeDisplay = (course: EnrollmentEntry): string => {
    const category = course.type; // e.g., 'GED', 'Core'
    const deliveryType = course.courseType && course.courseType !== 'Others' && course.courseType !== 'N/A' ? course.courseType : null;

    if (deliveryType) {
        return `${deliveryType} (${category})`; // e.g., Theory (GED)
    }
    return category; // e.g., GED
};


// --- Reusable UI Components (modified for reduced height) ---

const InfoCard = ({ title, mainValue, icon, gradientClasses, onClick }: { title: string, mainValue: string | number, icon: React.ReactElement, gradientClasses?: string, onClick?: () => void }) => {
    const isGradient = !!gradientClasses;
    const isClickable = !!onClick;
    const cardClasses = `p-1.5 rounded-lg shadow-lg flex flex-col justify-between relative ${isGradient ? gradientClasses : 'bg-white'} ${isClickable ? 'cursor-pointer hover:shadow-xl hover:scale-105 transition-all duration-200' : ''}`;


    return (
        <div className={cardClasses} onClick={onClick} onKeyDown={e => { if(isClickable && (e.key === 'Enter' || e.key === ' ')) onClick() }} role={isClickable ? "button" : "figure"} tabIndex={isClickable ? 0 : -1}>
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
        <div className={`h-full w-full rounded-md shadow-sm p-2 flex flex-col justify-between border ${borderColor} ${bgColor}`}>
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

interface SemesterDetailViewProps {
  semesterId: string;
  onClose: () => void;
  coursesData: EnrollmentEntry[];
  fullRoutineData: { [semesterId: string]: FullRoutineData };
  systemDefaultSlots: DefaultTimeSlot[];
  allPrograms: ProgramEntry[];
  allBuildings: BuildingEntry[];
  allFloors: FloorEntry[];
  allRoomTypes: RoomTypeEntry[];
  scheduleOverrides: ScheduleOverrides;
  allSemesterConfigurations: SemesterCloneInfo[];
  onUpdateLevelTerm: (sectionId: string, newLevelTerm: string) => void;
  onUpdateWeeklyClass: (sectionId: string, newWeeklyClass: number | undefined) => void;
  onUpdateCourseType: (sectionId: string, newCourseType: CourseType) => void;
  setCoursesData: React.Dispatch<React.SetStateAction<EnrollmentEntry[]>>;
  stagedCourseUpdates?: Record<string, { courseType: CourseType; weeklyClass: string; }>;
  uniqueSemesters: string[];
  selectedProgramId: string | null;
  activeTab: 'Theory' | 'Lab' | 'All';
  getBuildingName: (buildingId: string) => string;
  getFloorName: (floorId: string) => string;
  getTypeName: (typeId: string) => string;
  getProgramShortName: (pId?: string) => string;
  allRooms: RoomEntry[];
  onSlotClick: (room: RoomEntry, slot: DefaultTimeSlot, day: DayOfWeek) => void;
}

type InternalView = 'overview' | 'teacherList' | 'courseList' | 'sectionList' | 'roomList';

type MinMaxFiltersType = {
    weeklyClass: { min: number | ''; max: number | '' };
    sectionCount: { min: number | ''; max: number | '' };
    ciw: { min: number | ''; max: number | '' };
    cr: { min: number | ''; max: number | '' };
    cat: { min: number | ''; max: number | '' };
    student: { min: number | ''; max: number | '' };
};

const SemesterDetailView: React.FC<SemesterDetailViewProps> = ({
  semesterId,
  onClose,
  coursesData,
  fullRoutineData,
  systemDefaultSlots,
  allPrograms,
  allBuildings,
  allFloors,
  allRoomTypes,
  scheduleOverrides,
  allSemesterConfigurations,
  onUpdateLevelTerm,
  onUpdateWeeklyClass,
  onUpdateCourseType,
  setCoursesData,
  stagedCourseUpdates,
  uniqueSemesters,
  selectedProgramId,
  activeTab,
  getBuildingName,
  getFloorName,
  getTypeName,
  getProgramShortName,
  allRooms,
  onSlotClick,
}) => {
  const { rooms, loading: roomsLoading, updateRoom } = useRooms();
  const { categories: allCategories, addCategory } = useRoomCategories();
  const { addRoomType } = useRoomTypes();
  const { addFloor } = useFloors();

  const isLoading = roomsLoading;

  const [isSlotDetailModalOpen, setIsSlotDetailModalOpen] = useState(false);
  const [selectedSlotData, setSelectedSlotData] = useState<{ day: DayOfWeek; slot: DefaultTimeSlot; } | null>(null);
  const [internalView, setInternalView] = useState<InternalView>('overview');
  const [expandedTeacherId, setExpandedTeacherId] = useState<string | null>(null);
  const [teacherForDetailModal, setTeacherForDetailModal] = useState<TeacherData | null>(null);
  const [selectedRoomForModal, setSelectedRoomForModal] = useState<RoomEntry | null>(null);
  
  // State for teacher list filters
  const [teacherListPage, setTeacherListPage] = useState(1);
  const [teacherSearchTerm, setTeacherSearchTerm] = useState('');
  const [designationFilter, setDesignationFilter] = useState<string[]>([]);
  const [creditLoadFilter, setCreditLoadFilter] = useState<{ min: number | ''; max: number | '' }>({ min: '', max: '' });
  const [programFilter, setProgramFilter] = useState<string[]>([]);

  // State for course list filters
  const [courseListPage, setCourseListPage] = useState(1);
  const [courseSearchTerm, setCourseSearchTerm] = useState('');
  const [courseLevelTermFilter, setCourseLevelTermFilter] = useState<string[]>([]);
  const [courseTypeFilter, setCourseTypeFilter] = useState<string[]>([]);
  const [courseCreditFilter, setCourseCreditFilter] = useState<string[]>([]);
  const [courseMinMaxFilters, setCourseMinMaxFilters] = useState<MinMaxFiltersType>({
      weeklyClass: { min: '', max: '' },
      sectionCount: { min: '', max: '' },
      ciw: { min: '', max: '' },
      cr: { min: '', max: '' },
      cat: { min: '', max: '' },
      student: { min: '', max: '' },
  });

  // State for section list filters
  const [sectionListPage, setSectionListPage] = useState(1);
  const [sectionSearchTerm, setSectionSearchTerm] = useState('');
  const [debouncedSectionSearchTerm, setDebouncedSectionSearchTerm] = useState('');
  const [sectionLevelTermFilter, setSectionLevelTermFilter] = useState<string[]>([]);
  const [sectionCourseTypeFilter, setSectionCourseTypeFilter] = useState<string[]>([]);
  const [sectionCreditFilter, setSectionCreditFilter] = useState<string[]>([]);
  const [sectionStudentCountFilter, setSectionStudentCountFilter] = useState<{ min: number | ''; max: number | '' }>({ min: '', max: '' });
  const [sectionClassTakenFilter, setSectionClassTakenFilter] = useState<{ min: number | ''; max: number | '' }>({ min: '', max: '' });


  const TEACHERS_PER_PAGE = 15;
  const COURSES_PER_PAGE = 15;
  const SECTIONS_PER_PAGE = 20;

  useEffect(() => {
    const handler = setTimeout(() => {
        setDebouncedSectionSearchTerm(sectionSearchTerm);
    }, 300);
    return () => clearTimeout(handler);
  }, [sectionSearchTerm]);


  const routineData = useMemo(() => fullRoutineData[semesterId] || {}, [fullRoutineData, semesterId]);

  const selectedProgramPId = useMemo(() => {
    if (!selectedProgramId) return null;
    return allPrograms.find(p => p.id === selectedProgramId)?.pId || null;
  }, [selectedProgramId, allPrograms]);
  
  const filteredRooms = useMemo(() => {
      let entries = allRooms.filter(r => r.semesterId === semesterId);
      if (selectedProgramPId) {
          entries = entries.filter(r => r.assignedToPId === selectedProgramPId || r.sharedWithPIds.includes(selectedProgramPId));
      }

      const getTypeNameForRoom = (typeId: string) => {
          return allRoomTypes.find(rt => rt.id === typeId)?.typeName || '';
      };
      
      return activeTab === 'All'
          ? entries
          : entries.filter(room => {
              const roomTypeName = getTypeNameForRoom(room.typeId);
              return roomTypeName.toLowerCase().includes(activeTab.toLowerCase());
          });
  }, [allRooms, semesterId, selectedProgramPId, allRoomTypes, activeTab]);
  
  const sectionsForCurrentTab = useMemo(() => {
    let relevantCourses = coursesData.filter(c => c.semester === semesterId);
    if (selectedProgramPId) {
        relevantCourses = relevantCourses.filter(c => c.pId === selectedProgramPId);
    }
    return activeTab === 'All' ? relevantCourses : relevantCourses.filter(c => c.courseType === activeTab);
  }, [coursesData, semesterId, selectedProgramPId, activeTab]);
  
  const relevantCoursesForCounts = useMemo(() => {
    let relevant = coursesData.filter(c => c.semester === semesterId);
    if (selectedProgramPId) {
        relevant = relevant.filter(c => c.pId === selectedProgramPId);
    }
    return relevant;
  }, [coursesData, semesterId, selectedProgramPId]);

  const sectionsForSemester = useMemo(() => {
    let relevantCourses = coursesData.filter(c => c.semester === semesterId);
    if (selectedProgramPId) {
        relevantCourses = relevantCourses.filter(c => c.pId === selectedProgramPId);
    }

    if (activeTab === 'Theory' || activeTab === 'Lab') {
      return relevantCourses.filter(c => c.courseType === activeTab);
    }
    
    return relevantCourses;
  }, [coursesData, semesterId, selectedProgramPId, activeTab]);

  const ciwCounts = useMemo(() => {
    const counts = new Map<string, number>();
    const semesterRoutine = routineData || {};
    relevantCoursesForCounts.forEach(section => {
        let count = 0;
        for (const day of Object.values(semesterRoutine)) {
            for (const room of Object.values(day)) {
                for (const classInfo of Object.values(room)) {
                    if (classInfo && classInfo.courseCode === section.courseCode && classInfo.section === section.section) {
                        count++;
                    }
                }
            }
        }
        counts.set(section.sectionId, count);
    });
    return counts;
  }, [relevantCoursesForCounts, routineData]);

  const classRequirementCounts = useMemo(() => {
    const counts = new Map<string, number>();
    relevantCoursesForCounts.forEach(section => {
        const scheduledDays = new Set<DayOfWeek>();
        const semesterRoutine = routineData || {};
        for (const day of Object.keys(semesterRoutine) as DayOfWeek[]) {
            const dayData = semesterRoutine[day];
            if (dayData) {
                for (const room of Object.values(dayData)) {
                    for (const classInfo of Object.values(room)) {
                        if (classInfo && classInfo.courseCode === section.courseCode && classInfo.section === section.section) {
                            scheduledDays.add(day);
                        }
                    }
                }
            }
        }
        
        if (scheduledDays.size === 0) {
            counts.set(section.sectionId, 0);
            return;
        }

        const program = allPrograms.find(p => p.pId === section.pId);
        const semesterConfig = allSemesterConfigurations.find(c => c.targetSemester === section.semester);
        let startDate = '';
        let endDate = '';

        if (program && semesterConfig) {
            const typeConfig = semesterConfig.typeConfigs.find(tc => tc.type === program.semesterSystem);
            if (typeConfig) {
                startDate = typeConfig.startDate;
                endDate = typeConfig.endDate;
            }
        }
        
        let totalClasses = 0;
        if (startDate && endDate) {
            scheduledDays.forEach(day => {
                totalClasses += countDayOccurrences(day, startDate, endDate);
            });
        }
        counts.set(section.sectionId, totalClasses);
    });
    return counts;
  }, [relevantCoursesForCounts, routineData, allPrograms, allSemesterConfigurations]);

  const stats = useMemo(() => {
    const filteredCoursesForTab = sectionsForCurrentTab;
    
    const uniqueCoursesMap = new Map<string, EnrollmentEntry>();
    filteredCoursesForTab.forEach(course => {
        if (!uniqueCoursesMap.has(course.courseCode)) {
            uniqueCoursesMap.set(course.courseCode, course);
        }
    });
    const uniqueCourseList = Array.from(uniqueCoursesMap.values());

    const teacherStats = { total: new Set(relevantCoursesForCounts.map(c => c.teacherId)).size };
    const sectionStats = { total: filteredCoursesForTab.length };
    const courseStats = { total: uniqueCourseList.length };
    const roomStats = { total: filteredRooms.length };
    const weeklyClassStats = { total: filteredCoursesForTab.reduce((sum, c) => sum + (c.weeklyClass || 0), 0) };
    
    let totalSlotsFilteredType = 0;
    filteredRooms.forEach(room => {
        const programForRoom = allPrograms.find(p => p.pId === room.assignedToPId);
        const activeDaysCount = programForRoom?.activeDays?.length || 0;
        if (activeDaysCount > 0) {
            const slotsForRoom = (room.roomSpecificSlots?.length ?? 0) > 0 ? room.roomSpecificSlots : systemDefaultSlots;
            slotsForRoom.forEach(slot => {
                if (activeTab === 'All' || slot.type === activeTab) {
                    totalSlotsFilteredType += activeDaysCount;
                }
            });
        }
    });

    let bookedSlotsFilteredType = 0;
    const routineForSemester = routineData || {};
    const roomNumbersInScope = new Set(filteredRooms.map(r => r.roomNumber));
    Object.values(routineForSemester).forEach(dayData => {
        Object.entries(dayData).forEach(([roomNumber, roomSlots]) => {
            if (roomNumbersInScope.has(roomNumber)) {
                 Object.values(roomSlots).forEach(classInfo => {
                    if (classInfo) {
                        const course = filteredCoursesForTab.find(c =>
                            c.courseCode === classInfo.courseCode &&
                            c.section === classInfo.section &&
                            c.pId === classInfo.pId
                        );
                        if (course) {
                            bookedSlotsFilteredType++;
                        }
                    }
                 });
            }
        });
    });

    const totalSlotStats = { total: totalSlotsFilteredType };
    const bookedSlotStats = { total: bookedSlotsFilteredType };
    const emptySlotStats = { total: totalSlotsFilteredType - bookedSlotsFilteredType };

    return { teacherStats, sectionStats, courseStats, roomStats, totalSlotStats, bookedSlotStats, emptySlotStats, weeklyClassStats };

  }, [semesterId, selectedProgramPId, activeTab, filteredRooms, systemDefaultSlots, allPrograms, routineData, sectionsForCurrentTab, relevantCoursesForCounts, allRoomTypes]);
  
  const selectedProgramDetails = useMemo(() => {
    if (!selectedProgramId) return null;
    return allPrograms.find(p => p.id === selectedProgramId);
  }, [selectedProgramId, allPrograms]);

  const programsInSemester = useMemo(() => {
    const pIdsInSemester = new Set(coursesData.filter(c => c.semester === semesterId).map(c => c.pId));
    return allPrograms.filter(p => pIdsInSemester.has(p.pId));
  }, [coursesData, semesterId, allPrograms]);
  
  const teacherListData = useMemo(() => {
    let relevantCourses = coursesData.filter(c => c.semester === semesterId);
    if (selectedProgramPId) {
        relevantCourses = relevantCourses.filter(c => c.pId === selectedProgramPId);
    }
    const teacherCourseMap = new Map<string, EnrollmentEntry[]>();
    relevantCourses.forEach(course => {
        if (!teacherCourseMap.has(course.teacherId)) {
            teacherCourseMap.set(course.teacherId, []);
        }
        teacherCourseMap.get(course.teacherId)!.push(course);
    });
    const uniqueTeachers = Array.from(teacherCourseMap.entries()).map(([teacherId, courses]) => {
        const teacherInfo = courses[0];
        const creditLoad = courses.reduce((sum, course) => sum + course.credit, 0);
        return {
            employeeId: teacherInfo.teacherId,
            teacherName: teacherInfo.teacherName,
            designation: teacherInfo.designation,
            mobile: teacherInfo.teacherMobile,
            email: teacherInfo.teacherEmail,
            creditLoad,
            courses,
        };
    });
    return uniqueTeachers.sort((a, b) => a.teacherName.localeCompare(b.teacherName));
  }, [coursesData, semesterId, selectedProgramPId]);

  const handleViewTeacherDetail = (teacher: TeacherData) => {
    setTeacherForDetailModal(teacher);
  };

  const handleOpenRoomModal = (room: RoomEntry) => {
    setSelectedRoomForModal(room);
  };

  const handleCloseRoomModal = () => {
    setSelectedRoomForModal(null);
  };

  const handleSaveRoomFromModal = async (updatedRoomData: RoomEntry) => {
    await updateRoom(updatedRoomData);
    setSelectedRoomForModal(null); 
  };
  
  const getBuildingAddress = useCallback((bId: string) => allBuildings.find(b => b.id === bId)?.address || 'N/A', [allBuildings]);
  const getCategoryNameFromContext = useCallback((cId: string) => allCategories.find(c => c.id === cId)?.categoryName || 'N/A', [allCategories]);

  const handleAddFloor = useCallback(async (name: string, buildingId: string) => {
    const newFloor = await addFloor({ floorName: name, buildingId });
    return newFloor.id;
  }, [addFloor]);

  const handleAddCategory = useCallback(async (name: string) => {
    const newCategory = await addCategory({ categoryName: name });
    return newCategory.id;
  }, [addCategory]);

  const handleAddRoomType = useCallback(async (name: string) => {
    const newType = await addRoomType({ typeName: name });
    return newType.id;
  }, [addRoomType]);

  const floorsForDetailModal = useMemo(() => {
    if (selectedRoomForModal) {
      return allFloors.filter(f => f.buildingId === selectedRoomForModal.buildingId);
    }
    return [];
  }, [selectedRoomForModal, allFloors]);


  // Teacher Filter Logic
  const uniqueDesignations = useMemo(() => {
    const designations = new Set(teacherListData.map(t => t.designation));
    return Array.from(designations).sort();
  }, [teacherListData]);
  
  const uniqueProgramsForTeacherFilter = useMemo(() => {
    const programMap = new Map<string, { pId: string; shortName: string }>();
    teacherListData.forEach(teacher => {
        teacher.courses.forEach(course => {
            if (!programMap.has(course.pId)) {
                const programInfo = allPrograms.find(p => p.pId === course.pId);
                programMap.set(course.pId, {
                    pId: course.pId,
                    shortName: programInfo?.shortName || `P-ID ${course.pId}`,
                });
            }
        });
    });
    return Array.from(programMap.values()).sort((a, b) => a.shortName.localeCompare(b.shortName));
  }, [teacherListData, allPrograms]);

  const handleDesignationFilterChange = useCallback((designation: string) => {
    setDesignationFilter(prev =>
        prev.includes(designation)
            ? prev.filter(d => d !== designation)
            : [...prev, designation]
    );
  }, []);

  const handleTeacherProgramFilterChange = useCallback((pId: string) => {
    setProgramFilter(prev =>
        prev.includes(pId) ? prev.filter(existingId => existingId !== pId) : [...prev, pId]
    );
}, []);

  const handleCreditLoadFilterChange = useCallback((key: 'min' | 'max', value: string) => {
    setCreditLoadFilter(prev => ({
        ...prev,
        [key]: value === '' ? '' : Number(value)
    }));
  }, []);

  const handleResetTeacherFilters = useCallback(() => {
    setDesignationFilter([]);
    setCreditLoadFilter({ min: '', max: '' });
    setProgramFilter([]);
  }, []);
  
  const activeTeacherFilterCount = useMemo(() => {
      let count = 0;
      if(designationFilter.length > 0) count++;
      if(creditLoadFilter.min !== '' || creditLoadFilter.max !== '') count++;
      if (programFilter.length > 0) count++;
      return count;
  }, [designationFilter, creditLoadFilter, programFilter]);

  const filteredTeacherList = useMemo(() => {
    const lowercasedSearch = teacherSearchTerm.toLowerCase();
    
    return teacherListData.filter(teacher => {
        const searchMatch = !lowercasedSearch ||
            (teacher.employeeId?.toLowerCase() || '').includes(lowercasedSearch) ||
            (teacher.teacherName?.toLowerCase() || '').includes(lowercasedSearch) ||
            (teacher.designation?.toLowerCase() || '').includes(lowercasedSearch) ||
            (teacher.mobile?.toLowerCase() || '').includes(lowercasedSearch) ||
            (teacher.email?.toLowerCase() || '').includes(lowercasedSearch) ||
            teacher.courses.some(course => 
                (course.courseCode?.toLowerCase() || '').includes(lowercasedSearch) ||
                (course.courseTitle?.toLowerCase() || '').includes(lowercasedSearch) ||
                (course.section?.toLowerCase() || '').includes(lowercasedSearch)
            );
        
        const designationMatch = designationFilter.length === 0 || designationFilter.includes(teacher.designation);

        const minCredit = creditLoadFilter.min !== '' ? Number(creditLoadFilter.min) : -Infinity;
        const maxCredit = creditLoadFilter.max !== '' ? Number(creditLoadFilter.max) : Infinity;
        const creditLoadMatch = teacher.creditLoad >= minCredit && teacher.creditLoad <= maxCredit;
        
        const programMatch = programFilter.length === 0 || teacher.courses.some(course => programFilter.includes(course.pId));

        return searchMatch && designationMatch && creditLoadMatch && programMatch;
    });
  }, [teacherListData, teacherSearchTerm, designationFilter, creditLoadFilter, programFilter]);

  useEffect(() => {
    setTeacherListPage(1);
  }, [teacherSearchTerm, designationFilter, creditLoadFilter, programFilter]);

  const totalTeacherPages = useMemo(() => {
    return Math.ceil(filteredTeacherList.length / TEACHERS_PER_PAGE);
  }, [filteredTeacherList]);

  const paginatedTeachers = useMemo(() => {
    const startIndex = (teacherListPage - 1) * TEACHERS_PER_PAGE;
    return filteredTeacherList.slice(startIndex, startIndex + TEACHERS_PER_PAGE);
  }, [filteredTeacherList, teacherListPage]);
  
  const handleResetCourseFilters = useCallback(() => {
    setCourseSearchTerm(''); setCourseLevelTermFilter([]); setCourseTypeFilter([]); setCourseCreditFilter([]);
    setCourseMinMaxFilters({ weeklyClass: { min: '', max: '' }, sectionCount: { min: '', max: '' }, ciw: { min: '', max: '' }, cr: { min: '', max: '' }, cat: { min: '', max: '' }, student: { min: '', max: '' }});
  }, []);

  
  useEffect(() => {
    if (internalView === 'teacherList') {
        setTeacherListPage(1);
        setTeacherSearchTerm('');
        handleResetTeacherFilters();
    }
    if (internalView === 'courseList') {
        setCourseListPage(1);
        setCourseSearchTerm('');
        handleResetCourseFilters();
    }
    if (internalView === 'sectionList') {
        setSectionListPage(1);
        setSectionSearchTerm('');
    }
  }, [internalView, handleResetTeacherFilters, handleResetCourseFilters]);
  
  // --- Course List Logic ---
  const courseBaseList = useMemo(() => {
    const relevantCourses = sectionsForCurrentTab;
    
    const courseMap = new Map<string, { 
        courseCode: string; courseTitle: string; credit: number; type: string; levelTerm: string; 
        weeklyClass?: number; sections: EnrollmentEntry[]; pId: string;
    }>();

    relevantCourses.forEach(course => {
        if (!courseMap.has(course.courseCode)) {
            courseMap.set(course.courseCode, {
                courseCode: course.courseCode,
                courseTitle: course.courseTitle,
                credit: course.credit,
                type: course.type,
                levelTerm: course.levelTerm,
                weeklyClass: course.weeklyClass,
                sections: [],
                pId: course.pId,
            });
        }
        courseMap.get(course.courseCode)!.sections.push(course);
    });

    return Array.from(courseMap.values()).sort((a,b) => a.courseCode.localeCompare(b.courseCode));
}, [sectionsForCurrentTab]);
    
    // Course Filter Options
    const courseUniqueLevelTerms = useMemo(() => Array.from(new Set(courseBaseList.map(c => c.levelTerm))).sort(), [courseBaseList]);
    
    const courseUniqueCourseTypes = useMemo(() => {
        const fullTypes = new Set(courseBaseList.flatMap(course => course.sections.map(getFullCourseTypeDisplay)));
        return Array.from(fullTypes).sort();
    }, [courseBaseList]);
    
    const courseUniqueCredits = useMemo(() => Array.from(new Set(courseBaseList.map(c => c.credit.toString()))).sort((a,b) => Number(a)-Number(b)), [courseBaseList]);

    const handleCourseMinMaxFilterChange = useCallback((filterKey: keyof typeof courseMinMaxFilters, type: 'min' | 'max', value: string) => {
        setCourseMinMaxFilters(prev => ({ ...prev, [filterKey]: { ...prev[filterKey], [type]: value === '' ? '' : Number(value) }}));
    }, []);
    
    const activeCourseFilterCount = useMemo(() => {
        let count = 0;
        if (courseLevelTermFilter.length) count++; if (courseTypeFilter.length) count++; if (courseCreditFilter.length) count++;
        Object.values(courseMinMaxFilters).forEach(f => { if (f.min !== '' || f.max !== '') count++; });
        return count;
    }, [courseLevelTermFilter, courseTypeFilter, courseCreditFilter, courseMinMaxFilters]);
    
    const filteredCourseList = useMemo(() => {
        const lowerSearch = courseSearchTerm.toLowerCase();

        return courseBaseList.filter(course => {
            if(lowerSearch && !course.courseCode.toLowerCase().includes(lowerSearch) && !course.courseTitle.toLowerCase().includes(lowerSearch)) return false;
            if(courseLevelTermFilter.length && !courseLevelTermFilter.includes(course.levelTerm)) return false;
            if (courseTypeFilter.length > 0) {
                const hasMatchingType = course.sections.some(section => courseTypeFilter.includes(getFullCourseTypeDisplay(section)));
                if (!hasMatchingType) return false;
            }
            if(courseCreditFilter.length && !courseCreditFilter.includes(course.credit.toString())) return false;

            // Section-based filters
            const totalStudents = course.sections.reduce((sum, s) => sum + s.studentCount, 0);
            const totalCIW = course.sections.reduce((sum, s) => sum + (ciwCounts.get(s.sectionId) ?? 0), 0);
            const totalCR = course.sections.reduce((sum, s) => sum + ((classRequirementCounts.get(s.sectionId) ?? 0) * (ciwCounts.get(s.sectionId) ?? 0)), 0);
            const totalCAT = course.sections.reduce((sum, s) => sum + s.classTaken, 0);

            const { weeklyClass, sectionCount, ciw, cr, cat, student } = courseMinMaxFilters;
            if (weeklyClass.min !== '' && (course.weeklyClass ?? -1) < weeklyClass.min) return false;
            if (weeklyClass.max !== '' && (course.weeklyClass ?? Infinity) > weeklyClass.max) return false;
            if (sectionCount.min !== '' && course.sections.length < sectionCount.min) return false;
            if (sectionCount.max !== '' && course.sections.length > sectionCount.max) return false;
            if (ciw.min !== '' && totalCIW < ciw.min) return false;
            if (ciw.max !== '' && totalCIW > ciw.max) return false;
            if (cr.min !== '' && totalCR < cr.min) return false;
            if (cr.max !== '' && totalCR > cr.max) return false;
            if (cat.min !== '' && totalCAT < cat.min) return false;
            if (cat.max !== '' && totalCAT > cat.max) return false;
            if (student.min !== '' && totalStudents < student.min) return false;
            if (student.max !== '' && totalStudents > student.max) return false;
            
            return true;
        });
    }, [courseBaseList, courseSearchTerm, courseLevelTermFilter, courseTypeFilter, courseCreditFilter, courseMinMaxFilters, ciwCounts, classRequirementCounts]);

    useEffect(() => {
        setCourseListPage(1);
    }, [filteredCourseList]);
    
    const totalCoursePages = useMemo(() => Math.ceil(filteredCourseList.length / COURSES_PER_PAGE), [filteredCourseList]);

    const paginatedCourses = useMemo(() => {
        const startIndex = (courseListPage - 1) * COURSES_PER_PAGE;
        return filteredCourseList.slice(startIndex, startIndex + COURSES_PER_PAGE);
    }, [filteredCourseList, courseListPage]);

  const sectionUniqueLevelTerms = useMemo(() => Array.from(new Set(sectionsForSemester.map(c => c.levelTerm))).sort(), [sectionsForSemester]);
  const sectionUniqueCourseTypes = useMemo(() => {
    const options = new Set<string>();
    sectionsForSemester.forEach(course => {
        options.add(getFullCourseTypeDisplay(course));
    });
    return Array.from(options).sort();
  }, [sectionsForSemester]);
  const sectionUniqueCredits = useMemo(() => Array.from(new Set(sectionsForSemester.map(c => c.credit.toString()))).sort((a, b) => Number(a) - Number(b)), [sectionsForSemester]);

  const filteredSectionsForList = useMemo(() => {
    let filteredItems = [...sectionsForSemester];

    if (sectionLevelTermFilter.length > 0) filteredItems = filteredItems.filter(item => sectionLevelTermFilter.includes(item.levelTerm));
    if (sectionCourseTypeFilter.length > 0) {
        filteredItems = filteredItems.filter(item => sectionCourseTypeFilter.includes(getFullCourseTypeDisplay(item)));
    }
    if (sectionCreditFilter.length > 0) {
      filteredItems = filteredItems.filter(item => sectionCreditFilter.includes(item.credit.toString()));
    }
    
    const minCt = sectionClassTakenFilter.min !== '' ? parseInt(String(sectionClassTakenFilter.min), 10) : -Infinity;
    const maxCt = sectionClassTakenFilter.max !== '' ? parseInt(String(sectionClassTakenFilter.max), 10) : Infinity;

    if (!isNaN(minCt) || !isNaN(maxCt)) {
        filteredItems = filteredItems.filter(item => {
        const classTaken = item.classTaken;
        const meetsMin = isNaN(minCt) || classTaken >= minCt;
        const meetsMax = isNaN(maxCt) || classTaken <= maxCt;
        return meetsMin && meetsMax;
        });
    }

    const minSc = sectionStudentCountFilter.min !== '' ? parseInt(String(sectionStudentCountFilter.min), 10) : -Infinity;
    const maxSc = sectionStudentCountFilter.max !== '' ? parseInt(String(sectionStudentCountFilter.max), 10) : Infinity;

    if (!isNaN(minSc) || !isNaN(maxSc)) {
        filteredItems = filteredItems.filter(item => {
            const studentCount = item.studentCount;
            const meetsMin = isNaN(minSc) || studentCount >= minSc;
            const meetsMax = isNaN(maxSc) || studentCount <= maxSc;
            return meetsMin && meetsMax;
        });
    }

    if (debouncedSectionSearchTerm.trim()) {
      const lowercasedFilter = debouncedSectionSearchTerm.toLowerCase();
      filteredItems = filteredItems.filter(item => (
        item.pId.toLowerCase().includes(lowercasedFilter) ||
        item.courseCode.toLowerCase().includes(lowercasedFilter) ||
        item.courseTitle.toLowerCase().includes(lowercasedFilter) ||
        item.section.toLowerCase().includes(lowercasedFilter) ||
        item.teacherName.toLowerCase().includes(lowercasedFilter)
      ));
    }
    return filteredItems;
  }, [
      sectionsForSemester,
      debouncedSectionSearchTerm,
      sectionLevelTermFilter,
      sectionCourseTypeFilter,
      sectionCreditFilter,
      sectionStudentCountFilter,
      sectionClassTakenFilter,
  ]);

  const totalSectionPages = Math.ceil(filteredSectionsForList.length / SECTIONS_PER_PAGE);

  const paginatedSections = useMemo(() => {
    const startIndex = (sectionListPage - 1) * SECTIONS_PER_PAGE;
    return filteredSectionsForList.slice(startIndex, startIndex + SECTIONS_PER_PAGE);
  }, [filteredSectionsForList, sectionListPage]);


  const routineOverviewData = useMemo(() => {
    let headerSlotsForGrid: DefaultTimeSlot[];
    let activeDaysForGrid: DayOfWeek[];
    let relevantProgramPIds: string[];

    if (selectedProgramDetails) {
        headerSlotsForGrid = (selectedProgramDetails.programSpecificSlots?.length ? selectedProgramDetails.programSpecificSlots : systemDefaultSlots)
            .filter(slot => {
                if (activeTab === 'Lab') return slot.type === 'Lab';
                return slot.type === 'Theory'; // For 'All' and 'Theory' tabs
            })
            .sort(sortSlotsByTypeThenTime);
        activeDaysForGrid = selectedProgramDetails.activeDays?.length ? selectedProgramDetails.activeDays : DAYS_OF_WEEK;
        relevantProgramPIds = [selectedProgramDetails.pId];
    } else { // Semester-wide overview
        const allPossibleSlots = new Map<string, DefaultTimeSlot>();
        systemDefaultSlots.forEach(s => {
            if (activeTab === 'Lab' ? s.type === 'Lab' : s.type === 'Theory') {
                allPossibleSlots.set(formatDefaultSlotToString(s), s);
            }
        });
        programsInSemester.forEach(p => {
            (p.programSpecificSlots || []).forEach(s => {
                if (activeTab === 'Lab' ? s.type === 'Lab' : s.type === 'Theory') {
                    allPossibleSlots.set(formatDefaultSlotToString(s), s);
                }
            });
        });
        headerSlotsForGrid = Array.from(allPossibleSlots.values()).sort(sortSlotsByTypeThenTime);
        activeDaysForGrid = DAYS_OF_WEEK;
        relevantProgramPIds = programsInSemester.map(p => p.pId);
    }
    
    const routineForSemester = routineData || {};
    
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

            filteredRooms.forEach(room => {
                const roomProgram = allPrograms.find(p => p.pId === room.assignedToPId);
                if (!roomProgram?.activeDays?.includes(day)) {
                    return;
                }

                const roomOperatingSlots = (room.roomSpecificSlots?.length ?? 0) > 0 ? room.roomSpecificSlots : systemDefaultSlots;

                const isRoomActiveForThisSlot = roomOperatingSlots.some(
                    roomSlot => roomSlot.type === slotObj.type && roomSlot.startTime === slotObj.startTime && roomSlot.endTime === slotObj.endTime
                );

                if (isRoomActiveForThisSlot) {
                    totalActiveRoomsForSlot++;
                    const classInSlot = routineForSemester[day as DayOfWeek]?.[room.roomNumber]?.[slotString];
                    if (classInSlot && relevantProgramPIds.includes(classInSlot.pId)) {
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
  }, [selectedProgramDetails, systemDefaultSlots, activeTab, routineData, filteredRooms, allPrograms, programsInSemester]);

  const getOccupancyStats = useCallback((room: RoomEntry) => {
      const program = allPrograms.find(p => p.pId === room.assignedToPId);
      if (!program || !program.activeDays || program.activeDays.length === 0) {
          return { theory: { booked: 0, total: 0 }, lab: { booked: 0, total: 0 } };
      }

      const activeDays = program.activeDays;
      const applicableSlots = (room.roomSpecificSlots?.length ?? 0) > 0 ? room.roomSpecificSlots : systemDefaultSlots;
      const routineForSemester = routineData || {};

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
                         const correspondingSlot = applicableSlots.find(s => formatDefaultSlotToString(s) === slotString);
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


  const handleOpenSlotDetail = (day: DayOfWeek, slot: DefaultTimeSlot) => {
    setSelectedSlotData({ day, slot });
    setIsSlotDetailModalOpen(true);
  };

  const handleCloseSlotDetail = () => {
    setIsSlotDetailModalOpen(false);
    setSelectedSlotData(null);
  };
  
  const gradients = [
    'bg-gradient-to-br from-blue-500 to-indigo-600',
    'bg-gradient-to-br from-green-500 to-teal-600',
    'bg-gradient-to-br from-purple-500 to-pink-600',
    'bg-gradient-to-br from-yellow-500 to-orange-600',
    'bg-gradient-to-br from-cyan-500 to-sky-600',
    'bg-gradient-to-br from-slate-500 to-slate-700',
    'bg-gradient-to-br from-rose-500 to-red-600',
    'bg-gradient-to-br from-fuchsia-500 to-purple-600',
  ];
  
  const handleCourseLevelTermFilterChange = useCallback((value: string) => {
    setCourseLevelTermFilter(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
  }, []);

  const handleCourseTypeFilterChange = useCallback((value: string) => {
    setCourseTypeFilter(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
  }, []);

  const handleCourseCreditFilterChange = useCallback((value: string) => {
    setCourseCreditFilter(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
  }, []);


  if (isLoading) {
    return (
      <div className="p-6 text-center text-gray-500 flex flex-col justify-center items-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-500"></div>
        <p className="mt-4">Loading Semester Dashboard...</p>
      </div>
    );
  }
  
  return (
    <div className="bg-slate-100 p-2 sm:p-3 rounded-lg h-full flex flex-col relative">
      <button
            onClick={onClose}
            className="absolute top-1 right-1 z-20 text-gray-400 hover:text-red-700 p-1.5 rounded-full hover:bg-red-100 transition-colors"
            aria-label="Close semester details"
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
      </button>

      {/* Main Content Container */}
      <div className="flex-grow flex flex-col min-h-0 bg-white p-3 rounded-lg shadow-md">
        
        {