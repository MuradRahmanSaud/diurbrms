import React, { useState } from 'react';
import { ProgramEntry, EnrollmentEntry } from '../../types';
import TeacherViewDetailModal from '../modals/TeacherViewDetailModal';

export interface TeacherData {
    employeeId: string;
    teacherName: string;
    designation: string;
    mobile: string;
    email: string;
    creditLoad: number;
    courses: EnrollmentEntry[];
}

interface TeacherListViewProps {
    teachers: TeacherData[];
    allPrograms: ProgramEntry[];
    onBack: () => void;
    expandedTeacherId: string | null;
    onToggleExpand: (teacherId: string) => void;
    ciwCounts: Map<string, number>;
    classRequirementCounts: Map<string, number>;
    getProgramShortName: (pId?: string) => string;
    currentPage: number;
    totalPages: number;
    onNextPage: () => void;
    onPrevPage: () => void;
    totalTeacherCount: number;
    searchTerm: string;
    onSearchChange: (value: string) => void;
    uniqueDesignations: string[];
    designationFilter: string[];
    onDesignationFilterChange: (designation: string) => void;
    creditLoadFilter: { min: number | ''; max: number | '' };
    onCreditLoadFilterChange: (key: 'min' | 'max', value: string) => void;
    onResetFilters: () => void;
    activeFilterCount: number;
    programFilter: string[];
    onProgramFilterChange: (pId: string) => void;
    uniqueProgramsForFilter: { pId: string; shortName: string }[];
    onViewTeacherDetail?: (teacher: TeacherData) => void;
}

