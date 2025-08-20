import React, { createContext, useState, useEffect, useCallback, useContext, ReactNode } from 'react';
import { RoomTypeEntry } from '../types';
import { api } from '../services/api';

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
    const fetchAndSetData = async () => {
        setLoading(true);
        setError(null);
        try {
            const fetchedData = await api.fetchRoomTypes();
            setRoomTypes(fetchedData.sort((a,b) => a.typeName.localeCompare(b.typeName)));
        } catch (e: any) {
            setError(`Failed to load room types: ${e.message}.`);
            console.error(e);
        } finally {
            setLoading(false);
        }
    };
    fetchAndSetData();
  }, []);

  const addRoomType = useCallback(async (roomTypeData: Omit<RoomTypeEntry, 'id'>): Promise<RoomTypeEntry> => {
    // In a real app: const newRoomType = await api.addRoomType(roomTypeData);
    if (roomTypes.some(rt => rt.typeName.toLowerCase() === roomTypeData.typeName.toLowerCase())) {
        throw new Error(`Room Type "${roomTypeData.typeName}" already exists.`);
    }
    const newRoomType: RoomTypeEntry = { ...roomTypeData, id: `temp-type-${Date.now()}` };
    setRoomTypes(prev => [...prev, newRoomType].sort((a,b) => a.typeName.localeCompare(b.typeName)));
    return newRoomType;
  }, [roomTypes]);

  const updateRoomType = useCallback(async (updatedRoomType: RoomTypeEntry): Promise<RoomTypeEntry> => {
    // await api.updateRoomType(updatedRoomType);
    setRoomTypes(prev => prev.map(rt => rt.id === updatedRoomType.id ? updatedRoomType : rt).sort((a,b) => a.typeName.localeCompare(b.typeName)));
    return updatedRoomType;
  }, []);

  const deleteRoomType = useCallback(async (roomTypeId: string): Promise<void> => {
    // await api.deleteRoomType(roomTypeId);
    setRoomTypes(prev => prev.filter(rt => rt.id !== roomTypeId));
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
