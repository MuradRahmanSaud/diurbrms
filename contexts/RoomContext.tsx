import React, { createContext, useState, useEffect, useCallback, useContext, ReactNode } from 'react';
import { RoomEntry, FloorEntry, DefaultTimeSlot } from '../types'; // Added FloorEntry and DefaultTimeSlot
import { useBuildings } from './BuildingContext';
import { useFloors } from './FloorContext';
import { useRoomCategories } from './RoomCategoryContext';
import { useRoomTypes } from './RoomTypeContext';
import { usePrograms } from './ProgramContext';
import { SEED_DEFAULT_SLOTS_DATA, sortSlotsByTypeThenTime } from '../data/slotConstants';


export const RBRMS_ROOMS_KEY = 'rbrms-rooms';

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

const getSystemDefaultTimeSlotsObjects = (): DefaultTimeSlot[] => {
  const savedSlotsJson = localStorage.getItem('defaultTimeSlots');
  if (savedSlotsJson) {
      try {
          const rawSlots = JSON.parse(savedSlotsJson);
          if (Array.isArray(rawSlots)) {
              const validatedSlots: DefaultTimeSlot[] = rawSlots
                  .map((slot: any): DefaultTimeSlot | null => {
                      const typeIsValid = slot.type === 'Theory' || slot.type === 'Lab';
                      if (typeof slot.id === 'string' && typeIsValid && typeof slot.startTime === 'string' && slot.startTime.match(/^([01]\d|2[0-3]):([0-5]\d)$/) && typeof slot.endTime === 'string' && slot.endTime.match(/^([01]\d|2[0-3]):([0-5]\d)$/)) {
                          return { id: slot.id, type: slot.type as 'Theory' | 'Lab', startTime: slot.startTime, endTime: slot.endTime };
                      }
                      return null; 
                  })
                  .filter((slot): slot is DefaultTimeSlot => slot !== null);

              if (validatedSlots.length > 0) return validatedSlots.sort(sortSlotsByTypeThenTime);
              if (rawSlots.length === 0 && validatedSlots.length === 0) return []; 
          }
      } catch (e) { console.warn("Failed to parse defaultTimeSlots from localStorage, using seed data:", e); }
  }
  return SEED_DEFAULT_SLOTS_DATA.map((slot, index) => ({ ...slot, id: `seed-system-default-${Date.now()}-${index}-${Math.random().toString(16).substring(2)}` })).sort(sortSlotsByTypeThenTime);
};