const TeacherListView: React.FC<TeacherListViewProps> = ({ 
    teachers, 
    allPrograms,
    onBack,
    expandedTeacherId,
    onToggleExpand,
    ciwCounts,
    classRequirementCounts,
    getProgramShortName,
    currentPage,
    totalPages,
    onNextPage,
    onPrevPage,
    totalTeacherCount,
    searchTerm,
    onSearchChange,
    uniqueDesignations,
    designationFilter,
    onDesignationFilterChange,
    creditLoadFilter,
    onCreditLoadFilterChange,
    onResetFilters,
    activeFilterCount,
    programFilter,
    onProgramFilterChange,
    uniqueProgramsForFilter,
    onViewTeacherDetail,
}) => {
    const [isFilterPanelVisible, setIsFilterPanelVisible] = useState(false);

    const FilterPanel = () => (
        <div className="flex flex-col h-full">
            <div className="flex justify-between items-center mb-3 flex-shrink-0">
                <h4 className="font-semibold text-gray-700">Filters</h4>
                <button onClick={onResetFilters} className="text-xs text-red-600 hover:underline">Reset All ({activeFilterCount})</button>
            </div>
            <div className="flex-grow overflow-y-auto filter-panel-scrollbar pr-1 -mr-2 space-y-4">
                <div>
                    <label className="block text-xs font-medium text-gray-700">Designation</label>
                    <div className="mt-1 space-y-1 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                        {uniqueDesignations.map(designation => (
                            <label key={designation} className="flex items-center text-xs">
                                <input
                                    type="checkbox"
                                    checked={designationFilter.includes(designation)}
                                    onChange={() => onDesignationFilterChange(designation)}
                                    className="h-3 w-3 rounded text-teal-600 focus:ring-teal-500 border-gray-300"
                                />
                                <span className="ml-2 text-gray-700">{designation}</span>
                            </label>
                        ))}
                    </div>
                </div>
                 <div>
                    <label className="block text-xs font-medium text-gray-700">Program</label>
                    <div className="mt-1 space-y-1 max-h-32 overflow-y-auto custom-scrollbar pr-1">
                        {uniqueProgramsForFilter.map(program => (
                            <label key={program.pId} className="flex items-center text-xs">
                                <input
                                    type="checkbox"
                                    checked={programFilter.includes(program.pId)}
                                    onChange={() => onProgramFilterChange(program.pId)}
                                    className="h-3 w-3 rounded text-teal-600 focus:ring-teal-500 border-gray-300"
                                />
                                <span className="ml-2 text-gray-700" title={program.pId}>{program.shortName}</span>
                            </label>
                        ))}
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-700">Credit Load</label>
                    <div className="mt-1 flex items-center gap-2">
                        <input
                            type="number"
                            placeholder="Min"
                            min="0"
                            value={creditLoadFilter.min}
                            onChange={e => onCreditLoadFilterChange('min', e.target.value)}
                            className="w-full text-xs p-1 border border-gray-300 rounded-md"
                        />
                        <span className="text-gray-500">-</span>
                        <input
                            type="number"
                            placeholder="Max"
                            min="0"
                            value={creditLoadFilter.max}
                            onChange={e => onCreditLoadFilterChange('max', e.target.value)}
                            className="w-full text-xs p-1 border border-gray-300 rounded-md"
                        />
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="h-full flex flex-row gap-3 overflow-hidden bg-slate-50 p-2">
            {/* Filter Panel (Left Side) */}
            <div className={`
                flex-shrink-0 bg-white rounded-lg shadow-lg border border-gray-200 transition-all duration-300 ease-in-out
                ${isFilterPanelVisible ? 'w-64 p-3' : 'w-0 p-0 border-0 overflow-hidden'}
            `}>
                {isFilterPanelVisible && <FilterPanel />}
            </div>
            
            {/* Main Content (Table on the Right) */}
            <div className="h-full flex flex-col flex-grow min-w-0">
                {/* Header */}
                <div className="flex-shrink-0 mb-2 p-3 bg-white rounded-lg shadow-sm border flex items-center justify-between gap-x-3">
                    <div className="flex items-center gap-3 flex-shrink-0">
                        <button onClick={onBack} className="text-sm font-medium text-teal-600 hover:underline flex items-center gap-1">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z" />
                            </svg>
                            Back
                        </button>
                        <h3 className="text-md font-semibold text-gray-800">Teacher List ({totalTeacherCount})</h3>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="relative w-64">
                            <div className="flex items-center border border-gray-300 rounded-md bg-white focus-within:ring-1 focus-within:ring-teal-500 focus-within:border-teal-500 transition-all">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <svg className="h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <input
                                    type="search"
                                    value={searchTerm}
                                    onChange={(e) => onSearchChange(e.target.value)}
                                    placeholder="Search teachers..."
                                    className="block w-full pl-9 pr-10 py-1.5 border-0 rounded-md leading-5 bg-transparent placeholder-gray-500 focus:outline-none focus:ring-0 sm:text-sm"
                                />
                                <div className="absolute inset-y-0 right-0 flex items-center">
                                    <button
                                        onClick={() => setIsFilterPanelVisible(prev => !prev)}
                                        className="p-1.5 text-gray-400 hover:text-gray-600 focus:outline-none rounded-full mr-1 relative"
                                        aria-label="Toggle filters"
                                        aria-expanded={isFilterPanelVisible}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293.707L3.293 7.293A1 1 0 013 6.586V4z" />
                                        </svg>
                                        {activeFilterCount > 0 && (
                                            <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-3 w-3 bg-teal-500"></span>
                                            </span>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex-grow bg-white rounded-lg shadow-sm border overflow-auto custom-scrollbar min-w-0">
                    <table className="min-w-full divide-y divide-gray-200 text-xs">
                        <thead className="bg-gray-50 sticky top-0">
                            <tr>
                                <th scope="col" className="w-10 px-3 py-2"></th>
                                <th scope="col" className="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Employee ID</th>
                                <th scope="col" className="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Teacher Name</th>
                                <th scope="col" className="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Designation</th>
                                <th scope="col" className="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Mobile</th>
                                <th scope="col" className="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Email</th>
                                <th scope="col" className="px-3 py-2 text-right font-medium text-gray-500 uppercase tracking-wider">Credit Load</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {teachers.length > 0 ? teachers.map(teacher => (
                            <React.Fragment key={teacher.employeeId}>
                                    <tr className="hover:bg-gray-50 group" onClick={() => onToggleExpand(teacher.employeeId)}>
                                        <td className="px-3 py-2 whitespace-nowrap text-center cursor-pointer">
                                            <svg className={`w-3 h-3 text-gray-400 transform transition-transform group-hover:text-gray-600 ${expandedTeacherId === teacher.employeeId ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap text-gray-600 flex items-center gap-2">
                                            {onViewTeacherDetail && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onViewTeacherDetail(teacher); }}
                                                    className="p-1 text-teal-600 hover:bg-teal-100 rounded-full cursor-pointer"
                                                    title={`View details for ${teacher.teacherName}`}
                                                    aria-label={`View details for ${teacher.teacherName}`}
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                                        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.022 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                                                    </svg>
                                                </button>
                                            )}
                                            {teacher.employeeId}
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap font-medium text-gray-800 cursor-pointer">{teacher.teacherName}</td>
                                        <td className="px-3 py-2 whitespace-nowrap text-gray-600 cursor-pointer">{teacher.designation}</td>
                                        <td className="px-3 py-2 whitespace-nowrap text-gray-600 cursor-pointer">{teacher.mobile}</td>
                                        <td className="px-3 py-2 whitespace-nowrap text-gray-600 cursor-pointer">{teacher.email}</td>
                                        <td className="px-3 py-2 whitespace-nowrap text-right font-semibold text-teal-600 cursor-pointer">{teacher.creditLoad.toFixed(2)}</td>
                                    </tr>
                                    {expandedTeacherId === teacher.employeeId && (
                                        <tr>
                                            <td colSpan={7} className="p-2 bg-slate-100">
                                                <div className="overflow-hidden border border-gray-200 rounded-md">
                                                    <table className="min-w-full divide-y divide-gray-200 text-[11px]">
                                                        <thead className="bg-slate-200">
                                                            <tr>
                                                                <th className="px-2 py-1 text-left font-semibold text-gray-600">Program</th>
                                                                <th className="px-2 py-1 text-left font-semibold text-gray-600">Course Code</th>
                                                                <th className="px-2 py-1 text-left font-semibold text-gray-600">Course Title</th>
                                                                <th className="px-2 py-1 text-center font-semibold text-gray-600">Cr.</th>
                                                                <th className="px-2 py-1 text-center font-semibold text-gray-600">Section</th>
                                                                <th className="px-2 py-1 text-center font-semibold text-gray-600" title="Students">Stu</th>
                                                                <th className="px-2 py-1 text-center font-semibold text-gray-600" title="Classes in Week">CIW</th>
                                                                <th className="px-2 py-1 text-center font-semibold text-gray-600" title="Class Requirement">CR</th>
                                                                <th className="px-2 py-1 text-center font-semibold text-gray-600" title="Classes Taken">CAT</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="bg-white divide-y divide-gray-200">
                                                            {teacher.courses.map((section: EnrollmentEntry) => {
                                                                const cr = classRequirementCounts.get(section.sectionId) ?? 0;
                                                                const ciw = ciwCounts.get(section.sectionId) ?? 0;
                                                                return (
                                                                    <tr key={section.sectionId}>
                                                                        <td className="px-2 py-1 font-medium">{getProgramShortName(section.pId)}</td>
                                                                        <td className="px-2 py-1 font-semibold">{section.courseCode}</td>
                                                                        <td className="px-2 py-1 truncate max-w-xs" title={section.courseTitle}>{section.courseTitle}</td>
                                                                        <td className="px-2 py-1 text-center">{section.credit}</td>
                                                                        <td className="px-2 py-1 text-center font-medium">{section.section}</td>
                                                                        <td className="px-2 py-1 text-center">{section.studentCount}</td>
                                                                        <td className="px-2 py-1 text-center font-semibold text-blue-600">{ciw}</td>
                                                                        <td className="px-2 py-1 text-center font-semibold text-purple-600">{cr}</td>
                                                                        <td className="px-2 py-1 text-center font-semibold text-green-600">{section.classTaken}</td>
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
                            )) : (
                                <tr><td colSpan={7} className="text-center py-4 text-gray-500 italic">No teachers match the current filters.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {totalPages > 1 && (
                    <div className="flex-shrink-0 pt-2 flex justify-between items-center text-xs">
                        <button
                            onClick={onPrevPage}
                            disabled={currentPage === 1}
                            className="px-2 py-1 rounded-md text-gray-600 bg-gray-100 hover:bg-gray-200 disabled:text-gray-300 disabled:cursor-not-allowed disabled:bg-transparent"
                        >
                            &laquo; Previous
                        </button>
                        <span className="text-gray-600 font-medium">Page {currentPage} of {totalPages}</span>
                        <button
                            onClick={onNextPage}
                            disabled={currentPage === totalPages}
                            className="px-2 py-1 rounded-md text-gray-600 bg-gray-100 hover:bg-gray-200 disabled:text-gray-300 disabled:cursor-not-allowed disabled:bg-transparent"
                        >
                            Next &raquo;
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default TeacherListView;