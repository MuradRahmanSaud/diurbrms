import React, { useState, useMemo, useEffect } from 'react';
import { EnrollmentEntry, CourseType } from '../types';

const COURSE_TYPES: CourseType[] = ['Theory', 'Lab', 'Thesis', 'Project', 'Internship', 'Viva', 'Others', 'N/A'];

interface CourseSectionEditorProps {
  course: EnrollmentEntry;
  onSave: (sectionId: string, stagedEdits: { levelTerm: string; weeklyClass: number | undefined; courseType: CourseType; }) => void;
  onCancel: () => void;
  theme?: 'light' | 'dark';
  mode?: 'levelTerm' | 'weekly' | null;
}

const CourseSectionEditor: React.FC<CourseSectionEditorProps> = ({
  course,
  onSave,
  onCancel,
  theme = 'dark',
  mode,
}) => {
  const [stagedEdits, setStagedEdits] = useState({
    levelTerm: course.levelTerm,
    weeklyClass: course.weeklyClass?.toString() ?? '',
    courseType: course.courseType ?? 'N/A',
  });

  // Sync state with props when the selected course changes
  useEffect(() => {
    setStagedEdits({
      levelTerm: course.levelTerm,
      weeklyClass: course.weeklyClass?.toString() ?? '',
      courseType: course.courseType ?? 'N/A',
    });
  }, [course]);

  const hasUnsavedChanges = useMemo(() => {
    const originalWeeklyClass = course.weeklyClass?.toString() ?? '';
    const originalCourseType = course.courseType ?? 'N/A';
    return (
        stagedEdits.levelTerm !== course.levelTerm ||
        stagedEdits.weeklyClass !== originalWeeklyClass ||
        stagedEdits.courseType !== originalCourseType
    );
  }, [stagedEdits, course]);

  const handleSaveClick = () => {
    if (!hasUnsavedChanges) return;
    onSave(course.sectionId, {
      levelTerm: stagedEdits.levelTerm,
      weeklyClass: stagedEdits.weeklyClass === '' ? undefined : Number(stagedEdits.weeklyClass),
      courseType: stagedEdits.courseType,
    });
  };

  const isLight = theme === 'light';

  const styles = {
    container: isLight ? 'bg-white p-3' : 'mt-2',
    label: isLight ? 'block text-xs font-semibold text-gray-600 mb-1' : 'block text-[10px] font-semibold text-teal-200 mb-1',
    select: isLight ? 'w-full p-1.5 rounded-md text-xs bg-gray-50 border border-gray-300 text-gray-800 focus:outline-none focus:ring-1 focus:ring-teal-500 h-8' : 'w-full p-1 rounded-md text-xs bg-teal-900/50 border border-teal-700 text-teal-100 focus:outline-none focus:ring-1 focus:ring-yellow-400 h-8',
    input: isLight ? 'w-12 h-8 text-center bg-gray-50 border border-gray-300 text-gray-800 rounded-md text-xs' : 'w-10 h-6 text-center bg-teal-900/50 border border-teal-700 text-teal-100 rounded-md text-xs',
    button: isLight ? 'p-1.5 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-700 transition-colors h-8 w-8 flex items-center justify-center font-bold' : 'p-1 rounded-full bg-teal-600 hover:bg-teal-500 text-white transition-colors h-6 w-6 flex items-center justify-center font-bold',
    ltButton: isLight ? 'p-1.5 text-xs font-bold rounded-md transition-colors' : 'p-1 text-[10px] font-bold rounded-md transition-colors',
    ltButtonSelected: isLight ? 'bg-teal-600 text-white cursor-default' : 'bg-yellow-400 text-teal-800 cursor-default',
    ltButtonNormal: isLight ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' : 'bg-teal-600 text-teal-100 hover:bg-teal-500 hover:text-white',
    sectionTitle: isLight ? 'text-sm font-semibold text-gray-700 mb-2' : 'text-center text-xs text-teal-200',
    divider: isLight ? 'border-gray-200' : 'border-teal-600/50',
    saveButton: isLight ? 'px-3 py-1.5 text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-md disabled:bg-gray-400' : 'px-3 py-1.5 text-xs font-semibold text-teal-900 bg-yellow-400 hover:bg-yellow-300 rounded-md shadow disabled:bg-teal-700 disabled:text-teal-400 disabled:cursor-not-allowed',
    cancelButton: isLight ? 'px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-md border border-gray-300' : 'px-3 py-1.5 text-xs font-medium text-teal-100 bg-teal-700 hover:bg-teal-600 rounded-md',
  };

  return (
    <div className={styles.container}>
       <div className="space-y-3">
        {/* Top Section: Grid for Level Term and Course Info */}
        <div className={`grid ${mode ? 'grid-cols-1' : 'grid-cols-2'} gap-4`}>
          
          {/* Left Column: Level Term */}
          {(!mode || mode === 'levelTerm') && (
            <div>
              <label className={styles.label}>Level Term</label>
              <div className="grid grid-cols-3 gap-1.5 mt-1">
                {Array.from({ length: 4 }, (_, i) => i + 1).map(level =>
                  Array.from({ length: 3 }, (_, j) => j + 1).map(term => {
                    const levelTermValue = `L${level}T${term}`;
                    const isCurrentInStaging = stagedEdits.levelTerm === levelTermValue;
                    return (
                      <button
                        key={levelTermValue}
                        onClick={() => setStagedEdits(prev => ({...prev, levelTerm: levelTermValue}))}
                        className={`${styles.ltButton} ${isCurrentInStaging ? styles.ltButtonSelected : styles.ltButtonNormal}`}
                        disabled={isCurrentInStaging}
                      >
                        {`L${level}-T${term}`}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Right Column: Course Type & Weekly Classes */}
          {(!mode || mode === 'weekly') && (
            <div className="flex flex-col space-y-3">
                <div>
                  <label htmlFor={`course-type-select-${course.sectionId}-${theme}`} className={styles.label}>
                    Course Type
                  </label>
                  <select
                    id={`course-type-select-${course.sectionId}-${theme}`}
                    value={stagedEdits.courseType}
                    onChange={(e) => setStagedEdits(prev => ({ ...prev, courseType: e.target.value as CourseType }))}
                    className={styles.select}
                  >
                    {COURSE_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                <div>
                    <label htmlFor={`weekly-class-input-${course.sectionId}-${theme}`} className={`${styles.label} text-center`}>
                    Weekly Classes
                    </label>
                    <div className="flex items-center justify-center gap-1 mt-1">
                    <button
                        onClick={() => setStagedEdits(prev => ({ ...prev, weeklyClass: String(Math.max(0, Number(prev.weeklyClass || 0) - 1)) }))}
                        className={styles.button}
                        aria-label="Decrement weekly classes"
                    >-</button>
                    <input
                        type="number"
                        id={`weekly-class-input-${course.sectionId}-${theme}`}
                        value={stagedEdits.weeklyClass}
                        onChange={(e) => setStagedEdits(prev => ({ ...prev, weeklyClass: e.target.value.replace(/[^0-9]/g, '') }))}
                        className={`${styles.input} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                    />
                    <button
                        onClick={() => setStagedEdits(prev => ({ ...prev, weeklyClass: String(Number(prev.weeklyClass || 0) + 1) }))}
                        className={styles.button}
                        aria-label="Increment weekly classes"
                    >+</button>
                    </div>
                </div>
            </div>
          )}
        </div>
        
        {/* Bottom: Buttons */}
        <div className={`pt-3 border-t ${styles.divider} flex items-center justify-end gap-2`}>
            <button onClick={onCancel} className={styles.cancelButton}>
                Cancel
            </button>
            <button
                onClick={handleSaveClick}
                disabled={!hasUnsavedChanges}
                className={styles.saveButton}
            >
                Save
            </button>
        </div>
      </div>
    </div>
  );
};

export default CourseSectionEditor;
