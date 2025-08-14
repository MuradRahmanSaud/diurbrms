import React, { useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { RoomEntry, DefaultTimeSlot } from '../types';
import { useRooms } from '../contexts/RoomContext';
import { useBuildings } from '../contexts/BuildingContext';
import { useFloors } from '../contexts/FloorContext';
import { useRoomCategories } from '../contexts/RoomCategoryContext';
import { useRoomTypes } from '../contexts/RoomTypeContext';
import { usePrograms } from '../contexts/ProgramContext';

interface RoomDataToolsProps {
  dataToDownload: RoomEntry[];
  buttonStyle?: 'sidebar' | 'viewHeader';
  canImport?: boolean;
  canExport?: boolean;
}

const RoomDataTools: React.FC<RoomDataToolsProps> = ({ dataToDownload, buttonStyle = 'viewHeader', canImport, canExport }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { addRoom } = useRooms();
  const { buildings } = useBuildings();
  const { floors } = useFloors();
  const { categories } = useRoomCategories();
  const { roomTypes } = useRoomTypes();
  const { programs } = usePrograms();

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileImport = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result;
        if (!arrayBuffer) throw new Error("Could not read file.");
        
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json<any>(worksheet);

        const roomsToAdd: Omit<RoomEntry, 'id'>[] = [];
        const errors: string[] = [];

        for (const [index, row] of jsonData.entries()) {
          const building = buildings.find(b => b.buildingName === row['Building Name']);
          if (!building) {
            errors.push(`Row ${index + 2}: Building "${row['Building Name']}" not found.`);
            continue;
          }
          const floor = floors.find(f => f.buildingId === building.id && f.floorName === row['Floor Name']);
          if (!floor) {
            errors.push(`Row ${index + 2}: Floor "${row['Floor Name']}" not found in building "${building.buildingName}".`);
            continue;
          }
          const category = categories.find(c => c.categoryName === row['Category']);
          if (!category) {
            errors.push(`Row ${index + 2}: Category "${row['Category']}" not found.`);
            continue;
          }
          const type = roomTypes.find(t => t.typeName === row['Type']);
          if (!type) {
            errors.push(`Row ${index + 2}: Type "${row['Type']}" not found.`);
            continue;
          }
          
          const assignedProgramPId = String(row['Assigned Program (P-ID)'] || '').trim();
          if (assignedProgramPId && !programs.some(p => p.pId === assignedProgramPId)) {
              errors.push(`Row ${index + 2}: Assigned Program P-ID "${assignedProgramPId}" not found.`);
              continue;
          }

          const sharedPIdsStr = String(row['Shared Programs (P-IDs)'] || '');
          const sharedWithPIds = sharedPIdsStr ? sharedPIdsStr.split(',').map(p => p.trim()).filter(Boolean) : [];
          
          let hasSharedPIdError = false;
          for(const pId of sharedWithPIds) {
              if (!programs.some(p => p.pId === pId)) {
                  errors.push(`Row ${index + 2}: Shared Program P-ID "${pId}" not found.`);
                  hasSharedPIdError = true;
                  break;
              }
          }
          if (hasSharedPIdError) continue;

          let rowHasError = false;
          const roomSpecificSlotsStr = String(row['Room Specific Slots'] || '').trim();
          const roomSpecificSlots: DefaultTimeSlot[] = [];
          if (roomSpecificSlotsStr) {
              const slotStrings = roomSpecificSlotsStr.split(';').map(s => s.trim()).filter(Boolean);
              for (const slotStr of slotStrings) {
                  const firstColonIndex = slotStr.indexOf(':');
                  if (firstColonIndex === -1) {
                      errors.push(`Row ${index + 2}: Invalid slot format in "Room Specific Slots": ${slotStr}. Expected "Type:HH:MM-HH:MM".`);
                      rowHasError = true;
                      break;
                  }
                  const typeStr = slotStr.substring(0, firstColonIndex).trim();
                  const timeRange = slotStr.substring(firstColonIndex + 1).trim();
                  
                  if (typeStr !== 'Theory' && typeStr !== 'Lab') {
                      errors.push(`Row ${index + 2}: Invalid slot type "${type}". Must be "Theory" or "Lab".`);
                      rowHasError = true;
                      break;
                  }
                  const timeParts = timeRange.split('-').map(t => t.trim());
                  if (timeParts.length !== 2) {
                      errors.push(`Row ${index + 2}: Invalid time range format in "Room Specific Slots": ${timeRange}. Expected "HH:MM-HH:MM".`);
                      rowHasError = true;
                      break;
                  }
                  const [startTime, endTime] = timeParts;
                  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
                  if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
                      errors.push(`Row ${index + 2}: Invalid time format in "Room Specific Slots": ${timeRange}. Use 24-hour HH:MM format.`);
                      rowHasError = true;
                      break;
                  }

                  roomSpecificSlots.push({
                      id: `imported-slot-${Date.now()}-${index}-${Math.random()}`,
                      type: typeStr as 'Theory' | 'Lab',
                      startTime,
                      endTime,
                  });
              }
          }
          if (rowHasError) continue;

          const newRoom: Omit<RoomEntry, 'id'> = {
            buildingId: building.id,
            floorId: floor.id,
            categoryId: category.id,
            typeId: type.id,
            roomNumber: String(row['Room Number']),
            capacity: Number(row['Capacity']),
            assignedToPId: assignedProgramPId || undefined,
            sharedWithPIds,
            semesterId: String(row['Semester']),
            roomSpecificSlots,
          };
          roomsToAdd.push(newRoom);
        }

        if (errors.length > 0) {
          alert(`Import failed with ${errors.length} errors:\n\n${errors.slice(0, 10).join('\n')}${errors.length > 10 ? '\n...' : ''}`);
          return;
        }
        
        if (roomsToAdd.length === 0) {
          alert("No new rooms to add from the file.");
          return;
        }

        let successes = 0;
        let addErrors: string[] = [];
        for (const room of roomsToAdd) {
          try {
            await addRoom(room);
            successes++;
          } catch (err: any) {
            addErrors.push(`Room ${room.roomNumber}: ${err.message}`);
          }
        }

        let alertMessage = `Import finished. Successfully added ${successes} rooms.`;
        if (addErrors.length > 0) {
          alertMessage += `\n\nFailed to add ${addErrors.length} rooms due to conflicts (e.g., room number already exists for the semester):\n${addErrors.slice(0, 5).join('\n')}`;
        }
        alert(alertMessage);
      } catch (error: any) {
        console.error("Error importing file:", error);
        alert(`Error processing file: ${error.message || 'Ensure it is a valid Excel file.'}`);
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsArrayBuffer(file);
  }, [addRoom, buildings, floors, categories, roomTypes, programs]);

  const handleDownload = useCallback(() => {
    if (dataToDownload.length === 0) {
      alert("There is no data to export in the current view.");
      return;
    }

    const dataForSheet = dataToDownload.map(room => {
      const building = buildings.find(b => b.id === room.buildingId);
      const floor = floors.find(f => f.id === room.floorId);
      const category = categories.find(c => c.id === room.categoryId);
      const type = roomTypes.find(t => t.id === room.typeId);
      
      const roomSpecificSlotsString = room.roomSpecificSlots
        ?.map(slot => `${slot.type}:${slot.startTime}-${slot.endTime}`)
        .join(';') || '';
        
      return {
        "Building Name": building?.buildingName || 'N/A',
        "Floor Name": floor?.floorName || 'N/A',
        "Room Number": room.roomNumber,
        "Category": category?.categoryName || 'N/A',
        "Type": type?.typeName || 'N/A',
        "Capacity": room.capacity,
        "Semester": room.semesterId || 'N/A',
        "Assigned Program (P-ID)": room.assignedToPId || '',
        "Shared Programs (P-IDs)": room.sharedWithPIds.join(', '),
        "Room Specific Slots": roomSpecificSlotsString,
      };
    });

    const ws = XLSX.utils.json_to_sheet(dataForSheet);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rooms");
    XLSX.writeFile(wb, "room_list.xlsx");
  }, [dataToDownload, buildings, floors, categories, roomTypes]);

  const currentStyle = buttonStyle === 'viewHeader' ? {
    import: "p-1.5 flex-shrink-0 text-white bg-teal-600 hover:bg-teal-700 rounded-md shadow-sm",
    download: "p-1.5 flex-shrink-0 text-teal-700 bg-teal-100 hover:bg-teal-200 rounded-md shadow-sm border border-teal-200",
    iconSize: "h-4 w-4",
  } : {
    import: "p-1.5 text-white bg-teal-600 hover:bg-teal-500 rounded-md shadow-sm transition-colors",
    download: "p-1.5 text-teal-700 bg-teal-200 hover:bg-teal-300 rounded-md shadow-sm transition-colors",
    iconSize: "h-3 w-3",
  };

  return (
    <>
      {canImport && (
        <>
            <input type="file" ref={fileInputRef} onChange={handleFileImport} accept=".xlsx, .xls" className="hidden" aria-hidden="true"/>
            <button onClick={handleImportClick} title="Import Rooms" className={currentStyle.import}>
                <svg xmlns="http://www.w3.org/2000/svg" className={currentStyle.iconSize} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            </button>
        </>
      )}
      {canExport && (
        <button onClick={handleDownload} title="Download Rooms" className={currentStyle.download}>
            <svg xmlns="http://www.w3.org/2000/svg" className={currentStyle.iconSize} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
        </button>
      )}
    </>
  );
};

export default RoomDataTools;
