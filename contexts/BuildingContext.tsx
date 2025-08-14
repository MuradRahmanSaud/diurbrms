
import React, { createContext, useState, useEffect, useCallback, useContext, ReactNode } from 'react';
import { BuildingEntry } from '../types';

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

export const RBRMS_BUILDINGS_KEY = 'rbrms-buildings';

// Placeholder Base64 image data (tiny 1x1 pixel PNGs)
const PLACEHOLDER_IMG_1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='; // Transparent
const PLACEHOLDER_IMG_2 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='; // Red


// Sample seed data (can be empty if not needed for initial setup)
const SEED_BUILDINGS_DATA: Omit<BuildingEntry, 'id'>[] = [
  { campusName: "Daffodil Smart City", buildingName: "Knowledge Tower", buildingShortName: "KT", address: "Daffodil Smart City, Birulia,Savar, Dhaka-1216", squareFeet: undefined, thumbnailUrl: PLACEHOLDER_IMG_1 },
  { campusName: "Daffodil Smart City", buildingName: "Inspiration Building", buildingShortName: "IB", address: "Daffodil Smart City, Birulia,Savar, Dhaka-1216", squareFeet: undefined, thumbnailUrl: PLACEHOLDER_IMG_2 },
  // { campusName: "Main Campus", buildingName: "Admin Building", address: "123 University Ave, Cityville", squareFeet: 50000, thumbnailUrl: '' },
  // { campusName: "Tech Park", buildingName: "Innovation Hub", address: "456 Tech Road, Cityville", squareFeet: 75000, thumbnailUrl: '' },
];

export const BuildingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [buildings, setBuildings] = useState<BuildingEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    try {
      const savedBuildingsJson = localStorage.getItem(RBRMS_BUILDINGS_KEY);
      let initialBuildings: BuildingEntry[] = [];

      if (savedBuildingsJson) {
        const parsedRaw = JSON.parse(savedBuildingsJson);
        if (Array.isArray(parsedRaw)) {
          initialBuildings = parsedRaw.map((b: any, index: number) => ({
            id: typeof b.id === 'string' ? b.id : `generated-${Date.now()}-${index}`,
            campusName: String(b.campusName || ''),
            buildingName: String(b.buildingName || ''),
            buildingShortName: String(b.buildingShortName || ''),
            address: String(b.address || ''),
            thumbnailUrl: String(b.thumbnailUrl || ''), // Ensure thumbnailUrl is a string
            squareFeet: typeof b.squareFeet === 'number' ? b.squareFeet : undefined,
          }));
        } else {
          // Data is malformed, use seed (or empty if no seed)
           initialBuildings = SEED_BUILDINGS_DATA.map((b, index) => ({
            ...b,
            id: `seed-${Date.now()}-${index}`,
            // thumbnailUrl is already in SEED_BUILDINGS_DATA
          }));
        }
      } else {
        // No data in localStorage, use seed (or empty if no seed)
         initialBuildings = SEED_BUILDINGS_DATA.map((b, index) => ({
          ...b,
          id: `seed-${Date.now()}-${index}`,
           // thumbnailUrl is already in SEED_BUILDINGS_DATA
        }));
      }
      setBuildings(initialBuildings.sort((a, b) => (a.buildingName || '').localeCompare(b.buildingName || '')));
    } catch (e: any) {
      console.error("Failed to load buildings:", e);
      setError(`Failed to load buildings: ${e.message}. Using default data.`);
      const seedData = SEED_BUILDINGS_DATA.map((b, index) => ({
        ...b,
        id: `seed-error-${Date.now()}-${index}`,
        // thumbnailUrl is already in SEED_BUILDINGS_DATA
      }));
      setBuildings(seedData.sort((a, b) => (a.buildingName || '').localeCompare(b.buildingName || '')));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loading) {
      try {
        localStorage.setItem(RBRMS_BUILDINGS_KEY, JSON.stringify(buildings));
      } catch (e) {
        console.error("Failed to save buildings to localStorage:", e);
        alert("Could not save building data. Your browser storage might be full.");
      }
    }
  }, [buildings, loading]);

  const addBuilding = useCallback(async (buildingData: Omit<BuildingEntry, 'id'>): Promise<BuildingEntry> => {
    return new Promise((resolve, reject) => {
      // Validation is handled by the calling component (BuildingCampusSetup).
      // A basic check to ensure we have an object.
      if (!buildingData || !buildingData.buildingName) {
        reject(new Error('Invalid building data provided for creation.'));
        return;
      }
      const newBuilding: BuildingEntry = {
        ...buildingData,
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      };
      setBuildings(prev => [...prev, newBuilding].sort((a, b) => (a.buildingName || '').localeCompare(b.buildingName || '')));
      resolve(newBuilding);
    });
  }, []);

  const updateBuilding = useCallback(async (updatedBuilding: BuildingEntry): Promise<BuildingEntry> => {
    return new Promise((resolve, reject) => {
      // Validation is handled by the calling component (BuildingCampusSetup).
      // A basic check to ensure we have an object with an ID.
       if (!updatedBuilding || !updatedBuilding.id) {
        reject(new Error('Invalid building data provided for update.'));
        return;
      }
      setBuildings(prev => prev.map(b => b.id === updatedBuilding.id ? updatedBuilding : b)
                               .sort((a, b) => (a.buildingName || '').localeCompare(b.buildingName || '')));
      resolve(updatedBuilding);
    });
  }, []);

  const deleteBuilding = useCallback(async (buildingId: string): Promise<void> => {
    return new Promise((resolve) => {
      setBuildings(prev => prev.filter(b => b.id !== buildingId));
      resolve();
    });
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
