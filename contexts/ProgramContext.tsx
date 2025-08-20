import React, { createContext, useState, useEffect, useCallback, useContext, ReactNode } from 'react';
import { ProgramEntry } from '../types';
import { api } from '../services/api'; // Import the API service

const naturalSortByPId = (a: ProgramEntry, b: ProgramEntry) => {
  return (a.pId || '').localeCompare(b.pId || '', undefined, { numeric: true, sensitivity: 'base' });
};

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

  const fetchAndSetPrograms = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fetchedPrograms = await api.fetchPrograms();
      setPrograms(fetchedPrograms.sort(naturalSortByPId));
    } catch (e: any) {
      console.error("Failed to load programs:", e);
      setError(`Failed to load programs: ${e.message}.`);
      setPrograms([]); // Set to empty on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAndSetPrograms();
  }, [fetchAndSetPrograms]);
  
  const addProgram = useCallback(async (programData: Omit<ProgramEntry, 'id'>): Promise<ProgramEntry> => {
    // This would call api.addProgram in a real app. For now, we'll just optimistically update.
    const newProgram: ProgramEntry = { ...programData, id: `temp-${Date.now()}`};
    setPrograms(prev => [...prev, newProgram].sort(naturalSortByPId));
    return newProgram;
  }, []);

  const updateProgram = useCallback(async (updatedProgram: ProgramEntry): Promise<ProgramEntry> => {
    // api.updateProgram(updatedProgram);
    setPrograms(prev => prev.map(p => p.id === updatedProgram.id ? updatedProgram : p).sort(naturalSortByPId));
    return updatedProgram;
  }, []);

  const deleteProgram = useCallback(async (programId: string): Promise<void> => {
    // api.deleteProgram(programId);
    setPrograms(prev => prev.filter(p => p.id !== programId));
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
