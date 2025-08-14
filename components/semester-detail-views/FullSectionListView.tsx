import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { EnrollmentEntry, CourseType, ProgramEntry, FullRoutineData, SemesterCloneInfo, DayOfWeek, RoomEntry, DefaultTimeSlot, User } from '../../types';
import CourseDataTools from '../CourseDataTools';
import { formatDefaultSlotToString } from '../../App';
import { DAYS_OF_WEEK } from '../../data/routineConstants';

interface FullSectionListViewProps {
  user: User | null;
  coursesData: EnrollmentEntry[];
  allPrograms: ProgramEntry[];
  onClose: () => void;
  setCoursesData: React.Dispatch<React.SetStateAction<EnrollmentEntry[]>>;
  routineData: { [semesterId: string]: FullRoutineData };
  allSemesterConfigurations: SemesterCloneInfo[];
  initialFilters?: { pId: string; category: string; credit: number; } | null;
  onFiltersApplied?: () => void;
  stagedCourseUpdates?: Record<string, { courseType: CourseType; weeklyClass: string; }>;
  ciwCounts: Map<string, number>;
  classRequirementCounts: Map<string, number>;
  dashboardTabFilter: 'All' | 'Theory' | 'Lab';
  allRooms: RoomEntry[];
  systemDefaultSlots: DefaultTimeSlot[];
  onSlotClick: (room: RoomEntry, slot: DefaultTimeSlot, day: DayOfWeek) => void;
}

const getFullCourseTypeDisplay = (course: EnrollmentEntry): string => {
    const category = course.type;
    const deliveryType = course.courseType && course.courseType !== 'Others' && course.courseType !== 'N/A' ? course.courseType : null;
    if (deliveryType) return `${deliveryType} (${category})`;
    return category;
};

const SectionDetailPanel = ({
    section,
    routineData,
    allRooms,
    allPrograms,
    systemDefaultSlots,
    onSlotClick
}: {
    section: EnrollmentEntry,
    routineData: { [key: string]: FullRoutineData },
    allRooms: RoomEntry[],
    allPrograms: ProgramEntry[],
    systemDefaultSlots: DefaultTimeSlot[],
    onSlotClick: (room: RoomEntry, slot: DefaultTimeSlot, day: DayOfWeek) => void;
}) => {
    
    const scheduledClasses = useMemo(() => {
        const routineForSemester = routineData[section.semester];
        if (!routineForSemester) return [];
    
        const classes: { day: DayOfWeek; timeSlot: string; room: string }[] = [];
        (Object.keys(routineForSemester) as DayOfWeek[]).forEach(day => {
            const dayData = routineForSemester[day];
            if (dayData) {
                Object.keys(dayData).forEach(roomNumber => {
                    const roomData = dayData[roomNumber];
                    Object.keys(roomData).forEach(timeSlot => {
                        const classInfo = roomData[timeSlot as keyof typeof roomData];
                        if (classInfo && classInfo.courseCode === section.courseCode && classInfo.section === section.section) {
                            classes.push({ day, timeSlot, room: roomNumber });
                        }
                    });
                });
            }
        });
        return classes.sort((a,b) => DAYS_OF_WEEK.indexOf(a.day) - DAYS_OF_WEEK.indexOf(b.day) || a.timeSlot.localeCompare(b.timeSlot));
    }, [section, routineData]);
    
    const handleRoutineClick = (scheduledClass: { day: DayOfWeek; timeSlot: string; room: string }) => {
        const roomEntry = allRooms.find(r => r.roomNumber === scheduledClass.room && r.semesterId === section.semester);
        if (!roomEntry) return;

        const programForRoom = allPrograms.find(p => p.pId === roomEntry.assignedToPId);
        const applicableSlots = (roomEntry.roomSpecificSlots?.length ?? 0) > 0 
          ? roomEntry.roomSpecificSlots 
          : (programForRoom?.programSpecificSlots?.length ? programForRoom.programSpecificSlots : systemDefaultSlots);
          
        const slotObject = applicableSlots.find(s => formatDefaultSlotToString(s) === scheduledClass.timeSlot);

        if (slotObject) onSlotClick(roomEntry, slotObject, scheduledClass.day);
    };

    return (
        <div className="flex flex-col h-full animate-fade-in">
            <style>{`.animate-fade-in { animation: fade-in 0.5s ease-out forwards; }`}</style>
            <div className="flex-grow min-h-0 overflow-y-auto section-detail-scrollbar pr-1 -mr-2">
                <div className="space-y-1 p-2 bg-gray-100 rounded-md border border-gray-200 mb-4">
                    <p className="font-bold text-lg text-gray-800 text-center">{section.courseCode}</p>
                    <p className="text-sm text-gray-600 text-center">Section: {section.section}</p>
                    <p className="text-xs text-gray-500 truncate text-center" title={section.courseTitle}>{section.courseTitle}</p>
                </div>
                <div className="mt-4 pt-3 border-t border-gray-300">
                    <h5 className="font-semibold text-gray-700 text-sm mb-2">Class Routine</h5>
                    {scheduledClasses.length > 0 ? (
                        <ul className="space-y-1.5 text-xs section-detail-scrollbar overflow-y-auto max-h-48 pr-1">
                            {scheduledClasses.map((c, index) => (
                                <li key={index} className="p-1.5 bg-gray-50 rounded-md cursor-pointer hover:bg-teal-50 hover:shadow-sm border border-gray-200" onClick={() => handleRoutineClick(c)} tabIndex={0}>
                                    <p className="font-medium text-gray-800">{c.day}</p>
                                    <p className="text-gray-600">{c.timeSlot}</p>
                                    <p className="text-gray-600">Room: <span className="font-semibold">{c.room}</span></p>
                                </li>
                            ))}
                        </ul>
                    ) : (<p className="text-xs italic text-gray-500">Not scheduled.</p>)}
                </div>
            </div>
        </div>
    );
};


