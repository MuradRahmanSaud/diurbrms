import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { MainViewType, ProgramEntry, ProgramType, SemesterSystem, OverlayViewType, User, CourseType, SemesterCloneInfo, EnrollmentEntry, RoutineViewMode, RoomTypeFilter, SemesterRoutineData, RoutineVersion } from '../types'; 
import * as XLSX from 'xlsx';
import { usePrograms } from '../contexts/ProgramContext';
import { useAuth } from '../contexts/AuthContext'; // Import useAuth
import SearchableProgramDropdown from './SearchableProgramDropdown';
import { SHARED_SIDE_PANEL_WIDTH_CLASSES, SIDEBAR_FOOTER_PADDING_BOTTOM_CLASS } from '../styles/layoutConstants'; 
import CourseDataTools from './CourseDataTools';
import SearchableCreatableDropdown from './SearchableCreatableDropdown';
import SearchableTeacherDropdown from './SearchableTeacherDropdown';
import SearchableCourseSectionDropdown from './SearchableCourseSectionDropdown';
import CourseSectionEditor from './CourseSectionEditor';

interface SidebarProps {
  onMainViewChange: (view: MainViewType) => void;
  onOverlayToggle: (overlay: OverlayViewType) => void;
  currentMainView: MainViewType;
  currentOverlay: OverlayViewType | null;
  onSelectProgramForRoutineView: (programObjectId: string | null) => void;
  selectedProgramIdForRoutineView: string | null;
  activeAssignedRoomTypeFilter: RoomTypeFilter;
  setActiveAssignedRoomTypeFilter: (filter: RoomTypeFilter) => void;
  activeSharedRoomTypeFilter: RoomTypeFilter;
  setActiveSharedRoomTypeFilter: (filter: RoomTypeFilter) => void;
  selectedSemesterIdForRoutineView: string | null;
  setSelectedSemesterIdForRoutineView: (semesterId: string | null) => void; 
  allSemesterConfigurations: SemesterCloneInfo[];
  logout: () => void; // Add logout prop
  sidebarStats: {
    teacherCount: number;
    uniqueCourseCount: number;
    sectionCount: number;
    slotRequirement: number;
    bookedSlotRequirement: number;
    roomCount: number;
    totalSlots: number;
    bookedSlots: number;
    attendanceLogCount: number;
  };
  slotUsageStats: { booked: number; total: number; };
  ciwCounts: Map<string, number>;
  classRequirementCounts: Map<string, number>;
  dashboardTabFilter: 'All' | 'Theory' | 'Lab';
  setDashboardTabFilter: (filter: 'All' | 'Theory' | 'Lab') => void;
  onShowCourseList: () => void;
  onShowSectionList: () => void;
  onShowRoomList: () => void;
  onShowTeacherList: () => void;
  onShowAttendanceLog: () => void;
  coursesData: EnrollmentEntry[];
  setCoursesData: React.Dispatch<React.SetStateAction<EnrollmentEntry[]>>;
  routineViewMode: RoutineViewMode;
  onToggleRoutineViewMode: () => void;
  routineDisplayMode: 'published' | 'editable';
  selectedLevelTermFilter: string | null;
  setSelectedLevelTermFilter: (levelTerm: string | null) => void;
  selectedSectionFilter: string | null;
  setSelectedSectionFilter: (section: string | null) => void;
  selectedTeacherIdFilter: string | null;
  setSelectedTeacherIdFilter: (teacherId: string | null) => void;
  selectedCourseSectionIdsFilter: string[];
  setSelectedCourseSectionIdsFilter: (sectionIds: string[]) => void;
  onPreviewTeacherRoutine: (teacherId: string | null) => void;
  onPreviewLevelTermRoutine: () => void;
  onPreviewFullRoutine: () => void;
  onPreviewCourseSectionRoutine: () => void;
  onUpdateLevelTerm: (sectionId: string, newLevelTerm: string) => void;
  onUpdateWeeklyClass: (sectionId: string, newWeeklyClass: number | undefined) => void;
  onUpdateCourseType: (sectionId: string, newCourseType: CourseType) => void;
  onBulkAssign: () => void;
  isBulkAssignDisabled: boolean;
  bulkAssignTooltip: string;
  versions?: { versionId: string; createdAt: string }[];
  activeVersionId?: string | null;
  onVersionChange?: (versionId: string) => void;
  onDeleteVersion?: (versionId: string) => void;
  unreadNotificationCount: number;
  pendingRequestCount: number;
  setRoutineData: React.Dispatch<React.SetStateAction<{ [semesterId: string]: SemesterRoutineData }>>;
}


const getFooterIconClasses = (currentOverlay: OverlayViewType | null, overlayTargetView: OverlayViewType) => {
    const base = "group relative flex flex-col items-center p-1 transition-all duration-200 ease-in-out transform-gpu"; 
    if (currentOverlay === overlayTargetView) {
      return `${base} text-[var(--color-accent-yellow-400)] scale-110`; 
    }
    return `${base} text-[var(--color-primary-200)] hover:text-[var(--color-accent-yellow-300)] scale-100`; 
};

const StatCard = ({ title, value, icon, onClick, isActive, disabled }: { title: string; value: string | number; icon: React.ReactNode, onClick?: () => void, isActive?: boolean, disabled?: boolean }) => {
    // Added 'border' class to baseClasses to make border colors visible.
    const baseClasses = "w-full p-1.5 rounded-md shadow-sm flex items-center gap-2 text-left transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-yellow-300 disabled:cursor-not-allowed border";
    
    // Active state is now indicated only by a yellow border. Other styles remain consistent.
    const activeClasses = isActive
      ? 'bg-teal-900 border-yellow-500 text-white enabled:hover:bg-teal-800'
      : 'bg-teal-900 border-teal-800 text-white enabled:hover:bg-teal-800';
    
    const iconContainerClasses = 'bg-teal-800 text-yellow-300';
      
    const titleClasses = 'text-teal-200';
    const valueClasses = 'text-white';

    const finalDisabled = disabled || !onClick;

    return (
        <button 
            onClick={onClick}
            disabled={finalDisabled}
            className={`${baseClasses} ${activeClasses} ${finalDisabled ? 'opacity-60' : ''}`}>
            <div className={`flex-shrink-0 p-1.5 rounded-md transition-colors duration-150 ${iconContainerClasses}`}>
                {icon}
            </div>
            <div className="min-w-0">
                <p className={`text-[10px] truncate ${titleClasses}`}>{title}</p>
                <p className={`text-sm font-bold ${valueClasses}`}>{disabled ? '--' : value}</p>
            </div>
        </button>
    );
};

