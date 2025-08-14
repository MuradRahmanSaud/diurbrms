

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { EnrollmentEntry, CourseType } from '../../types';
import * as XLSX from 'xlsx';
import CourseSectionEditor from '../CourseSectionEditor'; // Import the editor

export interface CourseData {
    courseCode: string;
    courseTitle: string;
    credit: number;
    type: string;
    levelTerm: string;
    weeklyClass?: number;
    sections: EnrollmentEntry[];
    pId: string;
}

type MinMaxFiltersType = {
    weeklyClass: { min: number | ''; max: number | '' };
    sectionCount: { min: number | ''; max: number | '' };
    ciw: { min: number | ''; max: number | '' };
    cr: { min: number | ''; max: number | '' };
    cat: { min: number | ''; max: number | '' };
    student: { min: number | ''; max: number | '' };
};

interface CourseListViewProps {
    uniqueCourses: CourseData[];
    totalCourseCount: number;
    onBack: () => void;
    ciwCounts: Map<string, number>;
    classRequirementCounts: Map<string, number>;
    currentPage: number;
    totalPages: number;
    onNextPage: () => void;
    onPrevPage: () => void;
    searchTerm: string;
    onSearchChange: (value: string) => void;
    onResetFilters: () => void;
    uniqueLevelTerms: string[];
    levelTermFilter: string[];
    onLevelTermFilterChange: (value: string) => void;
    uniqueCourseTypes: string[];
    courseTypeFilter: string[];
    onCourseTypeFilterChange: (value: string) => void;
    uniqueCredits: string[];
    creditFilter: string[];
    onCreditFilterChange: (value: string) => void;
    minMaxFilters: MinMaxFiltersType;
    onMinMaxFilterChange: (filterKey: keyof MinMaxFiltersType, type: 'min' | 'max', value: string) => void;
    setCoursesData: React.Dispatch<React.SetStateAction<EnrollmentEntry[]>>;
    onUpdateLevelTerm: (sectionId: string, newLevelTerm: string) => void;
    onUpdateWeeklyClass: (sectionId: string, newWeeklyClass: number | undefined) => void;
    onUpdateCourseType: (sectionId: string, newCourseType: CourseType) => void;
}

// Helper to format Level Term for display
const formatLevelTermForDisplay = (levelTerm: string): string => {
  if (!levelTerm || typeof levelTerm !== 'string') return 'N/A';
  const match = levelTerm.match(/L(\d+)T(\d+)/i);
  if (match) {
    return `L${match[1]}-T${match[2]}`;
  }
  return levelTerm; // Fallback for non-standard formats
};

// Helper to display combined course type information
const getFullCourseTypeDisplay = (course: EnrollmentEntry): string => {
    const category = course.type; // e.g., 'GED', 'Core'
    const deliveryType = course.courseType && course.courseType !== 'Others' && course.courseType !== 'N/A' ? course.courseType : null;

    if (deliveryType) {
        return `${deliveryType} (${category})`; // e.g., Theory (GED)
    }
    return category; // e.g., GED
};


