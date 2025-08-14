import React, { useState, useMemo, useCallback, ChangeEvent, useEffect, useRef } from 'react';
import { RoomEntry, BuildingEntry, FloorEntry, ProgramEntry, RoomCategoryEntry, RoomTypeEntry, User, FullRoutineData } from '../types';
import { useRooms } from '../contexts/RoomContext';
import SearchableProgramDropdownForRooms from './SearchableProgramDropdownForRooms';
import RoomDataTools from './RoomDataTools';

interface RoomMasterViewProps {
    user: User | null;
    rooms: RoomEntry[];
    onClose: () => void;
    getBuildingName: (buildingId: string) => string;
    getFloorName: (floorId: string) => string;
    getProgramShortName: (pId?: string) => string;
    getTypeName: (typeId: string) => string;
    getOccupancyStats: (room: RoomEntry) => { theory: { booked: number; total: number; }; lab: { booked: number; total: number; }; };
    allBuildings: BuildingEntry[];
    allFloors: FloorEntry[];
    onRoomClick: (room: RoomEntry) => void;
    allPrograms: ProgramEntry[];
    allCategories: RoomCategoryEntry[];
    allRoomTypes: RoomTypeEntry[];
    uniqueSemesters: string[];
    routineData: { [semesterId: string]: FullRoutineData };
}

// Reusable Filter Components
const CheckboxFilterGroup = ({ title, options, selected, onChange }: { title: string, options: {id: string; name: string}[], selected: string[], onChange: (value: string) => void }) => (
    <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">{title}</label>
        <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar pr-1">
            {options.map(option => (
                <label key={option.id} className="flex items-center text-xs">
                    <input
                        type="checkbox"
                        checked={selected.includes(option.id)}
                        onChange={() => onChange(option.id)}
                        className="h-3 w-3 rounded text-teal-600 focus:ring-teal-500 border-gray-300"
                    />
                    <span className="ml-2 text-gray-700">{option.name}</span>
                </label>
            ))}
        </div>
    </div>
);

const MinMaxInputGroup = ({ label, value, onChange }: { label: string, value: { min: number | ''; max: number | '' }, onChange: (key: 'min' | 'max', val: string) => void }) => (
    <div>
        <label className="block text-xs font-medium text-gray-700">{label}</label>
        <div className="mt-1 flex items-center gap-1">
            <input type="number" placeholder="Min" min="0" value={value.min} onChange={e => onChange('min', e.target.value)} className="w-full text-xs p-1 border border-gray-300 rounded-md" />
            <span className="text-gray-500 text-xs">-</span>
            <input type="number" placeholder="Max" min="0" value={value.max} onChange={e => onChange('max', e.target.value)} className="w-full text-xs p-1 border border-gray-300 rounded-md" />
        </div>
    </div>
);

