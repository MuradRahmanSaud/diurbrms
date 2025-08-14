import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DayOfWeek, FullRoutineData, DefaultTimeSlot, ProgramEntry, EnrollmentEntry, TimeSlot, RoomTypeEntry, RoomEntry, User } from '../types';
import { DAYS_OF_WEEK } from '../data/routineConstants';
import { sortSlotsByTypeThenTime } from '../data/slotConstants';
import { formatDefaultSlotToString, formatTimeToAMPM } from '../App';

interface GeneratePdfOptions {
    teacherId: string | null;
    semesterId: string | null;
    coursesData: EnrollmentEntry[];
    routineData: { [semesterId: string]: FullRoutineData };
    allPrograms: ProgramEntry[];
    systemDefaultTimeSlots: DefaultTimeSlot[];
    allUsers?: User[];
}

export const generateTeacherRoutinePDF = ({
    teacherId,
    semesterId,
    coursesData,
    routineData,
    allPrograms,
    systemDefaultTimeSlots,
    allUsers = [],
}: GeneratePdfOptions): void => {
    if (!teacherId || !semesterId) {
        alert("Please select a teacher and a semester.");
        return;
    }

    const teacherCourses = coursesData.filter(c => c.teacherId === teacherId && c.semester === semesterId);
    if (teacherCourses.length === 0) {
        alert("This teacher has no courses assigned in the selected semester.");
        return;
    }

    const teacherInfo = teacherCourses[0];
    const { teacherName, designation, teacherMobile, teacherEmail } = teacherInfo;
    const teacherUser = allUsers.find(u => u.employeeId === teacherId);
    const dayOffs = teacherUser?.dayOffs;
    
    const routineForSemester = routineData[semesterId] || {};
    const teacherSchedule = new Map<DayOfWeek, Map<string, { classInfo: any; room: string }>>();
    
    const relevantProgramPIds = new Set(teacherCourses.map(c => c.pId));
    const relevantPrograms = allPrograms.filter(p => relevantProgramPIds.has(p.pId));
    
    const timeSlotMap = new Map<string, DefaultTimeSlot>();
    systemDefaultTimeSlots.forEach(slot => timeSlotMap.set(formatDefaultSlotToString(slot), slot));
    relevantPrograms.forEach(p => {
      (p.programSpecificSlots || []).forEach(slot => timeSlotMap.set(formatDefaultSlotToString(slot), slot));
    });
    const timeSlots = Array.from(timeSlotMap.values()).sort(sortSlotsByTypeThenTime);
    const theorySlots = timeSlots.filter(s => s.type === 'Theory');
    const labSlots = timeSlots.filter(s => s.type === 'Lab');

    DAYS_OF_WEEK.forEach(day => {
      const daySchedule = new Map<string, { classInfo: any; room: string }>();
      const dayData = routineForSemester[day];
      if (dayData) {
        Object.entries(dayData).forEach(([room, slots]) => {
          Object.entries(slots).forEach(([slotString, classInfo]) => {
            if (classInfo && classInfo.teacher === teacherName) {
              daySchedule.set(slotString, { classInfo, room });
            }
          });
        });
      }
      teacherSchedule.set(day, daySchedule);
    });

    const hasClasses = Array.from(teacherSchedule.values()).some(dayMap => dayMap.size > 0);
    if (!hasClasses) {
        alert("No classes found in the routine for this teacher in the selected semester.");
        return;
    }

    const doc = new jsPDF({ orientation: 'landscape' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageMargin = 14;

    // Centered Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text("Daffodil International University", pageWidth / 2, 12, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Class Routine (${semesterId})`, pageWidth / 2, 19, { align: 'center' });
    
    // Teacher Info block in the header
    let currentY = 19;
    currentY += 8; // space
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(teacherName, pageWidth / 2, currentY, { align: 'center' });
    currentY += 5;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(designation, pageWidth / 2, currentY, { align: 'center' });
    currentY += 4;
    doc.text(`Mob: ${teacherMobile} | Email: ${teacherEmail}`, pageWidth / 2, currentY, { align: 'center' });

    const tableStartY = currentY + 7;

    const formatSlotHeader = (slot: DefaultTimeSlot) => formatDefaultSlotToString(slot).replace(' - ', '\n');
    
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
        const daySchedule = teacherSchedule.get(day) || new Map();
        [...theorySlots, ...labSlots].forEach(slot => {
            const slotString = formatDefaultSlotToString(slot);
            const entry = daySchedule.get(slotString);
            row.push(entry ? `${entry.classInfo.courseCode} (${entry.classInfo.section})\n${entry.room}` : '-');
        });
        return row;
    });

    autoTable(doc, {
        head: head,
        body: body,
        startY: tableStartY,
        theme: 'grid',
        didDrawPage: (data) => {
            // Footer
            const pageCount = (doc as any).internal.getNumberOfPages();
            let footerY = doc.internal.pageSize.getHeight() - 25;
            
            // Page number on bottom-right
            doc.setFontSize(8);
            doc.text(`Page ${data.pageNumber} of ${pageCount}`, pageWidth - pageMargin, doc.internal.pageSize.height - 10, { align: 'right' });
            
            // Signature Line
            doc.setLineWidth(0.2);
            doc.line(pageMargin, footerY, pageMargin + 50, footerY);

            // Teacher info on bottom-left
            footerY += 4;
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text(teacherName, pageMargin, footerY);
            footerY += 4.5;
            doc.setFont('helvetica', 'normal');
            doc.text(designation, pageMargin, footerY);
            footerY += 4.5;
            doc.text(`Mob: ${teacherMobile} | Email: ${teacherEmail}`, pageMargin, footerY);

            if (dayOffs && dayOffs.length > 0) {
                footerY += 4.5;
                doc.setFont('helvetica', 'bold');
                doc.text('Note:', pageMargin, footerY);
                doc.setFont('helvetica', 'normal');
                doc.text(`Designated day(s) off are ${dayOffs.join(', ')}.`, pageMargin + 10, footerY);
            }
        },
        styles: { 
            fontSize: 9, cellPadding: 0.8, halign: 'center', valign: 'middle',
            font: 'helvetica', lineColor: [0, 0, 0], lineWidth: 0.2,
        },
        headStyles: { 
            fontSize: 9, fillColor: '#dbdbdb', textColor: [0, 0, 0], fontStyle: 'bold' 
        },
        columnStyles: { 
            0: { fontStyle: 'bold', cellWidth: 25, fontSize: 9, fillColor: '#dbdbdb', textColor: [0, 0, 0] } 
        },
    });
    
    const pdfDataUri = doc.output('datauristring');
    const newWindow = window.open();
    if (newWindow) {
        newWindow.document.write(`<html style="height:100%;"><body style="margin:0;height:100%;"><iframe width='100%' height='100%' src='${pdfDataUri}' title='PDF Preview'></iframe></body></html>`);
        newWindow.document.title = `${teacherName}_Routine_${semesterId}.pdf`;
    } else {
        alert("Please allow pop-ups for this website to preview the PDF.");
    }
};

