import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { DayOfWeek, MainViewType, DefaultTimeSlot, RoomEntry, ProgramEntry, FloorEntry, RoomCategoryEntry, RoomTypeEntry, RoutineViewMode, EnrollmentEntry, OverlayViewType, SemesterCloneInfo, ScheduleOverrides, ClassDetail, User, SemesterSystem, ScheduleLogEntry, CourseType, DailyRoutineData, FullRoutineData, TimeSlot, AttendanceLogEntry, MakeupClassDetails, RoutineVersion, SemesterRoutineData, BuildingEntry, ConflictInfoForModal, AiResolutionSuggestion, PendingChange, Notification } from '../types';
import { DAYS_OF_WEEK, SAMPLE_ROUTINE_DATA } from '../data/routineConstants';
import { usePrograms } from '../contexts/ProgramContext';
import { useRooms } from '../contexts/RoomContext';
import { useBuildings } from '../contexts/BuildingContext';
import { useFloors } from '../contexts/FloorContext';
import { useRoomCategories } from '../contexts/RoomCategoryContext';
import { useRoomTypes } from '../contexts/RoomTypeContext';
import { useAuth } from '../contexts/AuthContext';
import { SEED_DEFAULT_SLOTS_DATA, sortSlotsByTypeThenTime } from '../data/slotConstants';
import { SAMPLE_ENROLLMENT_DATA } from '../data/courseSectionConstants';
import { SEMESTER_SYSTEMS } from '../data/programConstants';
import { getLevelTermColor } from '../data/colorConstants';
import { formatDefaultSlotToString } from '../App';
import { generateLevelTermRoutinePDF, generateFullRoutinePDF, generateCourseSectionRoutinePDF } from '../utils/pdfGenerator';

type RoomTypeFilter = 'Theory' | 'Lab' | null; 
type ActiveSettingsSection = 'program' | 'slots' | 'buildings' | 'semester' | 'theme' | null;

