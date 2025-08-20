import React, { lazy, Suspense, useMemo, useState, useEffect, useCallback } from 'react';
import { ProgramProvider } from './contexts/ProgramContext'; 
import { BuildingProvider } from './contexts/BuildingContext'; 
import { FloorProvider } from './contexts/FloorContext';
import { RoomCategoryProvider } from './contexts/RoomCategoryContext';
import { RoomTypeProvider } from './contexts/RoomTypeContext';
import { RoomProvider } from './contexts/RoomContext';
import { useAuth } from './contexts/AuthContext';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import LoginScreen from './components/LoginScreen';
import RoomDetailModal from './components/modals/RoomDetailModal'; 
import DayTimeSlotDetailModal from './components/modals/DayTimeSlotDetailModal';
import SlotDetailModal from './components/modals/SlotDetailModal';
import ConflictResolutionModal from './components/modals/ConflictResolutionModal';
import Modal from './components/Modal';
import { useAppLogic } from './hooks/useAppLogic';
import { useModalManager } from './hooks/useModalManager';
import { generateTeacherRoutinePDF, generateLevelTermRoutinePDF, generateFullRoutinePDF, generateCourseSectionRoutinePDF, generateRoutineExcel } from './utils/pdfGenerator';
import { SHARED_SIDE_PANEL_WIDTH_CLASSES, SIDEBAR_FOOTER_HEIGHT_PX } from './styles/layoutConstants'; 
import RoutineGrid from './components/RoutineGrid';
import { DefaultTimeSlot, FullRoutineData, RoomEntry, SemesterRoutineData, User, PendingChange, Notification, ClassDetail, RoutineVersion, DayOfWeek, TimeSlot, PublishHistoryEntry } from './types';
import LogAttendanceModal from './components/modals/LogAttendanceModal';

// Lazy load components
import SettingsPanel from './components/panels/SettingsPanel';
import NotificationPanel from './components/panels/NotificationPanel';
import CommunityPanel from './components/panels/CommunityPanel';
import UserManagementPanel from './components/panels/UserManagementPanel';
import SmartSchedulerView from './components/SmartSchedulerView';
import BuildingRoomsView from './components/BuildingRoomsView';
import ProgramDetailView from './components/ProgramDetailView'; 
import SemesterDetailView from './components/semester-detail-views/SemesterDetailView';
import UserDetailView from './components/UserDetailView';
import FullSectionListView from './components/semester-detail-views/FullSectionListView';
import CourseMasterView from './components/CourseMasterView';
import RoomMasterView from './components/RoomMasterView';
import TeacherMasterView from './components/TeacherMasterView';
import AttendanceLogView from './components/AttendanceLogView';