export const RoomProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [rooms, setRooms] = useState<RoomEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  const { buildings, loading: buildingsLoading } = useBuildings();
  const { floors, addFloor, loading: floorsLoading } = useFloors();
  const { categories, loading: categoriesLoading } = useRoomCategories();
  const { roomTypes, loading: typesLoading } = useRoomTypes();
  const { programs, loading: programsLoading } = usePrograms();


  // This effect loads initial data from localStorage
  useEffect(() => {
    setLoading(true);
    setError(null);
    try {
      const savedRoomsJson = localStorage.getItem(RBRMS_ROOMS_KEY);
      let initialRooms: RoomEntry[] = [];
      if (savedRoomsJson) {
        const parsedRaw = JSON.parse(savedRoomsJson);
        if (Array.isArray(parsedRaw)) {
          initialRooms = parsedRaw.map((r: any, index: number) => ({
            id: typeof r.id === 'string' ? r.id : `generated-room-${Date.now()}-${index}`,
            buildingId: String(r.buildingId || ''),
            floorId: String(r.floorId || ''),
            categoryId: String(r.categoryId || ''),
            typeId: String(r.typeId || ''),
            roomNumber: String(r.roomNumber || ''),
            capacity: Number(r.capacity || 0),
            assignedToPId: typeof r.assignedToPId === 'string' ? r.assignedToPId : undefined,
            sharedWithPIds: Array.isArray(r.sharedWithPIds) ? r.sharedWithPIds.map(String) : [],
            roomSpecificSlots: (Array.isArray(r.roomSpecificSlots) ? r.roomSpecificSlots.map((slot: any): DefaultTimeSlot | null => {
                const typeIsValid = slot.type === 'Theory' || slot.type === 'Lab';
                if (typeof slot.id === 'string' && typeIsValid && typeof slot.startTime === 'string' && slot.startTime.match(/^([01]\d|2[0-3]):([0-5]\d)$/) && typeof slot.endTime === 'string' && slot.endTime.match(/^([01]\d|2[0-3]):([0-5]\d)$/)) {
                    return slot as DefaultTimeSlot;
                }
                return null;
            }).filter((slot: DefaultTimeSlot | null): slot is DefaultTimeSlot => slot !== null) : []).sort(sortSlotsByTypeThenTime),
            semesterId: r.semesterId,
          }));
        }
      }
      setRooms(initialRooms.sort((a,b) => a.roomNumber.localeCompare(b.roomNumber)));
    } catch (e: any) {
      console.error("Failed to load rooms:", e);
      setError(`Failed to load rooms: ${e.message}.`);
      setRooms([]);
    } finally {
        setLoading(false);
    }
  }, []);

  // One-time dummy room seeder
  useEffect(() => {
      const SEED_KEY = 'rbrms-dummy-rooms-seeded-v5';

      const isAlreadySeeded = localStorage.getItem(SEED_KEY) === 'true';
      const areDependenciesLoading = buildingsLoading || floorsLoading || categoriesLoading || typesLoading || programsLoading || loading;
      const haveDependenciesLoadedData = buildings.length > 0 && categories.length > 0 && roomTypes.length > 0 && programs.length > 0;

      if (isAlreadySeeded || areDependenciesLoading || !haveDependenciesLoadedData) {
          return;
      }

      const seedData = async () => {
          localStorage.setItem(SEED_KEY, 'true');
          console.log("RBRMS: Starting one-time dummy room seeding process (v5)...");

          try {
              // 1. Data Preparation
              const building1 = buildings.find(b => b.buildingShortName === 'KT');
              const building2 = buildings.find(b => b.buildingShortName === 'IB');
              if (!building1 || !building2) {
                  console.warn("Seeding skipped: Required buildings 'Knowledge Tower' or 'Inspiration Building' not found.");
                  return;
              }

              const programSWE = programs.find(p => p.pId === '35');
              const programBRE = programs.find(p => p.pId === '27');
              if (!programSWE || !programBRE) {
                  console.warn("Seeding skipped: Required programs '35 B.Sc. in SWE' or '27 BRE' not found.");
                  return;
              }

              const classroomCategory = categories.find(c => c.categoryName.toLowerCase() === 'classroom');
              const theoryType = roomTypes.find(t => t.typeName.toLowerCase() === 'theory');
              if (!classroomCategory || !theoryType) {
                  console.warn("Seeding skipped: Required room category 'Classroom' or type 'Theory' not found.");
                  return;
              }

              const theorySlotsTemplate = getSystemDefaultTimeSlotsObjects().filter(s => s.type === 'Theory');
              if (theorySlotsTemplate.length === 0) {
                  console.warn("Seeding skipped: No default 'Theory' time slots found to use as a template.");
                  return;
              }
              
              const existingFloors = new Set(floors.map(f => `${f.buildingId}-${f.floorName.toLowerCase()}`));

              // 2. Floor Creation
              const floorsToCreate: Omit<FloorEntry, 'id'>[] = [];
              [building1, building2].forEach(building => {
                  for (let i = 0; i < 10; i++) {
                      const floorName = i === 0 ? "Ground Floor" : `${i}${i === 1 ? 'st' : i === 2 ? 'nd' : i === 3 ? 'rd' : 'th'} Floor`;
                      if (!existingFloors.has(`${building.id}-${floorName.toLowerCase()}`)) {
                          floorsToCreate.push({ buildingId: building.id, floorName });
                      }
                  }
              });

              // Await all floor creations
              const createdFloors = floorsToCreate.length > 0 ? await Promise.all(floorsToCreate.map(f => addFloor(f))) : [];
              if (createdFloors.length > 0) console.log(`Seeding: Created ${createdFloors.length} new floors.`);
              const allBuildingFloors = [...floors, ...createdFloors];

              // 3. Room Creation
              const roomsToCreate: RoomEntry[] = [];
              let programToggle = true;

              [building1, building2].forEach(building => {
                  const buildingFloors = allBuildingFloors.filter(f => f.buildingId === building.id);
                  buildingFloors.forEach(floor => {
                      const floorNumberStr = floor.floorName === 'Ground Floor' ? 'G' : floor.floorName.match(/\d+/)?.[0] ?? 'X';
                      for (let i = 1; i <= 2; i++) {
                          const roomNumber = `${building.buildingShortName}-${floorNumberStr}${String(i).padStart(2, '0')}`;
                          const assignedPId = programToggle ? programSWE.pId : programBRE.pId;

                          const roomSpecificSlots = theorySlotsTemplate.map(slot => ({
                              ...slot,
                              id: `dummy-slot-${roomNumber}-${slot.startTime}-${Math.random().toString(16).substring(2)}`
                          }));

                          roomsToCreate.push({
                              id: `dummy-room-${roomNumber}`,
                              buildingId: building.id,
                              floorId: floor.id,
                              categoryId: classroomCategory.id,
                              typeId: theoryType.id,
                              roomNumber: roomNumber,
                              capacity: 40,
                              assignedToPId: assignedPId,
                              sharedWithPIds: [],
                              roomSpecificSlots: roomSpecificSlots,
                              semesterId: "Spring 2025"
                          });
                          programToggle = !programToggle;
                      }
                  });
              });

              // 4. Commit Rooms
              if (roomsToCreate.length > 0) {
                  setRooms(prevRooms => [...prevRooms.filter(r => !r.id.startsWith('dummy-')), ...roomsToCreate].sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true })));
                  console.log(`Seeding completed: Added ${roomsToCreate.length} dummy rooms.`);
              }
          } catch (err) {
              console.error("An error occurred during dummy data seeding:", err);
              localStorage.removeItem(SEED_KEY);
          }
      };

      // Only run if there are no dummy rooms present, to avoid re-seeding if the flag was somehow missed
      if (!rooms.some(r => r.id.startsWith('dummy-room-'))) {
        seedData();
      } else {
        localStorage.setItem(SEED_KEY, 'true'); // If dummy rooms exist, just set the flag to prevent future runs.
      }
  }, [loading, buildingsLoading, floorsLoading, categoriesLoading, typesLoading, programsLoading, buildings, floors, categories, roomTypes, programs, addFloor, rooms]);


  // Persist rooms to localStorage whenever they change
  useEffect(() => {
    if (!loading) { 
      try {
        localStorage.setItem(RBRMS_ROOMS_KEY, JSON.stringify(rooms));
      } catch (e) {
        console.error("Failed to save rooms to localStorage:", e);
        alert("Could not save room data. Your browser storage might be full.");
      }
    }
  }, [rooms, loading]);

  const getRoomsByBuildingId = useCallback((buildingId: string) => {
    return rooms.filter(r => r.buildingId === buildingId).sort((a,b) => a.roomNumber.localeCompare(b.roomNumber));
  }, [rooms]);

  const addRoom = useCallback(async (roomData: Omit<RoomEntry, 'id'>): Promise<RoomEntry> => {
    return new Promise((resolve, reject) => {
      if (!roomData.buildingId || !roomData.floorId || !roomData.categoryId || !roomData.typeId || !roomData.roomNumber || roomData.capacity == null) {
        reject(new Error('Required room fields are missing.'));
        return;
      }
       
      const roomNumberLower = roomData.roomNumber.toLowerCase();
      const existingRoom = rooms.find(r => 
          r.buildingId === roomData.buildingId && 
          r.roomNumber.toLowerCase() === roomNumberLower &&
          r.semesterId === roomData.semesterId
      );

      if (existingRoom) {
        const semesterInfo = roomData.semesterId ? `for semester "${roomData.semesterId}"` : 'for non-semester-specific rooms';
        reject(new Error(`Room number "${roomData.roomNumber}" already exists in this building ${semesterInfo}.`));
        return;
      }

      const newRoom: RoomEntry = {
        ...roomData,
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        roomSpecificSlots: (roomData.roomSpecificSlots || []).sort(sortSlotsByTypeThenTime),
      };
      setRooms(prev => [...prev, newRoom].sort((a,b) => a.roomNumber.localeCompare(b.roomNumber)));
      resolve(newRoom);
    });
  }, [rooms]);

  const updateRoom = useCallback(async (updatedRoom: RoomEntry): Promise<RoomEntry> => {
    return new Promise((resolve, reject) => {
        const originalRoom = rooms.find(r => r.id === updatedRoom.id);

        if (!originalRoom) {
            reject(new Error(`Room with ID "${updatedRoom.id}" not found. Cannot update.`));
            return;
        }
        
        const roomNumberChanged = originalRoom.roomNumber.toLowerCase() !== updatedRoom.roomNumber.toLowerCase();
        const semesterChanged = originalRoom.semesterId !== updatedRoom.semesterId;

        if (roomNumberChanged || semesterChanged) {
            const roomNumberLower = updatedRoom.roomNumber.toLowerCase();
            const conflictingRoom = rooms.find(r => 
                r.buildingId === updatedRoom.buildingId && 
                r.roomNumber.toLowerCase() === roomNumberLower && 
                r.semesterId === updatedRoom.semesterId &&
                r.id !== updatedRoom.id
            );

            if (conflictingRoom) {
                const semesterInfo = updatedRoom.semesterId ? `for semester "${updatedRoom.semesterId}"` : 'for non-semester-specific rooms';
                reject(new Error(`Another Room with this number already exists in this building ${semesterInfo}.`));
                return;
            }
        }
        
        const roomWithSortedSlots = {
            ...updatedRoom,
            roomSpecificSlots: (updatedRoom.roomSpecificSlots || []).sort(sortSlotsByTypeThenTime),
        };
        setRooms(prev => prev.map(r => r.id === updatedRoom.id ? roomWithSortedSlots : r).sort((a,b) => a.roomNumber.localeCompare(b.roomNumber)));
        resolve(roomWithSortedSlots);
    });
  }, [rooms]);

  const deleteRoom = useCallback(async (roomId: string): Promise<void> => {
    return new Promise((resolve) => {
      setRooms(prev => prev.filter(r => r.id !== roomId));
      resolve();
    });
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
