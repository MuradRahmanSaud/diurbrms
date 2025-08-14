
import React, { createContext, useState, useEffect, useCallback, useContext, ReactNode } from 'react';
import { ProgramEntry, ProgramType, SemesterSystem, DefaultTimeSlot } from '../types';
import { DEFAULT_PROGRAMS_SEED_DATA, PROGRAM_TYPES, SEMESTER_SYSTEMS } from '../data/programConstants';
import { SEED_DEFAULT_SLOTS_DATA, sortSlotsByTypeThenTime } from '../data/slotConstants';
import { DAYS_OF_WEEK } from '../data/routineConstants';

// Helper to map old semester system strings to the new SemesterSystem type
const mapOldSemesterSystem = (oldSystem: string | undefined): SemesterSystem => {
    if (!oldSystem) return SEMESTER_SYSTEMS[0]; // Default if undefined
    if (SEMESTER_SYSTEMS.includes(oldSystem as SemesterSystem)) return oldSystem as SemesterSystem;
    // Handle specific old values if necessary (example)
    if (oldSystem === 'Trimester (3/year)') return 'Tri-Semester';
    if (oldSystem === 'Bi-Semester (Odd/Even)' || oldSystem === 'Semester (2/year)') return 'Bi-Semester';
    return SEMESTER_SYSTEMS[0]; // Fallback to a default
};

const naturalSortByPId = (a: ProgramEntry, b: ProgramEntry) => {
  return (a.pId || '').localeCompare(b.pId || '', undefined, { numeric: true, sensitivity: 'base' });
};

// P-IDs for which programSpecificSlots should be seeded with defaults if empty
const TARGET_P_IDS_FOR_DEFAULT_SLOT_SEEDING = ['10', '11', '12', '15', '35', '44', '51', '27', '60', '61'];

interface ProgramContextType {
  programs: ProgramEntry[];
  loading: boolean;
  error: string | null;
  addProgram: (programData: Omit<ProgramEntry, 'id'>) => Promise<ProgramEntry>;
  updateProgram: (program: ProgramEntry) => Promise<ProgramEntry>;
  deleteProgram: (programId: string) => Promise<void>;
  getProgramById: (programId: string) => ProgramEntry | undefined;
}

const ProgramContext = createContext<ProgramContextType | undefined>(undefined);

