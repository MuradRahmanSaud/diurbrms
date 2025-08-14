
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { RoomEntry, BuildingEntry, FloorEntry } from '../../types';

interface RoomListViewProps {
    rooms: RoomEntry[];
    onBack: () => void;
    getBuildingName: (buildingId: string) => string;
    getFloorName: (floorId: string) => string;
    getProgramShortName: (pId?: string) => string;
    getTypeName: (typeId: string) => string;
    getOccupancyStats: (room: RoomEntry) => { theory: { booked: number; total: number; }; lab: { booked: number; total: number; }; };
    allBuildings: BuildingEntry[];
    allFloors: FloorEntry[];
    onRoomClick: (room: RoomEntry) => void;
}

const OccupancyBar = ({ label, booked, total, colorClass }: { label: string, booked: number, total: number, colorClass: string }) => {
    const occupancyPercent = total > 0 ? (booked / total) * 100 : 0;
    const progressBarColor = occupancyPercent >= 100 ? 'bg-red-500' : 'bg-teal-500';

    return (
        <div className="w-full">
            <div className="flex justify-end items-baseline mb-0.5">
                <span className="text-[10px] font-bold text-gray-600">{booked} / {total}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div
                    className={`h-1.5 rounded-full ${progressBarColor}`}
                    style={{ width: `${occupancyPercent}%` }}
                ></div>
            </div>
        </div>
    );
};

const TabFilterGroup = ({ title, options, selectedValue, onSelectionChange }: { title: string; options: {id: string; name: string}[]; selectedValue: string | null; onSelectionChange: (id: string | null) => void }) => {
    return (
        <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">{title}</label>
            <div className="flex flex-wrap gap-1.5">
                <button
                    onClick={() => onSelectionChange(null)}
                    className={`px-2 py-1 text-xs font-semibold rounded-md transition-colors border ${
                        selectedValue === null
                            ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                    }`}
                >
                    All
                </button>
                {options.map(option => (
                    <button
                        key={option.id}
                        onClick={() => onSelectionChange(option.id)}
                        className={`px-2 py-1 text-xs font-semibold rounded-md transition-colors border ${
                            selectedValue === option.id
                                ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                        }`}
                    >
                        {option.name}
                    </button>
                ))}
            </div>
        </div>
    );
};


