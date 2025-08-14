import React, { useRef } from 'react';
import * as XLSX from 'xlsx';
import { EnrollmentEntry, CourseType } from '../types';

interface CourseDataToolsProps {
  coursesData: EnrollmentEntry[]; // This is the full dataset for download fallback
  setCoursesData: React.Dispatch<React.SetStateAction<EnrollmentEntry[]>>; // For import
  dataToDownload?: EnrollmentEntry[]; // Optional specific data for download
  buttonStyle?: 'sidebar' | 'viewHeader';
  canImport: boolean;
  canExport: boolean;
}

const CourseDataTools: React.FC<CourseDataToolsProps> = ({ coursesData, setCoursesData, dataToDownload, buttonStyle = 'sidebar', canImport, canExport }) => {
  const courseFileInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = () => {
    courseFileInputRef.current?.click();
  };

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
              semester: String(row.semester || `Semester ${index + 1}`).trim(),
              pId: String(row.pId || `IMPORT_PID_${index}`).trim(),
              sectionId: String(row.sectionId || `SectionID_${Date.now()}_${index}`).trim(),
              courseCode: String(row.courseCode || `COURSE${index + 1}`).trim(),
              courseTitle: String(row.courseTitle || 'Untitled Course').trim(),
              section: String(row.section || `SEC${index + 1}`).trim(),
              credit: Number(row.credit || 0),
              type: String(row.type || 'N/A').trim(),
              levelTerm: String(row.levelTerm || 'N/A').trim(),
              studentCount: Number(row.studentCount || 0),
              teacherId: String(row.teacherId || '').trim(),
              teacherName: String(row.teacherName || 'To Be Assigned').trim(),
              designation: String(row.designation || 'N/A').trim(),
              teacherMobile: String(row.teacherMobile || 'N/A').trim(),
              teacherEmail: String(row.teacherEmail || 'N/A').trim(),
              classTaken: Number(row.classTaken || 0),
              weeklyClass: row.weeklyClass != null ? Number(row.weeklyClass) : undefined,
              courseType: (String(row.courseType || 'N/A').trim() || 'N/A') as CourseType,
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
      const dataForSheet = dataToDownload || coursesData;
      if (dataForSheet.length === 0) {
        alert("No data to download for the current view.");
        return;
      }
      const ws = XLSX.utils.json_to_sheet(dataForSheet);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Courses");
      const fileName = dataToDownload ? "filtered_course_section_data.xlsx" : "all_course_section_data.xlsx";
      XLSX.writeFile(wb, fileName);
  };

  const sidebarButtonClasses = {
      import: "p-1.5 text-white bg-teal-600 hover:bg-teal-500 rounded-md shadow-sm transition-colors",
      download: "p-1.5 text-teal-700 bg-teal-200 hover:bg-teal-300 rounded-md shadow-sm transition-colors",
      iconSize: "h-3 w-3",
  };
  
  const viewHeaderButtonClasses = {
      import: "p-1.5 flex-shrink-0 text-white bg-teal-600 hover:bg-teal-700 rounded-md shadow-sm",
      download: "p-1.5 flex-shrink-0 text-teal-700 bg-teal-100 hover:bg-teal-200 rounded-md shadow-sm border border-teal-200",
      iconSize: "h-4 w-4",
  };

  const currentStyle = buttonStyle === 'sidebar' ? sidebarButtonClasses : viewHeaderButtonClasses;

  return (
    <>
      {canImport && (
        <>
            <input type="file" ref={courseFileInputRef} onChange={handleFileImport} accept=".xlsx, .xls" className="hidden" aria-hidden="true"/>
            <button onClick={handleImportClick} title="Import Course Sections" className={currentStyle.import}>
                <svg xmlns="http://www.w3.org/2000/svg" className={currentStyle.iconSize} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            </button>
        </>
      )}
      {canExport && (
        <button onClick={handleDownload} title="Download Course Sections" className={currentStyle.download}>
            <svg xmlns="http://www.w3.org/2000/svg" className={currentStyle.iconSize} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
        </button>
      )}
    </>
  );
};

export default CourseDataTools;