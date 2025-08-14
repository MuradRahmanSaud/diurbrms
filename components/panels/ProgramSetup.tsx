








import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ProgramEntry, ProgramType, SemesterSystem, DefaultTimeSlot, ProgramSlotFilterType, EnrollmentEntry, CourseType, DayOfWeek } from '../../types';
import { PROGRAM_TYPES, SEMESTER_SYSTEMS } from '../../data/programConstants';
import { SEED_DEFAULT_SLOTS_DATA, sortSlotsByTypeThenTime } from '../../data/slotConstants';
import Modal from '../Modal';
import { usePrograms } from '../../contexts/ProgramContext'; 
import SearchableCreatableDropdown from '../SearchableCreatableDropdown';
import DaySelector from '../DaySelector';
import { DAYS_OF_WEEK } from '../../data/routineConstants';
import SearchableProgramDropdown from '../SearchableProgramDropdown';
import { useAuth } from '../../contexts/AuthContext';


interface ProgramFacultySetupProps {
  onShowProgramDetailView?: (programId: string) => void;
  onShowSectionListWithFilters?: (filters: { pId: string; category: string; credit: number; }, keepOverlayOpen?: boolean) => void;
  activeProgramIdInMainView?: string | null;
  coursesData: EnrollmentEntry[];
  onSaveCourseMetadata: (updates: { pId: string; category: string; credit: number; courseType?: CourseType; weeklyClass?: number | undefined }[]) => void;
  stagedCourseUpdates: Record<string, { courseType: CourseType; weeklyClass: string; }>;
  setStagedCourseUpdates: React.Dispatch<React.SetStateAction<Record<string, { courseType: CourseType; weeklyClass: string; }>>>;
  onClearStagedCourseUpdates: () => void;
  activeGridDisplayType: 'Theory' | 'Lab' | 'All';
  setActiveGridDisplayType: (type: 'Theory' | 'Lab' | 'All') => void;
  configuredSemesters: string[];
  selectedSemesterIdForRoutineView: string | null;
  setSelectedSemesterIdForRoutineView: (semesterId: string | null) => void;
}

