import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import BasePanel from './BasePanel';
import Modal from '../Modal';
import { PendingChange, User, ProgramEntry, ClassDetail, Notification, RoomEntry } from '../../types';

// --- Virtualizer Hook ---
// A custom hook to implement list virtualization for performance.
const useVirtualizer = ({
  itemHeight,
  itemCount,
  containerRef,
}: {
  itemHeight: number;
  itemCount: number;
  containerRef: React.RefObject<HTMLDivElement>;
}) => {
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  const handleScroll = useCallback((e: Event) => {
    setScrollTop((e.target as HTMLDivElement).scrollTop);
  }, []);
  
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
        setContainerHeight(container.clientHeight);
        container.addEventListener('scroll', handleScroll, { passive: true });

        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                setContainerHeight(entry.contentRect.height);
            }
        });
        resizeObserver.observe(container);

        return () => {
            container.removeEventListener('scroll', handleScroll);
            resizeObserver.disconnect();
        };
    }
  }, [containerRef, handleScroll]);

  const OVERSCAN_COUNT = 5;
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - OVERSCAN_COUNT);
  const visibleItemCount = Math.ceil(containerHeight / itemHeight);
  const endIndex = Math.min(itemCount, startIndex + visibleItemCount + (2 * OVERSCAN_COUNT));
  
  const virtualItems = useMemo(() => {
    const items = [];
    for (let i = startIndex; i < endIndex; i++) {
        items.push({
            index: i,
            style: {
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${itemHeight}px`,
                transform: `translateY(${i * itemHeight}px)`,
            },
        });
    }
    return items;
  }, [startIndex, endIndex, itemHeight]);

  return {
    virtualItems,
    totalHeight: itemCount * itemHeight,
  };
};


// --- UI Components ---
const formatDate = (isoString: string): string => new Date(isoString).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });

const PendingChangeCard = React.memo(({
    change,
    onApprove,
    onReject,
    onOpenSelectiveApprovalModal,
}: {
    change: PendingChange;
    onApprove: (id: string) => void;
    onReject: (id: string) => void;
    onOpenSelectiveApprovalModal: (change: PendingChange) => void;
}) => {
    const isAssign = !!change.requestedClassInfo;
    const isMove = !!change.source;

    const actionColor = isMove ? 'text-purple-700' : (isAssign ? 'text-green-700' : 'text-red-700');
    const actionBg = isMove ? 'bg-purple-100/70' : (isAssign ? 'bg-green-100/70' : 'bg-red-100/70');
    const borderColorClass = isMove ? 'border-purple-500' : (isAssign ? 'border-green-500' : 'border-red-500');

    const getActionTitle = () => {
        if (isMove && change.requestedClassInfo) return `MOVE: ${change.requestedClassInfo.courseCode} (${change.requestedClassInfo.section})`;
        if (isAssign) return `ASSIGN: ${change.requestedClassInfo!.courseCode} (${change.requestedClassInfo!.section})`;
        return 'REQUEST: CLEAR SLOT';
    };

    const getActionDescription = () => {
        if (isMove) return `Teacher: ${change.requestedClassInfo!.teacher}`;
        if (isAssign) return `Teacher: ${change.requestedClassInfo!.teacher}`;
        return 'Mark this slot as free.';
    };
    
    const handleApproveClick = () => {
        if (!change.isBulkUpdate && change.dates && change.dates.length > 1) {
            onOpenSelectiveApprovalModal(change);
        } else {
            onApprove(change.id);
        }
    };

    return (
        <div className="relative group p-2.5 bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col space-y-2.5 overflow-hidden">
            {/* Header: Requester & Date */}
            <div className="flex justify-between items-center text-xs">
                <div className="font-semibold text-gray-700 flex items-center gap-1.5">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
                    <span className="truncate">{change.requesterName}</span>
                </div>
                <span className="text-gray-500 flex-shrink-0">{formatDate(change.timestamp)}</span>
            </div>

            {/* Request Details */}
            <div className={`p-2 rounded-md ${actionBg} border-l-4 ${borderColorClass}`}>
                <p className={`font-bold text-sm ${actionColor} truncate`} title={getActionTitle()}>
                    {getActionTitle()}
                </p>
                <p className="text-xs text-gray-600 mt-0.5 truncate" title={getActionDescription()}>{getActionDescription()}</p>
            </div>

            {/* Context & Badge */}
            <div className="flex justify-between items-end">
                {isMove && change.source ? (
                    <div className="text-xs text-gray-600 space-y-1">
                        <div className="flex items-center gap-1.5" title={`From ${change.source.roomNumber} at ${change.source.slotString} on ${change.source.day}`}>
                            <span className="font-semibold text-gray-500 w-10">FROM:</span>
                            <span className="font-semibold text-gray-800">{change.source.roomNumber}</span>
                            <span className="truncate">{change.source.slotString}</span>
                            <span>({change.source.day.substring(0,3)})</span>
                        </div>
                         <div className="flex items-center gap-1.5" title={`To ${change.roomNumber} at ${change.slotString} on ${change.day}`}>
                            <span className="font-semibold text-gray-500 w-10">TO:</span>
                            <span className="font-semibold text-gray-800">{change.roomNumber}</span>
                            <span className="truncate">{change.slotString}</span>
                            <span>({change.day.substring(0,3)})</span>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-1 text-xs text-gray-600 min-w-0">
                        <div className="flex items-center gap-1.5 truncate" title={`${change.roomNumber} at ${change.slotString}`}><svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" viewBox="0 0 20 20" fill="currentColor"><path d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" /></svg><span className="font-semibold text-gray-800 whitespace-nowrap">{change.roomNumber}</span> at <span className="truncate">{change.slotString}</span></div>
                        <div className="flex items-center gap-1.5" title={change.isBulkUpdate ? "Day of Week" : "Specific Date(s)"}><svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" /></svg><span className="font-semibold text-gray-800 truncate">{change.isBulkUpdate ? change.day : (change.dates || []).map(d => new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', { day: 'numeric', month: 'short' })).join(', ')}</span></div>
                    </div>
                )}
                <div className="flex flex-col items-end gap-1.5">
                     <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${change.isBulkUpdate ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                        {change.isBulkUpdate ? 'DEFAULT' : `MAKE-UP (${(change.dates || []).length})`}
                    </span>
                </div>
            </div>

            {/* Hover Action Bar */}
            <div className="absolute bottom-0 left-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-in-out flex justify-end items-center bg-gradient-to-t from-white via-white/90 to-transparent rounded-b-lg">
                <div className="flex gap-2">
                    <button onClick={() => onReject(change.id)} className="px-3 py-1 text-xs font-semibold text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-md shadow">Reject</button>
                    <button onClick={handleApproveClick} className="px-3 py-1 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-md shadow">Approve</button>
                </div>
            </div>
        </div>
    );
});
PendingChangeCard.displayName = 'PendingChangeCard';

const NotificationItem = React.memo(({
    notification,
    onMarkAsRead
}: {
    notification: Notification;
    onMarkAsRead: (id: string) => void;
}) => {
    const icons = {
        approval: (
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
            </div>
        ),
        rejection: (
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-600" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
            </div>
        ),
        info: (
             <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
            </div>
        ),
    };
    
    return (
        <div
            onClick={() => !notification.isRead && onMarkAsRead(notification.id)}
            className={`p-2.5 rounded-lg border-l-4 flex items-center gap-3 transition-colors ${
                notification.isRead 
                    ? 'bg-white border-gray-200 shadow-sm' 
                    : 'bg-blue-50 border-blue-400 cursor-pointer hover:bg-blue-100 shadow'
            }`}
        >
            <div className="flex-shrink-0 relative">
                {icons[notification.type]}
                {!notification.isRead && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500 border border-white"></span>
                    </span>
                )}
            </div>
            <div className="flex-grow min-w-0">
                <div className="flex justify-between items-start text-xs">
                    <h4 className={`font-semibold text-sm ${
                        notification.type === 'approval' ? 'text-green-800' :
                        notification.type === 'rejection' ? 'text-red-800' : 'text-gray-800'
                    }`}>
                        {notification.title}
                    </h4>
                    <span className="text-gray-400 flex-shrink-0 ml-2">{formatDate(notification.timestamp)}</span>
                </div>
                <p className="text-xs text-gray-600 mt-1">{notification.message}</p>
            </div>
        </div>
    );
});
NotificationItem.displayName = 'NotificationItem';

const SelectiveApprovalModal: React.FC<{
    change: PendingChange | null;
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (changeId: string, dates: string[]) => void;
}> = ({ change, isOpen, onClose, onConfirm }) => {
    const [selectedDates, setSelectedDates] = useState<string[]>([]);
    
    useEffect(() => {
        if (change?.dates) {
            setSelectedDates(change.dates);
        }
    }, [change]);

    const handleToggleDate = (date: string) => {
        setSelectedDates(prev => prev.includes(date) ? prev.filter(d => d !== date) : [...prev, date]);
    };
    
    const allDatesSelected = useMemo(() => {
        return change?.dates && selectedDates.length === change.dates.length;
    }, [selectedDates, change]);

    const handleToggleAll = () => {
        if (allDatesSelected) {
            setSelectedDates([]);
        } else {
            setSelectedDates(change?.dates || []);
        }
    };
    
    const handleConfirmClick = () => {
        if (change && selectedDates.length > 0) {
            onConfirm(change.id, selectedDates);
        }
    };
    
    const footerContent = (
        <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-md">
                Cancel
            </button>
            <button
                onClick={handleConfirmClick}
                disabled={selectedDates.length === 0}
                className="px-3 py-1.5 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-md disabled:bg-gray-400"
            >
                Approve {selectedDates.length > 0 ? `(${selectedDates.length})` : ''} Selected
            </button>
        </div>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Selective Approval"
            subTitle={`Select which dates to approve for Room ${change?.roomNumber}`}
            footerContent={footerContent}
            maxWidthClass="max-w-md"
        >
            <div className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                    <label htmlFor="select-all-dates" className="flex items-center text-sm font-medium text-gray-700 cursor-pointer">
                        <input
                            type="checkbox"
                            id="select-all-dates"
                            checked={allDatesSelected}
                            onChange={handleToggleAll}
                            className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                        />
                        <span className="ml-2">Select All / Deselect All</span>
                    </label>
                    <span className="text-sm text-gray-500">{selectedDates.length} / {change?.dates?.length || 0} selected</span>
                </div>
                <div className="max-h-60 overflow-y-auto custom-scrollbar pr-2 -mr-2 space-y-2">
                    {change?.dates?.map(date => (
                        <label key={date} className="flex items-center p-2 rounded-md hover:bg-gray-100 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={selectedDates.includes(date)}
                                onChange={() => handleToggleDate(date)}
                                className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                            />
                            <span className="ml-3 text-sm text-gray-800">{formatDate(date)}</span>
                        </label>
                    ))}
                </div>
            </div>
        </Modal>
    );
};

const PENDING_CHANGE_ITEM_HEIGHT = 150;
const NOTIFICATION_ITEM_HEIGHT = 85; 

// --- Main Panel Component ---
interface NotificationPanelProps {
  user: User | null;
  onClose: () => void;
  pendingChanges: PendingChange[];
  onApprove: (changeId: string, dates?: string[]) => void;
  onReject: (changeId: string) => void;
  allPrograms: ProgramEntry[];
  allRooms: RoomEntry[];
  notifications: Notification[];
  markNotificationAsRead: (notificationId: string) => void;
  markAllNotificationsAsRead: () => void;
}

const NotificationPanel: React.FC<NotificationPanelProps> = ({ 
    user, 
    onClose, 
    pendingChanges, 
    onApprove, 
    onReject, 
    allPrograms,
    allRooms,
    notifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
}) => {
    
    const canApprove = user?.role === 'admin' || user?.notificationAccess?.canApproveSlots;
    const [activeTab, setActiveTab] = useState<'requests' | 'myNotifications'>(canApprove ? 'requests' : 'myNotifications');
    const [approvalModalChange, setApprovalModalChange] = useState<PendingChange | null>(null);


    const filteredPendingChanges = useMemo(() => {
        if (!user || !canApprove) {
            return [];
        }
        if (user.role === 'admin') {
            return pendingChanges;
        }

        const accessiblePIds = new Set(user.accessibleProgramPIds || []);
        if (accessiblePIds.size === 0) {
            return [];
        }
        
        return pendingChanges.filter(change => {
            const room = allRooms.find(r => r.roomNumber === change.roomNumber && r.semesterId === change.semesterId);
            if (!room || !room.assignedToPId) {
                return false;
            }
            return accessiblePIds.has(room.assignedToPId);
        });
    }, [pendingChanges, user, canApprove, allRooms]);

    const userNotifications = useMemo(() => {
        if (!user) return [];
        return notifications
            .filter(n => n.userId === user.id)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [notifications, user]);

    const unreadCount = useMemo(() => userNotifications.filter(n => !n.isRead).length, [userNotifications]);

    // Virtualization setup
    const requestsContainerRef = useRef<HTMLDivElement>(null);
    const notificationsContainerRef = useRef<HTMLDivElement>(null);
    
    const requestsVirtualizer = useVirtualizer({
        itemHeight: PENDING_CHANGE_ITEM_HEIGHT,
        itemCount: filteredPendingChanges.length,
        containerRef: requestsContainerRef,
    });
    
    const notificationsVirtualizer = useVirtualizer({
        itemHeight: NOTIFICATION_ITEM_HEIGHT,
        itemCount: userNotifications.length,
        containerRef: notificationsContainerRef,
    });


    const panelFooter = (
        <div className="text-xs text-center text-gray-500 flex justify-center items-center gap-4">
            {canApprove && (
                <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-amber-400"></span>
                    <span className="font-medium text-gray-700">{filteredPendingChanges.length}</span> Pending Requests
                </span>
            )}
            <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-red-500"></span>
                <span className="font-medium text-gray-700">{unreadCount}</span> Unread Notifications
            </span>
        </div>
    );
    
    const getTabButtonClasses = (tabName: 'requests' | 'myNotifications') => {
        const base = 'whitespace-nowrap pb-2 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2';
        if (activeTab === tabName) {
            return `${base} border-teal-500 text-teal-600`;
        }
        return `${base} border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300`;
    };

    const getTabBadgeClasses = (isActive: boolean) => {
        return `px-2 py-0.5 rounded-full text-xs font-semibold ${isActive ? 'bg-teal-500 text-white' : 'bg-gray-200 text-gray-600'}`;
    };

  return (
    <>
    <BasePanel title="Inbox" onClose={onClose} footerContent={panelFooter}>
      <div className="flex flex-col h-full">
        <div className="flex-shrink-0 border-b border-gray-200 mb-3">
            <nav className="-mb-px flex space-x-4" aria-label="Tabs">
                {canApprove && (
                    <button
                        onClick={() => setActiveTab('requests')}
                        className={getTabButtonClasses('requests')}
                        aria-current={activeTab === 'requests' ? 'page' : undefined}
                    >
                        Requests for you
                        {filteredPendingChanges.length > 0 && <span className={getTabBadgeClasses(activeTab === 'requests')}>{filteredPendingChanges.length}</span>}
                    </button>
                )}
                <button
                    onClick={() => setActiveTab('myNotifications')}
                    className={getTabButtonClasses('myNotifications')}
                    aria-current={activeTab === 'myNotifications' ? 'page' : undefined}
                >
                    My Notifications
                    {unreadCount > 0 && <span className={getTabBadgeClasses(activeTab === 'myNotifications')}>{unreadCount}</span>}
                </button>
            </nav>
        </div>
        
        <div className="flex-grow min-h-0 overflow-x-hidden">
            {activeTab === 'requests' && canApprove && (
                <div ref={requestsContainerRef} className="h-full overflow-y-auto custom-scrollbar -mr-1 pr-1">
                    {filteredPendingChanges.length > 0 ? (
                        <div style={{ height: `${requestsVirtualizer.totalHeight}px`, position: 'relative' }}>
                            {requestsVirtualizer.virtualItems.map(item => (
                                <div key={item.index} style={item.style} className="px-1 py-1">
                                    <PendingChangeCard
                                        change={filteredPendingChanges[item.index]}
                                        onApprove={onApprove}
                                        onReject={onReject}
                                        onOpenSelectiveApprovalModal={setApprovalModalChange}
                                    />
                                </div>
                            ))}
                        </div>
                    ) : (
                       <div className="text-center py-10 px-3 text-gray-500 bg-gray-50 rounded-md flex flex-col justify-center items-center shadow-inner h-full">
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                               <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                           </svg>
                           <p className="font-semibold">All Caught Up</p>
                           <p className="text-xs mt-1">
                              {pendingChanges.length > 0 ? "There are no pending changes matching your program access." : "There are no pending schedule changes for your review."}
                           </p>
                       </div>
                    )}
                </div>
            )}

            {activeTab === 'myNotifications' && (
                <div className="flex flex-col h-full">
                    {userNotifications.length > 0 && unreadCount > 0 && (
                        <div className="text-right mb-2 flex-shrink-0">
                            <button onClick={markAllNotificationsAsRead} className="text-xs text-teal-600 hover:underline font-semibold">
                                Mark all as read
                            </button>
                        </div>
                    )}
                    <div ref={notificationsContainerRef} className="flex-grow min-h-0 overflow-y-auto custom-scrollbar -mr-1 pr-1">
                        {userNotifications.length > 0 ? (
                            <div style={{ height: `${notificationsVirtualizer.totalHeight}px`, position: 'relative' }}>
                               {notificationsVirtualizer.virtualItems.map(item => (
                                    <div key={item.index} style={item.style} className="px-1 py-1">
                                        <NotificationItem
                                            notification={userNotifications[item.index]}
                                            onMarkAsRead={markNotificationAsRead}
                                        />
                                    </div>
                                ))}
                            </div>
                        ) : (
                           <div className="text-center py-10 px-3 text-gray-500 bg-gray-50 rounded-md flex flex-col justify-center items-center shadow-inner h-full">
                               <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                               </svg>
                               <p className="font-semibold">No notifications yet</p>
                               <p className="text-xs mt-1">Approvals and rejections for your requests will appear here.</p>
                           </div>
                        )}
                    </div>
                </div>
            )}
        </div>
      </div>
    </BasePanel>
    <SelectiveApprovalModal
        change={approvalModalChange}
        isOpen={!!approvalModalChange}
        onClose={() => setApprovalModalChange(null)}
        onConfirm={(changeId, dates) => {
            onApprove(changeId, dates);
            setApprovalModalChange(null);
        }}
    />
    </>
  );
};

export default NotificationPanel;