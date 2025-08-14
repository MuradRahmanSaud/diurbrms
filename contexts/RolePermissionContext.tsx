import React, { createContext, useState, useEffect, useCallback, useContext, ReactNode } from 'react';
import { User, UserRole } from '../types';

// This type defines the structure for storing permissions for all roles.
// It's a record where keys are UserRole strings, and values are partial User objects
// containing only the permission-related fields.
export type RolePermissions = Record<UserRole, Omit<User, 'id' | 'email' | 'name' | 'avatar' | 'employeeId' | 'designation' | 'dayOffs' | 'accessibleProgramPIds'>>;

// Define the default permission templates for each role.
// This is the single source of truth for initial setup.
const DEFAULT_ROLE_PERMISSIONS: RolePermissions = {
    admin: {
        role: 'admin', makeupSlotBookingAccess: 'full', bulkAssignAccess: 'full',
        roomEditAccess: { canManageRoomManagement: true, canAddBuilding: true, canAddRoom: true, canDeleteRoom: true, canViewRoomDetail: true, canEditAssignToProgram: true, canEditShareWithPrograms: true, canEditDetailsTab: true, canEditSlotsTab: true, canImportRoomData: true, canExportRoomData: true },
        dashboardAccess: { canViewCourseList: true, canViewSectionList: true, canViewRoomList: true, canViewTeacherList: true, canViewSlotRequirement: true, canAutoAssign: true, canManageVersions: true, canViewSlotUsage: true, canViewMakeupSchedule: true, canEditCourseSectionDetails: true, canImportCourseData: true, canExportCourseData: true, classMonitoringAccess: 'full', canManageProgramSetup: true, canManageDefaultSlots: true, canManageSemesterSetup: true, canViewSectionTable: true, canCustomizeTheme: true, canDragAndDrop: true, canViewSlotHistory: true },
        programManagementAccess: { canAddProgram: true, canEditProgram: true },
        notificationAccess: { canGetNotification: true, canApproveSlots: true },
    },
    moderator: {
        role: 'moderator', makeupSlotBookingAccess: 'full', bulkAssignAccess: 'none',
        roomEditAccess: { canManageRoomManagement: false, canAddBuilding: false, canAddRoom: false, canDeleteRoom: false, canViewRoomDetail: true, canEditAssignToProgram: false, canEditShareWithPrograms: false, canEditDetailsTab: false, canEditSlotsTab: false },
        dashboardAccess: { canViewCourseList: true, canViewSectionList: true, canViewRoomList: true, canViewTeacherList: true, canViewSlotRequirement: true, canAutoAssign: false, canManageVersions: false, canViewSlotUsage: true, canViewMakeupSchedule: true, classMonitoringAccess: 'full', canManageProgramSetup: false, canManageDefaultSlots: false, canManageSemesterSetup: false, canViewSectionTable: true, canCustomizeTheme: false, canDragAndDrop: false, canViewSlotHistory: true },
        programManagementAccess: { canAddProgram: false, canEditProgram: false },
        notificationAccess: { canGetNotification: true, canApproveSlots: false },
    },
    'routine-organizer': {
        role: 'routine-organizer', makeupSlotBookingAccess: 'full', bulkAssignAccess: 'full',
        roomEditAccess: { canManageRoomManagement: true, canAddBuilding: true, canAddRoom: true, canDeleteRoom: true, canViewRoomDetail: true, canEditAssignToProgram: true, canEditShareWithPrograms: true, canEditDetailsTab: true, canEditSlotsTab: true, canImportRoomData: true, canExportRoomData: true },
        dashboardAccess: { canViewCourseList: true, canViewSectionList: true, canViewRoomList: true, canViewTeacherList: true, canViewSlotRequirement: true, canAutoAssign: true, canManageVersions: true, canViewSlotUsage: true, canViewMakeupSchedule: true, canEditCourseSectionDetails: true, canImportCourseData: true, canExportCourseData: true, classMonitoringAccess: 'full', canManageProgramSetup: true, canManageDefaultSlots: true, canManageSemesterSetup: true, canViewSectionTable: true, canCustomizeTheme: false, canDragAndDrop: true, canViewSlotHistory: true },
        programManagementAccess: { canAddProgram: true, canEditProgram: true },
        notificationAccess: { canGetNotification: true, canApproveSlots: true },
    },
    'coordination-officer': {
        role: 'coordination-officer', makeupSlotBookingAccess: 'full', bulkAssignAccess: 'none',
        roomEditAccess: { canManageRoomManagement: false, canAddBuilding: false, canAddRoom: false, canDeleteRoom: false, canViewRoomDetail: true, canEditAssignToProgram: false, canEditShareWithPrograms: false, canEditDetailsTab: false, canEditSlotsTab: false },
        dashboardAccess: { canViewCourseList: true, canViewSectionList: true, canViewRoomList: true, canViewTeacherList: true, canViewSlotRequirement: true, canAutoAssign: false, canManageVersions: false, canViewSlotUsage: true, canViewMakeupSchedule: true, classMonitoringAccess: 'full', canManageProgramSetup: false, canManageDefaultSlots: false, canManageSemesterSetup: false, canViewSectionTable: true, canCustomizeTheme: false, canDragAndDrop: false, canViewSlotHistory: true },
        programManagementAccess: { canAddProgram: false, canEditProgram: false },
        notificationAccess: { canGetNotification: true, canApproveSlots: true },
    },
    teacher: {
        role: 'teacher', makeupSlotBookingAccess: 'own', bulkAssignAccess: 'none',
        roomEditAccess: { canManageRoomManagement: false, canAddBuilding: false, canAddRoom: false, canDeleteRoom: false, canViewRoomDetail: true, canEditAssignToProgram: false, canEditShareWithPrograms: false, canEditDetailsTab: false, canEditSlotsTab: false },
        dashboardAccess: { canViewCourseList: false, canViewSectionList: false, canViewRoomList: false, canViewTeacherList: true, canViewSlotRequirement: false, canAutoAssign: false, canManageVersions: false, canViewSlotUsage: false, canViewMakeupSchedule: true, classMonitoringAccess: 'own', canManageProgramSetup: false, canManageDefaultSlots: false, canManageSemesterSetup: false, canViewSectionTable: false, canCustomizeTheme: false, canDragAndDrop: false, canViewSlotHistory: true },
        programManagementAccess: { canAddProgram: false, canEditProgram: false },
        notificationAccess: { canGetNotification: true, canApproveSlots: false },
    },
    user: {
        role: 'user', makeupSlotBookingAccess: 'none', bulkAssignAccess: 'none',
        roomEditAccess: { canManageRoomManagement: false, canAddBuilding: false, canAddRoom: false, canDeleteRoom: false, canViewRoomDetail: false, canEditAssignToProgram: false, canEditShareWithPrograms: false, canEditDetailsTab: false, canEditSlotsTab: false },
        dashboardAccess: { canViewCourseList: false, canViewSectionList: false, canViewRoomList: false, canViewTeacherList: false, canViewSlotRequirement: false, canAutoAssign: false, canManageVersions: false, canViewSlotUsage: false, canViewMakeupSchedule: false, canEditCourseSectionDetails: false, canImportCourseData: false, canExportCourseData: false, classMonitoringAccess: 'none', canManageProgramSetup: false, canManageDefaultSlots: false, canManageSemesterSetup: false, canViewSectionTable: false, canCustomizeTheme: false, canDragAndDrop: false, canViewSlotHistory: false },
        programManagementAccess: { canAddProgram: false, canEditProgram: false },
        notificationAccess: { canGetNotification: false, canApproveSlots: false },
    },
    student: {
        role: 'student', makeupSlotBookingAccess: 'none', bulkAssignAccess: 'none',
        roomEditAccess: { canManageRoomManagement: false, canAddBuilding: false, canAddRoom: false, canDeleteRoom: false, canViewRoomDetail: false, canEditAssignToProgram: false, canEditShareWithPrograms: false, canEditDetailsTab: false, canEditSlotsTab: false },
        dashboardAccess: { canViewCourseList: false, canViewSectionList: false, canViewRoomList: false, canViewTeacherList: false, canViewSlotRequirement: false, canAutoAssign: false, canManageVersions: false, canViewSlotUsage: false, canViewMakeupSchedule: false, canEditCourseSectionDetails: false, canImportCourseData: false, canExportCourseData: false, classMonitoringAccess: 'none', canManageProgramSetup: false, canManageDefaultSlots: false, canManageSemesterSetup: false, canViewSectionTable: false, canCustomizeTheme: false, canDragAndDrop: false, canViewSlotHistory: false },
        programManagementAccess: { canAddProgram: false, canEditProgram: false },
        notificationAccess: { canGetNotification: false, canApproveSlots: false },
    },
};

