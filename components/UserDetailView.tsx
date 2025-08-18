import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRolePermissions } from '../contexts/RolePermissionContext';
import { User, DayOfWeek, ProgramEntry, EnrollmentEntry, RoomEditAccess, DashboardAccess, FullRoutineData, DefaultTimeSlot, ClassDetail, UserRole, AssignAccessLevel, ProgramManagementAccess, NotificationAccess } from '../types';
import { DAYS_OF_WEEK } from '../data/routineConstants';
import SearchableProgramDropdownForRooms from './SearchableProgramDropdownForRooms';
import { formatDefaultSlotToString, formatTimeToAMPM } from '../App';
import { sortSlotsByTypeThenTime } from '../data/slotConstants';
import { generateTeacherRoutinePDF, generateCourseLoadPDF } from '../utils/pdfGenerator';
import RolePermissionModal from './modals/RolePermissionModal';

interface UserDetailViewProps {
  userId: string;
  allPrograms: ProgramEntry[];
  coursesData: EnrollmentEntry[];
  onClose: () => void;
  onChangePassword: (userId: string, current: string, newPass: string) => Promise<void>;
  fullRoutineData: { [semesterId: string]: FullRoutineData };
  systemDefaultSlots: DefaultTimeSlot[];
  selectedSemesterIdForRoutineView: string | null;
  ciwCounts: Map<string, number>;
  classRequirementCounts: Map<string, number>;
  getProgramShortName: (pId?: string) => string;
  allUsers: User[];
  onMergeSections: (sourceSectionId: string, targetSectionId: string) => void;
  onUnmergeSection: (sectionIdToUnmerge: string) => void;
}

const PERMISSION_LABELS: Record<string, string> = {
    // RoomEditAccess
    canManageRoomManagement: "Manage Rooms Panel",
    canAddBuilding: "Add Building",
    canAddRoom: "Add Room",
    canDeleteRoom: "Delete Room",
    canViewRoomDetail: "View Room Details",
    canEditAssignToProgram: "Assign Primary Program",
    canEditShareWithPrograms: "Share with Programs",
    canEditDetailsTab: "Edit Room Details",
    canEditSlotsTab: "Edit Room Slots",
    canImportRoomData: "Import Room Data",
    canExportRoomData: "Export Room Data",
    // DashboardAccess
    canViewCourseList: "View Course List",
    canViewSectionList: "View Section List",
    canViewRoomList: "View Room List",
    canViewTeacherList: "View Teacher List",
    canViewSlotRequirement: "View Slot Requirement",
    canAutoAssign: "Run Auto-Scheduler",
    canManageVersions: "Manage Routine Versions",
    canViewSlotUsage: "View Slot Usage",
    canViewMakeupSchedule: "View Make-up Schedule",
    canViewTotalSlots: "View Total Slots",
    canEditCourseSectionDetails: "Edit Course/Section Details",
    canImportCourseData: "Import Course Data",
    canExportCourseData: "Export Course Data",
    classMonitoringAccess: "Class Monitoring",
    canManageProgramSetup: "Access Program Setup Panel",
    canManageDefaultSlots: "Manage Default Slots",
    canManageSemesterSetup: "Manage Semester Setup",
    canViewSectionTable: "View Section Table",
    canCustomizeTheme: "Customize Theme",
    canDragAndDrop: "Drag & Drop Scheduling",
    canViewSlotHistory: "View Slot History",
    canViewEditableRoutine: "View Editable Routine",
    canViewPublishedRoutine: "View Published Routine",
    canPublishRoutine: "Publish Routines",
    // ProgramManagementAccess
    canAddProgram: "Add New Program",
    canEditProgram: "Edit Program Details",
    // NotificationAccess
    canGetNotification: "Get Slot Notifications",
    canApproveSlots: "Approve Slot Changes",
};

const defaultDashboardAccess: DashboardAccess = {
  canViewCourseList: false,
  canViewSectionList: false,
  canViewRoomList: false,
  canViewTeacherList: false,
  canViewSlotRequirement: false,
  canAutoAssign: false,
  canManageVersions: false,
  canViewSlotUsage: false,
  canViewMakeupSchedule: false,
  canViewTotalSlots: false,
  canEditCourseSectionDetails: false,
  canImportCourseData: false,
  canExportCourseData: false,
  classMonitoringAccess: 'none',
  canManageProgramSetup: false,
  canManageDefaultSlots: false,
  canManageSemesterSetup: false,
  canViewSectionTable: false,
  canCustomizeTheme: false,
  canDragAndDrop: false,
};


// Reusable component for permission toggles to keep the UI consistent and clean
const PermissionToggle = ({ id, label, description, checked, onToggle, disabled = false }: { id: string; label: string; description?: string; checked: boolean; onToggle: () => void; disabled?: boolean; }) => (
    <div className={`flex items-center justify-between transition-opacity ${disabled ? 'opacity-60' : ''}`}>
      <div>
        <label htmlFor={id} className={`font-medium text-sm ${disabled ? 'text-gray-500' : 'text-gray-700'} ${disabled ? '' : 'cursor-pointer'}`}>{label}</label>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      <button
        id={id}
        onClick={onToggle}
        disabled={disabled}
        className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 ${
          checked ? 'bg-teal-600' : 'bg-gray-300'
        } ${disabled ? 'cursor-not-allowed' : ''}`}
        role="switch"
        aria-checked={checked}
      >
        <span className="sr-only">Toggle {label}</span>
        <span
          aria-hidden="true"
          className={`inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200 ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
);

const permissionGroupStyles = [
  { bg: 'bg-teal-50', border: 'border-teal-200', headerBg: 'bg-teal-100', headerText: 'text-teal-800' },
  { bg: 'bg-sky-50', border: 'border-sky-200', headerBg: 'bg-sky-100', headerText: 'text-sky-800' },
  { bg: 'bg-indigo-50', border: 'border-indigo-200', headerBg: 'bg-indigo-100', headerText: 'text-indigo-800' },
  { bg: 'bg-rose-50', border: 'border-rose-200', headerBg: 'bg-rose-100', headerText: 'text-rose-800' },
  { bg: 'bg-amber-50', border: 'border-amber-200', headerBg: 'bg-amber-100', headerText: 'text-amber-800' },
  { bg: 'bg-lime-50', border: 'border-lime-200', headerBg: 'bg-lime-100', headerText: 'text-lime-800' },
  { bg: 'bg-violet-50', border: 'border-violet-200', headerBg: 'bg-violet-100', headerText: 'text-violet-800' },
];

const PermissionGroup: React.FC<{ title: string; children: React.ReactNode; colorIndex: number; }> = ({ title, children, colorIndex }) => {
    const styles = permissionGroupStyles[colorIndex % permissionGroupStyles.length];
    return (
        <div className={`border rounded-lg h-fit shadow-sm ${styles.bg} ${styles.border}`}>
            <h4 className={`font-semibold ${styles.headerText} ${styles.headerBg} px-4 py-2 rounded-t-md border-b ${styles.border} text-sm`}>{title}</h4>
            <div className="p-4">
                {children}
            </div>
        </div>
    );
};

