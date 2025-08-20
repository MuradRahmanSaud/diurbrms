
import React, { createContext, useState, useEffect, useCallback, useContext, ReactNode } from 'react';
import { FloorEntry } from '../types';

export const RBRMS_FLOORS_KEY = 'rbrms-floors';

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
    setLoading(true);
    try {
      const savedFloorsJson = localStorage.getItem(RBRMS_FLOORS_KEY);
      let initialFloors: FloorEntry[] = [];
      if (savedFloorsJson) {
        const parsedRaw = JSON.parse(savedFloorsJson);
        if (Array.isArray(parsedRaw)) {
          initialFloors = parsedRaw.map((f: any, index: number) => ({
            id: typeof f.id === 'string' ? f.id : `generated-floor-${Date.now()}-${index}`,
            buildingId: String(f.buildingId || ''),
            floorName: String(f.floorName || ''),
          }));
        }
      }
      // No seed data for floors as they are building-specific.
      setFloors(initialFloors.sort((a,b) => a.floorName.localeCompare(b.floorName)));
    } catch (e: any) {
      console.error("Failed to load floors:", e);
      setError(`Failed to load floors: ${e.message}.`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loading) {
      try {
        localStorage.setItem(RBRMS_FLOORS_KEY, JSON.stringify(floors));
      } catch (e) {
        console.error("Failed to save floors to localStorage:", e);
        alert("Could not save floor data. Your browser storage might be full.");
      }
    }
  }, [floors, loading]);

  const getFloorsByBuildingId = useCallback((buildingId: string) => {
    return floors.filter(f => f.buildingId === buildingId).sort((a,b) => a.floorName.localeCompare(b.floorName));
  }, [floors]);

  const addFloor = useCallback(async (floorData: Omit<FloorEntry, 'id'>): Promise<FloorEntry> => {
    return new Promise((resolve, reject) => {
      if (!floorData.buildingId || !floorData.floorName) {
        reject(new Error('Building ID and Floor Name are required.'));
        return;
      }
      if (floors.some(f => f.buildingId === floorData.buildingId && f.floorName.toLowerCase() === floorData.floorName.toLowerCase())) {
        reject(new Error(`Floor "${floorData.floorName}" already exists in this building.`));
        return;
      }
      const newFloor: FloorEntry = {
        ...floorData,
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      };
      setFloors(prev => [...prev, newFloor].sort((a,b) => a.floorName.localeCompare(b.floorName)));
      resolve(newFloor);
    });
  }, [floors]);

  const updateFloor = useCallback(async (updatedFloor: FloorEntry): Promise<FloorEntry> => {
    return new Promise((resolve, reject) => {
      if (floors.some(f => f.buildingId === updatedFloor.buildingId && f.floorName.toLowerCase() === updatedFloor.floorName.toLowerCase() && f.id !== updatedFloor.id)) {
        reject(new Error(`Another floor with name "${updatedFloor.floorName}" already exists in this building.`));
        return;
      }
      setFloors(prev => prev.map(f => f.id === updatedFloor.id ? updatedFloor : f).sort((a,b) => a.floorName.localeCompare(b.floorName)));
      resolve(updatedFloor);
    });
  }, [floors]);

  const deleteFloor = useCallback(async (floorId: string): Promise<void> => {
    return new Promise((resolve) => {
      // TODO: Check if any rooms are associated with this floor before deleting.
      setFloors(prev => prev.filter(f => f.id !== floorId));
      resolve();
    });
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
