

import React, { useState, useMemo } from 'react';
import Modal from '../Modal';
import { SemesterSystem, SemesterCloneInfo, FullRoutineData, ProgramEntry, SemesterRoutineData, RoutineVersion } from '../../types';
import { SEMESTER_SYSTEMS } from '../../data/programConstants';
import SearchableProgramDropdown from '../SearchableProgramDropdown';

interface SemesterSetupPanelProps {
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
  onCloneRooms?: (sourceSemesterId: string, targetSemesterId: string) => Promise<void>;
  allPrograms: ProgramEntry[];
  programIdForSemesterFilter: string | null;
  setProgramIdForSemesterFilter: (id: string | null) => void;
  activeTabForSemesterFilter: 'Theory' | 'Lab' | 'All';
  setActiveTabForSemesterFilter: (tab: 'Theory' | 'Lab' | 'All') => void;
}

const ToggleSwitch = ({ isActive, onClick }: { isActive: boolean, onClick: (e: React.MouseEvent) => void }) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isActive}
      onClick={onClick}
      className={`relative inline-flex flex-shrink-0 h-4 w-8 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none ${
        isActive ? 'bg-teal-600' : 'bg-gray-200'
      }`}
    >
      <span className="sr-only">Set Active</span>
      <span
        aria-hidden="true"
        className={`inline-block h-3 w-3 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200 ${
          isActive ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  );
};


const SemesterSetupPanel: React.FC<SemesterSetupPanelProps> = ({
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
  onCloneRooms,
  allPrograms,
  programIdForSemesterFilter,
  setProgramIdForSemesterFilter,
  activeTabForSemesterFilter,
  setActiveTabForSemesterFilter,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [targetSemester, setTargetSemester] = useState<string>('');
  const [sourceSemester, setSourceSemester] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [semesterConfigs, setSemesterConfigs] = useState<SemesterCloneInfo['typeConfigs']>([]);
  const [configFormError, setConfigFormError] = useState<string | null>(null);
  const [editingSemesterId, setEditingSemesterId] = useState<string | null>(null);

  const configuredSemesters = useMemo(() => {
    return allSemesterConfigurations.map(c => c.targetSemester).sort((a,b) => b.localeCompare(a));
  }, [allSemesterConfigurations]);
  
  const availableTargetSemesters = useMemo(() => {
    const configured = new Set(allSemesterConfigurations.map(c => c.targetSemester));
    return allPossibleSemesters.filter(s => !configured.has(s)).sort((a, b) => {
        const semesterOrder = ['Spring', 'Summer', 'Fall'];
        const [aSem, aYear] = a.split(' ');
        const [bSem, bYear] = b.split(' ');
        if (aYear !== bYear) return (parseInt(bYear) || 0) - (parseInt(aYear) || 0);
        return semesterOrder.indexOf(aSem) - semesterOrder.indexOf(bSem);
    });
  }, [allPossibleSemesters, allSemesterConfigurations]);


  const filteredConfiguredSemesters = useMemo(() => {
    if (!searchTerm.trim()) {
      return configuredSemesters;
    }
    return configuredSemesters.filter(semester =>
      semester.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [configuredSemesters, searchTerm]);
  
  const resetAndCloseModal = () => {
    setIsModalOpen(false);
    setEditingSemesterId(null);
    setTargetSemester('');
    setSourceSemester('');
    setFormError(null);
    setSemesterConfigs([]);
    setConfigFormError(null);
  };

  const handleOpenAddModal = () => {
    setEditingSemesterId(null);
    setTargetSemester('');
    setSourceSemester('');
    setFormError(null);
    const initialConfigs = SEMESTER_SYSTEMS.map((system, index) => ({
      id: index,
      type: system,
      startDate: '',
      endDate: '',
    }));
    setSemesterConfigs(initialConfigs);
    setConfigFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (semesterId: string) => {
    const existingConfig = allSemesterConfigurations.find(c => c.targetSemester === semesterId);
    setEditingSemesterId(semesterId);
    setTargetSemester(semesterId);
    setFormError(null);
    setConfigFormError(null);
    
    const savedTypeConfigs = existingConfig?.typeConfigs || [];
    
    const mergedConfigs = SEMESTER_SYSTEMS.map((system, index) => {
      const saved = savedTypeConfigs.find(sc => sc.type === system);
      return {
        id: saved?.id ?? index,
        type: system,
        startDate: saved?.startDate || '',
        endDate: saved?.endDate || '',
      };
    });

    setSemesterConfigs(mergedConfigs);
    setSourceSemester(existingConfig?.sourceSemester || '');
    setIsModalOpen(true);
  };

  const handleConfigDateChange = (configType: SemesterSystem, field: 'startDate' | 'endDate', value: string) => {
    setSemesterConfigs(prev => {
        const newConfigs = prev.map(config =>
            config.type === configType ? { ...config, [field]: value } : config
        );
        
        setConfigFormError(null);
        for (const config of newConfigs) {
            if (config.startDate && config.endDate && new Date(config.startDate) >= new Date(config.endDate)) {
                setConfigFormError(`For ${config.type}, End Date must be after Start Date.`);
                break;
            }
        }
        return newConfigs;
    });
  };

  const handleSaveConfiguration = async () => {
    setFormError(null);
    const isEditing = !!editingSemesterId;
    const currentTargetSemester = isEditing ? editingSemesterId : targetSemester;

    if (!currentTargetSemester) {
        setFormError('Target semester is required.');
        return;
    }

    let validationError = '';
    for (const config of semesterConfigs) {
        if ((config.startDate && !config.endDate) || (!config.startDate && config.endDate)) {
            validationError = `For ${config.type}, both Start and End dates must be filled, or both must be empty.`;
            break;
        }
        if (config.startDate && config.endDate && new Date(config.startDate) >= new Date(config.endDate)) {
            validationError = `For ${config.type}, End Date must be after Start Date.`;
            break;
        }
    }

    if (validationError) {
        setFormError(validationError);
        return;
    }

    setIsLoading(true);
    try {
        if (!isEditing) {
            const newVersionId = `v-initial-${Date.now()}`;
            const newSemesterData: SemesterRoutineData = {
                versions: [{ versionId: newVersionId, createdAt: new Date().toISOString(), routine: {} }],
                activeVersionId: newVersionId,
            };

            setRoutineData(prev => ({
                ...prev,
                [currentTargetSemester]: newSemesterData
            }));

            if (sourceSemester && onCloneRooms) {
                await onCloneRooms(sourceSemester, currentTargetSemester);
            }
        }

        const newConfigData: SemesterCloneInfo = {
            targetSemester: currentTargetSemester,
            sourceSemester: sourceSemester,
            typeConfigs: semesterConfigs,
        };

        const configExists = allSemesterConfigurations.some(c => c.targetSemester === currentTargetSemester);
        if (configExists) {
            setAllSemesterConfigurations(prev => prev.map(c => c.targetSemester === currentTargetSemester ? newConfigData : c));
        } else {
            setAllSemesterConfigurations(prev => [...prev, newConfigData]);
        }

        alert(`Successfully saved configuration for "${currentTargetSemester}".`);
        resetAndCloseModal();

    } catch (error: any) {
        setFormError(error.message || 'An unexpected error occurred during saving/cloning.');
    } finally {
        setIsLoading(false);
    }
  };

  const modalContent = (
    <div className="space-y-3">
       {/* Modal content remains mostly the same, as it's for configuration, not display */}
      <fieldset className="border border-gray-300 p-2 rounded-md">
        <legend className="text-xs font-medium text-gray-700 px-1">Semester Identity</legend>
        <div className="mt-1 grid grid-cols-1 md:grid-cols-2 gap-2">
          <div>
            <label htmlFor="target-semester-select" className="block text-xs font-medium text-gray-600 mb-0.5">Target Semester *</label>
            {!!editingSemesterId ? (
                <input
                    type="text"
                    value={targetSemester}
                    disabled={true}
                    className="w-full p-1.5 border border-gray-300 rounded-md shadow-sm bg-gray-100 text-xs"
                />
            ) : (
                <select
                    id="target-semester-select"
                    value={targetSemester}
                    onChange={(e) => setTargetSemester(e.target.value)}
                    className="w-full p-1.5 border border-gray-300 rounded-md shadow-sm focus:ring-teal-500 focus:border-teal-500 text-xs"
                >
                    <option value="" disabled>-- Select Semester --</option>
                    {availableTargetSemesters.map(semester => (
                        <option key={semester} value={semester}>{semester}</option>
                    ))}
                </select>
            )}
          </div>
          <div>
             <label htmlFor="source-semester-select" className="block text-xs font-medium text-gray-600 mb-0.5">Clone Semester</label>
            <select
              id="source-semester-select"
              value={sourceSemester}
              onChange={(e) => setSourceSemester(e.target.value)}
              disabled={!!editingSemesterId}
              className="w-full p-1.5 border border-gray-300 rounded-md shadow-sm focus:ring-teal-500 focus:border-teal-500 text-xs"
            >
              <option value="">-- No Source (New) --</option>
              {uniqueSemesters.map(semester => (
                <option key={semester} value={semester}>{semester}</option>
              ))}
            </select>
          </div>
        </div>
      </fieldset>

      <fieldset className="border border-gray-300 p-2 rounded-md">
        <legend className="text-xs font-medium text-gray-700 px-1">Semester Type Configuration</legend>
        <div className="mt-1 space-y-3 max-h-48 overflow-auto custom-scrollbar pr-1">
            {configFormError && <p className="text-xs text-red-500 mt-1">{configFormError}</p>}
            
            {semesterConfigs.length > 0 ? (
                semesterConfigs.map(config => (
                    <div key={config.type} className="bg-gray-50 p-2 rounded-md border border-gray-200">
                        <h5 className="font-semibold text-sm text-gray-700 mb-1.5">{config.type}</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <div>
                                <label htmlFor={`start-date-${config.type}`} className="block text-xs font-medium text-gray-600 mb-0.5">Start Date</label>
                                <input
                                    id={`start-date-${config.type}`}
                                    type="date"
                                    value={config.startDate}
                                    onChange={e => handleConfigDateChange(config.type, 'startDate', e.target.value)}
                                    className="w-full p-1 border border-gray-300 rounded-md text-xs h-[30px]"
                                    aria-label={`Start date for ${config.type}`}
                                />
                            </div>
                            <div>
                                <label htmlFor={`end-date-${config.type}`} className="block text-xs font-medium text-gray-600 mb-0.5">End Date</label>
                                <input
                                    id={`end-date-${config.type}`}
                                    type="date"
                                    value={config.endDate}
                                    onChange={e => handleConfigDateChange(config.type, 'endDate', e.target.value)}
                                    className="w-full p-1 border border-gray-300 rounded-md text-xs h-[30px]"
                                    aria-label={`End date for ${config.type}`}
                                />
                            </div>
                        </div>
                    </div>
                ))
            ) : (
                <p className="text-xs text-center text-gray-500 p-2">No semester systems found.</p>
            )}
        </div>
      </fieldset>

      {formError && (<p className="text-xs text-red-600 p-1.5 bg-red-100 border border-red-300 rounded-md">{formError}</p>)}

      <div className="flex justify-end gap-2 pt-2 border-t border-gray-200 mt-2">
        <button type="button" onClick={resetAndCloseModal} className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md border border-gray-300">Cancel</button>
        <button type="button" onClick={handleSaveConfiguration} disabled={isLoading} className="px-3 py-1.5 text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-md border border-transparent disabled:bg-gray-400 disabled:cursor-not-allowed">
          {isLoading ? 'Saving...' : (editingSemesterId ? 'Update Config' : 'Save Config')}
        </button>
      </div>
    </div>
  );

  return (
    <div className="relative flex flex-col flex-grow min-h-0">
        <div className="flex-shrink-0 px-1 pt-2 pb-2 space-y-2">
            <div className="p-1.5 bg-slate-200 rounded-md space-y-2">
                <label className="text-xs font-semibold text-gray-700 block px-1">Semester Data Filters</label>
                <div>
                    <SearchableProgramDropdown
                        programs={allPrograms}
                        selectedProgramId={programIdForSemesterFilter}
                        onProgramSelect={setProgramIdForSemesterFilter}
                        placeholderText="Filter data by Program..."
                        showAllProgramsListItem={true}
                        allProgramsListItemText="-- All Programs --"
                        buttonClassName="w-full flex items-center justify-between p-1.5 text-xs rounded-md transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-offset-1 shadow-sm bg-white border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-teal-500 focus:ring-offset-slate-200"
                    />
                </div>
                <nav className="flex space-x-1 p-0.5 bg-slate-300 rounded-md justify-center">
                    <button
                        onClick={() => setActiveTabForSemesterFilter('All')}
                        className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors flex-grow ${
                            activeTabForSemesterFilter === 'All' ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-600 hover:bg-slate-200'
                        }`}
                        aria-pressed={activeTabForSemesterFilter === 'All'}
                    >
                        All
                    </button>
                    <button
                        onClick={() => setActiveTabForSemesterFilter('Theory')}
                        className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors flex-grow ${
                            activeTabForSemesterFilter === 'Theory' ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-600 hover:bg-slate-200'
                        }`}
                        aria-pressed={activeTabForSemesterFilter === 'Theory'}
                    >
                        Theory Data
                    </button>
                    <button
                        onClick={() => setActiveTabForSemesterFilter('Lab')}
                        className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors flex-grow ${
                            activeTabForSemesterFilter === 'Lab' ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-600 hover:bg-slate-200'
                        }`}
                        aria-pressed={activeTabForSemesterFilter === 'Lab'}
                    >
                        Lab Data
                    </button>
                </nav>
            </div>

            <div className="relative pt-2">
                <input
                  type="search"
                  placeholder="Search configured semesters..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-md shadow-sm focus:ring-teal-500 focus:border-teal-500"
                  aria-label="Search configured semesters"
                />
                <div className="absolute inset-y-0 left-0 flex items-center pl-2 pointer-events-none"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg></div>
            </div>
        </div>
        
        <div className="flex-grow min-h-0 overflow-y-auto custom-scrollbar px-1 space-y-2 pb-20">
          {configuredSemesters.length === 0 ? (
            <div className="text-center py-6 px-3 text-gray-500 bg-white rounded-md h-full flex flex-col justify-center items-center shadow-inner">
              <p className="font-semibold">No semesters configured yet.</p><p className="text-xs mt-1">Use the "Add New Configuration" button below to create your first semester setup.</p>
            </div>
          ) : filteredConfiguredSemesters.length === 0 ? (
              <div className="text-center py-6 px-3 text-gray-500 bg-white rounded-md h-full flex flex-col justify-center items-center shadow-inner">
                  <p className="font-semibold">No Semesters Found</p><p className="text-xs mt-1">No configured semesters match your search for "{searchTerm}".</p>
              </div>
          ) : (
            filteredConfiguredSemesters.map(semester => {
              const isActiveForDetailView = activeSemesterDetailViewId === semester;
              const isSelectedForRoutine = selectedSemesterIdForRoutineView === semester;
              
              return (
                 <div
                    key={semester}
                    onClick={() => onShowSemesterDetail?.(semester)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && onShowSemesterDetail) onShowSemesterDetail(semester) }}
                    className={`
                        bg-white rounded-lg shadow-sm border p-1.5 transition-all duration-200 group cursor-pointer
                        ${isActiveForDetailView || isSelectedForRoutine ? 'bg-teal-100 border-teal-300' : 'border-gray-200 hover:shadow-md hover:border-gray-300'}
                    `}
                 >
                    <div className="flex items-center justify-between">
                       <div
                            className="flex-grow min-w-0 pr-2"
                        >
                          <p className="font-semibold text-gray-800 truncate text-xs pointer-events-none">
                              {semester}
                          </p>
                        </div>

                       <div className="flex items-center gap-2 flex-shrink-0">
                           <div className="relative">
                              <button 
                                 onClick={(e) => { e.stopPropagation(); handleOpenEditModal(semester); }}
                                 className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 p-1 text-gray-500 hover:bg-gray-200 hover:text-gray-800 rounded-full transition-opacity"
                                 title="Edit Configuration"
                                 aria-label={`Edit configuration for ${semester}`}
                              >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                      <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                                      <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                                  </svg>
                              </button>
                           </div>
                          <ToggleSwitch
                             isActive={isSelectedForRoutine}
                             onClick={(e) => {
                               e.stopPropagation();
                               setSelectedSemesterIdForRoutineView(isSelectedForRoutine ? null : semester);
                             }}
                           />
                       </div>
                    </div>
                 </div>
              );
            })
          )}
        </div>
      
      <button
        onClick={handleOpenAddModal}
        className="absolute bottom-4 right-4 bg-[var(--color-primary-700)] hover:bg-[var(--color-primary-600)] text-white font-semibold p-3 rounded-full shadow-lg transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] focus:ring-offset-2 z-10"
        aria-label="Add a new semester configuration"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
        </svg>
      </button>
      
      <Modal isOpen={isModalOpen} onClose={resetAndCloseModal} title={editingSemesterId ? `Edit Config: ${editingSemesterId}` : 'Add New Semester Configuration'}>
        {modalContent}
      </Modal>
    </div>
  );
};

export default SemesterSetupPanel;
