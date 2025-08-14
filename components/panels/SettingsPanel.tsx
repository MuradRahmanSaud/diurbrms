import React, { useState, useMemo } from 'react';
import BasePanel from './BasePanel';
import DefaultTimeSlotManager from './DefaultTimeSlot';
import ProgramFacultySetup from './ProgramSetup';
import SemesterSetupPanel from './SemesterSetupPanel'; // New import
import BuildingCampusSetup from './BuildingCampusSetup';
import { SemesterCloneInfo, FullRoutineData, EnrollmentEntry, CourseType, BuildingEntry, ProgramEntry, SemesterRoutineData, DashboardAccess } from '../../types';
import { useBuildings } from '../../contexts/BuildingContext';
import { useTheme, ThemeColors } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';

type ActiveSettingsSection = 'program' | 'slots' | 'buildings' | 'semester' | 'theme' | null;

interface SettingsPanelProps {
  onClose: () => void;
  onShowBuildingRooms?: (buildingId: string | null) => void;
  onShowProgramDetailView?: (programId: string) => void;
  onShowSectionList?: () => void;
  onShowSectionListWithFilters?: (filters: { pId: string; category: string; credit: number; }, keepOverlayOpen?: boolean) => void;
  activeProgramIdInMainView?: string | null;
  uniqueSemesters: string[];
  allPossibleSemesters: string[];
  onShowSemesterDetail?: (semesterId: string) => void;
  activeSemesterDetailViewId?: string | null;
  allSemesterConfigurations: SemesterCloneInfo[];
  setAllSemesterConfigurations: React.Dispatch<React.SetStateAction<SemesterCloneInfo[]>>;
  selectedSemesterIdForRoutineView: string | null;
  setSelectedSemesterIdForRoutineView: (semesterId: string | null) => void;
  routineData: { [semesterId: string]: SemesterRoutineData };
  setRoutineData: React.Dispatch<React.SetStateAction<{ [semesterId: string]: SemesterRoutineData }>>;
  coursesData: EnrollmentEntry[];
  onSaveCourseMetadata: (updates: { pId: string; category: string; credit: number; courseType?: CourseType; weeklyClass?: number | undefined }[]) => void;
  activeSection: ActiveSettingsSection;
  setActiveSection: (section: ActiveSettingsSection) => void;
  stagedCourseUpdates: Record<string, { courseType: CourseType; weeklyClass: string; }>;
  setStagedCourseUpdates: React.Dispatch<React.SetStateAction<Record<string, { courseType: CourseType; weeklyClass: string; }>>>;
  onClearStagedCourseUpdates: () => void;
  onCloneRooms: (sourceSemesterId: string, targetSemesterId: string) => Promise<void>;
  activeGridDisplayType: 'Theory' | 'Lab' | 'All';
  setActiveGridDisplayType: (type: 'Theory' | 'Lab' | 'All') => void;
  programIdForSemesterFilter: string | null;
  setProgramIdForSemesterFilter: (id: string | null) => void;
  allPrograms: ProgramEntry[];
}

const ProgramIcon: React.FC<{ isActive: boolean, colorClass: string }> = ({ isActive, colorClass }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={`
      transition-all duration-400 ease-[cubic-bezier(0.68,-0.55,0.27,1.55)] ${colorClass}
      ${isActive
        ? 'w-4 h-4 sm:w-5 sm:w-5 mr-2'
        : 'w-5 h-5 sm:w-6 sm:w-6 mb-0.5'
      }
    `}
    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0 0 12 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75Z" />
  </svg>
);