const getSystemDefaultTimeSlotsObjects = (): DefaultTimeSlot[] => {
  const savedSlotsJson = localStorage.getItem('defaultTimeSlots');
  if (savedSlotsJson) {
      try {
          const rawSlots = JSON.parse(savedSlotsJson);
          if (Array.isArray(rawSlots)) {
              const validatedSlots: DefaultTimeSlot[] = rawSlots
                  .map((slot: any): DefaultTimeSlot | null => {
                      const typeIsValid = slot.type === 'Theory' || slot.type === 'Lab';
                      if (typeof slot.id === 'string' && typeIsValid && typeof slot.startTime === 'string' && slot.startTime.match(/^([01]\d|2[0-3]):([0-5]\d)$/) && typeof slot.endTime === 'string' && slot.endTime.match(/^([01]\d|2[0-3]):([0-5]\d)$/)) {
                          return { id: slot.id, type: slot.type as 'Theory' | 'Lab', startTime: slot.startTime, endTime: slot.endTime };
                      }
                      return null; 
                  })
                  .filter((slot): slot is DefaultTimeSlot => slot !== null);

              if (validatedSlots.length > 0) return validatedSlots.sort(sortSlotsByTypeThenTime);
              if (rawSlots.length === 0 && validatedSlots.length === 0) return []; 
          }
      } catch (e) { console.warn("Failed to parse defaultTimeSlots from localStorage, using seed data:", e); }
  }
  return SEED_DEFAULT_SLOTS_DATA.map((slot, index) => ({ ...slot, id: `seed-system-default-${Date.now()}-${index}-${Math.random().toString(16).substring(2)}` })).sort(sortSlotsByTypeThenTime);
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


export const useAppLogic = () => {
    const { user, logout, users, syncTeachersAsUsers, changePassword } = useAuth();
  
    const initialDay = useMemo(() => {
        const today = new Date();
        const dayIndex = today.getDay();
        const jsDayMap: { [key: number]: DayOfWeek } = { 0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday' };
        return jsDayMap[dayIndex];
    }, []);

    const [selectedDay, setSelectedDay] = useState<DayOfWeek>(initialDay);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [activeMainView, setActiveMainView] = useState<MainViewType>('routine');
    const [activeOverlay, setActiveOverlay] = useState<OverlayViewType | null>(null);
    const [selectedBuildingIdForView, setSelectedBuildingIdForView] = useState<string | null>(null);
    const [selectedUserIdForDetailView, setSelectedUserIdForDetailView] = useState<string | null>(null);
    const [selectedProgramIdForDetailView, setSelectedProgramIdForDetailView] = useState<string | null>(null);
    const [activeSemesterDetailViewId, setActiveSemesterDetailViewId] = useState<string | null>(null);
    
    const [isOverlayAnimating, setIsOverlayAnimating] = useState(false);
    const [applyOpenAnimationStyles, setApplyOpenAnimationStyles] = useState(false);

    const [activeProgramIdInSidebar, setActiveProgramIdInSidebar] = useState<string | null>(null);
    const { programs: allPrograms, getProgramById, loading: programsLoading } = usePrograms();
    const { rooms: allRooms, addRoom, updateRoom: updateRoomContext, getRoomById } = useRooms(); 
    const { buildings: allBuildings } = useBuildings();
    const { floors: allFloors, addFloor: addFloorContext } = useFloors();
    const { categories: allCategories, addCategory: addCategoryContext } = useRoomCategories();
    const { roomTypes: allRoomTypes, addRoomType: addRoomTypeContext } = useRoomTypes();

    const [actualActiveAssignedFilter, setActualActiveAssignedFilter] = useState<RoomTypeFilter>('Theory');
    const [actualActiveSharedFilter, setActualActiveSharedFilter] = useState<RoomTypeFilter>(null);
    
    const [routineViewMode, setRoutineViewMode] = useState<RoutineViewMode>('dayCentric');
    const [allSemesterConfigurations, setAllSemesterConfigurations] = useState<SemesterCloneInfo[]>([]);
    const [scheduleOverrides, setScheduleOverrides] = useState<ScheduleOverrides>({});
    const [scheduleHistory, setScheduleHistory] = useState<ScheduleLogEntry[]>([]);
    const [routineData, setRoutineData] = useState<{ [semesterId: string]: SemesterRoutineData }>({});
    const [attendanceLog, setAttendanceLog] = useState<AttendanceLogEntry[]>([]);
    
    const [activeSettingsSection, setActiveSettingsSection] = useState<ActiveSettingsSection>(null);
    const [initialSectionListFilters, setInitialSectionListFilters] = useState<{ pId: string; category: string; credit: number; } | null>(null);

    const [stagedCourseUpdates, setStagedCourseUpdates] = useState<Record<string, { courseType: CourseType; weeklyClass: string; }>>({});
    
    const [activeGridDisplayType, setActiveGridDisplayType] = useState<'Theory' | 'Lab' | 'All'>('All');
    const [programIdForSemesterFilter, setProgramIdForSemesterFilter] = useState<string | null>(null);
    const [dashboardTabFilter, setDashboardTabFilter] = useState<'All' | 'Theory' | 'Lab'>('All');
    const [selectedLevelTermFilter, setSelectedLevelTermFilter] = useState<string | null>(null);
    const [selectedSectionFilter, setSelectedSectionFilter] = useState<string | null>(null);
    const [selectedTeacherIdFilter, setSelectedTeacherIdFilter] = useState<string | null>(null);
    const [selectedCourseSectionIdsFilter, setSelectedCourseSectionIdsFilter] = useState<string[]>([]);
    
    const [isLogAttendanceModalOpen, setIsLogAttendanceModalOpen] = useState(false);
    const [logDataForModal, setLogDataForModal] = useState<Partial<AttendanceLogEntry> | null>(null);

    const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
    const [conflictDataForModal, setConflictDataForModal] = useState<ConflictInfoForModal | null>(null);

    const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);

    const systemDefaultTimeSlots = useMemo(() => getSystemDefaultTimeSlotsObjects(), []);

    const [coursesData, setCoursesData] = useState<EnrollmentEntry[]>(() => {
        const savedCourses = localStorage.getItem('rbrms-courses-data');
        if (savedCourses) {
            try { return JSON.parse(savedCourses); } 
            catch (e) { console.error("Failed to parse courses data from localStorage, using seed.", e); return SAMPLE_ENROLLMENT_DATA; }
        }
        return SAMPLE_ENROLLMENT_DATA;
    });

    const [selectedSemesterIdForRoutineView, setSelectedSemesterIdForRoutineView] = useState<string | null>('Spring 2025');

    const accessiblePrograms = useMemo(() => {
        if (programsLoading || !allPrograms) {
            return [];
        }
        if (user?.role === 'admin') {
            return allPrograms;
        }
        if (user) {
            const isTeacher = user.employeeId && coursesData.some(course => course.teacherId === user.employeeId);
            if (isTeacher) {
                const teacherProgramPIds = new Set(
                    coursesData
                        .filter(course => course.teacherId === user.employeeId && course.semester === selectedSemesterIdForRoutineView)
                        .map(course => course.pId)
                );
                return allPrograms.filter(p => teacherProgramPIds.has(p.pId));
            }
            if (Array.isArray(user.accessibleProgramPIds)) {
                const accessiblePIds = new Set(user.accessibleProgramPIds);
                return allPrograms.filter(p => accessiblePIds.has(p.pId));
            }
        }
        return [];
    }, [allPrograms, user, programsLoading, coursesData, selectedSemesterIdForRoutineView]);
    
    const accessibleProgramPIds = useMemo(() => new Set(accessiblePrograms.map(p => p.pId)), [accessiblePrograms]);

    const prevBuildingsRef = useRef<BuildingEntry[]>(allBuildings);

    useEffect(() => {
        const prevBuildings = prevBuildingsRef.current;
        if (prevBuildings === allBuildings) {
            return;
        }
    
        const prevBuildingsMap = new Map(prevBuildings.map(b => [b.id, b]));
        const roomsToUpdate: RoomEntry[] = [];
    
        allBuildings.forEach(newBuilding => {
            const oldBuilding = prevBuildingsMap.get(newBuilding.id);
            if (oldBuilding && oldBuilding.buildingShortName !== newBuilding.buildingShortName) {
                allRooms
                    .filter(r => r.buildingId === newBuilding.id && r.roomNumber.startsWith(`${oldBuilding.buildingShortName}-`))
                    .forEach(room => {
                        const newRoomNumber = room.roomNumber.replace(`${oldBuilding.buildingShortName}-`, `${newBuilding.buildingShortName}-`);
                        roomsToUpdate.push({ ...room, roomNumber: newRoomNumber });
                    });
            }
        });
    
        if (roomsToUpdate.length > 0) {
            const updatePromises = roomsToUpdate.map(room => updateRoomContext(room));
            Promise.all(updatePromises).catch(error => {
                console.error("Error batch updating room numbers:", error);
                alert(`An error occurred while updating room numbers: ${error.message}`);
            });
        }
    
        prevBuildingsRef.current = allBuildings;
    }, [allBuildings, allRooms, updateRoomContext]);
  
    const uniqueSemestersForRooms = useMemo(() => {
        const semesters = [...new Set(allSemesterConfigurations.map(c => c.targetSemester))];
        return semesters.sort((a, b) => {
            const semesterOrder = ['Spring', 'Summer', 'Fall'];
            const [aSem, aYear] = a.split(' ');
            const [bSem, bYear] = b.split(' ');
            if (aYear !== bYear) return (parseInt(bYear) || 0) - (parseInt(aYear) || 0);
            return semesterOrder.indexOf(aSem) - semesterOrder.indexOf(bSem);
        });
    }, [allSemesterConfigurations]);

    const uniqueSemestersFromCourses = useMemo(() => {
        const semesters = [...new Set(coursesData.map(c => c.semester))];
        return semesters.sort((a, b) => {
            const semesterOrder = ['Spring', 'Summer', 'Fall'];
            const [aSem, aYear] = a.split(' ');
            const [bSem, bYear] = b.split(' ');
            if (aYear !== bYear) return (parseInt(bYear) || 0) - (parseInt(aYear) || 0);
            return semesterOrder.indexOf(aSem) - semesterOrder.indexOf(bSem);
        });
    }, [coursesData]);

    const effectiveDaysForGrid = useMemo(() => {
        if (activeProgramIdInSidebar) {
            const program = getProgramById(activeProgramIdInSidebar);
            if (program && program.activeDays && program.activeDays.length > 0) return program.activeDays;
        }
        return DAYS_OF_WEEK;
    }, [activeProgramIdInSidebar, getProgramById]);

    useEffect(() => {
      if (activeProgramIdInSidebar) {
          setRoutineViewMode('roomCentric');
      } else {
          setRoutineViewMode('dayCentric');
      }
    }, [activeProgramIdInSidebar]);
    
    useEffect(() => {
        let loadedConfigs: SemesterCloneInfo[] = [];
        const savedConfigs = localStorage.getItem('rbrms-semester-details');
        if (savedConfigs) {
          try {
            const parsed = JSON.parse(savedConfigs);
            if (Array.isArray(parsed)) loadedConfigs = parsed;
          } catch (e) { console.error("Failed to parse semester configurations from localStorage in App", e); }
        }

        const spring2025ConfigExists = loadedConfigs.some(c => c.targetSemester === 'Spring 2025');
        const initialUniqueSemesters = [...new Set(SAMPLE_ENROLLMENT_DATA.map(c => c.semester))];

        if (!spring2025ConfigExists && initialUniqueSemesters.includes('Spring 2025')) {
          const newSpring2025Config: SemesterCloneInfo = {
            targetSemester: 'Spring 2025', sourceSemester: 'Spring 2025',
            typeConfigs: SEMESTER_SYSTEMS.map((system, index) => {
              if (system === 'Tri-Semester') return { id: index, type: 'Tri-Semester' as SemesterSystem, startDate: '2025-01-01', endDate: '2025-04-30' };
              return { id: index, type: system, startDate: '', endDate: '' };
            }),
          };
          loadedConfigs.push(newSpring2025Config);
        }
        setAllSemesterConfigurations(loadedConfigs);

        const savedOverrides = localStorage.getItem('rbrms-schedule-overrides');
        if (savedOverrides) {
            try { setScheduleOverrides(JSON.parse(savedOverrides)); } catch (e) { console.error("Failed to parse schedule overrides from localStorage", e); }
        }
        
        const savedHistory = localStorage.getItem('rbrms-schedule-history');
        if (savedHistory) {
          try { setScheduleHistory(JSON.parse(savedHistory)); } catch (e) { console.error("Failed to parse schedule history from localStorage", e); }
        }
        
        const savedAttendanceLog = localStorage.getItem('rbrms-attendance-log');
        if (savedAttendanceLog) {
            try { setAttendanceLog(JSON.parse(savedAttendanceLog)); } 
            catch (e) { console.error("Failed to parse attendance log from localStorage", e); }
        }

        const savedPendingChanges = localStorage.getItem('rbrms-pending-changes');
        if (savedPendingChanges) {
            try { setPendingChanges(JSON.parse(savedPendingChanges)); } 
            catch (e) { console.error("Failed to parse pending changes from localStorage", e); }
        }

        const savedNotifications = localStorage.getItem('rbrms-notifications');
        if (savedNotifications) {
            try { setNotifications(JSON.parse(savedNotifications)); } 
            catch (e) { console.error("Failed to parse notifications from localStorage", e); }
        }

        const savedRoutine = localStorage.getItem('rbrms-routine-data');
        if (savedRoutine) {
            try {
                const parsedData = JSON.parse(savedRoutine);
                const firstKey = Object.keys(parsedData)[0];
                if (firstKey && parsedData[firstKey] && parsedData[firstKey].versions) {
                    setRoutineData(parsedData);
                } else {
                    const migratedData: { [key: string]: SemesterRoutineData } = {};
                    const isVeryOldFormat = firstKey && DAYS_OF_WEEK.includes(firstKey as DayOfWeek);
                    if (isVeryOldFormat) {
                        const versionId = `migrated-${Date.now()}`;
                        migratedData['Spring 2025'] = { versions: [{ versionId, createdAt: new Date().toISOString(), routine: parsedData }], activeVersionId: versionId };
                    } else {
                        Object.keys(parsedData).forEach(semesterId => {
                            const routine = parsedData[semesterId];
                            if (Object.keys(routine).length > 0) {
                                const versionId = `migrated-${Date.now()}-${semesterId}`;
                                migratedData[semesterId] = { versions: [{ versionId, createdAt: new Date().toISOString(), routine }], activeVersionId: versionId };
                            } else {
                                migratedData[semesterId] = { versions: [], activeVersionId: null };
                            }
                        });
                    }
                    setRoutineData(migratedData);
                }
            } catch (e) {
                const versionId = `seed-error-${Date.now()}`;
                setRoutineData({ 'Spring 2025': { versions: [{ versionId, createdAt: new Date().toISOString(), routine: SAMPLE_ROUTINE_DATA }], activeVersionId: versionId } });
            }
        } else {
            const versionId = `seed-${Date.now()}`;
            setRoutineData({ 'Spring 2025': { versions: [{ versionId, createdAt: new Date().toISOString(), routine: SAMPLE_ROUTINE_DATA }], activeVersionId: versionId } });
        }
    }, []); 

    useEffect(() => { if (!effectiveDaysForGrid.includes(selectedDay)) setSelectedDay(effectiveDaysForGrid[0] || initialDay); }, [effectiveDaysForGrid, selectedDay, initialDay]);
    useEffect(() => { if (allSemesterConfigurations.length > 0 || localStorage.getItem('rbrms-semester-details')) try { localStorage.setItem('rbrms-semester-details', JSON.stringify(allSemesterConfigurations)); } catch (e) { console.error("Failed to save semester configs", e); alert("Could not save semester configurations. Storage might be full."); } }, [allSemesterConfigurations]);
    useEffect(() => { if (Object.keys(scheduleOverrides).length > 0 || localStorage.getItem('rbrms-schedule-overrides') !== null) try { localStorage.setItem('rbrms-schedule-overrides', JSON.stringify(scheduleOverrides)); } catch (e) { console.error("Failed to save overrides", e); alert("Could not save schedule overrides. Storage might be full."); } }, [scheduleOverrides]);
    useEffect(() => { if (scheduleHistory.length > 0 || localStorage.getItem('rbrms-schedule-history') !== null) try { localStorage.setItem('rbrms-schedule-history', JSON.stringify(scheduleHistory)); } catch (e) { console.error("Failed to save history", e); alert("Could not save schedule history. Storage might be full."); } }, [scheduleHistory]);
    useEffect(() => { if (attendanceLog.length > 0 || localStorage.getItem('rbrms-attendance-log') !== null) try { localStorage.setItem('rbrms-attendance-log', JSON.stringify(attendanceLog)); } catch (e) { console.error("Failed to save attendance log", e); alert("Could not save attendance log. Storage might be full."); } }, [attendanceLog]);
    useEffect(() => { try { localStorage.setItem('rbrms-pending-changes', JSON.stringify(pendingChanges)); } catch(e) { console.error("Failed to save pending changes", e); } }, [pendingChanges]);
    useEffect(() => { if (notifications.length > 0 || localStorage.getItem('rbrms-notifications') !== null) try { localStorage.setItem('rbrms-notifications', JSON.stringify(notifications)); } catch (e) { console.error("Failed to save notifications", e); } }, [notifications]);
    useEffect(() => { if (Object.keys(routineData).length > 0) try { localStorage.setItem('rbrms-routine-data', JSON.stringify(routineData)); } catch (e) { console.error("Failed to save routine data", e); alert("Could not save routine data. Storage might be full."); } }, [routineData]);
    useEffect(() => { try { localStorage.setItem('rbrms-courses-data', JSON.stringify(coursesData)); } catch (e) { console.error("Failed to save courses data", e); alert("Could not save course data. Storage might be full."); } }, [coursesData]);
    useEffect(() => { setActualActiveAssignedFilter('Theory'); setActualActiveSharedFilter(null); }, [activeProgramIdInSidebar]);
    useEffect(() => { setSelectedLevelTermFilter(null); setSelectedTeacherIdFilter(null); }, [activeProgramIdInSidebar, selectedSemesterIdForRoutineView]);
    useEffect(() => { setSelectedSectionFilter(null); }, [selectedLevelTermFilter]);
    
    useEffect(() => {
        let openTimerId: number | undefined; let closeTimerId: number | undefined;
        if (activeOverlay) {
          setIsOverlayAnimating(true); setApplyOpenAnimationStyles(false); 
          openTimerId = window.setTimeout(() => setApplyOpenAnimationStyles(true), 10); 
        } else {
          setApplyOpenAnimationStyles(false); 
          closeTimerId = window.setTimeout(() => setIsOverlayAnimating(false), 300);
        }
        return () => { if (openTimerId) clearTimeout(openTimerId); if (closeTimerId) clearTimeout(closeTimerId); };
    }, [activeOverlay]);

    // --- Context-based Helpers ---
    const getBuildingNameFromApp = useCallback((bId: string) => allBuildings.find(b => b.id === bId)?.buildingName || 'N/A', [allBuildings]);
    const getBuildingAddressFromApp = useCallback((bId: string) => allBuildings.find(b => b.id === bId)?.address || 'N/A', [allBuildings]);
    const getFloorNameFromApp = useCallback((fId: string) => allFloors.find(f => f.id === fId)?.floorName || 'N/A', [allFloors]);
    const getCategoryNameFromApp = useCallback((cId: string) => allCategories.find(c => c.id === cId)?.categoryName || 'N/A', [allCategories]);
    const getTypeNameFromApp = useCallback((tId: string) => allRoomTypes.find(t => t.id === tId)?.typeName || 'N/A', [allRoomTypes]);
    const getProgramShortNameFromApp = useCallback((pId?: string) => allPrograms.find(p => p.pId === pId)?.shortName || 'N/A', [allPrograms]);
    const getProgramDisplayString = useCallback((pId?: string): string => { if (!pId) return 'N/A'; const program = allPrograms.find(p => p.pId === pId); if (!program) return `P-ID: ${pId}`; return `${program.pId} ${program.shortName}`; }, [allPrograms]);
    const addFloorFromApp = useCallback(async (name: string, buildingId: string): Promise<string | null> => { try { const newFloor = await addFloorContext({ floorName: name, buildingId }); return newFloor.id; } catch (e) { console.error("Failed to add floor from App:", e); throw e; } }, [addFloorContext]);
    const addCategoryFromApp = useCallback(async (name: string): Promise<string | null> => { try { const newCategory = await addCategoryContext({ categoryName: name }); return newCategory.id; } catch (e) { console.error("Failed to add category from App:", e); throw e; } }, [addCategoryContext]);
    const addTypeFromApp = useCallback(async (name: string): Promise<string | null> => { try { const newType = await addRoomTypeContext({ typeName: name }); return newType.id; } catch (e) { console.error("Failed to add type from App:", e); throw e; } }, [addRoomTypeContext]);
    
    // --- Handlers ---
    const handleAssignedFilterChange = useCallback((newFilter: RoomTypeFilter) => { setActualActiveAssignedFilter(newFilter); if (newFilter !== null) setActualActiveSharedFilter(null); }, []);
    const handleSharedFilterChange = useCallback((newFilter: RoomTypeFilter) => { setActualActiveSharedFilter(newFilter); if (newFilter !== null) setActualActiveAssignedFilter(null); }, []);
    const handleDayChange = useCallback((day: DayOfWeek) => { setSelectedDay(day); setSelectedDate(null); }, []);
    const handleDateChange = useCallback((dateString: string) => {
        if (!dateString) { setSelectedDate(null); return; }
        const [year, month, day] = dateString.split('-').map(Number);
        const date = new Date(year, month - 1, day); 
        const dayIndex = date.getDay(); 
        const jsDayMap: { [key: number]: DayOfWeek } = { 0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday' };
        const dayOfWeek = jsDayMap[dayIndex];
        if (dayOfWeek && effectiveDaysForGrid.includes(dayOfWeek)) setSelectedDay(dayOfWeek);
        setSelectedDate(dateString);
    }, [effectiveDaysForGrid]);

    const handleToggleRoutineViewMode = useCallback(() => {
        if (activeMainView !== 'routine') {
            setActiveMainView('routine');
            setRoutineViewMode('dayCentric');
        } else {
            setRoutineViewMode(prev => (prev === 'roomCentric' ? 'dayCentric' : 'roomCentric'));
        }
    }, [activeMainView]);
    
    const handleMainViewChange = useCallback((view: MainViewType) => {
        setActiveMainView(view);
        if (view !== 'buildingRooms') setSelectedBuildingIdForView(null);
        if (view !== 'programDetail') setSelectedProgramIdForDetailView(null);
        if (view !== 'semesterDetail') { setActiveSemesterDetailViewId(null); setProgramIdForSemesterFilter(null); }
        if (view !== 'userDetail') setSelectedUserIdForDetailView(null);
    }, []);
    
    const handleShowCourseList = useCallback(() => setActiveMainView('courseList'), []);
    const handleShowRoomList = useCallback(() => setActiveMainView('roomList'), []);
    const handleShowTeacherList = useCallback(() => setActiveMainView('teacherList'), []);
    const handleShowSectionList = useCallback(() => { setInitialSectionListFilters(null); setActiveMainView('sectionList'); }, []);
    
    const closeOverlay = useCallback(() => {
        if (activeMainView !== 'routine') {
            setActiveMainView('routine');
            setSelectedBuildingIdForView(null);
            setSelectedProgramIdForDetailView(null);
            setActiveSemesterDetailViewId(null);
            setSelectedUserIdForDetailView(null);
        }
        setActiveOverlay(null);
        setActiveSettingsSection(null);
        setStagedCourseUpdates({});
    }, [activeMainView]);

    const handleOverlayToggle = useCallback((overlay: OverlayViewType) => {
        if (activeOverlay === overlay) closeOverlay();
        else { setStagedCourseUpdates({}); setActiveOverlay(overlay); }
    }, [activeOverlay, closeOverlay]);

    const handleShowBuildingRooms = useCallback((buildingId: string | null) => {
        if (activeMainView === 'buildingRooms' && selectedBuildingIdForView === buildingId) { setActiveMainView('routine'); setSelectedBuildingIdForView(null); } 
        else { setActiveMainView('buildingRooms'); setSelectedBuildingIdForView(buildingId); setSelectedProgramIdForDetailView(null); setSelectedUserIdForDetailView(null); setActiveSemesterDetailViewId(null); }
    }, [activeMainView, selectedBuildingIdForView]);

    const handleShowProgramDetail = useCallback((programId: string) => {
        if (activeMainView === 'programDetail' && selectedProgramIdForDetailView === programId) return;
        setActiveMainView('programDetail'); setSelectedProgramIdForDetailView(programId); setSelectedBuildingIdForView(null); setSelectedUserIdForDetailView(null); setActiveSemesterDetailViewId(null);
    }, [activeMainView, selectedProgramIdForDetailView]);

    const handleShowSemesterDetail = useCallback((semesterId: string) => {
        if (activeMainView === 'semesterDetail' && activeSemesterDetailViewId === semesterId) { setActiveMainView('routine'); setActiveSemesterDetailViewId(null); }
        else { setActiveMainView('semesterDetail'); setActiveSemesterDetailViewId(semesterId); setSelectedProgramIdForDetailView(null); setSelectedUserIdForDetailView(null); setSelectedBuildingIdForView(null); }
    }, [activeMainView, activeSemesterDetailViewId]);

    const handleShowSectionListWithFilters = useCallback((filters: { pId: string; category: string; credit: number; }, keepOverlayOpen: boolean = false) => {
        setInitialSectionListFilters(filters);
        setActiveMainView('sectionList');
        if (!keepOverlayOpen) { setActiveOverlay(null); setStagedCourseUpdates({}); }
    }, []);

    const handleShowUserDetail = useCallback((userId: string) => {
        setActiveMainView('userDetail'); setSelectedUserIdForDetailView(userId);
        setSelectedBuildingIdForView(null); setSelectedProgramIdForDetailView(null); setActiveSemesterDetailViewId(null);
    }, []);
    
    const handleCloseSemesterDetail = useCallback(() => { setActiveMainView('routine'); setActiveSemesterDetailViewId(null); setActiveSettingsSection(null); }, []);
    const handleCloseProgramDetail = useCallback(() => { setActiveMainView('routine'); setSelectedProgramIdForDetailView(null); setActiveSettingsSection(null); }, []);

    const handleCloseLogAttendanceModal = useCallback(() => {
        setIsLogAttendanceModalOpen(false);
        setLogDataForModal(null);
    }, []);
    
    const handleOpenLogAttendanceModal = useCallback((logTemplate: Omit<AttendanceLogEntry, 'id' | 'timestamp' | 'status' | 'makeupInfo'>) => {
        const completeTemplate = {
            ...logTemplate,
            semester: selectedSemesterIdForRoutineView,
        };
        setLogDataForModal(completeTemplate);
        setIsLogAttendanceModalOpen(true);
    }, [selectedSemesterIdForRoutineView]);

    const handleOpenEditAttendanceLog = useCallback((logToEdit: AttendanceLogEntry) => {
        setLogDataForModal(logToEdit);
        setIsLogAttendanceModalOpen(true);
    }, []);

    const handleSaveAttendanceLog = useCallback((dataToSave: Partial<AttendanceLogEntry>) => {
        setScheduleOverrides(prevOverrides => {
            const newOverrides = JSON.parse(JSON.stringify(prevOverrides));
            let hasChanges = false;
    
            if (dataToSave.id) {
                const originalLog = attendanceLog.find(l => l.id === dataToSave.id);
                if (originalLog && originalLog.makeupInfo) {
                    const oldInfo = originalLog.makeupInfo;
                    const newInfo = dataToSave.makeupInfo;
                    const makeupChanged = !newInfo || oldInfo.date !== newInfo.date || oldInfo.timeSlot !== newInfo.timeSlot || oldInfo.roomNumber !== newInfo.roomNumber;
                    
                    if (makeupChanged && newOverrides[oldInfo.roomNumber]?.[oldInfo.timeSlot]?.[oldInfo.date]) {
                        delete newOverrides[oldInfo.roomNumber][oldInfo.timeSlot][oldInfo.date];
                        if (Object.keys(newOverrides[oldInfo.roomNumber][oldInfo.timeSlot]).length === 0) delete newOverrides[oldInfo.roomNumber][oldInfo.timeSlot];
                        if (Object.keys(newOverrides[oldInfo.roomNumber]).length === 0) delete newOverrides[oldInfo.roomNumber];
                        hasChanges = true;
                    }
                }
            }
    
            if (dataToSave.makeupInfo) {
                const { date, timeSlot, roomNumber } = dataToSave.makeupInfo;
                const courseForMakeup = coursesData.find(c => 
                    c.courseCode === dataToSave.courseCode &&
                    c.section === dataToSave.section &&
                    c.semester === dataToSave.semester
                );
    
                if (courseForMakeup) {
                    const classDetailForMakeup = generateClassDetailFromEnrollment(courseForMakeup);
                    if (!newOverrides[roomNumber]) newOverrides[roomNumber] = {};
                    if (!newOverrides[roomNumber][timeSlot]) newOverrides[roomNumber][timeSlot] = {};
                    newOverrides[roomNumber][timeSlot][date] = classDetailForMakeup;
                    hasChanges = true;
                }
            }
            
            return hasChanges ? newOverrides : prevOverrides;
        });
    
        if (dataToSave.id) {
            setAttendanceLog(prev => prev.map(entry => entry.id === dataToSave.id ? { ...entry, ...dataToSave } as AttendanceLogEntry : entry).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
        } else {
            const isDuplicate = attendanceLog.some(entry => 
                entry.date === dataToSave.date &&
                entry.timeSlot === dataToSave.timeSlot &&
                entry.roomNumber === dataToSave.roomNumber &&
                entry.courseCode === dataToSave.courseCode
            );

            if (isDuplicate) {
                alert("An attendance log entry for this class, at this specific time and location, already exists. Duplicate entry was not added.");
                handleCloseLogAttendanceModal();
                return;
            }

             const newEntry: AttendanceLogEntry = {
                ...dataToSave,
                id: `att-${Date.now()}-${Math.random().toString(16).substring(2)}`,
                timestamp: new Date().toISOString(),
            } as AttendanceLogEntry;
            setAttendanceLog(prev => [newEntry, ...prev].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
        }
        
        handleCloseLogAttendanceModal();
    }, [attendanceLog, coursesData, handleCloseLogAttendanceModal]);
    
    const handleDeleteAttendanceLogEntry = useCallback((logId: string) => {
        if (window.confirm('Are you sure you want to permanently delete this log entry? This action cannot be undone.')) {
            const logToDelete = attendanceLog.find(l => l.id === logId);
            if (logToDelete && logToDelete.makeupInfo) {
                const { date, timeSlot, roomNumber } = logToDelete.makeupInfo;
                setScheduleOverrides(prev => {
                    const newOverrides = JSON.parse(JSON.stringify(prev));
                    if (newOverrides[roomNumber]?.[timeSlot]?.[date]) {
                         delete newOverrides[roomNumber][timeSlot][date];
                        if (Object.keys(newOverrides[roomNumber][timeSlot]).length === 0) delete newOverrides[roomNumber][timeSlot];
                        if (Object.keys(newOverrides[roomNumber]).length === 0) delete newOverrides[roomNumber];
                    }
                    return newOverrides;
                });
            }
            setAttendanceLog(prevLog => prevLog.filter(entry => entry.id !== logId));
        }
    }, [attendanceLog]);

    const handleClearAttendanceLog = useCallback(() => {
        if (window.confirm('Are you sure you want to clear the entire attendance log? This will also remove ALL scheduled make-up classes from the routine. This action is permanent and cannot be undone.')) {
            setAttendanceLog([]);
            const newOverrides = { ...scheduleOverrides };
            let overridesRemoved = false;
            attendanceLog.forEach(log => {
                if (log.makeupInfo) {
                    const { date, timeSlot, roomNumber } = log.makeupInfo;
                    if (newOverrides[roomNumber]?.[timeSlot]?.[date]) {
                        delete newOverrides[roomNumber][timeSlot][date];
                         if (Object.keys(newOverrides[roomNumber][timeSlot]).length === 0) delete newOverrides[roomNumber][timeSlot];
                        if (Object.keys(newOverrides[roomNumber]).length === 0) delete newOverrides[roomNumber];
                        overridesRemoved = true;
                    }
                }
            });
            if(overridesRemoved) setScheduleOverrides(newOverrides);
        }
    }, [attendanceLog, scheduleOverrides]);
    
    const handleToggleMakeupStatus = useCallback((logId: string) => {
        setAttendanceLog(prevLog =>
            prevLog.map(entry =>
                entry.id === logId
                    ? { ...entry, makeupCompleted: !entry.makeupCompleted }
                    : entry
            )
        );
    }, []);

    const handleShowAttendanceLog = useCallback(() => {
        setActiveMainView('attendanceLog');
    }, []);

    const handleUpdateDefaultRoutine = useCallback((day: DayOfWeek, roomNumber: string, slotString: string, newClass: ClassDetail | null, semesterId: string) => {
        if (!user) return;
        const canApprove = user.role === 'admin' || user.notificationAccess?.canApproveSlots;
    
        if (canApprove) {
            const activeVersion = routineData[semesterId]?.versions.find(v => v.versionId === routineData[semesterId].activeVersionId);
            const fromClass = activeVersion?.routine[day]?.[roomNumber]?.[slotString] || null;

            if (JSON.stringify(fromClass) !== JSON.stringify(newClass)) {
                const newHistoryEntry: ScheduleLogEntry = {
                    logId: `log-${Date.now()}-${Math.random()}`,
                    timestamp: new Date().toISOString(),
                    userId: user.id, userName: user.name, userAvatar: user.avatar,
                    roomNumber, slotString, semesterId, day, isOverride: false,
                    from: fromClass,
                    to: newClass,
                };
                setScheduleHistory(prev => [newHistoryEntry, ...prev]);
            }

            setRoutineData(prevData => {
                const newData = JSON.parse(JSON.stringify(prevData));
                if (!newData[semesterId]) newData[semesterId] = { versions: [], activeVersionId: null };
                
                const semesterData = newData[semesterId];
                const currentActiveVersion = semesterData.versions.find(v => v.versionId === semesterData.activeVersionId);
    
                if (currentActiveVersion) {
                    const newRoutine = currentActiveVersion.routine;
                    if (!newRoutine[day]) newRoutine[day] = {};
                    if (!newRoutine[day][roomNumber]) newRoutine[day][roomNumber] = {};
    
                    if (newClass) {
                        newRoutine[day][roomNumber][slotString] = newClass;
                    } else if (newRoutine[day]?.[roomNumber]?.[slotString]) {
                        delete newRoutine[day][roomNumber][slotString];
                    }
    
                    if (Object.keys(newRoutine[day][roomNumber]).length === 0) delete newRoutine[day][roomNumber];
                    if (Object.keys(newRoutine[day]).length === 0) delete newRoutine[day];
                }
                return newData;
            });
        } else {
            const newPendingChange: PendingChange = {
                id: `pc-${Date.now()}`,
                requesterId: user.id,
                requesterName: user.name,
                timestamp: new Date().toISOString(),
                requestedClassInfo: newClass,
                semesterId,
                roomNumber,
                slotString,
                isBulkUpdate: true,
                day,
            };
            setPendingChanges(prev => [...prev, newPendingChange]);
        }
    }, [user, routineData]);

    const handleUpdateScheduleOverrides = useCallback((roomNumber: string, slotString: string, newAssignments: Record<string, ClassDetail | null>, defaultClassForSlot: ClassDetail | undefined) => {
        if (!user || !selectedSemesterIdForRoutineView) return;
        const canApprove = user.role === 'admin' || user.notificationAccess?.canApproveSlots;

        if (canApprove) {
            const previousSlotOverrides = scheduleOverrides[roomNumber]?.[slotString] || {};
            const newHistoryEntries: ScheduleLogEntry[] = [];
            const allDatesInvolved = new Set([...Object.keys(previousSlotOverrides), ...Object.keys(newAssignments)]);
    
            allDatesInvolved.forEach(dateISO => {
                const day = getDayOfWeekFromISO(dateISO);
                if (!day) return;
                const fromState = (previousSlotOverrides[dateISO] !== undefined) ? previousSlotOverrides[dateISO] : (defaultClassForSlot || null);
                const toState = (newAssignments[dateISO] !== undefined) ? newAssignments[dateISO] : (defaultClassForSlot || null);
                if (JSON.stringify(fromState) !== JSON.stringify(toState)) {
                    newHistoryEntries.push({
                        logId: `log-${Date.now()}-${Math.random()}`,
                        timestamp: new Date().toISOString(),
                        userId: user.id, userName: user.name, userAvatar: user.avatar,
                        roomNumber, slotString,
                        semesterId: selectedSemesterIdForRoutineView!,
                        day: day,
                        isOverride: true,
                        dateISO,
                        from: fromState,
                        to: toState
                    });
                }
            });
            
            if (newHistoryEntries.length > 0) setScheduleHistory(prev => [...newHistoryEntries, ...prev]);
            
            setScheduleOverrides(prev => {
                const newOverrides = JSON.parse(JSON.stringify(prev));
                const slotOverrides = { ...(newOverrides[roomNumber]?.[slotString] || {}), ...newAssignments };
                Object.keys(slotOverrides).forEach(dateISO => {
                    if (JSON.stringify(slotOverrides[dateISO]) === JSON.stringify(defaultClassForSlot)) delete slotOverrides[dateISO];
                });
                if (Object.keys(slotOverrides).length > 0) {
                    if (!newOverrides[roomNumber]) newOverrides[roomNumber] = {};
                    newOverrides[roomNumber][slotString] = slotOverrides;
                } else if (newOverrides[roomNumber]?.[slotString]) {
                    delete newOverrides[roomNumber][slotString];
                    if (Object.keys(newOverrides[roomNumber]).length === 0) delete newOverrides[roomNumber];
                }
                return newOverrides;
            });
        } else {
            const assignmentsByClass = new Map<string, { classInfo: ClassDetail | null, dates: string[] }>();
            for (const dateISO in newAssignments) {
                const classInfo = newAssignments[dateISO];
                const classKey = JSON.stringify(classInfo);
                if (!assignmentsByClass.has(classKey)) {
                    assignmentsByClass.set(classKey, { classInfo, dates: [] });
                }
                assignmentsByClass.get(classKey)!.dates.push(dateISO);
            }
            
            const newPendingChanges: PendingChange[] = [];
            for (const data of assignmentsByClass.values()) {
                const firstDate = data.dates[0];
                const dayOfWeek = getDayOfWeekFromISO(firstDate);
                if (dayOfWeek) {
                    newPendingChanges.push({
                        id: `pc-${Date.now()}-${Math.random()}`,
                        requesterId: user.id,
                        requesterName: user.name,
                        timestamp: new Date().toISOString(),
                        requestedClassInfo: data.classInfo,
                        semesterId: selectedSemesterIdForRoutineView,
                        roomNumber,
                        slotString,
                        isBulkUpdate: false,
                        day: dayOfWeek,
                        dates: data.dates,
                    });
                }
            }
            setPendingChanges(prev => [...prev, ...newPendingChanges]);
        }
    }, [scheduleOverrides, user, selectedSemesterIdForRoutineView]);

    const markNotificationAsRead = useCallback((notificationId: string) => {
        setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n));
    }, []);

    const markAllNotificationsAsRead = useCallback(() => {
        if (!user) return;
        setNotifications(prev => prev.map(n => n.userId === user.id ? { ...n, isRead: true } : n));
    }, [user]);

    const unreadNotificationCount = useMemo(() => {
        if (!user) return 0;
        return notifications.filter(n => n.userId === user.id && !n.isRead).length;
    }, [notifications, user]);

    const handleApproveChange = useCallback((changeId: string) => {
        const change = pendingChanges.find(c => c.id === changeId);
        if (!change) return;

        if (change.isBulkUpdate) {
            handleUpdateDefaultRoutine(change.day, change.roomNumber, change.slotString, change.requestedClassInfo, change.semesterId);
        } else {
            if (change.dates) {
                const newAssignments: Record<string, ClassDetail | null> = {};
                const existingOverridesForSlot = scheduleOverrides[change.roomNumber]?.[change.slotString] || {};
                
                change.dates.forEach(dateISO => {
                    newAssignments[dateISO] = change.requestedClassInfo;
                });

                const semesterData = routineData[change.semesterId];
                const activeVersion = semesterData?.versions.find(v => v.versionId === semesterData.activeVersionId);
                const defaultClassForSlot = activeVersion?.routine[change.day]?.[change.roomNumber]?.[change.slotString];
                
                handleUpdateScheduleOverrides(change.roomNumber, change.slotString, {...existingOverridesForSlot, ...newAssignments}, defaultClassForSlot);
            }
        }
        
        const newNotification: Notification = {
            id: `notif-approve-${Date.now()}`,
            timestamp: new Date().toISOString(),
            userId: change.requesterId,
            type: 'approval',
            title: 'Request Approved',
            message: `Your request to ${change.requestedClassInfo ? `assign ${change.requestedClassInfo.courseCode}` : 'clear the slot'} for Room ${change.roomNumber} on ${change.isBulkUpdate ? change.day : change.dates?.join(', ')} has been approved.`,
            isRead: false,
            relatedChangeId: changeId,
        };
        setNotifications(prev => [newNotification, ...prev]);

        setPendingChanges(prev => prev.filter(c => c.id !== changeId));
    }, [pendingChanges, handleUpdateDefaultRoutine, handleUpdateScheduleOverrides, scheduleOverrides, routineData]);

    const handleRejectChange = useCallback((changeId: string) => {
        const change = pendingChanges.find(c => c.id === changeId);
        if (!change) return;
        
        const newNotification: Notification = {
            id: `notif-reject-${Date.now()}`,
            timestamp: new Date().toISOString(),
            userId: change.requesterId,
            type: 'rejection',
            title: 'Request Rejected',
            message: `Your request for Room ${change.roomNumber} on ${change.isBulkUpdate ? change.day : change.dates?.join(', ')} has been rejected.`,
            isRead: false,
            relatedChangeId: changeId,
        };
        setNotifications(prev => [newNotification, ...prev]);

        setPendingChanges(prev => prev.filter(c => c.id !== changeId));
    }, [pendingChanges]);

    const handleMoveRoutineEntry = useCallback((
      source: { day: DayOfWeek; roomNumber: string; slotString: string },
      target: { day: DayOfWeek; roomNumber: string; slotString: string },
      sourceClassInfo: ClassDetail,
      semesterId: string
    ) => {
        if (!semesterId || !user) return;

        if (user.role !== 'admin') {
            const programPId = sourceClassInfo.pId;
            const userHasAccess = user.accessibleProgramPIds?.includes(programPId!);

            if (!programPId || !userHasAccess) {
                alert("You do not have permission to move classes for this program.");
                return;
            }
        }

        const sourceRoom = allRooms.find(r => r.roomNumber === source.roomNumber && r.semesterId === semesterId);
        const targetRoom = allRooms.find(r => r.roomNumber === target.roomNumber && r.semesterId === semesterId);

        if (!sourceRoom || !targetRoom) {
            alert("Error: Source or target room could not be found.");
            return;
        }

        const activeVersion = routineData[semesterId]?.versions.find(v => v.versionId === routineData[semesterId].activeVersionId);
        if (!activeVersion) return;
        const targetClassInfo = activeVersion.routine[target.day]?.[target.roomNumber]?.[target.slotString] || null;

        if (targetClassInfo) {
            alert("Swapping classes via drag-and-drop requires direct permission for both slots. Please ensure the target slot is empty if you need to request approval.");
            return;
        }

        const hasPermissionForRoom = (room: RoomEntry) => {
            if (user.role === 'admin') return true;
            const roomProgramPId = room.assignedToPId;
            if (!roomProgramPId) {
                return user.bulkAssignAccess !== 'none';
            }
            return user.notificationAccess?.canApproveSlots && (user.accessibleProgramPIds || []).includes(roomProgramPId);
        };

        const canDirectlyEditSource = hasPermissionForRoom(sourceRoom);
        const canDirectlyEditTarget = hasPermissionForRoom(targetRoom);

        if (canDirectlyEditSource && canDirectlyEditTarget) {
            const commonHistoryProps = {
                timestamp: new Date().toISOString(),
                userId: user.id, userName: user.name, userAvatar: user.avatar,
                semesterId, isOverride: false,
            };
            const newHistoryEntries: ScheduleLogEntry[] = [
                { ...commonHistoryProps, logId: `log-move-${Date.now()}-1`, ...source, day: source.day, from: sourceClassInfo, to: null },
                { ...commonHistoryProps, logId: `log-move-${Date.now()}-2`, ...target, day: target.day, from: null, to: sourceClassInfo }
            ];
            setScheduleHistory(prev => [...newHistoryEntries, ...prev]);

            setRoutineData(prevData => {
                const newData = JSON.parse(JSON.stringify(prevData));
                const semesterData = newData[semesterId];
                if (!semesterData) return prevData;
                
                const currentActiveVersion = semesterData.versions.find(v => v.versionId === semesterData.activeVersionId);
                if (!currentActiveVersion) return prevData;

                const newRoutine = currentActiveVersion.routine;
                if (!newRoutine[target.day]) newRoutine[target.day] = {};
                if (!newRoutine[target.day][target.roomNumber]) newRoutine[target.day][target.roomNumber] = {};
                newRoutine[target.day][target.roomNumber][target.slotString] = sourceClassInfo;

                if (newRoutine[source.day]?.[source.roomNumber]?.[source.slotString]) {
                    delete newRoutine[source.day][source.roomNumber][source.slotString];
                    if (Object.keys(newRoutine[source.day][source.roomNumber]).length === 0) delete newRoutine[source.day][source.roomNumber];
                    if (Object.keys(newRoutine[source.day]).length === 0) delete newRoutine[source.day];
                }
                return newData;
            });
        } else {
            const request: PendingChange = {
                id: `pc-move-${Date.now()}`,
                requesterId: user.id,
                requesterName: user.name,
                timestamp: new Date().toISOString(),
                requestedClassInfo: sourceClassInfo, // The class being moved
                semesterId: semesterId,
                // Target props
                roomNumber: target.roomNumber,
                slotString: target.slotString,
                day: target.day,
                // Source props
                source: {
                    roomNumber: source.roomNumber,
                    slotString: source.slotString,
                    day: source.day,
                },
                isBulkUpdate: true, // This is a default routine change
            };
            
            setPendingChanges(prev => [...prev, request]);
            alert("Your request to move the class has been submitted for approval.");
        }
    }, [user, allRooms, routineData, setPendingChanges, setScheduleHistory]);

    const handleAssignSectionToSlot = useCallback((
        sectionId: string,
        target: { day: DayOfWeek; roomNumber: string; slotString: string },
        semesterId: string
    ) => {
        const courseToAssign = coursesData.find(c => c.sectionId === sectionId && c.semester === semesterId);
    
        if (!courseToAssign) {
            console.error(`Could not find course with sectionId: ${sectionId} in semester: ${semesterId}`);
            return;
        }
    
        const newClassDetail = generateClassDetailFromEnrollment(courseToAssign);
        handleUpdateDefaultRoutine(target.day, target.roomNumber, target.slotString, newClassDetail, semesterId);
    }, [coursesData, handleUpdateDefaultRoutine]);

    const handleUpdateCourseLevelTerm = useCallback((sectionId: string, newLevelTerm: string) => {
        const changedCourseTemplate = coursesData.find(c => c.sectionId === sectionId);
        if (!changedCourseTemplate) return;
        const { pId, courseCode, courseTitle, credit, type, semester } = changedCourseTemplate;
        const sectionsToUpdate = new Set<string>();
        coursesData.forEach(c => { if (c.pId === pId && c.courseCode === courseCode && c.courseTitle === courseTitle && c.credit === credit && c.type === type) sectionsToUpdate.add(c.section); });
        setCoursesData(prev => prev.map(c => sectionsToUpdate.has(c.section) && c.courseCode === courseCode && c.pId === pId ? { ...c, levelTerm: newLevelTerm } : c));
        const newColor = getLevelTermColor(newLevelTerm);
        setRoutineData(prev => {
            const newData = JSON.parse(JSON.stringify(prev));
            const semesterData = newData[semester];
            if (!semesterData) return prev;
            
            semesterData.versions.forEach(version => {
                const semesterRoutine = version.routine;
                if (semesterRoutine) {
                    for (const day of Object.keys(semesterRoutine)) {
                        for (const room of Object.keys(semesterRoutine[day] as DailyRoutineData)) {
                            for (const slot of Object.keys(semesterRoutine[day][room])) {
                                const classInfo: ClassDetail | undefined = semesterRoutine[day][room][slot];
                                if (classInfo && classInfo.courseCode === courseCode && sectionsToUpdate.has(classInfo.section)) {
                                    semesterRoutine[day][room][slot].levelTerm = newLevelTerm;
                                    semesterRoutine[day][room][slot].color = newColor;
                                }
                            }
                        }
                    }
                }
            });
            return newData;
        });
    }, [coursesData]);

    const handleUpdateWeeklyClass = useCallback((sectionId: string, newWeeklyClass: number | undefined) => {
        setCoursesData(prevCourses => {
            const changedCourse = prevCourses.find(c => c.sectionId === sectionId);
            if (!changedCourse) return prevCourses;
            const { pId, credit, type } = changedCourse;
            return prevCourses.map(course => (course.pId === pId && course.credit === credit && course.type === type) ? { ...course, weeklyClass: newWeeklyClass } : course);
        });
    }, [setCoursesData]);

    const handleUpdateCourseType = useCallback((sectionId: string, newCourseType: CourseType) => {
        setCoursesData(prevCourses => {
            const changedCourse = prevCourses.find(c => c.sectionId === sectionId);
            if (!changedCourse) return prevCourses;
            const { pId, credit, type } = changedCourse;
            return prevCourses.map(course => (course.pId === pId && course.credit === credit && course.type === type) ? { ...course, courseType: newCourseType } : course);
        });
    }, [setCoursesData]);

    const handleSaveCourseMetadata = useCallback((updates: { pId: string; category: string; credit: number; courseType?: CourseType; weeklyClass?: number | undefined }[]) => {
        setCoursesData(prevCourses => {
            let newCourses = [...prevCourses];
            updates.forEach(update => {
                newCourses = newCourses.map(course => {
                    if (course.pId === update.pId && course.type === update.category && course.credit === update.credit) {
                        const updatedCourse = { ...course };
                        if (update.courseType !== undefined) updatedCourse.courseType = update.courseType;
                        if ('weeklyClass' in update) updatedCourse.weeklyClass = update.weeklyClass;
                        return updatedCourse;
                    }
                    return course;
                });
            });
            return newCourses;
        });
        setStagedCourseUpdates({});
    }, []);
    
    const handleClearStagedCourseUpdates = useCallback(() => setStagedCourseUpdates({}), []);

    const handleMergeSections = useCallback((sourceSectionId: string, targetSectionId: string) => {
        setCoursesData(prevData => {
            const sourceCourseIndex = prevData.findIndex(c => c.sectionId === sourceSectionId);
            if (sourceCourseIndex === -1) {
                console.warn(`Merge failed: Source section ${sourceSectionId} not found.`);
                return prevData;
            }
            const targetCourse = prevData.find(c => c.sectionId === targetSectionId);
            if (!targetCourse) {
                console.warn(`Merge failed: Target section ${targetSectionId} not found.`);
                return prevData;
            }
            if (targetCourse.mergedWithSectionId) {
                console.warn(`Merge failed: Target section ${targetSectionId} is already a merged section.`);
                return prevData;
            }
            const newCourses = [...prevData];
            newCourses[sourceCourseIndex] = { ...newCourses[sourceCourseIndex], mergedWithSectionId: targetSectionId };
            return newCourses;
        });
    }, []);

    const handleUnmergeSection = useCallback((sectionIdToUnmerge: string) => {
        setCoursesData(prevData => {
            const courseIndex = prevData.findIndex(c => c.sectionId === sectionIdToUnmerge);
            if (courseIndex === -1) {
                console.warn(`Unmerge failed: Section ${sectionIdToUnmerge} not found.`);
                return prevData;
            }
            const newCourses = [...prevData];
            const { mergedWithSectionId, ...unmergedCourse } = newCourses[courseIndex];
            newCourses[courseIndex] = unmergedCourse;
            return newCourses;
        });
    }, []);

    const handleCloneRooms = useCallback(async (sourceSemesterId: string, targetSemesterId: string) => {
        if (!addRoom) throw new Error("Room cloning service is unavailable.");
        const roomsToClone = allRooms.filter(r => r.semesterId === sourceSemesterId);
        const clonePromises = roomsToClone.map(roomToClone => {
            const newRoomData: Omit<RoomEntry, 'id'> = { ...roomToClone, semesterId: targetSemesterId, roomSpecificSlots: roomToClone.roomSpecificSlots ? roomToClone.roomSpecificSlots.map(slot => ({ ...slot, id: `cloned-slot-${Date.now()}-${Math.random().toString(16).substring(2)}` })) : [] };
            return addRoom(newRoomData);
        });
        await Promise.all(clonePromises);
    }, [allRooms, addRoom]);

    const activeRoutinesBySemester = useMemo(() => {
        const result: { [semesterId: string]: FullRoutineData } = {};
        for (const semesterId in routineData) {
            const semesterData = routineData[semesterId];
            if (semesterData && semesterData.activeVersionId) {
                const activeVersion = semesterData.versions.find(v => v.versionId === semesterData.activeVersionId);
                result[semesterId] = activeVersion ? activeVersion.routine : {};
            } else {
                result[semesterId] = {};
            }
        }
        return result;
    }, [routineData]);

    const handlePreviewLevelTermRoutine = useCallback(() => {
        if (!selectedLevelTermFilter || selectedLevelTermFilter === 'N/A') {
            alert("Please select a valid Level-Term to generate a routine.");
            return;
        }
        if (!selectedSemesterIdForRoutineView) {
            alert("Please select a semester.");
            return;
        }
    
        generateLevelTermRoutinePDF({
            levelTerm: selectedLevelTermFilter,
            section: selectedSectionFilter,
            semesterId: selectedSemesterIdForRoutineView,
            programId: activeProgramIdInSidebar,
            routineData: activeRoutinesBySemester,
            allPrograms,
            systemDefaultTimeSlots,
            coursesData
        });
    }, [selectedLevelTermFilter, selectedSectionFilter, selectedSemesterIdForRoutineView, activeProgramIdInSidebar, activeRoutinesBySemester, allPrograms, systemDefaultTimeSlots, coursesData]);

    const handlePreviewFullRoutine = useCallback(() => {
        if (!activeProgramIdInSidebar || !selectedSemesterIdForRoutineView) {
            alert("Please select a program and a semester first.");
            return;
        }
        const semesterRoutineData = routineData[selectedSemesterIdForRoutineView]?.versions.find(v => v.versionId === routineData[selectedSemesterIdForRoutineView].activeVersionId)?.routine || {};
        generateFullRoutinePDF({
            programId: activeProgramIdInSidebar,
            semesterId: selectedSemesterIdForRoutineView,
            routineData: semesterRoutineData,
            allPrograms,
            allRooms,
            allRoomTypes,
            systemDefaultTimeSlots,
            getBuildingName: getBuildingNameFromApp,
        });
    }, [activeProgramIdInSidebar, selectedSemesterIdForRoutineView, routineData, allPrograms, allRooms, allRoomTypes, systemDefaultTimeSlots, getBuildingNameFromApp]);
    
    const handlePreviewCourseSectionRoutine = useCallback(() => {
        if (!selectedSemesterIdForRoutineView) {
            alert("Please select a semester.");
            return;
        }
        if (selectedCourseSectionIdsFilter.length === 0) {
            alert("Please select at least one course section to generate a routine.");
            return;
        }

        generateCourseSectionRoutinePDF({
            sectionIds: selectedCourseSectionIdsFilter,
            semesterId: selectedSemesterIdForRoutineView,
            programId: activeProgramIdInSidebar,
            routineData: activeRoutinesBySemester,
            coursesData,
            allPrograms,
            systemDefaultTimeSlots,
        });
    }, [
        selectedCourseSectionIdsFilter,
        selectedSemesterIdForRoutineView,
        activeProgramIdInSidebar,
        activeRoutinesBySemester,
        coursesData,
        allPrograms,
        systemDefaultTimeSlots,
    ]);

    const getAllFutureDatesForDay = useCallback((day: DayOfWeek, semesterId: string, program: ProgramEntry): string[] => {
        const semesterConfig = allSemesterConfigurations.find(c => c.targetSemester === semesterId);
        if (!semesterConfig) return [];

        const systemType = program.semesterSystem;
        const typeConfig = semesterConfig.typeConfigs.find(tc => tc.type === systemType);
        if (!typeConfig || !typeConfig.startDate || !typeConfig.endDate) return [];

        const { startDate, endDate } = typeConfig;

        const semesterStartDate = new Date(startDate + 'T00:00:00Z');
        const semesterEndDate = new Date(endDate + 'T00:00:00Z');
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);

        let effectiveStartDate = semesterStartDate > today ? semesterStartDate : today;

        const dates: string[] = [];
        const jsDayMap: { [key in DayOfWeek]: number } = { 'Saturday': 6, 'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5 };
        const targetJsDay = jsDayMap[day];
        if (targetJsDay === undefined) return [];

        let currentDate = new Date(effectiveStartDate.getTime());
        
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
    }, [allSemesterConfigurations]);

    const routineDataForGrid = useMemo(() => {
        if (!selectedSemesterIdForRoutineView) return {};
        const semesterData = routineData[selectedSemesterIdForRoutineView];
        if (!semesterData || !semesterData.activeVersionId) return {};
        const activeVersion = semesterData.versions.find(v => v.versionId === semesterData.activeVersionId);
        return activeVersion ? activeVersion.routine : {};
    }, [routineData, selectedSemesterIdForRoutineView]);

    const { effectiveHeaderSlotsForGrid, effectiveRoomEntriesForGrid, programHasSlotsForMessage, programNameToDisplay, gridMessageTitle, gridMessageDetails } = useMemo(() => {
        let slotsForGridObjects: DefaultTimeSlot[] = [];
        let roomsForGrid: RoomEntry[] = [];
        let calculatedProgramHasSlots = true; 
        let displayName: string | null = null;
        let titleMsg = `No Routine for ${selectedDay}`; let detailMsg = "Check data.";
        const activeGridSlotTypeFilter = actualActiveAssignedFilter || actualActiveSharedFilter;

        if (!activeProgramIdInSidebar) {
            displayName = null; calculatedProgramHasSlots = true;
            const eligibleRoomIds = new Set<string>();
            
            if (actualActiveAssignedFilter) {
                allRooms.forEach(room => {
                    if (room.assignedToPId && accessibleProgramPIds.has(room.assignedToPId)) {
                        const roomType = allRoomTypes.find(rt => rt.id === room.typeId);
                        if (roomType?.typeName === actualActiveAssignedFilter) eligibleRoomIds.add(room.id);
                    }
                });
            }
            if (actualActiveSharedFilter) {
                allRooms.forEach(room => {
                    if (room.sharedWithPIds.some(pId => accessibleProgramPIds.has(pId))) {
                        const roomType = allRoomTypes.find(rt => rt.id === room.typeId);
                        if (roomType?.typeName === actualActiveSharedFilter) eligibleRoomIds.add(room.id);
                    }
                });
            }
            if (!actualActiveAssignedFilter && !actualActiveSharedFilter) {
                allRooms.forEach(room => {
                    const isAssigned = room.assignedToPId && accessibleProgramPIds.has(room.assignedToPId);
                    const isShared = room.sharedWithPIds.some(pId => accessibleProgramPIds.has(pId));
                    if (isAssigned || isShared) eligibleRoomIds.add(room.id);
                });
            }
            
            roomsForGrid = allRooms.filter(room => eligibleRoomIds.has(room.id));
            
            let allPossibleHeaderSlots: DefaultTimeSlot[] = [...systemDefaultTimeSlots];
            accessiblePrograms.forEach(program => { if (program.programSpecificSlots && program.programSpecificSlots.length > 0) allPossibleHeaderSlots.push(...program.programSpecificSlots); });

            let slotsToProcessForHeader = activeGridSlotTypeFilter ? allPossibleHeaderSlots.filter(s => s.type === activeGridSlotTypeFilter) : allPossibleHeaderSlots;
            const uniqueSlotMapForHeader = new Map<string, DefaultTimeSlot>();
            slotsToProcessForHeader.forEach(slot => { const slotString = formatDefaultSlotToString(slot); if (!uniqueSlotMapForHeader.has(slotString)) uniqueSlotMapForHeader.set(slotString, slot); });
            slotsForGridObjects = Array.from(uniqueSlotMapForHeader.values()).sort(sortSlotsByTypeThenTime);
        } else {
            const selectedProgram = getProgramById(activeProgramIdInSidebar);
            if (selectedProgram) {
                displayName = selectedProgram.shortName || selectedProgram.fullName;
                const programSpecificSlots = selectedProgram.programSpecificSlots || [];
                calculatedProgramHasSlots = programSpecificSlots.length > 0;
                if (activeGridSlotTypeFilter) {
                    const filteredProgramSpecificSlots = programSpecificSlots.filter(s => s.type === activeGridSlotTypeFilter);
                    slotsForGridObjects = (filteredProgramSpecificSlots.length > 0) ? [...filteredProgramSpecificSlots].sort(sortSlotsByTypeThenTime) : systemDefaultTimeSlots.filter(s => s.type === activeGridSlotTypeFilter).sort(sortSlotsByTypeThenTime);
                } else slotsForGridObjects = (programSpecificSlots.length > 0) ? [...programSpecificSlots].sort(sortSlotsByTypeThenTime) : [];
                const eligibleRoomIds = new Set<string>();
                if (activeGridSlotTypeFilter) {
                    if (actualActiveAssignedFilter) allRooms.forEach(room => { const roomType = allRoomTypes.find(rt => rt.id === room.typeId); if (room.assignedToPId === selectedProgram.pId && roomType?.typeName === actualActiveAssignedFilter) eligibleRoomIds.add(room.id); });
                    if (actualActiveSharedFilter) allRooms.forEach(room => { const roomType = allRoomTypes.find(rt => rt.id === room.typeId); if (room.sharedWithPIds.includes(selectedProgram.pId) && roomType?.typeName === actualActiveSharedFilter) eligibleRoomIds.add(room.id); });
                } else allRooms.forEach(room => { if (room.assignedToPId === selectedProgram.pId || room.sharedWithPIds.includes(selectedProgram.pId)) eligibleRoomIds.add(room.id); });
                roomsForGrid = allRooms.filter(room => eligibleRoomIds.has(room.id));
            } else { slotsForGridObjects = [...systemDefaultTimeSlots].sort(sortSlotsByTypeThenTime); roomsForGrid = [...allRooms]; calculatedProgramHasSlots = true; displayName = "Selected program not found"; titleMsg = "Error"; detailMsg = "Selected program details could not be loaded."; }
        }

        if (selectedSemesterIdForRoutineView) roomsForGrid = roomsForGrid.filter(room => room.semesterId === selectedSemesterIdForRoutineView);

        const uniqueRooms = Array.from(
            new Map(roomsForGrid.map(room => [`${room.buildingId}-${room.roomNumber}-${room.semesterId}`, room])).values()
        );

        let finalRoomsForGrid = uniqueRooms;
        const isFilterActive = !!selectedLevelTermFilter || !!selectedSectionFilter || !!selectedTeacherIdFilter;
        const dayData = routineDataForGrid?.[selectedDay];
        if (isFilterActive && dayData) {
            const matchingRoomNumbers = new Set<string>();
            Object.entries(dayData).forEach(([roomNumber, slots]) => {
                for (const slotKey in slots) {
                    const classInfo = slots[slotKey as keyof typeof slots];
                    if (classInfo) {
                        const levelTermMatch = !selectedLevelTermFilter || classInfo.levelTerm === selectedLevelTermFilter;
                        const sectionMatch = !selectedSectionFilter || classInfo.section === classInfo.section;
                        let teacherMatch = true;
                        if (selectedTeacherIdFilter) {
                            const course = coursesData.find(c => c.semester === selectedSemesterIdForRoutineView && c.pId === classInfo.pId && c.courseCode === classInfo.courseCode && c.section === classInfo.section);
                            teacherMatch = !!course && course.teacherId === selectedTeacherIdFilter;
                        }
                        if (levelTermMatch && sectionMatch && teacherMatch) { matchingRoomNumbers.add(roomNumber); break; }
                    }
                }
            });
            finalRoomsForGrid.sort((a, b) => { const aHasMatch = matchingRoomNumbers.has(a.roomNumber); const bHasMatch = matchingRoomNumbers.has(b.roomNumber); if (aHasMatch && !bHasMatch) return -1; if (!aHasMatch && bHasMatch) return 1; return a.roomNumber.localeCompare(b.roomNumber); });
        } else finalRoomsForGrid.sort((a, b) => a.roomNumber.localeCompare(b.roomNumber));
        if (!activeProgramIdInSidebar) {
          if (selectedSemesterIdForRoutineView && finalRoomsForGrid.length === 0) { titleMsg = "No Rooms Match Semester/Filters"; detailMsg = `No rooms in semester "${selectedSemesterIdForRoutineView}" match the active Theory/Lab or Level-Term filter.`; }
          else if (actualActiveAssignedFilter || actualActiveSharedFilter || selectedLevelTermFilter || selectedSectionFilter) { if (finalRoomsForGrid.length === 0) { titleMsg = "No Rooms Match Filters"; detailMsg = "No rooms in the system match the active filter criteria."; } else if (slotsForGridObjects.length === 0) { titleMsg = "No Slots for Filter"; detailMsg = `No slots of type '${activeGridSlotTypeFilter}' found across all programs or system defaults.`; } }
          else { if (slotsForGridObjects.length === 0 && finalRoomsForGrid.length === 0) { titleMsg = "No Time Slots or Rooms"; detailMsg = "Define system default slots/rooms or add slots to programs."; } else if (slotsForGridObjects.length === 0) { titleMsg = "No Time Slots Defined"; detailMsg = "No time slots found across system defaults or any program configurations."; } else if (finalRoomsForGrid.length === 0) { titleMsg = "No Rooms in System"; detailMsg = "There are no rooms defined in the system."; } }
        } else {
            if (!calculatedProgramHasSlots) { titleMsg = "No Time Slots Defined"; detailMsg = `The program "${displayName || 'selected'}" has no specific time slots.`; }
            else if (selectedSemesterIdForRoutineView && finalRoomsForGrid.length === 0) { titleMsg = "No Rooms for Semester/Filters"; detailMsg = `No rooms in program "${displayName || 'selected'}" and semester "${selectedSemesterIdForRoutineView}" match the active filters.`; }
            else if (finalRoomsForGrid.length === 0) { titleMsg = "No Rooms Match Filters"; detailMsg = `No rooms are assigned or shared with program "${displayName || 'selected'}" that match the active filters.`; }
            else if (slotsForGridObjects.length === 0) { titleMsg = "No Slots for Current Filter"; detailMsg = `Program "${displayName || 'selected'}" (or system defaults if program slots are empty) may not have slots for the active Theory/Lab filter.`; }
        }
        let finalHeaderSlots = (activeProgramIdInSidebar && !calculatedProgramHasSlots) ? [] : slotsForGridObjects;
        return { effectiveHeaderSlotsForGrid: finalHeaderSlots, effectiveRoomEntriesForGrid: finalRoomsForGrid, programHasSlotsForMessage: calculatedProgramHasSlots, programNameToDisplay: displayName, gridMessageTitle: titleMsg, gridMessageDetails: detailMsg };
    }, [ activeProgramIdInSidebar, getProgramById, allPrograms, allRooms, actualActiveAssignedFilter, actualActiveSharedFilter, selectedDay, systemDefaultTimeSlots, selectedSemesterIdForRoutineView, allRoomTypes, selectedLevelTermFilter, selectedSectionFilter, selectedTeacherIdFilter, coursesData, routineDataForGrid, accessibleProgramPIds, accessiblePrograms ]);

    const handleBulkAssign = useCallback(() => {
        if (!selectedSemesterIdForRoutineView || !activeProgramIdInSidebar) {
            alert("Please select a Program and a Semester from the sidebar before auto-assigning.");
            return;
        }
        const program = getProgramById(activeProgramIdInSidebar);
        if (!program) {
            alert("Selected program not found.");
            return;
        }

        const levelTermDayConstraints: Record<string, DayOfWeek[]> = {
            'L1T1': ['Saturday', 'Sunday', 'Monday', 'Tuesday'],
            'L1T2': ['Saturday', 'Sunday', 'Monday', 'Tuesday'],
            'L1T3': ['Saturday', 'Sunday', 'Monday', 'Tuesday'],
            'L2T1': ['Sunday', 'Monday', 'Tuesday', 'Wednesday'],
            'L2T2': ['Sunday', 'Monday', 'Tuesday', 'Wednesday'],
            'L2T3': ['Sunday', 'Monday', 'Tuesday', 'Wednesday'],
            'L3T1': ['Monday', 'Tuesday', 'Wednesday', 'Thursday'],
            'L3T2': ['Monday', 'Tuesday', 'Wednesday', 'Thursday'],
            'L3T3': ['Monday', 'Tuesday', 'Wednesday', 'Thursday'],
            'L4T1': ['Sunday', 'Monday', 'Tuesday', 'Wednesday'],
            'L4T2': ['Sunday', 'Monday', 'Tuesday', 'Wednesday'],
            'L4T3': ['Sunday', 'Monday', 'Tuesday', 'Wednesday'],
        };
    
        const eligibleSections = coursesData.filter(c =>
            c.semester === selectedSemesterIdForRoutineView &&
            c.pId === program.pId &&
            c.levelTerm && c.levelTerm !== 'N/A' &&
            (c.courseType === 'Theory' || c.courseType === 'Lab') &&
            c.weeklyClass && c.weeklyClass > 0
        );
    
        const currentRoutine = routineDataForGrid || {};
        const scheduledCounts = new Map<string, number>();
        Object.values(currentRoutine).forEach(dayData => {
            Object.values(dayData).forEach(roomSlots => {
                Object.values(roomSlots).forEach(classInfo => {
                    if (classInfo && classInfo.pId === program.pId) {
                        const sectionKey = `${classInfo.pId}-${classInfo.courseCode}-${classInfo.section}`;
                        scheduledCounts.set(sectionKey, (scheduledCounts.get(sectionKey) || 0) + 1);
                    }
                });
            });
        });

        const assignmentTasks: { section: EnrollmentEntry, classInfo: ClassDetail }[] = [];
        eligibleSections.forEach(section => {
            const sectionKey = `${section.pId}-${section.courseCode}-${section.section}`;
            const alreadyScheduled = scheduledCounts.get(sectionKey) || 0;
            const needed = (section.weeklyClass || 0) - alreadyScheduled;
            if (needed > 0) {
                const classInfo = generateClassDetailFromEnrollment(section);
                for (let i = 0; i < needed; i++) {
                    assignmentTasks.push({ section, classInfo });
                }
            }
        });
    
        if (assignmentTasks.length === 0) {
            alert("All schedulable sections are already fully scheduled according to their weekly class requirements.");
            return;
        }
    
        const newRoutineForSemester = JSON.parse(JSON.stringify(currentRoutine));
    
        const roomsForGrid = effectiveRoomEntriesForGrid.filter(r => r.roomSpecificSlots && r.roomSpecificSlots.length > 0);
        const headerSlots = effectiveHeaderSlotsForGrid;
        const days = program.activeDays || DAYS_OF_WEEK;

        const futureDatesByDay = new Map<DayOfWeek, string[]>();
        days.forEach(day => {
            futureDatesByDay.set(day, getAllFutureDatesForDay(day, selectedSemesterIdForRoutineView, program));
        });
    
        const assignmentsByTimeSlot = new Map<string, { teacherIds: Set<string>, sectionKeys: Set<string> }>();
        days.forEach(day => {
            const dayData = newRoutineForSemester[day];
            if (dayData) {
                Object.entries(dayData).forEach(([roomNumber, roomSlots]) => {
                    Object.entries(roomSlots as { [slot: string]: ClassDetail }).forEach(([slotString, classInfo]) => {
                        const timeSlotKey = `${day}-${slotString}`;
                        const existingCourse = coursesData.find(c => c.semester === selectedSemesterIdForRoutineView && c.pId === classInfo.pId && c.courseCode === classInfo.courseCode && c.section === classInfo.section);
                        if (existingCourse) {
                            if (!assignmentsByTimeSlot.has(timeSlotKey)) {
                                assignmentsByTimeSlot.set(timeSlotKey, { teacherIds: new Set(), sectionKeys: new Set() });
                            }
                            const entry = assignmentsByTimeSlot.get(timeSlotKey)!;
                            entry.teacherIds.add(existingCourse.teacherId);
                            entry.sectionKeys.add(`${existingCourse.pId}-${existingCourse.levelTerm}-${existingCourse.section}`);
                        }
                    });
                });
            }
        });
    
        const freeSlots: { day: DayOfWeek; room: RoomEntry; slot: DefaultTimeSlot }[] = [];
        days.forEach(day => {
            const futureDatesForThisDay = futureDatesByDay.get(day) || [];

            headerSlots.forEach(headerSlot => {
                roomsForGrid.forEach(room => {
                    const slotString = formatDefaultSlotToString(headerSlot);
                    
                    const roomCanHandleSlot = room.roomSpecificSlots!.some(s => s.startTime === headerSlot.startTime && s.endTime === headerSlot.endTime && s.type === headerSlot.type);
                    if (!roomCanHandleSlot) return;

                    if (newRoutineForSemester[day]?.[room.roomNumber]?.[slotString]) return;
                    
                    const isLockedByOverride = futureDatesForThisDay.some(dateISO => 
                        scheduleOverrides[room.roomNumber]?.[slotString]?.[dateISO] != null
                    );
                    if (isLockedByOverride) return;

                    freeSlots.push({ day, room, slot: headerSlot });
                });
            });
        });
    
        let theoryTasks = assignmentTasks.filter(t => t.section.courseType === 'Theory').sort(() => Math.random() - 0.5);
        let labTasks = assignmentTasks.filter(t => t.section.courseType === 'Lab').sort(() => Math.random() - 0.5);
        
        const roomCentricSort = (a: { day: DayOfWeek; room: RoomEntry; slot: DefaultTimeSlot }, b: { day: DayOfWeek; room: RoomEntry; slot: DefaultTimeSlot }) => {
            if (a.room.roomNumber < b.room.roomNumber) return -1;
            if (a.room.roomNumber > b.room.roomNumber) return 1;
            const dayIndexA = DAYS_OF_WEEK.indexOf(a.day);
            const dayIndexB = DAYS_OF_WEEK.indexOf(b.day);
            if (dayIndexA < dayIndexB) return -1;
            if (dayIndexA > dayIndexB) return 1;
            return a.slot.startTime.localeCompare(b.slot.startTime);
        };

        const freeTheorySlots = freeSlots.filter(s => s.slot.type === 'Theory').sort(roomCentricSort);
        const freeLabSlots = freeSlots.filter(s => s.slot.type === 'Lab').sort(roomCentricSort);
    
        let assignmentsMade = 0;
        
        const performAssignments = (tasks: typeof theoryTasks, slots: typeof freeTheorySlots) => {
            for (const freeSlot of slots) {
                if (tasks.length === 0) break;
                const { day, room, slot } = freeSlot;
                const slotString = formatDefaultSlotToString(slot);
                const timeSlotKey = `${day}-${slotString}`;
        
                if (!assignmentsByTimeSlot.has(timeSlotKey)) {
                    assignmentsByTimeSlot.set(timeSlotKey, { teacherIds: new Set(), sectionKeys: new Set() });
                }
                const existingAssignments = assignmentsByTimeSlot.get(timeSlotKey)!;
        
                let assignedTaskIndex = -1;
                for (let i = 0; i < tasks.length; i++) {
                    const task = tasks[i];
                    const teacherId = task.section.teacherId;
                    const sectionKey = `${task.section.pId}-${task.section.levelTerm}-${task.section.section}`;
                    
                    const teacherUser = users.find(u => u.employeeId === teacherId);
                    if (teacherUser && teacherUser.dayOffs?.includes(day)) {
                        continue; 
                    }

                    const allowedDays = levelTermDayConstraints[task.section.levelTerm];
                    if (allowedDays && !allowedDays.includes(day)) {
                        continue; // Skip this task if the slot's day is not allowed for this section's level-term
                    }

                    if (!existingAssignments.teacherIds.has(teacherId) && !existingAssignments.sectionKeys.has(sectionKey)) {
                        if (!newRoutineForSemester[day]) newRoutineForSemester[day] = {};
                        if (!newRoutineForSemester[day][room.roomNumber]) newRoutineForSemester[day][room.roomNumber] = {};
                        newRoutineForSemester[day][room.roomNumber][slotString] = task.classInfo;
                        
                        existingAssignments.teacherIds.add(teacherId);
                        existingAssignments.sectionKeys.add(sectionKey);
                        
                        assignmentsMade++;
                        assignedTaskIndex = i;
                        break; 
                    }
                }
                if (assignedTaskIndex > -1) {
                    tasks.splice(assignedTaskIndex, 1);
                }
            }
        };
    
        performAssignments(theoryTasks, freeTheorySlots);
        performAssignments(labTasks, freeLabSlots);

        if (assignmentsMade === 0) {
            alert("No changes were made to the routine. A new version was not created.");
            return;
        }
    
        const newVersionId = `v-${Date.now()}`;
        const newVersion: RoutineVersion = {
            versionId: newVersionId,
            createdAt: new Date().toISOString(),
            routine: newRoutineForSemester,
        };

        setRoutineData(prev => {
            const newData = JSON.parse(JSON.stringify(prev));
            const semesterId = selectedSemesterIdForRoutineView!;
            const semesterData = newData[semesterId] || { versions: [], activeVersionId: null };
            
            semesterData.versions.push(newVersion);
            semesterData.versions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            semesterData.activeVersionId = newVersionId;
            
            newData[semesterId] = semesterData;
            return newData;
        });
        
        const totalTasks = assignmentTasks.length;
        alert(`Auto-assignment complete.\n\nAssigned ${assignmentsMade} of ${totalTasks} remaining classes.\n\nA new routine version has been created and activated.`);
    }, [selectedSemesterIdForRoutineView, activeProgramIdInSidebar, getProgramById, coursesData, routineData, effectiveRoomEntriesForGrid, effectiveHeaderSlotsForGrid, setRoutineData, allPrograms, scheduleOverrides, getAllFutureDatesForDay, routineDataForGrid, users]);
    
    // --- Versioning Handlers ---
    const versionsForCurrentSemester = useMemo(() => {
        if (!selectedSemesterIdForRoutineView || !routineData[selectedSemesterIdForRoutineView]) {
            return [];
        }
        return routineData[selectedSemesterIdForRoutineView].versions
            .map(v => ({ versionId: v.versionId, createdAt: v.createdAt }))
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [routineData, selectedSemesterIdForRoutineView]);

    const activeVersionIdForCurrentSemester = useMemo(() => {
        if (!selectedSemesterIdForRoutineView || !routineData[selectedSemesterIdForRoutineView]) {
            return null;
        }
        return routineData[selectedSemesterIdForRoutineView].activeVersionId;
    }, [routineData, selectedSemesterIdForRoutineView]);

    const handleVersionChange = useCallback((versionId: string) => {
        if (!selectedSemesterIdForRoutineView) return;
        setRoutineData(prev => {
            const newData = { ...prev };
            const semesterData = newData[selectedSemesterIdForRoutineView];
            if (semesterData) {
                newData[selectedSemesterIdForRoutineView] = { ...semesterData, activeVersionId: versionId };
            }
            return newData;
        });
    }, [selectedSemesterIdForRoutineView]);

    const handleDeleteVersion = useCallback((versionId: string) => {
        if (!selectedSemesterIdForRoutineView) return;
        if (!window.confirm("Are you sure you want to delete this routine version? This action cannot be undone.")) {
            return;
        }
        setRoutineData(prev => {
            const newRoutineData = { ...prev };
            const semesterData = newRoutineData[selectedSemesterIdForRoutineView];
            if (semesterData && semesterData.versions) {
                if (versionId === semesterData.activeVersionId) {
                    alert("You cannot delete the currently active version.");
                    return prev;
                }
                const updatedVersions = semesterData.versions.filter(v => v.versionId !== versionId);
                if (updatedVersions.length === 0) {
                    newRoutineData[selectedSemesterIdForRoutineView] = { versions: [], activeVersionId: null };
                } else {
                    newRoutineData[selectedSemesterIdForRoutineView] = { ...semesterData, versions: updatedVersions };
                }
            }
            return newRoutineData;
        });
    }, [selectedSemesterIdForRoutineView]);

    const handleOpenConflictModal = useCallback((conflictInfo: ConflictInfoForModal) => {
        setConflictDataForModal(conflictInfo);
        setIsConflictModalOpen(true);
    }, []);

    const handleCloseConflictModal = useCallback(() => {
        setIsConflictModalOpen(false);
        setConflictDataForModal(null);
    }, []);

    const handleApplyAiResolution = useCallback((resolution: AiResolutionSuggestion) => {
        if (!selectedSemesterIdForRoutineView) return;
        const semesterData = routineData[selectedSemesterIdForRoutineView];
        if (!semesterData) return;
        const activeVersion = semesterData.versions.find(v => v.versionId === semesterData.activeVersionId);
        if (!activeVersion) return;
        const sourceClass = activeVersion.routine[resolution.source.day]?.[resolution.source.roomNumber]?.[resolution.source.slotString];
        if (sourceClass) {
            handleMoveRoutineEntry(resolution.source, resolution.target, sourceClass, selectedSemesterIdForRoutineView);
        }
        handleCloseConflictModal();
    }, [routineData, selectedSemesterIdForRoutineView, handleMoveRoutineEntry, handleCloseConflictModal]);
    
    const handleCancelPendingChange = useCallback((changeId: string) => {
      setPendingChanges(prev => prev.filter(c => c.id !== changeId));
    }, []);
    
    // --- Memoized Derived Data for Views ---
    const coursesForCourseListView = useMemo(() => {
        let filtered = coursesData;
        if (selectedSemesterIdForRoutineView) filtered = filtered.filter(c => c.semester === selectedSemesterIdForRoutineView);
        if (activeProgramIdInSidebar) {
            const program = getProgramById(activeProgramIdInSidebar);
            if (program) filtered = filtered.filter(c => c.pId === program.pId);
        } else {
            filtered = filtered.filter(c => accessibleProgramPIds.has(c.pId));
        }
        if (dashboardTabFilter !== 'All') filtered = filtered.filter(c => c.courseType === dashboardTabFilter);
        return filtered;
    }, [coursesData, selectedSemesterIdForRoutineView, activeProgramIdInSidebar, dashboardTabFilter, getProgramById, accessibleProgramPIds]);

    const teachersForTeacherListView = useMemo(() => {
        let relevantCourses = coursesData;
        if (selectedSemesterIdForRoutineView) relevantCourses = relevantCourses.filter(c => c.semester === selectedSemesterIdForRoutineView);
        const selectedProgram = activeProgramIdInSidebar ? getProgramById(activeProgramIdInSidebar) : null;
        if (selectedProgram) {
            relevantCourses = relevantCourses.filter(c => c.pId === selectedProgram.pId);
        } else {
            relevantCourses = relevantCourses.filter(c => accessibleProgramPIds.has(c.pId));
        }
        if (dashboardTabFilter !== 'All') relevantCourses = relevantCourses.filter(c => c.courseType === dashboardTabFilter);
        const teacherCourseMap = new Map<string, EnrollmentEntry[]>();
        relevantCourses.forEach(course => { if (!teacherCourseMap.has(course.teacherId)) teacherCourseMap.set(course.teacherId, []); teacherCourseMap.get(course.teacherId)!.push(course); });
        const uniqueTeachers = Array.from(teacherCourseMap.entries()).map(([teacherId, courses]) => {
            const teacherInfo = courses[0];
            const creditLoad = courses.reduce((sum, course) => sum + course.credit, 0);
            return { employeeId: teacherInfo.teacherId, teacherName: teacherInfo.teacherName, designation: teacherInfo.designation, mobile: teacherInfo.teacherMobile, email: teacherInfo.teacherEmail, creditLoad, courses };
        });
        return uniqueTeachers.sort((a, b) => a.teacherName.localeCompare(b.teacherName));
    }, [coursesData, selectedSemesterIdForRoutineView, activeProgramIdInSidebar, dashboardTabFilter, getProgramById, accessibleProgramPIds]);

    useEffect(() => {
        if (teachersForTeacherListView.length > 0) {
            syncTeachersAsUsers(teachersForTeacherListView);
        }
    }, [teachersForTeacherListView, syncTeachersAsUsers]);

    const coursesForSectionListView = useMemo(() => {
        let filteredCourses = coursesData;
        if (selectedSemesterIdForRoutineView) filteredCourses = filteredCourses.filter(c => c.semester === selectedSemesterIdForRoutineView);
        if (activeProgramIdInSidebar) {
            const selectedProgram = getProgramById(activeProgramIdInSidebar);
            if (selectedProgram) filteredCourses = filteredCourses.filter(c => c.pId === selectedProgram.pId);
        } else {
            filteredCourses = filteredCourses.filter(c => accessibleProgramPIds.has(c.pId));
        }
        return filteredCourses;
    }, [coursesData, selectedSemesterIdForRoutineView, activeProgramIdInSidebar, getProgramById, accessibleProgramPIds]);

    const roomsForRoomListView = useMemo(() => {
        let filtered;
        
        const uniqueRooms = new Map<string, RoomEntry>();
        allRooms.forEach(room => {
            const key = `${room.buildingId}-${room.roomNumber}`;
            if (!uniqueRooms.has(key)) {
                uniqueRooms.set(key, room);
            }
        });
        filtered = Array.from(uniqueRooms.values());

        if (selectedSemesterIdForRoutineView) {
            const roomsInSemester = new Set(allRooms.filter(r => r.semesterId === selectedSemesterIdForRoutineView).map(r => `${r.buildingId}-${r.roomNumber}`));
            filtered = filtered.filter(room => roomsInSemester.has(`${room.buildingId}-${room.roomNumber}`));
        }

        if (activeProgramIdInSidebar) {
            const program = getProgramById(activeProgramIdInSidebar);
            if (program) {
                const relevantRoomKeys = new Set<string>();
                allRooms.forEach(room => {
                    if (room.assignedToPId === program.pId || room.sharedWithPIds.includes(program.pId)) {
                        relevantRoomKeys.add(`${room.buildingId}-${room.roomNumber}`);
                    }
                });
                filtered = filtered.filter(room => relevantRoomKeys.has(`${room.buildingId}-${room.roomNumber}`));
            }
        } else {
            const relevantRoomKeys = new Set<string>();
            allRooms.forEach(room => {
                const isAssigned = room.assignedToPId && accessibleProgramPIds.has(room.assignedToPId);
                const isShared = room.sharedWithPIds.some(pId => accessibleProgramPIds.has(pId));
                if (isAssigned || isShared) {
                    relevantRoomKeys.add(`${room.buildingId}-${room.roomNumber}`);
                }
            });
            filtered = filtered.filter(room => relevantRoomKeys.has(`${room.buildingId}-${room.roomNumber}`));
        }
        if (dashboardTabFilter !== 'All') {
            filtered = filtered.filter(room => {
                const roomType = allRoomTypes.find(rt => rt.id === room.typeId);
                return roomType?.typeName === dashboardTabFilter;
            });
        }
        
        return filtered;
    }, [allRooms, selectedSemesterIdForRoutineView, activeProgramIdInSidebar, dashboardTabFilter, getProgramById, allRoomTypes, accessibleProgramPIds]);

    const getOccupancyStats = useCallback((room: RoomEntry) => {
        const program = allPrograms.find(p => p.pId === room.assignedToPId);
        if (!program || !program.activeDays || program.activeDays.length === 0) return { theory: { booked: 0, total: 0 }, lab: { booked: 0, total: 0 } };
        const activeDays = program.activeDays;
        const applicableSlots = (room.roomSpecificSlots?.length ?? 0) > 0 ? room.roomSpecificSlots : systemDefaultTimeSlots;
        const routineForSemester = room.semesterId ? routineData[room.semesterId]?.versions.find(v => v.versionId === routineData[room.semesterId].activeVersionId)?.routine : {};
        let totalTheory = 0, totalLab = 0, bookedTheory = 0, bookedLab = 0;
        applicableSlots.forEach(slot => { if (slot.type === 'Theory') totalTheory++; if (slot.type === 'Lab') totalLab++; });
        totalTheory *= activeDays.length; totalLab *= activeDays.length;
        if (routineForSemester && Object.keys(routineForSemester).length > 0) {
            activeDays.forEach(day => {
                const daySchedule = routineForSemester[day as DayOfWeek];
                if (daySchedule && daySchedule[room.roomNumber]) {
                    Object.keys(daySchedule[room.roomNumber]).forEach(slotString => {
                        const correspondingSlot = applicableSlots.find(s => formatDefaultSlotToString(s) === slotString);
                        if (correspondingSlot) { if (correspondingSlot.type === 'Theory') bookedTheory++; if (correspondingSlot.type === 'Lab') bookedLab++; }
                    });
                }
            });
        }
        return { theory: { booked: bookedTheory, total: totalTheory }, lab: { booked: bookedLab, total: totalLab } };
    }, [allPrograms, systemDefaultTimeSlots, routineData]);

    const ciwCounts = useMemo(() => {
        const counts = new Map<string, number>();
        Object.entries(routineData).forEach(([semesterId, semesterData]) => {
            const activeVersion = semesterData.versions.find(v => v.versionId === semesterData.activeVersionId);
            if (activeVersion?.routine) {
                Object.values(activeVersion.routine).forEach(day => {
                    Object.values(day).forEach(room => {
                        Object.values(room).forEach(classInfo => {
                            if (classInfo) {
                                const section = coursesData.find(c =>
                                    c.semester === semesterId && c.pId === classInfo.pId && c.courseCode === classInfo.courseCode && c.section === classInfo.section
                                );
                                if (section) counts.set(section.sectionId, (counts.get(section.sectionId) || 0) + 1);
                            }
                        });
                    });
                });
            }
        });
        coursesData.forEach(c => { if (!counts.has(c.sectionId)) counts.set(c.sectionId, 0); });
        return counts;
    }, [coursesData, routineData]);

    const classRequirementCounts = useMemo(() => {
        const counts = new Map<string, number>();
        const countDayOccurrences = (dayOfWeek: DayOfWeek, startDateStr: string, endDateStr: string): number => {
            if (!startDateStr || !endDateStr) return 0;
            const jsDayMap = { 'Saturday': 6, 'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5 };
            const targetJsDay = jsDayMap[dayOfWeek];
            if (targetJsDay === undefined) return 0;
            try {
                const startDate = new Date(startDateStr + 'T00:00:00Z'); const endDate = new Date(endDateStr + 'T00:00:00Z');
                let count = 0; let currentDate = new Date(startDate);
                while (currentDate <= endDate) { if (currentDate.getUTCDay() === targetJsDay) count++; currentDate.setUTCDate(currentDate.getUTCDate() + 1); }
                return count;
            } catch(e) { return 0; }
        };
        coursesData.forEach(section => {
            const scheduledDays = new Set<DayOfWeek>();
            const semesterData = routineData[section.semester];
            const semesterRoutine = semesterData?.versions.find(v => v.versionId === semesterData.activeVersionId)?.routine;
            if (semesterRoutine) {
                for (const day of Object.keys(semesterRoutine) as DayOfWeek[]) {
                    const dayData = semesterRoutine[day];
                    if (dayData) {
                        for (const room of Object.values(dayData)) {
                            for (const classInfo of Object.values(room)) {
                                if (classInfo && classInfo.pId === section.pId && classInfo.courseCode === section.courseCode && classInfo.section === section.section) {
                                    scheduledDays.add(day);
                                }
                            }
                        }
                    }
                }
            }
            if (scheduledDays.size === 0) { counts.set(section.sectionId, 0); return; }
            const program = allPrograms.find(p => p.pId === section.pId);
            const semesterConfig = allSemesterConfigurations.find(c => c.targetSemester === section.semester);
            let startDate = '', endDate = '';
            if (program && semesterConfig) { const typeConfig = semesterConfig.typeConfigs.find(tc => tc.type === program.semesterSystem); if (typeConfig) { startDate = typeConfig.startDate; endDate = typeConfig.endDate; } }
            let totalClasses = 0;
            if (startDate && endDate) scheduledDays.forEach(day => { totalClasses += countDayOccurrences(day, startDate, endDate); });
            counts.set(section.sectionId, totalClasses);
        });
        return counts;
    }, [coursesData, routineData, allPrograms, allSemesterConfigurations]);

    const sidebarStats = useMemo(() => {
        let relevantCourses = coursesData;
        if (selectedSemesterIdForRoutineView) {
            relevantCourses = relevantCourses.filter(c => c.semester === selectedSemesterIdForRoutineView);
        }
        const selectedProgram = activeProgramIdInSidebar ? getProgramById(activeProgramIdInSidebar) : null;
        if (selectedProgram) {
            relevantCourses = relevantCourses.filter(c => c.pId === selectedProgram.pId);
        } else {
            relevantCourses = relevantCourses.filter(c => accessibleProgramPIds.has(c.pId));
        }
        if (dashboardTabFilter !== 'All') {
            relevantCourses = relevantCourses.filter(c => c.courseType === dashboardTabFilter);
        }
    
        let relevantRooms = selectedSemesterIdForRoutineView ? allRooms.filter(r => r.semesterId === selectedSemesterIdForRoutineView) : allRooms.filter(r => {
            const configuredSemesters = new Set(allSemesterConfigurations.map(c => c.targetSemester));
            return r.semesterId && configuredSemesters.has(r.semesterId);
        });
    
        if (selectedProgram) {
            relevantRooms = relevantRooms.filter(r => r.assignedToPId === selectedProgram.pId || r.sharedWithPIds.includes(selectedProgram.pId));
        } else {
            relevantRooms = relevantRooms.filter(r => (r.assignedToPId && accessibleProgramPIds.has(r.assignedToPId)) || r.sharedWithPIds.some(pId => accessibleProgramPIds.has(pId)));
        }
        if (dashboardTabFilter !== 'All') {
            relevantRooms = relevantRooms.filter(room => {
                const roomType = allRoomTypes.find(rt => rt.id === room.typeId);
                return roomType?.typeName === dashboardTabFilter;
            });
        }
        
        const uniqueRelevantRooms = new Map<string, RoomEntry>();
        relevantRooms.forEach(room => {
            const key = `${room.buildingId}-${room.roomNumber}`;
            if (!uniqueRelevantRooms.has(key)) {
                uniqueRelevantRooms.set(key, room);
            }
        });
        const roomCount = uniqueRelevantRooms.size;
    
        let totalSlots = 0;
        relevantRooms.forEach(room => {
            const assignedProgram = allPrograms.find(p => p.pId === room.assignedToPId);
            const activeDaysCount = assignedProgram?.activeDays?.length || 0;

            if (activeDaysCount > 0) {
                const slotsForRoom = room.roomSpecificSlots || [];
                const filteredSlotsForRoom = dashboardTabFilter === 'All' 
                    ? slotsForRoom 
                    : slotsForRoom.filter(s => s.type === dashboardTabFilter);
                totalSlots += activeDaysCount * filteredSlotsForRoom.length;
            }
        });

        let bookedSlots = 0;
        const routinesToScan = selectedSemesterIdForRoutineView ? { [selectedSemesterIdForRoutineView]: routineData[selectedSemesterIdForRoutineView] } : routineData;
        Object.entries(routinesToScan).forEach(([semesterId, semesterData]) => {
            if (!semesterData) return;
            const activeVersion = semesterData.versions.find(v => v.versionId === semesterData.activeVersionId);
            if (!activeVersion?.routine) return;
            const semesterRoutine = activeVersion.routine;
            const roomsForThisSemester = relevantRooms.filter(r => r.semesterId === semesterId);
            roomsForThisSemester.forEach(room => {
                const assignedProgramForRoom = allPrograms.find(p => p.pId === room.assignedToPId);
                const activeDaysForRoom = assignedProgramForRoom?.activeDays || [];
                activeDaysForRoom.forEach(day => {
                    const roomScheduleForDay = semesterRoutine[day as DayOfWeek]?.[room.roomNumber];
                    if (roomScheduleForDay) {
                        const slotsForRoom = room.roomSpecificSlots || [];
                        const filteredSlotsForRoom = dashboardTabFilter === 'All' ? slotsForRoom : slotsForRoom.filter(s => s.type === dashboardTabFilter);
                        filteredSlotsForRoom.forEach(slotDef => {
                            const slotString = formatDefaultSlotToString(slotDef);
                            const classInfo = roomScheduleForDay[slotString as TimeSlot];
                            if (classInfo) {
                                bookedSlots++;
                            }
                        });
                    }
                });
            });
        });

        const slotRequirement = relevantCourses.reduce((sum, course) => sum + (course.weeklyClass || 0), 0);
        const bookedSlotRequirement = relevantCourses.reduce((sum, course) => sum + (ciwCounts.get(course.sectionId) || 0), 0);
    
        return { teacherCount: new Set(relevantCourses.map(c => c.teacherId)).size, uniqueCourseCount: new Set(relevantCourses.map(c => c.courseCode)).size, sectionCount: relevantCourses.length, slotRequirement, bookedSlotRequirement, roomCount, totalSlots, bookedSlots, attendanceLogCount: attendanceLog.length, };
    }, [ coursesData, allRooms, allPrograms, selectedSemesterIdForRoutineView, activeProgramIdInSidebar, getProgramById, systemDefaultTimeSlots, routineData, dashboardTabFilter, allRoomTypes, ciwCounts, attendanceLog, allSemesterConfigurations, accessibleProgramPIds ]);

    const slotUsageStats = useMemo(() => {
        const { totalSlots, bookedSlots } = sidebarStats;
        return {
            total: totalSlots,
            booked: bookedSlots,
        };
    }, [sidebarStats]);

    return {
        user,
        logout,
        users,
        selectedDay,
        handleDayChange,
        selectedDate,
        handleDateChange,
        routineViewMode,
        handleToggleRoutineViewMode,
        activeMainView,
        handleMainViewChange,
        activeOverlay,
        handleOverlayToggle,
        closeOverlay,
        isOverlayAnimating,
        applyOpenAnimationStyles,
        activeProgramIdInSidebar,
        setActiveProgramIdInSidebar,
        selectedSemesterIdForRoutineView,
        setSelectedSemesterIdForRoutineView,
        actualActiveAssignedFilter,
        handleAssignedFilterChange,
        actualActiveSharedFilter,
        handleSharedFilterChange,
        dashboardTabFilter,
        setDashboardTabFilter,
        selectedLevelTermFilter,
        setSelectedLevelTermFilter,
        selectedSectionFilter,
        setSelectedSectionFilter,
        selectedTeacherIdFilter,
        setSelectedTeacherIdFilter,
        selectedCourseSectionIdsFilter,
        setSelectedCourseSectionIdsFilter,
        activeSettingsSection,
        setActiveSettingsSection,
        stagedCourseUpdates,
        setStagedCourseUpdates,
        handleSaveCourseMetadata,
        handleClearStagedCourseUpdates,
        coursesData,
        setCoursesData,
        handleUpdateCourseLevelTerm,
        handleUpdateWeeklyClass,
        handleUpdateCourseType,
        allSemesterConfigurations,
        setAllSemesterConfigurations,
        handleCloneRooms,
        routineData,
        setRoutineData,
        handleUpdateDefaultRoutine,
        handleMoveRoutineEntry,
        scheduleOverrides,
        handleUpdateScheduleOverrides,
        scheduleHistory,
        attendanceLog,
        pendingChanges,
        setPendingChanges,
        notifications,
        setNotifications,
        unreadNotificationCount,
        activeGridDisplayType,
        setActiveGridDisplayType,
        programIdForSemesterFilter,
        setProgramIdForSemesterFilter,
        initialSectionListFilters,
        handleShowSectionListWithFilters,
        handleAssignSectionToSlot,
        isLogAttendanceModalOpen,
        logDataForModal,
        handleOpenLogAttendanceModal,
        handleCloseLogAttendanceModal,
        handleSaveAttendanceLog,
        handleDeleteAttendanceLogEntry,
        handleClearAttendanceLog,
        handleOpenEditAttendanceLog,
        handleToggleMakeupStatus,
        handleChangePassword: changePassword,
        handleMergeSections,
        handleUnmergeSection,
        isConflictModalOpen,
        conflictDataForModal,
        handleOpenConflictModal,
        handleCloseConflictModal,
        handleApplyAiResolution,
        handleCancelPendingChange,
        systemDefaultTimeSlots,
        uniqueSemestersForRooms,
        uniqueSemestersFromCourses,
        effectiveDaysForGrid,
        sidebarStats,
        slotUsageStats,
        ciwCounts,
        classRequirementCounts,
        programHasSlotsForMessage,
        programNameToDisplay,
        gridMessageTitle,
        gridMessageDetails,
        effectiveHeaderSlotsForGrid,
        effectiveRoomEntriesForGrid,
        routineDataForGrid,
        coursesForCourseListView,
        coursesForSectionListView,
        teachersForTeacherListView,
        roomsForRoomListView,
        handlePreviewLevelTermRoutine,
        handlePreviewFullRoutine,
        handlePreviewCourseSectionRoutine,
        handleBulkAssign,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        versionsForCurrentSemester,
        activeVersionIdForCurrentSemester,
        handleVersionChange,
        handleDeleteVersion,
        allPrograms,
        allRooms,
        allBuildings,
        allFloors,
        allCategories,
        allRoomTypes,
        getBuildingNameFromApp,
        getFloorNameFromApp,
        getCategoryNameFromApp,
        getTypeNameFromApp,
        getProgramShortNameFromApp,
        getProgramDisplayString,
        getBuildingAddressFromApp,
        getOccupancyStats,
        addFloorFromApp,
        addCategoryFromApp,
        addTypeFromApp,
        handleShowBuildingRooms,
        handleShowProgramDetail,
        handleShowSemesterDetail,
        handleShowUserDetail,
        handleShowCourseList,
        handleShowRoomList,
        handleShowTeacherList,
        handleShowSectionList,
        handleShowAttendanceLog,
        handleCloseProgramDetail,
        handleCloseSemesterDetail,
        selectedBuildingIdForView,
        selectedProgramIdForDetailView,
        activeSemesterDetailViewId,
        selectedUserIdForDetailView,
    };
};