interface GenerateCourseLoadPdfOptions {
    teacher: User;
    courses: EnrollmentEntry[];
    semesterId: string;
    ciwCounts: Map<string, number>;
    crCounts: Map<string, number>;
    getProgramShortName: (pId?: string) => string;
}

type DisplayCourse = EnrollmentEntry & { mergedCourses: DisplayCourse[] };

export const generateCourseLoadPDF = ({
    teacher,
    courses,
    semesterId,
    ciwCounts,
    crCounts,
    getProgramShortName
}: GenerateCourseLoadPdfOptions): void => {
    const doc = new jsPDF({ orientation: 'portrait' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageMargin = 14;

    const brandColor = '#00796B';
    const lightGray = '#F5F5F5';
    const darkGray = '#333333';
    
    let currentY = 12;

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(brandColor);
    doc.text("Daffodil International University", pageWidth / 2, currentY, { align: 'center' });
    currentY += 8;

    doc.setFontSize(12);
    doc.setTextColor(darkGray);
    doc.setFont('helvetica', 'bold');
    doc.text("Course Distribution Load Approval", pageWidth / 2, currentY, { align: 'center' });
    currentY += 10;
    
    const boxWidth = pageWidth - pageMargin * 2;
    const halfBoxWidth = boxWidth / 2;
    doc.setFontSize(9);
    doc.setTextColor(darkGray);
    
    doc.setDrawColor(224, 224, 224);
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(pageMargin, currentY, boxWidth, 20, 3, 3, 'FD');
    
    doc.setFont('helvetica', 'bold');
    doc.text("Teacher Information", pageMargin + 3, currentY + 5);
    doc.setFont('helvetica', 'normal');
    doc.text(`Name: ${teacher.name}`, pageMargin + 3, currentY + 10);
    doc.text(`Designation: ${teacher.designation || 'N/A'}`, pageMargin + 3, currentY + 14);
    doc.text(`Employee ID: ${teacher.employeeId || 'N/A'}`, pageMargin + 3, currentY + 18);

    doc.setDrawColor(200, 200, 200);
    doc.line(pageMargin + halfBoxWidth, currentY + 2, pageMargin + halfBoxWidth, currentY + 18);

    const generationDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
    });
    doc.setFont('helvetica', 'bold');
    doc.text("Semester Information", pageMargin + halfBoxWidth + 3, currentY + 5);
    doc.setFont('helvetica', 'normal');
    doc.text(`Semester: ${semesterId}`, pageMargin + halfBoxWidth + 3, currentY + 10);
    doc.text(`Generated On: ${generationDate}`, pageMargin + halfBoxWidth + 3, currentY + 14);

    const tableStartY = currentY + 28;

    // --- Table with Merge Logic ---
    const courseMap = new Map<string, DisplayCourse>();
    courses.forEach(c => courseMap.set(c.sectionId, { ...c, mergedCourses: [] }));
    const rootCourses: DisplayCourse[] = [];
    courseMap.forEach(course => {
        if (course.mergedWithSectionId) {
            const parent = courseMap.get(course.mergedWithSectionId);
            if (parent) parent.mergedCourses.push(course);
            else rootCourses.push(course); // Fallback for orphaned children
        } else {
            rootCourses.push(course);
        }
    });
    rootCourses.sort((a,b) => a.courseCode.localeCompare(b.courseCode) || a.section.localeCompare(b.section));
    rootCourses.forEach(c => c.mergedCourses.sort((a,b) => a.courseCode.localeCompare(b.courseCode) || a.section.localeCompare(b.section)));

    const body: any[][] = [];

    const getTreeStats = (course: DisplayCourse): { students: number, ciw: number, cr: number, cat: number } => {
        const directStats = {
            students: course.studentCount,
            ciw: ciwCounts.get(course.sectionId) ?? 0,
            cr: crCounts.get(course.sectionId) ?? 0,
            cat: course.classTaken,
        };
        if (!course.mergedCourses || course.mergedCourses.length === 0) return directStats;
        return course.mergedCourses.reduce((acc, child) => {
            const childStats = getTreeStats(child);
            acc.students += childStats.students;
            acc.ciw += childStats.ciw;
            acc.cr += childStats.cr;
            acc.cat += childStats.cat;
            return acc;
        }, directStats);
    };

    const processCourseForPdf = (course: DisplayCourse, level: number) => {
        const rowStats = getTreeStats(course);
        const prefix = '  '.repeat(level);
        const arrow = level > 0 ? '↳ ' : '';

        body.push([
            getProgramShortName(course.pId),
            { content: `${prefix}${arrow}${course.courseCode}\n${prefix}${course.courseTitle}`, styles: { halign: 'left' } },
            level > 0 ? { content: 'Merge', styles: { fontStyle: 'italic', textColor: '#555' } } : course.credit.toFixed(2),
            course.section,
            rowStats.students.toString(),
            rowStats.ciw.toString(),
            rowStats.cr.toString(),
            rowStats.cat.toString(),
        ]);

        course.mergedCourses.forEach(child => processCourseForPdf(child, level + 1));
    };

    rootCourses.forEach(course => processCourseForPdf(course, 0));

    const totals = rootCourses.reduce((acc, course) => {
        acc.credits += course.credit;
        const treeStats = getTreeStats(course);
        acc.students += treeStats.students;
        acc.ciw += treeStats.ciw;
        acc.cr += treeStats.cr;
        acc.cat += treeStats.cat;
        return acc;
    }, { credits: 0, students: 0, ciw: 0, cr: 0, cat: 0 });

    body.push([
        { content: 'Total', colSpan: 2, styles: { halign: 'right', fontStyle: 'bold' } },
        { content: totals.credits.toFixed(2), styles: { fontStyle: 'bold' } },
        '', // Empty section
        { content: totals.students.toString(), styles: { fontStyle: 'bold' } },
        { content: totals.ciw.toString(), styles: { fontStyle: 'bold' } },
        { content: totals.cr.toString(), styles: { fontStyle: 'bold' } },
        { content: totals.cat.toString(), styles: { fontStyle: 'bold' } },
    ]);

    autoTable(doc, {
        head: [['Program', 'Course (Code & Title)', 'Credit', 'Section', 'Stu', 'CIW', 'CR', 'CAT']],
        body: body,
        startY: tableStartY,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 1.5, valign: 'middle' },
        headStyles: { fillColor: brandColor, textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: 9 },
        alternateRowStyles: { fillColor: lightGray },
        columnStyles: {
            0: { halign: 'center', fontStyle: 'bold' },
            1: { cellWidth: 70 },
            2: { halign: 'center' }, 3: { halign: 'center' },
            4: { halign: 'center' }, 5: { halign: 'center', fontStyle: 'bold' },
            6: { halign: 'center', fontStyle: 'bold' }, 7: { halign: 'center', fontStyle: 'bold' },
        },
        didDrawPage: (data) => {
            const pageHeight = doc.internal.pageSize.getHeight();
            const pageCount = (doc as any).internal.getNumberOfPages();
            doc.setLineWidth(0.2);
            let footerY = pageHeight - 25;
            doc.line(pageMargin, footerY, pageMargin + 60, footerY);
            doc.line(pageWidth - pageMargin - 60, footerY, pageWidth - pageMargin, footerY);
            footerY += 4;
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.text("Course Distribution Committee", pageMargin, footerY);
            doc.text("Head/Associate Head", pageWidth - pageMargin, footerY, { align: 'right' });
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`Page ${data.pageNumber} of ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
        }
    });

    const pdfDataUri = doc.output('datauristring');
    const newWindow = window.open();
    if (newWindow) {
        newWindow.document.write(`<html style="height:100%;"><body style="margin:0;height:100%;"><iframe width='100%' height='100%' src='${pdfDataUri}' title='PDF Preview'></iframe></body></html>`);
        newWindow.document.title = `${teacher.name}_CourseLoad_${semesterId}.pdf`;
    } else {
        alert("Please allow pop-ups for this website to preview the PDF.");
    }
};


interface GenerateLevelTermPdfOptions {
    levelTerm: string;
    section: string | null;
    semesterId: string;
    programId: string | null;
    routineData: { [semesterId: string]: FullRoutineData };
    allPrograms: ProgramEntry[];
    systemDefaultTimeSlots: DefaultTimeSlot[];
    coursesData: EnrollmentEntry[];
}

export const generateLevelTermRoutinePDF = ({
    levelTerm,
    section,
    semesterId,
    programId,
    routineData,
    allPrograms,
    systemDefaultTimeSlots,
    coursesData,
}: GenerateLevelTermPdfOptions): void => {
    const program = programId ? allPrograms.find(p => p.id === programId) : null;
    const programPId = program ? program.pId : null;
    const routineForSemester = routineData[semesterId] || {};

    const doc = new jsPDF({ orientation: 'landscape' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageMargin = 14;
    const tableStartY = 38;

    const addDefaultHeader = () => {
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text("Daffodil International University", pageWidth / 2, 15, { align: 'center' });
        doc.setFontSize(12);
        let title = `Class Routine for Level-Term: ${levelTerm}`;
        if (section) title += `, Section: ${section}`;
        doc.text(title, pageWidth / 2, 22, { align: 'center' });
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        let subheader = `Semester: ${semesterId}`;
        if (program) subheader += ` | Program: ${program.shortName}`;
        doc.text(subheader, pageWidth / 2, 28, { align: 'center' });
    };
    
    const addTeacherListHeader = () => {
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text("Daffodil International University", pageWidth / 2, 15, { align: 'center' });
        doc.setFontSize(12);
        let title = `Level-Term: ${levelTerm}${section ? `, Section: ${section}` : ''} - Teacher List`;
        doc.text(title, pageWidth / 2, 22, { align: 'center' });
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        let subheader = `Semester: ${semesterId}`;
        if (program) subheader += ` | Program: ${program.shortName}`;
        doc.text(subheader, pageWidth / 2, 28, { align: 'center' });
    };

    const headerSlots = (program?.programSpecificSlots?.length 
        ? program.programSpecificSlots 
        : systemDefaultTimeSlots
    ).sort(sortSlotsByTypeThenTime);
    
    const theorySlots = headerSlots.filter(s => s.type === 'Theory');
    const labSlots = headerSlots.filter(s => s.type === 'Lab');

    const formatSlotHeader = (slot: DefaultTimeSlot) => formatDefaultSlotToString(slot).replace(' - ', '\n');
    
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

    const scheduledCourses = new Map<string, EnrollmentEntry>();

    const body = DAYS_OF_WEEK.map(day => {
        const rowData: string[] = [day];
        
        const processSlots = (slotsToProcess: DefaultTimeSlot[]) => {
            slotsToProcess.forEach(slot => {
                const slotString = formatDefaultSlotToString(slot);
                const classesInSlot: string[] = [];
                
                const dayData = routineForSemester[day];
                if (dayData) {
                    for (const room in dayData) {
                        const classInfo = dayData[room][slotString as TimeSlot];
                        const sectionMatch = !section || classInfo?.section === section;
                        if (classInfo && classInfo.levelTerm === levelTerm && sectionMatch) {
                            if (!programPId || classInfo.pId === programPId) {
                                const enrollmentEntry = coursesData.find(c => 
                                    c.semester === semesterId &&
                                    c.pId === classInfo.pId &&
                                    c.courseCode === classInfo.courseCode &&
                                    c.section === classInfo.section
                                );
                                
                                if (enrollmentEntry && !scheduledCourses.has(enrollmentEntry.sectionId)) {
                                    scheduledCourses.set(enrollmentEntry.sectionId, enrollmentEntry);
                                }
                                classesInSlot.push(`${classInfo.courseCode} (${classInfo.section})\nRoom: ${room}`);
                            }
                        }
                    }
                }
                rowData.push(classesInSlot.join('\n\n') || '-');
            });
        }
        processSlots(theorySlots);
        processSlots(labSlots);
        return rowData;
    });
    
    autoTable(doc, {
        head,
        body,
        margin: { top: tableStartY }, 
        theme: 'grid',
        styles: { 
            fontSize: 9, cellPadding: 0.8, halign: 'center', valign: 'middle',
            font: 'helvetica', lineColor: [0, 0, 0], lineWidth: 0.2,
        },
        headStyles: { 
            fontSize: 9, fillColor: '#dbdbdb', textColor: [0, 0, 0], fontStyle: 'bold' 
        },
        columnStyles: { 
            0: { fontStyle: 'bold', cellWidth: 25, fontSize: 9, fillColor: '#dbdbdb', textColor: [0, 0, 0] } 
        },
    });
    
    const totalPagesBeforeTeacherTable = (doc as any).internal.getNumberOfPages();

    if (scheduledCourses.size > 0) {
        const teacherDataAggregated = new Map<string, {
            teacherName: string;
            designation: string;
            teacherMobile: string;
            teacherEmail: string;
            courses: { courseCode: string, section: string }[];
        }>();

        for (const sectionEntry of scheduledCourses.values()) {
            if (!teacherDataAggregated.has(sectionEntry.teacherId)) {
                teacherDataAggregated.set(sectionEntry.teacherId, {
                    teacherName: sectionEntry.teacherName,
                    designation: sectionEntry.designation,
                    teacherMobile: sectionEntry.teacherMobile,
                    teacherEmail: sectionEntry.teacherEmail,
                    courses: [],
                });
            }
            teacherDataAggregated.get(sectionEntry.teacherId)!.courses.push({
                courseCode: sectionEntry.courseCode,
                section: sectionEntry.section,
            });
        }
        
        const teacherInfoBody = Array.from(teacherDataAggregated.values())
            .sort((a, b) => a.teacherName.localeCompare(b.teacherName))
            .map(teacher => [
                teacher.teacherName,
                teacher.designation,
                teacher.teacherMobile,
                teacher.teacherEmail,
                teacher.courses.map(c => `${c.courseCode} (${c.section})`).join(', '),
            ]);

        doc.addPage();
        
        autoTable(doc, {
            head: [['Teacher Name', 'Designation', 'Mobile', 'Email', 'Course (Section)']],
            body: teacherInfoBody,
            margin: { top: tableStartY },
            theme: 'striped',
        });
    }

    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        if (i <= totalPagesBeforeTeacherTable) {
           addDefaultHeader();
        } else {
           addTeacherListHeader();
        }
        doc.setFontSize(8);
        doc.text(`Page ${i} of ${totalPages}`, pageWidth - pageMargin, pageHeight - 10, { align: 'right' });
    }
    
    const pdfDataUri = doc.output('datauristring');
    const newWindow = window.open();
    if (newWindow) {
        newWindow.document.write(`<html style="height:100%;"><body style="margin:0;height:100%;"><iframe width='100%' height='100%' src='${pdfDataUri}' title='PDF Preview'></iframe></body></html>`);
        newWindow.document.title = `Routine_${levelTerm}_${semesterId}.pdf`;
    } else {
        alert("Please allow pop-ups for this website to preview the PDF.");
    }
};

interface GenerateFullRoutinePdfOptions {
    programId: string;
    semesterId: string;
    routineData: FullRoutineData;
    allPrograms: ProgramEntry[];
    allRooms: RoomEntry[];
    allRoomTypes: RoomTypeEntry[];
    systemDefaultTimeSlots: DefaultTimeSlot[];
    getBuildingName: (buildingId: string) => string;
}

export const generateFullRoutinePDF = ({
    programId,
    semesterId,
    routineData,
    allPrograms,
    allRooms,
    allRoomTypes,
    systemDefaultTimeSlots,
    getBuildingName,
}: GenerateFullRoutinePdfOptions): void => { /* Placeholder implementation */ };

interface GenerateCourseSectionPdfOptions {
    sectionIds: string[];
    semesterId: string;
    programId: string | null;
    routineData: { [semesterId: string]: FullRoutineData };
    coursesData: EnrollmentEntry[];
    allPrograms: ProgramEntry[];
    systemDefaultTimeSlots: DefaultTimeSlot[];
}
export const generateCourseSectionRoutinePDF = ({
    sectionIds,
    semesterId,
    programId,
    routineData,
    coursesData,
    allPrograms,
    systemDefaultTimeSlots,
}: GenerateCourseSectionPdfOptions): void => {
    if (!sectionIds || sectionIds.length === 0) {
        alert("No sections selected for routine preview.");
        return;
    }
    if (!semesterId) {
        alert("Semester not selected.");
        return;
    }

    const selectedSectionsData = coursesData.filter(c => sectionIds.includes(c.sectionId) && c.semester === semesterId);
    if (selectedSectionsData.length === 0) {
        alert("Could not find data for the selected sections in the current semester.");
        return;
    }

    const programPIdsInSelection = new Set(selectedSectionsData.map(s => s.pId));
    const program = programId ? allPrograms.find(p => p.id === programId) : (programPIdsInSelection.size === 1 ? allPrograms.find(p => p.pId === Array.from(programPIdsInSelection)[0]) : null);
    
    const routineForSemester = routineData[semesterId] || {};

    const doc = new jsPDF({ orientation: 'landscape' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageMargin = 14;
    const tableStartY = 38;

    const addHeaderAndFooter = (data: any) => {
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text("Daffodil International University", pageWidth / 2, 15, { align: 'center' });
        doc.setFontSize(12);
        doc.text(`Class Routine for Selected Sections`, pageWidth / 2, 22, { align: 'center' });
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        let subheader = `Semester: ${semesterId}`;
        if (program) subheader += ` | Program: ${program.shortName}`;
        doc.text(subheader, pageWidth / 2, 28, { align: 'center' });
    };
    
    const timeSlotMap = new Map<string, DefaultTimeSlot>();
    systemDefaultTimeSlots.forEach(slot => timeSlotMap.set(formatDefaultSlotToString(slot), slot));
    const relevantPrograms = allPrograms.filter(p => programPIdsInSelection.has(p.pId));
    relevantPrograms.forEach(p => {
      (p.programSpecificSlots || []).forEach(slot => timeSlotMap.set(formatDefaultSlotToString(slot), slot));
    });
    const headerSlots = Array.from(timeSlotMap.values()).sort(sortSlotsByTypeThenTime);
    const theorySlots = headerSlots.filter(s => s.type === 'Theory');
    const labSlots = headerSlots.filter(s => s.type === 'Lab');
    
    const formatSlotHeader = (slot: DefaultTimeSlot) => formatDefaultSlotToString(slot).replace(' - ', '\n');
    
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
        const rowData: string[] = [day];
        const processSlots = (slotsToProcess: DefaultTimeSlot[]) => {
            slotsToProcess.forEach(slot => {
                const slotString = formatDefaultSlotToString(slot);
                const classesInSlot: string[] = [];
                const dayData = routineForSemester[day];
                if (dayData) {
                    for (const room in dayData) {
                        const classInfo = dayData[room][slotString as TimeSlot];
                        const isSelectedSection = classInfo ? selectedSectionsData.some(s => s.courseCode === classInfo.courseCode && s.section === classInfo.section && s.pId === classInfo.pId) : false;
                        if (isSelectedSection) classesInSlot.push(`${classInfo.courseCode} (${classInfo.section})\nRoom: ${room}`);
                    }
                }
                rowData.push(classesInSlot.join('\n\n') || '-');
            });
        }
        processSlots(theorySlots);
        processSlots(labSlots);
        return rowData;
    });

    autoTable(doc, {
        head, body, margin: { top: tableStartY }, theme: 'grid',
        styles: { fontSize: 9, cellPadding: 0.8, halign: 'center', valign: 'middle', font: 'helvetica', lineColor: [0, 0, 0], lineWidth: 0.2 },
        headStyles: { fontSize: 9, fillColor: '#dbdbdb', textColor: [0, 0, 0], fontStyle: 'bold' },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 25, fontSize: 9, fillColor: '#dbdbdb', textColor: [0, 0, 0] } },
    });
    
    const finalY = (doc as any).lastAutoTable.finalY;

    const teacherInfoBody = selectedSectionsData.map(s => [
        s.teacherName,
        s.designation,
        s.teacherMobile,
        s.teacherEmail,
        `${s.courseCode} (${s.section})`
    ]);

    autoTable(doc, {
        head: [['Teacher Name', 'Designation', 'Mobile', 'Email', 'Course (Section)']],
        body: teacherInfoBody,
        startY: finalY + 8,
        theme: 'striped',
        styles: {
            fontSize: 7,
            cellPadding: 0.5,
        },
        headStyles: {
            fillColor: '#efefef',
            textColor: '#333',
            fontSize: 8,
        },
    });
    
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        addHeaderAndFooter({ pageNumber: i, settings: { margin: { left: pageMargin } } });
        doc.setFontSize(8);
        doc.text(`Page ${i} of ${totalPages}`, pageWidth - pageMargin, pageHeight - 10, { align: 'right' });
    }
    
    const pdfDataUri = doc.output('datauristring');
    const newWindow = window.open();
    if (newWindow) {
        newWindow.document.write(`<html style="height:100%;"><body style="margin:0;height:100%;"><iframe width='100%' height='100%' src='${pdfDataUri}' title='PDF Preview'></iframe></body></html>`);
        newWindow.document.title = `Routine_Sections_${semesterId}.pdf`;
    } else {
        alert("Please allow pop-ups for this website to preview the PDF.");
    }
};