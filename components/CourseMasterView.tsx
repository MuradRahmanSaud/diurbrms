import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { EnrollmentEntry, ProgramEntry, CourseType, User } from '../types';
import CourseSectionEditor from './CourseSectionEditor';
import CourseDataTools from './CourseDataTools';

interface CourseMasterViewProps {
  user: User | null;
  coursesData: EnrollmentEntry[];
  allPrograms: ProgramEntry[];
  ciwCounts: Map<string, number>;
  classRequirementCounts: Map<string, number>;
  onClose: () => void;
  setCoursesData: React.Dispatch<React.SetStateAction<EnrollmentEntry[]>>;
  onUpdateLevelTerm: (sectionId: string, newLevelTerm: string) => void;
  onUpdateWeeklyClass: (sectionId: string, newWeeklyClass: number | undefined) => void;
  onUpdateCourseType: (sectionId: string, newCourseType: CourseType) => void;
}

interface CourseData {
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
    sectionCount: { min: number | ''; max: number | '' };
    cat: { min: number | ''; max: number | '' };
    student: { min: number | ''; max: number | '' };
};

const getFullCourseTypeDisplay = (course: EnrollmentEntry): string => {
    const category = course.type; 
    const deliveryType = course.courseType && course.courseType !== 'Others' && course.courseType !== 'N/A' ? course.courseType : null;
    if (deliveryType) return `${deliveryType} (${category})`;
    return category;
};

const formatLevelTermForDisplay = (levelTerm: string): string => {
  if (!levelTerm || typeof levelTerm !== 'string') return 'N/A';
  const match = levelTerm.match(/L(\d+)T(\d+)/i);
  if (match) return `L${match[1]}-T${match[2]}`;
  return levelTerm;
};

