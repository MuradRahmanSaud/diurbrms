import { useState, useCallback } from 'react';
import { RoomEntry, DefaultTimeSlot, DayOfWeek, FullRoutineData, ClassDetail } from '../types';
import { useRooms } from '../contexts/RoomContext';

interface ModalManagerOptions {
    allRooms: RoomEntry[];
}

export const useModalManager = ({ allRooms }: ModalManagerOptions) => {
    const { getRoomById, updateRoom: updateRoomContext } = useRooms();

    const [isRoomDetailModalOpenFromGrid, setIsRoomDetailModalOpenFromGrid] = useState<boolean>(false);
    const [selectedRoomForGridModal, setSelectedRoomForGridModal] = useState<RoomEntry | null>(null);

    const [isDayTimeSlotDetailModalOpen, setIsDayTimeSlotDetailModalOpen] = useState(false);
    const [selectedDayForDayCentricModal, setSelectedDayForDayCentricModal] = useState<DayOfWeek | null>(null);
    const [selectedSlotObjectForDayCentricModal, setSelectedSlotObjectForDayCentricModal] = useState<DefaultTimeSlot | null>(null);

    const [isSlotDetailModalOpen, setIsSlotDetailModalOpen] = useState(false);
    const [selectedSlotData, setSelectedSlotData] = useState<{ room: RoomEntry; slot: DefaultTimeSlot; day: DayOfWeek; } | null>(null);

    const handleOpenRoomDetailModalFromGrid = useCallback((room: RoomEntry) => {
        setSelectedRoomForGridModal(room);
        setIsRoomDetailModalOpenFromGrid(true);
    }, []);

    const handleCloseRoomDetailModalFromGrid = useCallback(() => {
        setSelectedRoomForGridModal(null);
        setIsRoomDetailModalOpenFromGrid(false);
    }, []);
    
    const handleSaveRoomFromModal = async (updatedRoomData: RoomEntry) => {
        try {
            await updateRoomContext(updatedRoomData);
            const refreshedRoom = getRoomById(updatedRoomData.id);
            setSelectedRoomForGridModal(refreshedRoom || updatedRoomData); 
        } catch (error) {
            console.error("Failed to update room from modal:", error);
            throw error; 
        }
    };

    const handleOpenDayTimeSlotDetailModal = useCallback((day: DayOfWeek, slotObject: DefaultTimeSlot) => {
        setSelectedDayForDayCentricModal(day);
        setSelectedSlotObjectForDayCentricModal(slotObject);
        setIsDayTimeSlotDetailModalOpen(true);
    }, []);

    const handleCloseDayTimeSlotDetailModal = useCallback(() => {
        setIsDayTimeSlotDetailModalOpen(false);
        setSelectedDayForDayCentricModal(null);
        setSelectedSlotObjectForDayCentricModal(null);
    }, []);

    const handleOpenSlotDetailModal = useCallback((room: RoomEntry, slot: DefaultTimeSlot, day: DayOfWeek) => {
        setSelectedSlotData({ room, slot, day });
        setIsSlotDetailModalOpen(true);
    }, []);

    const handleCloseSlotDetailModal = useCallback(() => {
        setIsSlotDetailModalOpen(false);
        setSelectedSlotData(null);
    }, []);

    return {
        isRoomDetailModalOpenFromGrid,
        selectedRoomForGridModal,
        isDayTimeSlotDetailModalOpen,
        selectedDayForDayCentricModal,
        selectedSlotObjectForDayCentricModal,
        isSlotDetailModalOpen,
        selectedSlotData,

        handleOpenRoomDetailModalFromGrid,
        handleCloseRoomDetailModalFromGrid,
        handleSaveRoomFromModal,
        handleOpenDayTimeSlotDetailModal,
        handleCloseDayTimeSlotDetailModal,
        handleOpenSlotDetailModal,
        handleCloseSlotDetailModal,
    };
};