const INITIAL_USER_ROLES: UserRole[] = ['user', 'teacher', 'student', 'routine-organizer', 'moderator', 'coordination-officer', 'admin'];
const INITIAL_ROLE_DISPLAY_NAMES: Record<string, string> = {
  user: 'User',
  teacher: 'Teacher',
  student: 'Student',
  'routine-organizer': 'Routine Organizer',
  moderator: 'Moderator',
  'coordination-officer': 'Coordination Officer',
  admin: 'Admin',
};

interface RolePermissionContextType {
  rolePermissions: RolePermissions;
  userRoles: UserRole[];
  roleDisplayNames: Record<string, string>;
  getPermissionsForRole: (role: UserRole) => Omit<User, 'id' | 'email' | 'name' | 'avatar' | 'employeeId' | 'designation' | 'dayOffs' | 'accessibleProgramPIds'> | undefined;
  updatePermissionsForRole: (role: UserRole, permissions: Omit<User, 'id' | 'email' | 'name' | 'avatar' | 'employeeId' | 'designation' | 'dayOffs' | 'accessibleProgramPIds'>) => void;
  addRole: (displayName: string) => void;
}

const RolePermissionContext = createContext<RolePermissionContextType | undefined>(undefined);

export const RBRMS_ROLE_PERMISSIONS_KEY = 'rbrms-role-permissions';
export const RBRMS_CUSTOM_ROLES_KEY = 'rbrms-custom-roles';