const CourseListView: React.FC<CourseListViewProps> = ({
    uniqueCourses,
    totalCourseCount,
    onBack,
    ciwCounts,
    classRequirementCounts,
    currentPage,
    totalPages,
    onNextPage,
    onPrevPage,
    searchTerm,
    onSearchChange,
    onResetFilters,
    uniqueLevelTerms,
    levelTermFilter,
    onLevelTermFilterChange,
    uniqueCourseTypes,
    courseTypeFilter,
    onCourseTypeFilterChange,
    uniqueCredits,
    creditFilter,
    onCreditFilterChange,
    minMaxFilters,
    onMinMaxFilterChange,
    setCoursesData,
    onUpdateLevelTerm,
    onUpdateWeeklyClass,
    onUpdateCourseType,
}) => {
    const [expandedCourseCode, setExpandedCourseCode] = useState<string | null>(null);
    const courseFileInputRef = useRef<HTMLInputElement>(null);
    const editorRef = useRef<HTMLDivElement>(null);
    const [isFilterPanelVisible, setIsFilterPanelVisible] = useState(false);

    const [editingCourse, setEditingCourse] = useState<CourseData | null>(null);
    const [editingMode, setEditingMode] = useState<'levelTerm' | 'weekly' | null>(null);
    const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});
    
    const CheckboxFilterGroup = ({ title, options, selected, onChange }: { title: string, options: string[], selected: string[], onChange: (value: string) => void }) => (
        <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">{title}</label>
            <div className={`grid ${title === 'Credit' ? 'grid-cols-4' : 'grid-cols-3'} gap-1.5`}>
                {options.map(option => (
                    <button 
                        key={option} 
                        onClick={() => onChange(option)} 
                        className={`w-full px-2 py-1 text-xs font-semibold rounded-md transition-colors border ${
                            selected.includes(option) 
                                ? 'bg-teal-600 text-white border-teal-600 shadow-sm' 
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                        }`}
                    >
                        {option}
                    </button>
                ))}
            </div>
        </div>
    );
    
    const MinMaxInputGroup = ({ label, filterKey }: { label: string, filterKey: keyof typeof minMaxFilters }) => (
         <div>
            <label className="block text-xs font-medium text-gray-700">{label}</label>
            <div className="mt-1 flex items-center gap-1">
                <input type="number" placeholder="Min" min="0" value={minMaxFilters[filterKey].min} onChange={e => onMinMaxFilterChange(filterKey, 'min', e.target.value)} className="w-full text-xs p-1 border border-gray-300 rounded-md" />
                <span className="text-gray-500 text-xs">-</span>
                <input type="number" placeholder="Max" min="0" value={minMaxFilters[filterKey].max} onChange={e => onMinMaxFilterChange(filterKey, 'max', e.target.value)} className="w-full text-xs p-1 border border-gray-300 rounded-md" />
            </div>
        </div>
    );

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (editorRef.current && !editorRef.current.contains(event.target as Node)) {
                setEditingCourse(null);
                setEditingMode(null);
            }
        };
        if (editingCourse) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [editingCourse]);

    const toggleExpand = (courseCode: string) => {
        setExpandedCourseCode(prev => prev === courseCode ? null : courseCode);
    };
    
    const handleOpenEditor = (event: React.MouseEvent<HTMLButtonElement>, course: CourseData, mode: 'levelTerm' | 'weekly') => {
        event.stopPropagation();
        if (editingCourse?.courseCode === course.courseCode && editingMode === mode) {
            setEditingCourse(null);
            setEditingMode(null);
            return;
        }
        const buttonRect = event.currentTarget.getBoundingClientRect();
        setPopoverStyle({
            position: 'fixed',
            top: `${buttonRect.bottom + 4}px`,
            left: `${buttonRect.left}px`,
            zIndex: 50,
        });
        setEditingCourse(course);
        setEditingMode(mode);
    };
    
    const handleSaveFromPopover = (sectionId: string, stagedEdits: { levelTerm: string; weeklyClass: number | undefined; courseType: CourseType; }) => {
        onUpdateLevelTerm(sectionId, stagedEdits.levelTerm);
        onUpdateWeeklyClass(sectionId, stagedEdits.weeklyClass);
        onUpdateCourseType(sectionId, stagedEdits.courseType);
        setEditingCourse(null);
        setEditingMode(null);
    };

    const handleCancelPopover = () => {
        setEditingCourse(null);
        setEditingMode(null);
    };


    const handleImportClick = () => { courseFileInputRef.current?.click(); };

    const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (e) => {
            try {
              const arrayBuffer = e.target?.result;
              if (arrayBuffer) {
                const workbook = XLSX.read(arrayBuffer, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json<any>(worksheet);
                const newCourses: EnrollmentEntry[] = jsonData.map((row: any, index: number) => ({
                  semester: String(row.semester || `Semester ${index + 1}`),
                  pId: String(row.pId || `IMPORT_PID_${index}`),
                  sectionId: String(row.sectionId || `SectionID_${Date.now()}_${index}`),
                  courseCode: String(row.courseCode || `COURSE${index + 1}`),
                  courseTitle: String(row.courseTitle || 'Untitled Course'),
                  section: String(row.section || `SEC${index + 1}`),
                  credit: Number(row.credit || 0),
                  type: String(row.type || 'N/A'),
                  levelTerm: String(row.levelTerm || 'N/A'),
                  studentCount: Number(row.studentCount || 0),
                  teacherId: String(row.teacherId || ''),
                  teacherName: String(row.teacherName || 'To Be Assigned'),
                  designation: String(row.designation || 'N/A'),
                  teacherMobile: String(row.teacherMobile || 'N/A'),
                  teacherEmail: String(row.teacherEmail || 'N/A'),
                  classTaken: Number(row.classTaken || 0),
                  weeklyClass: row.weeklyClass != null ? Number(row.weeklyClass) : undefined,
                  courseType: (row.courseType as CourseType | undefined) || 'N/A',
                }));
                setCoursesData(newCourses);
                alert(`Successfully imported and loaded ${newCourses.length} courses.`);
              }
            } catch (error: any) {
              console.error("Error importing file:", error);
              alert(`Error processing file: ${error.message || 'Ensure it is a valid Excel file.'}`);
            }
          };
          reader.readAsArrayBuffer(file);
          if (courseFileInputRef.current) courseFileInputRef.current.value = "";
        }
    };

    const handleDownload = () => {
        const dataToDownload = uniqueCourses.flatMap(course => course.sections);
        if (dataToDownload.length === 0) {
          alert("No course data to download for the current view.");
          return;
        }
        const ws = XLSX.utils.json_to_sheet(dataToDownload);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Courses");
        XLSX.writeFile(wb, "filtered_course_list.xlsx");
    };
    
    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (levelTermFilter.length) count++; if (courseTypeFilter.length) count++; if (creditFilter.length) count++;
        Object.values(minMaxFilters).forEach(f => { if (f.min !== '' || f.max !== '') count++; });
        return count;
    }, [levelTermFilter, courseTypeFilter, creditFilter, minMaxFilters]);


    const FilterPanel = () => (
        <div className="flex flex-col h-full animate-fade-in">
            <style>{`.animate-fade-in { animation: fade-in 0.5s ease-out forwards; }`}</style>
            <div className="flex justify-between items-center mb-3 flex-shrink-0">
                <h4 className="font-semibold text-gray-700">Filters</h4>
                <button onClick={onResetFilters} className="text-xs text-red-600 hover:underline">Reset All ({activeFilterCount})</button>
            </div>
            <div className="flex-grow overflow-y-auto filter-panel-scrollbar pr-1 -mr-2 space-y-3">
                 <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                        <MinMaxInputGroup label="Weekly Classes" filterKey="weeklyClass" />
                        <MinMaxInputGroup label="Sections" filterKey="sectionCount" />
                        <MinMaxInputGroup label="Classes in Week" filterKey="ciw" />
                        <MinMaxInputGroup label="Class Requirement" filterKey="cr" />
                        <MinMaxInputGroup label="Classes Taken" filterKey="cat" />
                        <MinMaxInputGroup label="Students" filterKey="student" />
                    </div>
                    <hr className="border-gray-200 !my-2" />
                    <CheckboxFilterGroup title="Level-Term" options={uniqueLevelTerms} selected={levelTermFilter} onChange={onLevelTermFilterChange} />
                    <CheckboxFilterGroup title="Credit" options={uniqueCredits} selected={creditFilter} onChange={onCreditFilterChange} />
                    <CheckboxFilterGroup title="Course Type" options={uniqueCourseTypes} selected={courseTypeFilter} onChange={onCourseTypeFilterChange} />
                </div>
            </div>
        </div>
    );

    return (
        <div className="h-full flex flex-row gap-3 overflow-hidden">
             {/* Filter Panel (Left Side) */}
            <div className={`
                flex-shrink-0 bg-white rounded-lg shadow-lg border border-gray-200 transition-all duration-300 ease-in-out
                ${isFilterPanelVisible ? 'w-64 p-3' : 'w-0 p-0 border-0 overflow-hidden'}
            `}>
                {isFilterPanelVisible && <FilterPanel />}
            </div>
            
            {/* Main Content (Table on the Right) */}
            <div className="h-full flex flex-col flex-grow min-w-0">
                <div className="flex justify-between items-center mb-2 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <button onClick={onBack} className="text-sm font-medium text-teal-600 hover:underline flex items-center gap-1">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z" />
                            </svg>
                            Back
                        </button>
                        <h3 className="text-md font-semibold text-gray-800">Course List ({totalCourseCount})</h3>
                        <div className="flex items-center gap-2">
                            <input type="file" ref={courseFileInputRef} onChange={handleFileImport} accept=".xlsx, .xls" className="hidden" aria-hidden="true"/>
                            <button onClick={handleImportClick} title="Import from Excel" className="p-1.5 flex-shrink-0 text-white bg-teal-600 hover:bg-teal-700 rounded-md shadow-sm">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                            </button>
                            <button onClick={handleDownload} title="Download Filtered Data" className="p-1.5 flex-shrink-0 text-teal-700 bg-teal-100 hover:bg-teal-200 rounded-md shadow-sm border border-teal-200">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="relative w-64">
                             <div className="flex items-center border border-gray-300 rounded-md bg-white focus-within:ring-1 focus-within:ring-teal-500 focus-within:border-teal-500 transition-all">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <svg className="h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>
                                </div>
                                <input type="search" value={searchTerm} onChange={(e) => onSearchChange(e.target.value)} placeholder="Search courses..." className="block w-full pl-9 pr-10 py-1.5 border-0 rounded-md leading-5 bg-transparent placeholder-gray-500 focus:outline-none focus:ring-0 sm:text-sm"/>
                                <div className="absolute inset-y-0 right-0 flex items-center">
                                    <button onClick={() => setIsFilterPanelVisible(prev => !prev)} className="p-1.5 text-gray-400 hover:text-gray-600 focus:outline-none rounded-full mr-1 relative" aria-label="Open filters">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                                        {activeFilterCount > 0 && (<span className="absolute -top-1 -right-1 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-teal-500"></span></span>)}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="overflow-auto custom-scrollbar flex-grow min-h-0">
                    <table className="min-w-full divide-y divide-gray-200 text-xs">
                        <thead className="bg-gray-50 sticky top-0">
                            <tr>
                                <th scope="col" className="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">L-T</th>
                                <th scope="col" className="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Course Code</th>
                                <th scope="col" className="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Course Title</th>
                                <th scope="col" className="px-3 py-2 text-center font-medium text-gray-500 uppercase tracking-wider">Cr.</th>
                                <th scope="col" className="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Course Type</th>
                                <th scope="col" className="px-3 py-2 text-center font-medium text-gray-500 uppercase tracking-wider" title="Weekly Classes">W.C.</th>
                                <th scope="col" className="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Sections</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {uniqueCourses.map(course => (
                                <React.Fragment key={course.courseCode}>
                                    <tr className={`border-b transition-colors duration-150 cursor-pointer group/row text-[11px] ${expandedCourseCode === course.courseCode ? 'bg-teal-100' : 'bg-gray-50 hover:bg-gray-100'}`} onClick={() => toggleExpand(course.courseCode)}>
                                        <td className="px-3 py-2 whitespace-nowrap text-gray-600">
                                            <button onClick={(e) => handleOpenEditor(e, course, 'levelTerm')} className="font-semibold bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded-md hover:bg-gray-300 hover:text-black transition-colors text-xs">{formatLevelTermForDisplay(course.levelTerm)}</button>
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap font-medium text-gray-800 flex items-center gap-2">
                                            <svg className={`w-3 h-3 text-gray-400 transform transition-transform ${expandedCourseCode === course.courseCode ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                                            {course.courseCode}
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap text-gray-600 truncate max-w-xs">{course.courseTitle}</td>
                                        <td className="px-3 py-2 text-center whitespace-nowrap text-gray-600">{course.credit}</td>
                                        <td className="px-3 py-2 whitespace-nowrap text-gray-600" title={course.sections.length > 0 ? getFullCourseTypeDisplay(course.sections[0]) : course.type}>
                                            {course.sections.length > 0 ? getFullCourseTypeDisplay(course.sections[0]) : course.type}
                                        </td>
                                        <td className="px-2 py-1 text-center whitespace-nowrap"><button onClick={(e) => { handleOpenEditor(e, course, 'weekly'); }} className="text-center font-semibold bg-gray-200 text-gray-700 px-2 py-0.5 rounded-md hover:bg-gray-300 hover:text-black transition-colors min-w-[30px] text-xs">{course.weeklyClass ?? '-'}</button></td>
                                        <td className="px-3 py-2 text-left whitespace-nowrap font-semibold text-teal-600">{course.sections.length}</td>
                                    </tr>
                                    {expandedCourseCode === course.courseCode && (
                                        <tr>
                                            <td colSpan={7} className="p-2 bg-slate-100">
                                                <div className="overflow-hidden border border-gray-200 rounded-md">
                                                    <table className="min-w-full divide-y divide-gray-200 text-[11px]">
                                                        <thead className="bg-slate-200">
                                                            <tr>
                                                                <th className="px-2 py-1 text-left font-semibold text-gray-600">Section</th>
                                                                <th className="px-2 py-1 text-center font-semibold text-gray-600" title="Classes in Week">CIW</th>
                                                                <th className="px-2 py-1 text-center font-semibold text-gray-600" title="Class Requirement">CR</th>
                                                                <th className="px-2 py-1 text-center font-semibold text-gray-600" title="Classes Taken">CAT</th>
                                                                <th className="px-2 py-1 text-center font-semibold text-gray-600" title="Students">Stu</th>
                                                                <th className="px-2 py-1 text-left font-semibold text-gray-600">Teacher</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="bg-white divide-y divide-gray-200">
                                                            {course.sections.map((section: EnrollmentEntry) => {
                                                                const cr = classRequirementCounts.get(section.sectionId) ?? 0;
                                                                const ciw = ciwCounts.get(section.sectionId) ?? 0;
                                                                return (
                                                                    <tr key={section.sectionId}>
                                                                        <td className="px-2 py-1 font-medium text-gray-800">{section.section}</td>
                                                                        <td className="px-2 py-1 text-center font-semibold text-blue-600">{ciw}</td>
                                                                        <td className="px-2 py-1 text-center font-semibold text-purple-600">{cr * ciw}</td>
                                                                        <td className="px-2 py-1 text-center font-semibold text-green-600">{section.classTaken}</td>
                                                                        <td className="px-2 py-1 text-center text-gray-600">{section.studentCount}</td>
                                                                        <td className="px-2 py-1 truncate max-w-xs whitespace-nowrap">{section.teacherName}</td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                            {uniqueCourses.length === 0 && (
                                <tr><td colSpan={7} className="text-center py-4 text-gray-500 italic">No courses match the current filters.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {totalPages > 1 && (
                    <div className="flex-shrink-0 pt-2 flex justify-between items-center text-xs border-t border-gray-200 mt-2">
                        <button onClick={onPrevPage} disabled={currentPage === 1} className="px-2 py-1 rounded-md text-gray-600 bg-gray-100 hover:bg-gray-200 disabled:text-gray-300 disabled:cursor-not-allowed disabled:bg-transparent">
                            &laquo; Previous
                        </button>
                        <span className="text-gray-600 font-medium">Page {currentPage} of {totalPages}</span>
                        <button onClick={onNextPage} disabled={currentPage === totalPages} className="px-2 py-1 rounded-md text-gray-600 bg-gray-100 hover:bg-gray-200 disabled:text-gray-300 disabled:cursor-not-allowed disabled:bg-transparent">
                            Next &raquo;
                        </button>
                    </div>
                )}
                 {editingCourse && (
                    <div style={popoverStyle} ref={editorRef} className="w-64 bg-white rounded-lg shadow-2xl border border-gray-300" onClick={(e) => e.stopPropagation()}>
                        <CourseSectionEditor 
                            course={editingCourse.sections[0]}
                            onSave={handleSaveFromPopover}
                            onCancel={handleCancelPopover}
                            theme="light"
                            mode={editingMode}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default CourseListView;