const RoomMasterView: React.FC<RoomMasterViewProps> = ({ user, rooms, onClose, getBuildingName, getFloorName, getProgramShortName, getTypeName, getOccupancyStats, allBuildings, allFloors, onRoomClick, allPrograms, allCategories, allRoomTypes, uniqueSemesters, routineData }) => {
    const { deleteRoom } = useRooms();
    const [isFilterPanelVisible, setIsFilterPanelVisible] = useState(false);

    // Filter states
    const [searchTerm, setSearchTerm] = useState('');
    const [semesterFilter, setSemesterFilter] = useState<string | null>(null);
    const [buildingFilter, setBuildingFilter] = useState<string[]>([]);
    const [floorFilter, setFloorFilter] = useState<string[]>([]);
    const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
    const [typeFilter, setTypeFilter] = useState<string[]>([]);
    const [assignedProgramFilter, setAssignedProgramFilter] = useState<string[]>([]);
    const [capacityFilter, setCapacityFilter] = useState<{ min: number | ''; max: number | '' }>({ min: '', max: '' });

    const onResetFilters = useCallback(() => {
        setSearchTerm('');
        setSemesterFilter(null);
        setBuildingFilter([]);
        setFloorFilter([]);
        setCategoryFilter([]);
        setTypeFilter([]);
        setAssignedProgramFilter([]);
        setCapacityFilter({ min: '', max: '' });
    }, []);

    // Filter options
    const buildingOptions = useMemo(() => allBuildings.map(b => ({ id: b.id, name: b.buildingName })).sort((a,b) => a.name.localeCompare(b.name)), [allBuildings]);
    const floorOptions = useMemo(() => {
        if (buildingFilter.length === 0) return allFloors.map(f => ({ id: f.id, name: f.floorName })).sort((a,b) => a.name.localeCompare(b.name));
        return allFloors.filter(f => buildingFilter.includes(f.buildingId)).map(f => ({ id: f.id, name: f.floorName })).sort((a,b) => a.name.localeCompare(b.name));
    }, [allFloors, buildingFilter]);
    const categoryOptions = useMemo(() => allCategories.map(c => ({ id: c.id, name: c.categoryName })).sort((a,b) => a.name.localeCompare(b.name)), [allCategories]);
    const typeOptions = useMemo(() => allRoomTypes.map(t => ({ id: t.id, name: t.typeName })).sort((a,b) => a.name.localeCompare(b.name)), [allRoomTypes]);

    const filteredRooms = useMemo(() => {
        const lowerSearch = searchTerm.toLowerCase();
        const minCap = capacityFilter.min !== '' ? Number(capacityFilter.min) : 0;
        const maxCap = capacityFilter.max !== '' ? Number(capacityFilter.max) : Infinity;

        return rooms.filter(room => {
            if (searchTerm && !room.roomNumber.toLowerCase().includes(lowerSearch)) return false;
            if (semesterFilter && room.semesterId !== semesterFilter) return false;
            if (buildingFilter.length > 0 && !buildingFilter.includes(room.buildingId)) return false;
            if (floorFilter.length > 0 && !floorFilter.includes(room.floorId)) return false;
            if (categoryFilter.length > 0 && !categoryFilter.includes(room.categoryId)) return false;
            if (typeFilter.length > 0 && !typeFilter.includes(room.typeId)) return false;
            if (assignedProgramFilter.length > 0 && (!room.assignedToPId || !assignedProgramFilter.includes(room.assignedToPId))) return false;
            if (room.capacity < minCap || room.capacity > maxCap) return false;
            return true;
        });
    }, [rooms, searchTerm, semesterFilter, buildingFilter, floorFilter, categoryFilter, typeFilter, assignedProgramFilter, capacityFilter]);
    
    const activeFilterCount = useMemo(() => {
        return (searchTerm ? 1 : 0) + (semesterFilter ? 1 : 0) + (buildingFilter.length > 0 ? 1 : 0) + (floorFilter.length > 0 ? 1 : 0) +
               (categoryFilter.length > 0 ? 1 : 0) + (typeFilter.length > 0 ? 1 : 0) + (assignedProgramFilter.length > 0 ? 1 : 0) +
               (capacityFilter.min !== '' || capacityFilter.max !== '' ? 1 : 0);
    }, [searchTerm, semesterFilter, buildingFilter, floorFilter, categoryFilter, typeFilter, assignedProgramFilter, capacityFilter]);


    const handleDeleteRoom = useCallback((roomToDelete: RoomEntry) => {
        for (const semesterId in routineData) {
            const semesterRoutine = routineData[semesterId];
            if (semesterRoutine) {
                for (const day of Object.values(semesterRoutine)) {
                    if (day[roomToDelete.roomNumber] && Object.keys(day[roomToDelete.roomNumber]).length > 0) {
                        alert(`Cannot delete Room ${roomToDelete.roomNumber}. It has classes assigned in the "${semesterId}" semester routine.`);
                        return;
                    }
                }
            }
        }

        if (window.confirm(`Are you sure you want to delete Room ${roomToDelete.roomNumber}? This action cannot be undone.`)) {
            deleteRoom(roomToDelete.id);
        }
    }, [routineData, deleteRoom]);

    const FilterPanel = () => (
        <div className="flex flex-col h-full animate-fade-in">
            <style>{`.animate-fade-in { animation: fade-in 0.5s ease-out forwards; }`}</style>
            <div className="flex justify-between items-center mb-3 flex-shrink-0">
                <h4 className="font-semibold text-gray-700">Filters</h4>
                <button onClick={onResetFilters} className="text-xs text-red-600 hover:underline">Reset All ({activeFilterCount})</button>
            </div>
            <div className="flex-grow overflow-y-auto filter-panel-scrollbar pr-1 -mr-2 space-y-4">
                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Semester</label>
                    <select value={semesterFilter || ''} onChange={(e) => setSemesterFilter(e.target.value || null)} className="w-full text-xs p-1 border border-gray-300 rounded-md">
                        <option value="">All Semesters</option>
                        {uniqueSemesters.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
                <CheckboxFilterGroup title="Building" options={buildingOptions} selected={buildingFilter} onChange={(id) => setBuildingFilter(prev => prev.includes(id) ? prev.filter(bId => bId !== id) : [...prev, id])} />
                <CheckboxFilterGroup title="Floor" options={floorOptions} selected={floorFilter} onChange={(id) => setFloorFilter(prev => prev.includes(id) ? prev.filter(fId => fId !== id) : [...prev, id])} />
                <CheckboxFilterGroup title="Category" options={categoryOptions} selected={categoryFilter} onChange={(id) => setCategoryFilter(prev => prev.includes(id) ? prev.filter(cId => cId !== id) : [...prev, id])} />
                <CheckboxFilterGroup title="Type" options={typeOptions} selected={typeFilter} onChange={(id) => setTypeFilter(prev => prev.includes(id) ? prev.filter(tId => tId !== id) : [...prev, id])} />
                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Assigned Program</label>
                    <SearchableProgramDropdownForRooms
                        idSuffix="room-master-filter"
                        programs={allPrograms}
                        selectedPIds={assignedProgramFilter}
                        onPIdsChange={setAssignedProgramFilter}
                        multiSelect={true}
                        placeholderText="Any Program"
                    />
                </div>
                <MinMaxInputGroup label="Capacity" value={capacityFilter} onChange={(key, val) => setCapacityFilter(prev => ({ ...prev, [key]: val }))} />
            </div>
        </div>
    );
    
    return (
        <div className="h-full flex flex-row gap-3 overflow-hidden bg-slate-50 p-2 font-sans">
            <aside className={`flex-shrink-0 bg-white rounded-lg shadow-lg border border-gray-200 transition-all duration-300 ease-in-out ${isFilterPanelVisible ? 'w-64 p-3' : 'w-0 p-0 border-0 overflow-hidden'}`}>
                {isFilterPanelVisible && <FilterPanel />}
            </aside>
            <div className="h-full flex flex-col flex-grow min-w-0">
                <header className="flex-shrink-0 mb-2 p-3 bg-white rounded-lg shadow-sm border flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={onClose} className="text-sm font-medium text-teal-600 hover:underline flex items-center gap-1">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z" />
                            </svg>
                            Back to Dashboard
                        </button>
                    </div>
                    <h3 className="text-md font-semibold text-gray-800">Room Master List ({filteredRooms.length})</h3>
                    <div className="flex items-center gap-2">
                        <div className="relative w-64">
                             <div className="flex items-center border border-gray-300 rounded-md bg-white focus-within:ring-1 focus-within:ring-teal-500 focus-within:border-teal-500 transition-all">
                                 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><svg className="h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg></div>
                                <input type="search" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search room number..." className="block w-full pl-9 pr-10 py-1.5 border-0 rounded-md leading-5 bg-transparent placeholder-gray-500 focus:outline-none focus:ring-0 sm:text-sm" />
                                <div className="absolute inset-y-0 right-0 flex items-center">
                                    <button onClick={() => setIsFilterPanelVisible(prev => !prev)} className="p-1.5 text-gray-400 hover:text-gray-600 focus:outline-none rounded-full mr-1 relative" aria-label="Toggle filters">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                                        {activeFilterCount > 0 && (
                                            <span className="absolute -top-1 -right-1 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-teal-500"></span></span>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <RoomDataTools
                                dataToDownload={filteredRooms}
                                canImport={user?.roomEditAccess?.canImportRoomData}
                                canExport={user?.roomEditAccess?.canExportRoomData}
                            />
                        </div>
                    </div>
                </header>
                <main className="flex-grow bg-white rounded-lg shadow-sm border overflow-auto custom-scrollbar min-w-0 p-3">
                    {filteredRooms.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
                            {filteredRooms.map(room => (
                                <div
                                    key={room.id}
                                    className="group relative bg-white rounded-lg shadow border border-gray-200 p-2.5 flex flex-col justify-between hover:shadow-md transition-shadow duration-150 h-32 cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
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
                                    <div className="pt-2 border-t border-gray-200 flex justify-between items-center text-xs">
                                        <span className="flex items-center gap-1 font-medium text-gray-700 truncate" title={`Type: ${getTypeName(room.typeId)}`}><svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-gray-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A1 1 0 012 10V5a1 1 0 011-1h5a1 1 0 01.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>{getTypeName(room.typeId)}</span>
                                        <span className="font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full truncate" title={`Assigned: ${getProgramShortName(room.assignedToPId)}`}>{getProgramShortName(room.assignedToPId)}</span>
                                    </div>
                                    {user?.roomEditAccess?.canDeleteRoom && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteRoom(room);
                                            }}
                                            className="absolute top-1 right-1 z-10 p-1 bg-white/70 backdrop-blur-sm text-red-500 hover:bg-red-100 hover:text-red-700 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                            title={`Delete Room ${room.roomNumber}`}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-10 text-gray-500">No rooms match the current filters.</div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default RoomMasterView;