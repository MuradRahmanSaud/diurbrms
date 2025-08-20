
import React, { createContext, useState, useEffect, useCallback, useContext, ReactNode } from 'react';
import { RoomTypeEntry } from '../types';

export const RBRMS_ROOM_TYPES_KEY = 'rbrms-room-types';

const SEED_ROOM_TYPES: Omit<RoomTypeEntry, 'id'>[] = [
  { typeName: "Theory" },
  { typeName: "Lab" },
];

interface RoomTypeContextType {
  roomTypes: RoomTypeEntry[];
  loading: boolean;
  error: string | null;
  addRoomType: (roomTypeData: Omit<RoomTypeEntry, 'id'>) => Promise<RoomTypeEntry>;
  updateRoomType: (roomType: RoomTypeEntry) => Promise<RoomTypeEntry>;
  deleteRoomType: (roomTypeId: string) => Promise<void>;
  getRoomTypeById: (roomTypeId: string) => RoomTypeEntry | undefined;
}

const RoomTypeContext = createContext<RoomTypeContextType | undefined>(undefined);

export const RoomTypeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [roomTypes, setRoomTypes] = useState<RoomTypeEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    try {
      const savedRoomTypesJson = localStorage.getItem(RBRMS_ROOM_TYPES_KEY);
      let initialRoomTypes: RoomTypeEntry[] = [];
      if (savedRoomTypesJson) {
        const parsedRaw = JSON.parse(savedRoomTypesJson);
        if (Array.isArray(parsedRaw)) {
          initialRoomTypes = parsedRaw.map((rt: any, index: number) => ({
            id: typeof rt.id === 'string' ? rt.id : `generated-type-${Date.now()}-${index}`,
            typeName: String(rt.typeName || ''),
            // categoryId: String(rt.categoryId || ''), // If linking to category
          }));
        } else {
            initialRoomTypes = SEED_ROOM_TYPES.map((rt, index) => ({ ...rt, id: `seed-type-${Date.now()}-${index}` }));
        }
      } else {
        initialRoomTypes = SEED_ROOM_TYPES.map((rt, index) => ({ ...rt, id: `seed-type-${Date.now()}-${index}` }));
      }
      setRoomTypes(initialRoomTypes.sort((a,b) => a.typeName.localeCompare(b.typeName)));
    } catch (e: any) {
      console.error("Failed to load room types:", e);
      setError(`Failed to load room types: ${e.message}. Using seed data.`);
      setRoomTypes(SEED_ROOM_TYPES.map((rt, index) => ({ ...rt, id: `seed-type-error-${Date.now()}-${index}` })).sort((a,b) => a.typeName.localeCompare(b.typeName)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loading) {
      try {
        localStorage.setItem(RBRMS_ROOM_TYPES_KEY, JSON.stringify(roomTypes));
      } catch (e) {
        console.error("Failed to save room types to localStorage:", e);
        alert("Could not save room type data. Your browser storage might be full.");
      }
    }
  }, [roomTypes, loading]);

  const addRoomType = useCallback(async (roomTypeData: Omit<RoomTypeEntry, 'id'>): Promise<RoomTypeEntry> => {
     return new Promise((resolve, reject) => {
        if (!roomTypeData.typeName) {
            reject(new Error('Room Type Name is required.'));
            return;
        }
        if (roomTypes.some(rt => rt.typeName.toLowerCase() === roomTypeData.typeName.toLowerCase())) {
            reject(new Error(`Room Type "${roomTypeData.typeName}" already exists.`));
            return;
        }
        const newRoomType: RoomTypeEntry = {
            ...roomTypeData,
            id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        };
        setRoomTypes(prev => [...prev, newRoomType].sort((a,b) => a.typeName.localeCompare(b.typeName)));
        resolve(newRoomType);
    });
  }, [roomTypes]);

  const updateRoomType = useCallback(async (updatedRoomType: RoomTypeEntry): Promise<RoomTypeEntry> => {
    return new Promise((resolve, reject) => {
        if (roomTypes.some(rt => rt.typeName.toLowerCase() === updatedRoomType.typeName.toLowerCase() && rt.id !== updatedRoomType.id)) {
            reject(new Error(`Another room type with name "${updatedRoomType.typeName}" already exists.`));
            return;
        }
        setRoomTypes(prev => prev.map(rt => rt.id === updatedRoomType.id ? updatedRoomType : rt).sort((a,b) => a.typeName.localeCompare(b.typeName)));
        resolve(updatedRoomType);
    });
  }, [roomTypes]);

  const deleteRoomType = useCallback(async (roomTypeId: string): Promise<void> => {
    return new Promise((resolve) => {
      // TODO: Check if any rooms are associated with this type.
      setRoomTypes(prev => prev.filter(rt => rt.id !== roomTypeId));
      resolve();
    });
  }, []);
  
  const getRoomTypeById = useCallback((roomTypeId: string): RoomTypeEntry | undefined => {
    return roomTypes.find(rt => rt.id === roomTypeId);
  }, [roomTypes]);

  return (
    <RoomTypeContext.Provider value={{ roomTypes, loading, error, addRoomType, updateRoomType, deleteRoomType, getRoomTypeById }}>
      {children}
    </RoomTypeContext.Provider>
  );
};

export const useRoomTypes = (): RoomTypeContextType => {
  const context = useContext(RoomTypeContext);
  if (context === undefined) {
    throw new Error('useRoomTypes must be used within a RoomTypeProvider');
  }
  return context;
};
