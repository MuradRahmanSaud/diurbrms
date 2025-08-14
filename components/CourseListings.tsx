import React, { useState, useCallback } from 'react';
import { EnrollmentEntry, CourseType } from '../types';
import CourseSectionEditor from './CourseSectionEditor';

interface CourseListingsProps {
  coursesToDisplay: EnrollmentEntry[];
  courseDataExists: boolean;
  onUpdateLevelTerm: (sectionId: string, newLevelTerm: string) => void;
  onUpdateWeeklyClass: (sectionId: string, newWeeklyClass: number | undefined) => void;
  onUpdateCourseType: (sectionId: string, newCourseType: CourseType) => void;
}

// Helper function to format "L1T1" string to "Level 1 - Term 1"
const formatLevelTerm = (levelTerm: string): string => {
  if (!levelTerm) return 'N/A';
  const match = levelTerm.match(/L(\d+)T(\d+)/i);
  if (match) {
    return `Level ${match[1]} - Term ${match[2]}`;
  }
  return levelTerm; // Return original if format is unexpected
};

// Memoized CourseItem component for performance optimization
const CourseItem = React.memo(({
  course,
  isEditing,
  onEditClick,
  onSave,
  onCancel,
}: {
  course: EnrollmentEntry;
  isEditing: boolean;
  onEditClick: (course: EnrollmentEntry) => void;
  onSave: (sectionId: string, stagedEdits: { levelTerm: string; weeklyClass: number | undefined; courseType: CourseType; }) => void;
  onCancel: () => void;
}) => {
  const formattedLevelTerm = formatLevelTerm(course.levelTerm);

  return (
    <div
      className={`p-1.5 rounded-md border transition-all duration-200 ${
        isEditing
          ? 'bg-teal-700 border-yellow-400'
          : 'bg-teal-800 border-teal-600 hover:bg-teal-700 hover:border-teal-500'
      }`}
    >
      <div className="flex justify-between items-start gap-2">
        <p
          className="text-yellow-300 font-semibold text-[11px] md:text-xs truncate"
          title={`${course.courseCode} (${course.section})`}
        >
          {course.courseCode} ({course.section})
        </p>

        <button
          onClick={() => onEditClick(course)}
          className="flex-shrink-0 bg-yellow-400 text-teal-800 px-2 py-0.5 rounded-full text-[8px] md:text-[9px] font-bold leading-none shadow-sm whitespace-nowrap hover:bg-yellow-300 focus:outline-none focus:ring-1 focus:ring-white"
          title={`Level - Term: ${formattedLevelTerm}. Click to edit.`}
          aria-expanded={isEditing}
          aria-controls={`editor-${course.sectionId}`}
        >
          {formattedLevelTerm}
        </button>
      </div>

      {isEditing ? (
        <div id={`editor-${course.sectionId}`}>
          <CourseSectionEditor
            course={course}
            onSave={onSave}
            onCancel={onCancel}
            theme="dark"
          />
        </div>
      ) : (
        <>
          <p className="text-teal-100 text-[11px] md:text-xs mt-0.5 truncate" title={course.courseTitle}>
            {course.courseTitle}
          </p>
          <p className="text-teal-300 text-[9px] md:text-[10px] mt-1">
            P-ID: {course.pId} | Cr. {course.credit} | Type: {course.courseType || 'N/A'} | Stu: {course.studentCount} | CT: {course.classTaken} | WC: {course.weeklyClass ?? ''}
          </p>
          <div className="text-[9px] md:text-[10px] mt-0.5">
            <p className="text-teal-200 truncate" title={`${course.teacherName}, ${course.designation}`}>
              {course.teacherName}, {course.designation}
            </p>
            <p className="text-teal-300 truncate" title={`ID: ${course.teacherId}`}>
              ID: {course.teacherId}
            </p>
          </div>
        </>
      )}
    </div>
  );
});

CourseItem.displayName = 'CourseItem';

const CourseListings: React.FC<CourseListingsProps> = React.memo(({ coursesToDisplay, courseDataExists, onUpdateLevelTerm, onUpdateWeeklyClass, onUpdateCourseType }) => {
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);

  const handleEditClick = useCallback((course: EnrollmentEntry) => {
    setEditingSectionId(prevId => prevId === course.sectionId ? null : course.sectionId);
  }, []);

  const handleSave = useCallback((sectionId: string, stagedEdits: { levelTerm: string; weeklyClass: number | undefined; courseType: CourseType; }) => {
    // Find the course from the currently displayed list, though relying on parent data is safer.
    const originalCourse = coursesToDisplay.find(c => c.sectionId === sectionId);
      if (originalCourse) {
          if (originalCourse.levelTerm !== stagedEdits.levelTerm) {
              onUpdateLevelTerm(sectionId, stagedEdits.levelTerm);
          }
          if ((originalCourse.weeklyClass ?? undefined) !== stagedEdits.weeklyClass) {
              onUpdateWeeklyClass(sectionId, stagedEdits.weeklyClass);
          }
          if ((originalCourse.courseType ?? 'N/A') !== stagedEdits.courseType) {
              onUpdateCourseType(sectionId, stagedEdits.courseType);
          }
      }
    setEditingSectionId(null);
  }, [coursesToDisplay, onUpdateLevelTerm, onUpdateWeeklyClass, onUpdateCourseType]);

  const handleCancel = useCallback(() => {
    setEditingSectionId(null);
  }, []);

  return (
    <div className="space-y-1.5" role="region" aria-live="polite">
      {coursesToDisplay.length > 0 ? (
        coursesToDisplay.map((course) => (
          <CourseItem
            key={course.sectionId}
            course={course}
            isEditing={editingSectionId === course.sectionId}
            onEditClick={handleEditClick}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        ))
      ) : (
        <div className="text-center py-6">
          <p className="text-teal-300 text-sm">
            {!courseDataExists ? "No courses loaded. Import an Excel file." : "No courses match your criteria."}
          </p>
        </div>
      )}
    </div>
  );
});

CourseListings.displayName = 'CourseListings';

export default CourseListings;