const SlotsIcon: React.FC<{ isActive: boolean, colorClass: string }> = ({ isActive, colorClass }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={`
      transition-all duration-400 ease-[cubic-bezier(0.68,-0.55,0.27,1.55)] ${colorClass}
      ${isActive
        ? 'w-4 h-4 sm:w-5 sm:w-5 mr-2'
        : 'w-5 h-5 sm:w-6 sm:w-6 mb-0.5'
      }
    `}
    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 16v-2m8-8h2M4 12H2m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const BuildingsIcon: React.FC<{ isActive: boolean, colorClass: string }> = ({ isActive, colorClass }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={`
      transition-all duration-400 ease-[cubic-bezier(0.68,-0.55,0.27,1.55)] ${colorClass}
      ${isActive
        ? 'w-4 h-4 sm:w-5 sm:w-5 mr-2'
        : 'w-5 h-5 sm:w-6 sm:w-6 mb-0.5'
      }
    `}
    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h6.75M9 12.75h6.75M9 18.75h6.75M5.25 6h.008v.008H5.25V6Zm.75 0H6V6h-.008v.008Zm13.5 0h-.008V6H18v.008Zm-.75 0h.008v.008H18V6Zm-12 5.25h.008v.008H5.25v-.008Zm.75 0H6v-.008h-.008v.008Zm13.5 0h-.008v.008H18v-.008Zm-.75 0h.008v.008H18v-.008Zm-12 5.25h.008v.008H5.25v-.008Zm.75 0H6v-.008h-.008v.008Zm13.5 0h-.008v.008H18v-.008Zm-.75 0h.008v.008H18v-.008Z" />
  </svg>
);

const SemesterIcon: React.FC<{ isActive: boolean, colorClass: string }> = ({ isActive, colorClass }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={`
        transition-all duration-400 ease-[cubic-bezier(0.68,-0.55,0.27,1.55)] ${colorClass}
        ${isActive
          ? 'w-4 h-4 sm:w-5 sm:w-5 mr-2'
          : 'w-5 h-5 sm:w-6 sm:w-6 mb-0.5'
        }
      `}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );

const ThemeIcon: React.FC<{ isActive: boolean, colorClass: string }> = ({ isActive, colorClass }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={`
      transition-all duration-400 ease-[cubic-bezier(0.68,-0.55,0.27,1.55)] ${colorClass}
      ${isActive
        ? 'w-4 h-4 sm:w-5 sm:w-5 mr-2'
        : 'w-5 h-5 sm:w-6 sm:w-6 mb-0.5'
      }
    `}
    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4H7zm0 0l4-4m-4 4l4-4m-4 4v-4m4 4h4m-4-4l4-4m0 0l4 4m-4-4v4m0 0h4M3 3h18M3 21h18" />
  </svg>
);


const SectionTableIcon: React.FC<{ isActive: boolean, colorClass: string }> = ({ isActive, colorClass }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={`
        transition-all duration-400 ease-[cubic-bezier(0.68,-0.55,0.27,1.55)] ${colorClass}
        ${isActive
          ? 'w-4 h-4 sm:w-5 sm:w-5 mr-2'
          : 'w-5 h-5 sm:w-6 sm:w-6 mb-0.5'
        }
      `}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125v-1.5c0-.621.504-1.125 1.125-1.125h17.25c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h17.25M9 1.125v1.5M12 1.125v1.5M15 1.125v1.5M1.125 6h17.25c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125H1.125A1.125 1.125 0 010 8.625v-1.5C0 6.504.504 6 1.125 6z" />
    </svg>
);

const ColorPickerInput = ({
  label,
  colorKey,
  theme,
  setThemeColor,
}: {
  label: string;
  colorKey: keyof ThemeColors;
  theme: ThemeColors;
  setThemeColor: (key: keyof ThemeColors, value: string) => void;
}) => {
  const colorValue = theme[colorKey];
  return (
    <div className="flex items-center justify-between p-2 bg-gray-100 rounded-md">
      <label htmlFor={colorKey} className="text-sm font-medium text-gray-700">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <span className="text-sm font-mono text-gray-500">{colorValue}</span>
        <input
          id={colorKey}
          type="color"
          value={colorValue}
          onChange={(e) => setThemeColor(colorKey, e.target.value)}
          className="w-8 h-8 p-0 border-none rounded-md cursor-pointer bg-transparent"
          style={{ backgroundColor: colorValue }}
        />
      </div>
    </div>
  );
};


const SettingsPanel: React.FC<SettingsPanelProps> = ({ 
    onClose, 
    onShowBuildingRooms, 
    onShowProgramDetailView,
    onShowSectionList,
    onShowSectionListWithFilters,
    activeProgramIdInMainView, 
    uniqueSemesters, 
    allPossibleSemesters,
    onShowSemesterDetail, 
    activeSemesterDetailViewId, 
    allSemesterConfigurations, 
    setAllSemesterConfigurations,
    selectedSemesterIdForRoutineView,
    setSelectedSemesterIdForRoutineView,
    routineData,
    setRoutineData,
    coursesData,
    onSaveCourseMetadata,
    activeSection,
    setActiveSection,
    stagedCourseUpdates,
    setStagedCourseUpdates,
    onClearStagedCourseUpdates,
    onCloneRooms,
    activeGridDisplayType,
    setActiveGridDisplayType,
    programIdForSemesterFilter,
    setProgramIdForSemesterFilter,
    allPrograms,
}) => {
  const { buildings: allBuildings } = useBuildings();
  const { user } = useAuth();
  const { theme, setThemeColor, saveTheme, resetTheme } = useTheme();

  const configuredSemestersForDropdown = useMemo(() => 
      allSemesterConfigurations.map(c => c.targetSemester).sort((a,b) => b.localeCompare(a)), 
      [allSemesterConfigurations]
  );
  
  const allSettingOptions: ({
      id: ActiveSettingsSection | 'sectionListView';
      label: string;
      IconComponent: React.FC<{isActive: boolean, colorClass: string}>;
      baseColor: string;
      hoverColor: string;
      iconTextColor: string;
      activeTextColor: string;
      permission: keyof DashboardAccess | keyof import('../../types').RoomEditAccess;
      action?: () => void;
  })[] = [
    { 
      id: 'program' as ActiveSettingsSection, 
      label: 'Program Setup', 
      IconComponent: ProgramIcon, 
      baseColor: 'bg-teal-700',
      hoverColor: 'hover:bg-teal-800',
      iconTextColor: 'text-yellow-300',
      activeTextColor: 'text-white',
      permission: 'canManageProgramSetup',
    },
    { 
      id: 'slots' as ActiveSettingsSection, 
      label: 'Default Slots', 
      IconComponent: SlotsIcon, 
      baseColor: 'bg-teal-700', 
      hoverColor: 'hover:bg-teal-800', 
      iconTextColor: 'text-yellow-300',
      activeTextColor: 'text-white',
      permission: 'canManageDefaultSlots',
    },
    { 
      id: 'buildings' as ActiveSettingsSection, 
      label: 'Room Management', 
      IconComponent: BuildingsIcon, 
      baseColor: 'bg-teal-700', 
      hoverColor: 'hover:bg-teal-800', 
      iconTextColor: 'text-yellow-300', 
      activeTextColor: 'text-white',
      permission: 'canManageRoomManagement',
    },
    { 
        id: 'semester' as ActiveSettingsSection, 
        label: 'Semester Setup', 
        IconComponent: SemesterIcon, 
        baseColor: 'bg-teal-700', 
        hoverColor: 'hover:bg-teal-800', 
        iconTextColor: 'text-yellow-300', 
        activeTextColor: 'text-white',
        permission: 'canManageSemesterSetup',
    },
    { 
        id: 'sectionListView', 
        label: 'Section Table', 
        IconComponent: SectionTableIcon, 
        baseColor: 'bg-teal-700', 
        hoverColor: 'hover:bg-teal-800', 
        iconTextColor: 'text-yellow-300', 
        activeTextColor: 'text-white',
        action: onShowSectionList,
        permission: 'canViewSectionTable',
    },
    { 
      id: 'theme' as ActiveSettingsSection, 
      label: 'Customize Theme', 
      IconComponent: ThemeIcon, 
      baseColor: 'bg-indigo-700',
      hoverColor: 'hover:bg-indigo-800', 
      iconTextColor: 'text-indigo-200', 
      activeTextColor: 'text-white',
      permission: 'canCustomizeTheme',
    },
  ];

  const settingOptions = useMemo(() => {
    if (!user) return [];
    if (user.role === 'admin') return allSettingOptions;
    
    return allSettingOptions.filter(opt => {
        if (opt.permission === 'canManageRoomManagement') {
            return user.roomEditAccess?.canManageRoomManagement;
        }
        return user.dashboardAccess && user.dashboardAccess[opt.permission as keyof DashboardAccess];
    });
  }, [user]);

  const themeOptions: { label: string; key: keyof ThemeColors }[] = [
    { label: 'Primary Accent (e.g., buttons)', key: '--color-primary-500' },
    { label: 'Primary Dark (e.g., header)', key: '--color-primary-700' },
    { label: 'Primary Darkest (e.g., sidebar)', key: '--color-primary-900' },
    { label: 'Primary Light (e.g., hovers)', key: '--color-primary-100' },
    { label: 'Page Background', key: '--color-bg-base' },
    { label: 'Panel Background', key: '--color-bg-panel' },
    { label: 'Main Text', key: '--color-text-base' },
    { label: 'Muted Text', key: '--color-text-muted' },
    { label: 'Highlight Color (Yellow)', key: '--color-accent-yellow-400' },
  ];

  const renderSettingButton = (opt: (typeof allSettingOptions)[0], isCurrentlyActiveSection: boolean) => {
    const handleClick = () => {
      if (opt.action) {
        opt.action();
      } else {
        const newActiveSection = activeSection === opt.id ? null : (opt.id as ActiveSettingsSection);
        setActiveSection(newActiveSection);

        if (opt.id === 'semester' && newActiveSection === 'semester' && selectedSemesterIdForRoutineView && onShowSemesterDetail) {
            onShowSemesterDetail(selectedSemesterIdForRoutineView);
        }

        if (opt.id === 'buildings' && newActiveSection === 'buildings' && onShowBuildingRooms) {
            onShowBuildingRooms(null);
        }
      }
    };
    
    return (
      <button
        key={opt.id}
        onClick={handleClick}
        aria-expanded={isCurrentlyActiveSection}
        aria-controls={!opt.action ? `${opt.id}-content-section` : undefined}
        className={`
          rounded-lg group 
          transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
          ${isCurrentlyActiveSection
            ? `w-full p-1.5 flex flex-row items-center justify-start ${opt.baseColor} cursor-pointer`
            : `w-full h-auto sm:h-20 p-1.5 sm:p-2 flex flex-col items-center justify-center ${opt.baseColor} ${opt.hoverColor} text-center`
          }
        `}
      >
        <opt.IconComponent 
          isActive={isCurrentlyActiveSection} 
          colorClass={isCurrentlyActiveSection ? opt.activeTextColor : opt.iconTextColor} 
        />
        <span 
          className={`text-[11px] sm:text-xs font-medium ${isCurrentlyActiveSection ? `${opt.activeTextColor} ml-2` : `${opt.iconTextColor} mt-1`}`}
        >
          {opt.label}
        </span>
      </button>
    );
  };
  
  return (
    <BasePanel onClose={onClose} title="" className="bg-gray-50">
      <div className="flex flex-col h-full">
        <div className="flex-shrink-0 mt-2 mb-2 sm:mb-2.5">
          {activeSection ? (
            settingOptions
              .filter(opt => opt.id === activeSection)
              .map(opt => renderSettingButton(opt, true))
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              {settingOptions.map(opt => renderSettingButton(opt, false))}
            </div>
          )}
        </div>
        
        <div className="flex-grow min-h-0 flex flex-col relative">
          <div
            id="program-content-section"
            className={`absolute inset-0 transition-opacity duration-300 ease-in-out flex flex-col
                       ${activeSection === 'program' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}
            aria-hidden={activeSection !== 'program'}
          >
            {activeSection === 'program' && (
              <ProgramFacultySetup 
                onShowProgramDetailView={onShowProgramDetailView} 
                onShowSectionListWithFilters={onShowSectionListWithFilters}
                activeProgramIdInMainView={activeProgramIdInMainView} 
                coursesData={coursesData}
                onSaveCourseMetadata={onSaveCourseMetadata}
                stagedCourseUpdates={stagedCourseUpdates}
                setStagedCourseUpdates={setStagedCourseUpdates}
                onClearStagedCourseUpdates={onClearStagedCourseUpdates}
                activeGridDisplayType={activeGridDisplayType}
                setActiveGridDisplayType={setActiveGridDisplayType}
                configuredSemesters={configuredSemestersForDropdown}
                selectedSemesterIdForRoutineView={selectedSemesterIdForRoutineView}
                setSelectedSemesterIdForRoutineView={setSelectedSemesterIdForRoutineView}
              />
            )}
          </div>

          <div
            id="slots-content-section"
            className={`absolute inset-0 transition-opacity duration-300 ease-in-out flex flex-col
                       ${activeSection === 'slots' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}
            aria-hidden={activeSection !== 'slots'}
          >
            {activeSection === 'slots' && <DefaultTimeSlotManager />}
          </div>

          <div
            id="buildings-content-section"
            className={`absolute inset-0 transition-opacity duration-300 ease-in-out flex flex-col
                       ${activeSection === 'buildings' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}
            aria-hidden={activeSection !== 'buildings'}
          >
            {activeSection === 'buildings' && (
              <BuildingCampusSetup 
                onShowBuildingRooms={onShowBuildingRooms} 
                allSemesterConfigurations={allSemesterConfigurations}
                selectedSemesterIdForRoutineView={selectedSemesterIdForRoutineView}
                setSelectedSemesterIdForRoutineView={setSelectedSemesterIdForRoutineView}
              />
            )}
          </div>

          <div
            id="semester-content-section"
            className={`absolute inset-0 transition-opacity duration-300 ease-in-out flex flex-col
                       ${activeSection === 'semester' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}
            aria-hidden={activeSection !== 'semester'}
          >
            {activeSection === 'semester' && <SemesterSetupPanel 
                uniqueSemesters={uniqueSemesters} 
                allPossibleSemesters={allPossibleSemesters}
                onShowSemesterDetail={onShowSemesterDetail}
                activeSemesterDetailViewId={activeSemesterDetailViewId}
                allSemesterConfigurations={allSemesterConfigurations}
                setAllSemesterConfigurations={setAllSemesterConfigurations}
                selectedSemesterIdForRoutineView={selectedSemesterIdForRoutineView}
                setSelectedSemesterIdForRoutineView={setSelectedSemesterIdForRoutineView}
                routineData={routineData}
                setRoutineData={setRoutineData}
                onCloneRooms={onCloneRooms}
                allPrograms={allPrograms}
                programIdForSemesterFilter={programIdForSemesterFilter}
                setProgramIdForSemesterFilter={setProgramIdForSemesterFilter}
                activeTabForSemesterFilter={activeGridDisplayType}
                setActiveTabForSemesterFilter={setActiveGridDisplayType}
             />}
          </div>

          <div
            id="theme-content-section"
            className={`absolute inset-0 transition-opacity duration-300 ease-in-out flex flex-col
                       ${activeSection === 'theme' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}
            aria-hidden={activeSection !== 'theme'}
          >
            {activeSection === 'theme' && (
                <div className="p-1 sm:p-1.5 rounded-md bg-slate-100 flex flex-col h-full">
                    <div className="flex-shrink-0 p-2 sm:p-2.5 rounded-md bg-gray-50 shadow-sm mb-3">
                        <h3 className="text-sm font-semibold text-gray-700">Customize Theme</h3>
                        <p className="text-xs text-gray-500 mt-1">Changes are applied live. Press 'Save Theme' to persist across sessions.</p>
                    </div>

                    <div className="flex-grow min-h-0 overflow-y-auto custom-scrollbar pr-1 space-y-2">
                        {themeOptions.map(opt => (
                            <ColorPickerInput
                                key={opt.key}
                                label={opt.label}
                                colorKey={opt.key}
                                theme={theme}
                                setThemeColor={setThemeColor}
                            />
                        ))}
                    </div>
                    
                    <div className="flex-shrink-0 flex justify-between items-center mt-3 pt-3 border-t border-gray-200">
                        <button
                            onClick={resetTheme}
                            className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-md border border-red-200"
                        >
                            Reset to Defaults
                        </button>
                        <button 
                            onClick={saveTheme} 
                            className="px-3 py-1.5 text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-md"
                        >
                            Save Theme
                        </button>
                    </div>
                </div>
            )}
          </div>
          
          { !activeSection && (
              <div className="h-full flex flex-col items-center justify-center p-3 text-center text-gray-400">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426-1.756-2.924-1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572C2.05 15.75 2.05 13.25 3.806 12.824a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <p className="italic text-xs sm:text-sm">
                      Select a section above to configure settings.
                  </p>
              </div>
          )}
        </div>
      </div>
    </BasePanel>
  );
};

export default SettingsPanel;