import React, { createContext, useState, useEffect, useCallback, useContext, ReactNode } from 'react';
import { BuildingEntry } from '../types';
import { api } from '../services/api';

interface BuildingContextType {
  buildings: BuildingEntry[];
  loading: boolean;
  error: string | null;
  addBuilding: (buildingData: Omit<BuildingEntry, 'id'>) => Promise<BuildingEntry>;
  updateBuilding: (building: BuildingEntry) => Promise<BuildingEntry>;
  deleteBuilding: (buildingId: string) => Promise<void>;
  getBuildingById: (buildingId: string) => BuildingEntry | undefined;
}

const BuildingContext = createContext<BuildingContextType | undefined>(undefined);

export const BuildingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [buildings, setBuildings] = useState<BuildingEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAndSetBuildings = async () => {
        setLoading(true);
        setError(null);
        try {
            const fetchedBuildings = await api.fetchBuildings();
            setBuildings(fetchedBuildings.sort((a, b) => (a.buildingName || '').localeCompare(b.buildingName || '')));
        } catch (e: any) {
            console.error("Failed to load buildings:", e);
            setError(`Failed to load buildings: ${e.message}.`);
            setBuildings([]);
        } finally {
            setLoading(false);
        }
    };
    fetchAndSetBuildings();
  }, []);

  const addBuilding = useCallback(async (buildingData: Omit<BuildingEntry, 'id'>): Promise<BuildingEntry> => {
    // In a real app: const newBuilding = await api.addBuilding(buildingData);
    const newBuilding: BuildingEntry = { ...buildingData, id: `temp-bld-${Date.now()}` };
    setBuildings(prev => [...prev, newBuilding].sort((a, b) => (a.buildingName || '').localeCompare(b.buildingName || '')));
    return newBuilding;
  }, []);

  const updateBuilding = useCallback(async (updatedBuilding: BuildingEntry): Promise<BuildingEntry> => {
    // In a real app: await api.updateBuilding(updatedBuilding);
    setBuildings(prev => prev.map(b => b.id === updatedBuilding.id ? updatedBuilding : b)
                               .sort((a, b) => (a.buildingName || '').localeCompare(b.buildingName || '')));
    return updatedBuilding;
  }, []);

  const deleteBuilding = useCallback(async (buildingId: string): Promise<void> => {
    // In a real app: await api.deleteBuilding(buildingId);
    setBuildings(prev => prev.filter(b => b.id !== buildingId));
  }, []);

  const getBuildingById = useCallback((buildingId: string): BuildingEntry | undefined => {
    return buildings.find(b => b.id === buildingId);
  }, [buildings]);

  return (
    <BuildingContext.Provider value={{ buildings, loading, error, addBuilding, updateBuilding, deleteBuilding, getBuildingById }}>
      {children}
    </BuildingContext.Provider>
  );
};

export const useBuildings = (): BuildingContextType => {
  const context = useContext(BuildingContext);
  if (context === undefined) {
    throw new Error('useBuildings must be used within a BuildingProvider');
  }
  return context;
};