const InfoCard = ({ title, mainValue, icon, gradientClasses, disabledTooltip }: { title: string, mainValue: string | number, icon: React.ReactElement, gradientClasses?: string, disabledTooltip?: string }) => {
    const isGradient = !!gradientClasses;
    const isDisabled = mainValue === '--';
    const cardClasses = `p-1.5 rounded-lg shadow-lg flex flex-col justify-between relative ${isGradient ? gradientClasses : 'bg-white'} ${isDisabled ? 'opacity-60' : ''}`;

    return (
        <div className={cardClasses} title={disabledTooltip}>
            <div>
                <div className="flex items-start justify-between">
                    <div>
                        <p className={`text-[10px] font-medium ${isGradient ? 'text-white/80' : 'text-gray-500'}`}>{title}</p>
                        <p className={`text-lg font-bold ${isGradient ? 'text-white' : 'text-gray-800'}`}>{mainValue}</p>
                    </div>
                    <div className={`${isGradient ? 'bg-white/20 text-white' : 'bg-teal-100 text-teal-600'} p-1 rounded-md`}>
                        {React.cloneElement(icon as React.ReactElement<any>, { className: "h-3.5 w-3.5" })}
                    </div>
                </div>
            </div>
            <div className="mt-1 h-1"></div>
        </div>
    );
};