const SlotRequirementTable = ({ 
    courses, ciwCounts, classRequirementCounts, onClose, activeTab, onTabChange, 
    onBulkAssign, isBulkAssignDisabled, bulkAssignTooltip,
    versions = [], activeVersionId, onVersionChange, onDeleteVersion,
    onEditSection, editingSectionId,
    canEdit,
    setRoutineData,
    selectedSemesterIdForRoutineView,
}: { 
    courses: EnrollmentEntry[], ciwCounts: Map<string, number>, classRequirementCounts: Map<string, number>, 
    onClose: () => void, activeTab: 'All' | 'Theory' | 'Lab', onTabChange: (tab: 'All' | 'Theory' | 'Lab') => void,
    onBulkAssign: () => void;
    isBulkAssignDisabled: boolean;
    bulkAssignTooltip: string;
    versions: { versionId: string; createdAt: string }[];
    activeVersionId: string | null;
    onVersionChange: (versionId: string) => void;
    onDeleteVersion: (versionId: string) => void;
    onEditSection: React.Dispatch<React.SetStateAction<EnrollmentEntry | null>>;
    editingSectionId: string | null;
    canEdit: boolean;
    setRoutineData: React.Dispatch<React.SetStateAction<{ [semesterId: string]: SemesterRoutineData }>>;
    selectedSemesterIdForRoutineView: string | null;
}) => {
    const { user } = useAuth();
    const containerRef = useRef<HTMLDivElement>(null);
    const filterPopoverRef = useRef<HTMLDivElement>(null);
    const versionDropdownRef = useRef<HTMLDivElement>(null);
    const [scrollTop, setScrollTop] = useState(0);
    const [containerHeight, setContainerHeight] = useState(0);
    type SortKey = 'courseCode' | 'section' | 'studentCount' | 'weeklyClass' | 'ciw';
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'courseCode', direction: 'asc' });
    
    const [levelTermFilter, setLevelTermFilter] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');

    const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);
    const [isVersionDropdownOpen, setIsVersionDropdownOpen] = useState(false);
    const [showTrimmedVersions, setShowTrimmedVersions] = useState(false);

    const handleCreateNewVersion = useCallback(() => {
        if (!selectedSemesterIdForRoutineView) {
            alert("Please select a semester to create a new version.");
            return;
        }
        setRoutineData(prev => {
            const newData = JSON.parse(JSON.stringify(prev));
            const semesterData = newData[selectedSemesterIdForRoutineView];
            if (!semesterData || !semesterData.activeVersionId) {
                alert("Cannot create a new version: No active version found for this semester.");
                return prev;
            }
            const activeVersion = semesterData.versions.find((v: RoutineVersion) => v.versionId === semesterData.activeVersionId);
            if (!activeVersion) {
                alert("Cannot create a new version: Active version data is corrupted.");
                return prev;
            }
            
            const newVersionId = `v-manual-${Date.now()}`;
            const newVersion: RoutineVersion = {
                versionId: newVersionId,
                createdAt: new Date().toISOString(),
                routine: activeVersion.routine, // Copy of the active routine
            };

            semesterData.versions.unshift(newVersion);
            semesterData.versions.sort((a: RoutineVersion, b: RoutineVersion) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            semesterData.activeVersionId = newVersionId;
            
            return newData;
        });
      }, [selectedSemesterIdForRoutineView, setRoutineData]);

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (filterPopoverRef.current && !filterPopoverRef.current.contains(event.target as Node)) {
          setIsFilterPopoverOpen(false);
        }
        if (versionDropdownRef.current && !versionDropdownRef.current.contains(event.target as Node)) {
          setIsVersionDropdownOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, []);
    
    const displayVersions = useMemo(() => {
        // If not trimming or not enough versions to trim, return the original list.
        if (!showTrimmedVersions || versions.length <= 11) {
            return versions.map(v => ({...v, isSeparator: false}));
        }

        const top10 = versions.slice(0, 10);
        const oldest = versions[versions.length - 1];

        // If the oldest version is already included in the top 10, no trimming is needed.
        if (top10.some(v => v.versionId === oldest.versionId)) {
             return versions.map(v => ({...v, isSeparator: false}));
        }

        // Return the trimmed and structured list for display.
        return [
            ...top10.map(v => ({...v, isSeparator: false})),
            { versionId: 'separator', createdAt: '', isSeparator: true },
            {...oldest, isSeparator: false}
        ];
    }, [versions, showTrimmedVersions]);

    const handleClearFilters = () => {
        setSearchQuery('');
        setLevelTermFilter('');
        onTabChange('All');
        setIsFilterPopoverOpen(false);
    };
    
    const formatVersionDate = (isoString: string) => {
        return new Date(isoString).toLocaleString(undefined, {
            month: 'short', day: 'numeric', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
        });
    };


    const isAnyFilterActive = searchQuery !== '' || levelTermFilter !== '' || activeTab !== 'All';

    const uniqueLevelTerms = useMemo(() => {
        const terms = new Set(courses.map(c => c.levelTerm).filter(Boolean));
        return Array.from(terms).sort((a: string, b: string) => {
          const aMatch = a.match(/L(\d+)T(\d+)/);
          const bMatch = b.match(/L(\d+)T(\d+)/);
          if (aMatch && bMatch) {
            const [, aL, aT] = aMatch.map(Number);
            const [, bL, bT] = bMatch.map(Number);
            if (aL !== bL) return aL - bL;
            return aT - bT;
          }
          return String(a).localeCompare(String(b));
        });
    }, [courses]);

    const filteredForTabAndSearchCourses = useMemo(() => {
        let filtered = courses;
        if (activeTab !== 'All') {
            filtered = filtered.filter(course => course.courseType === activeTab);
        }
        if (levelTermFilter) {
             if (levelTermFilter === 'N/A') {
                filtered = filtered.filter(course => !course.levelTerm || course.levelTerm.trim() === '' || course.levelTerm === 'N/A');
            } else {
                filtered = filtered.filter(course => course.levelTerm === levelTermFilter);
            }
        }
        if (searchQuery) {
            const lowercasedQuery = searchQuery.toLowerCase();
            filtered = filtered.filter(course =>
                course.courseCode.toLowerCase().includes(lowercasedQuery) ||
                course.courseTitle.toLowerCase().includes(lowercasedQuery) ||
                course.section.toLowerCase().includes(lowercasedQuery) ||
                course.teacherName.toLowerCase().includes(lowercasedQuery)
            );
        }
        return filtered;
    }, [courses, activeTab, levelTermFilter, searchQuery]);

    const sortedCourses = useMemo(() => {
        const sortableItems: EnrollmentEntry[] = [...filteredForTabAndSearchCourses];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                const { key, direction } = sortConfig;
                let aValue: string | number;
                let bValue: string | number;

                switch (key) {
                    case 'ciw':
                        aValue = ciwCounts.get(a.sectionId) ?? 0;
                        bValue = ciwCounts.get(b.sectionId) ?? 0;
                        break;
                    case 'studentCount':
                        aValue = a.studentCount;
                        bValue = b.studentCount;
                        break;
                    case 'weeklyClass':
                        aValue = a.weeklyClass ?? -1;
                        bValue = b.weeklyClass ?? -1;
                        break;
                    case 'courseCode':
                        aValue = a.courseCode.toLowerCase();
                        bValue = b.courseCode.toLowerCase();
                        break;
                    case 'section':
                        aValue = a.section.toLowerCase();
                        bValue = b.section.toLowerCase();
                        break;
                }

                if (aValue < bValue) return direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return sortableItems;
    }, [filteredForTabAndSearchCourses, sortConfig, ciwCounts]);

    const handleSort = (key: SortKey) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };
    
    const handleScroll = useCallback(() => {
        if (containerRef.current) {
            window.requestAnimationFrame(() => {
                setScrollTop(containerRef.current.scrollTop);
            });
        }
    }, []);

    useEffect(() => {
        if (containerRef.current) {
            setContainerHeight(containerRef.current.clientHeight);
            const resizeObserver = new ResizeObserver(entries => {
                for (let entry of entries) {
                    setContainerHeight(entry.contentRect.height);
                }
            });
            resizeObserver.observe(containerRef.current);
            return () => resizeObserver.disconnect();
        }
    }, []);

    const ROW_HEIGHT = 26;
    const OVERSCAN_COUNT = 10;

    const totalHeight = sortedCourses.length * ROW_HEIGHT;
    const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN_COUNT);
    const visibleRowsCount = containerHeight > 0 ? Math.ceil(containerHeight / ROW_HEIGHT) : 0;
    const endIndex = Math.min(sortedCourses.length, startIndex + visibleRowsCount + (2 * OVERSCAN_COUNT));
    
    const visibleCourses = useMemo(() => sortedCourses.slice(startIndex, endIndex), [sortedCourses, startIndex, endIndex]);
    const paddingTop = startIndex * ROW_HEIGHT;

    const gridLayoutClasses = "grid grid-cols-8 gap-x-2 px-2 items-center";

    const SortableHeader = ({ title, sortKey, justify = 'center', colSpanClass }: { title: string; sortKey: SortKey; justify?: 'start' | 'center' | 'end'; colSpanClass: string }) => {
        const isSorted = sortConfig.key === sortKey;
        const direction = isSorted ? sortConfig.direction : 'asc';
        const justifyClass = { start: 'justify-start', center: 'justify-center', end: 'justify-end' }[justify];

        return (
            <div className={`${colSpanClass} text-${justify === 'center' ? 'center' : 'left'}`}>
                <button
                    onClick={() => handleSort(sortKey)}
                    className={`flex items-center gap-1 font-semibold text-teal-200 hover:text-yellow-300 transition-colors w-full ${justifyClass}`}
                    title={`Sort by ${title}`}
                >
                    <span>{title}</span>
                    {isSorted ? (
                        direction === 'asc' ? 
                        <svg className="h-2.5 w-2.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"/></svg> :
                        <svg className="h-2.5 w-2.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
                    ) : (
                        <svg className="h-2.5 w-2.5 flex-shrink-0 text-teal-500" fill="currentColor" viewBox="0 0 20 20"><path d="M10 3a1 1 0 01.707.293l3 3a1 1 0 01-1.414 1.414L10 5.414 7.707 7.707a1 1 0 01-1.414-1.414l3-3A1 1 0 0110 3zm-3.707 9.293a1 1 0 011.414 0L10 14.586l2.293-2.293a1 1 0 011.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" /></svg>
                    )}
                </button>
            </div>
        );
    };

    const levelTermGrid = [['L1T1', 'L1T2', 'L1T3'], ['L2T1', 'L2T2', 'L2T3'], ['L3T1', 'L3T2', 'L3T3'], ['L4T1', 'L4T2', 'L4T3']];

    return (
        <div className="mt-3 flex flex-col h-full">
            <div className="flex justify-between items-center mb-2 flex-shrink-0">
                <div className="flex items-center gap-2">
                    <button onClick={onClose} className="text-xs text-yellow-300 hover:underline">
                        Back
                    </button>
                </div>
                <div className="flex items-center gap-2">
                     <div className="relative">
                        <input
                            type="search"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search..."
                            className="w-48 bg-teal-800 border border-teal-600 text-teal-100 rounded-md p-1 pl-7 text-xs focus:ring-1 focus:ring-yellow-400 focus:outline-none"
                        />
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 absolute left-1.5 top-1/2 -translate-y-1/2 text-teal-400" viewBox="0 0 20 20" fill="currentColor">
                           <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                         </svg>
                    </div>
                    <div className="relative" ref={filterPopoverRef}>
                        <button
                            onClick={() => setIsFilterPopoverOpen(prev => !prev)}
                            className="relative p-1.5 rounded-md bg-teal-800 border border-teal-600 text-teal-100 hover:bg-teal-700 focus:outline-none focus:ring-1 focus:ring-yellow-400"
                            aria-haspopup="true"
                            aria-expanded={isFilterPopoverOpen}
                            title="Open filters"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293.707L3.293 7.293A1 1 0 013 6.586V4z" />
                            </svg>
                            {isAnyFilterActive && (
                                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-300 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-yellow-400"></span>
                                </span>
                            )}
                        </button>
                         {isFilterPopoverOpen && (
                            <div
                                className="absolute z-20 mt-2 w-72 right-0 bg-teal-700 border border-teal-600 rounded-md shadow-lg p-3 space-y-3"
                            >
                                
                                <div>
                                    <label className="block text-xs text-teal-200 mb-1">Course Type</label>
                                    <div className="flex gap-1 p-0.5 bg-teal-900 rounded-md">
                                        {(['All', 'Theory', 'Lab'] as const).map(tab => (
                                            <button
                                                key={tab}
                                                onClick={() => onTabChange(tab)}
                                                className={`w-full text-center text-xs font-bold px-2 py-1 rounded-sm transition-all duration-200 ${
                                                    activeTab === tab 
                                                    ? 'bg-yellow-400 text-teal-900 shadow' 
                                                    : 'text-teal-200 hover:bg-teal-600'
                                                }`}
                                            >
                                                {tab}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs text-teal-200 mb-1">Level-Term</label>
                                    <div className="grid grid-cols-2 gap-1">
                                        <button
                                            onClick={() => setLevelTermFilter('')}
                                            className={`w-full text-center text-xs font-bold px-2 py-1.5 rounded-sm transition-all duration-200 ${
                                                levelTermFilter === '' 
                                                ? 'bg-yellow-400 text-teal-900 shadow' 
                                                : 'text-teal-200 bg-teal-800 hover:bg-teal-700'
                                            }`}
                                        >
                                            All
                                        </button>
                                        <button
                                            onClick={() => setLevelTermFilter('N/A')}
                                            className={`w-full text-center text-xs font-bold px-2 py-1.5 rounded-sm transition-all duration-200 ${
                                                levelTermFilter === 'N/A' 
                                                ? 'bg-yellow-400 text-teal-900 shadow' 
                                                : 'text-teal-200 bg-teal-800 hover:bg-teal-700'
                                            }`}
                                        >
                                            N/A
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-3 gap-1 mt-1">
                                        {levelTermGrid.flat().map(term => (
                                            <button
                                                key={term}
                                                onClick={() => setLevelTermFilter(term)}
                                                className={`w-full text-center text-xs font-bold px-2 py-1.5 rounded-sm transition-all duration-200 ${
                                                    levelTermFilter === term 
                                                    ? 'bg-yellow-400 text-teal-900 shadow' 
                                                    : 'text-teal-200 bg-teal-800 hover:bg-teal-700'
                                                }`}
                                            >
                                                {term.replace('T', '-T')}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex justify-between items-center pt-2 border-t border-teal-600/50">
                                    <h4 className="text-sm font-semibold text-teal-100"></h4>
                                    {isAnyFilterActive && (
                                        <button
                                            onClick={handleClearFilters}
                                            className="flex items-center gap-1 text-xs text-amber-400 hover:underline"
                                            title="Clear all filters"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            Clear Filters
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={onBulkAssign}
                        disabled={isBulkAssignDisabled}
                        className="p-1.5 rounded-md bg-yellow-400 text-teal-900 border border-yellow-500 hover:bg-yellow-300 focus:outline-none flex-shrink-0 disabled:bg-gray-600 disabled:text-gray-400 disabled:border-gray-700 disabled:cursor-not-allowed"
                        aria-label="Auto-assign sections to routine"
                        title={bulkAssignTooltip}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.293 2.293m-4.586 4.586L12 12m2.828 2.828l4.586 4.586M4 12H2m10 10V2m10 10h-2m-4.586-4.586L12 12m-2.293-2.293L5 5" />
                        </svg>
                    </button>
                    {user?.dashboardAccess?.canManageVersions && (
                    <div className="relative" ref={versionDropdownRef}>
                        <button
                            onClick={() => setIsVersionDropdownOpen(p => !p)}
                            className="p-1.5 rounded-md bg-teal-600 text-white border border-teal-500 hover:bg-teal-500 focus:outline-none flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label="Manage routine versions"
                            title="Manage routine versions"
                            disabled={!versions || versions.length === 0}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        </button>
                        {isVersionDropdownOpen && (
                            <div className="absolute right-0 mt-2 w-72 bg-teal-800 rounded-md shadow-lg z-50 border border-teal-600 flex flex-col">
                                <div className="px-3 py-2 border-b border-teal-600/50">
                                    <button
                                        onClick={handleCreateNewVersion}
                                        className="w-full text-center text-xs text-yellow-300 hover:underline font-semibold"
                                    >
                                        + Create New Version (Copy of Active)
                                    </button>
                                </div>
                                <div className="px-3 py-2 border-b border-teal-600/50">
                                    <button
                                        onClick={() => setShowTrimmedVersions(p => !p)}
                                        disabled={versions.length <= 11}
                                        className="w-full text-center text-xs text-yellow-300 hover:underline disabled:text-teal-400 disabled:cursor-not-allowed disabled:no-underline"
                                    >
                                        {showTrimmedVersions ? 'Show All Versions' : `Show Recent 10 + First`}
                                    </button>
                                </div>
                                <ul className="max-h-80 overflow-y-auto custom-scrollbar">
                                    {displayVersions && displayVersions.length > 0 ? (
                                        displayVersions.map(version => {
                                            if (version.isSeparator) {
                                                return (
                                                    <li key="separator" className="flex items-center justify-center py-2">
                                                        <span className="text-xs text-teal-400">... ({versions.length - 11} older versions hidden) ...</span>
                                                    </li>
                                                );
                                            }
                                            const isInitialVersion = version.versionId.startsWith('v-initial-');
                                            return (
                                            <li key={version.versionId} className="flex items-center justify-between px-3 py-2 text-sm text-teal-200 hover:bg-teal-700/50">
                                                <button
                                                    onClick={() => { if (onVersionChange) onVersionChange(version.versionId); setIsVersionDropdownOpen(false); }}
                                                    className={`flex-grow text-left text-xs ${version.versionId === activeVersionId ? 'font-bold text-yellow-300' : ''}`}
                                                >
                                                    {formatVersionDate(version.createdAt)} {isInitialVersion && '(Initial)'}
                                                </button>
                                                <button
                                                    onClick={() => onDeleteVersion && onDeleteVersion(version.versionId)}
                                                    disabled={version.versionId === activeVersionId || isInitialVersion}
                                                    className="p-1 text-teal-400 hover:text-red-400 disabled:text-teal-600 disabled:cursor-not-allowed disabled:hover:bg-transparent hover:bg-red-900/50 rounded-full"
                                                    title={isInitialVersion ? "The initial version cannot be deleted." : version.versionId === activeVersionId ? "Cannot delete the active version" : "Delete this version"}
                                                    aria-label="Delete version"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                                    </svg>
                                                </button>
                                            </li>
                                        )})
                                    ) : (
                                        <li className="px-3 py-2 text-sm text-teal-400 italic">No versions saved for this semester.</li>
                                    )}
                                </ul>
                            </div>
                        )}
                    </div>
                    )}
                </div>
            </div>
            
            <div
                ref={containerRef}
                onScroll={handleScroll}
                className="flex-grow overflow-y-auto no-scrollbar"
            >
                <div className={`sticky top-0 z-10 min-w-full text-xs ${gridLayoutClasses} py-1 bg-teal-800 rounded-t-md`}>
                    <SortableHeader title="Course Code" sortKey="courseCode" colSpanClass="col-span-3" justify="start" />
                    <SortableHeader title="Section" sortKey="section" colSpanClass="col-span-2" justify="start" />
                    <SortableHeader title="Stu" sortKey="studentCount" colSpanClass="col-span-1" />
                    <SortableHeader title="CR" sortKey="weeklyClass" colSpanClass="col-span-1" />
                    <SortableHeader title="CIW" sortKey="ciw" colSpanClass="col-span-1" />
                </div>

                {sortedCourses.length > 0 ? (
                    <div style={{ position: 'relative', height: `${totalHeight}px` }}>
                        <div style={{ position: 'absolute', top: `${paddingTop}px`, left: 0, right: 0 }}>
                            {visibleCourses.map((course: EnrollmentEntry) => {
                                const isSchedulable = course.levelTerm && course.levelTerm.trim() !== '' && course.levelTerm !== 'N/A' &&
                                                        course.courseType && course.courseType !== 'N/A' &&
                                                        course.weeklyClass && course.weeklyClass > 0;

                                let tooltip = '';
                                if (!isSchedulable) {
                                    const reasons = [];
                                    if (!course.levelTerm || course.levelTerm.trim() === '' || course.levelTerm === 'N/A') reasons.push('missing Level-Term');
                                    if (!course.courseType || course.courseType === 'N/A') reasons.push('missing Course Type');
                                    if (!course.weeklyClass || course.weeklyClass <= 0) reasons.push('missing or zero Weekly Classes');
                                    tooltip = `Cannot schedule: ${reasons.join(', ')}. ${canEdit ? 'Click to edit.' : ''}`;
                                } else {
                                    tooltip = `Drag to assign this section to the routine grid. ${canEdit ? 'Click to edit.' : ''}`;
                                }

                                const cursorClass = isSchedulable ? 'cursor-grab' : (canEdit ? 'cursor-pointer' : 'cursor-default');
                                
                                return (
                                    <div 
                                        key={course.sectionId}
                                        draggable={isSchedulable}
                                        onClick={canEdit ? () => onEditSection(prev => prev?.sectionId === course.sectionId ? null : course) : undefined}
                                        onDragStart={(e) => {
                                            if (!isSchedulable) {
                                                e.preventDefault();
                                                return;
                                            }
                                            const payload = { type: 'courseSectionDrop', sectionId: course.sectionId };
                                            e.dataTransfer.setData('application/json', JSON.stringify(payload));
                                            e.dataTransfer.effectAllowed = 'copy';
                                        }}
                                        className={`min-w-full text-xs ${gridLayoutClasses} py-1 hover:bg-teal-700/50 border-b border-teal-700/50 ${editingSectionId === course.sectionId ? 'bg-teal-600' : ''} ${!isSchedulable ? 'opacity-60' : ''} ${cursorClass}`} 
                                        style={{ height: `${ROW_HEIGHT}px` }}
                                        title={tooltip}
                                    >
                                        <div className="col-span-3 font-medium truncate" title={course.courseCode}>{course.courseCode}</div>
                                        <div className="col-span-2 truncate" title={course.section}>{course.section}</div>
                                        <div className="col-span-1 text-center">{course.studentCount}</div>
                                        <div className="col-span-1 text-center font-semibold text-purple-300">{course.weeklyClass ?? 0}</div>
                                        <div className="col-span-1 text-center font-semibold text-blue-300">{ciwCounts.get(course.sectionId) ?? 0}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-6 text-sm text-teal-300 italic">No courses match the current filters.</div>
                )}
            </div>
        </div>
    );
};

const RoutineFiltersAndPreview = ({
    user,
    coursesData,
    selectedSemesterIdForRoutineView,
    selectedProgramIdForRoutineView,
    programs,
    handleTeacherSelect,
    selectedTeacherIdFilter,
    handleCourseSectionSelect,
    selectedCourseSectionIdsFilter,
    handleLevelTermSelect,
    selectedLevelTermFilter,
    setSelectedSectionFilter,
    selectedSectionFilter,
    handlePreviewClick,
    isPreviewDisabled,
    previewTitle,
}) => {
    const levelTermFilters = useMemo(() => {
        let relevantCourses = coursesData;
        if (selectedSemesterIdForRoutineView) {
            relevantCourses = relevantCourses.filter(c => c.semester === selectedSemesterIdForRoutineView);
        }
        const selectedProgram = selectedProgramIdForRoutineView ? programs.find(p => p.id === selectedProgramIdForRoutineView) : null;
        if (selectedProgram) {
            relevantCourses = relevantCourses.filter(c => c.pId === selectedProgram.pId);
        }
        const terms = new Set(relevantCourses.map(c => c.levelTerm).filter(Boolean));
        return Array.from(terms).sort((a: string, b: string) => {
            const aMatch = a.match(/L(\d+)T(\d+)/);
            const bMatch = b.match(/L(\d+)T(\d+)/);
            if (aMatch && bMatch) {
                const [, aL, aT] = aMatch.map(Number);
                const [, bL, bT] = bMatch.map(Number);
                if (aL !== bL) return aL - bL;
                return aT - bT;
            }
            return a.localeCompare(b);
        });
    }, [coursesData, selectedSemesterIdForRoutineView, selectedProgramIdForRoutineView, programs]);

    const teacherFilterOptions = useMemo(() => {
        let relevantCourses = coursesData;
        if (selectedSemesterIdForRoutineView) {
            relevantCourses = relevantCourses.filter(c => c.semester === selectedSemesterIdForRoutineView);
        }
        const selectedProgram = selectedProgramIdForRoutineView ? programs.find(p => p.id === selectedProgramIdForRoutineView) : null;
        if (selectedProgram) {
            relevantCourses = relevantCourses.filter(c => c.pId === selectedProgram.pId);
        }
        const teacherMap = new Map<string, { employeeId: string; teacherName: string; designation: string }>();
        relevantCourses.forEach(course => {
            if (course.teacherId && course.teacherName && !teacherMap.has(course.teacherId)) {
                teacherMap.set(course.teacherId, { employeeId: course.teacherId, teacherName: course.teacherName, designation: course.designation });
            }
        });
        return Array.from(teacherMap.values()).sort((a, b) => a.teacherName.localeCompare(b.teacherName));
    }, [coursesData, selectedSemesterIdForRoutineView, selectedProgramIdForRoutineView, programs]);

    const courseSectionFilterOptions = useMemo(() => {
        let relevantCourses = coursesData;
        if (selectedSemesterIdForRoutineView) {
            relevantCourses = relevantCourses.filter(c => c.semester === selectedSemesterIdForRoutineView);
        }
        const selectedProgram = selectedProgramIdForRoutineView ? programs.find(p => p.id === selectedProgramIdForRoutineView) : null;
        if (selectedProgram) {
            relevantCourses = relevantCourses.filter(c => c.pId === selectedProgram.pId);
        }
        return relevantCourses.sort((a, b) => a.courseCode.localeCompare(b.courseCode) || a.section.localeCompare(b.section));
    }, [coursesData, selectedSemesterIdForRoutineView, selectedProgramIdForRoutineView, programs]);
    
    const sectionFilterOptions = useMemo(() => {
        if (!selectedLevelTermFilter) return [];
        let relevantCourses = coursesData;
        if (selectedSemesterIdForRoutineView) {
            relevantCourses = relevantCourses.filter(c => c.semester === selectedSemesterIdForRoutineView);
        }
        const selectedProgram = selectedProgramIdForRoutineView ? programs.find(p => p.id === selectedProgramIdForRoutineView) : null;
        if (selectedProgram) {
            relevantCourses = relevantCourses.filter(c => c.pId === selectedProgram.pId);
        }
        relevantCourses = relevantCourses.filter(c => c.levelTerm === selectedLevelTermFilter);
        const sections = new Set(relevantCourses.map(c => c.section));
        return Array.from(sections).sort((a,b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    }, [coursesData, selectedSemesterIdForRoutineView, selectedProgramIdForRoutineView, programs, selectedLevelTermFilter]);

    const levelTermGrid = [['L1T1', 'L1T2', 'L1T3'], ['L2T1', 'L2T2', 'L2T3'], ['L3T1', 'L3T2', 'L3T3'], ['L4T1', 'L4T2', 'L4T3']];

    return (
        <div className="mt-3 bg-teal-900 p-2 rounded-md shadow-sm border border-teal-800 flex flex-col gap-4">
             <div className="grid grid-cols-2 gap-2">
                {teacherFilterOptions.length > 0 && (
                  <div>
                    <h4 className="text-[10px] text-teal-200 mb-1 font-semibold">Filter by Teacher</h4>
                    <SearchableTeacherDropdown
                      teachers={teacherFilterOptions}
                      selectedTeacherId={selectedTeacherIdFilter}
                      onTeacherSelect={handleTeacherSelect}
                      buttonClassName="w-full flex items-center justify-between p-1 text-[11px] sm:text-xs rounded-md transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-[var(--color-accent-yellow-400)] focus:ring-offset-1 focus:ring-offset-teal-900 bg-teal-800 border border-teal-600 shadow-sm hover:bg-teal-700/50"
                      dropdownClassName="absolute z-20 w-full mt-1 bg-teal-900 rounded-md shadow-lg max-h-60 overflow-auto custom-scrollbar border border-teal-600"
                    />
                  </div>
                )}
                {courseSectionFilterOptions.length > 0 && (
                  <div>
                    <h4 className="text-[10px] text-teal-200 mb-1 font-semibold">Filter by Section</h4>
                    <SearchableCourseSectionDropdown
                      courses={courseSectionFilterOptions}
                      selectedSectionIds={selectedCourseSectionIdsFilter}
                      onSelectionChange={handleCourseSectionSelect}
                    />
                  </div>
                )}
              </div>
              
              {levelTermFilters.length > 0 && (
                <div>
                    <div className="flex justify-between items-center mb-1">
                        <h4 className="text-[10px] text-teal-200 font-semibold">Filter by Level-Term</h4>
                    </div>
                    <div className="space-y-1">
                        <div className="grid grid-cols-2 gap-1">
                            <button onClick={() => handleLevelTermSelect(null)} className={`w-full px-2 py-0.5 text-xs font-bold rounded-sm transition-all duration-200 ${ selectedLevelTermFilter === null ? 'bg-yellow-400 text-teal-900 shadow' : 'text-teal-200 bg-teal-800 hover:bg-teal-700/50' }`}>All</button>
                            <button onClick={() => handleLevelTermSelect('N/A')} className={`w-full px-2 py-0.5 text-xs font-bold rounded-sm transition-all duration-200 ${ selectedLevelTermFilter === 'N/A' ? 'bg-yellow-400 text-teal-900 shadow' : 'text-teal-200 bg-teal-800 hover:bg-teal-700/50' }`}>N/A</button>
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                            {levelTermGrid.flat().map(term => (<button key={term} onClick={() => handleLevelTermSelect(term)} className={`px-2 py-0.5 text-xs font-bold rounded-sm transition-all duration-200 ${ selectedLevelTermFilter === term ? 'bg-yellow-400 text-teal-900 shadow' : 'text-teal-200 bg-teal-800 hover:bg-teal-700/50' }`}>{term.replace('T', '-T')}</button>))}
                        </div>
                    </div>
                </div>
              )}
              {selectedLevelTermFilter && selectedLevelTermFilter !== 'N/A' && sectionFilterOptions.length > 0 && (
                <div>
                  <h4 className="text-[10px] text-teal-200 mb-1 font-semibold">Filter by Section</h4>
                  <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto custom-scrollbar pr-1">
                    <button onClick={() => setSelectedSectionFilter(null)} className={`px-2 py-0.5 text-xs font-bold rounded-sm transition-all duration-200 ${ selectedSectionFilter === null ? 'bg-yellow-400 text-teal-900 shadow' : 'text-teal-200 bg-teal-800 hover:bg-teal-700/50' }`}>All</button>
                    {sectionFilterOptions.map(section => (<button key={section} onClick={() => setSelectedSectionFilter(section)} className={`px-2 py-0.5 text-xs font-bold rounded-sm transition-all duration-200 ${ selectedSectionFilter === section ? 'bg-yellow-400 text-teal-900 shadow' : 'text-teal-200 bg-teal-800 hover:bg-teal-700/50' }`}>{section}</button>))}
                  </div>
                </div>
              )}
              <div className="border-t border-teal-800/50 pt-3 mt-1">
                <button onClick={handlePreviewClick} disabled={isPreviewDisabled} className="w-full flex items-center justify-center gap-2 p-2 text-sm font-semibold text-teal-800 bg-yellow-400 rounded-md shadow-md transition-all enabled:hover:bg-yellow-300 disabled:bg-teal-800 disabled:text-teal-500 disabled:cursor-not-allowed" title={previewTitle}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.022 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>
                  <span>Preview Routine</span>
                </button>
              </div>
        </div>
    );
};


const Sidebar: React.FC<SidebarProps> = React.memo((props) => {
  const { 
    onMainViewChange, onOverlayToggle, currentMainView, currentOverlay, onSelectProgramForRoutineView,
    selectedProgramIdForRoutineView, activeAssignedRoomTypeFilter, setActiveAssignedRoomTypeFilter,
    activeSharedRoomTypeFilter, setActiveSharedRoomTypeFilter, selectedSemesterIdForRoutineView,
    setSelectedSemesterIdForRoutineView, allSemesterConfigurations, logout, sidebarStats, slotUsageStats,
    ciwCounts, classRequirementCounts, dashboardTabFilter, setDashboardTabFilter, onShowCourseList,
    onShowSectionList, onShowRoomList, onShowTeacherList, onShowAttendanceLog, coursesData, setCoursesData,
    routineViewMode, onToggleRoutineViewMode, routineDisplayMode, selectedLevelTermFilter, setSelectedLevelTermFilter,
    selectedSectionFilter, setSelectedSectionFilter, selectedTeacherIdFilter, setSelectedTeacherIdFilter,
    selectedCourseSectionIdsFilter, setSelectedCourseSectionIdsFilter, onPreviewTeacherRoutine, onPreviewLevelTermRoutine,
    onPreviewFullRoutine, onPreviewCourseSectionRoutine, onUpdateLevelTerm, onUpdateWeeklyClass, onUpdateCourseType,
    onBulkAssign, isBulkAssignDisabled, bulkAssignTooltip, versions = [], activeVersionId, onVersionChange,
    onDeleteVersion, unreadNotificationCount, pendingRequestCount, setRoutineData
  } = props;
  const { programs: allProgramsFromCtx, loading: programsLoading } = usePrograms();
  const { user } = useAuth();
  const [showSlotRequirements, setShowSlotRequirements] = useState(false);
  const [editingSection, setEditingSection] = useState<EnrollmentEntry | null>(null);
  
  const programs = useMemo(() => {
    if (programsLoading || !allProgramsFromCtx) return [];
    if (user?.role === 'admin') return allProgramsFromCtx;
    if (user) {
        const isTeacher = user.employeeId && coursesData.some(course => course.teacherId === user.employeeId);
        if (isTeacher) {
            const teacherProgramPIds = new Set(coursesData.filter(course => course.teacherId === user.employeeId).map(course => course.pId));
            return allProgramsFromCtx.filter(p => teacherProgramPIds.has(p.pId));
        }
        if (Array.isArray(user.accessibleProgramPIds)) {
            const accessiblePIds = new Set(user.accessibleProgramPIds);
            return allProgramsFromCtx.filter(p => accessiblePIds.has(p.pId));
        }
    }
    return [];
  }, [allProgramsFromCtx, user, programsLoading, coursesData]);

  useEffect(() => {
    if (!showSlotRequirements) {
        setEditingSection(null);
    }
  }, [showSlotRequirements]);

  const coursesForSlotRequirementView = useMemo(() => {
    let relevantCourses = coursesData;
    if (selectedSemesterIdForRoutineView) {
      relevantCourses = relevantCourses.filter(c => c.semester === selectedSemesterIdForRoutineView);
    }
    const selectedProgram = selectedProgramIdForRoutineView ? programs.find(p => p.id === selectedProgramIdForRoutineView) : null;
    if (selectedProgram) {
      relevantCourses = relevantCourses.filter(c => c.pId === selectedProgram.pId);
    }
    return relevantCourses.sort((a,b) => a.courseCode.localeCompare(b.courseCode) || a.section.localeCompare(b.section));
  }, [coursesData, selectedSemesterIdForRoutineView, selectedProgramIdForRoutineView, programs]);

  const filteredCoursesForDownload = useMemo(() => {
    let filtered = coursesData;
    if (selectedSemesterIdForRoutineView) {
      filtered = filtered.filter(c => c.semester === selectedSemesterIdForRoutineView);
    }
    if (selectedProgramIdForRoutineView) {
      const selectedProgram = programs.find(p => p.id === selectedProgramIdForRoutineView);
      if (selectedProgram) {
        filtered = filtered.filter(c => c.pId === selectedProgram.pId);
      }
    }
    return filtered;
  }, [coursesData, selectedSemesterIdForRoutineView, selectedProgramIdForRoutineView, programs]);

  const uniqueSemestersForRoutineDropdown = useMemo(() => {
    const semesters = [...new Set(allSemesterConfigurations.map(c => c.targetSemester))];
    return semesters.sort((a, b) => {
        const semesterOrder = ['Spring', 'Summer', 'Fall'];
        const [aSem, aYear] = a.split(' ');
        const [bSem, bYear] = b.split(' ');
        if (aYear !== bYear) return (parseInt(bYear) || 0) - (parseInt(aYear) || 0);
        return semesterOrder.indexOf(aSem) - semesterOrder.indexOf(bSem);
    });
  }, [allSemesterConfigurations]);
  
  const handleProgramQuickViewSelect = (programObjectId: string | null) => {
    onSelectProgramForRoutineView(programObjectId);
  };
  
  const handleSemesterQuickViewSelect = (semesterId: string | null) => {
    setSelectedSemesterIdForRoutineView(semesterId); 
  };

  const handleTeacherSelect = useCallback((teacherId: string | null) => {
    setSelectedTeacherIdFilter(teacherId);
    if (teacherId) {
      setSelectedLevelTermFilter(null);
      setSelectedSectionFilter(null);
      setSelectedCourseSectionIdsFilter([]);
    }
  }, [setSelectedTeacherIdFilter, setSelectedLevelTermFilter, setSelectedSectionFilter, setSelectedCourseSectionIdsFilter]);

  const handleLevelTermSelect = useCallback((levelTerm: string | null) => {
    setSelectedLevelTermFilter(levelTerm);
    if (levelTerm) {
      setSelectedSectionFilter(null);
      setSelectedTeacherIdFilter(null);
      setSelectedCourseSectionIdsFilter([]);
    }
  }, [setSelectedLevelTermFilter, setSelectedSectionFilter, setSelectedTeacherIdFilter, setSelectedCourseSectionIdsFilter]);

  const handleCourseSectionSelect = useCallback((sectionIds: string[]) => {
    setSelectedCourseSectionIdsFilter(sectionIds);
    if (sectionIds.length > 0) {
        setSelectedLevelTermFilter(null);
        setSelectedSectionFilter(null);
        setSelectedTeacherIdFilter(null);
    }
  }, [setSelectedCourseSectionIdsFilter, setSelectedLevelTermFilter, setSelectedSectionFilter, setSelectedTeacherIdFilter]);


  const handleAssignedRoomTypeFilterClick = (filter: 'Theory' | 'Lab') => {
    setActiveAssignedRoomTypeFilter(filter);
  };

  const handleSharedRoomTypeFilterClick = (filter: 'Theory' | 'Lab') => {
    setActiveSharedRoomTypeFilter(filter);
  };
  
  const handleDashboardCardClick = (view: MainViewType) => {
    if (currentMainView === view) {
        onMainViewChange('routine');
    } else {
        onMainViewChange(view);
    }
  };

  const commonDropdownButtonStyles = "w-full flex items-center justify-between p-1 text-[11px] sm:text-xs rounded-md transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-[var(--color-accent-yellow-400)] focus:ring-offset-1 focus:ring-offset-[var(--color-primary-800)] bg-[var(--color-primary-800)] border border-[var(--color-primary-600)] shadow-md hover:bg-[var(--color-primary-700)] hover:border-[var(--color-primary-500)]";
  
  let programDropdownButtonClass = commonDropdownButtonStyles;
  if (selectedProgramIdForRoutineView) { 
    programDropdownButtonClass += " text-[var(--color-accent-yellow-300)]"; 
  } else {
    programDropdownButtonClass += " text-[var(--color-primary-100)] hover:text-[var(--color-accent-yellow-300)]"; 
  }

  let semesterDropdownButtonClass = commonDropdownButtonStyles;
  if (selectedSemesterIdForRoutineView) {
    semesterDropdownButtonClass += " text-[var(--color-accent-yellow-300)]";
  } else {
    semesterDropdownButtonClass += " text-[var(--color-primary-100)] hover:text-[var(--color-accent-yellow-300)]";
  }


  const ProgramDropdownIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 sm:h-3.5 sm:w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0 0 12 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75Z" />
    </svg>
  );
  
  const SemesterDropdownIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 sm:h-3.5 sm:w-3.5" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
    </svg>
  );

  const roomFilterButtonBaseClasses = "text-[9px] px-1 py-0.5 sm:px-1.5 sm:py-0.5 md:text-[11px] font-medium rounded-md border transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-[var(--color-accent-yellow-400)] focus:ring-offset-1 focus:ring-offset-[var(--color-primary-800)]";
  const roomFilterTitleClasses = "text-[8px] sm:text-[9px] md:text-[10px] text-[var(--color-primary-300)] mb-0.5 sm:mb-1 text-center";
  const allProgramsListItemText = "All Programs";

  const semesterDropdownItemsForSearchable = useMemo(() => {
    return uniqueSemestersForRoutineDropdown.map(sem => ({
      id: sem, pId: '', shortName: sem, fullName: '', faculty: '', type: 'Undergraduate' as ProgramType, semesterSystem: 'Tri-Semester' as SemesterSystem, programSpecificSlots: []
    }));
  }, [uniqueSemestersForRoutineDropdown]);
  
  const teacherForTitle = useMemo(() => {
    if (!selectedTeacherIdFilter) return null;
    const teacher = coursesData.find(c => c.teacherId === selectedTeacherIdFilter);
    return teacher ? { teacherName: teacher.teacherName } : null;
  }, [selectedTeacherIdFilter, coursesData]);

  const previewTitle = useMemo(() => {
    if (selectedCourseSectionIdsFilter.length > 0) return `Preview routine for ${selectedCourseSectionIdsFilter.length} selected sections`;
    if (selectedTeacherIdFilter) return `Preview routine for ${teacherForTitle?.teacherName || 'selected teacher'}`;
    if (selectedLevelTermFilter && selectedLevelTermFilter !== 'N/A') return `Preview routine for ${selectedLevelTermFilter}${selectedSectionFilter ? ` Section ${selectedSectionFilter}` : ''}`;
    if (selectedProgramIdForRoutineView && selectedSemesterIdForRoutineView) {
        const prog = programs.find(p => p.id === selectedProgramIdForRoutineView);
        return `Preview full routine for ${prog?.shortName || ''} (${selectedSemesterIdForRoutineView})`;
    }
    return "Select a Program and Semester to preview routine";
  }, [selectedCourseSectionIdsFilter, selectedTeacherIdFilter, selectedLevelTermFilter, selectedSectionFilter, teacherForTitle, selectedProgramIdForRoutineView, selectedSemesterIdForRoutineView, programs]);

  const isPreviewDisabled = !selectedProgramIdForRoutineView || !selectedSemesterIdForRoutineView;

  const canEditCourseSectionDetails = !!user?.dashboardAccess?.canEditCourseSectionDetails;
  
  const footerContent = (
      <div className="bg-[var(--color-primary-800)] p-2 flex justify-around items-center w-full">
          <button onClick={() => onOverlayToggle('settings')} className={getFooterIconClasses(currentOverlay, 'settings')} aria-label="Settings" aria-pressed={currentOverlay === 'settings'}><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426-1.756-2.924-1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0 3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg><span className="absolute left-1/2 transform -translate-x-1/2 bottom-full mb-1.5 opacity-0 group-hover:opacity-100 bg-gray-700 text-white text-xs px-2 py-0.5 rounded-md shadow-lg whitespace-nowrap transition-opacity duration-200 pointer-events-none">Settings</span></button>
          {user?.role === 'admin' && (<button onClick={() => onOverlayToggle('userManagement')} className={getFooterIconClasses(currentOverlay, 'userManagement')} aria-label="User Management" aria-pressed={currentOverlay === 'userManagement'}><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm-9 3a2 2 0 11-4 0 2 2 0 014 0z" /></svg><span className="absolute left-1/2 transform -translate-x-1/2 bottom-full mb-1.5 opacity-0 group-hover:opacity-100 bg-gray-700 text-white text-xs px-2 py-0.5 rounded-md shadow-lg whitespace-nowrap transition-opacity duration-200 pointer-events-none">Users</span></button>)}
          <button onClick={() => onOverlayToggle('notifications')} className={getFooterIconClasses(currentOverlay, 'notifications')} aria-label="Notifications" aria-pressed={currentOverlay === 'notifications'}><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>{((user?.notificationAccess?.canApproveSlots && pendingRequestCount > 0) || (user?.notificationAccess?.canGetNotification && unreadNotificationCount > 0)) && (<div className="absolute top-0 right-0 -mt-1.5 -mr-1.5 flex items-center">{user?.notificationAccess?.canApproveSlots && pendingRequestCount > 0 && (<span className="flex items-center justify-center h-4 min-w-[1rem] px-1 rounded-full bg-amber-400 text-black text-[9px] font-bold ring-2 ring-[var(--color-primary-800)]" title={`${pendingRequestCount} pending requests`}>{pendingRequestCount}</span>)}{user?.notificationAccess?.canGetNotification && unreadNotificationCount > 0 && (<span className={`flex items-center justify-center h-4 min-w-[1rem] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold ring-2 ring-[var(--color-primary-800)] ${user?.notificationAccess?.canApproveSlots && pendingRequestCount > 0 ? '-ml-1.5' : ''}`} title={`${unreadNotificationCount} unread notifications`}>{unreadNotificationCount}</span>)}</div>)}<span className="absolute left-1/2 transform -translate-x-1/2 bottom-full mb-1.5 opacity-0 group-hover:opacity-100 bg-gray-700 text-white text-xs px-2 py-0.5 rounded-md shadow-lg whitespace-nowrap transition-opacity duration-200 pointer-events-none">Notify</span></button>
          <button onClick={logout} className="group relative flex flex-col items-center p-1 text-[var(--color-primary-200)] hover:text-red-400" aria-label="Logout"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg><span className="absolute left-1/2 transform -translate-x-1/2 bottom-full mb-1.5 opacity-0 group-hover:opacity-100 bg-gray-700 text-white text-xs px-2 py-0.5 rounded-md shadow-lg whitespace-nowrap transition-opacity duration-200 pointer-events-none">Logout</span></button>
      </div>
  );

  return (
    <div className={`${SHARED_SIDE_PANEL_WIDTH_CLASSES} h-full relative flex-shrink-0`}>
      <aside className={`bg-gradient-to-b from-[var(--color-primary-700)] to-[var(--color-primary-900)] text-slate-100 w-full h-full shadow-lg flex flex-col ${SIDEBAR_FOOTER_PADDING_BOTTOM_CLASS}`}>
        
        {editingSection && (
            <div className="p-2 sm:p-2.5 bg-teal-800 border-y border-teal-600/50">
                 <CourseSectionEditor
                    course={editingSection}
                    onSave={(sectionId, stagedEdits) => {
                        onUpdateLevelTerm(sectionId, stagedEdits.levelTerm);
                        onUpdateWeeklyClass(sectionId, stagedEdits.weeklyClass);
                        onUpdateCourseType(sectionId, stagedEdits.courseType);
                        setEditingSection(null);
                    }}
                    onCancel={() => setEditingSection(null)}
                    theme="dark"
                />
            </div>
        )}

        <div className="flex-shrink-0 space-y-1.5 px-2 sm:px-2.5 pt-2"> 
          <div className="flex gap-2 sm:gap-2">
            <div className="flex-1 min-w-0">{semesterDropdownItemsForSearchable.length > 0 ? (<SearchableProgramDropdown programs={semesterDropdownItemsForSearchable} selectedProgramId={selectedSemesterIdForRoutineView} onProgramSelect={handleSemesterQuickViewSelect} placeholderText={"Select a Semester"} icon={<SemesterDropdownIcon />} buttonClassName={semesterDropdownButtonClass} showAllProgramsListItem={false}/>) : (<div className={`${semesterDropdownButtonClass} opacity-75 cursor-not-allowed`}>No semesters found.</div>)}</div>
            <div className="flex-1 min-w-0">{programsLoading ? (<div className={`${programDropdownButtonClass} opacity-75`}>Loading...</div>) : programs.length > 0 ? (<SearchableProgramDropdown programs={programs} selectedProgramId={selectedProgramIdForRoutineView} onProgramSelect={handleProgramQuickViewSelect} placeholderText={allProgramsListItemText} icon={<ProgramDropdownIcon />} buttonClassName={programDropdownButtonClass} showAllProgramsListItem={true} allProgramsListItemText={allProgramsListItemText}/>) : (<div className={`${programDropdownButtonClass} opacity-75 cursor-not-allowed`}>No programs.</div>)}</div>
          </div>
          <div className={`mt-1.5 flex gap-2 sm:gap-2`}>
            <div className="flex-1"><p className={roomFilterTitleClasses}>Assigned Rooms</p><div className="flex items-center gap-1 sm:gap-1.5"><button onClick={() => handleAssignedRoomTypeFilterClick('Theory')} className={`${roomFilterButtonBaseClasses} flex-1 ${activeAssignedRoomTypeFilter === 'Theory' ? 'bg-[var(--color-accent-yellow-400)] text-[var(--color-primary-800)] border-[var(--color-accent-yellow-500)]' : 'bg-[var(--color-primary-800)] text-[var(--color-primary-100)] hover:bg-[var(--color-primary-700)] hover:text-[var(--color-accent-yellow-300)] border-[var(--color-primary-600)]'}`} aria-pressed={activeAssignedRoomTypeFilter === 'Theory'}>Theory</button><button onClick={() => handleAssignedRoomTypeFilterClick('Lab')} className={`${roomFilterButtonBaseClasses} flex-1 ${activeAssignedRoomTypeFilter === 'Lab' ? 'bg-[var(--color-accent-yellow-400)] text-[var(--color-primary-800)] border-[var(--color-accent-yellow-500)]' : 'bg-[var(--color-primary-800)] text-[var(--color-primary-100)] hover:bg-[var(--color-primary-700)] hover:text-[var(--color-accent-yellow-300)] border-[var(--color-primary-600)]'}`} aria-pressed={activeAssignedRoomTypeFilter === 'Lab'}>Lab</button></div></div>
            <div className="flex-1"><p className={roomFilterTitleClasses}>Shared Rooms</p><div className="flex items-center gap-1 sm:gap-1.5"><button onClick={() => handleSharedRoomTypeFilterClick('Theory')} className={`${roomFilterButtonBaseClasses} flex-1 ${activeSharedRoomTypeFilter === 'Theory' ? 'bg-[var(--color-accent-yellow-400)] text-[var(--color-primary-800)] border-[var(--color-accent-yellow-500)]' : 'bg-[var(--color-primary-800)] text-[var(--color-primary-100)] hover:bg-[var(--color-primary-700)] hover:text-[var(--color-accent-yellow-300)] border-[var(--color-primary-600)]'}`} aria-pressed={activeSharedRoomTypeFilter === 'Theory'}>Theory</button><button onClick={() => handleSharedRoomTypeFilterClick('Lab')} className={`${roomFilterButtonBaseClasses} flex-1 ${activeSharedRoomTypeFilter === 'Lab' ? 'bg-[var(--color-accent-yellow-400)] text-[var(--color-primary-800)] border-[var(--color-accent-yellow-500)]' : 'bg-[var(--color-primary-800)] text-[var(--color-primary-100)] hover:bg-[var(--color-primary-700)] hover:text-[var(--color-accent-yellow-300)] border-[var(--color-primary-600)]'}`} aria-pressed={activeSharedRoomTypeFilter === 'Lab'}>Lab</button></div></div>
          </div>
        </div>

        <div className="flex-grow flex flex-col min-h-0 overflow-y-auto no-scrollbar px-2 sm:px-2.5 pb-2">
            {selectedSemesterIdForRoutineView === null ? (
              <div className="h-full flex flex-col items-center justify-center p-4 text-center text-teal-200 bg-teal-800/50 rounded-md mt-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-teal-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <p className="font-semibold text-sm">Dashboard is Unavailable</p>
                <p className="text-xs mt-1">Please select a semester to view dashboard and filters.</p>
              </div>
            ) : (
                <>
                    <RoutineFiltersAndPreview
                        user={user}
                        coursesData={coursesData}
                        selectedSemesterIdForRoutineView={selectedSemesterIdForRoutineView}
                        selectedProgramIdForRoutineView={selectedProgramIdForRoutineView}
                        programs={programs}
                        handleTeacherSelect={handleTeacherSelect}
                        selectedTeacherIdFilter={selectedTeacherIdFilter}
                        handleCourseSectionSelect={handleCourseSectionSelect}
                        selectedCourseSectionIdsFilter={selectedCourseSectionIdsFilter}
                        handleLevelTermSelect={handleLevelTermSelect}
                        selectedLevelTermFilter={selectedLevelTermFilter}
                        setSelectedSectionFilter={setSelectedSectionFilter}
                        selectedSectionFilter={selectedSectionFilter}
                        handlePreviewClick={onPreviewFullRoutine}
                        isPreviewDisabled={isPreviewDisabled}
                        previewTitle={previewTitle}
                    />
                    {routineDisplayMode === 'editable' && (
                        showSlotRequirements ? (
                            <SlotRequirementTable 
                                courses={coursesForSlotRequirementView} ciwCounts={ciwCounts} classRequirementCounts={classRequirementCounts}
                                onClose={() => setShowSlotRequirements(false)} activeTab={dashboardTabFilter} onTabChange={setDashboardTabFilter}
                                onBulkAssign={onBulkAssign} isBulkAssignDisabled={isBulkAssignDisabled} bulkAssignTooltip={bulkAssignTooltip}
                                versions={versions || []} activeVersionId={activeVersionId || null}
                                onVersionChange={onVersionChange || (() => {})} onDeleteVersion={onDeleteVersion || (() => {})}
                                onEditSection={setEditingSection} editingSectionId={editingSection?.sectionId ?? null}
                                canEdit={canEditCourseSectionDetails} setRoutineData={setRoutineData}
                                selectedSemesterIdForRoutineView={selectedSemesterIdForRoutineView}
                            />
                        ) : (
                            <div className="mt-3 space-y-2">
                                <div className="flex justify-between items-center mb-2">
                                    <button onClick={onToggleRoutineViewMode} disabled={selectedProgramIdForRoutineView === null || routineDisplayMode === 'published'} className="flex items-center gap-2 text-xs font-semibold text-teal-200 hover:text-yellow-300 transition-colors focus:outline-none rounded disabled:opacity-50 disabled:cursor-not-allowed" title={routineDisplayMode === 'published' ? "Day-centric view is disabled in Published mode" : selectedProgramIdForRoutineView === null ? "Select a program to change view mode" : routineViewMode === 'roomCentric' ? 'Switch to Day-Centric View' : 'Switch to Room-Centric View'}>
                                        {routineViewMode === 'roomCentric' ? (<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>) : (<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>)}
                                        Dashboard
                                    </button>
                                    <div className="flex items-center gap-1.5">{(user?.dashboardAccess?.canImportCourseData || user?.dashboardAccess?.canExportCourseData) && (<CourseDataTools coursesData={coursesData} setCoursesData={setCoursesData} dataToDownload={filteredCoursesForDownload} buttonStyle='sidebar' canImport={!!user.dashboardAccess.canImportCourseData} canExport={!!user.dashboardAccess.canExportCourseData}/>)}</div>
                                </div>
                                <div className="flex gap-1 p-1 bg-teal-900 rounded-md">
                                    {(['All', 'Theory', 'Lab'] as const).map(tab => (<button key={tab} onClick={() => setDashboardTabFilter(tab)} className={`w-full text-center text-xs font-bold py-1.5 rounded-sm transition-all duration-200 ${dashboardTabFilter === tab ? 'bg-yellow-400 text-teal-900 shadow' : 'text-teal-200 hover:bg-teal-700/50'}`}>{tab}</button>))}
                                </div>
                                <div className="grid grid-cols-2 gap-1.5">
                                    <StatCard title="Courses" value={sidebarStats.uniqueCourseCount} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>} onClick={() => handleDashboardCardClick('courseList')} isActive={currentMainView === 'courseList'} disabled={!user?.dashboardAccess?.canViewCourseList} />
                                    <StatCard title="Sections" value={sidebarStats.sectionCount} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>} onClick={() => handleDashboardCardClick('sectionList')} isActive={currentMainView === 'sectionList'} disabled={!user?.dashboardAccess?.canViewSectionList} />
                                    <StatCard title="Rooms" value={sidebarStats.roomCount} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>} onClick={() => handleDashboardCardClick('roomList')} isActive={currentMainView === 'roomList'} disabled={!user?.dashboardAccess?.canViewRoomList} />
                                    <StatCard title="Total Slots" value={sidebarStats.totalSlots} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>} disabled={!user?.dashboardAccess?.canViewTotalSlots} />
                                    <StatCard title="Slot Requirement" value={`${sidebarStats.bookedSlotRequirement} / ${sidebarStats.slotRequirement}`} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5m-5 2a9 9 0 001.378 5.622M20 20v-5h-5m5 2a9 9 0 00-1.378-5.622" /></svg>} onClick={() => setShowSlotRequirements(true)} disabled={!user?.dashboardAccess?.canViewSlotRequirement}/>
                                    <StatCard title="Slot Usage" value={`${sidebarStats.bookedSlots} / ${sidebarStats.totalSlots}`} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>} onClick={onToggleRoutineViewMode} disabled={!user?.dashboardAccess?.canViewSlotUsage} />
                                    <StatCard title="Teachers" value={sidebarStats.teacherCount} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm-9 3a2 2 0 11-4 0 2 2 0 014 0z" /></svg>} onClick={() => handleDashboardCardClick('teacherList')} isActive={currentMainView === 'teacherList'} disabled={!user?.dashboardAccess?.canViewTeacherList} />
                                    <StatCard title="Make-up Schedule" value={sidebarStats.attendanceLogCount} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>} onClick={onShowAttendanceLog} isActive={currentMainView === 'attendanceLog'} disabled={!user?.dashboardAccess?.canViewMakeupSchedule} />
                                </div>
                                {user?.dashboardAccess?.canViewSlotUsage && (<div className="flex-shrink-0 mt-2 space-y-1"><div className="flex justify-between items-baseline"><p className="text-xs font-semibold text-teal-200">Slot Usage</p><p className="text-xs font-bold text-white">{slotUsageStats.booked} / {slotUsageStats.total}</p></div><div className="w-full bg-teal-900 rounded-full h-2 border border-teal-800"><div className="bg-yellow-400 h-full rounded-full transition-all duration-500 ease-out" style={{ width: `${slotUsageStats.total > 0 ? (slotUsageStats.booked / slotUsageStats.total) * 100 : 0}%` }}></div></div></div>)}
                            </div>
                        )
                    )}
                </>
            )}
        </div>
      </aside>

      <div className="absolute bottom-0 left-0 right-0 z-40">
        {footerContent}
      </div>
    </div>
  );
});

Sidebar.displayName = 'Sidebar';
export default Sidebar;