const CourseMasterView: React.FC<CourseMasterViewProps> = ({
  user,
  coursesData,
  allPrograms,
  ciwCounts,
  classRequirementCounts,
  onClose,
  setCoursesData,
  onUpdateLevelTerm,
  onUpdateWeeklyClass,
  onUpdateCourseType,
}) => {
  const [isFilterPanelVisible, setIsFilterPanelVisible] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [levelTermFilter, setLevelTermFilter] = useState<string[]>([]);
  const [courseTypeFilter, setCourseTypeFilter] = useState<string[]>([]);
  const [creditFilter, setCreditFilter] = useState<string[]>([]);
  const [weeklyClassFilter, setWeeklyClassFilter] = useState<string[]>([]);
  const [minMaxFilters, setMinMaxFilters] = useState<MinMaxFiltersType>({
    sectionCount: { min: '', max: '' },
    cat: { min: '', max: '' }, student: { min: '', max: '' },
  });
  
  const ITEMS_PER_PAGE = 20;

  const [expandedCourseKey, setExpandedCourseKey] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  
  const [editingCourse, setEditingCourse] = useState<CourseData | null>(null);
  const [editingMode, setEditingMode] = useState<'levelTerm' | 'weekly' | null>(null);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});
  
  const getProgramShortName = useCallback((pId?: string): string => {
    if (!pId) return 'N/A';
    const program = allPrograms.find(p => p.pId === pId);
    return program?.shortName || pId;
  }, [allPrograms]);

  const onResetFilters = useCallback(() => {
    setSearchTerm('');
    setLevelTermFilter([]);
    setCourseTypeFilter([]);
    setCreditFilter([]);
    setWeeklyClassFilter([]);
    setMinMaxFilters({ sectionCount: { min: '', max: '' }, cat: { min: '', max: '' }, student: { min: '', max: '' } });
  }, []);

  const uniqueCourses = useMemo(() => {
    const courseMap = new Map<string, CourseData>();
    coursesData.forEach(course => {
      const key = `${course.pId}-${course.courseCode}`;
      if (!courseMap.has(key)) {
        courseMap.set(key, {
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
      courseMap.get(key)!.sections.push(course);
    });
    return Array.from(courseMap.values()).sort((a, b) => a.pId.localeCompare(b.pId) || a.courseCode.localeCompare(b.courseCode));
  }, [coursesData]);

  const filteredCourseList = useMemo(() => {
    const lowerSearch = searchTerm.toLowerCase();
    return uniqueCourses.filter(course => {
      if(lowerSearch && !course.courseCode.toLowerCase().includes(lowerSearch) && !course.courseTitle.toLowerCase().includes(lowerSearch)) return false;
      if(levelTermFilter.length && !levelTermFilter.includes(course.levelTerm)) return false;
      if(courseTypeFilter.length > 0) { const hasMatchingType = course.sections.some(section => courseTypeFilter.includes(getFullCourseTypeDisplay(section))); if (!hasMatchingType) return false; }
      if(creditFilter.length && !creditFilter.includes(course.credit.toString())) return false;
      if(weeklyClassFilter.length > 0) { const weeklyClassStr = course.weeklyClass?.toString() ?? 'N/A'; if (!weeklyClassFilter.includes(weeklyClassStr)) return false; }

      const totalStudents = course.sections.reduce((sum, s) => sum + s.studentCount, 0);
      const totalCAT = course.sections.reduce((sum, s) => sum + s.classTaken, 0);

      const { sectionCount, cat, student } = minMaxFilters;
      if (sectionCount.min !== '' && course.sections.length < sectionCount.min) return false;
      if (sectionCount.max !== '' && course.sections.length > sectionCount.max) return false;
      if (cat.min !== '' && totalCAT < cat.min) return false;
      if (cat.max !== '' && totalCAT > cat.max) return false;
      if (student.min !== '' && totalStudents < student.min) return false;
      if (student.max !== '' && totalStudents > student.max) return false;
      return true;
    });
  }, [uniqueCourses, searchTerm, levelTermFilter, courseTypeFilter, creditFilter, weeklyClassFilter, minMaxFilters, ciwCounts, classRequirementCounts]);

  useEffect(() => { setCurrentPage(1); }, [filteredCourseList]);
  
  const totalPages = useMemo(() => Math.ceil(filteredCourseList.length / ITEMS_PER_PAGE), [filteredCourseList.length, ITEMS_PER_PAGE]);
  const paginatedCourses = useMemo(() => filteredCourseList.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE), [filteredCourseList, currentPage, ITEMS_PER_PAGE]);

  const toggleExpand = (courseKey: string) => setExpandedCourseKey(prev => prev === courseKey ? null : courseKey);
  
  const handleOpenEditor = (event: React.MouseEvent<HTMLButtonElement>, course: CourseData, mode: 'levelTerm' | 'weekly') => {
    event.stopPropagation();
    if (editingCourse?.courseCode === course.courseCode && editingCourse.pId === course.pId && editingMode === mode) {
        setEditingCourse(null); setEditingMode(null); return;
    }
    const buttonRect = event.currentTarget.getBoundingClientRect();
    const popoverWidth = 256; const popoverHeight = 300; const margin = 8;
    let top = buttonRect.bottom + margin; let left = buttonRect.left;
    if (left + popoverWidth > window.innerWidth) left = window.innerWidth - popoverWidth - margin;
    if (left < margin) left = margin;
    if (top + popoverHeight > window.innerHeight) top = buttonRect.top - popoverHeight - margin;
    if (top < margin) top = margin;
    setPopoverStyle({ position: 'fixed', top: `${top}px`, left: `${left}px`, zIndex: 50 });
    setEditingCourse(course); setEditingMode(mode);
  };
  
  const handleSaveFromPopover = (sectionId: string, stagedEdits: { levelTerm: string; weeklyClass: number | undefined; courseType: CourseType; }) => {
    onUpdateLevelTerm(sectionId, stagedEdits.levelTerm);
    onUpdateWeeklyClass(sectionId, stagedEdits.weeklyClass);
    onUpdateCourseType(sectionId, stagedEdits.courseType);
    setEditingCourse(null); setEditingMode(null);
  };
  const handleCancelPopover = () => { setEditingCourse(null); setEditingMode(null); };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (editorRef.current && !editorRef.current.contains(event.target as Node)) {
            setEditingCourse(null); setEditingMode(null);
        }
    };
    if (editingCourse) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [editingCourse]);

  const FilterPanel = () => {
    const courseUniqueLevelTerms = useMemo(() => Array.from(new Set(uniqueCourses.map(c => c.levelTerm))).sort(), [uniqueCourses]);
    const courseUniqueCourseTypes = useMemo(() => Array.from(new Set(uniqueCourses.flatMap(c => c.sections.map(getFullCourseTypeDisplay)))).sort(), [uniqueCourses]);
    const courseUniqueCredits = useMemo(() => Array.from(new Set(uniqueCourses.map(c => c.credit.toString()))).sort((a,b) => Number(a)-Number(b)), [uniqueCourses]);
    const courseUniqueWeeklyClasses = useMemo(() => Array.from(new Set(uniqueCourses.map(c => c.weeklyClass?.toString() ?? 'N/A'))).sort((a, b) => a === 'N/A' ? 1 : b === 'N/A' ? -1 : Number(a) - Number(b)), [uniqueCourses]);

    const handleCheckboxFilterChange = useCallback((setter: React.Dispatch<React.SetStateAction<string[]>>) => (value: string) => {
        setter(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
    }, []);
    const handleMinMaxFilterChange = useCallback((filterKey: keyof typeof minMaxFilters, type: 'min' | 'max', value: string) => {
        setMinMaxFilters(prev => ({ ...prev, [filterKey]: { ...prev[filterKey], [type]: value === '' ? '' : Number(value) }}));
    }, []);
    const activeFilterCount = useMemo(() => {
        return (levelTermFilter.length ? 1 : 0) + (courseTypeFilter.length ? 1 : 0) + (creditFilter.length ? 1 : 0) + (weeklyClassFilter.length ? 1 : 0) + Object.values(minMaxFilters).filter(f => f.min !== '' || f.max !== '').length;
    }, [levelTermFilter, courseTypeFilter, creditFilter, weeklyClassFilter, minMaxFilters]);
    
    const CheckboxFilterGroup = ({ title, options, selected, onChange }: { title: string, options: string[], selected: string[], onChange: (value: string) => void }) => (
        <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">{title}</label>
            <div className={'grid grid-cols-3 gap-1.5'}>
                {options.map(option => (<button key={option} onClick={() => onChange(option)} className={`w-full px-2 py-1 text-xs font-semibold rounded-md transition-colors border ${selected.includes(option) ? 'bg-teal-600 text-white border-teal-600 shadow-sm' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'}`}>{option}</button>))}
            </div>
        </div>
    );
    const MinMaxInputGroup = ({ label, filterKey }: { label: string, filterKey: keyof typeof minMaxFilters }) => (
       <div>
          <label className="block text-xs font-medium text-gray-700">{label}</label>
          <div className="mt-1 flex items-center gap-1">
              <input type="number" placeholder="Min" min="0" value={minMaxFilters[filterKey].min} onChange={e => handleMinMaxFilterChange(filterKey, 'min', e.target.value)} className="w-full text-xs p-1 border border-gray-300 rounded-md" />
              <span className="text-gray-500 text-xs">-</span>
              <input type="number" placeholder="Max" min="0" value={minMaxFilters[filterKey].max} onChange={e => handleMinMaxFilterChange(filterKey, 'max', e.target.value)} className="w-full text-xs p-1 border border-gray-300 rounded-md" />
          </div>
      </div>
    );

    return (
        <aside className="w-full bg-white rounded-lg shadow-lg border border-gray-200 flex flex-col h-full">
            <div className="flex-shrink-0 p-3 border-b border-slate-200 flex justify-between items-center">
                <h4 className="font-semibold text-slate-700">Filters</h4>
            </div>
            <div className="flex-grow overflow-y-auto filter-panel-scrollbar p-3 space-y-3">
                <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                        <MinMaxInputGroup label="No. of Section" filterKey="sectionCount" />
                        <MinMaxInputGroup label="Classes Taken" filterKey="cat" />
                        <MinMaxInputGroup label="Students" filterKey="student" />
                    </div>
                    <hr className="border-gray-200 !my-2" />
                    <CheckboxFilterGroup title="Level-Term" options={courseUniqueLevelTerms} selected={levelTermFilter} onChange={handleCheckboxFilterChange(setLevelTermFilter)} />
                    <CheckboxFilterGroup title="Credit" options={courseUniqueCredits} selected={creditFilter} onChange={handleCheckboxFilterChange(setCreditFilter)} />
                    <CheckboxFilterGroup title="Weekly Classes" options={courseUniqueWeeklyClasses} selected={weeklyClassFilter} onChange={handleCheckboxFilterChange(setWeeklyClassFilter)} />
                    <CheckboxFilterGroup title="Course Type" options={courseUniqueCourseTypes} selected={courseTypeFilter} onChange={handleCheckboxFilterChange(setCourseTypeFilter)} />
                </div>
            </div>
             <div className="flex-shrink-0 p-3 border-t border-slate-200 flex items-center justify-between gap-2">
                <button onClick={onResetFilters} className="text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 p-1.5 rounded-md shadow-sm border border-red-200 flex-grow">
                    Reset ({activeFilterCount})
                </button>
                 <CourseDataTools
                    coursesData={coursesData}
                    setCoursesData={setCoursesData}
                    dataToDownload={filteredCourseList.flatMap(c => c.sections)}
                    buttonStyle="viewHeader"
                    canImport={!!user?.dashboardAccess?.canImportCourseData}
                    canExport={!!user?.dashboardAccess?.canExportCourseData}
                />
            </div>
        </aside>
    );
  };
  
  return (
    <div className="h-full flex flex-col bg-slate-100 font-sans">
      <header className="flex-shrink-0 p-1.5 bg-white rounded-t-lg shadow-sm border-b z-20 flex items-center justify-between gap-x-3">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-1.5 text-gray-500 hover:bg-gray-200 rounded-full" aria-label="Close Course Master List">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
            <h2 className="text-md font-bold text-gray-800 flex-shrink-0">Course Master List ({filteredCourseList.length})</h2>
          </div>
          
          <div className="relative flex items-center flex-grow max-w-lg">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>
              </div>
              <input 
                  type="search" 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                  placeholder="Search course code or title..." 
                  className="block w-full pl-9 pr-10 py-1.5 border border-gray-300 rounded-md leading-5 bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-teal-500 focus:border-teal-500 sm:text-sm" 
              />
               <div className="absolute inset-y-0 right-0 flex items-center">
                  <button onClick={() => setIsFilterPanelVisible(prev => !prev)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-full relative mr-1" aria-label="Toggle filters">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                  </button>
              </div>
          </div>
      </header>
      
      <div className={`flex-grow flex flex-row min-h-0 p-2 overflow-hidden ${isFilterPanelVisible ? 'gap-3' : ''}`}>
          <div className={`transition-all duration-300 ease-in-out flex-shrink-0 ${isFilterPanelVisible ? 'w-72' : 'w-0'} overflow-hidden`}>
            <div className="w-72 h-full">
              <FilterPanel />
            </div>
          </div>
          <main className="bg-white rounded-lg shadow-sm border overflow-hidden min-w-0 flex flex-col flex-grow">
              <div className="flex-grow overflow-y-auto custom-scrollbar min-h-0">
                  <table className="min-w-full divide-y divide-gray-200 text-xs">
                      <thead className="bg-gray-50 sticky top-0 z-10">
                          <tr>
                              <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-100 border-b border-gray-300">Program</th>
                              <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-100 border-b border-gray-300">L-T</th>
                              <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-100 border-b border-gray-300">Course Code</th>
                              <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-100 border-b border-gray-300">Course Title</th>
                              <th className="px-3 py-2 text-center text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-100 border-b border-gray-300">Cr.</th>
                              <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-100 border-b border-gray-300">Course Type</th>
                              <th className="px-3 py-2 text-center text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-100 border-b border-gray-300" title="Weekly Classes">W.C.</th>
                              <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-100 border-b border-gray-300">Sections</th>
                          </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">{paginatedCourses.map(course => {
                          const courseKey = `${course.pId}-${course.courseCode}`;
                          return (<React.Fragment key={courseKey}>
                              <tr className={`border-b transition-colors duration-150 cursor-pointer group/row text-[11px] ${expandedCourseKey === courseKey ? 'bg-teal-100' : 'bg-gray-50 hover:bg-gray-100'}`} onClick={() => toggleExpand(courseKey)}>
                                  <td className="px-3 py-2 whitespace-nowrap font-semibold text-indigo-600 text-xs">{getProgramShortName(course.pId)}</td>
                                  <td className="px-3 py-2 whitespace-nowrap"><button onClick={(e) => handleOpenEditor(e, course, 'levelTerm')} className="font-semibold bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded-md hover:bg-gray-300 hover:text-black transition-colors text-xs">{formatLevelTermForDisplay(course.levelTerm)}</button></td>
                                  <td className="px-3 py-2 whitespace-nowrap font-medium text-gray-800 flex items-center gap-2"><svg className={`w-3 h-3 text-gray-400 transform transition-transform ${expandedCourseKey === courseKey ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>{course.courseCode}</td>
                                  <td className="px-3 py-2 whitespace-nowrap text-gray-600 truncate max-w-xs">{course.courseTitle}</td>
                                  <td className="px-3 py-2 text-center whitespace-nowrap text-gray-600">{course.credit}</td>
                                  <td className="px-3 py-2 whitespace-nowrap text-gray-600" title={course.sections.length > 0 ? getFullCourseTypeDisplay(course.sections[0]) : course.type}>{course.sections.length > 0 ? getFullCourseTypeDisplay(course.sections[0]) : course.type}</td>
                                  <td className="px-2 py-1 text-center whitespace-nowrap"><button onClick={(e) => { handleOpenEditor(e, course, 'weekly'); }} className="text-center font-semibold bg-gray-200 text-gray-700 px-2 py-0.5 rounded-md hover:bg-gray-300 hover:text-black transition-colors min-w-[30px] text-xs">{course.weeklyClass ?? '-'}</button></td>
                                  <td className="px-3 py-2 text-left whitespace-nowrap font-semibold text-teal-600">{course.sections.length}</td>
                              </tr>
                              {expandedCourseKey === courseKey && (
                                  <tr><td colSpan={8} className="p-2 bg-slate-100">
                                      <div className="overflow-hidden border border-gray-200 rounded-md"><table className="min-w-full divide-y divide-gray-200 text-[11px]"><thead className="bg-slate-200">
                                          <tr><th className="px-2 py-1 text-left font-semibold text-gray-600">Section</th><th className="px-2 py-1 text-center font-semibold text-gray-600" title="Classes in Week">CIW</th><th className="px-2 py-1 text-center font-semibold text-gray-600" title="Class Requirement">CR</th><th className="px-2 py-1 text-center font-semibold text-gray-600" title="Classes Taken">CAT</th><th className="px-2 py-1 text-center font-semibold text-gray-600" title="Students">Stu</th><th className="px-2 py-1 text-left font-semibold text-gray-600">Teacher</th></tr>
                                      </thead><tbody className="bg-white divide-y divide-gray-200">{course.sections.map((section: EnrollmentEntry) => {
                                          const cr = classRequirementCounts.get(section.sectionId) ?? 0; const ciw = ciwCounts.get(section.sectionId) ?? 0;
                                          return (<tr key={section.sectionId}><td className="px-2 py-1 font-medium text-gray-800">{section.section}</td><td className="px-2 py-1 text-center font-semibold text-blue-600">{ciw}</td><td className="px-2 py-1 text-center font-semibold text-purple-600">{cr * ciw}</td><td className="px-2 py-1 text-center font-semibold text-green-600">{section.classTaken}</td><td className="px-2 py-1 text-center text-gray-600">{section.studentCount}</td><td className="px-2 py-1 truncate max-w-xs whitespace-nowrap">{section.teacherName}</td></tr>);
                                      })}</tbody></table></div>
                                  </td></tr>
                              )}
                          </React.Fragment>)
                      })}
                      {filteredCourseList.length === 0 && (<tr><td colSpan={8} className="text-center py-4 text-gray-500 italic">No courses match the current filters.</td></tr>)}
                  </tbody>
                  </table>
              </div>
              {totalPages > 1 && (
                  <footer className="flex-shrink-0 p-2 bg-white rounded-b-lg border-t">
                      <div className="flex justify-between items-center text-xs">
                          <div className="text-gray-600">Showing <span className="font-semibold">{paginatedCourses.length}</span> of <span className="font-semibold">{filteredCourseList.length}</span> courses</div>
                          <div className="flex items-center gap-2">
                              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-2 py-1 rounded-md text-gray-600 bg-gray-100 hover:bg-gray-200 disabled:text-gray-300 disabled:cursor-not-allowed"> &laquo; Previous </button>
                              <span className="text-gray-600 font-medium">Page {currentPage} of {totalPages}</span>
                              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-2 py-1 rounded-md text-gray-600 bg-gray-100 hover:bg-gray-200 disabled:text-gray-300 disabled:cursor-not-allowed"> Next &raquo; </button>
                          </div>
                      </div>
                  </footer>
              )}
          </main>
      </div>
      {editingCourse && (
          <div style={popoverStyle} ref={editorRef} className="w-64 bg-white rounded-lg shadow-2xl border border-gray-300" onClick={(e) => e.stopPropagation()}>
              <CourseSectionEditor course={editingCourse.sections[0]} onSave={handleSaveFromPopover} onCancel={handleCancelPopover} theme="light" mode={editingMode}/>
          </div>
      )}
    </div>
  );
};

export default CourseMasterView;