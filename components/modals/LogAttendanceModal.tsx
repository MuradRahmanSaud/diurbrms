import React, { useState, useMemo, useEffect, useRef } from 'react';
import Modal from '../Modal';
import { AttendanceLogEntry, AttendanceStatus, RoomEntry, DefaultTimeSlot, MakeupClassDetails, FullRoutineData, ScheduleOverrides, DayOfWeek, ProgramEntry, RoomTypeEntry } from '../../types';
import { formatDefaultSlotToString } from '../../App';
import { sortSlotsByTypeThenTime } from '../../data/slotConstants';
import SearchableProgramDropdown from '../SearchableProgramDropdown';

interface ClassMonitoringModalProps {
  isOpen: boolean;
  onClose: () => void;
  logDataTemplate: Partial<AttendanceLogEntry>;
  onSubmit: (fullLogData: Partial<AttendanceLogEntry>) => void;
  allRooms: RoomEntry[];
  systemDefaultTimeSlots: DefaultTimeSlot[];
  routineData: { [semesterId: string]: FullRoutineData };
  scheduleOverrides: ScheduleOverrides;
  allPrograms: ProgramEntry[];
  allRoomTypes: RoomTypeEntry[];
  getBuildingName: (buildingId: string) => string;
}

const getDayOfWeekFromISO = (isoDate: string): DayOfWeek | null => {
    if (!isoDate) return null;
    try {
        const date = new Date(isoDate + 'T00:00:00Z');
        const dayIndex = date.getUTCDay();
        const jsDayMap: { [key: number]: DayOfWeek } = { 0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday' };
        return jsDayMap[dayIndex];
    } catch (e) {
        return null;
    }
};

const ClassMonitoringModal: React.FC<ClassMonitoringModalProps> = ({ isOpen, onClose, logDataTemplate, onSubmit, allRooms, systemDefaultTimeSlots, routineData, scheduleOverrides, allPrograms, allRoomTypes, getBuildingName }) => {
  const [status, setStatus] = useState<AttendanceStatus | null>(null);
  const [remark, setRemark] = useState('');
  const [scheduleMakeup, setScheduleMakeup] = useState(true);
  const [makeupDate, setMakeupDate] = useState('');
  const [makeupTimeSlot, setMakeupTimeSlot] = useState('');
  const [makeupRoomNumber, setMakeupRoomNumber] = useState('');
  const [activeSlotGridTab, setActiveSlotGridTab] = useState<'Theory' | 'Lab'>('Theory');
  const [programFilterForGrid, setProgramFilterForGrid] = useState<string | null>(null);
  
  // Reset state when modal opens with new data or for editing
  useEffect(() => {
    if (isOpen && logDataTemplate) {
        setStatus(logDataTemplate.status || null);
        setRemark(logDataTemplate.remark || '');
        if (logDataTemplate.makeupInfo) {
            setScheduleMakeup(true);
            setMakeupDate(logDataTemplate.makeupInfo.date);
            setMakeupTimeSlot(logDataTemplate.makeupInfo.timeSlot);
            setMakeupRoomNumber(logDataTemplate.makeupInfo.roomNumber);
        } else {
            setScheduleMakeup(true);
            setMakeupDate('');
            setMakeupTimeSlot('');
            setMakeupRoomNumber('');
        }
        setActiveSlotGridTab('Theory');

        // Pre-select the program filter based on the course's program
        const courseProgram = allPrograms.find(p => p.pId === logDataTemplate.pId);
        setProgramFilterForGrid(courseProgram ? courseProgram.id : null);
    }
  }, [isOpen, logDataTemplate, allPrograms]);
  
    // Guard clause to ensure essential data is present.
  if (!logDataTemplate.date || !logDataTemplate.timeSlot || !logDataTemplate.roomNumber || !logDataTemplate.buildingName || !logDataTemplate.courseCode || !logDataTemplate.courseTitle || !logDataTemplate.section || !logDataTemplate.teacherName || !logDataTemplate.teacherId || !logDataTemplate.teacherDesignation || !logDataTemplate.pId) {
    if (isOpen) {
      console.error("ClassMonitoringModal received incomplete logDataTemplate:", logDataTemplate);
    }
    return null;
  }


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!status) {
      alert('Please select an attendance status.');
      return;
    }
    let makeupInfo: MakeupClassDetails | undefined = undefined;
    if (scheduleMakeup) {
      if (!makeupDate || !makeupTimeSlot || !makeupRoomNumber) {
        alert('Please fill in all fields for the make-up schedule.');
        return;
      }
      makeupInfo = {
        date: makeupDate,
        timeSlot: makeupTimeSlot,
        roomNumber: makeupRoomNumber,
      };
    }

    const dataToSubmit: Partial<AttendanceLogEntry> = {
      ...(logDataTemplate.id && { id: logDataTemplate.id }),
      date: logDataTemplate.date!,
      timeSlot: logDataTemplate.timeSlot!,
      roomNumber: logDataTemplate.roomNumber!,
      buildingName: logDataTemplate.buildingName!,
      courseCode: logDataTemplate.courseCode!,
      courseTitle: logDataTemplate.courseTitle!,
      section: logDataTemplate.section!,
      teacherName: logDataTemplate.teacherName!,
      teacherId: logDataTemplate.teacherId!,
      teacherDesignation: logDataTemplate.teacherDesignation!,
      pId: logDataTemplate.pId!,
      status,
      remark,
      ...(makeupInfo !== undefined && { makeupInfo }),
      ...(!scheduleMakeup && logDataTemplate.makeupInfo && { makeupInfo: undefined }),
      teacherMobile: logDataTemplate.teacherMobile,
      teacherEmail: logDataTemplate.teacherEmail,
      semester: logDataTemplate.semester,
    };
    onSubmit(dataToSubmit);
  };
  
  const { courseCode, section, roomNumber, date, timeSlot } = logDataTemplate;
  const isEditing = !!logDataTemplate.id;
  const title = isEditing ? 'Edit Class Log' : `Monitor Class: ${courseCode} (${section})`;
  const subTitle = `${roomNumber} on ${date} at ${timeSlot}`;
  
  const statuses: AttendanceStatus[] = [
    'Class is going',
    'Students present but teacher absent',
    'Teacher present but students are absent',
    'Student and Teacher both are absent'
  ];

  const footer = (
    <div className="flex justify-end gap-3">
        <button 
            type="button" 
            onClick={onClose} 
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md border border-gray-300"
        >
            Cancel
        </button>
        <button 
            type="submit"
            form="log-attendance-form"
            className="px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-md border border-transparent"
        >
            {isEditing ? 'Save Changes' : 'Save'}
        </button>
    </div>
  );
  
  const freeSlotGrid = useMemo(() => {
    const dayOfWeekForMakeup = getDayOfWeekFromISO(makeupDate);

    const routineForSelectedSemester = logDataTemplate.semester ? routineData[logDataTemplate.semester] : {};

    const getTypeName = (typeId: string): string => allRoomTypes.find(t => t.id === typeId)?.typeName || 'Unknown';

    let relevantRoomsForTab = allRooms;
    if (dayOfWeekForMakeup) {
        relevantRoomsForTab = allRooms.filter(room => {
            if (room.semesterId !== logDataTemplate.semester) return false;
            
            const programForRoom = allPrograms.find(p => p.pId === room.assignedToPId);
            if (!programForRoom?.activeDays?.includes(dayOfWeekForMakeup)) return false;

            const roomTypeName = getTypeName(room.typeId).toLowerCase();
            if (activeSlotGridTab === 'Theory') {
                return roomTypeName.includes('theory') || (roomTypeName.includes('class') && !roomTypeName.includes('lab'));
            }
            if (activeSlotGridTab === 'Lab') {
                return roomTypeName.includes('lab');
            }
            return false;
        });
    }
    
    if (programFilterForGrid) {
        const selectedProgram = allPrograms.find(p => p.id === programFilterForGrid);
        if (selectedProgram) {
            relevantRoomsForTab = relevantRoomsForTab.filter(room => room.assignedToPId === selectedProgram.pId);
        }
    }
    
    // De-duplicate rooms based on a composite key to prevent rendering issues from upstream data duplication.
    const uniqueRelevantRoomsForTab = Array.from(new Map(relevantRoomsForTab.map(room => [`${room.buildingId}-${room.roomNumber}`, room])).values());

    const slotsForHeader = systemDefaultTimeSlots.filter(s => s.type === activeSlotGridTab).sort(sortSlotsByTypeThenTime);
    
    const roomsWithConfiguredSlots = uniqueRelevantRoomsForTab.filter(room => {
        return (room.roomSpecificSlots || []).some(slot => slot.type === activeSlotGridTab);
    });

    const handleSlotClick = (room: RoomEntry, slot: DefaultTimeSlot) => {
        setMakeupRoomNumber(room.roomNumber);
        setMakeupTimeSlot(formatDefaultSlotToString(slot));
    };

    const dayScheduleForDate = dayOfWeekForMakeup ? (routineForSelectedSemester?.[dayOfWeekForMakeup] || {}) : {};

    return (
        <div className="p-3 border border-gray-300 bg-gray-50 rounded-md animate-fade-in">
             <style>{`
                @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
                .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
            `}</style>
            <div className="flex flex-wrap justify-between items-end gap-x-4 gap-y-2 mb-2 pb-2 border-b border-gray-200">
                <div className="flex items-end gap-x-3 gap-y-2 flex-wrap">
                    <div>
                        <label htmlFor="makeup-date" className="block text-xs font-medium text-gray-700">Make-up Date</label>
                        <input
                          type="date"
                          id="makeup-date"
                          value={makeupDate}
                          onChange={(e) => setMakeupDate(e.target.value)}
                          className="mt-1 block border-gray-300 rounded-md shadow-sm focus:ring-teal-500 focus:border-teal-500 h-8 text-xs px-2"
                          required={scheduleMakeup}
                        />
                    </div>
                    <div>
                        <label htmlFor="makeup-room" className="block text-xs font-medium text-gray-700">Make-up Room</label>
                        <input
                          type="text"
                          id="makeup-room"
                          value={makeupRoomNumber}
                          readOnly
                          placeholder="From Grid"
                          className="mt-1 block w-28 border-gray-300 rounded-md shadow-sm bg-gray-100 h-8 text-xs px-2"
                          required={scheduleMakeup}
                        />
                    </div>
                    <div>
                        <label htmlFor="makeup-slot" className="block text-xs font-medium text-gray-700">Time Slot</label>
                        <input
                          type="text"
                          id="makeup-slot"
                          value={makeupTimeSlot}
                          readOnly
                          placeholder="From Grid"
                          className="mt-1 block w-40 border-gray-300 rounded-md shadow-sm bg-gray-100 h-8 text-xs px-2"
                          required={scheduleMakeup}
                        />
                    </div>
                </div>
                <div className="flex items-end gap-x-3 gap-y-2 flex-wrap justify-end">
                    <div className="w-48">
                        <label className="block text-xs font-medium text-gray-700">Program</label>
                        <SearchableProgramDropdown
                            programs={allPrograms}
                            selectedProgramId={programFilterForGrid}
                            onProgramSelect={setProgramFilterForGrid}
                            placeholderText="Filter by Program"
                            showAllProgramsListItem={true}
                            allProgramsListItemText="All Programs"
                            buttonClassName="mt-1 w-full flex items-center justify-between p-1.5 text-xs rounded-md transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-offset-1 shadow-sm bg-white border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-teal-500 focus:ring-offset-slate-200 h-8"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 invisible">Room Type</label>
                        <div className="flex gap-1 p-0.5 bg-gray-200 rounded-md">
                            {(['Theory', 'Lab'] as const).map(tab => (
                                <button
                                    key={tab}
                                    type="button"
                                    onClick={() => setActiveSlotGridTab(tab)}
                                    className={`px-3 py-1 text-xs font-bold rounded-sm transition-all duration-200 h-7 ${
                                        activeSlotGridTab === tab
                                        ? 'bg-white text-teal-700 shadow-sm'
                                        : 'text-gray-600 hover:bg-gray-100'
                                    }`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {makeupDate && dayOfWeekForMakeup ? (
                <>
                    <div className="overflow-auto custom-scrollbar" style={{maxHeight: '45vh'}}>
                        {roomsWithConfiguredSlots.length > 0 && slotsForHeader.length > 0 ? (
                            <table className="min-w-full table-fixed border-separate" style={{borderSpacing: '2px'}}>
                                <thead className="sticky top-0 bg-gray-50 z-10">
                                    <tr>
                                        <th className="w-28 p-1 text-[10px] bg-gray-200 text-gray-700 font-semibold rounded-md">Room</th>
                                        {slotsForHeader.map(slot => <th key={slot.id} className="p-1 text-[9px] bg-gray-200 text-gray-700 font-semibold rounded-md">{formatDefaultSlotToString(slot)}</th>)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {roomsWithConfiguredSlots.sort((a,b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true })).map(room => {
                                        const buildingName = getBuildingName(room.buildingId);
                                        const roomOperatingSlots = room.roomSpecificSlots || [];
                                        return (
                                        <tr key={room.id}>
                                            <td className="p-1 bg-gray-200 text-gray-700 rounded-md text-center align-middle">
                                                <div className="text-xs font-semibold">{room.roomNumber}</div>
                                                <div className="text-[9px] font-normal text-gray-500 truncate" title={buildingName}>{buildingName}</div>
                                            </td>
                                            {slotsForHeader.map(headerSlot => {
                                                const slotString = formatDefaultSlotToString(headerSlot);
                                                // FIX: Correctly check if the room is configured for the slot without comparing unrelated IDs.
                                                const isRoomConfiguredForThisSlot = roomOperatingSlots.some(s => s.type === headerSlot.type && s.startTime === headerSlot.startTime && s.endTime === headerSlot.endTime);
                                                let isBooked = false;
                                                let classInfo = null;
                                                if (isRoomConfiguredForThisSlot) {
                                                    const defaultBooking = dayScheduleForDate[room.roomNumber]?.[slotString];
                                                    const override = scheduleOverrides[room.roomNumber]?.[slotString]?.[makeupDate];
                                                    if (override !== undefined) { isBooked = override !== null; classInfo = override; } 
                                                    else { isBooked = !!defaultBooking; classInfo = defaultBooking; }
                                                }
                                                const isSelected = room.roomNumber === makeupRoomNumber && formatDefaultSlotToString(headerSlot) === makeupTimeSlot;
                                                return (
                                                    <td key={headerSlot.id} className="p-0.5 align-middle">
                                                        {isRoomConfiguredForThisSlot ? (
                                                            isBooked ? (
                                                                <div className="w-full h-8 rounded-md bg-gray-300 flex items-center justify-center text-xs text-gray-500 opacity-70 px-1 truncate" title={`Booked: ${classInfo?.courseCode} (${classInfo?.section})`}>
                                                                    {classInfo?.courseCode}({classInfo?.section})
                                                                </div>
                                                            ) : (
                                                                <button type="button" onClick={() => handleSlotClick(room, headerSlot)} className={`w-full h-8 rounded-md text-xs transition-colors ${isSelected ? 'bg-teal-600 text-white font-bold' : 'bg-green-100 text-green-800 hover:bg-green-200'}`}>
                                                                    Free
                                                                </button>
                                                            )
                                                        ) : ( <div className="w-full h-8 rounded-md bg-gray-100"></div> )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    )})}
                                </tbody>
                            </table>
                        ) : (
                            <p className="text-center text-xs italic text-gray-500 py-4">No {activeSlotGridTab.toLowerCase()} rooms with specific slots are available for this day{programFilterForGrid ? ' and program' : ''}.</p>
                        )}
                    </div>
                </>
            ) : (
                <div className="text-center text-sm text-gray-500 py-4 h-32 flex items-center justify-center">Please select a make-up date to see available slots.</div>
            )}
        </div>
    );
  }, [scheduleMakeup, makeupDate, makeupRoomNumber, makeupTimeSlot, systemDefaultTimeSlots, activeSlotGridTab, allRoomTypes, routineData, logDataTemplate.semester, allRooms, allPrograms, scheduleOverrides, programFilterForGrid, getBuildingName]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} subTitle={subTitle} footerContent={footer} maxWidthClass="max-w-7xl" heightClass="max-h-[85vh]">
      <form id="log-attendance-form" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Column (Status and Remark) */}
          <div className="lg:col-span-1 space-y-4">
             <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <div className="space-y-2">
                {statuses.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={`w-full p-2 text-left text-sm rounded-md border transition-colors flex items-center gap-3 ${
                      status === s
                        ? 'bg-teal-600 text-white border-teal-600 font-semibold shadow-md'
                        : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className={`flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center ${status === s ? 'bg-teal-600 border-white' : 'border-gray-300'}`}>
                      {status === s && <div className="w-2 h-2 bg-white rounded-full"></div>}
                    </div>
                    <span>{s}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label htmlFor="remark-textarea" className="block text-sm font-medium text-gray-700">Remark</label>
              <textarea
                id="remark-textarea"
                rows={8}
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                className="mt-1 block w-full p-2 text-base border border-gray-300 focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm rounded-md"
                placeholder="Add any notes here..."
              />
            </div>
          </div>

          {/* Right Column (Makeup Schedule) */}
          <div className="lg:col-span-3 space-y-4">
            <div className="relative">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-start">
                <span className="bg-white pr-3 text-sm font-medium text-gray-900">
                  <div className="flex items-center">
                    <input
                      id="schedule-makeup-checkbox"
                      type="checkbox"
                      checked={scheduleMakeup}
                      onChange={(e) => setScheduleMakeup(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                    />
                    <label htmlFor="schedule-makeup-checkbox" className="ml-2 block text-sm text-gray-900">
                      Schedule a make-up for this class
                    </label>
                  </div>
                </span>
              </div>
            </div>
            
            {freeSlotGrid}
          </div>
        </div>
      </form>
    </Modal>
  );
};

export default ClassMonitoringModal;