import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { AttendanceLogEntry, AttendanceStatus, RoomEntry } from '../types';
import * as XLSX from 'xlsx';

interface AttendanceLogViewProps {
  logData: AttendanceLogEntry[];
  onClose: () => void;
  onEditEntry: (logEntry: AttendanceLogEntry) => void;
  onDeleteEntry: (logId: string) => void;
  onClearAll: () => void;
  onToggleMakeupStatus: (logId: string) => void;
  allRooms: RoomEntry[];
  getBuildingName: (buildingId: string) => string;
  getProgramShortName: (pId?: string) => string;
}

type MakeupStatusFilter = 'All' | 'Yes' | 'No';

const exportToXLSX = (data: AttendanceLogEntry[], filename: string, allRooms: RoomEntry[], getBuildingName: (id: string) => string) => {
    if (data.length === 0) {
        alert("There is no data to export.");
        return;
    }

    const headers = [
        "Log Timestamp",
        "Scheduled Date", "Scheduled Time Slot", "Scheduled Room", "Scheduled Building",
        "Status", "Remark",
        "Makeup Date", "Makeup Time Slot", "Makeup Room", "Makeup Building", "Makeup Completed",
        "Course Code", "Course Title", "Section", "Teacher ID", "Teacher Name", "Teacher Designation", "Program ID"
    ];
    
    const dataForSheet = data.map(row => {
        const makeupRoomEntry = row.makeupInfo ? allRooms.find(r => r.roomNumber === row.makeupInfo!.roomNumber) : null;
        const makeupBuildingName = makeupRoomEntry ? getBuildingName(makeupRoomEntry.buildingId) : '';
        return [
            new Date(row.timestamp).toLocaleString(),
            row.date,
            row.timeSlot,
            row.roomNumber,
            row.buildingName,
            row.status,
            row.remark || '',
            row.makeupInfo ? row.makeupInfo.date : '',
            row.makeupInfo ? row.makeupInfo.timeSlot : '',
            row.makeupInfo ? row.makeupInfo.roomNumber : '',
            makeupBuildingName,
            row.makeupInfo ? (row.makeupCompleted ? 'Yes' : 'No') : '',
            row.courseCode,
            row.courseTitle,
            row.section,
            row.teacherId,
            row.teacherName,
            row.teacherDesignation,
            row.pId,
        ];
    });

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...dataForSheet]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance Log");

    const colWidths = headers.map((header, i) => {
        const all_values = [header, ...dataForSheet.map(row => row[i])];
        const maxLength = all_values.reduce((w, r) => Math.max(w, String(r).length), 10);
        return { wch: maxLength + 2 };
    });
    worksheet["!cols"] = colWidths;

    XLSX.writeFile(workbook, filename);
};


const formatDateForDisplay = (isoDate: string): string => {
    if (!isoDate) return 'Invalid Date';
    const date = new Date(isoDate + 'T00:00:00Z'); 
    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
        timeZone: 'UTC'
    }).format(date);
};

const getStatusBadgeColor = (status: AttendanceStatus): string => {
    switch (status) {
        case 'Class is going':
            return 'bg-green-100 text-green-800 border-green-200';
        case 'Students present but teacher absent':
            return 'bg-yellow-100 text-yellow-800 border-yellow-200';
        case 'Teacher present but students are absent':
            return 'bg-blue-100 text-blue-800 border-blue-200';
        case 'Student and Teacher both are absent':
            return 'bg-red-100 text-red-800 border-red-200';
        default:
            return 'bg-gray-100 text-gray-800 border-gray-200';
    }
};

const CalendarIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-full w-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
const ClockIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-full w-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const BuildingIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-full w-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>;

