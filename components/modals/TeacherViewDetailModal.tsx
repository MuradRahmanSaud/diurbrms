import React, { useMemo, useState, useEffect } from 'react';
import Modal from '../Modal';
import { TeacherData } from '../semester-detail-views/TeacherListView';
import { FullRoutineData, DefaultTimeSlot, ProgramEntry, DayOfWeek, ClassDetail, EnrollmentEntry } from '../../types';
import { DAYS_OF_WEEK } from '../../data/routineConstants';
import { formatDefaultSlotToString, formatTimeToAMPM } from '../../App';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { sortSlotsByTypeThenTime } from '../../data/slotConstants';

interface TeacherViewDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  teacher: TeacherData | null;
  fullRoutineData: { [semesterId: string]: FullRoutineData };
  systemDefaultSlots: DefaultTimeSlot[];
  allPrograms: ProgramEntry[];
  selectedSemesterId: string | null;
  ciwCounts: Map<string, number>;
  classRequirementCounts: Map<string, number>;
  getProgramShortName: (pId?: string) => string;
  coursesData: EnrollmentEntry[];
}

const TeacherViewDetailModal: React.FC<TeacherViewDetailModalProps> = ({
  isOpen,
  onClose,
  teacher,
  fullRoutineData,
  systemDefaultSlots,
  allPrograms,
  selectedSemesterId,
  ciwCounts,
  classRequirementCounts,
  getProgramShortName,
  coursesData,
}) => {
  const [activeTab, setActiveTab] = useState<'routine' | 'courses'>('routine');
  const [selectedSectionForDetail, setSelectedSectionForDetail] = useState<EnrollmentEntry | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab('routine');
      setSelectedSectionForDetail(null);
    }
  }, [isOpen]);

  useEffect(() => {
    // Reset section detail view when tab changes
    setSelectedSectionForDetail(null);
  }, [activeTab]);
  
  const allCoursesForTeacherInSemester = useMemo(() => {
    if (!teacher || !coursesData) {
      return [];
    }
    
    let teacherCourses = coursesData.filter(c => c.teacherId === teacher.employeeId);
    
    if (selectedSemesterId) {
      teacherCourses = teacherCourses.filter(c => c.semester === selectedSemesterId);
    }
    
    return teacherCourses;
  }, [teacher, coursesData, selectedSemesterId]);

  const routineForTeacher = useMemo(() => {
    if (!teacher || !selectedSemesterId) {
      return { schedule: new Map(), theorySlots: [], labSlots: [] };
    }

    const routineForSemester = fullRoutineData[selectedSemesterId] || {};
    const teacherSchedule = new Map<DayOfWeek, Map<string, { classInfo: ClassDetail; room: string }>>();
    
    const relevantProgramPIds = new Set(allCoursesForTeacherInSemester.map(c => c.pId));
    const relevantPrograms = allPrograms.filter(p => relevantProgramPIds.has(p.pId));

    const timeSlotMap = new Map<string, DefaultTimeSlot>();
    systemDefaultSlots.forEach(slot => timeSlotMap.set(formatDefaultSlotToString(slot), slot));
    relevantPrograms.forEach(p => {
      (p.programSpecificSlots || []).forEach(slot => timeSlotMap.set(formatDefaultSlotToString(slot), slot));
    });

    const timeSlots = Array.from(timeSlotMap.values()).sort(sortSlotsByTypeThenTime);
    const theorySlots = timeSlots.filter(slot => slot.type === 'Theory');
    const labSlots = timeSlots.filter(slot => slot.type === 'Lab');

    DAYS_OF_WEEK.forEach(day => {
      const daySchedule = new Map<string, { classInfo: ClassDetail; room: string }>();
      const dayData = routineForSemester[day];
      if (dayData) {
        Object.entries(dayData).forEach(([room, slots]) => {
          Object.entries(slots).forEach(([slotString, classInfo]) => {
            if (classInfo && classInfo.teacher === teacher.teacherName) {
              daySchedule.set(slotString, { classInfo, room });
            }
          });
        });
      }
      if (daySchedule.size > 0) {
        teacherSchedule.set(day, daySchedule);
      }
    });

    return { schedule: teacherSchedule, theorySlots, labSlots };
  }, [teacher, selectedSemesterId, fullRoutineData, systemDefaultSlots, allPrograms, allCoursesForTeacherInSemester]);

  const handleDownloadPDF = () => {
    if (!teacher || !selectedSemesterId) return;

    const doc = new jsPDF({ orientation: 'landscape' });

    // Title
    doc.setFontSize(16);
    doc.text(teacher.teacherName, doc.internal.pageSize.getWidth() / 2, 15, { align: 'center' });
    doc.setFontSize(12);
    doc.text(teacher.designation, doc.internal.pageSize.getWidth() / 2, 22, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Class Routine for ${selectedSemesterId}`, doc.internal.pageSize.getWidth() / 2, 28, { align: 'center' });

    const { schedule, theorySlots, labSlots } = routineForTeacher;
    
    const formatSlotHeader = (slot: DefaultTimeSlot) => {
        return formatDefaultSlotToString(slot).replace(' - ', '\n');
    };

    const head: any[] = [];
    const headRow1: any[] = [{ content: 'Day', rowSpan: 2, styles: { valign: 'middle' } }];
    const headRow2: string[] = [];
    
    if (theorySlots.length > 0) {
        headRow1.push({ content: 'Theory Slots', colSpan: theorySlots.length, styles: { halign: 'center' } });
        headRow2.push(...theorySlots.map(formatSlotHeader));
    }
    if (labSlots.length > 0) {
        headRow1.push({ content: 'Lab Slots', colSpan: labSlots.length, styles: { halign: 'center' } });
        headRow2.push(...labSlots.map(formatSlotHeader));
    }
    head.push(headRow1, headRow2);
    
    const body = DAYS_OF_WEEK.map(day => {
        const row: string[] = [day];
        [...theorySlots, ...labSlots].forEach(slot => {
            const slotString = formatDefaultSlotToString(slot);
            const entry = schedule.get(day)?.get(slotString);
            row.push(entry ? `${entry.classInfo.courseCode} (${entry.classInfo.section})\n${entry.room}` : '-');
        });
        return row;
    });

    autoTable(doc, {
        head: head,
        body: body,
        startY: 35,
        theme: 'grid',
        styles: {
            fontSize: 7,
            cellPadding: 1,
            halign: 'center',
            valign: 'middle',
            lineWidth: 0.1,
            lineColor: [44, 62, 80],
        },
        headStyles: {
            fillColor: [13, 72, 74], // Teal color
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 6,
        },
        columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 20 }, // Day column
        },
    });
    
    doc.save(`${teacher.teacherName}_Routine_${selectedSemesterId}.pdf`);
  };

  if (!teacher) return null;

  const handleSectionRowClick = (section: EnrollmentEntry) => {
    setSelectedSectionForDetail(prev => (prev?.sectionId === section.sectionId ? null : section));
  };
  
  const modalHeaderContent = (
    <div className="text-center w-full">
        <p className="text-lg font-bold text-teal-700">{teacher.teacherName}</p>
        <p className="text-sm text-gray-500">{teacher.designation}</p>
        <p className="text-xs text-gray-500 mt-1">
            Contact: <a href={`tel:${teacher.mobile}`} className="text-blue-600 hover:underline">{teacher.mobile}</a>
            <span className="mx-2 text-gray-300">|</span>
            <a href={`mailto:${teacher.email}`} className="text-blue-600 hover:underline">{teacher.email}</a>
             {selectedSemesterId && (
                <>
                    <span className="mx-2 text-gray-300">|</span>
                    <span>{selectedSemesterId}</span>
                </>
            )}
        </p>
    </div>
  );

  const footerContent = (
    <div className="flex justify-between items-center w-full">
        <button
            onClick={handleDownloadPDF}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md shadow-sm flex items-center disabled:bg-gray-400 disabled:cursor-not-allowed"
            aria-label="Download routine as PDF"
            disabled={activeTab !== 'routine'}
            title={activeTab !== 'routine' ? 'Only available for routine view' : 'Download Routine as PDF'}
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            Download PDF
        </button>
        <button 
            type="button" 
            onClick={onClose} 
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md border border-gray-300"
        >
            Close
        </button>
    </div>
  );

  const routineContent = (
    <>
      {(routineForTeacher.theorySlots.length > 0 || routineForTeacher.labSlots.length > 0) ? (
        <section>
          <div className="overflow-auto custom-scrollbar border rounded-lg">
            <table className="min-w-full table-fixed border-collapse">
              <thead className="sticky top-0 bg-gray-100 z-10">
                <tr>
                  <th className="w-24 p-1 text-center text-[10px] font-bold text-gray-600 uppercase border border-gray-300">Day/Time</th>
                  {routineForTeacher.theorySlots.map(slot => {
                    const startTimeAMPM = formatTimeToAMPM(slot.startTime);
                    const endTimeAMPM = formatTimeToAMPM(slot.endTime);
                    return (
                        <th key={slot.id} className="w-28 p-1 text-center text-[9px] font-bold text-gray-600 uppercase border border-gray-300 break-words">
                            <span className="hidden lg:inline">{startTimeAMPM} - {endTimeAMPM}</span>
                            <div className="lg:hidden flex flex-col leading-tight">
                                <span>{startTimeAMPM}</span>
                                <hr className="border-t border-gray-200 w-1/2 mx-auto my-0.5" />
                                <span>{endTimeAMPM}</span>
                            </div>
                        </th>
                    );
                  })}
                  {routineForTeacher.labSlots.map((slot, index) => {
                    const startTimeAMPM = formatTimeToAMPM(slot.startTime);
                    const endTimeAMPM = formatTimeToAMPM(slot.endTime);
                    return (
                        <th key={slot.id} className={`w-28 p-1 text-center text-[9px] font-bold text-gray-600 uppercase border border-gray-300 break-words ${index === 0 && routineForTeacher.theorySlots.length > 0 ? 'border-l-2 border-l-slate-400' : ''}`}>
                            <span className="hidden lg:inline">{startTimeAMPM} - {endTimeAMPM}</span>
                            <div className="lg:hidden flex flex-col leading-tight">
                                <span>{startTimeAMPM}</span>
                                <hr className="border-t border-gray-200 w-1/2 mx-auto my-0.5" />
                                <span>{endTimeAMPM}</span>
                            </div>
                        </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="text-center">
                {DAYS_OF_WEEK.map(day => (
                    <tr key={day} className="even:bg-white odd:bg-gray-50">
                      <th className="p-1 text-xs font-bold text-white bg-teal-600 border border-gray-300 h-12">{day}</th>
                      {routineForTeacher.theorySlots.map(slot => {
                        const slotString = formatDefaultSlotToString(slot);
                        const entry = routineForTeacher.schedule.get(day)?.get(slotString);
                        return (
                          <td key={slot.id} className="p-0.5 border border-gray-300 h-12 align-top">
                            {entry ? (
                              <div className={`h-full w-full p-0.5 rounded-md text-center flex flex-col justify-center ${entry.classInfo.color || 'bg-gray-200'}`}>
                                <p className="font-bold text-gray-800 text-[10px] truncate" title={`${entry.classInfo.courseCode} (${entry.classInfo.section})`}>
                                  {entry.classInfo.courseCode} ({entry.classInfo.section})
                                </p>
                                <p className="text-gray-600 text-[9px] mt-0.5" title={`Room: ${entry.room}`}>
                                  {entry.room}
                                </p>
                              </div>
                            ) : (
                              <div className="h-full w-full flex items-center justify-center text-xs text-gray-400">-</div>
                            )}
                          </td>
                        );
                      })}
                      {routineForTeacher.labSlots.map((slot, index) => {
                        const slotString = formatDefaultSlotToString(slot);
                        const entry = routineForTeacher.schedule.get(day)?.get(slotString);
                        return (
                          <td key={slot.id} className={`p-0.5 border border-gray-300 h-12 align-top ${index === 0 && routineForTeacher.theorySlots.length > 0 ? 'border-l-2 border-l-slate-400' : ''}`}>
                              {entry ? (
                                <div className={`h-full w-full p-0.5 rounded-md text-center flex flex-col justify-center ${entry.classInfo.color || 'bg-gray-200'}`}>
                                  <p className="font-bold text-gray-800 text-[10px] truncate" title={`${entry.classInfo.courseCode} (${entry.classInfo.section})`}>
                                    {entry.classInfo.courseCode} ({entry.classInfo.section})
                                  </p>
                                  <p className="text-gray-600 text-[9px] mt-0.5" title={`Room: ${entry.room}`}>
                                    {entry.room}
                                  </p>
                                </div>
                              ) : (
                                <div className="h-full w-full flex items-center justify-center text-xs text-gray-400">-</div>
                              )}
                          </td>
                        );
                      })}
                    </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <div className="text-center text-sm text-gray-500 italic py-5 bg-gray-50 rounded-md">
          No applicable time slots found to build a routine view for this teacher.
        </div>
      )}
    </>
  );

  const SectionDetailPanel = ({ section }: { section: EnrollmentEntry }) => {
    const routineForSelectedSection = useMemo(() => {
        if (!selectedSemesterId) return [];
        const routineForSemester = fullRoutineData[selectedSemesterId] || {};
        const scheduledClasses: { day: string; timeSlot: string; room: string }[] = [];
        Object.keys(routineForSemester).forEach(day => {
            const dayData = routineForSemester[day as DayOfWeek];
            if (dayData) {
                Object.keys(dayData).forEach(roomNumber => {
                    const roomData = dayData[roomNumber];
                    Object.keys(roomData).forEach(timeSlot => {
                        const classInfo = roomData[timeSlot as keyof typeof roomData];
                        if (classInfo && classInfo.courseCode === section.courseCode && classInfo.section === section.section) {
                            scheduledClasses.push({ day, timeSlot, room: roomNumber });
                        }
                    });
                });
            }
        });
        return scheduledClasses.sort((a,b) => DAYS_OF_WEEK.indexOf(a.day as DayOfWeek) - DAYS_OF_WEEK.indexOf(b.day as DayOfWeek));
    }, [section, selectedSemesterId, fullRoutineData]);

    const ciw = ciwCounts.get(section.sectionId) ?? 0;
    const cr = classRequirementCounts.get(section.sectionId) ?? 0;
    const cat = section.classTaken;
    
    return (
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 h-full flex flex-col p-3 section-detail-scrollbar overflow-y-auto">
            <div className="flex justify-between items-start pb-2 border-b mb-3">
                <div className="flex-grow min-w-0">
                    <h4 className="font-bold text-teal-700 text-lg">{section.courseCode}</h4>
                    <p className="text-xs text-gray-600 truncate" title={section.courseTitle}>{section.courseTitle}</p>
                </div>
                <button onClick={() => setSelectedSectionForDetail(null)} className="p-1 text-gray-400 hover:bg-gray-200 rounded-full">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
            
            <div className="grid grid-cols-5 gap-2 text-center text-xs mb-3">
                <div><div className="font-semibold text-gray-500">Cr.</div><div className="font-bold text-lg text-gray-800">{section.credit}</div></div>
                <div><div className="font-semibold text-gray-500">Stu</div><div className="font-bold text-lg text-gray-800">{section.studentCount}</div></div>
                <div><div className="font-semibold text-gray-500">CIW</div><div className="font-bold text-lg text-blue-600">{ciw}</div></div>
                <div><div className="font-semibold text-gray-500">CR</div><div className="font-bold text-lg text-purple-600">{cr}</div></div>
                <div><div className="font-semibold text-gray-500">CAT</div><div className="font-bold text-lg text-green-600">{cat}</div></div>
            </div>

            <h5 className="text-sm font-semibold text-gray-700 mb-2">Class Routine</h5>
            <div className="space-y-1.5 flex-grow">
                {routineForSelectedSection.length > 0 ? (
                    routineForSelectedSection.map((c, index) => (
                        <div key={index} className="p-1.5 bg-gray-50 rounded-md border border-gray-200">
                             <p className="font-medium text-gray-800 text-xs">{c.day}</p>
                             <p className="text-gray-600 text-[11px]">{c.timeSlot}</p>
                             <p className="text-gray-600 text-[11px]">Room: <span className="font-semibold">{c.room}</span></p>
                        </div>
                    ))
                ) : (
                    <p className="text-xs italic text-gray-500 text-center py-4">Not scheduled</p>
                )}
            </div>
        </div>
    );
  };

  const courseListContent = (
    <div className="flex flex-row gap-3 h-[calc(55vh)]">
        <div className={`transition-all duration-300 ${selectedSectionForDetail ? 'w-2/3' : 'w-full'}`}>
            <div className="overflow-auto custom-scrollbar border rounded-lg h-full">
                <table className="min-w-full divide-y divide-gray-200 text-xs">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                        <th scope="col" className="px-2 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Program</th>
                        <th scope="col" className="px-2 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Course Code</th>
                        <th scope="col" className="px-2 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Course Title</th>
                        <th scope="col" className="px-2 py-2 text-center font-medium text-gray-500 uppercase tracking-wider">Cr.</th>
                        <th scope="col" className="px-2 py-2 text-center font-medium text-gray-500 uppercase tracking-wider">Section</th>
                        <th scope="col" className="px-2 py-2 text-center font-medium text-gray-500 uppercase tracking-wider" title="Students">Stu</th>
                        <th scope="col" className="px-2 py-2 text-center font-medium text-gray-500 uppercase tracking-wider" title="Classes In Week">CIW</th>
                        <th scope="col" className="px-2 py-2 text-center font-medium text-gray-500 uppercase tracking-wider" title="Class Requirement">CR</th>
                        <th scope="col" className="px-2 py-2 text-center font-medium text-gray-500 uppercase tracking-wider" title="Classes Taken">CAT</th>
                    </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                    {allCoursesForTeacherInSemester.map(section => {
                        const ciw = ciwCounts.get(section.sectionId) ?? 0;
                        const cr = classRequirementCounts.get(section.sectionId) ?? 0;
                        return (
                        <tr key={section.sectionId} 
                            onClick={() => handleSectionRowClick(section)}
                            className={`hover:bg-teal-50 cursor-pointer transition-colors ${selectedSectionForDetail?.sectionId === section.sectionId ? 'bg-teal-100' : ''}`}
                        >
                            <td className="px-2 py-1.5 whitespace-nowrap">{getProgramShortName(section.pId)}</td>
                            <td className="px-2 py-1.5 whitespace-nowrap font-semibold text-gray-800">{section.courseCode}</td>
                            <td className="px-2 py-1.5 whitespace-nowrap text-gray-600 truncate max-w-xs" title={section.courseTitle}>{section.courseTitle}</td>
                            <td className="px-2 py-1.5 text-center whitespace-nowrap">{section.credit}</td>
                            <td className="px-2 py-1.5 text-center whitespace-nowrap font-medium text-gray-700">{section.section}</td>
                            <td className="px-2 py-1.5 text-center whitespace-nowrap">{section.studentCount}</td>
                            <td className="px-2 py-1.5 text-center whitespace-nowrap font-semibold text-blue-600">{ciw}</td>
                            <td className="px-2 py-1.5 text-center whitespace-nowrap font-semibold text-purple-600">{cr}</td>
                            <td className="px-2 py-1.5 text-center whitespace-nowrap font-semibold text-green-600">{section.classTaken}</td>
                        </tr>
                        );
                    })}
                    </tbody>
                </table>
            </div>
        </div>
        <div className={`transition-all duration-300 ${selectedSectionForDetail ? 'w-1/3' : 'w-0 overflow-hidden'}`}>
            {selectedSectionForDetail ? (
                <SectionDetailPanel section={selectedSectionForDetail} />
            ) : (
                <div className="h-full flex items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 text-center text-sm text-gray-500 p-4">
                    <p>Select a section from the list to view its details and routine.</p>
                </div>
            )}
        </div>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      headerContent={modalHeaderContent}
      footerContent={footerContent}
      zIndex={70}
      maxWidthClass="max-w-screen-2xl"
    >
      <div className="flex flex-col h-full">
        <div className="flex-shrink-0 px-4 pt-2">
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-4" aria-label="Tabs">
                    <button
                        onClick={() => setActiveTab('routine')}
                        className={`whitespace-nowrap py-3 px-1 border-b-2 font-semibold text-sm transition-colors ${
                            activeTab === 'routine'
                            ? 'border-teal-500 text-teal-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                        aria-current={activeTab === 'routine' ? 'page' : undefined}
                    >
                        Class Routine
                    </button>
                    <button
                        onClick={() => setActiveTab('courses')}
                        className={`whitespace-nowrap py-3 px-1 border-b-2 font-semibold text-sm transition-colors ${
                            activeTab === 'courses'
                            ? 'border-teal-500 text-teal-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                        aria-current={activeTab === 'courses' ? 'page' : undefined}
                    >
                        Course Load ({allCoursesForTeacherInSemester.length})
                    </button>
                </nav>
            </div>
        </div>

        <div className="flex-grow p-4 min-h-0">
            {activeTab === 'routine' ? routineContent : courseListContent}
        </div>
      </div>
    </Modal>
  );
};

export default TeacherViewDetailModal;