const UserDetailView: React.FC<UserDetailViewProps> = ({
  userId,
  allPrograms,
  coursesData,
  onClose,
  onChangePassword,
  fullRoutineData,
  systemDefaultSlots,
  selectedSemesterIdForRoutineView,
  ciwCounts,
  classRequirementCounts,
  getProgramShortName,
  allUsers,
  onMergeSections,
  onUnmergeSection,
}) => {
  const { users, loading: authLoading, updateUser, user: currentUser } = useAuth();
  const { getPermissionsForRole, userRoles, roleDisplayNames } = useRolePermissions();
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  
  const user = useMemo(() => {
    const baseUser = users.find(u => u.id === userId);
    if (!baseUser) return null;

    if (baseUser.employeeId) {
        const teacherDataFromCourses = coursesData.find(c => c.teacherId === baseUser.employeeId);
        if (teacherDataFromCourses && teacherDataFromCourses.designation) {
            return { ...baseUser, designation: teacherDataFromCourses.designation };
        }
    }
    return baseUser;
  }, [userId, users, coursesData]);
  
  const avatarInputRef = useRef<HTMLInputElement>(null);
  
  const [activeDetailTab, setActiveDetailTab] = useState<'settings' | 'routine' | 'courses'>('settings');

  const [accessibleProgramPIds, setAccessibleProgramPIds] = useState<string[]>([]);

  const isTeacher = useMemo(() => {
    if (!user || !user.employeeId) return false;
    return coursesData.some(course => course.teacherId === user.employeeId);
  }, [user, coursesData]);

  const userMobile = useMemo(() => {
    if (!user || !user.employeeId) return null;
    const teacherCourse = coursesData.find(c => c.teacherId === user.employeeId);
    return teacherCourse?.teacherMobile || null;
  }, [user, coursesData]);

  const canEditRole = currentUser?.role === 'admin' && currentUser.id !== user?.id;

  const handleRoleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!user || !canEditRole) return;
    const newRole = e.target.value as UserRole;

    const permissionsTemplate = getPermissionsForRole(newRole);

    if (!permissionsTemplate) {
      console.warn(`Permissions template for role "${newRole}" not found. Only updating role.`);
      const updatedUser = { ...user, role: newRole };
      try {
        await updateUser(updatedUser);
      } catch (error) {
        console.error("Failed to update user role", error);
      }
      return;
    }

    const updatedUser: User = {
      ...user,
      role: newRole,
      makeupSlotBookingAccess: permissionsTemplate.makeupSlotBookingAccess,
      bulkAssignAccess: permissionsTemplate.bulkAssignAccess,
      roomEditAccess: permissionsTemplate.roomEditAccess,
      dashboardAccess: permissionsTemplate.dashboardAccess,
      programManagementAccess: permissionsTemplate.programManagementAccess,
      notificationAccess: permissionsTemplate.notificationAccess,
    };

    try {
      await updateUser(updatedUser);
    } catch (error) {
      console.error("Failed to update user with new role and permissions", error);
    }
  };


  useEffect(() => {
    if (user) {
      // Start with the set of manually assigned programs.
      const pIdsToDisplay = new Set(user.accessibleProgramPIds || []);

      // If the user has an employeeId, find all programs they teach in from the courses data.
      if (user.employeeId) {
        coursesData
          .filter(course => course.teacherId === user.employeeId)
          .forEach(course => pIdsToDisplay.add(course.pId));
      }

      // Update the state with the combined list of programs.
      setAccessibleProgramPIds(Array.from(pIdsToDisplay));
    }
  }, [user, coursesData]); // Re-run when user or course data changes.
  
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) return;
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1 * 1024 * 1024) { // 1MB limit
        alert("Profile picture size should not exceed 1MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          await updateUser({ ...user, avatar: reader.result as string });
        } catch (error) {
          console.error("Failed to update avatar", error);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProgramAccessChange = async (pIds: string[]) => {
    if (!user) return;
    setAccessibleProgramPIds(pIds);
    const updatedUser = { ...user, accessibleProgramPIds: pIds };
    try {
      await updateUser(updatedUser);
    } catch (error) {
      console.error("Failed to update user program access", error);
      setAccessibleProgramPIds(user.accessibleProgramPIds ?? []);
    }
  };

  const handleAccessLevelChange = async (
    permissionKey: 'makeupSlotBookingAccess' | 'bulkAssignAccess',
    value: AssignAccessLevel
  ) => {
    if (!user) return;
    const updatedUser = { ...user, [permissionKey]: value };
    try {
        await updateUser(updatedUser);
    } catch (error) {
        console.error(`Failed to update user permission: ${permissionKey}`, error);
    }
  };
  
  const handleDashboardAccessLevelChange = async (
    permissionKey: 'classMonitoringAccess',
    value: AssignAccessLevel
  ) => {
    if (!user) return;
    const currentAccess = user.dashboardAccess || defaultDashboardAccess;
    const updatedUser = { ...user, dashboardAccess: { ...currentAccess, [permissionKey]: value } };
    try {
        await updateUser(updatedUser);
    } catch (error) {
        console.error(`Failed to update user permission: ${permissionKey}`, error);
    }
  };

  const handleRoomAccessToggle = async (permission: keyof RoomEditAccess) => {
    if (!user) return;
    const currentAccess: RoomEditAccess = user.roomEditAccess || { canManageRoomManagement: false, canAddBuilding: false, canAddRoom: false, canDeleteRoom: false, canViewRoomDetail: false, canEditAssignToProgram: false, canEditShareWithPrograms: false, canEditDetailsTab: false, canEditSlotsTab: false, canImportRoomData: false, canExportRoomData: false };
    let newAccess = { ...currentAccess, [permission]: !currentAccess[permission] };

    if (permission === 'canManageRoomManagement' && !newAccess.canManageRoomManagement) {
      newAccess = {
        canManageRoomManagement: false,
        canAddBuilding: false,
        canAddRoom: false,
        canDeleteRoom: false,
        canViewRoomDetail: false,
        canEditAssignToProgram: false,
        canEditShareWithPrograms: false,
        canEditDetailsTab: false,
        canEditSlotsTab: false,
        canImportRoomData: false,
        canExportRoomData: false,
      };
    }

    if (permission === 'canViewRoomDetail' && !newAccess.canViewRoomDetail) {
        newAccess.canEditAssignToProgram = false;
        newAccess.canEditShareWithPrograms = false;
        newAccess.canEditDetailsTab = false;
        newAccess.canEditSlotsTab = false;
    }

    const updatedUser = { ...user, roomEditAccess: newAccess };
    try { await updateUser(updatedUser); } catch (error) { console.error("Failed to update room edit permission", error); }
  };


  const handleDashboardAccessToggle = async (permission: keyof DashboardAccess) => {
    if (!user) return;
    const currentAccess = user.dashboardAccess || defaultDashboardAccess;
    const updatedUser = { ...user, dashboardAccess: { ...currentAccess, [permission]: !currentAccess[permission] } };
    try { await updateUser(updatedUser); } catch (error) { console.error("Failed to update dashboard access permission", error); }
  };

  const handleProgramAccessToggle = async (permission: keyof ProgramManagementAccess) => {
    if (!user) return;
    const currentAccess = user.programManagementAccess || { canAddProgram: false, canEditProgram: false };
    const newAccess = { ...currentAccess, [permission]: !currentAccess[permission] };
    const updatedUser = { ...user, programManagementAccess: newAccess };
    try {
      await updateUser(updatedUser);
    } catch (error) {
      console.error("Failed to update program management permission", error);
    }
  };

  const handleNotificationAccessToggle = async (permission: keyof NotificationAccess) => {
    if (!user) return;
    const currentAccess: NotificationAccess = user.notificationAccess || { canGetNotification: false, canApproveSlots: false };
    
    let newAccess = { ...currentAccess, [permission]: !currentAccess[permission] };

    // Logic: if canGetNotification is turned off, canApproveSlots must also be turned off.
    if (permission === 'canGetNotification' && !newAccess.canGetNotification) {
      newAccess.canApproveSlots = false;
    }
    
    // Logic: if canApproveSlots is turned on, canGetNotification must also be turned on.
    if (permission === 'canApproveSlots' && newAccess.canApproveSlots) {
        newAccess.canGetNotification = true;
    }

    const updatedUser = { ...user, notificationAccess: newAccess };
    try { await updateUser(updatedUser); } catch (error) { console.error("Failed to update notification permission", error); }
  };
  
  const isAdminViewingOther = currentUser?.role === 'admin' && currentUser.id !== user?.id;
  const canEditProfile = isAdminViewingOther || currentUser?.id === user?.id;

  const handleDayOffTabClick = async (day: DayOfWeek) => {
    if (!user || !canEditProfile) return;
    const currentDayOffs = user.dayOffs || [];
    const newDayOffs = currentDayOffs.includes(day)
      ? currentDayOffs.filter(d => d !== day)
      : [...currentDayOffs, day];
    
    const updatedUser = { ...user, dayOffs: newDayOffs };
    try {
      await updateUser(updatedUser);
    } catch (error) {
      console.error("Failed to update user day off", error);
    }
  };

  const handleClearDayOffs = async () => {
    if (!user || !canEditProfile) return;
    const updatedUser = { ...user, dayOffs: [] };
    try {
      await updateUser(updatedUser);
    } catch (error) {
      console.error("Failed to update user day off", error);
    }
  };

  const handlePreviewCourseLoadPDF = () => {
    if (!user || !selectedSemesterIdForRoutineView) return;

    const teacherCourses = coursesData.filter(c => c.teacherId === user.employeeId && c.semester === selectedSemesterIdForRoutineView);
    if (teacherCourses.length === 0) {
        alert("This teacher has no courses assigned in the selected semester to generate a PDF.");
        return;
    }

    generateCourseLoadPDF({
      teacher: user,
      courses: teacherCourses,
      semesterId: selectedSemesterIdForRoutineView,
      ciwCounts,
      crCounts: classRequirementCounts,
      getProgramShortName,
    });
  };

  const renderPermissionGroup = (
    permissions: (keyof DashboardAccess | keyof RoomEditAccess | keyof ProgramManagementAccess | keyof NotificationAccess)[],
    permissionType: 'dashboardAccess' | 'roomEditAccess' | 'programManagementAccess' | 'notificationAccess'
  ) => {
    if (!user) return null;
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4">
            {permissions.map(key => {
                let handleToggle: () => void;
                let isChecked = false;

                switch(permissionType) {
                    case 'dashboardAccess':
                        handleToggle = () => handleDashboardAccessToggle(key as keyof DashboardAccess);
                        isChecked = !!user.dashboardAccess?.[key as keyof DashboardAccess];
                        break;
                    case 'roomEditAccess':
                        handleToggle = () => handleRoomAccessToggle(key as keyof RoomEditAccess);
                        isChecked = !!user.roomEditAccess?.[key as keyof RoomEditAccess];
                        break;
                    case 'programManagementAccess':
                        handleToggle = () => handleProgramAccessToggle(key as keyof ProgramManagementAccess);
                        isChecked = !!user.programManagementAccess?.[key as keyof ProgramManagementAccess];
                        break;
                    case 'notificationAccess':
                        handleToggle = () => handleNotificationAccessToggle(key as keyof NotificationAccess);
                        isChecked = !!user.notificationAccess?.[key as keyof NotificationAccess];
                        break;
                    default:
                        handleToggle = () => {};
                }

                return (
                    <PermissionToggle
                        key={key}
                        id={`${user.id}-${key}`}
                        label={PERMISSION_LABELS[key] || key}
                        checked={isChecked}
                        onToggle={handleToggle}
                        disabled={!isAdminViewingOther}
                    />
                );
            })}
        </div>
    );
  };
  
    const statsForUser = useMemo(() => {
        if (!user || !isTeacher || !selectedSemesterIdForRoutineView) {
            return { courseCount: 0, sectionCount: 0, creditLoad: 0, weeklyRequirement: 0, bookedSlots: 0 };
        }

        const teacherCourses = coursesData.filter(c =>
            c.teacherId === user.employeeId && c.semester === selectedSemesterIdForRoutineView
        );

        if (teacherCourses.length === 0) {
            return { courseCount: 0, sectionCount: 0, creditLoad: 0, weeklyRequirement: 0, bookedSlots: 0 };
        }

        const courseCount = new Set(teacherCourses.map(c => c.courseCode)).size;
        const sectionCount = teacherCourses.length;
        const creditLoad = teacherCourses.reduce((sum, c) => sum + c.credit, 0);
        const weeklyRequirement = teacherCourses.reduce((sum, c) => sum + (c.weeklyClass || 0), 0);
        const bookedSlots = teacherCourses.reduce((sum, c) => sum + (ciwCounts.get(c.sectionId) || 0), 0);

        return { courseCount, sectionCount, creditLoad, weeklyRequirement, bookedSlots };
    }, [user, isTeacher, coursesData, selectedSemesterIdForRoutineView, ciwCounts]);


  if (authLoading) {
    return <div className="p-6 text-center text-gray-500">Loading user details...</div>;
  }

  if (!user) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-xl text-center">
        <h2 className="text-xl font-semibold text-red-600">User Not Found</h2>
        <p className="text-gray-600 mt-2">The selected user (ID: {userId}) could not be found.</p>
      </div>
    );
  }

  const renderAvatar = (avatar?: string) => {
    if (avatar && avatar.startsWith('data:image')) {
      return <img src={avatar} alt="User Avatar" className="w-full h-full object-cover" />;
    }
    return <span className="text-3xl">{avatar || '❓'}</span>;
  };
  
    const gradients = [
        'bg-gradient-to-br from-blue-500 to-indigo-600',
        'bg-gradient-to-br from-green-500 to-teal-600',
        'bg-gradient-to-br from-purple-500 to-pink-600',
        'bg-gradient-to-br from-yellow-500 to-orange-600',
        'bg-gradient-to-br from-cyan-500 to-sky-600',
    ];

    const userDashboardAccess = user?.dashboardAccess;

  return (
    <div className="h-full w-full bg-slate-100 rounded-lg shadow-xl flex flex-col overflow-hidden relative">
        <button
            onClick={onClose}
            className="absolute top-3 right-3 z-20 text-gray-400 hover:text-red-700 bg-white/70 backdrop-blur-sm p-1.5 rounded-full hover:bg-red-100 transition-colors"
            aria-label="Close user details"
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        
        {/* Horizontal Header */}
        <header className="flex-shrink-0 bg-slate-50 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 gap-3">
                {/* Profile Info */}
                <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="relative group w-16 h-16">
                        <div className="w-full h-full rounded-full bg-gray-200 flex items-center justify-center overflow-hidden ring-4 ring-white shadow-md">
                            {renderAvatar(user.avatar)}
                        </div>
                        {canEditProfile && (
                            <>
                                <input type="file" ref={avatarInputRef} onChange={handleAvatarChange} className="hidden" accept="image/*" />
                                <button
                                    onClick={() => avatarInputRef.current?.click()}
                                    className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-50 flex items-center justify-center rounded-full transition-all duration-200 opacity-0 group-hover:opacity-100"
                                    aria-label="Change profile picture"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                </button>
                            </>
                        )}
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-800" title={user.name}>{user.name}</h2>
                        {user.designation && <p className="text-sm text-gray-600 font-medium">{user.designation}</p>}
                        
                        {/* Info Bar */}
                        <div className="mt-2 flex items-center flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                            {user.employeeId && (
                                <div className="flex items-center gap-1.5" title="Employee ID">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 2a1 1 0 00-1 1v1a1 1 0 002 0V3a1 1 0 00-1-1zM4 4h3a3 3 0 006 0h3a2 2 0 012 2v9a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zm12 5a1 1 0 100-2H4a1 1 0 100 2h12zM4 13a1 1 0 100-2h6a1 1 0 100 2H4z" clipRule="evenodd" /></svg>
                                    <span className="font-medium">{user.employeeId}</span>
                                </div>
                            )}
                            {userMobile && (
                                <div className="flex items-center gap-1.5" title="Mobile Number">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" /></svg>
                                    <a href={`tel:${userMobile}`} className="hover:underline hover:text-teal-600">{userMobile}</a>
                                </div>
                            )}
                            <div className="flex items-center gap-1.5" title="Email Address">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" /><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" /></svg>
                                <a href={`mailto:${user.email}`} className="hover:underline hover:text-teal-600">{user.email}</a>
                            </div>
                            <div className="flex items-center gap-1.5" title="User Role">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 1.944A11.954 11.954 0 012.166 5.09l.832 2.19A10 10 0 0010 4.545V1.944zM11.954 2.166A11.954 11.954 0 0010 1.944v2.601a10 10 0 015.656 2.103l2.19-.832A11.954 11.954 0 0011.954 2.166zM18.06 5.09A11.954 11.954 0 0117.834 10h-2.601a10 10 0 00-2.103-5.656l.832-2.19zM15.455 10a10 10 0 01-2.103 5.656l2.19.832A11.954 11.954 0 0018.06 10h-2.601zM10 15.455a10 10 0 01-5.656-2.103l-2.19.832A11.954 11.954 0 008.046 17.834L10 15.455zM4.545 10a10 10 0 012.103-5.656l-2.19-.832A11.954 11.954 0 001.944 10h2.601z" clipRule="evenodd" /></svg>
                                <select id="role-select" value={user.role} onChange={handleRoleChange} disabled={!canEditRole} className="p-0 text-sm font-medium border-0 focus:ring-0 bg-transparent disabled:text-gray-500 disabled:cursor-not-allowed">
                                    {userRoles.map(role => (<option key={role} value={role}>{roleDisplayNames[role] || role}</option>))}
                                </select>
                            </div>
                            {currentUser?.role === 'admin' && (
                              <button 
                                onClick={() => setIsRoleModalOpen(true)} 
                                className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                                title="Manage permissions for all user roles"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                    <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.022 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                                </svg>
                                Manage Roles
                              </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <nav>
                    <ul className="flex items-center gap-1 sm:gap-2">
                        <li><button onClick={() => setActiveDetailTab('settings')} className={`text-sm font-medium p-2 rounded-md flex items-center gap-2 transition-colors ${activeDetailTab === 'settings' ? 'bg-teal-100 text-teal-700' : 'text-gray-600 hover:bg-gray-200'}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-1.57 1.996A1.532 1.532 0 013.17 8.51c-1.56.38-1.56 2.6 0 2.98a1.532 1.532 0 01.948 2.286c-.836 1.372.734 2.942 1.996 1.57a1.532 1.532 0 012.286.948c.38 1.56 2.6 1.56 2.98 0a1.532 1.532 0 012.286-.948c1.372.836 2.942-.734-1.57-1.996A1.532 1.532 0 0116.83 8.51c1.56-.38 1.56-2.6 0-2.98a1.532 1.532 0 01-.948-2.286c.836-1.372-.734-2.942-1.996-1.57A1.532 1.532 0 0111.49 3.17zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" /></svg>
                            <span className="hidden sm:inline">Settings</span>
                        </button></li>
                        {isTeacher && <>
                        <li><button onClick={() => setActiveDetailTab('routine')} className={`text-sm font-medium p-2 rounded-md flex items-center gap-2 transition-colors ${activeDetailTab === 'routine' ? 'bg-teal-100 text-teal-700' : 'text-gray-600 hover:bg-gray-200'}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" /></svg>
                            <span className="hidden sm:inline">Routine</span>
                        </button></li>
                        <li><button onClick={() => setActiveDetailTab('courses')} className={`text-sm font-medium p-2 rounded-md flex items-center gap-2 transition-colors ${activeDetailTab === 'courses' ? 'bg-teal-100 text-teal-700' : 'text-gray-600 hover:bg-gray-200'}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" /><path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" /></svg>
                            <span className="hidden sm:inline">Courses</span>
                        </button></li>
                        </>}
                    </ul>
                </nav>
            </div>
        </header>

        {/* Main Content */}
        <main className="flex-grow min-h-0 overflow-y-auto custom-scrollbar p-4 sm:p-6">
            {isTeacher && selectedSemesterIdForRoutineView && (
                 <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
                    <InfoCard 
                        title="Assigned Courses" 
                        mainValue={userDashboardAccess?.canViewCourseList ? statsForUser.courseCount : '--'}
                        disabledTooltip={!userDashboardAccess?.canViewCourseList ? "Permission denied: canViewCourseList" : undefined}
                        icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>} 
                        gradientClasses={gradients[0]} 
                    />
                    <InfoCard 
                        title="Assigned Sections" 
                        mainValue={userDashboardAccess?.canViewSectionList ? statsForUser.sectionCount : '--'}
                        disabledTooltip={!userDashboardAccess?.canViewSectionList ? "Permission denied: canViewSectionList" : undefined}
                        icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>} 
                        gradientClasses={gradients[1]}
                    />
                    <InfoCard 
                        title="Total Credit Load" 
                        mainValue={userDashboardAccess?.canViewSectionList ? statsForUser.creditLoad.toFixed(2) : '--'}
                        disabledTooltip={!userDashboardAccess?.canViewSectionList ? "Permission denied: canViewSectionList" : undefined}
                        icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>} 
                        gradientClasses={gradients[2]}
                    />
                    <InfoCard 
                        title="Weekly Requirement" 
                        mainValue={userDashboardAccess?.canViewSlotRequirement ? statsForUser.weeklyRequirement : '--'}
                        disabledTooltip={!userDashboardAccess?.canViewSlotRequirement ? "Permission denied: canViewSlotRequirement" : undefined}
                        icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h5m-5 2a9 9 0 001.378 5.622M20 20v-5h-5m5 2a9 9 0 00-1.378-5.622" /></svg>} 
                        gradientClasses={gradients[3]}
                    />
                    <InfoCard 
                        title="Booked Slots (CIW)" 
                        mainValue={userDashboardAccess?.canViewSlotUsage ? statsForUser.bookedSlots : '--'}
                        disabledTooltip={!userDashboardAccess?.canViewSlotUsage ? "Permission denied: canViewSlotUsage" : undefined}
                        icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>} 
                        gradientClasses={gradients[4]}
                    />
                </div>
            )}
            {activeDetailTab === 'settings' && (
                <div className="space-y-6 max-w-5xl mx-auto">
                    {isTeacher && (
                        <div className="bg-white p-4 rounded-lg border">
                            <div className="flex justify-between items-center">
                                <h3 className="text-base font-semibold text-gray-800">Weekly Day Off</h3>
                                <button
                                onClick={handleClearDayOffs}
                                disabled={!canEditProfile}
                                className="text-xs font-medium text-red-600 hover:text-red-500 disabled:text-gray-400 disabled:cursor-not-allowed"
                                >
                                Clear All
                                </button>
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5 mb-1.5">Auto-scheduler will avoid assigning classes on this day.</p>
                            <div className="flex flex-wrap gap-2">
                                <button type="button" onClick={handleClearDayOffs} disabled={!canEditProfile} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${!user.dayOffs || user.dayOffs.length === 0 ? 'bg-teal-600 text-white shadow' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'} ${!canEditProfile ? 'opacity-60 cursor-not-allowed' : ''}`}>None</button>
                                {DAYS_OF_WEEK.map(day => (<button key={day} type="button" onClick={() => handleDayOffTabClick(day)} disabled={!canEditProfile} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${user.dayOffs?.includes(day) ? 'bg-teal-600 text-white shadow' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'} ${!canEditProfile ? 'opacity-60 cursor-not-allowed' : ''}`}>{day}</button>))}
                            </div>
                        </div>
                    )}
                    {isAdminViewingOther && (
                        <>
                            <div className="bg-white p-4 rounded-lg border">
                                <h3 className="text-base font-semibold text-gray-800 mb-4">Program Access Control</h3>
                                <SearchableProgramDropdownForRooms idSuffix="user-detail-view" programs={allPrograms} selectedPIds={accessibleProgramPIds} onPIdsChange={handleProgramAccessChange} multiSelect={true} placeholderText="Select accessible programs..." disabled={user.role === 'admin'} />
                                {user.role === 'admin' && (<p className="text-xs text-teal-600 mt-2 italic">Admin role has access to all programs by default.</p>)}
                            </div>
                            <div className="space-y-4">
                                <PermissionGroup title="Routine Access & Actions" colorIndex={0}>
                                    {renderPermissionGroup(['canViewEditableRoutine', 'canViewPublishedRoutine', 'canPublishRoutine'], 'dashboardAccess')}
                                </PermissionGroup>
                                <PermissionGroup title="Dashboard Access" colorIndex={1}>
                                    {renderPermissionGroup(['canViewCourseList', 'canViewSectionList', 'canViewRoomList', 'canViewTeacherList', 'canViewSlotRequirement', 'canViewSlotUsage', 'canViewMakeupSchedule', 'canViewSectionTable', 'canCustomizeTheme'], 'dashboardAccess')}
                                </PermissionGroup>
                                <PermissionGroup title="Routine Management" colorIndex={2}>
                                    <div className="space-y-4">
                                        {renderPermissionGroup(['canAutoAssign', 'canManageVersions', 'canDragAndDrop', 'canViewSlotHistory'], 'dashboardAccess')}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-4 border-t border-gray-200">
                                            <div>
                                                <label htmlFor="class-monitoring-access" className="block text-sm font-medium text-gray-700">Class Monitoring</label>
                                                <p className="text-xs text-gray-500 mb-1">Allows user to log attendance and schedule make-up classes.</p>
                                                <select id="class-monitoring-access" value={user.dashboardAccess?.classMonitoringAccess || 'none'} onChange={(e) => handleDashboardAccessLevelChange('classMonitoringAccess', e.target.value as AssignAccessLevel)} disabled={!isAdminViewingOther} className="mt-1 block w-full p-2 border border-gray-300 rounded-md text-sm">
                                                    <option value="none">No Access</option>
                                                    <option value="own">Own Courses</option>
                                                    <option value="full">Full Access</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label htmlFor="bulk-assign-access" className="block text-sm font-medium text-gray-700">Bulk Assign</label>
                                                <p className="text-xs text-gray-500 mb-1">Assigns a course to all weeks for a slot.</p>
                                                <select id="bulk-assign-access" value={user.bulkAssignAccess || 'none'} onChange={(e) => handleAccessLevelChange('bulkAssignAccess', e.target.value as AssignAccessLevel)} disabled={!isAdminViewingOther} className="mt-1 block w-full p-2 border border-gray-300 rounded-md text-sm">
                                                    <option value="none">No Access</option>
                                                    <option value="own">Own Courses</option>
                                                    <option value="full">Full Access</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label htmlFor="makeup-access" className="block text-sm font-medium text-gray-700">Make-up/Specific</label>
                                                <p className="text-xs text-gray-500 mb-1">Assigns single classes to specific dates.</p>
                                                <select id="makeup-access" value={user.makeupSlotBookingAccess || 'none'} onChange={(e) => handleAccessLevelChange('makeupSlotBookingAccess', e.target.value as AssignAccessLevel)} disabled={!isAdminViewingOther} className="mt-1 block w-full p-2 border border-gray-300 rounded-md text-sm">
                                                    <option value="none">No Access</option>
                                                    <option value="own">Own Courses</option>
                                                    <option value="full">Full Access</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                </PermissionGroup>
                                <PermissionGroup title="Room Management" colorIndex={3}>
                                    {renderPermissionGroup(['canManageRoomManagement', 'canAddBuilding', 'canAddRoom', 'canDeleteRoom', 'canViewRoomDetail', 'canEditAssignToProgram', 'canEditShareWithPrograms', 'canEditDetailsTab', 'canEditSlotsTab', 'canImportRoomData', 'canExportRoomData'], 'roomEditAccess')}
                                </PermissionGroup>
                                <PermissionGroup title="Course Data" colorIndex={4}>
                                    {renderPermissionGroup(['canEditCourseSectionDetails', 'canImportCourseData', 'canExportCourseData'], 'dashboardAccess')}
                                </PermissionGroup>
                                <PermissionGroup title="System Setup" colorIndex={5}>
                                    {renderPermissionGroup(['canManageProgramSetup', 'canManageDefaultSlots', 'canManageSemesterSetup'], 'dashboardAccess')}
                                </PermissionGroup>
                                {user.dashboardAccess?.canManageProgramSetup && (
                                <PermissionGroup title="Program Management" colorIndex={6}>
                                    {renderPermissionGroup(['canAddProgram', 'canEditProgram'], 'programManagementAccess')}
                                </PermissionGroup>
                                )}
                                <PermissionGroup title="Notifications" colorIndex={7}>
                                    {renderPermissionGroup(['canGetNotification', 'canApproveSlots'], 'notificationAccess')}
                                </PermissionGroup>
                            </div>
                        </>
                    )}
                </div>
            )}
            {activeDetailTab === 'routine' && <TeacherRoutineTab user={user} fullRoutineData={fullRoutineData} systemDefaultSlots={systemDefaultSlots} allPrograms={allPrograms} selectedSemesterId={selectedSemesterIdForRoutineView} coursesData={coursesData} allUsers={allUsers} />}
            {activeDetailTab === 'courses' && <TeacherCoursesTab user={user} coursesData={coursesData} selectedSemesterId={selectedSemesterIdForRoutineView} ciwCounts={ciwCounts} classRequirementCounts={classRequirementCounts} getProgramShortName={getProgramShortName} onPreviewPDF={handlePreviewCourseLoadPDF} onMergeSections={onMergeSections} onUnmergeSection={onUnmergeSection} />}
        </main>
        
        <RolePermissionModal
            isOpen={isRoleModalOpen}
            onClose={() => setIsRoleModalOpen(false)}
        />
    </div>
  );
};

const TeacherRoutineTab: React.FC<{user: User, fullRoutineData: { [key: string]: FullRoutineData }, systemDefaultSlots: DefaultTimeSlot[], allPrograms: ProgramEntry[], selectedSemesterId: string | null, coursesData: EnrollmentEntry[], allUsers: User[] }> = ({ user, fullRoutineData, systemDefaultSlots, allPrograms, selectedSemesterId, coursesData, allUsers }) => {
    const teacherCourses = useMemo(() => coursesData.filter(c => c.teacherId === user.employeeId && c.semester === selectedSemesterId), [user, selectedSemesterId, coursesData]);
    const { schedule, theorySlots, labSlots } = useMemo(() => {
        if (!user.employeeId || !selectedSemesterId) return { schedule: new Map(), theorySlots: [], labSlots: [] };
        const routineForSemester = fullRoutineData[selectedSemesterId] || {};
        const teacherSchedule = new Map<DayOfWeek, Map<string, { classInfo: ClassDetail; room: string }>>();
        const relevantProgramPIds = new Set(teacherCourses.map(c => c.pId));
        const relevantPrograms = allPrograms.filter(p => relevantProgramPIds.has(p.pId));
        
        const timeSlotMap = new Map<string, DefaultTimeSlot>();
        systemDefaultSlots.forEach(slot => timeSlotMap.set(formatDefaultSlotToString(slot), slot));
        relevantPrograms.forEach(p => (p.programSpecificSlots || []).forEach(slot => timeSlotMap.set(formatDefaultSlotToString(slot), slot)));
        const timeSlots = Array.from(timeSlotMap.values()).sort(sortSlotsByTypeThenTime);
        const activeTab = 'All'; // Defaulting to 'All' to resolve undeclared variable error and show all slots.
        const theorySlots = (activeTab === 'All' || activeTab === 'Theory') ? timeSlots.filter(s => s.type === 'Theory') : [];
        const labSlots = (activeTab === 'All' || activeTab === 'Lab') ? timeSlots.filter(s => s.type === 'Lab') : [];
        DAYS_OF_WEEK.forEach(day => {
            const daySchedule = new Map<string, { classInfo: ClassDetail; room: string }>();
            const dayData = routineForSemester[day];
            if (dayData) {
                Object.entries(dayData).forEach(([room, slots]) => {
                    Object.entries(slots).forEach(([slotString, classInfo]) => {
                        if (classInfo && classInfo.teacher === user.name) daySchedule.set(slotString, { classInfo, room });
                    });
                });
            }
            if (daySchedule.size > 0) teacherSchedule.set(day, daySchedule);
        });
        return { schedule: teacherSchedule, theorySlots, labSlots };
    }, [user, selectedSemesterId, fullRoutineData, systemDefaultSlots, allPrograms, teacherCourses]);

    const handlePreviewPDF = () => {
        if (!selectedSemesterId || !user.employeeId) {
            alert("Please select a semester to generate the routine.");
            return;
        }

        generateTeacherRoutinePDF({
            teacherId: user.employeeId,
            semesterId: selectedSemesterId,
            coursesData,
            routineData: fullRoutineData,
            allPrograms,
            systemDefaultTimeSlots: systemDefaultSlots,
            allUsers,
        });
    };

    if (!selectedSemesterId) return <div className="text-center text-gray-500 p-4 bg-gray-50 rounded-lg">Please select a semester from the sidebar to view the routine.</div>;
    return (
        <>
        <div className="overflow-auto custom-scrollbar border rounded-lg bg-gray-50 p-2">
            <div className="relative mb-2 flex h-8 items-center">
                <h3 className="absolute inset-x-0 text-center text-lg font-bold text-teal-700 pointer-events-none">
                    Daffodil International University
                </h3>
                <div className="ml-auto">
                    <button
                        onClick={handlePreviewPDF}
                        disabled={!selectedSemesterId}
                        title={!selectedSemesterId ? "Select a semester to generate PDF" : "Preview Routine as PDF"}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-teal-600 rounded-md shadow-sm hover:bg-teal-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v3a2 2 0 002 2h6a2 2 0 002-2v-3h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v3h6v-3z" clipRule="evenodd" />
                          <path d="M9 9a1 1 0 00-1 1v1a1 1 0 102 0v-1a1 1 0 00-1-1z" />
                        </svg>
                        Preview PDF
                    </button>
                </div>
            </div>
            <table className="min-w-full table-fixed border-collapse">
                 <thead className="sticky top-0 bg-gray-100 z-10">
                    <tr>
                        <th rowSpan={2} className="w-24 p-1 text-center text-[10px] font-bold text-white bg-teal-600 border border-gray-300 align-middle">Day</th>
                        {theorySlots.length > 0 && (
                            <th colSpan={theorySlots.length} className="p-1 text-center text-[10px] font-bold bg-teal-600 text-white uppercase border border-gray-300">
                                Theory
                            </th>
                        )}
                        {labSlots.length > 0 && (
                            <th colSpan={labSlots.length} className="p-1 text-center text-[10px] font-bold bg-teal-600 text-white uppercase border border-gray-300">
                                Lab
                            </th>
                        )}
                    </tr>
                    <tr>
                        {theorySlots.map(slot => {
                            const startTimeAMPM = formatTimeToAMPM(slot.startTime);
                            const endTimeAMPM = formatTimeToAMPM(slot.endTime);
                            return (
                                <th key={slot.id} className="w-28 p-1 text-center text-[9px] font-bold bg-teal-500 text-white uppercase border border-gray-300">
                                    <span className="hidden lg:inline">{startTimeAMPM} - {endTimeAMPM}</span>
                                    <div className="lg:hidden flex flex-col leading-tight">
                                        <span>startTimeAMPM</span>
                                        <hr className="border-t border-teal-300 w-1/2 mx-auto my-0.5" />
                                        <span>{endTimeAMPM}</span>
                                    </div>
                                </th>
                            );
                        })}
                        {labSlots.map(slot => {
                            const startTimeAMPM = formatTimeToAMPM(slot.startTime);
                            const endTimeAMPM = formatTimeToAMPM(slot.endTime);
                            return (
                                <th key={slot.id} className="w-28 p-1 text-center text-[9px] font-bold bg-teal-500 text-white uppercase border border-gray-300">
                                    <span className="hidden lg:inline">{startTimeAMPM} - {endTimeAMPM}</span>
                                    <div className="lg:hidden flex flex-col leading-tight">
                                        <span>startTimeAMPM</span>
                                        <hr className="border-t border-teal-300 w-1/2 mx-auto my-0.5" />
                                        <span>{endTimeAMPM}</span>
                                    </div>
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                <tbody className="text-center">{DAYS_OF_WEEK.map(day => (<tr key={day} className="even:bg-white odd:bg-gray-50"><th className="p-1 text-xs font-bold text-white bg-teal-600 border border-gray-300 h-12">{day}</th>{theorySlots.map(slot => { const slotString = formatDefaultSlotToString(slot); const entry = schedule.get(day)?.get(slotString); return (<td key={slot.id} className="p-0.5 border border-gray-300 h-12 align-top">{entry ? (<div className={`h-full w-full p-0.5 rounded-md text-center flex flex-col justify-center ${entry.classInfo.color || 'bg-gray-200'}`}><p className="font-bold text-gray-800 text-[10px] truncate" title={`${entry.classInfo.courseCode} (${entry.classInfo.section})`}>{entry.classInfo.courseCode} ({entry.classInfo.section})</p><p className="text-gray-600 text-[9px] mt-0.5" title={`Room: ${entry.room}`}>{entry.room}</p></div>) : (<div className="h-full w-full flex items-center justify-center text-xs text-gray-400">-</div>)}</td>);})}{labSlots.map((slot, index) => { const slotString = formatDefaultSlotToString(slot); const entry = schedule.get(day)?.get(slotString); return (<td key={slot.id} className={`p-0.5 border border-gray-300 h-12 align-top ${index === 0 && theorySlots.length > 0 ? 'border-l-2 border-l-slate-400' : ''}`}>{entry ? (<div className={`h-full w-full p-0.5 rounded-md text-center flex flex-col justify-center ${entry.classInfo.color || 'bg-gray-200'}`}><p className="font-bold text-gray-800 text-[10px] truncate" title={`${entry.classInfo.courseCode} (${entry.classInfo.section})`}>{entry.classInfo.courseCode} ({entry.classInfo.section})</p><p className="text-gray-600 text-[9px] mt-0.5" title={`Room: ${entry.room}`}>{entry.room}</p></div>) : (<div className="h-full w-full flex items-center justify-center text-xs text-gray-400">-</div>)}</td>);})}</tr>))}</tbody>
            </table>
        </div>
        {user.dayOffs && user.dayOffs.length > 0 && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
                <p className="font-semibold text-yellow-800">Note:</p>
                <p className="text-yellow-700">
                    This teacher's designated day(s) off are: <span className="font-bold">{user.dayOffs.join(', ')}</span>. The auto-scheduler will avoid these days for this teacher.
                </p>
            </div>
        )}
        </>
    );
};

type DisplayCourse = EnrollmentEntry & { mergedCourses?: DisplayCourse[] };

const TeacherCoursesTab: React.FC<{ user: User, coursesData: EnrollmentEntry[], selectedSemesterId: string | null, ciwCounts: Map<string, number>, classRequirementCounts: Map<string, number>, getProgramShortName: (pId?: string) => string, onPreviewPDF: () => void, onMergeSections: (sourceSectionId: string, targetSectionId: string) => void, onUnmergeSection: (sectionIdToUnmerge: string) => void }> = ({ user, coursesData, selectedSemesterId, ciwCounts, classRequirementCounts, getProgramShortName, onPreviewPDF, onMergeSections, onUnmergeSection }) => {
    
    const [dragOverSectionId, setDragOverSectionId] = useState<string | null>(null);
    const [draggingSectionId, setDraggingSectionId] = useState<string | null>(null);

    const getTreeStats = useCallback((course: DisplayCourse): { students: number, ciw: number, cr: number, cat: number } => {
        const directStats = {
            students: course.studentCount,
            ciw: ciwCounts.get(course.sectionId) ?? 0,
            cr: classRequirementCounts.get(course.sectionId) ?? 0,
            cat: course.classTaken,
        };

        if (!course.mergedCourses || course.mergedCourses.length === 0) {
            return directStats;
        }

        return course.mergedCourses.reduce((acc, child) => {
            const childStats = getTreeStats(child);
            acc.students += childStats.students;
            acc.ciw += childStats.ciw;
            acc.cr += childStats.cr;
            acc.cat += childStats.cat;
            return acc;
        }, directStats);
    }, [ciwCounts, classRequirementCounts]);
    
    const displayCourses = useMemo(() => {
        if (!user.employeeId || !selectedSemesterId) return [];

        const teacherCourses = coursesData.filter(c => c.teacherId === user.employeeId && c.semester === selectedSemesterId);
        
        const courseMap = new Map<string, DisplayCourse>();
        teacherCourses.forEach(c => {
            courseMap.set(c.sectionId, { ...c, mergedCourses: [] });
        });

        const rootCourses: DisplayCourse[] = [];
        courseMap.forEach((course) => {
            if (course.mergedWithSectionId) {
                const parent = courseMap.get(course.mergedWithSectionId);
                if (parent) {
                    parent.mergedCourses!.push(course);
                } else {
                    rootCourses.push(course);
                }
            } else {
                rootCourses.push(course);
            }
        });
        
        const sortChildren = (courses: DisplayCourse[]) => {
            courses.sort((a,b) => a.courseCode.localeCompare(b.courseCode) || a.section.localeCompare(b.section));
            courses.forEach(c => {
                if (c.mergedCourses && c.mergedCourses.length > 0) sortChildren(c.mergedCourses);
            });
        };

        rootCourses.forEach(c => {
            if(c.mergedCourses && c.mergedCourses.length > 0) sortChildren(c.mergedCourses);
        });

        return rootCourses.sort((a,b) => a.courseCode.localeCompare(b.courseCode) || a.section.localeCompare(b.section));

    }, [user.employeeId, selectedSemesterId, coursesData]);


    const handleDragStart = (e: React.DragEvent<HTMLTableRowElement>, sectionId: string) => {
        e.dataTransfer.setData("application/json", JSON.stringify({ type: 'merge-course', sectionId }));
        e.dataTransfer.effectAllowed = "move";
        setDraggingSectionId(sectionId);
    };
    
    const handleDragEnd = () => {
        setDraggingSectionId(null);
        setDragOverSectionId(null);
    };

    const handleDragOver = (e: React.DragEvent<HTMLElement>) => {
        e.preventDefault();
    };

    const handleRowDragEnter = (e: React.DragEvent<HTMLTableRowElement>, sectionId: string) => {
        e.preventDefault();
        if (draggingSectionId && draggingSectionId !== sectionId) {
            setDragOverSectionId(sectionId);
        }
    };
    
    const handleRowDragLeave = (e: React.DragEvent<HTMLTableRowElement>) => {
        e.preventDefault();
        setDragOverSectionId(null);
    };
    
    const handleDropOnRow = (e: React.DragEvent<HTMLTableRowElement>, targetSectionId: string) => {
        e.preventDefault();
        setDragOverSectionId(null);
        const data = JSON.parse(e.dataTransfer.getData("application/json"));
        if (data.type !== 'merge-course') return;
        const draggedSectionId = data.sectionId;
        if (draggedSectionId === targetSectionId) return;
        onMergeSections(draggedSectionId, targetSectionId);
    };
    
    const handleUnmergeClick = (parentSectionId: string, chipSectionId: string) => {
        onUnmergeSection(chipSectionId);
    };

    const totals = useMemo(() => {
        return displayCourses.reduce((acc, course) => {
            acc.credits += course.credit; // ONLY parent course credit
            const treeStats = getTreeStats(course);
            acc.students += treeStats.students;
            acc.ciw += treeStats.ciw;
            acc.cr += treeStats.cr;
            acc.cat += treeStats.cat;
            return acc;
        }, { credits: 0, students: 0, ciw: 0, cr: 0, cat: 0 });
    }, [displayCourses, getTreeStats]);

    const renderMergedRows = (courses: DisplayCourse[], level: number, parentId: string) => {
        return courses.map(merged => {
            const rowStats = getTreeStats(merged);
            return (
                <React.Fragment key={merged.sectionId}>
                    <tr className="bg-slate-50">
                        <td className="px-2 py-1.5 align-top" style={{ paddingLeft: `${0.5 + level * 1.5}rem` }}>
                            <div className="flex items-center gap-1">
                                <button onClick={() => handleUnmergeClick(parentId, merged.sectionId)} className="font-mono text-lg text-gray-500 hover:text-red-600 transition-colors" title="Unmerge section">↳</button>
                                <div className="font-semibold text-gray-800">{merged.courseCode}</div>
                            </div>
                        </td>
                        <td className="px-2 py-1.5 align-top text-gray-600 truncate max-w-xs" title={merged.courseTitle}>{merged.courseTitle}</td>
                        <td className="px-2 py-1.5 text-center align-middle text-gray-500 italic">Merge</td>
                        <td className="px-2 py-1.5 align-top font-medium text-gray-700">{merged.section}</td>
                        <td className="px-2 py-1.5 align-top text-gray-600">{getProgramShortName(merged.pId)}</td>
                        <td className="px-2 py-1.5 text-center align-middle text-gray-600">{rowStats.students}</td>
                        <td className="px-2 py-1.5 text-center align-middle font-semibold text-blue-600">{rowStats.ciw}</td>
                        <td className="px-2 py-1.5 text-center align-middle font-semibold text-purple-600">{rowStats.cr}</td>
                        <td className="px-2 py-1.5 text-center align-middle font-semibold text-green-600">{rowStats.cat}</td>
                    </tr>
                    {merged.mergedCourses && renderMergedRows(merged.mergedCourses, level + 1, merged.sectionId)}
                </React.Fragment>
            );
        });
    };

    if (!selectedSemesterId) return <div className="p-4 text-center text-sm text-gray-500">Please select a semester.</div>;
    if (displayCourses.length === 0) return <div className="p-4 text-center text-sm text-gray-500">No courses assigned to this teacher for the selected semester.</div>;

    return (
        <div className="flex flex-col h-full">
            <div className="flex justify-between items-center mb-2 flex-shrink-0">
                <h3 className="text-base font-semibold text-gray-800">
                    Course Load ({displayCourses.length} rows)
                </h3>
                <button
                    onClick={onPreviewPDF}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-teal-600 rounded-md shadow-sm hover:bg-teal-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v3a2 2 0 002 2h6a2 2 0 002-2v-3h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v3h6v-3z" clipRule="evenodd" />
                      <path d="M9 9a1 1 0 00-1 1v1a1 1 0 102 0v-1a1 1 0 00-1-1z" />
                    </svg>
                    Preview PDF
                </button>
            </div>
            <div className="overflow-auto custom-scrollbar border rounded-lg flex-grow">
                <table className="min-w-full divide-y divide-gray-200 text-xs">
                    <thead className="bg-gray-50 sticky top-0 z-10"><tr>
                        <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">Course Code</th>
                        <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">Course Title</th>
                        <th className="px-2 py-2 text-center font-medium text-gray-500 uppercase">Credit</th>
                        <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">Section</th>
                        <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">Program</th>
                        <th className="px-2 py-2 text-center font-medium text-gray-500 uppercase" title="Students">Stu</th>
                        <th className="px-2 py-2 text-center font-medium text-gray-500 uppercase" title="Classes in Week">CIW</th>
                        <th className="px-2 py-2 text-center font-medium text-gray-500 uppercase" title="Class Requirement">CR</th>
                        <th className="px-2 py-2 text-center font-medium text-gray-500 uppercase" title="Classes Taken">CAT</th>
                    </tr></thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {displayCourses.map(section => {
                            const isDragging = draggingSectionId === section.sectionId;
                            const isDragOver = dragOverSectionId === section.sectionId;
                            const rowStats = getTreeStats(section);

                            return (
                                <React.Fragment key={section.sectionId}>
                                    <tr draggable="true" onDragStart={(e) => handleDragStart(e, section.sectionId)} onDragEnd={handleDragEnd} onDragOver={handleDragOver} onDragEnter={(e) => handleRowDragEnter(e, section.sectionId)} onDragLeave={handleRowDragLeave} onDrop={(e) => handleDropOnRow(e, section.sectionId)} className={`transition-all duration-150 ${isDragging ? '' : ''} ${isDragOver ? 'bg-teal-100 ring-2 ring-teal-400' : ''}`}>
                                        <td className="px-2 py-1.5 align-top font-semibold text-gray-800">{section.courseCode}</td>
                                        <td className="px-2 py-1.5 align-top text-gray-600 truncate max-w-xs" title={section.courseTitle}>{section.courseTitle}</td>
                                        <td className="px-2 py-1.5 text-center align-middle">{section.credit.toFixed(2)}</td>
                                        <td className="px-2 py-1.5 align-top font-medium">{section.section}</td>
                                        <td className="px-2 py-1.5 align-top">{getProgramShortName(section.pId)}</td>
                                        <td className="px-2 py-1.5 text-center align-middle">{rowStats.students}</td>
                                        <td className="px-2 py-1.5 text-center font-semibold text-blue-600 align-middle">{rowStats.ciw}</td>
                                        <td className="px-2 py-1.5 text-center font-semibold text-purple-600 align-middle">{rowStats.cr}</td>
                                        <td className="px-2 py-1.5 text-center font-semibold text-green-600 align-middle">{rowStats.cat}</td>
                                    </tr>
                                    {section.mergedCourses && renderMergedRows(section.mergedCourses, 1, section.sectionId)}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                    <tfoot className="bg-gray-100">
                        <tr>
                            <td colSpan={2} className="px-2 py-2 text-right font-bold text-gray-700">Total</td>
                            <td className="px-2 py-2 text-center font-bold text-gray-700">{totals.credits.toFixed(2)}</td>
                            <td colSpan={2}></td>
                            <td className="px-2 py-2 text-center font-bold text-gray-700">{totals.students}</td>
                            <td className="px-2 py-2 text-center font-bold text-blue-700">{totals.ciw}</td>
                            <td className="px-2 py-2 text-center font-bold text-purple-700">{totals.cr}</td>
                            <td className="px-2 py-2 text-center font-bold text-green-700">{totals.cat}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
};

export default UserDetailView;
