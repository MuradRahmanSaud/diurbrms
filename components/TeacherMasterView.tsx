import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { ProgramEntry, EnrollmentEntry, FullRoutineData, DefaultTimeSlot } from '../types';
import TeacherViewDetailModal from './modals/TeacherViewDetailModal';
import * as XLSX from 'xlsx';

// --- Sub-component for Expanded Course Load View ---
type DisplayCourse = EnrollmentEntry & { mergedCourses?: DisplayCourse[] };

const TeacherCourseLoadSubView: React.FC<{
  teacher: TeacherData;
  coursesData: EnrollmentEntry[];
  selectedSemesterId: string | null;
  ciwCounts: Map<string, number>;
  classRequirementCounts: Map<string, number>;
  getProgramShortName: (pId?: string) => string;
  onMergeSections: (sourceSectionId: string, targetSectionId: string) => void;
  onUnmergeSection: (sectionIdToUnmerge: string) => void;
}> = ({ teacher, coursesData, selectedSemesterId, ciwCounts, classRequirementCounts, getProgramShortName, onMergeSections, onUnmergeSection }) => {

  const [dragOverSectionId, setDragOverSectionId] = useState<string | null>(null);
  const [draggingSectionId, setDraggingSectionId] = useState<string | null>(null);

  const displayCourses = useMemo(() => {
    if (!teacher.employeeId || !selectedSemesterId) return [];
    const teacherCourses = coursesData.filter(c => c.teacherId === teacher.employeeId && c.semester === selectedSemesterId);
    const courseMap = new Map<string, DisplayCourse>();
    teacherCourses.forEach(c => courseMap.set(c.sectionId, { ...c, mergedCourses: [] }));

    const rootCourses: DisplayCourse[] = [];
    courseMap.forEach(course => {
      if (course.mergedWithSectionId) {
        const parent = courseMap.get(course.mergedWithSectionId);
        if (parent) parent.mergedCourses!.push(course);
        else rootCourses.push(course); // Fallback for orphaned children
      } else {
        rootCourses.push(course);
      }
    });

    const sortChildren = (courses: DisplayCourse[]) => {
      courses.sort((a,b) => a.courseCode.localeCompare(b.courseCode) || a.section.localeCompare(b.section));
      courses.forEach(c => { if (c.mergedCourses && c.mergedCourses.length > 0) sortChildren(c.mergedCourses); });
    };
    rootCourses.forEach(c => { if(c.mergedCourses && c.mergedCourses.length > 0) sortChildren(c.mergedCourses); });
    return rootCourses.sort((a,b) => a.courseCode.localeCompare(b.courseCode) || a.section.localeCompare(b.section));
  }, [teacher.employeeId, selectedSemesterId, coursesData]);

  const handleDragStart = (e: React.DragEvent<HTMLTableRowElement>, sectionId: string) => {
    e.dataTransfer.setData("application/json", JSON.stringify({ type: 'merge-course', sectionId }));
    e.dataTransfer.effectAllowed = "move";
    setDraggingSectionId(sectionId);
  };
  const handleDragEnd = () => { setDraggingSectionId(null); setDragOverSectionId(null); };
  const handleDragOver = (e: React.DragEvent<HTMLElement>) => e.preventDefault();
  const handleRowDragEnter = (e: React.DragEvent<HTMLTableRowElement>, sectionId: string) => { if (draggingSectionId && draggingSectionId !== sectionId) setDragOverSectionId(sectionId); };
  const handleRowDragLeave = () => setDragOverSectionId(null);
  const handleDropOnRow = (e: React.DragEvent<HTMLTableRowElement>, targetSectionId: string) => {
    e.preventDefault();
    setDragOverSectionId(null);
    const data = JSON.parse(e.dataTransfer.getData("application/json"));
    if (data.type !== 'merge-course' || data.sectionId === targetSectionId) return;
    onMergeSections(data.sectionId, targetSectionId);
  };
  const handleUnmergeClick = (parentId: string, chipSectionId: string) => onUnmergeSection(chipSectionId);
  const getTreeStats = (course: DisplayCourse): { students: number, ciw: number, cr: number, cat: number } => {
    const directStats = { students: course.studentCount, ciw: ciwCounts.get(course.sectionId) ?? 0, cr: classRequirementCounts.get(course.sectionId) ?? 0, cat: course.classTaken };
    if (!course.mergedCourses || course.mergedCourses.length === 0) return directStats;
    return course.mergedCourses.reduce((acc, child) => {
      const childStats = getTreeStats(child);
      acc.students += childStats.students; acc.ciw += childStats.ciw; acc.cr += childStats.cr; acc.cat += childStats.cat;
      return acc;
    }, directStats);
  };

  const totals = useMemo(() => {
    return displayCourses.reduce((acc, course) => {
      acc.credits += course.credit;
      const treeStats = getTreeStats(course);
      acc.students += treeStats.students; acc.ciw += treeStats.ciw; acc.cr += treeStats.cr; acc.cat += treeStats.cat;
      return acc;
    }, { credits: 0, students: 0, ciw: 0, cr: 0, cat: 0 });
  }, [displayCourses, ciwCounts, classRequirementCounts, getTreeStats]);

  const renderMergedRows = (courses: DisplayCourse[], level: number, parentId: string) => {
    return courses.map(merged => {
      const rowStats = getTreeStats(merged);
      return (
        <React.Fragment key={merged.sectionId}>
          <tr className="bg-slate-50">
            <td className="px-2 py-1.5 align-top" style={{ paddingLeft: `${0.5 + level * 1.5}rem` }}>
              <div className="flex items-center gap-1">
                <button onClick={() => handleUnmergeClick(parentId, merged.sectionId)} className="font-mono text-lg text-gray-500 hover:text-red-600 transition-colors" title="Unmerge section">↳</button>
                <div className="font-semibold text-gray-800">{merged.courseCode}</div>
              </div>
            </td>
            <td className="px-2 py-1.5 align-top text-gray-600 truncate max-w-xs" title={merged.courseTitle}>{merged.courseTitle}</td>
            <td className="px-2 py-1.5 text-center align-middle text-gray-500 italic">Merge</td>
            <td className="px-2 py-1.5 align-top font-medium text-gray-700">{merged.section}</td>
            <td className="px-2 py-1.5 align-top text-gray-600">{getProgramShortName(merged.pId)}</td>
            <td className="px-2 py-1.5 text-center align-middle text-gray-600">{rowStats.students}</td>
            <td className="px-2 py-1.5 text-center align-middle font-semibold text-blue-600">{rowStats.ciw}</td>
            <td className="px-2 py-1.5 text-center align-middle font-semibold text-purple-600">{rowStats.cr}</td>
            <td className="px-2 py-1.5 text-center align-middle font-semibold text-green-600">{rowStats.cat}</td>
          </tr>
          {merged.mergedCourses && renderMergedRows(merged.mergedCourses, level + 1, merged.sectionId)}
        </React.Fragment>
      );
    });
  };

  if (!selectedSemesterId) return <div className="p-4 text-center text-sm text-gray-500">Please select a semester.</div>;
  if (displayCourses.length === 0) return <div className="p-4 text-center text-sm text-gray-500">No courses assigned to this teacher for the selected semester.</div>;

  return (
    <div className="bg-slate-100 p-2">
      <table className="min-w-full divide-y divide-gray-200 text-xs">
        <thead className="bg-gray-200">
          <tr>
            <th className="px-2 py-2 text-left font-medium text-gray-600 uppercase">Course Code</th>
            <th className="px-2 py-2 text-left font-medium text-gray-600 uppercase">Course Title</th>
            <th className="px-2 py-2 text-center font-medium text-gray-600 uppercase">Credit</th>
            <th className="px-2 py-2 text-left font-medium text-gray-600 uppercase">Section</th>
            <th className="px-2 py-2 text-left font-medium text-gray-600 uppercase">Program</th>
            <th className="px-2 py-2 text-center font-medium text-gray-600 uppercase" title="Students">Stu</th>
            <th className="px-2 py-2 text-center font-medium text-gray-600 uppercase" title="Classes in Week">CIW</th>
            <th className="px-2 py-2 text-center font-medium text-gray-600 uppercase" title="Class Requirement">CR</th>
            <th className="px-2 py-2 text-center font-medium text-gray-600 uppercase" title="Classes Taken">CAT</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {displayCourses.map(section => {
            const isDragging = draggingSectionId === section.sectionId;
            const isDragOver = dragOverSectionId === section.sectionId;
            const rowStats = getTreeStats(section);
            return (
              <React.Fragment key={section.sectionId}>
                <tr draggable="true" onDragStart={(e) => handleDragStart(e, section.sectionId)} onDragEnd={handleDragEnd} onDragOver={handleDragOver} onDragEnter={(e) => handleRowDragEnter(e, section.sectionId)} onDragLeave={handleRowDragLeave} onDrop={(e) => handleDropOnRow(e, section.sectionId)} className={`transition-all duration-150 ${isDragging ? '' : ''} ${isDragOver ? 'bg-teal-100 ring-2 ring-teal-400' : ''}`}>
                  <td className="px-2 py-1.5 align-top font-semibold text-gray-800">{section.courseCode}</td>
                  <td className="px-2 py-1.5 align-top text-gray-600 truncate max-w-xs" title={section.courseTitle}>{section.courseTitle}</td>
                  <td className="px-2 py-1.5 text-center align-middle">{section.credit.toFixed(2)}</td>
                  <td className="px-2 py-1.5 align-top font-medium">{section.section}</td>
                  <td className="px-2 py-1.5 align-top">{getProgramShortName(section.pId)}</td>
                  <td className="px-2 py-1.5 text-center align-middle">{rowStats.students}</td>
                  <td className="px-2 py-1.5 text-center font-semibold text-blue-600 align-middle">{rowStats.ciw}</td>
                  <td className="px-2 py-1.5 text-center font-semibold text-purple-600 align-middle">{rowStats.cr}</td>
                  <td className="px-2 py-1.5 text-center font-semibold text-green-600 align-middle">{rowStats.cat}</td>
                </tr>
                {section.mergedCourses && renderMergedRows(section.mergedCourses, 1, section.sectionId)}
              </React.Fragment>
            );
          })}
        </tbody>
        <tfoot className="bg-gray-100">
          <tr>
            <td colSpan={2} className="px-2 py-2 text-right font-bold text-gray-700">Total</td>
            <td className="px-2 py-2 text-center font-bold text-gray-700">{totals.credits.toFixed(2)}</td>
            <td colSpan={2}></td>
            <td className="px-2 py-2 text-center font-bold text-gray-700">{totals.students}</td>
            <td className="px-2 py-2 text-center font-bold text-blue-700">{totals.ciw}</td>
            <td className="px-2 py-2 text-center font-bold text-purple-700">{totals.cr}</td>
            <td className="px-2 py-2 text-center font-bold text-green-700">{totals.cat}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

// --- Main View Component ---

export interface TeacherData {
    employeeId: string;
    teacherName: string;
    designation: string;
    mobile: string;
    email: string;
    creditLoad: number;
    courses: EnrollmentEntry[];
}

interface TeacherMasterViewProps {
    teachers: TeacherData[];
    allPrograms: ProgramEntry[];
    onClose: () => void;
    ciwCounts: Map<string, number>;
    classRequirementCounts: Map<string, number>;
    getProgramShortName: (pId?: string) => string;
    fullRoutineData: { [semesterId: string]: FullRoutineData };
    systemDefaultSlots: DefaultTimeSlot[];
    selectedSemesterIdForRoutineView: string | null;
    coursesData: EnrollmentEntry[];
    onMergeSections: (sourceSectionId: string, targetSectionId: string) => void;
    onUnmergeSection: (sectionIdToUnmerge: string) => void;
}

const TeacherMasterView: React.FC<TeacherMasterViewProps> = ({
    teachers,
    onClose,
    getProgramShortName,
    selectedSemesterIdForRoutineView,
    coursesData,
    ciwCounts,
    classRequirementCounts,
    onMergeSections,
    onUnmergeSection,
}) => {
    const [expandedTeacherId, setExpandedTeacherId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(15);

    const filteredTeachers = useMemo(() => {
        if (!searchTerm) return teachers;
        const lowercasedSearch = searchTerm.toLowerCase();
        return teachers.filter(teacher =>
            teacher.teacherName.toLowerCase().includes(lowercasedSearch) ||
            teacher.designation.toLowerCase().includes(lowercasedSearch) ||
            (teacher.employeeId && teacher.employeeId.toLowerCase().includes(lowercasedSearch)) ||
            (teacher.email && teacher.email.toLowerCase().includes(lowercasedSearch)) ||
            teacher.courses.some(course =>
                course.courseCode.toLowerCase().includes(lowercasedSearch) ||
                course.section.toLowerCase().includes(lowercasedSearch)
            )
        );
    }, [teachers, searchTerm]);

    useEffect(() => {
      setCurrentPage(1);
    }, [filteredTeachers]);

    const totalPages = useMemo(() => {
        return Math.ceil(filteredTeachers.length / itemsPerPage);
    }, [filteredTeachers.length, itemsPerPage]);

    const paginatedTeachers = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredTeachers.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredTeachers, currentPage, itemsPerPage]);

    const onToggleExpand = (teacherId: string) => {
        setExpandedTeacherId(prev => prev === teacherId ? null : teacherId);
    };

    const handleDownload = useCallback(() => {
        if (filteredTeachers.length === 0) {
            alert("No teacher data to download for the current view.");
            return;
        }
    
        const dataForSheet = filteredTeachers.map(teacher => ({
            "Employee ID": teacher.employeeId,
            "Teacher Name": teacher.teacherName,
            "Designation": teacher.designation,
            "Mobile": teacher.mobile,
            "Email": teacher.email,
            "Credit Load": teacher.creditLoad.toFixed(2),
            "Number of Sections": teacher.courses.length,
            "Course Codes": teacher.courses.map(c => c.courseCode).join(', '),
        }));
    
        const ws = XLSX.utils.json_to_sheet(dataForSheet);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Teachers");
        XLSX.writeFile(wb, "teacher_master_list.xlsx");
    }, [filteredTeachers]);

    return (
        <div className="h-full flex flex-col bg-slate-50 p-2">
            <header className="flex-shrink-0 mb-2 p-3 bg-white rounded-lg shadow-sm border flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={onClose} className="text-sm font-medium text-teal-600 hover:underline flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z" />
                        </svg>
                        Back
                    </button>
                    <h3 className="text-md font-semibold text-gray-800">Teacher List ({filteredTeachers.length})</h3>
                    <button onClick={handleDownload} title="Download Teacher List" className="p-1.5 flex-shrink-0 text-teal-700 bg-teal-100 hover:bg-teal-200 rounded-md shadow-sm border border-teal-200">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                    </button>
                </div>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <input
                        type="search"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search teachers..."
                        className="block w-64 pl-9 pr-3 py-1.5 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-teal-500 focus:border-teal-500 sm:text-sm"
                    />
                </div>
            </header>
            <main className="flex-grow bg-white rounded-lg shadow-sm border overflow-auto custom-scrollbar min-w-0">
                <table className="min-w-full divide-y divide-gray-200 text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                        <tr>
                            <th scope="col" className="w-10 px-3 py-2"></th>
                            <th scope="col" className="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Teacher ID</th>
                            <th scope="col" className="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Teacher Name</th>
                            <th scope="col" className="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Designation</th>
                            <th scope="col" className="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Mobile</th>
                            <th scope="col" className="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Email</th>
                            <th scope="col" className="px-3 py-2 text-center font-medium text-gray-500 uppercase tracking-wider">Sections</th>
                            <th scope="col" className="px-3 py-2 text-right font-medium text-gray-500 uppercase tracking-wider">Credit Load</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {paginatedTeachers.map(teacher => (
                            <React.Fragment key={teacher.employeeId}>
                                <tr className="hover:bg-gray-50 group cursor-pointer" onClick={() => onToggleExpand(teacher.employeeId)}>
                                    <td className="px-3 py-2 whitespace-nowrap text-center">
                                        <svg className={`w-3 h-3 text-gray-400 transform transition-transform group-hover:text-gray-600 ${expandedTeacherId === teacher.employeeId ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-gray-600">{teacher.employeeId}</td>
                                    <td className="px-3 py-2 whitespace-nowrap font-medium text-gray-800">{teacher.teacherName}</td>
                                    <td className="px-3 py-2 whitespace-nowrap text-gray-600">{teacher.designation}</td>
                                    <td className="px-3 py-2 whitespace-nowrap text-gray-600">{teacher.mobile}</td>
                                    <td className="px-3 py-2 whitespace-nowrap text-gray-600">{teacher.email}</td>
                                    <td className="px-3 py-2 whitespace-nowrap text-center text-gray-600">{teacher.courses.length}</td>
                                    <td className="px-3 py-2 whitespace-nowrap text-right font-semibold text-teal-600">{teacher.creditLoad.toFixed(2)}</td>
                                </tr>
                                {expandedTeacherId === teacher.employeeId && (
                                    <tr>
                                        <td colSpan={8} className="p-0">
                                            <TeacherCourseLoadSubView
                                                teacher={teacher}
                                                coursesData={coursesData}
                                                selectedSemesterId={selectedSemesterIdForRoutineView}
                                                ciwCounts={ciwCounts}
                                                classRequirementCounts={classRequirementCounts}
                                                getProgramShortName={getProgramShortName}
                                                onMergeSections={onMergeSections}
                                                onUnmergeSection={onUnmergeSection}
                                            />
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </main>
            {totalPages > 1 && (
                <footer className="flex-shrink-0 mt-2 p-2 bg-white rounded-lg shadow-sm border flex justify-between items-center text-xs">
                    <div>
                        <span className="mr-2 text-gray-600">Items per page:</span>
                        <select
                            value={itemsPerPage}
                            onChange={e => {
                                setItemsPerPage(Number(e.target.value));
                                setCurrentPage(1);
                            }}
                            className="p-1 border border-gray-300 rounded-md bg-white text-gray-700"
                        >
                            <option value={10}>10</option>
                            <option value={15}>15</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="px-2 py-1 rounded-md text-gray-600 bg-gray-100 hover:bg-gray-200 disabled:text-gray-300 disabled:cursor-not-allowed"
                        >
                            &laquo; Previous
                        </button>
                        <span className="text-gray-700 font-medium">
                            Page {currentPage} of {totalPages}
                        </span>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="px-2 py-1 rounded-md text-gray-600 bg-gray-100 hover:bg-gray-200 disabled:text-gray-300 disabled:cursor-not-allowed"
                        >
                            Next &raquo;
                        </button>
                    </div>
                </footer>
            )}
        </div>
    );
};

export default TeacherMasterView;