// Helper function to format HH:MM (24-hour) time to hh:mm AM/PM
export const formatTimeToAMPM = (time24: string): string => {
  if (!time24) return 'N/A';
  try {
    const [hours, minutes] = time24.split(':');
    let h = parseInt(hours, 10);
    const m = parseInt(minutes, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    h = h ? h : 12; 
    const hStr = h < 10 ? '0' + h : h.toString();
    const mStr = m < 10 ? '0' + m : m.toString();
    return `${hStr}:${mStr} ${ampm}`;
  } catch (e) {
    return 'Invalid Time';
  }
};

export const formatDefaultSlotToString = (slot: DefaultTimeSlot): string => {
    if (!slot || !slot.startTime || !slot.endTime) return 'Invalid Slot';
    return `${formatTimeToAMPM(slot.startTime)} - ${formatTimeToAMPM(slot.endTime)}`;
};


const LoadingSpinner: React.FC<{ message?: string }> = ({ message = "Loading Application Data..." }) => (
    <div className="flex flex-col justify-center items-center h-full w-full bg-gray-100">
      <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-[var(--color-primary-500)]"></div>
      <p className="mt-4 text-sm font-medium text-gray-600">{message}</p>
    </div>
);


const AppContent: React.FC = () => {
  const [routineDisplayMode, setRoutineDisplayMode] = useState<'published' | 'editable'>('editable');
  const [isPublishConfirmModalOpen, setIsPublishConfirmModalOpen] = useState(false);

  const {
      // App State
      isLoading,
      error,
      
      // State & Setters
      user, logout, users,
      selectedDay, handleDayChange,
      selectedDate, handleDateChange,
      routineViewMode, handleToggleRoutineViewMode,
      activeMainView, handleMainViewChange,
      activeOverlay, handleOverlayToggle, closeOverlay, isOverlayAnimating, applyOpenAnimationStyles,
      activeProgramIdInSidebar, setActiveProgramIdInSidebar,
      selectedSemesterIdForRoutineView, setSelectedSemesterIdForRoutineView,
      actualActiveAssignedFilter, handleAssignedFilterChange,
      actualActiveSharedFilter, handleSharedFilterChange,
      dashboardTabFilter, setDashboardTabFilter,
      selectedLevelTermFilter, setSelectedLevelTermFilter,
      selectedSectionFilter, setSelectedSectionFilter,
      selectedTeacherIdFilter, setSelectedTeacherIdFilter,
      selectedCourseSectionIdsFilter, setSelectedCourseSectionIdsFilter,
      activeSettingsSection, setActiveSettingsSection,
      stagedCourseUpdates, setStagedCourseUpdates, handleSaveCourseMetadata, handleClearStagedCourseUpdates,
      coursesData, setCoursesData, handleUpdateCourseLevelTerm, handleUpdateWeeklyClass, handleUpdateCourseType,
      allSemesterConfigurations, setAllSemesterConfigurations, handleCloneRooms,
      routineData, setRoutineData, handleUpdateDefaultRoutine, handleMoveRoutineEntry,
      scheduleOverrides, handleUpdateScheduleOverrides,
      scheduleHistory,
      attendanceLog,
      pendingChanges, setPendingChanges,
      notifications, setNotifications, unreadNotificationCount,
      activeGridDisplayType, setActiveGridDisplayType,
      programIdForSemesterFilter, setProgramIdForSemesterFilter,
      initialSectionListFilters, handleShowSectionListWithFilters,
      handleAssignSectionToSlot,
      isLogAttendanceModalOpen,
      logDataForModal,
      handleOpenLogAttendanceModal,
      handleCloseLogAttendanceModal,
      handleSaveAttendanceLog,
      handleDeleteAttendanceLogEntry,
      handleClearAttendanceLog,
      handleOpenEditAttendanceLog,
      handleToggleMakeupStatus,
      handleChangePassword,
      handleMergeSections,
      handleUnmergeSection,
      isConflictModalOpen,
      conflictDataForModal,
      handleOpenConflictModal,
      handleCloseConflictModal,
      handleApplyAiResolution,
      handleCancelPendingChange, // New handler
      
      // Derived Data & Callbacks
      systemDefaultTimeSlots,
      uniqueSemestersForRooms,
      uniqueSemestersFromCourses,
      effectiveDaysForGrid,
      sidebarStats,
      slotUsageStats,
      ciwCounts,
      classRequirementCounts,
      programHasSlotsForMessage,
      programNameToDisplay,
      gridMessageTitle,
      gridMessageDetails,
      effectiveHeaderSlotsForGrid,
      effectiveRoomEntriesForGrid,
      routineDataForGrid: originalRoutineDataForGrid, // Renamed to avoid conflict
      coursesForCourseListView,
      coursesForSectionListView,
      teachersForTeacherListView,
      roomsForRoomListView,
      handleBulkAssign,
      markNotificationAsRead,
      markAllNotificationsAsRead,

      // Versioning
      versionsForCurrentSemester,
      activeVersionIdForCurrentSemester,
      handleVersionChange,
      handleDeleteVersion,

      // Context-based helpers
      allPrograms, allRooms, allBuildings, allFloors, allCategories, allRoomTypes,
      getBuildingNameFromApp, getFloorNameFromApp, getCategoryNameFromApp, getTypeNameFromApp,
      getProgramShortNameFromApp, getProgramDisplayString, getBuildingAddressFromApp, getOccupancyStats,
      addFloorFromApp, addCategoryFromApp, addTypeFromApp,
      
      // View handlers
      handleShowBuildingRooms, handleShowProgramDetail, handleShowSemesterDetail, handleShowUserDetail,
      handleShowCourseList, handleShowRoomList, handleShowTeacherList, handleShowSectionList,
      handleShowAttendanceLog,
      handleCloseProgramDetail, handleCloseSemesterDetail,
      selectedBuildingIdForView, selectedProgramIdForDetailView, activeSemesterDetailViewId, selectedUserIdForDetailView,
  } = useAppLogic();

  const {
      // Modal State
      isRoomDetailModalOpenFromGrid,
      selectedRoomForGridModal,
      isDayTimeSlotDetailModalOpen,
      selectedDayForDayCentricModal,
      selectedSlotObjectForDayCentricModal,
      isSlotDetailModalOpen,
      selectedSlotData,

      // Modal Handlers
      handleOpenRoomDetailModalFromGrid,
      handleCloseRoomDetailModalFromGrid,
      handleSaveRoomFromModal,
      handleOpenDayTimeSlotDetailModal,
      handleCloseDayTimeSlotDetailModal,
      handleOpenSlotDetailModal,
      handleCloseSlotDetailModal,
  } = useModalManager({ allRooms });
  
  if (isLoading) {
    return <LoadingSpinner message="Loading application data..." />;
  }

  if (error) {
    return (
        <div className="flex flex-col justify-center items-center h-full w-full bg-red-50 text-red-700">
            <h2 className="text-2xl font-bold">Application Error</h2>
            <p className="mt-2">Could not load initial data. Please check the API connection.</p>
            <pre className="mt-4 p-2 bg-red-100 border border-red-300 rounded-md text-xs">{error}</pre>
        </div>
    );
  }


  // Automatically switch to room-centric view when in published mode.
  useEffect(() => {
    if (routineDisplayMode === 'published' && routineViewMode === 'dayCentric') {
        handleToggleRoutineViewMode();
    }
  }, [routineDisplayMode, routineViewMode, handleToggleRoutineViewMode]);

  // Enforce routine display mode based on user permissions
  useEffect(() => {
    if (user?.dashboardAccess) {
        const canViewEditable = user.dashboardAccess.canViewEditableRoutine ?? false;
        const canViewPublished = user.dashboardAccess.canViewPublishedRoutine ?? false;

        // If user is in a mode they can't view, switch them
        if (routineDisplayMode === 'editable' && !canViewEditable) {
            if (canViewPublished) {
                setRoutineDisplayMode('published');
            }
        } else if (routineDisplayMode === 'published' && !canViewPublished) {
            if (canViewEditable) {
                setRoutineDisplayMode('editable');
            }
        }
    }
  }, [user, routineDisplayMode]);

  const isEditable = routineDisplayMode === 'editable';

  const handleOpenPublishConfirmModal = useCallback(() => {
    setIsPublishConfirmModalOpen(true);
  }, []);

  const handleClosePublishConfirmModal = useCallback(() => {
    setIsPublishConfirmModalOpen(false);
  }, []);

  const handlePublishRoutine = useCallback(() => {
    if (!selectedSemesterIdForRoutineView || !activeProgramIdInSidebar || !user) {
        console.error("Attempted to publish without a selected semester, program, or user.");
        return;
    }
    const program = allPrograms.find(p => p.id === activeProgramIdInSidebar);
    if (!program) {
        console.error("Selected program not found.");
        return;
    }
    const programPId = program.pId;

    setRoutineData(prev => {
        const newData = JSON.parse(JSON.stringify(prev));
        const semesterData: SemesterRoutineData = newData[selectedSemesterIdForRoutineView];

        if (!semesterData || !semesterData.activeVersionId) {
            alert("Cannot publish: No active routine found for this semester to publish.");
            return prev;
        }

        const activeVersion = semesterData.versions.find((v: RoutineVersion) => v.versionId === semesterData.activeVersionId);
        if (!activeVersion) {
            alert("Cannot publish: Active routine version data is corrupted or missing.");
            return prev;
        }

        const publishedVersion = semesterData.publishedVersionId 
            ? semesterData.versions.find((v: RoutineVersion) => v.versionId === semesterData.publishedVersionId) 
            : null;

        const newPublishedRoutine: FullRoutineData = publishedVersion ? JSON.parse(JSON.stringify(publishedVersion.routine)) : {};

        // Remove existing classes for the target program from the published routine
        for (const day of Object.keys(newPublishedRoutine) as DayOfWeek[]) {
            const dayData = newPublishedRoutine[day];
            if (!dayData) continue;
            for (const room of Object.keys(dayData)) {
                for (const slot of Object.keys(dayData[room]) as TimeSlot[]) {
                    if (dayData[room][slot]?.pId === programPId) {
                        delete dayData[room][slot];
                    }
                }
                if (Object.keys(dayData[room]).length === 0) {
                    delete newPublishedRoutine[day]![room];
                }
            }
            if (Object.keys(newPublishedRoutine[day]!).length === 0) {
                delete newPublishedRoutine[day];
            }
        }
        
        // Add new classes for the target program from the active routine
        const activeRoutine = activeVersion.routine;
        for (const day of Object.keys(activeRoutine) as DayOfWeek[]) {
            const dayData = activeRoutine[day];
            if (!dayData) continue;
            for (const room of Object.keys(dayData)) {
                for (const slot of Object.keys(dayData[room]) as TimeSlot[]) {
                    if (dayData[room][slot]?.pId === programPId) {
                        if (!newPublishedRoutine[day]) newPublishedRoutine[day] = {};
                        if (!newPublishedRoutine[day]![room]) newPublishedRoutine[day]![room] = {};
                        newPublishedRoutine[day]![room][slot] = dayData[room][slot];
                    }
                }
            }
        }

        const newPublishedVersionId = `published-${Date.now()}`;
        const newPublishedVersion: RoutineVersion = {
            versionId: newPublishedVersionId,
            createdAt: new Date().toISOString(),
            routine: newPublishedRoutine,
        };
        
        // Remove old published versions
        semesterData.versions = semesterData.versions.filter((v: RoutineVersion) => !v.versionId.startsWith('published-'));

        semesterData.versions.unshift(newPublishedVersion);
        semesterData.publishedVersionId = newPublishedVersionId;

        // Add to publish history
        const newPublishHistoryEntry: PublishHistoryEntry = {
            timestamp: new Date().toISOString(),
            userId: user.id,
            userName: user.name,
            programPId: programPId,
        };
        const existingHistory = semesterData.publishHistory || [];
        semesterData.publishHistory = [newPublishHistoryEntry, ...existingHistory].slice(0, 5);
        
        semesterData.versions.sort((a: RoutineVersion, b: RoutineVersion) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        newData[selectedSemesterIdForRoutineView] = semesterData;
        return newData;
    });
  }, [selectedSemesterIdForRoutineView, activeProgramIdInSidebar, setRoutineData, allPrograms, user]);

  const handleConfirmPublish = useCallback(() => {
    handlePublishRoutine();
    handleClosePublishConfirmModal();
  }, [handlePublishRoutine, handleClosePublishConfirmModal]);

  const hasChangesToPublish = useMemo(() => {
    if (!selectedSemesterIdForRoutineView || !activeProgramIdInSidebar) {
        return false;
    }
    const program = allPrograms.find(p => p.id === activeProgramIdInSidebar);
    if (!program) {
        return false;
    }
    const programPId = program.pId;

    const semesterData = routineData[selectedSemesterIdForRoutineView];
    if (!semesterData || !semesterData.activeVersionId) {
        return false;
    }
    
    const activeVersion = semesterData.versions.find(v => v.versionId === semesterData.activeVersionId);
    const publishedVersion = semesterData.publishedVersionId 
        ? semesterData.versions.find(v => v.versionId === semesterData.publishedVersionId)
        : null;

    if (!activeVersion) {
        return false;
    }
        
    const activeRoutine = activeVersion.routine;
    const publishedRoutine = publishedVersion ? publishedVersion.routine : {};

    const getProgramClasses = (routine: FullRoutineData): Map<string, ClassDetail> => {
        const classMap = new Map<string, ClassDetail>();
        if (!routine) return classMap;

        for (const day of Object.keys(routine) as DayOfWeek[]) {
            const dayData = routine[day];
            if (dayData) {
                for (const room of Object.keys(dayData)) {
                    for (const slot of Object.keys(dayData[room]) as TimeSlot[]) {
                        const classInfo = dayData[room][slot];
                        if (classInfo?.pId === programPId) {
                            const key = `${day}-${room}-${slot}`;
                            classMap.set(key, classInfo);
                        }
                    }
                }
            }
        }
        return classMap;
    };

    const activeProgramClasses = getProgramClasses(activeRoutine);
    const publishedProgramClasses = getProgramClasses(publishedRoutine);
    
    if (activeProgramClasses.size !== publishedProgramClasses.size) {
        return true;
    }
    
    for (const [key, activeClass] of activeProgramClasses.entries()) {
        const publishedClass = publishedProgramClasses.get(key);
        if (!publishedClass) {
            return true;
        }
        if (activeClass.courseCode !== publishedClass.courseCode ||
            activeClass.section !== publishedClass.section ||
            activeClass.teacher !== publishedClass.teacher) {
            return true;
        }
    }
    
    return false;

  }, [routineData, selectedSemesterIdForRoutineView, activeProgramIdInSidebar, allPrograms]);

  const isPublishable = useMemo(() => {
    if (!user?.dashboardAccess?.canPublishRoutine) return false;
    if (!selectedSemesterIdForRoutineView || !activeProgramIdInSidebar) return false;
    const semesterData = routineData[selectedSemesterIdForRoutineView];
    if (!semesterData || !semesterData.activeVersionId) return false;
    const activeVersion = semesterData.versions.find(v => v.versionId === semesterData.activeVersionId);
    return !!activeVersion;
  }, [user, selectedSemesterIdForRoutineView, routineData, activeProgramIdInSidebar]);
  
  const publishHistoryForModal = useMemo(() => {
    if (!selectedSemesterIdForRoutineView) return [];
    const history = routineData[selectedSemesterIdForRoutineView]?.publishHistory;
    return history || [];
  }, [routineData, selectedSemesterIdForRoutineView]);

  const lastPublishTimestamp = useMemo(() => {
    if (!selectedSemesterIdForRoutineView || !routineData[selectedSemesterIdForRoutineView]?.publishHistory) {
        return null;
    }
    const history = routineData[selectedSemesterIdForRoutineView]!.publishHistory;
    if (!history || history.length === 0) {
        return null;
    }
    // publishHistory is sorted with the latest first
    return history[0].timestamp;
  }, [routineData, selectedSemesterIdForRoutineView]);

  const activeRoutinesBySemester = useMemo(() => {
    const result: { [semesterId: string]: FullRoutineData } = {};
    for (const semesterId in routineData) {
        const semesterData = routineData[semesterId];
        if (semesterData && semesterData.activeVersionId) {
            const activeVersion = semesterData.versions.find(v => v.versionId === semesterData.activeVersionId);
            result[semesterId] = activeVersion ? activeVersion.routine : {};
        } else {
            result[semesterId] = {};
        }
    }
    return result;
  }, [routineData]);
  
  const publishedRoutinesBySemester = useMemo(() => {
    const result: { [semesterId: string]: FullRoutineData } = {};
    for (const semesterId in routineData) {
        const semesterData = routineData[semesterId];
        if (semesterData && semesterData.publishedVersionId) {
            const publishedVersion = semesterData.versions.find(v => v.versionId === semesterData.publishedVersionId);
            result[semesterId] = publishedVersion ? publishedVersion.routine : {};
        } else {
            result[semesterId] = {};
        }
    }
    return result;
  }, [routineData]);
  
  const routineDataForGrid = useMemo(() => {
    if (!selectedSemesterIdForRoutineView) return {};
    const routines = routineDisplayMode === 'editable' ? activeRoutinesBySemester : publishedRoutinesBySemester;
    return routines[selectedSemesterIdForRoutineView] || {};
  }, [routineDisplayMode, activeRoutinesBySemester, publishedRoutinesBySemester, selectedSemesterIdForRoutineView]);

  const routineDataForPreview = useMemo(() => {
    return routineDisplayMode === 'editable' ? activeRoutinesBySemester : publishedRoutinesBySemester;
  }, [routineDisplayMode, activeRoutinesBySemester, publishedRoutinesBySemester]);


  const handleApproveChange = useCallback((changeId: string, datesToApprove?: string[]) => {
    const change = pendingChanges.find(c => c.id === changeId);
    if (!change) return;

    const { isBulkUpdate, dates, requestedClassInfo, day, roomNumber, slotString, semesterId, source } = change;

    // --- Logic for partial or full approval of multi-date requests ---
    if (!isBulkUpdate && dates) {
        const approvedDates = datesToApprove || dates;
        const approvedAssignments = approvedDates.reduce((acc, dateISO) => {
            acc[dateISO] = requestedClassInfo;
            return acc;
        }, {} as Record<string, ClassDetail | null>);
        handleUpdateScheduleOverrides(roomNumber, slotString, approvedAssignments, undefined);
        const remainingDates = dates.filter(d => !approvedDates.includes(d));
        if (remainingDates.length > 0) {
            const updatedChange: PendingChange = { ...change, dates: remainingDates };
            setPendingChanges(prev => prev.map(c => (c.id === changeId ? updatedChange : c)));
        } else {
            setPendingChanges(prev => prev.filter(c => c.id !== changeId));
        }
    } else if (isBulkUpdate) {
        // --- Logic for bulk updates (Default Routine) ---
        if (source) { // This is a 'MOVE' operation
            // 1. Clear the source slot
            handleUpdateDefaultRoutine(source.day, source.roomNumber, source.slotString, null, semesterId);
            // 2. Assign to the target slot
            handleUpdateDefaultRoutine(day, roomNumber, slotString, requestedClassInfo, semesterId);
        } else { // This is a simple 'ASSIGN' or 'CLEAR'
            handleUpdateDefaultRoutine(day, roomNumber, slotString, requestedClassInfo, semesterId);
        }
        setPendingChanges(prev => prev.filter(c => c.id !== changeId));
    }

    // --- Notification Logic ---
    let actionText = '';
    if (source && requestedClassInfo) {
      actionText = `move ${requestedClassInfo.courseCode} (${requestedClassInfo.section}) from ${source.roomNumber} to ${roomNumber}`;
    } else if (requestedClassInfo) {
      actionText = `assign ${requestedClassInfo.courseCode} (${requestedClassInfo.section}) to Room ${roomNumber}`;
    } else {
      actionText = `clear the slot in Room ${roomNumber}`;
    }

    let message = `Your request to ${actionText} at ${slotString}`;

    if (isBulkUpdate) {
      message += ` on ${day}s has been approved.`;
    } else if (dates) {
      const approvedDates = datesToApprove || dates;
      const formattedDates = approvedDates.map(d =>
        new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          timeZone: 'UTC'
        })
      ).join(', ');
      message += ` for ${approvedDates.length > 1 ? 'dates' : 'date'} ${formattedDates} has been approved.`;
    } else {
      message += ` has been approved.`; // Fallback
    }

    const newNotification: Notification = {
      id: `notif-approve-${Date.now()}`,
      timestamp: new Date().toISOString(),
      userId: change.requesterId,
      type: 'approval',
      title: 'Request Approved',
      message: message,
      isRead: false,
      relatedChangeId: changeId,
    };
    setNotifications(prev => [newNotification, ...prev]);
  }, [pendingChanges, handleUpdateDefaultRoutine, handleUpdateScheduleOverrides, setPendingChanges, setNotifications]);

  const handleRejectChange = useCallback((changeId: string) => {
      const change = pendingChanges.find(c => c.id === changeId);
      if (!change) return;

      let actionText;
      if (change.source && change.requestedClassInfo) {
          actionText = `move ${change.requestedClassInfo.courseCode} from ${change.source.roomNumber} to ${change.roomNumber}`;
      } else if (change.requestedClassInfo) {
          actionText = `assign ${change.requestedClassInfo.courseCode} to Room ${change.roomNumber}`;
      } else {
          actionText = `clear a slot in Room ${change.roomNumber}`;
      }

      const newNotification: Notification = {
          id: `notif-reject-${Date.now()}`,
          timestamp: new Date().toISOString(),
          userId: change.requesterId,
          type: 'rejection',
          title: 'Request Rejected',
          message: `Your request to ${actionText} on ${change.isBulkUpdate ? change.day : (change.dates || []).join(', ')} has been rejected.`,
          isRead: false,
          relatedChangeId: changeId,
      };
      setNotifications(prev => [newNotification, ...prev]);

      setPendingChanges(prev => prev.filter(c => c.id !== changeId));
  }, [pendingChanges, setNotifications]);


  const pendingRequestCount = useMemo(() => {
    if (!user || !(user.role === 'admin' || user.notificationAccess?.canApproveSlots)) {
        return 0;
    }
    if (user.role === 'admin') {
        return pendingChanges.length;
    }

    const accessiblePIds = new Set(user.accessibleProgramPIds || []);
    if (accessiblePIds.size === 0) {
        return 0;
    }
    
    return pendingChanges.filter(change => {
        const room = allRooms.find(r => r.roomNumber === change.roomNumber && r.semesterId === change.semesterId);
        if (!room || !room.assignedToPId) {
            return false;
        }
        return accessiblePIds.has(room.assignedToPId);
    }).length;
  }, [pendingChanges, user, allRooms]);
  
  const handleOpenRoomDetailModalWithPermissionCheck = (room: RoomEntry) => {
    if (user?.role === 'admin' || user?.roomEditAccess?.canViewRoomDetail) {
      handleOpenRoomDetailModalFromGrid(room);
    }
  };

  const floorsForGridModal = useMemo(() => {
    if (selectedRoomForGridModal?.buildingId) {
      return allFloors.filter(f => f.buildingId === selectedRoomForGridModal.buildingId);
    }
    return [];
  }, [selectedRoomForGridModal, allFloors]);

  const { isBulkAssignDisabled, bulkAssignTooltip } = useMemo(() => {
    if (!user?.dashboardAccess?.canAutoAssign) {
      return { isBulkAssignDisabled: true, bulkAssignTooltip: "You do not have permission for this action." };
    }
    if (!activeProgramIdInSidebar) {
        return { isBulkAssignDisabled: true, bulkAssignTooltip: "Select a Program to enable Auto-Assign" };
    }
    if (!selectedSemesterIdForRoutineView) {
        return { isBulkAssignDisabled: true, bulkAssignTooltip: "Select a Semester to enable Auto-Assign" };
    }
    
    if (dashboardTabFilter === 'All') {
        return { isBulkAssignDisabled: true, bulkAssignTooltip: "Select 'Theory' or 'Lab' tab to enable Auto-Assign" };
    }

    if (dashboardTabFilter === 'Lab' && actualActiveAssignedFilter !== 'Lab' && actualActiveSharedFilter !== 'Lab') {
        return { isBulkAssignDisabled: true, bulkAssignTooltip: "To assign Labs, select 'Lab' in Assigned or Shared rooms filter" };
    }
    
    if (dashboardTabFilter === 'Theory' && actualActiveAssignedFilter !== 'Theory' && actualActiveSharedFilter !== 'Theory') {
        return { isBulkAssignDisabled: true, bulkAssignTooltip: "To assign Theory classes, select 'Theory' in Assigned or Shared rooms filter" };
    }

    return { isBulkAssignDisabled: false, bulkAssignTooltip: "Auto-assign schedulable sections to the grid" };
  }, [
    user,
    activeProgramIdInSidebar, 
    selectedSemesterIdForRoutineView, 
    dashboardTabFilter, 
    actualActiveAssignedFilter, 
    actualActiveSharedFilter
  ]);
  
    const handlePreviewTeacherRoutine = useCallback(() => {
        generateTeacherRoutinePDF({
            teacherId: selectedTeacherIdFilter,
            semesterId: selectedSemesterIdForRoutineView,
            coursesData,
            routineData: routineDataForPreview,
            allPrograms,
            systemDefaultTimeSlots,
            allUsers: users,
        });
    }, [selectedTeacherIdFilter, selectedSemesterIdForRoutineView, coursesData, routineDataForPreview, allPrograms, systemDefaultTimeSlots, users]);

    const handlePreviewLevelTermRoutine = useCallback(() => {
        if (!selectedLevelTermFilter || selectedLevelTermFilter === 'N/A') {
            alert("Please select a valid Level-Term to generate a routine.");
            return;
        }
        if (!selectedSemesterIdForRoutineView) {
            alert("Please select a semester.");
            return;
        }
        generateLevelTermRoutinePDF({
            levelTerm: selectedLevelTermFilter,
            section: selectedSectionFilter,
            semesterId: selectedSemesterIdForRoutineView,
            programId: activeProgramIdInSidebar,
            routineData: routineDataForPreview,
            allPrograms,
            systemDefaultTimeSlots,
            coursesData
        });
    }, [selectedLevelTermFilter, selectedSectionFilter, selectedSemesterIdForRoutineView, activeProgramIdInSidebar, routineDataForPreview, allPrograms, systemDefaultTimeSlots, coursesData]);

    const handlePreviewFullRoutine = useCallback(() => {
        if (!activeProgramIdInSidebar || !selectedSemesterIdForRoutineView) {
            alert("Please select a program and a semester first.");
            return;
        }
        const semesterRoutineData = routineDataForPreview[selectedSemesterIdForRoutineView] || {};
        generateFullRoutinePDF({
            programId: activeProgramIdInSidebar,
            semesterId: selectedSemesterIdForRoutineView,
            routineData: semesterRoutineData,
            allPrograms,
            allRooms,
            allRoomTypes,
            systemDefaultTimeSlots,
            getBuildingName: getBuildingNameFromApp,
        });
    }, [activeProgramIdInSidebar, selectedSemesterIdForRoutineView, routineDataForPreview, allPrograms, allRooms, allRoomTypes, systemDefaultTimeSlots, getBuildingNameFromApp]);

    const handlePreviewCourseSectionRoutine = useCallback(() => {
        if (!selectedSemesterIdForRoutineView) {
            alert("Please select a semester.");
            return;
        }
        if (selectedCourseSectionIdsFilter.length === 0) {
            alert("Please select at least one course section to generate a routine.");
            return;
        }
        generateCourseSectionRoutinePDF({
            sectionIds: selectedCourseSectionIdsFilter,
            semesterId: selectedSemesterIdForRoutineView,
            programId: activeProgramIdInSidebar,
            routineData: routineDataForPreview,
            coursesData,
            allPrograms,
            systemDefaultTimeSlots,
        });
    }, [selectedCourseSectionIdsFilter, selectedSemesterIdForRoutineView, activeProgramIdInSidebar, routineDataForPreview, coursesData, allPrograms, systemDefaultTimeSlots]);

  const handleDownloadExcel = useCallback(() => {
    if (!activeProgramIdInSidebar || !selectedSemesterIdForRoutineView) {
        alert("Please select a program and a semester to download the Excel file.");
        return;
    }
    const program = allPrograms.find(p => p.id === activeProgramIdInSidebar);
    
    generateRoutineExcel({
        routineData: routineDataForGrid,
        rooms: effectiveRoomEntriesForGrid,
        timeSlots: effectiveHeaderSlotsForGrid,
        days: effectiveDaysForGrid,
        program: program || null,
        semesterId: selectedSemesterIdForRoutineView,
    });
  }, [
      activeProgramIdInSidebar,
      selectedSemesterIdForRoutineView,
      allPrograms,
      routineDataForGrid,
      effectiveRoomEntriesForGrid,
      effectiveHeaderSlotsForGrid,
      effectiveDaysForGrid,
  ]);

  const isExcelDownloadable = useMemo(() => {
      return !!activeProgramIdInSidebar && !!selectedSemesterIdForRoutineView;
  }, [activeProgramIdInSidebar, selectedSemesterIdForRoutineView]);

  const excelDownloadTooltip = useMemo(() => {
    if (!isExcelDownloadable) {
        return "Select a program and a semester to download the routine.";
    }
    const program = allPrograms.find(p => p.id === activeProgramIdInSidebar);
    return `Download routine for ${program?.shortName || 'selected program'} as an Excel file.`;
  }, [isExcelDownloadable, allPrograms, activeProgramIdInSidebar]);

  const headerHeight = '48px'; 

  let panelContent: JSX.Element | null = null;
  if (activeOverlay) {
    switch (activeOverlay) {
      case 'settings':
        panelContent = (
          <SettingsPanel 
            onClose={closeOverlay} 
            onShowBuildingRooms={handleShowBuildingRooms}
            onShowProgramDetailView={handleShowProgramDetail} 
            onShowSectionList={handleShowSectionList}
            onShowSectionListWithFilters={handleShowSectionListWithFilters}
            activeProgramIdInMainView={selectedProgramIdForDetailView}
            uniqueSemesters={uniqueSemestersForRooms}
            allPossibleSemesters={uniqueSemestersFromCourses}
            onShowSemesterDetail={handleShowSemesterDetail}
            activeSemesterDetailViewId={activeSemesterDetailViewId}
            allSemesterConfigurations={allSemesterConfigurations}
            setAllSemesterConfigurations={setAllSemesterConfigurations}
            selectedSemesterIdForRoutineView={selectedSemesterIdForRoutineView}
            setSelectedSemesterIdForRoutineView={setSelectedSemesterIdForRoutineView}
            routineData={routineData}
            setRoutineData={setRoutineData}
            coursesData={coursesData}
            onSaveCourseMetadata={handleSaveCourseMetadata}
            activeSection={activeSettingsSection}
            setActiveSection={setActiveSettingsSection}
            stagedCourseUpdates={stagedCourseUpdates}
            setStagedCourseUpdates={setStagedCourseUpdates}
            onClearStagedCourseUpdates={handleClearStagedCourseUpdates}
            onCloneRooms={handleCloneRooms}
            activeGridDisplayType={activeGridDisplayType}
            setActiveGridDisplayType={setActiveGridDisplayType}
            programIdForSemesterFilter={programIdForSemesterFilter}
            setProgramIdForSemesterFilter={setProgramIdForSemesterFilter}
            allPrograms={allPrograms}
          />
        );
        break;
      case 'notifications':
        panelContent = (
          <NotificationPanel
            user={user}
            onClose={closeOverlay}
            pendingChanges={pendingChanges}
            onApprove={handleApproveChange}
            onReject={handleRejectChange}
            allPrograms={allPrograms}
            allRooms={allRooms}
            notifications={notifications}
            markNotificationAsRead={markNotificationAsRead}
            markAllNotificationsAsRead={markAllNotificationsAsRead}
          />
        );
        break;
      case 'community':
        panelContent = <CommunityPanel onClose={closeOverlay} />;
        break;
      case 'userManagement':
        panelContent = (
          <UserManagementPanel
            onClose={closeOverlay}
            onShowUserDetail={handleShowUserDetail}
            activeUserId={selectedUserIdForDetailView}
            coursesData={coursesData}
            allPrograms={allPrograms}
          />
        );
        break;
    }
  }

  return (
    <div className="h-screen w-screen bg-[var(--color-bg-base)] flex flex-col font-inter relative">
      <Header 
        days={effectiveDaysForGrid}
        selectedDay={selectedDay}
        onDaySelect={handleDayChange}
        selectedDate={selectedDate}
        onDateChange={handleDateChange}
        routineViewMode={routineViewMode}
        user={user}
        logout={logout}
        onChangePassword={handleChangePassword}
        onShowUserDetail={handleShowUserDetail}
      />
      <div className="flex flex-row flex-grow overflow-hidden" style={{ height: `calc(100vh - ${headerHeight})` }}>
        <Sidebar 
          onMainViewChange={handleMainViewChange} 
          onOverlayToggle={handleOverlayToggle}
          currentMainView={activeMainView}
          currentOverlay={activeOverlay}
          onSelectProgramForRoutineView={setActiveProgramIdInSidebar}
          selectedProgramIdForRoutineView={activeProgramIdInSidebar}
          activeAssignedRoomTypeFilter={actualActiveAssignedFilter}
          setActiveAssignedRoomTypeFilter={handleAssignedFilterChange}
          activeSharedRoomTypeFilter={actualActiveSharedFilter}
          setActiveSharedRoomTypeFilter={handleSharedFilterChange}
          selectedSemesterIdForRoutineView={selectedSemesterIdForRoutineView}
          setSelectedSemesterIdForRoutineView={setSelectedSemesterIdForRoutineView}
          allSemesterConfigurations={allSemesterConfigurations}
          logout={logout}
          sidebarStats={sidebarStats}
          slotUsageStats={slotUsageStats}
          ciwCounts={ciwCounts}
          classRequirementCounts={classRequirementCounts}
          dashboardTabFilter={dashboardTabFilter}
          setDashboardTabFilter={setDashboardTabFilter}
          onShowCourseList={handleShowCourseList}
          onShowSectionList={handleShowSectionList}
          onShowRoomList={handleShowRoomList}
          onShowTeacherList={handleShowTeacherList}
          onShowAttendanceLog={handleShowAttendanceLog}
          coursesData={coursesData}
          setCoursesData={setCoursesData}
          routineViewMode={routineViewMode}
          onToggleRoutineViewMode={handleToggleRoutineViewMode}
          routineDisplayMode={routineDisplayMode}
          onRoutineDisplayModeChange={setRoutineDisplayMode}
          onPublish={handleOpenPublishConfirmModal}
          isPublishable={isPublishable}
          lastPublishTimestamp={lastPublishTimestamp}
          onDownloadExcel={handleDownloadExcel}
          isExcelDownloadable={isExcelDownloadable}