export const ProgramProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [programs, setPrograms] = useState<ProgramEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const RBRMS_PROGRAMS_KEY = 'rbrms-programs';

  // Function to prepare default slots (from localStorage or seed)
  const getPreparedDefaultSlots = (): DefaultTimeSlot[] => {
    let defaultSlotsToUse: DefaultTimeSlot[] = [];
    const savedDefaultSlotsJson = localStorage.getItem('defaultTimeSlots');

    if (savedDefaultSlotsJson) {
        try {
            const rawSlots = JSON.parse(savedDefaultSlotsJson);
            if (Array.isArray(rawSlots)) {
                const validatedSlots: DefaultTimeSlot[] = rawSlots
                    .map((slot: any, index: number): DefaultTimeSlot | null => {
                        const typeIsValid = slot.type === 'Theory' || slot.type === 'Lab';
                        if (
                            typeof slot.id === 'string' && // Original ID is fine for template, new one for program
                            typeIsValid &&
                            typeof slot.startTime === 'string' &&
                            typeof slot.endTime === 'string'
                        ) {
                            return { // We only need type, startTime, endTime from template
                                id: `default-template-${index}-${Date.now()}`, // Temporary ID for template
                                type: slot.type as 'Theory' | 'Lab', 
                                startTime: slot.startTime,
                                endTime: slot.endTime,
                            };
                        }
                        return null; 
                    })
                    .filter((slot): slot is DefaultTimeSlot => slot !== null);

                if (validatedSlots.length > 0) {
                    defaultSlotsToUse = validatedSlots;
                } else if (rawSlots.length === 0) {
                    // User explicitly saved an empty list of defaults, so use empty.
                    defaultSlotsToUse = [];
                }
            }
        } catch (e) {
            console.warn("Failed to parse defaultTimeSlots from localStorage, will use seed if necessary:", e);
        }
    }

    // If defaultSlotsToUse is still empty (e.g. localStorage issue, or it was truly empty and we want seed fallback)
    if (defaultSlotsToUse.length === 0 && !(savedDefaultSlotsJson && JSON.parse(savedDefaultSlotsJson).length === 0)) {
        defaultSlotsToUse = SEED_DEFAULT_SLOTS_DATA.map((slot, index) => ({
            ...slot,
            id: `seed-template-${index}-${Date.now()}` // Temporary ID for template
        }));
    }
    
    return defaultSlotsToUse.sort(sortSlotsByTypeThenTime);
  };


  // Load programs from localStorage or seed data
  useEffect(() => {
    setLoading(true);
    try {
      const savedProgramsJson = localStorage.getItem(RBRMS_PROGRAMS_KEY);
      let initialPrograms: ProgramEntry[] = [];
      const defaultActiveDays = DAYS_OF_WEEK.filter(d => d !== 'Friday');

      if (savedProgramsJson) {
        const parsedRaw = JSON.parse(savedProgramsJson);
        if (Array.isArray(parsedRaw)) {
             initialPrograms = parsedRaw.map((p: any, index: number) => ({
                faculty: String(p.faculty || ''),
                pId: String(p.pId || ''),
                fullName: String(p.fullName || ''),
                shortName: String(p.shortName || ''),
                type: PROGRAM_TYPES.includes(p.type) ? p.type : PROGRAM_TYPES[0],
                id: typeof p.id === 'string' ? p.id : `generated-${Date.now()}-${index}`,
                semesterSystem: mapOldSemesterSystem(p.semesterSystem),
                programSpecificSlots: (Array.isArray(p.programSpecificSlots) ? p.programSpecificSlots : []).sort(sortSlotsByTypeThenTime),
                activeDays: Array.isArray(p.activeDays) && p.activeDays.length > 0 ? p.activeDays : defaultActiveDays,
            }));
        } else {
            // Data is malformed, use seed
            initialPrograms = DEFAULT_PROGRAMS_SEED_DATA.map((p, index) => ({
                ...p,
                id: `seed-${Date.now()}-${index}`,
                programSpecificSlots: (p.programSpecificSlots || []).sort(sortSlotsByTypeThenTime)
            }));
        }
      } else {
        // No data in localStorage, use seed
        initialPrograms = DEFAULT_PROGRAMS_SEED_DATA.map((p, index) => ({
            ...p,
            id: `seed-${Date.now()}-${index}`,
            programSpecificSlots: (p.programSpecificSlots || []).sort(sortSlotsByTypeThenTime)
        }));
      }

      // --- Auto-populate programSpecificSlots for target P-IDs if empty ---
      const systemDefaultSlots = getPreparedDefaultSlots();
      if (systemDefaultSlots.length > 0) {
        initialPrograms = initialPrograms.map(program => {
          if (TARGET_P_IDS_FOR_DEFAULT_SLOT_SEEDING.includes(program.pId) && 
              (!program.programSpecificSlots || program.programSpecificSlots.length === 0)) {
            
            const newProgramSlots = systemDefaultSlots.map((sds, sIdx) => ({
              ...sds, // spread type, startTime, endTime
              id: `prog-slot-${program.id}-${Date.now()}-${sIdx}-${Math.random().toString(16).substring(2)}` // NEW unique ID for this program's slot
            }));
            
            return {
              ...program,
              programSpecificSlots: newProgramSlots.sort(sortSlotsByTypeThenTime)
            };
          }
          return program;
        });
      }
      // --- End auto-population ---

      setPrograms(initialPrograms.sort(naturalSortByPId));
    } catch (e: any) {
      console.error("Failed to load programs:", e);
      setError(`Failed to load programs: ${e.message}. Using default data.`);
      // Fallback to seed data on error
      const seedPrograms = DEFAULT_PROGRAMS_SEED_DATA.map((p, index) => ({
        ...p,
        id: `seed-error-${Date.now()}-${index}`,
        programSpecificSlots: (p.programSpecificSlots || []).sort(sortSlotsByTypeThenTime)
      }));
      setPrograms(seedPrograms.sort(naturalSortByPId));
    } finally {
      setLoading(false);
    }
  }, []); // Removed getPreparedDefaultSlots from dependency array as it's stable

  // Save programs to localStorage whenever they change
  useEffect(() => {
    if (!loading) { // Only save after initial load is complete
      try {
        localStorage.setItem(RBRMS_PROGRAMS_KEY, JSON.stringify(programs));
      } catch (e) {
        console.error("Failed to save programs to localStorage:", e);
        alert("Could not save program data. Your browser storage might be full.");
      }
    }
  }, [programs, loading]);

  const addProgram = useCallback(async (programData: Omit<ProgramEntry, 'id'>): Promise<ProgramEntry> => {
    return new Promise((resolve, reject) => {
        if (programs.some(p => p.pId === programData.pId)) {
            reject(new Error('Program with this P-ID already exists.'));
            return;
        }
        const newProgram: ProgramEntry = {
            ...programData,
            id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            programSpecificSlots: (programData.programSpecificSlots || []).sort(sortSlotsByTypeThenTime),
        };
        setPrograms(prev => [...prev, newProgram].sort(naturalSortByPId));
        resolve(newProgram);
    });
  }, [programs]);

  const updateProgram = useCallback(async (updatedProgram: ProgramEntry): Promise<ProgramEntry> => {
     return new Promise((resolve, reject) => {
        if (programs.some(p => p.pId === updatedProgram.pId && p.id !== updatedProgram.id)) {
            reject(new Error('Another program with this P-ID already exists.'));
            return;
        }
        const updatedProgramWithSortedSlots = {
            ...updatedProgram,
            programSpecificSlots: (updatedProgram.programSpecificSlots || []).sort(sortSlotsByTypeThenTime),
        };
        setPrograms(prev => prev.map(p => p.id === updatedProgram.id ? updatedProgramWithSortedSlots : p)
                                .sort(naturalSortByPId));
        resolve(updatedProgramWithSortedSlots);
    });
  }, [programs]);

  const deleteProgram = useCallback(async (programId: string): Promise<void> => {
    return new Promise((resolve) => {
        setPrograms(prev => prev.filter(p => p.id !== programId));
        resolve();
    });
  }, []);
  
  const getProgramById = useCallback((programId: string): ProgramEntry | undefined => {
    return programs.find(p => p.id === programId);
  }, [programs]);

  return (
    <ProgramContext.Provider value={{ programs, loading, error, addProgram, updateProgram, deleteProgram, getProgramById }}>
      {children}
    </ProgramContext.Provider>
  );
};

export const usePrograms = (): ProgramContextType => {
  const context = useContext(ProgramContext);
  if (context === undefined) {
    throw new Error('usePrograms must be used within a ProgramProvider');
  }
  return context;
};