const formatTimeToAMPM = (time24: string): string => {
  if (!time24) return 'N/A';
  try {
    const [hours, minutes] = time24.split(':');
    let h = parseInt(hours, 10);
    const m = parseInt(minutes, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12; h = h ? h : 12;
    const hStr = h < 10 ? '0' + h : h.toString();
    const mStr = m < 10 ? '0' + m : m.toString();
    return `${hStr}:${mStr} ${ampm}`;
  } catch (e) {
    return 'Invalid Time';
  }
};
const calculateDuration = (startTime: string, endTime: string): number => {
    if (!startTime || !endTime) return 0;
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    return ((endH * 60 + endM) - (startH * 60 + startM));
};

export const ProgramFacultySetup: React.FC<ProgramFacultySetupProps> = ({ 
  onShowProgramDetailView, 
  onShowSectionListWithFilters,
  activeProgramIdInMainView,
  coursesData,
  onSaveCourseMetadata,
  stagedCourseUpdates,
  setStagedCourseUpdates,
  onClearStagedCourseUpdates,
  activeGridDisplayType,
  setActiveGridDisplayType,
  configuredSemesters,
  selectedSemesterIdForRoutineView,
  setSelectedSemesterIdForRoutineView,
}) => {
  const { programs, loading: programsLoading, error: programsError, addProgram, updateProgram } = usePrograms();
  const { user } = useAuth();
  const [programForm, setProgramForm] = useState<Partial<ProgramEntry>>({
    faculty: '', pId: '', fullName: '', shortName: '', type: 'Undergraduate',
    semesterSystem: SEMESTER_SYSTEMS[0], programSpecificSlots: [],
    activeDays: DAYS_OF_WEEK.filter(d => d !== 'Friday'),
  });
  const [programFormError, setProgramFormError] = useState<string | null>(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [editingProgram, setEditingProgram] = useState<ProgramEntry | null>(null);
  
  // State for embedded slot manager
  const [slotType, setSlotType] = useState<'Theory' | 'Lab' | null>(null);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [slotFormError, setSlotFormError] = useState<string | null>(null);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [slotFilterTab, setSlotFilterTab] = useState<ProgramSlotFilterType>('All');
  const [slotSaveSuccessMessage, setSlotSaveSuccessMessage] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFaculties, setSelectedFaculties] = useState<string[]>([]);

  const resetSlotManagerForm = useCallback(() => {
    setSlotType(null);
    setStartTime('');
    setEndTime('');
    setSlotFormError(null);
    setEditingSlotId(null);
  }, []);

  const resetProgramFormAndCloseModal = useCallback(() => {
    setIsFormModalOpen(false);
    setEditingProgram(null);
    setProgramForm({ faculty: '', pId: '', fullName: '', shortName: '', type: 'Undergraduate', semesterSystem: 'Tri-Semester', programSpecificSlots: [], activeDays: DAYS_OF_WEEK.filter(d => d !== 'Friday') });
    setProgramFormError(null);
    setSubmissionStatus(null);
    resetSlotManagerForm();
  }, [resetSlotManagerForm]);

  const openAddProgramModal = useCallback(() => {
    setEditingProgram(null);
    setProgramForm({ faculty: '', pId: '', fullName: '', shortName: '', type: 'Undergraduate', semesterSystem: 'Tri-Semester', programSpecificSlots: [], activeDays: DAYS_OF_WEEK.filter(d => d !== 'Friday') });
    setProgramFormError(null);
    setSubmissionStatus(null);
    resetSlotManagerForm();
    setIsFormModalOpen(true);
  }, [resetSlotManagerForm]);
  
  const handleProgramSubmit = async () => {
    setProgramFormError(null);
    if (!programForm.faculty || !programForm.pId || !programForm.fullName || !programForm.shortName) {
      setProgramFormError("Faculty, P-ID, Full Name, and Short Name are required.");
      return;
    }
    
    const dataToSave: Omit<ProgramEntry, 'id'> = {
      faculty: programForm.faculty,
      pId: programForm.pId,
      fullName: programForm.fullName,
      shortName: programForm.shortName,
      type: programForm.type || 'Undergraduate',
      semesterSystem: programForm.semesterSystem || 'Tri-Semester',
      programSpecificSlots: (programForm.programSpecificSlots || []).sort(sortSlotsByTypeThenTime),
      activeDays: programForm.activeDays || [],
    };

    try {
      if (editingProgram) {
        await updateProgram({ ...dataToSave, id: editingProgram.id });
        setSubmissionStatus({type: 'success', message: 'Program updated successfully!'});
      } else {
        await addProgram(dataToSave);
        setSubmissionStatus({type: 'success', message: 'Program added successfully!'});
      }
      setTimeout(resetProgramFormAndCloseModal, 1500);
    } catch (e: any) {
      setProgramFormError(e.message || 'Failed to save program.');
    }
  };
  
  // --- Embedded Slot Manager Logic ---
  const handleSlotSubmit = useCallback(() => {
    setSlotFormError(null);
    setSlotSaveSuccessMessage(null);
    if (!slotType) { setSlotFormError('Slot Type is required.'); return; }
    if (!startTime || !endTime) { setSlotFormError('Start and End times are required.'); return; }
    if (calculateDuration(startTime, endTime) <= 0) { setSlotFormError('End time must be after start time.'); return; }

    let updatedSlots = [...(programForm.programSpecificSlots || [])];
    const newSlot: DefaultTimeSlot = { id: `prog-slot-${Date.now()}`, type: slotType, startTime, endTime };
    
    if (editingSlotId) {
      updatedSlots = updatedSlots.map(s => s.id === editingSlotId ? { ...s, ...newSlot, id: s.id } : s);
      setSlotSaveSuccessMessage('Slot updated.');
    } else {
      updatedSlots.push(newSlot);
      setSlotSaveSuccessMessage('Slot added.');
    }
    setProgramForm(prev => ({...prev, programSpecificSlots: updatedSlots.sort(sortSlotsByTypeThenTime)}));
    resetSlotManagerForm();
    setTimeout(() => setSlotSaveSuccessMessage(null), 2000);
  }, [slotType, startTime, endTime, editingSlotId, programForm.programSpecificSlots, resetSlotManagerForm]);

  const handleLoadSlotForEdit = useCallback((slot: DefaultTimeSlot) => {
    setEditingSlotId(slot.id);
    setSlotType(slot.type);
    setStartTime(slot.startTime);
    setEndTime(slot.endTime);
    setSlotFormError(null);
  }, []);

  const deleteSlot = (id: string) => {
    setProgramForm(prev => ({...prev, programSpecificSlots: (prev.programSpecificSlots || []).filter(s => s.id !== id)}));
    if (editingSlotId === id) resetSlotManagerForm();
  };
  
  const getSystemDefaultSlotsForTemplate = (): DefaultTimeSlot[] => {
    const savedSlotsJson = localStorage.getItem('defaultTimeSlots');
    if (savedSlotsJson) {
        try {
            const rawSlots = JSON.parse(savedSlotsJson);
            if (Array.isArray(rawSlots)) {
                return rawSlots;
            }
        } catch (e) { console.error("Could not parse default slots for template:", e); }
    }
    return SEED_DEFAULT_SLOTS_DATA.map(s => ({...s, id: `seed-${Math.random()}`}));
  };

  const handleLoadTemplate = () => {
    const systemSlots = getSystemDefaultSlotsForTemplate();
    const currentSlots = programForm.programSpecificSlots || [];
    
    const newSlotsToAdd = systemSlots.filter(
        systemSlot => !currentSlots.some(
            progSlot => progSlot.type === systemSlot.type && progSlot.startTime === systemSlot.startTime && progSlot.endTime === systemSlot.endTime
        )
    ).map(s => ({...s, id: `prog-slot-${Date.now()}-${Math.random()}`}));

    if (newSlotsToAdd.length > 0) {
        setProgramForm(prev => ({...prev, programSpecificSlots: [...currentSlots, ...newSlotsToAdd].sort(sortSlotsByTypeThenTime)}));
        setSlotSaveSuccessMessage(`${newSlotsToAdd.length} template slot(s) loaded.`);
    } else {
        setSlotFormError("All template slots are already in the list.");
    }
    setTimeout(() => {
      setSlotSaveSuccessMessage(null);
      setSlotFormError(null);
    }, 2500);
  };


  const filteredPrograms = useMemo(() => {
    return programs
      .filter(p => {
        const searchTermLower = searchTerm.toLowerCase();
        return (p.fullName.toLowerCase().includes(searchTermLower) || p.shortName.toLowerCase().includes(searchTermLower) || p.pId.toLowerCase().includes(searchTermLower)) &&
               (selectedFaculties.length === 0 || selectedFaculties.includes(p.faculty));
      })
      .sort((a,b) => a.pId.localeCompare(b.pId, undefined, { numeric: true }));
  }, [programs, searchTerm, selectedFaculties]);

  const uniqueFaculties = useMemo(() => [...new Set(programs.map(p => p.faculty))].sort(), [programs]);

  const filteredSlots = useMemo(() => {
    const slots = programForm.programSpecificSlots || [];
    if (slotFilterTab === 'All') return slots;
    return slots.filter(s => s.type === slotFilterTab);
  }, [programForm.programSpecificSlots, slotFilterTab]);
  
  const semesterDropdownItemsForSearchable = useMemo(() => {
    return configuredSemesters.map(sem => ({
      id: sem, 
      pId: '', 
      shortName: sem, 
      fullName: '', 
      faculty: '', 
      type: 'Undergraduate' as ProgramType, 
      semesterSystem: 'Tri-Semester' as SemesterSystem, 
      programSpecificSlots: []
    }));
  }, [configuredSemesters]);


  return (
    <div className="p-1 sm:p-1.5 rounded-md bg-slate-100 flex flex-col h-full relative">
      <div className="flex-shrink-0 space-y-2 mb-2">
        <div>
            <SearchableProgramDropdown
                programs={semesterDropdownItemsForSearchable}
                selectedProgramId={selectedSemesterIdForRoutineView}
                onProgramSelect={setSelectedSemesterIdForRoutineView}
                placeholderText="All Semesters"
                showAllProgramsListItem={true}
                allProgramsListItemText="-- All Semesters --"
                buttonClassName="w-full flex items-center justify-between p-1.5 text-sm border border-gray-300 rounded-md shadow-sm focus:ring-teal-500 focus:border-teal-500"
            />
        </div>

        <div>
             <div className="flex items-center gap-1 p-0.5 bg-gray-200 rounded-lg">
              {(['All', 'Theory', 'Lab'] as const).map(tab => (
                  <button
                      key={tab}
                      onClick={() => setActiveGridDisplayType(tab)}
                      className={`w-full px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                          activeGridDisplayType === tab ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-600 hover:bg-gray-100'
                      }`}
                  >
                      {tab}
                  </button>
              ))}
            </div>
        </div>

        <div>
            <select onChange={(e) => setSelectedFaculties(e.target.value ? [e.target.value] : [])} className="w-full p-1.5 text-sm border border-gray-300 rounded-md shadow-sm focus:ring-teal-500 focus:border-teal-500">
              <option value="">All Faculties</option>
              {uniqueFaculties.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
        </div>

        <div>
            <input
              type="search"
              placeholder="Search programs by P-ID, name, or short name..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full p-1.5 text-sm border border-gray-300 rounded-md shadow-sm focus:ring-teal-500 focus:border-teal-500"
            />
        </div>
      </div>

      <div className="flex-grow min-h-0 overflow-y-auto custom-scrollbar pr-1 -mr-1 space-y-2">
        {programsLoading ? <p>Loading programs...</p> : filteredPrograms.map(program => (
          <div key={program.id} 
            className={`p-2 rounded-lg bg-white shadow-sm border flex items-center justify-between cursor-pointer transition-all duration-150 ${activeProgramIdInMainView === program.id ? 'border-teal-400 ring-2 ring-teal-200' : 'border-gray-200 hover:border-gray-300 hover:shadow-md'}`}
            onClick={() => onShowProgramDetailView?.(program.id)}
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-teal-700 truncate">{program.pId} - {program.shortName}</p>
              <p className="text-xs text-gray-500 truncate">{program.fullName}</p>
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={openAddProgramModal}
        disabled={!user?.programManagementAccess?.canAddProgram}
        className="absolute bottom-4 right-4 bg-teal-600 hover:bg-teal-700 text-white font-semibold p-3 rounded-full shadow-lg transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 z-10 disabled:bg-gray-400 disabled:cursor-not-allowed"
        aria-label="Add New Program"
        title={!user?.programManagementAccess?.canAddProgram ? "You do not have permission to add programs" : "Add New Program"}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
        </svg>
      </button>
      <Modal isOpen={isFormModalOpen} onClose={resetProgramFormAndCloseModal} title={editingProgram ? 'Edit Program' : 'Add New Program'}>
        <div className="space-y-6">
          <fieldset className="border border-gray-300 p-3 rounded-md">
            <legend className="text-sm font-medium text-gray-700 px-1">Program Details</legend>
            <div className="mt-2 space-y-4">
              <input type="text" placeholder="Faculty" value={programForm.faculty} onChange={e => setProgramForm({...programForm, faculty: e.target.value})} className="w-full p-2 border rounded" />
              <input type="text" placeholder="Program ID (e.g., 15)" value={programForm.pId} onChange={e => setProgramForm({...programForm, pId: e.target.value})} className="w-full p-2 border rounded" />
              <input type="text" placeholder="Full Program Name" value={programForm.fullName} onChange={e => setProgramForm({...programForm, fullName: e.target.value})} className="w-full p-2 border rounded" />
              <input type="text" placeholder="Short Name (e.g., B.Sc. in CSE)" value={programForm.shortName} onChange={e => setProgramForm({...programForm, shortName: e.target.value})} className="w-full p-2 border rounded" />
              <select value={programForm.type} onChange={e => setProgramForm({...programForm, type: e.target.value as ProgramType})} className="w-full p-2 border rounded">
                  {PROGRAM_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
              </select>
              <select value={programForm.semesterSystem} onChange={e => setProgramForm({...programForm, semesterSystem: e.target.value as SemesterSystem})} className="w-full p-2 border rounded">
                  {SEMESTER_SYSTEMS.map(sys => <option key={sys} value={sys}>{sys}</option>)}
              </select>
            </div>
          </fieldset>
          
          <fieldset className="border border-gray-300 p-3 rounded-md">
            <legend className="text-sm font-medium text-gray-700 px-1">Active Days</legend>
            <div className="mt-2">
                <DaySelector days={DAYS_OF_WEEK} selectedDays={programForm.activeDays || []} onDayClick={(day) => setProgramForm({ ...programForm, activeDays: (programForm.activeDays || []).includes(day) ? (programForm.activeDays || []).filter(d => d !== day) : [...(programForm.activeDays || []), day] })}/>
            </div>
          </fieldset>

          <fieldset className="border border-gray-300 p-3 rounded-md">
            <legend className="text-sm font-medium text-gray-700 px-1">Program-Specific Time Slots</legend>
            <div className="mt-2">
                {/* FORM ON TOP */}
                <div className="flex-shrink-0 p-3 bg-gray-50 rounded-lg border border-gray-200 shadow-sm">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Add New Program Slot</h3>
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="flex-grow min-w-[150px]">
                      <label htmlFor="slotType-program" className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                      <select id="slotType-program" value={slotType ?? ""} onChange={e => setSlotType(e.target.value as 'Theory'|'Lab'|null)} className="w-full p-1.5 rounded-md text-xs border-gray-300 shadow-sm focus:ring-teal-500 focus:border-teal-500 h-9 bg-teal-50/50">
                        <option value="" disabled>Select Type...</option>
                        <option value="Theory">Theory</option>
                        <option value="Lab">Lab</option>
                      </select>
                    </div>
                    <div className="flex-grow min-w-[120px]">
                      <label htmlFor="startTime-program" className="block text-xs font-medium text-gray-700 mb-1">Start Time</label>
                       <div className="relative">
                        <input id="startTime-program" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full p-1.5 pr-8 rounded-md text-xs border-gray-300 shadow-sm focus:ring-teal-500 focus:border-teal-500 h-9 bg-teal-50/50"/>
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                            <svg className="h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.414-1.415L11 9.586V6z" clipRule="evenodd" /></svg>
                        </div>
                      </div>
                    </div>
                    <div className="flex-grow min-w-[120px]">
                      <label htmlFor="endTime-program" className="block text-xs font-medium text-gray-700 mb-1">End Time</label>
                       <div className="relative">
                        <input id="endTime-program" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full p-1.5 pr-8 rounded-md text-xs border-gray-300 shadow-sm focus:ring-teal-500 focus:border-teal-500 h-9 bg-teal-50/50"/>
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                            <svg className="h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.414-1.415L11 9.586V6z" clipRule="evenodd" /></svg>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {editingSlotId && (
                            <button onClick={resetSlotManagerForm} className="px-4 py-2 bg-gray-200 text-gray-700 text-xs font-medium rounded-md hover:bg-gray-300">Cancel</button>
                        )}
                        <button onClick={handleSlotSubmit} className="px-4 py-2 bg-teal-600 text-white text-xs font-semibold rounded-md hover:bg-teal-700 transition-colors">
                            {editingSlotId ? 'Update Slot' : 'Add Slot'}
                        </button>
                    </div>
                  </div>
                  {slotFormError && <p className="text-xs text-red-600 mt-2">{slotFormError}</p>}
                </div>
                
                {/* LIST BELOW */}
                <div className="flex-grow flex flex-col min-h-0 bg-gray-50 p-3 rounded-lg border border-gray-200 shadow-sm mt-4">
                  <div className="flex-shrink-0 flex items-center justify-between border-b pb-2 mb-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-700">Program Slots</h3>
                      <div className="flex space-x-1">
                          {(['All', 'Theory', 'Lab'] as ProgramSlotFilterType[]).map(tab => (
                              <button key={tab} onClick={() => setSlotFilterTab(tab)} className={`px-2 py-1 text-xs rounded-md flex items-center gap-1.5 ${slotFilterTab === tab ? 'bg-teal-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>{tab} <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${slotFilterTab === tab ? 'bg-white text-teal-600' : 'bg-gray-400 text-white'}`}>{(programForm.programSpecificSlots || []).filter(s => tab === 'All' || s.type === tab).length}</span></button>
                          ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {slotSaveSuccessMessage && <p className="text-xs text-green-600 animate-pulse">{slotSaveSuccessMessage}</p>}
                        <button onClick={handleLoadTemplate} className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-md hover:bg-blue-700 flex items-center justify-center gap-1">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                            Load Template
                        </button>
                    </div>
                  </div>
                  <div className="flex-grow overflow-y-auto custom-scrollbar pr-2 -mr-2 space-y-1.5 max-h-56">
                    {filteredSlots.length > 0 ? filteredSlots.map(slot => (
                        <div key={slot.id} className="flex items-center p-1.5 rounded-md bg-white border cursor-pointer hover:bg-teal-50/50" onClick={() => handleLoadSlotForEdit(slot)}><div className={`font-semibold text-xs w-12 ${slot.type === 'Lab' ? 'text-blue-600' : 'text-green-600'}`}>{slot.type}</div><div className="flex-grow text-center text-xs text-gray-700">{formatTimeToAMPM(slot.startTime)} - {formatTimeToAMPM(slot.endTime)}</div><div className="text-xs text-gray-500 w-16 text-right">({calculateDuration(slot.startTime, slot.endTime)} min)</div><button onClick={(e) => { e.stopPropagation(); deleteSlot(slot.id); }} className="ml-2 p-1 text-red-500 hover:bg-red-100 rounded-full"><svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg></button></div>
                    )) : (
                        <div className="text-center text-xs text-gray-500 italic py-6">No slots for this filter.</div>
                    )}
                  </div>
                </div>
            </div>
          </fieldset>


          {programFormError && <p className="text-red-500 text-sm mt-2">{programFormError}</p>}
          {submissionStatus && <p className={`text-sm mt-2 ${submissionStatus.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>{submissionStatus.message}</p>}

          <div className="flex justify-end gap-3 pt-4 border-t mt-4">
              <button onClick={resetProgramFormAndCloseModal} className="px-4 py-2 bg-gray-200 rounded-md">Cancel</button>
              <button onClick={handleProgramSubmit} className="px-4 py-2 bg-teal-600 text-white rounded-md">{editingProgram ? 'Update Program' : 'Add Program'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
export default ProgramFacultySetup;