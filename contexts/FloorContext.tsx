import React, { createContext, useState, useEffect, useCallback, useContext, ReactNode } from 'react';
import { FloorEntry } from '../types';
import { api } from '../services/api';

interface FloorContextType {
  floors: FloorEntry[];
  loading: boolean;
  error: string | null;
  getFloorsByBuildingId: (buildingId: string) => FloorEntry[];
  addFloor: (floorData: Omit<FloorEntry, 'id'>) => Promise<FloorEntry>;
  updateFloor: (floor: FloorEntry) => Promise<FloorEntry>;
  deleteFloor: (floorId: string) => Promise<void>;
  getFloorById: (floorId: string) => FloorEntry | undefined;
}

const FloorContext = createContext<FloorContextType | undefined>(undefined);

export const FloorProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [floors, setFloors] = useState<FloorEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAndSetFloors = async () => {
        setLoading(true);
        setError(null);
        try {
            const fetchedFloors = await api.fetchFloors();
            setFloors(fetchedFloors.sort((a,b) => a.floorName.localeCompare(b.floorName)));
        } catch (e: any) {
            console.error("Failed to load floors:", e);
            setError(`Failed to load floors: ${e.message}.`);
        } finally {
            setLoading(false);
        }
    };
    fetchAndSetFloors();
  }, []);

  const getFloorsByBuildingId = useCallback((buildingId: string) => {
    return floors.filter(f => f.buildingId === buildingId).sort((a,b) => a.floorName.localeCompare(b.floorName));
  }, [floors]);

  const addFloor = useCallback(async (floorData: Omit<FloorEntry, 'id'>): Promise<FloorEntry> => {
    // In a real app: const newFloor = await api.addFloor(floorData);
    if (!floorData.buildingId || !floorData.floorName) {
        throw new Error('Building ID and Floor Name are required.');
    }
    if (floors.some(f => f.buildingId === floorData.buildingId && f.floorName.toLowerCase() === floorData.floorName.toLowerCase())) {
      throw new Error(`Floor "${floorData.floorName}" already exists in this building.`);
    }
    const newFloor: FloorEntry = { ...floorData, id: `temp-floor-${Date.now()}` };
    setFloors(prev => [...prev, newFloor].sort((a,b) => a.floorName.localeCompare(b.floorName)));
    return newFloor;
  }, [floors]);

  const updateFloor = useCallback(async (updatedFloor: FloorEntry): Promise<FloorEntry> => {
    // await api.updateFloor(updatedFloor);
    setFloors(prev => prev.map(f => f.id === updatedFloor.id ? updatedFloor : f).sort((a,b) => a.floorName.localeCompare(b.floorName)));
    return updatedFloor;
  }, []);

  const deleteFloor = useCallback(async (floorId: string): Promise<void> => {
    // await api.deleteFloor(floorId);
    setFloors(prev => prev.filter(f => f.id !== floorId));
  }, []);
  
  const getFloorById = useCallback((floorId: string): FloorEntry | undefined => {
    return floors.find(f => f.id === floorId);
  }, [floors]);

  return (
    <FloorContext.Provider value={{ floors, loading, error, getFloorsByBuildingId, addFloor, updateFloor, deleteFloor, getFloorById }}>
      {children}
    </FloorContext.Provider>
  );
};

export const useFloors = (): FloorContextType => {
  const context = useContext(FloorContext);
  if (context === undefined) {
    throw new Error('useFloors must be used within a FloorProvider');
  }
  return context;
};