export const RolePermissionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [rolePermissions, setRolePermissions] = useState<RolePermissions>(DEFAULT_ROLE_PERMISSIONS);
  const [userRoles, setUserRoles] = useState<UserRole[]>(INITIAL_USER_ROLES);
  const [roleDisplayNames, setRoleDisplayNames] = useState<Record<string, string>>(INITIAL_ROLE_DISPLAY_NAMES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const savedCustomRolesJson = localStorage.getItem(RBRMS_CUSTOM_ROLES_KEY);
      const newRoles = [...INITIAL_USER_ROLES];
      const newDisplayNames = { ...INITIAL_ROLE_DISPLAY_NAMES };
      if (savedCustomRolesJson) {
          const savedCustomRoles = JSON.parse(savedCustomRolesJson);
          if (Array.isArray(savedCustomRoles)) {
            savedCustomRoles.forEach((role: { key: string, displayName: string }) => {
                if (!newRoles.includes(role.key)) {
                    newRoles.push(role.key);
                    newDisplayNames[role.key] = role.displayName;
                }
            });
          }
      }
      setUserRoles(newRoles);
      setRoleDisplayNames(newDisplayNames);

      const savedPermissionsJson = localStorage.getItem(RBRMS_ROLE_PERMISSIONS_KEY);
      if (savedPermissionsJson) {
        const savedPermissions = JSON.parse(savedPermissionsJson);
        const mergedPermissions = { ...DEFAULT_ROLE_PERMISSIONS };
        for (const role in savedPermissions) {
          if (Object.prototype.hasOwnProperty.call(savedPermissions, role)) {
            mergedPermissions[role] = {
              ...(mergedPermissions[role] || DEFAULT_ROLE_PERMISSIONS.user),
              ...savedPermissions[role],
            };
          }
        }
        setRolePermissions(mergedPermissions);
      } else {
        setRolePermissions(DEFAULT_ROLE_PERMISSIONS);
      }
    } catch (e) {
      console.error("Failed to load role permissions from localStorage", e);
      setRolePermissions(DEFAULT_ROLE_PERMISSIONS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loading) {
      try {
        localStorage.setItem(RBRMS_ROLE_PERMISSIONS_KEY, JSON.stringify(rolePermissions));
        
        const customRoles = userRoles
          .filter(role => !INITIAL_USER_ROLES.includes(role))
          .map(role => ({ key: role, displayName: roleDisplayNames[role] }));
        localStorage.setItem(RBRMS_CUSTOM_ROLES_KEY, JSON.stringify(customRoles));

      } catch (e) {
        console.error("Failed to save role permissions:", e);
      }
    }
  }, [rolePermissions, userRoles, roleDisplayNames, loading]);
  
  const addRole = useCallback((displayName: string) => {
    const roleKey = displayName.trim().toLowerCase().replace(/\s+/g, '-');
    if (!roleKey) {
        throw new Error("Role name cannot be empty.");
    }
    if (userRoles.includes(roleKey)) {
        throw new Error(`A role with the key "${roleKey}" already exists.`);
    }

    setUserRoles(prev => [...prev, roleKey]);
    setRoleDisplayNames(prev => ({ ...prev, [roleKey]: displayName.trim() }));
    setRolePermissions(prev => ({
        ...prev,
        [roleKey]: {
            ...DEFAULT_ROLE_PERMISSIONS.user,
            role: roleKey,
        }
    }));
  }, [userRoles]);

  const getPermissionsForRole = useCallback((role: UserRole) => {
    return rolePermissions[role];
  }, [rolePermissions]);

  const updatePermissionsForRole = useCallback((
    role: UserRole, 
    permissions: Omit<User, 'id' | 'email' | 'name' | 'avatar' | 'employeeId' | 'designation' | 'dayOffs' | 'accessibleProgramPIds'>
  ) => {
    if (role === 'admin') {
        console.warn("Admin permissions cannot be changed.");
        return;
    }
    setRolePermissions(prev => ({
        ...prev,
        [role]: permissions,
    }));
  }, []);

  return (
    <RolePermissionContext.Provider value={{ rolePermissions, userRoles, roleDisplayNames, getPermissionsForRole, updatePermissionsForRole, addRole }}>
      {!loading && children}
    </RolePermissionContext.Provider>
  );
};

export const useRolePermissions = (): RolePermissionContextType => {
  const context = useContext(RolePermissionContext);
  if (context === undefined) {
    throw new Error('useRolePermissions must be used within a RolePermissionProvider');
  }
  return context;
};