const FullSectionListView: React.FC<FullSectionListViewProps> = ({ user, coursesData, allPrograms, onClose, setCoursesData, routineData, allRooms, systemDefaultSlots, onSlotClick, ciwCounts, classRequirementCounts }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(25);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    
    const [panelMode, setPanelMode] = useState<'closed' | 'filter' | 'detail'>('closed');
    const [selectedSection, setSelectedSection] = useState<EnrollmentEntry | null>(null);
    const [isFilterPanelVisible, setIsFilterPanelVisible] = useState(false);


    // --- Filter State ---
    const [levelTermFilter, setLevelTermFilter] = useState<string[]>([]);
    const [courseTypeFilter, setCourseTypeFilter] = useState<string[]>([]);
    const [creditFilter, setCreditFilter] = useState<string[]>([]);
    const [studentCountFilter, setStudentCountFilter] = useState<{ min: number | ''; max: number | '' }>({ min: '', max: '' });
    const [classTakenFilter, setClassTakenFilter] = useState<{ min: number | ''; max: number | '' }>({ min: '', max: '' });
    const [ciwFilter, setCiwFilter] = useState<{ min: number | ''; max: number | '' }>({ min: '', max: '' });
    const [crFilter, setCrFilter] = useState<{ min: number | ''; max: number | '' }>({ min: '', max: '' });

    // --- Filter Option Memos ---
    const uniqueLevelTerms = useMemo(() => Array.from(new Set(coursesData.map(c => c.levelTerm))).sort(), [coursesData]);
    const uniqueCourseTypes = useMemo(() => Array.from(new Set(coursesData.map(getFullCourseTypeDisplay))).sort(), [coursesData]);
    const uniqueCredits = useMemo(() => Array.from(new Set(coursesData.map(c => c.credit.toString()))).sort((a, b) => Number(a) - Number(b)), [coursesData]);

    // --- Filter Handlers ---
    const handleLevelTermFilterChange = useCallback((value: string) => { setLevelTermFilter(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]); }, []);
    const handleCourseTypeFilterChange = useCallback((value: string) => { setCourseTypeFilter(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]); }, []);
    const handleCreditFilterChange = useCallback((value: string) => { setCreditFilter(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]); }, []);
    const handleResetFilters = useCallback(() => {
        setLevelTermFilter([]); setCourseTypeFilter([]); setCreditFilter([]); setStudentCountFilter({ min: '', max: '' }); setClassTakenFilter({ min: '', max: '' });
        setCiwFilter({ min: '', max: '' }); setCrFilter({ min: '', max: '' });
    }, []);

    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (levelTermFilter.length) count++; if (courseTypeFilter.length) count++; if (creditFilter.length) count++;
        if (studentCountFilter.min !== '' || studentCountFilter.max !== '') count++;
        if (classTakenFilter.min !== '' || classTakenFilter.max !== '') count++;
        if (ciwFilter.min !== '' || ciwFilter.max !== '') count++;
        if (crFilter.min !== '' || crFilter.max !== '') count++;
        return count;
    }, [levelTermFilter, courseTypeFilter, creditFilter, studentCountFilter, classTakenFilter, ciwFilter, crFilter]);
    
    useEffect(() => {
        const handler = setTimeout(() => { setDebouncedSearchTerm(searchTerm); }, 300);
        return () => clearTimeout(handler);
    }, [searchTerm]);

    const filteredSections = useMemo(() => {
        let filteredItems = [...coursesData];

        if (levelTermFilter.length > 0) filteredItems = filteredItems.filter(item => levelTermFilter.includes(item.levelTerm));
        if (courseTypeFilter.length > 0) filteredItems = filteredItems.filter(item => courseTypeFilter.includes(getFullCourseTypeDisplay(item)));
        if (creditFilter.length > 0) filteredItems = filteredItems.filter(item => creditFilter.includes(item.credit.toString()));
        
        const minCt = classTakenFilter.min !== '' ? parseInt(String(classTakenFilter.min), 10) : -Infinity;
        const maxCt = classTakenFilter.max !== '' ? parseInt(String(classTakenFilter.max), 10) : Infinity;
        if (!isNaN(minCt) || !isNaN(maxCt)) filteredItems = filteredItems.filter(item => { const ct = item.classTaken; return (isNaN(minCt) || ct >= minCt) && (isNaN(maxCt) || ct <= maxCt); });
        
        const minSc = studentCountFilter.min !== '' ? parseInt(String(studentCountFilter.min), 10) : -Infinity;
        const maxSc = studentCountFilter.max !== '' ? parseInt(String(studentCountFilter.max), 10) : Infinity;
        if (!isNaN(minSc) || !isNaN(maxSc)) filteredItems = filteredItems.filter(item => { const sc = item.studentCount; return (isNaN(minSc) || sc >= minSc) && (isNaN(maxSc) || sc <= maxSc); });

        const minCiw = ciwFilter.min !== '' ? parseInt(String(ciwFilter.min), 10) : -Infinity;
        const maxCiw = ciwFilter.max !== '' ? parseInt(String(ciwFilter.max), 10) : Infinity;
        if (!isNaN(minCiw) || !isNaN(maxCiw)) filteredItems = filteredItems.filter(item => { const ciw = ciwCounts.get(item.sectionId) ?? 0; return (isNaN(minCiw) || ciw >= minCiw) && (isNaN(maxCiw) || ciw <= maxCiw); });
        
        const minCr = crFilter.min !== '' ? parseInt(String(crFilter.min), 10) : -Infinity;
        const maxCr = crFilter.max !== '' ? parseInt(String(crFilter.max), 10) : Infinity;
        if (!isNaN(minCr) || !isNaN(maxCr)) filteredItems = filteredItems.filter(item => { const cr = classRequirementCounts.get(item.sectionId) ?? 0; return (isNaN(minCr) || cr >= minCr) && (isNaN(maxCr) || cr <= maxCr); });
        
        if (debouncedSearchTerm.trim()) {
            const lowercasedFilter = debouncedSearchTerm.toLowerCase();
            filteredItems = filteredItems.filter(item => Object.values(item).some(val => String(val).toLowerCase().includes(lowercasedFilter)));
        }
        return filteredItems;
    }, [ coursesData, debouncedSearchTerm, levelTermFilter, courseTypeFilter, creditFilter, studentCountFilter, classTakenFilter, ciwFilter, crFilter, ciwCounts, classRequirementCounts ]);

    useEffect(() => { setCurrentPage(1); }, [filteredSections]);

    const totalPages = Math.ceil(filteredSections.length / itemsPerPage);
    const paginatedItems = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredSections.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredSections, currentPage, itemsPerPage]);
    
    const handleRowClick = (section: EnrollmentEntry) => {
        if (selectedSection?.sectionId === section.sectionId && panelMode === 'detail') {
            setPanelMode('filter'); 
            setIsFilterPanelVisible(true);
            setSelectedSection(null);
        } else {
            setSelectedSection(section); 
            setPanelMode('detail');
            setIsFilterPanelVisible(true);
        }
    };
    
    const handleFilterIconClick = () => {
        setSelectedSection(null); // Clear detail view when opening filter
        setIsFilterPanelVisible(prev => !prev);
        setPanelMode('filter'); // Always ensure filter panel content is shown
    };
    
    const handleClosePanel = () => {
        setIsFilterPanelVisible(false);
        setSelectedSection(null);
    }

    const CheckboxFilterGroup = ({ title, options, selected, onChange }: { title: string, options: string[], selected: string[], onChange: (value: string) => void }) => (
        <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">{title}</label>
            <div className={`grid ${title === 'Credit' ? 'grid-cols-4' : 'grid-cols-3'} gap-1.5`}>
                {options.map(option => (<button key={option} onClick={() => onChange(option)} className={`w-full px-2 py-1 text-xs font-semibold rounded-md transition-colors border ${selected.includes(option) ? 'bg-teal-600 text-white border-teal-600 shadow-sm' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'}`}>{option}</button>))}
            </div>
        </div>
    );
    const MinMaxInputGroup = ({ label, value, onChange }: { label: string, value: { min: number | ''; max: number | '' }, onChange: (key: 'min' | 'max', val: string) => void }) => (
        <div>
            <label className="block text-xs font-medium text-gray-700">{label}</label>
            <div className="mt-1 flex items-center gap-1"><input type="number" placeholder="Min" min="0" value={value.min} onChange={e => onChange('min', e.target.value)} className="w-full text-xs p-1 border border-gray-300 rounded-md" /><span className="text-gray-500 text-xs">-</span><input type="number" placeholder="Max" min="0" value={value.max} onChange={e => onChange('max', e.target.value)} className="w-full text-xs p-1 border border-gray-300 rounded-md" /></div>
        </div>
    );

    const FilterPanel = () => (
      <div className="flex flex-col h-full animate-fade-in">
          <style>{`.animate-fade-in { animation: fade-in 0.5s ease-out forwards; }`}</style>
          <div className="flex-grow overflow-y-auto filter-panel-scrollbar pr-1 -mr-2 space-y-3">
              <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                      <MinMaxInputGroup label="Student Count" value={studentCountFilter} onChange={(key, val) => setStudentCountFilter(prev => ({ ...prev, [key]: val }))} />
                      <MinMaxInputGroup label="Classes Taken" value={classTakenFilter} onChange={(key, val) => setClassTakenFilter(prev => ({ ...prev, [key]: val }))} />
                      <MinMaxInputGroup label="CIW" value={ciwFilter} onChange={(key, val) => setCiwFilter(prev => ({ ...prev, [key]: val }))} />
                      <MinMaxInputGroup label="CR" value={crFilter} onChange={(key, val) => setCrFilter(prev => ({ ...prev, [key]: val }))} />
                  </div>
                  <hr className="border-gray-200 !my-2" />
                  <CheckboxFilterGroup title="Level-Term" options={uniqueLevelTerms} selected={levelTermFilter} onChange={handleLevelTermFilterChange} />
                  <CheckboxFilterGroup title="Credit" options={uniqueCredits} selected={creditFilter} onChange={handleCreditFilterChange} />
                  <CheckboxFilterGroup title="Course Type" options={uniqueCourseTypes} selected={courseTypeFilter} onChange={handleCourseTypeFilterChange} />
              </div>
          </div>
           <div className="flex-shrink-0 pt-3 border-t border-gray-200 flex items-center justify-between gap-2">
                <button onClick={handleResetFilters} className="text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 p-1.5 rounded-md shadow-sm border border-red-200 flex-grow">
                    Reset ({activeFilterCount})
                </button>
                 <CourseDataTools
                    coursesData={coursesData}
                    setCoursesData={setCoursesData}
                    dataToDownload={filteredSections}
                    buttonStyle="viewHeader"
                    canImport={!!user?.dashboardAccess?.canImportCourseData}
                    canExport={!!user?.dashboardAccess?.canExportCourseData}
                />
            </div>
      </div>
    );

    return (
        <div className="h-full flex flex-col bg-slate-100 font-sans">
            <header className="flex-shrink-0 p-1.5 bg-white rounded-t-lg shadow-sm border-b z-20 flex items-center justify-between gap-x-3">
                <div className="flex items-center gap-3">
                    <button onClick={onClose} className="p-1.5 text-gray-500 hover:bg-gray-200 rounded-full" aria-label="Close Course Master List">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                    </button>
                    <h2 className="text-md font-bold text-gray-800 flex-shrink-0">Section Master List ({filteredSections.length})</h2>
                </div>
                <div className="relative flex items-center flex-grow max-w-lg">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>
                    </div>
                    <input 
                        type="search" 
                        value={searchTerm} 
                        onChange={(e) => setSearchTerm(e.target.value)} 
                        placeholder="Search sections..." 
                        className="block w-full pl-9 pr-10 py-1.5 border border-gray-300 rounded-md leading-5 bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-teal-500 focus:border-teal-500 sm:text-sm" 
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center">
                        <button onClick={handleFilterIconClick} className="p-1.5 text-gray-400 hover:text-gray-600 focus:outline-none rounded-full mr-1 relative" aria-label="Toggle filters" aria-expanded={isFilterPanelVisible}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                            {activeFilterCount > 0 && (
                                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-teal-500"></span>
                                </span>
                            )}
                        </button>
                    </div>
                </div>
            </header>
            <div className={`flex-grow flex flex-row min-h-0 p-2 overflow-hidden gap-3`}>
                 <aside className={`flex-shrink-0 bg-white rounded-lg shadow-lg border border-gray-200 transition-all duration-300 ease-in-out ${isFilterPanelVisible ? 'w-72' : 'w-0 border-0 overflow-hidden'}`}>
                    <div className={`h-full overflow-hidden flex flex-col ${isFilterPanelVisible ? 'p-3' : 'p-0'}`}>
                        {isFilterPanelVisible && (
                             <>
                                <div className="flex justify-between items-center mb-3 flex-shrink-0">
                                    <h4 className="font-semibold text-gray-700">{panelMode === 'filter' ? 'Filters' : 'Section Details'}</h4>
                                    <button onClick={handleClosePanel} className="p-1 text-gray-400 hover:bg-gray-200 rounded-full inline-flex"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                                </div>
                                <div className="flex-grow min-h-0">{panelMode === 'filter' ? <FilterPanel /> : (selectedSection && <SectionDetailPanel section={selectedSection} routineData={routineData} allRooms={allRooms} allPrograms={allPrograms} systemDefaultSlots={systemDefaultSlots} onSlotClick={onSlotClick}/>)}</div>
                            </>
                        )}
                    </div>
                </aside>
                <main className="bg-white rounded-lg shadow-sm border overflow-hidden min-w-0 flex flex-col flex-grow">
                    <div className="flex-grow overflow-y-auto custom-scrollbar min-h-0">
                        <table className="min-w-full">
                            <thead className="sticky top-0 bg-gray-100 z-10"><tr className="border-b border-gray-300">
                                <th className="py-2 px-2 text-left text-xs font-bold text-gray-600 uppercase">Course Code</th>
                                <th className="py-2 px-2 text-left text-xs font-bold text-gray-600 uppercase">Course Title</th>
                                <th className="py-2 px-2 text-left text-xs font-bold text-gray-600 uppercase">Section</th>
                                <th className="py-2 px-2 text-center text-xs font-bold text-gray-600 uppercase" title="Number of Students">NOS</th>
                                <th className="py-2 px-2 text-center text-xs font-bold text-gray-600 uppercase" title="Class Requirement">CR</th>
                                <th className="py-2 px-2 text-center text-xs font-bold text-gray-600 uppercase" title="Class Taken">CT</th>
                                <th className="py-2 px-2 text-center text-xs font-bold text-gray-600 uppercase" title="Weekly Classes">WC</th>
                                <th className="py-2 px-2 text-center text-xs font-bold text-gray-600 uppercase" title="Classes in Week">CIW</th>
                                <th className="py-2 px-2 text-left text-xs font-bold text-gray-600 uppercase">Teacher Name</th>
                                <th className="py-2 px-2 text-left text-xs font-bold text-gray-600 uppercase">Designation</th>
                            </tr></thead>
                            <tbody className="divide-y divide-gray-200">{paginatedItems.map(sec => (
                                <tr key={sec.sectionId} onClick={() => handleRowClick(sec)} className={`hover:bg-teal-50 text-xs cursor-pointer ${selectedSection?.sectionId === sec.sectionId ? 'bg-teal-100' : ''}`}>
                                    <td className="px-2 py-1.5 font-semibold text-gray-800">{sec.courseCode}</td>
                                    <td className="px-2 py-1.5 text-gray-500 truncate max-w-xs" title={sec.courseTitle}>{sec.courseTitle}</td>
                                    <td className="px-2 py-1.5 font-medium text-gray-800">{sec.section}</td>
                                    <td className="px-2 py-1.5 text-center font-medium text-gray-700">{sec.studentCount}</td>
                                    <td className="px-2 py-1.5 text-center font-semibold text-purple-600">{classRequirementCounts.get(sec.sectionId) ?? 0}</td>
                                    <td className="px-2 py-1.5 text-center font-semibold text-green-600">{sec.classTaken}</td>
                                    <td className="px-2 py-1.5 text-center font-semibold text-orange-600">{sec.weeklyClass ?? 0}</td>
                                    <td className="px-2 py-1.5 text-center font-semibold text-blue-600">{ciwCounts.get(sec.sectionId) ?? 0}</td>
                                    <td className="px-2 py-1.5 text-gray-600 truncate max-w-xs" title={sec.teacherName}>{sec.teacherName}</td>
                                    <td className="px-2 py-1.5 text-gray-500 truncate max-w-xs" title={sec.designation}>{sec.designation}</td>
                                </tr>
                            ))}</tbody>
                        </table>
                    </div>
                    {totalPages > 1 && (
                        <footer className="flex-shrink-0 p-2 bg-white rounded-b-lg border-t">
                            <div className="flex justify-between items-center text-xs">
                                <div>
                                    <span className="mr-2">Items per page:</span>
                                    <select value={itemsPerPage} onChange={e => setItemsPerPage(Number(e.target.value))} className="p-1 border border-gray-300 rounded-md">
                                        <option value={10}>10</option><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option>
                                    </select>
                                </div>
                                {totalPages > 1 && (<div className="flex items-center gap-2">
                                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-2 py-1 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50">&laquo; Prev</button>
                                        <span className="text-gray-600 font-medium">Page {currentPage} of {totalPages}</span>
                                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-2 py-1 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50">Next &raquo;</button>
                                    </div>)}
                            </div>
                        </footer>
                    )}
                </main>
            </div>
        </div>
    );
};

export default FullSectionListView;