const IconInfoRow = ({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) => (
    <div className="flex items-start gap-3 py-1.5">
        <div className="flex-shrink-0 w-4 h-4 text-gray-400 mt-0.5">{icon}</div>
        <div className="text-gray-800 leading-tight">{children}</div>
    </div>
);

const LogDetailPanel = ({
    logEntry,
    onClose,
    allRooms,
    getBuildingName,
    getProgramShortName
}: {
    logEntry: AttendanceLogEntry,
    onClose: () => void,
    allRooms: RoomEntry[],
    getBuildingName: (id: string) => string
    getProgramShortName: (pId?: string) => string;
}) => {
    const makeupRoomEntry = logEntry.makeupInfo ? allRooms.find(r => r.roomNumber === logEntry.makeupInfo!.roomNumber) : null;
    const makeupBuildingName = makeupRoomEntry ? getBuildingName(makeupRoomEntry.buildingId) : 'N/A';

    const InfoRow = ({ label, value, isLink, href }: { label: string, value: React.ReactNode, isLink?: boolean, href?: string }) => (
        <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-gray-100">
            <dt className="text-gray-500 font-medium">{label}</dt>
            <dd className="col-span-2 text-gray-800">
                {isLink ? <a href={href} className="text-blue-600 hover:underline">{value}</a> : value}
            </dd>
        </div>
    );

    return (
        <div className="flex flex-col h-full animate-fade-in">
            <style>{`.animate-fade-in { animation: fade-in 0.5s ease-out forwards; }`}</style>
            <div className="flex justify-between items-center mb-3 flex-shrink-0">
                <h4 className="font-semibold text-gray-700">Log Details</h4>
                <button onClick={onClose} className="p-1 text-gray-400 hover:bg-gray-200 rounded-full">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
            <div className="flex-grow overflow-y-auto section-detail-scrollbar pr-1 -mr-2 text-xs">
                <dl>
                    <div className="pt-2">
                         <p className="text-gray-500 text-center mb-2">{new Date(logEntry.timestamp).toLocaleString()}</p>
                        <div className={`p-2 rounded-md text-center font-bold my-2 border ${getStatusBadgeColor(logEntry.status)}`}>
                            {logEntry.status}
                        </div>
                        {logEntry.remark && (
                            <p className="text-gray-800 whitespace-pre-wrap bg-gray-50 p-2 rounded-md">{logEntry.remark}</p>
                        )}
                    </div>
                    
                    <div className="pt-2 mt-2 border-t border-gray-200">
                        <h5 className="font-bold text-gray-600 mb-1">Class Info</h5>
                        <InfoRow label="Course" value={<>{logEntry.courseCode}<br/>{logEntry.courseTitle}</>} />
                        <InfoRow label="Section" value={logEntry.section} />
                    </div>

                    <div className="pt-2 mt-2 border-t border-gray-200">
                        <h5 className="font-bold text-gray-600 mb-1">Semester & Program Info</h5>
                        <InfoRow label="Semester" value={logEntry.semester || 'N/A'} />
                        <InfoRow label="Program" value={getProgramShortName(logEntry.pId)} />
                    </div>
                    
                    <div className="pt-2 mt-2 border-t border-gray-200">
                        <h5 className="font-bold text-gray-600 mb-1">Teacher Info</h5>
                        <InfoRow label="Name" value={logEntry.teacherName} />
                        <InfoRow label="Designation" value={logEntry.teacherDesignation} />
                        <InfoRow label="Mobile" value={logEntry.teacherMobile || 'N/A'} isLink={!!(logEntry.teacherMobile && logEntry.teacherMobile !== 'N/A')} href={`tel:${logEntry.teacherMobile}`} />
                        <InfoRow label="Email" value={logEntry.teacherEmail || 'N/A'} isLink={!!(logEntry.teacherEmail && logEntry.teacherEmail !== 'N/A')} href={`mailto:${logEntry.teacherEmail}`} />
                    </div>

                    <div className="pt-2 mt-2 border-t border-gray-200 space-y-4">
                        <div>
                            <h5 className="font-bold text-gray-600 mb-1">Scheduled Class</h5>
                            <IconInfoRow icon={<CalendarIcon />}>
                                {formatDateForDisplay(logEntry.date)}
                            </IconInfoRow>
                            <IconInfoRow icon={<ClockIcon />}>
                                {logEntry.timeSlot}
                            </IconInfoRow>
                            <IconInfoRow icon={<BuildingIcon />}>
                                <div>
                                    {logEntry.roomNumber}
                                    <div className="text-xs text-gray-500">{logEntry.buildingName}</div>
                                </div>
                            </IconInfoRow>
                        </div>

                        {logEntry.makeupInfo && (
                            <div className="pt-4 border-t border-gray-200/60">
                                <h5 className="font-bold text-indigo-600 mb-1">Make-up Class</h5>
                                <IconInfoRow icon={<CalendarIcon />}>
                                    {formatDateForDisplay(logEntry.makeupInfo.date)}
                                </IconInfoRow>
                                <IconInfoRow icon={<ClockIcon />}>
                                    {logEntry.makeupInfo.timeSlot}
                                </IconInfoRow>
                                <IconInfoRow icon={<BuildingIcon />}>
                                    <div>
                                        {logEntry.makeupInfo.roomNumber}
                                        <div className="text-xs text-gray-500">{makeupBuildingName}</div>
                                    </div>
                                </IconInfoRow>
                            </div>
                        )}
                    </div>
                </dl>
            </div>
        </div>
    );
};


const AttendanceLogView: React.FC<AttendanceLogViewProps> = ({ logData, onClose, onEditEntry, onDeleteEntry, onClearAll, onToggleMakeupStatus, allRooms, getBuildingName, getProgramShortName }) => {
    // State for UI
    const [panelMode, setPanelMode] = useState<'closed' | 'filter' | 'detail'>('closed');
    const [selectedLogEntry, setSelectedLogEntry] = useState<AttendanceLogEntry | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(25);

    // State for filters
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<AttendanceStatus[]>([]);
    const [scheduledDateFilter, setScheduledDateFilter] = useState<{ start: string; end: string }>({ start: '', end: '' });
    const [makeupDateFilter, setMakeupDateFilter] = useState<{ start: string; end: string }>({ start: '', end: '' });
    const [makeupStatusFilter, setMakeupStatusFilter] = useState<MakeupStatusFilter>('All');

    // Effect to update the detail panel if the master logData prop changes
    useEffect(() => {
        if (selectedLogEntry) {
            const updatedEntry = logData.find(log => log.id === selectedLogEntry.id);
            if (updatedEntry) {
                // Compare to prevent re-render loops if data is identical
                if (JSON.stringify(updatedEntry) !== JSON.stringify(selectedLogEntry)) {
                    setSelectedLogEntry(updatedEntry);
                }
            } else {
                // The selected entry was deleted, so close the panel
                setSelectedLogEntry(null);
                setPanelMode('closed');
            }
        }
    }, [logData, selectedLogEntry]);


    const uniqueStatuses: AttendanceStatus[] = [
        'Class is going',
        'Students present but teacher absent',
        'Teacher present but students are absent',
        'Student and Teacher both are absent',
    ];

    const handleResetFilters = useCallback(() => {
        setSearchTerm('');
        setStatusFilter([]);
        setScheduledDateFilter({ start: '', end: '' });
        setMakeupDateFilter({ start: '', end: '' });
        setMakeupStatusFilter('All');
    }, []);
    
    const handleRowClick = (entry: AttendanceLogEntry) => {
        if (selectedLogEntry?.id === entry.id && panelMode === 'detail') {
            setPanelMode('closed');
            setSelectedLogEntry(null);
        } else {
            setSelectedLogEntry(entry);
            setPanelMode('detail');
        }
    };
    
    const handleFilterIconClick = () => {
        setSelectedLogEntry(null); // Clear detail view when opening filter
        setPanelMode(prev => prev === 'filter' ? 'closed' : 'filter');
    };
    
    const handleClosePanel = () => {
        setPanelMode('closed');
        setSelectedLogEntry(null);
    }

    const filteredData = useMemo(() => {
        const lowercasedSearch = searchTerm.toLowerCase();
        
        return logData.filter(entry => {
            const searchMatch = !searchTerm ||
                Object.values(entry).some(value => {
                    if (typeof value === 'object' && value !== null) {
                        return Object.values(value).some(subValue => String(subValue).toLowerCase().includes(lowercasedSearch));
                    }
                    return String(value).toLowerCase().includes(lowercasedSearch);
                });
            const statusMatch = statusFilter.length === 0 || statusFilter.includes(entry.status);
            const scheduledDate = new Date(entry.date + 'T00:00:00Z');
            const scheduledStart = scheduledDateFilter.start ? new Date(scheduledDateFilter.start + 'T00:00:00Z') : null;
            const scheduledEnd = scheduledDateFilter.end ? new Date(scheduledDateFilter.end + 'T00:00:00Z') : null;
            const scheduledDateMatch = (!scheduledStart || scheduledDate >= scheduledStart) && (!scheduledEnd || scheduledDate <= scheduledEnd);
            const makeupDate = entry.makeupInfo?.date ? new Date(entry.makeupInfo.date + 'T00:00:00Z') : null;
            const makeupStart = makeupDateFilter.start ? new Date(makeupDateFilter.start + 'T00:00:00Z') : null;
            const makeupEnd = makeupDateFilter.end ? new Date(makeupDateFilter.end + 'T00:00:00Z') : null;
            const makeupDateMatch = (!makeupStart && !makeupEnd) || (makeupDate && (!makeupStart || makeupDate >= makeupStart) && (!makeupEnd || makeupDate <= makeupEnd));
            
            const makeupStatusMatch =
                makeupStatusFilter === 'All'
                ? true
                : makeupStatusFilter === 'Yes'
                ? entry.makeupInfo && entry.makeupCompleted
                : entry.makeupInfo && !entry.makeupCompleted;
            
            return searchMatch && statusMatch && scheduledDateMatch && makeupDateMatch && makeupStatusMatch;
        });
    }, [logData, searchTerm, statusFilter, scheduledDateFilter, makeupDateFilter, makeupStatusFilter]);

    useEffect(() => {
        setCurrentPage(1);
    }, [filteredData.length, itemsPerPage]);

    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    
    const paginatedData = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredData.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredData, currentPage, itemsPerPage]);

    const pendingLogs = useMemo(() => paginatedData.filter(log => !(log.makeupInfo && log.makeupCompleted)), [paginatedData]);
    const completedLogs = useMemo(() => paginatedData.filter(log => log.makeupInfo && log.makeupCompleted), [paginatedData]);

    const handleStatusFilterChange = useCallback((status: AttendanceStatus) => {
        setStatusFilter(prev => prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]);
    }, []);

    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (statusFilter.length > 0) count++;
        if (scheduledDateFilter.start || scheduledDateFilter.end) count++;
        if (makeupDateFilter.start || makeupDateFilter.end) count++;
        if (makeupStatusFilter !== 'All') count++;
        return count;
    }, [statusFilter, scheduledDateFilter, makeupDateFilter, makeupStatusFilter]);

    const handleExport = () => {
        const date = new Date().toISOString().slice(0, 10);
        exportToXLSX(filteredData, `attendance_log_${date}.xlsx`, allRooms, getBuildingName);
    };

    const FilterPanel = () => (
      <div className="flex flex-col h-full animate-fade-in">
          <style>{`.animate-fade-in { animation: fade-in 0.5s ease-out forwards; }`}</style>
          <div className="flex justify-between items-center mb-3 flex-shrink-0">
              <h4 className="font-semibold text-gray-700">Filters</h4>
              <button onClick={handleResetFilters} className="text-xs text-red-600 hover:underline">Reset All ({activeFilterCount})</button>
          </div>
          <div className="flex-grow overflow-y-auto filter-panel-scrollbar pr-1 -mr-2 space-y-4">
              <div>
                  <label className="block text-xs font-medium text-gray-700">Status</label>
                  <div className="mt-1 space-y-1">
                      {uniqueStatuses.map(status => (
                          <label key={status} className="flex items-center text-xs">
                              <input
                                  type="checkbox"
                                  checked={statusFilter.includes(status)}
                                  onChange={() => handleStatusFilterChange(status)}
                                  className="h-3 w-3 rounded text-teal-600 focus:ring-teal-500 border-gray-300"
                              />
                              <span className="ml-2 text-gray-700">{status}</span>
                          </label>
                      ))}
                  </div>
              </div>
              <div>
                  <label className="block text-xs font-medium text-gray-700">Scheduled Date Range</label>
                  <div className="mt-1 grid grid-cols-2 gap-1.5">
                      <input type="date" aria-label="Scheduled start date" value={scheduledDateFilter.start} onChange={e => setScheduledDateFilter(f => ({ ...f, start: e.target.value }))} className="w-full text-xs p-1 border border-gray-300 rounded-md"/>
                      <input type="date" aria-label="Scheduled end date" value={scheduledDateFilter.end} onChange={e => setScheduledDateFilter(f => ({ ...f, end: e.target.value }))} className="w-full text-xs p-1 border border-gray-300 rounded-md"/>
                  </div>
              </div>
              <div>
                  <label className="block text-xs font-medium text-gray-700">Make-up Date Range</label>
                  <div className="mt-1 grid grid-cols-2 gap-1.5">
                      <input type="date" aria-label="Make-up start date" value={makeupDateFilter.start} onChange={e => setMakeupDateFilter(f => ({ ...f, start: e.target.value }))} className="w-full text-xs p-1 border border-gray-300 rounded-md"/>
                      <input type="date" aria-label="Make-up end date" value={makeupDateFilter.end} onChange={e => setMakeupDateFilter(f => ({ ...f, end: e.target.value }))} className="w-full text-xs p-1 border border-gray-300 rounded-md"/>
                  </div>
              </div>
               <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Makeup Status</label>
                  <div className="flex gap-1.5 p-0.5 bg-gray-200 rounded-md">
                    {(['All', 'Yes', 'No'] as const).map(status => (
                      <button
                        key={status}
                        onClick={() => setMakeupStatusFilter(status)}
                        className={`w-full text-center text-xs font-bold px-2 py-1 rounded-sm transition-all duration-200 ${
                          makeupStatusFilter === status
                            ? 'bg-white text-teal-700 shadow-sm'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
              </div>
          </div>
      </div>
    );

    const renderLogRow = (entry: AttendanceLogEntry) => {
        const makeupRoomEntry = entry.makeupInfo ? allRooms.find(r => r.roomNumber === entry.makeupInfo!.roomNumber) : null;
        const makeupBuildingName = makeupRoomEntry ? getBuildingName(makeupRoomEntry.buildingId) : 'N/A';
        const isCompleted = entry.makeupInfo && entry.makeupCompleted;
        return (
            <tr key={entry.id} onClick={() => handleRowClick(entry)} className={`text-xs cursor-pointer transition-colors ${selectedLogEntry?.id === entry.id ? 'bg-teal-50' : 'hover:bg-gray-50'} ${isCompleted ? 'bg-green-50 hover:bg-green-100' : ''}`}>
                <td className="px-3 py-2 align-top"><div className="font-semibold text-gray-800">{formatDateForDisplay(entry.date)}</div><div className="text-gray-500">{entry.timeSlot}</div></td>
                <td className="px-3 py-2 align-top"><div className="font-semibold text-gray-800">{entry.roomNumber}</div><div className="text-gray-500">{entry.buildingName}</div></td>
                <td className="px-3 py-2 align-middle text-center"><span className={`px-2 py-1 leading-4 font-semibold rounded-full border text-[11px] inline-block whitespace-normal ${getStatusBadgeColor(entry.status)}`}>{entry.status}</span></td>
                <td className="px-3 py-2 align-top">{entry.makeupInfo ? (<><div className="font-semibold text-indigo-800">{formatDateForDisplay(entry.makeupInfo.date)}</div><div className="text-indigo-600">{entry.makeupInfo.timeSlot}</div></>) : <span className="text-gray-400 italic">N/A</span>}</td>
                <td className="px-3 py-2 align-top">{entry.makeupInfo ? (<><div className="font-semibold text-indigo-800">{entry.makeupInfo.roomNumber}</div><div className="text-indigo-500">{makeupBuildingName}</div></>) : <span className="text-gray-400 italic">N/A</span>}</td>
                <td className="px-3 py-2 align-middle text-center"><div className="flex justify-center items-center gap-1">
                  {entry.makeupInfo && (
                      <button
                          onClick={(e) => { e.stopPropagation(); onToggleMakeupStatus(entry.id); }}
                          className={`p-1 rounded-full transition-colors ${
                              entry.makeupCompleted
                              ? 'text-green-600 bg-green-100 hover:bg-green-200'
                              : 'text-gray-400 bg-gray-100 hover:bg-gray-200'
                          }`}
                          title={entry.makeupCompleted ? 'Mark as Not Completed' : 'Mark as Completed'}
                          aria-label={entry.makeupCompleted ? 'Mark makeup class as not completed' : 'Mark makeup class as completed'}
                      >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                      </button>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); onEditEntry(entry); }} className="p-1 text-gray-400 hover:text-teal-600 hover:bg-teal-100 rounded-full" title="Edit entry" aria-label="Edit log entry"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg></button>
                  <button onClick={(e) => { e.stopPropagation(); onDeleteEntry(entry.id); }} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-100 rounded-full" title="Delete entry" aria-label="Delete log entry"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                </div></td>
            </tr>
        );
    };

    return (
        <div className="h-full flex flex-row gap-3 overflow-hidden bg-slate-50 p-2 font-sans">
            <aside className={`flex-shrink-0 bg-white rounded-lg shadow-lg border border-gray-200 transition-all duration-300 ease-in-out ${panelMode !== 'closed' ? 'w-72 p-3' : 'w-0 p-0 border-0 overflow-hidden'}`}>
                {panelMode === 'filter' && <FilterPanel />}
                {panelMode === 'detail' && selectedLogEntry && <LogDetailPanel logEntry={selectedLogEntry} onClose={handleClosePanel} allRooms={allRooms} getBuildingName={getBuildingName} getProgramShortName={getProgramShortName} />}
            </aside>

            <div className="h-full flex flex-col flex-grow min-w-0">
                <header className="flex-shrink-0 mb-2 p-3 bg-white rounded-lg shadow-sm border flex items-center justify-between gap-x-3">
                    <div className="flex items-center gap-3 flex-shrink-0">
                        <button onClick={onClose} className="text-sm font-medium text-teal-600 hover:underline">Back</button>
                        <h2 className="text-md font-semibold text-gray-800">Make-up Schedule ({filteredData.length})</h2>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="relative w-64">
                            <div className="flex items-center border border-gray-300 rounded-md bg-white focus-within:ring-1 focus-within:ring-teal-500 focus-within:border-teal-500 transition-all">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><svg className="h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg></div>
                                <input type="search" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search log..." className="block w-full pl-9 pr-10 py-1.5 border-0 rounded-md leading-5 bg-transparent placeholder-gray-500 focus:outline-none focus:ring-0 sm:text-sm" />
                                <div className="absolute inset-y-0 right-0 flex items-center">
                                    <button onClick={handleFilterIconClick} className="p-1.5 text-gray-400 hover:text-gray-600 focus:outline-none rounded-full mr-1 relative" aria-label="Toggle filters" aria-expanded={panelMode === 'filter'}>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                                        {activeFilterCount > 0 && (<span className="absolute -top-1 -right-1 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-teal-500"></span></span>)}
                                    </button>
                                </div>
                            </div>
                        </div>
                        <button onClick={handleExport} className="p-2 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-md border border-blue-200" title="Export current view to CSV"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg></button>
                    </div>
                </header>
                <div className="flex-grow bg-white rounded-lg shadow-sm border overflow-auto custom-scrollbar min-w-0">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="sticky top-0 bg-gray-50 z-10"><tr>
                        <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Date & Time</th>
                        <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Room</th>
                        <th className="px-3 py-2 text-center text-xs font-bold text-gray-500 uppercase tracking-wider align-middle">Status</th>
                        <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Make-up Date & Time</th>
                        <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Make-up Room</th>
                        <th className="px-3 py-2 text-center text-xs font-bold text-gray-500 uppercase tracking-wider align-middle">Actions</th>
                    </tr></thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {paginatedData.length > 0 ? (
                        <>
                            {pendingLogs.map(renderLogRow)}
                            {completedLogs.length > 0 && (
                                <tr>
                                    <td colSpan={6} className="px-3 py-2 bg-green-200 text-left font-bold text-green-800 text-xs uppercase tracking-wider">
                                        Completed Makeup Classes
                                    </td>
                                </tr>
                            )}
                            {completedLogs.map(renderLogRow)}
                        </>
                      ) : (<tr><td colSpan={6} className="text-center py-10"><div className="flex flex-col items-center justify-center text-gray-500 p-4"><svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg><p className="font-semibold text-lg mt-2">{logData.length === 0 ? "The Attendance Log is Empty" : "No Entries Match Your Search"}</p><p className="text-sm mt-1">{logData.length === 0 ? "Log attendance from the routine grid to see records here." : "Try adjusting your filters."}</p></div></td></tr>)}
                    </tbody>
                  </table>
                </div>
                <div className="flex-shrink-0 pt-2 flex justify-between items-center text-xs">
                    <div>
                        <span className="mr-2">Items per page:</span>
                        <select value={itemsPerPage} onChange={e => setItemsPerPage(Number(e.target.value))} className="p-1 border border-gray-300 rounded-md">
                            <option value={10}>10</option><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option>
                        </select>
                    </div>
                    {totalPages > 1 && (<div className="flex items-center gap-2">
                            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-2 py-1 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50">&laquo; Prev</button>
                            <span className="text-gray-600 font-medium">Page {currentPage} of {totalPages}</span>
                            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-2 py-1 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50">Next &raquo;</button>
                        </div>)}
                </div>
            </div>
        </div>
    );
};

export default AttendanceLogView;