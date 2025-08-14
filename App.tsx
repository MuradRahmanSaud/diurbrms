

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
import { generateTeacherRoutinePDF } from './utils/pdfGenerator';
import { SHARED_SIDE_PANEL_WIDTH_CLASSES, SIDEBAR_FOOTER_HEIGHT_PX } from './styles/layoutConstants'; 
import RoutineGrid from './components/RoutineGrid';
import { DefaultTimeSlot, FullRoutineData, RoomEntry, SemesterRoutineData, User, PendingChange, Notification, ClassDetail } from './types';
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


const LoadingSpinner: React.FC = () => (
    <div className="flex justify-center items-center h-full w-full bg-gray-100/50">
      <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-[var(--color-primary-500)]"></div>
    </div>
);


const AppContent: React.FC = () => {
  const {
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
      routineDataForGrid,
      coursesForCourseListView,
      coursesForSectionListView,
      teachersForTeacherListView,
      roomsForRoomListView,
      handlePreviewLevelTermRoutine,
      handlePreviewFullRoutine,
      handlePreviewCourseSectionRoutine,
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

  const handleApproveChange = useCallback((changeId: string, datesToApprove?: string[]) => {
    const change = pendingChanges.find(c => c.id === changeId);
    if (!change) return;

    const { isBulkUpdate, dates, requestedClassInfo, day, roomNumber, slotString, semesterId } = change;

    // --- Logic for partial or full approval of multi-date requests ---
    if (!isBulkUpdate && dates) {
        const approvedDates = datesToApprove || dates; // If no specific dates passed, approve all
        
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
        // --- Original logic for full approval (bulk update) ---
        handleUpdateDefaultRoutine(day, roomNumber, slotString, requestedClassInfo, semesterId);
        setPendingChanges(prev => prev.filter(c => c.id !== changeId));
    }

    // --- Notification Logic ---
    const actionText = requestedClassInfo
      ? `assign ${requestedClassInfo.courseCode} (${requestedClassInfo.section})`
      : 'clear the slot';

    let message = `Your request to ${actionText} for Room ${roomNumber} at ${slotString}`;

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

      const newNotification: Notification = {
          id: `notif-reject-${Date.now()}`,
          timestamp: new Date().toISOString(),
          userId: change.requesterId,
          type: 'rejection',
          title: 'Request Rejected',
          message: `Your request for Room ${change.roomNumber} on ${change.isBulkUpdate ? change.day : (change.dates || []).join(', ')} has been rejected.`,
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

  const handlePreviewTeacherRoutine = () => {
    generateTeacherRoutinePDF({
        teacherId: selectedTeacherIdFilter,
        semesterId: selectedSemesterIdForRoutineView,
        coursesData,
        routineData: activeRoutinesBySemester,
        allPrograms,
        systemDefaultTimeSlots,
        allUsers: users,
    });
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
          selectedLevelTermFilter={selectedLevelTermFilter}
          setSelectedLevelTermFilter={setSelectedLevelTermFilter}
          selectedSectionFilter={selectedSectionFilter}
          setSelectedSectionFilter={setSelectedSectionFilter}
          selectedTeacherIdFilter={selectedTeacherIdFilter}
          setSelectedTeacherIdFilter={setSelectedTeacherIdFilter}
          selectedCourseSectionIdsFilter={selectedCourseSectionIdsFilter}
          setSelectedCourseSectionIdsFilter={setSelectedCourseSectionIdsFilter}
          onPreviewTeacherRoutine={handlePreviewTeacherRoutine}
          onPreviewLevelTermRoutine={handlePreviewLevelTermRoutine}
          onPreviewFullRoutine={handlePreviewFullRoutine}
          onPreviewCourseSectionRoutine={handlePreviewCourseSectionRoutine}
          onUpdateLevelTerm={handleUpdateCourseLevelTerm}
          onUpdateWeeklyClass={handleUpdateWeeklyClass}
          onUpdateCourseType={handleUpdateCourseType}
          onBulkAssign={handleBulkAssign}
          isBulkAssignDisabled={isBulkAssignDisabled}
          bulkAssignTooltip={bulkAssignTooltip}
          versions={versionsForCurrentSemester}
          activeVersionId={activeVersionIdForCurrentSemester}
          onVersionChange={handleVersionChange}
          onDeleteVersion={handleDeleteVersion}
          unreadNotificationCount={unreadNotificationCount}
          pendingRequestCount={pendingRequestCount}
          setRoutineData={setRoutineData}
        />
        <main className="flex-grow flex flex-col overflow-y-auto bg-[var(--color-bg-base)] p-2 relative min-w-0">
            <Suspense fallback={<LoadingSpinner />}>
              {activeMainView === 'routine' && (
                activeProgramIdInSidebar && !programHasSlotsForMessage ? (
                  <div className="text-center py-10 px-3 text-gray-600 bg-white rounded-md h-full flex flex-col justify-center items-center shadow-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-3 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <p className="text-lg sm:text-xl font-semibold mb-1">No Time Slots Defined</p>
                    <p className="text-xs sm:text-sm">
                      The program <span className="font-semibold">"{programNameToDisplay || 'selected'}"</span> has no specific time slots.
                    </p>
                    <p className="text-xs sm:text-sm mt-1">Please set them up in Settings &gt; Program Setup.</p>
                  </div>
                ) : (effectiveHeaderSlotsForGrid.length > 0 && (routineViewMode === 'dayCentric' || effectiveRoomEntriesForGrid.length > 0)) || (routineViewMode === 'roomCentric' && routineDataForGrid[selectedDay]) ? (
                    <div className="overflow-auto rounded-lg shadow-lg flex-grow bg-[var(--color-bg-muted)] h-full -m-1">
                      <RoutineGrid 
                        user={user}
                        routineData={routineDataForGrid} 
                        selectedDayForRoomCentricView={selectedDay}
                        roomEntries={effectiveRoomEntriesForGrid} 
                        headerSlotObjects={effectiveHeaderSlotsForGrid} 
                        systemDefaultSlots={systemDefaultTimeSlots} 
                        onRoomHeaderClick={handleOpenRoomDetailModalWithPermissionCheck} 
                        onDayTimeCellClick={handleOpenDayTimeSlotDetailModal}
                        onSlotCellClick={handleOpenSlotDetailModal}
                        routineViewMode={routineViewMode}
                        getBuildingName={getBuildingNameFromApp}
                        scheduleOverrides={scheduleOverrides}
                        pendingChanges={pendingChanges}
                        allSemesterConfigurations={allSemesterConfigurations}
                        allPrograms={allPrograms}
                        selectedDate={selectedDate}
                        coursesData={coursesData}
                        selectedSemesterIdForRoutineView={selectedSemesterIdForRoutineView}
                        activeProgramIdInSidebar={activeProgramIdInSidebar}
                        activeDays={effectiveDaysForGrid}
                        onMoveRoutineEntry={handleMoveRoutineEntry}
                        onAssignSectionToSlot={handleAssignSectionToSlot}
                        selectedLevelTermFilter={selectedLevelTermFilter}
                        selectedSectionFilter={selectedSectionFilter}
                        selectedTeacherIdFilter={selectedTeacherIdFilter}
                        selectedCourseSectionIdsFilter={selectedCourseSectionIdsFilter}
                        onLogAttendance={handleOpenLogAttendanceModal}
                        onOpenConflictModal={handleOpenConflictModal}
                      />
                    </div>
                  ) : (
                  <div className="text-center py-10 px-3 text-gray-500 bg-white rounded-md h-full flex flex-col justify-center items-center shadow-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-lg sm:text-xl font-semibold mb-1">{gridMessageTitle}</p>
                    <p className="text-xs sm:text-sm">{gridMessageDetails}</p>
                  </div>
                )
              )}
              {activeMainView === 'smartScheduler' && (
                <SmartSchedulerView />
              )}
              {activeMainView === 'attendanceLog' && (
                <AttendanceLogView
                  logData={attendanceLog}
                  onClose={() => handleMainViewChange('routine')}
                  onEditEntry={handleOpenEditAttendanceLog}
                  onDeleteEntry={handleDeleteAttendanceLogEntry}
                  onClearAll={handleClearAttendanceLog}
                  onToggleMakeupStatus={handleToggleMakeupStatus}
                  allRooms={allRooms}
                  getBuildingName={getBuildingNameFromApp}
                  getProgramShortName={getProgramShortNameFromApp}
                />
              )}
               {activeMainView === 'sectionList' && (
                <FullSectionListView
                  user={user}
                  coursesData={coursesForSectionListView}
                  allPrograms={allPrograms}
                  onClose={() => handleMainViewChange('routine')}
                  setCoursesData={setCoursesData}
                  routineData={activeRoutinesBySemester}
                  allSemesterConfigurations={allSemesterConfigurations}
                  initialFilters={initialSectionListFilters}
                  onFiltersApplied={() => {}}
                  stagedCourseUpdates={stagedCourseUpdates}
                  ciwCounts={ciwCounts}
                  classRequirementCounts={classRequirementCounts}
                  dashboardTabFilter={dashboardTabFilter}
                  allRooms={allRooms}
                  systemDefaultSlots={systemDefaultTimeSlots}
                  onSlotClick={handleOpenSlotDetailModal}
                />
              )}
              {activeMainView === 'courseList' && (
                <CourseMasterView
                  user={user}
                  coursesData={coursesForCourseListView}
                  allPrograms={allPrograms}
                  ciwCounts={ciwCounts}
                  classRequirementCounts={classRequirementCounts}
                  onClose={() => handleMainViewChange('routine')}
                  setCoursesData={setCoursesData}
                  onUpdateLevelTerm={handleUpdateCourseLevelTerm}
                  onUpdateWeeklyClass={handleUpdateWeeklyClass}
                  onUpdateCourseType={handleUpdateCourseType}
                />
              )}
               {activeMainView === 'roomList' && (
                <RoomMasterView
                  user={user}
                  rooms={roomsForRoomListView}
                  onClose={() => handleMainViewChange('routine')}
                  getBuildingName={getBuildingNameFromApp}
                  getFloorName={getFloorNameFromApp}
                  getProgramShortName={getProgramShortNameFromApp}
                  getTypeName={getTypeNameFromApp}
                  getOccupancyStats={getOccupancyStats}
                  allBuildings={allBuildings}
                  allFloors={allFloors}
                  onRoomClick={handleOpenRoomDetailModalWithPermissionCheck}
                  allPrograms={allPrograms}
                  allCategories={allCategories}
                  allRoomTypes={allRoomTypes}
                  uniqueSemesters={uniqueSemestersForRooms}
                  routineData={activeRoutinesBySemester}
                />
              )}
              {activeMainView === 'teacherList' && (
                <TeacherMasterView
                  teachers={teachersForTeacherListView}
                  allPrograms={allPrograms}
                  onClose={() => handleMainViewChange('routine')}
                  ciwCounts={ciwCounts}
                  classRequirementCounts={classRequirementCounts}
                  getProgramShortName={getProgramShortNameFromApp}
                  fullRoutineData={activeRoutinesBySemester}
                  systemDefaultSlots={systemDefaultTimeSlots}
                  selectedSemesterIdForRoutineView={selectedSemesterIdForRoutineView}
                  coursesData={coursesData}
                  onMergeSections={handleMergeSections}
                  onUnmergeSection={handleUnmergeSection}
                />
              )}
              {activeMainView === 'buildingRooms' && (
                <BuildingRoomsView
                  user={user}
                  buildingId={selectedBuildingIdForView}
                  uniqueSemesters={uniqueSemestersForRooms}
                  routineData={activeRoutinesBySemester}
                  onClose={() => {
                      handleMainViewChange('routine');
                      setActiveSettingsSection(null);
                  }}
                  selectedSemesterIdForRoutineView={selectedSemesterIdForRoutineView}
                  setSelectedSemesterIdForRoutineView={setSelectedSemesterIdForRoutineView}
                  systemDefaultSlots={systemDefaultTimeSlots}
                  allPrograms={allPrograms}
                  allRoomTypes={allRoomTypes}
                  scheduleOverrides={scheduleOverrides}
                  allSemesterConfigurations={allSemesterConfigurations}
                />
              )}
              {activeMainView === 'programDetail' && selectedProgramIdForDetailView && (
                <ProgramDetailView 
                  programId={selectedProgramIdForDetailView} 
                  onClose={handleCloseProgramDetail}
                  coursesData={coursesData}
                  fullRoutineData={activeRoutinesBySemester}
                  rooms={allRooms}
                  systemDefaultSlots={systemDefaultTimeSlots}
                  allSemesterConfigurations={allSemesterConfigurations}
                  allPrograms={allPrograms}
                  allRoomTypes={allRoomTypes}
                  activeGridDisplayType={activeGridDisplayType}
                  selectedSemesterId={selectedSemesterIdForRoutineView}
                />
              )}
              {activeMainView === 'semesterDetail' && activeSemesterDetailViewId && (
                <SemesterDetailView 
                  user={user}
                  semesterId={activeSemesterDetailViewId} 
                  onClose={handleCloseSemesterDetail}
                  coursesData={coursesData}
                  fullRoutineData={activeRoutinesBySemester}
                  systemDefaultSlots={systemDefaultTimeSlots}
                  allPrograms={allPrograms}
                  allBuildings={allBuildings}
                  allFloors={allFloors}
                  allRoomTypes={allRoomTypes}
                  scheduleOverrides={scheduleOverrides}
                  allSemesterConfigurations={allSemesterConfigurations}
                  onUpdateLevelTerm={handleUpdateCourseLevelTerm}
                  onUpdateWeeklyClass={handleUpdateWeeklyClass}
                  onUpdateCourseType={handleUpdateCourseType}
                  setCoursesData={setCoursesData}
                  stagedCourseUpdates={stagedCourseUpdates}
                  uniqueSemesters={uniqueSemestersForRooms}
                  selectedProgramId={programIdForSemesterFilter}
                  activeTab={activeGridDisplayType}
                  getBuildingName={getBuildingNameFromApp}
                  getFloorName={getFloorNameFromApp}
                  getTypeName={getTypeNameFromApp}
                  getProgramShortName={getProgramShortNameFromApp}
                  allRooms={allRooms}
                  onSlotClick={handleOpenSlotDetailModal}
                />
              )}
              {activeMainView === 'userDetail' && selectedUserIdForDetailView && (
                <UserDetailView 
                  userId={selectedUserIdForDetailView} 
                  allPrograms={allPrograms} 
                  coursesData={coursesData}
                  onClose={() => handleMainViewChange('routine')}
                  onChangePassword={handleChangePassword}
                  fullRoutineData={activeRoutinesBySemester}
                  systemDefaultSlots={systemDefaultTimeSlots}
                  selectedSemesterIdForRoutineView={selectedSemesterIdForRoutineView}
                  ciwCounts={ciwCounts}
                  classRequirementCounts={classRequirementCounts}
                  getProgramShortName={getProgramShortNameFromApp}
                  allUsers={users}
                  onMergeSections={handleMergeSections}
                  onUnmergeSection={handleUnmergeSection}
                />
              )}
            </Suspense>

            {isDayTimeSlotDetailModalOpen && selectedDayForDayCentricModal && selectedSlotObjectForDayCentricModal && (
              <>
                <div 
                  className="absolute inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300 ease-out"
                  onClick={handleCloseDayTimeSlotDetailModal}
                  aria-hidden="true"
                ></div>
                <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
                  <DayTimeSlotDetailModal
                      isOpen={isDayTimeSlotDetailModalOpen} 
                      onClose={handleCloseDayTimeSlotDetailModal}
                      day={selectedDayForDayCentricModal}
                      selectedSlotObject={selectedSlotObjectForDayCentricModal}
                      systemDefaultSlots={systemDefaultTimeSlots}
                      fullRoutineData={routineDataForGrid}
                      roomEntries={effectiveRoomEntriesForGrid}
                      onRoomNameClick={(room) => {
                        handleOpenRoomDetailModalWithPermissionCheck(room); 
                      }}
                      getProgramShortName={getProgramShortNameFromApp}
                      activeProgramIdInSidebar={activeProgramIdInSidebar}
                      scheduleOverrides={scheduleOverrides}
                      selectedDate={selectedDate}
                      allSemesterConfigurations={allSemesterConfigurations}
                      allPrograms={allPrograms}
                  />
                </div>
              </>
            )}

            {isSlotDetailModalOpen && selectedSlotData && (
              <>
                <div 
                  className="absolute inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300 ease-out"
                  onClick={handleCloseSlotDetailModal}
                  aria-hidden="true"
                ></div>
                <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
                    <SlotDetailModal
                        isOpen={isSlotDetailModalOpen}
                        onClose={handleCloseSlotDetailModal}
                        slotData={selectedSlotData}
                        getBuildingName={getBuildingNameFromApp}
                        getProgramDisplayString={getProgramDisplayString}
                        fullRoutineData={activeRoutinesBySemester}
                        allSemesterConfigurations={allSemesterConfigurations}
                        allPrograms={allPrograms}
                        coursesData={coursesData}
                        scheduleOverrides={scheduleOverrides}
                        scheduleHistory={scheduleHistory}
                        onUpdateOverrides={handleUpdateScheduleOverrides}
                        onUpdateDefaultRoutine={handleUpdateDefaultRoutine}
                        activeProgramIdInSidebar={activeProgramIdInSidebar}
                        selectedSemesterIdForRoutineView={selectedSemesterIdForRoutineView}
                        pendingChanges={pendingChanges}
                    />
                </div>
              </>
            )}
        </main>
      </div>

      {isLogAttendanceModalOpen && logDataForModal && (
        <LogAttendanceModal
            isOpen={isLogAttendanceModalOpen}
            onClose={handleCloseLogAttendanceModal}
            logDataTemplate={logDataForModal}
            onSubmit={handleSaveAttendanceLog}
            allRooms={allRooms}
            systemDefaultTimeSlots={systemDefaultTimeSlots}
            routineData={activeRoutinesBySemester}
            scheduleOverrides={scheduleOverrides}
            allPrograms={allPrograms}
            allRoomTypes={allRoomTypes}
            getBuildingName={getBuildingNameFromApp}
        />
      )}

      {isOverlayAnimating && activeOverlay && ( 
        <div
          key={activeOverlay} 
          className={`
            fixed left-0 bg-white shadow-2xl z-30 
            transform transition-all duration-300 ease-in-out overflow-hidden
            ${SHARED_SIDE_PANEL_WIDTH_CLASSES}
            ${applyOpenAnimationStyles ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12 pointer-events-none'}
          `}
          style={{ 
            top: headerHeight, 
            bottom: `${SIDEBAR_FOOTER_HEIGHT_PX}px`
          }} 
          aria-hidden={!activeOverlay}
        >
          <Suspense fallback={<LoadingSpinner />}>
            {panelContent && ( 
              <div
                key={`${activeOverlay}-content`}
                className={`
                  h-full w-full transition-all duration-300 ease-in-out
                  ${applyOpenAnimationStyles ? 'opacity-100 translate-y-0 delay-[50ms]' : 'opacity-0 translate-y-4 pointer-events-none'}
                `}
              >
                {panelContent}
              </div>
            )}
          </Suspense>
        </div>
      )}
      
      {selectedRoomForGridModal && (
        <RoomDetailModal
          room={selectedRoomForGridModal}
          isOpen={isRoomDetailModalOpenFromGrid}
          onClose={handleCloseRoomDetailModalFromGrid}
          onSaveRoom={handleSaveRoomFromModal} 
          allPrograms={allPrograms}
          allBuildings={allBuildings}
          allFloorsForBuilding={floorsForGridModal} 
          allCategories={allCategories}
          allRoomTypes={allRoomTypes}
          onAddFloor={addFloorFromApp}
          onAddCategory={addCategoryFromApp}
          onAddRoomType={addTypeFromApp}
          getBuildingName={getBuildingNameFromApp}
          getBuildingAddress={getBuildingAddressFromApp}
          getFloorName={getFloorNameFromApp}
          getCategoryName={getCategoryNameFromApp}
          getTypeName={getTypeNameFromApp}
          getProgramShortName={getProgramShortNameFromApp}
          fullRoutineData={activeRoutinesBySemester} 
          systemDefaultSlots={systemDefaultTimeSlots} 
          uniqueSemesters={uniqueSemestersForRooms}
          scheduleOverrides={scheduleOverrides}
          allSemesterConfigurations={allSemesterConfigurations}
          zIndex={60}
          heightClass="min-h-[75vh] max-h-[85vh]"
        />
      )}
      
      {isConflictModalOpen && conflictDataForModal && (
        <ConflictResolutionModal
          isOpen={isConflictModalOpen}
          onClose={handleCloseConflictModal}
          conflictInfo={conflictDataForModal}
          onApplyResolution={handleApplyAiResolution}
          allRooms={allRooms}
          systemDefaultSlots={systemDefaultTimeSlots}
          allPrograms={allPrograms}
          coursesData={coursesData}
          fullRoutineForDay={routineDataForGrid[conflictDataForModal.day] || {}}
          semesterId={selectedSemesterIdForRoutineView}
        />
      )}
    </div>
  );
};

const AppWrapper: React.FC = () => {
    const { user } = useAuth();
    if (!user) {
        return <LoginScreen />;
    }
    return <AppContent />;
}

const App: React.FC = () => {
  return (
    <ProgramProvider>
      <BuildingProvider>
        <FloorProvider>
          <RoomCategoryProvider>
            <RoomTypeProvider>
              <RoomProvider>
                <AppWrapper />
              </RoomProvider>
            </RoomTypeProvider>
          </RoomCategoryProvider>
        </FloorProvider>
      </BuildingProvider>
    </ProgramProvider>
  );
};

export default App;
