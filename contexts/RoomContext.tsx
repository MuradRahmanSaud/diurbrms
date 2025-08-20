import React, { createContext, useState, useEffect, useCallback, useContext, ReactNode } from 'react';
import { RoomEntry, DefaultTimeSlot } from '../types';
import { api } from '../services/api';
import { sortSlotsByTypeThenTime } from '../data/slotConstants';

interface RoomContextType {
  rooms: RoomEntry[];
  loading: boolean;
  error: string | null;
  getRoomsByBuildingId: (buildingId: string) => RoomEntry[];
  addRoom: (roomData: Omit<RoomEntry, 'id'>) => Promise<RoomEntry>;
  updateRoom: (room: RoomEntry) => Promise<RoomEntry>;
  deleteRoom: (roomId: string) => Promise<void>;
  getRoomById: (roomId: string) => RoomEntry | undefined;
}

const RoomContext = createContext<RoomContextType | undefined>(undefined);

export const RoomProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [rooms, setRooms] = useState<RoomEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchAndSetRooms = async () => {
        setLoading(true);
        setError(null);
        try {
            const fetchedRooms = await api.fetchRooms();
            setRooms(fetchedRooms.sort((a,b) => a.roomNumber.localeCompare(b.roomNumber)));
        } catch(e: any) {
            setError(`Failed to load rooms: ${e.message}`);
            console.error("Failed to load rooms from API", e);
        } finally {
            setLoading(false);
        }
    };
    fetchAndSetRooms();
  }, []);


  const getRoomsByBuildingId = useCallback((buildingId: string) => {
    return rooms.filter(r => r.buildingId === buildingId).sort((a,b) => a.roomNumber.localeCompare(b.roomNumber));
  }, [rooms]);

  const addRoom = useCallback(async (roomData: Omit<RoomEntry, 'id'>): Promise<RoomEntry> => {
    // In a real app: await api.addRoom(roomData);
    const newRoom: RoomEntry = { ...roomData, id: `temp-room-${Date.now()}` };
    setRooms(prev => [...prev, newRoom].sort((a,b) => a.roomNumber.localeCompare(b.roomNumber)));
    return newRoom;
  }, []);

  const updateRoom = useCallback(async (updatedRoom: RoomEntry): Promise<RoomEntry> => {
    // In a real app: await api.updateRoom(updatedRoom);
    setRooms(prev => prev.map(r => r.id === updatedRoom.id ? updatedRoom : r).sort((a,b) => a.roomNumber.localeCompare(b.roomNumber)));
    return updatedRoom;
  }, []);

  const deleteRoom = useCallback(async (roomId: string): Promise<void> => {
    // In a real app: await api.deleteRoom(roomId);
    setRooms(prev => prev.filter(r => r.id !== roomId));
  }, []);

  const getRoomById = useCallback((roomId: string): RoomEntry | undefined => {
    return rooms.find(r => r.id === roomId);
  }, [rooms]);


  return (
    <RoomContext.Provider value={{ rooms, loading, error, getRoomsByBuildingId, addRoom, updateRoom, deleteRoom, getRoomById }}>
      {children}
    </RoomContext.Provider>
  );
};

export const useRooms = (): RoomContextType => {
  const context = useContext(RoomContext);
  if (context === undefined) {
    throw new Error('useRooms must be used within a RoomProvider');
  }
  return context;
};