const RoomListView: React.FC<RoomListViewProps> = ({ rooms, onBack, getBuildingName, getFloorName, getProgramShortName, getTypeName, getOccupancyStats, allBuildings, allFloors, onRoomClick }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [buildingFilter, setBuildingFilter] = useState<string | null>(null);
  const [floorFilter, setFloorFilter] = useState<string | null>(null);
  const [isFilterPanelVisible, setIsFilterPanelVisible] = useState(false);

  const filteredRooms = useMemo(() => {
    return rooms.filter(room => {
      if (searchTerm && !room.roomNumber.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      if (buildingFilter && room.buildingId !== buildingFilter) {
        return false;
      }
      if (floorFilter && room.floorId !== floorFilter) {
        return false;
      }
      return true;
    });
  }, [rooms, searchTerm, buildingFilter, floorFilter]);

  const buildingOptions = useMemo(() => {
    const buildingIdsInRooms = new Set(rooms.map(r => r.buildingId));
    return allBuildings
      .filter(b => buildingIdsInRooms.has(b.id))
      .map(b => ({ id: b.id, name: b.buildingName }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rooms, allBuildings]);

  const floorOptions = useMemo(() => {
    if (!buildingFilter) return [];

    const floorIdsInRooms = new Set(rooms.map(r => r.floorId));
    return allFloors
      .filter(f => f.buildingId === buildingFilter && floorIdsInRooms.has(f.id))
      .map(f => ({ id: f.id, name: f.floorName }))
      .sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        const getFloorNum = (name: string) => {
            if (name.includes('ground')) return 0;
            const match = name.match(/\d+/);
            return match ? parseInt(match[0], 10) : Infinity;
        };
        const aNum = getFloorNum(aName);
        const bNum = getFloorNum(bName);
        if (aNum !== Infinity && bNum !== Infinity && aNum !== bNum) {
            return aNum - bNum;
        }
        return a.name.localeCompare(b.name);
      });
  }, [rooms, allFloors, buildingFilter]);

  useEffect(() => {
    setFloorFilter(null);
  }, [buildingFilter]);

  const onResetFilters = () => {
    setSearchTerm('');
    setBuildingFilter(null);
    setFloorFilter(null);
  };

  const activeFilterCount = useMemo(() => {
    return (buildingFilter ? 1 : 0) + (floorFilter ? 1 : 0);
  }, [buildingFilter, floorFilter]);

  const FilterPanel = () => (
    <div className="flex flex-col h-full animate-fade-in">
        <style>{`.animate-fade-in { animation: fade-in 0.5s ease-out forwards; }`}</style>
        <div className="flex justify-between items-center mb-3 flex-shrink-0">
            <h4 className="font-semibold text-gray-700">Filters</h4>
            <button onClick={onResetFilters} className="text-xs text-red-600 hover:underline">Reset All</button>
        </div>
        <div className="flex-grow overflow-y-auto filter-panel-scrollbar pr-1 -mr-2 space-y-4">
            <TabFilterGroup title="Building" options={buildingOptions} selectedValue={buildingFilter} onSelectionChange={setBuildingFilter} />
            {buildingFilter && floorOptions.length > 0 && (
                <TabFilterGroup title="Floor" options={floorOptions} selectedValue={floorFilter} onSelectionChange={setFloorFilter} />
            )}
        </div>
    </div>
  );

  return (
    <div className="h-full flex flex-row gap-3 overflow-hidden">
      <div className={`
          flex-shrink-0 bg-white rounded-lg shadow-lg border border-gray-200 transition-all duration-300 ease-in-out
          ${isFilterPanelVisible ? 'w-56 p-3' : 'w-0 p-0 border-0 overflow-hidden'}
      `}>
          {isFilterPanelVisible && <FilterPanel />}
      </div>
      <div className="h-full flex flex-col flex-grow min-w-0">
          <div className="flex justify-between items-center mb-2 flex-shrink-0">
              <h3 className="text-md font-semibold text-gray-800">Room List ({filteredRooms.length})</h3>
              <div className="flex items-center gap-3">
                    <div className="relative w-64">
                        <div className="flex items-center border border-gray-300 rounded-md bg-white focus-within:ring-1 focus-within:ring-teal-500 focus-within:border-teal-500 transition-all">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><svg className="h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg></div>
                            <input type="search" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search rooms..." className="block w-full pl-9 pr-10 py-1.5 border-0 rounded-md leading-5 bg-transparent placeholder-gray-500 focus:outline-none focus:ring-0 sm:text-sm" />
                            <div className="absolute inset-y-0 right-0 flex items-center">
                                <button onClick={() => setIsFilterPanelVisible(prev => !prev)} className="p-1.5 text-gray-400 hover:text-gray-600 focus:outline-none rounded-full mr-1 relative" aria-label="Toggle filters">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                                    {activeFilterCount > 0 && (
                                        <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-3 w-3 bg-teal-500"></span>
                                        </span>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                    <button onClick={onBack} className="text-sm font-medium text-teal-600 hover:underline flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z" /></svg>
                        Back to Overview
                    </button>
              </div>
          </div>
          <div className="overflow-auto custom-scrollbar flex-grow min-h-0">
            {filteredRooms.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 p-1">
                    {filteredRooms.map(room => {
                        const occupancy = getOccupancyStats(room);
                        const roomTypeName = getTypeName(room.typeId).toLowerCase();
                        const statsToShow: { label: string; data: { booked: number; total: number }; colorClass: string } | null = roomTypeName.includes('lab') ? { label: 'Lab Slots', data: occupancy.lab, colorClass: 'text-blue-700' } : { label: 'Theory Slots', data: occupancy.theory, colorClass: 'text-green-700' };
                        return (
                            <div
                                key={room.id}
                                className="bg-white rounded-lg shadow border border-gray-200 p-2.5 flex flex-col justify-between hover:shadow-md transition-shadow duration-150 h-32 cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
                                onClick={() => onRoomClick(room)}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onRoomClick(room); }}
                                tabIndex={0}
                                role="button"
                                aria-label={`View details for room ${room.roomNumber}`}
                            >
                                <div>
                                    <div className="flex justify-between items-start"><h4 className="font-bold text-lg text-teal-700">{room.roomNumber}</h4><div className="flex items-center gap-1 text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full" title="Capacity"><svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" /></svg><span>{room.capacity}</span></div></div>
                                    <p className="text-xs text-gray-500 mt-0.5 truncate" title={`${getBuildingName(room.buildingId)} - ${getFloorName(room.floorId)}`}>{getBuildingName(room.buildingId)} - {getFloorName(room.floorId)}</p>
                                </div>
                                <div>{statsToShow && <OccupancyBar label={statsToShow.label} booked={statsToShow.data.booked} total={statsToShow.data.total} colorClass={statsToShow.colorClass} />}</div>
                                <div className="pt-2 border-t border-gray-200 flex justify-between items-center text-xs">
                                    <span className="flex items-center gap-1 font-medium text-gray-700 truncate" title={`Type: ${getTypeName(room.typeId)}`}><svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-gray-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A1 1 0 012 10V5a1 1 0 011-1h5a1 1 0 01.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>{getTypeName(room.typeId)}</span>
                                     <span className="font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full truncate" title={`Assigned: ${getProgramShortName(room.assignedToPId)}`}>{getProgramShortName(room.assignedToPId)}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="h-full flex items-center justify-center text-center py-10 text-gray-500 italic">
                  <div className="max-w-xs"><svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mx-auto text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg><p>No rooms match the current filters.</p></div>
                </div>
            )}
          </div>
      </div>
    </div>
  );
};

export default RoomListView;
