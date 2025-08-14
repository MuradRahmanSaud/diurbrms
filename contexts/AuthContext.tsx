import React, { createContext, useState, useEffect, useCallback, useContext, ReactNode, useMemo } from 'react';
import { User, UserRole, DayOfWeek, SignupData, RoomEditAccess, DashboardAccess, AssignAccessLevel, ProgramManagementAccess, NotificationAccess } from '../types';
import { useRolePermissions } from './RolePermissionContext';

// This is now just the seed data, used only if localStorage is empty.
const SEED_USERS: (User & { password_plaintext: string })[] = [
  {
    id: 'user-1', name: 'Admin User', email: 'admin@rbrms.com', role: 'admin', password_plaintext: '100001', avatar: '👑', employeeId: '100001', designation: 'System Administrator', makeupSlotBookingAccess: 'full', bulkAssignAccess: 'full',
    roomEditAccess: {
      canManageRoomManagement: true,
      canAddBuilding: true,
      canAddRoom: true,
      canDeleteRoom: true,
      canViewRoomDetail: true,
      canEditAssignToProgram: true,
      canEditShareWithPrograms: true,
      canEditDetailsTab: true,
      canEditSlotsTab: true,
      canImportRoomData: true,
      canExportRoomData: true,
    },
    dashboardAccess: {
      canViewCourseList: true,
      canViewSectionList: true,
      canViewRoomList: true,
      canViewTeacherList: true,
      canViewSlotRequirement: true,
      canAutoAssign: true,
      canManageVersions: true,
      canViewSlotUsage: true,
      canViewMakeupSchedule: true,
      canEditCourseSectionDetails: true,
      canImportCourseData: true,
      canExportCourseData: true,
      classMonitoringAccess: 'full',
      canManageProgramSetup: true,
      canManageDefaultSlots: true,
      canManageSemesterSetup: true,
      canViewSectionTable: true,
      canCustomizeTheme: true,
      canDragAndDrop: true,
      canViewSlotHistory: true,
    },
    programManagementAccess: {
        canAddProgram: true,
        canEditProgram: true,
    },
    notificationAccess: {
        canGetNotification: true,
        canApproveSlots: true,
    },
  },
  {
    id: 'user-2', name: 'Moderator User', email: 'moderator@rbrms.com', role: 'moderator', password_plaintext: '200001', avatar: '🛡️', employeeId: '200001', designation: 'Moderator', makeupSlotBookingAccess: 'full', bulkAssignAccess: 'none',
    roomEditAccess: { canManageRoomManagement: false, canAddBuilding: false, canAddRoom: false, canDeleteRoom: false, canViewRoomDetail: false, canEditAssignToProgram: false, canEditShareWithPrograms: false, canEditDetailsTab: false, canEditSlotsTab: false },
    dashboardAccess: { canViewCourseList: true, canViewSectionList: true, canViewRoomList: true, canViewTeacherList: true, canViewSlotRequirement: true, canAutoAssign: false, canManageVersions: false, canViewSlotUsage: true, canViewMakeupSchedule: true, classMonitoringAccess: 'full', canManageProgramSetup: false, canManageDefaultSlots: false, canManageSemesterSetup: false, canViewSectionTable: true, canCustomizeTheme: false, canDragAndDrop: false, canViewSlotHistory: true },
    programManagementAccess: { canAddProgram: false, canEditProgram: false },
    notificationAccess: { canGetNotification: true, canApproveSlots: false },
  },
  {
    id: 'user-3', name: 'Routine Organizer', email: 'organizer@rbrms.com', role: 'routine-organizer', password_plaintext: '300001', avatar: '📋', employeeId: '300001', designation: 'Routine Coordinator', makeupSlotBookingAccess: 'full', bulkAssignAccess: 'full',
    roomEditAccess: { canManageRoomManagement: true, canAddBuilding: true, canAddRoom: true, canDeleteRoom: true, canViewRoomDetail: true, canEditAssignToProgram: true, canEditShareWithPrograms: true, canEditDetailsTab: true, canEditSlotsTab: true, canImportRoomData: true, canExportRoomData: true },
    dashboardAccess: { canViewCourseList: true, canViewSectionList: true, canViewRoomList: true, canViewTeacherList: true, canViewSlotRequirement: true, canAutoAssign: true, canManageVersions: true, canViewSlotUsage: true, canViewMakeupSchedule: true, canEditCourseSectionDetails: true, canImportCourseData: true, canExportCourseData: true, classMonitoringAccess: 'full', canManageProgramSetup: false, canManageDefaultSlots: false, canManageSemesterSetup: false, canViewSectionTable: true, canCustomizeTheme: false, canDragAndDrop: true, canViewSlotHistory: true },
    programManagementAccess: { canAddProgram: true, canEditProgram: true },
    notificationAccess: { canGetNotification: true, canApproveSlots: true },
  },
  {
    id: 'user-4', name: 'Coordination Officer', email: 'co@rbrms.com', role: 'coordination-officer', password_plaintext: '400001', avatar: '🤝', employeeId: '400001', designation: 'Department Coordinator', makeupSlotBookingAccess: 'full', bulkAssignAccess: 'none',
    roomEditAccess: { canManageRoomManagement: false, canAddBuilding: false, canAddRoom: false, canDeleteRoom: false, canViewRoomDetail: false, canEditAssignToProgram: false, canEditShareWithPrograms: false, canEditDetailsTab: false, canEditSlotsTab: false },
    dashboardAccess: { canViewCourseList: true, canViewSectionList: true, canViewRoomList: true, canViewTeacherList: true, canViewSlotRequirement: true, canAutoAssign: false, canManageVersions: false, canViewSlotUsage: true, canViewMakeupSchedule: true, classMonitoringAccess: 'full', canManageProgramSetup: false, canManageDefaultSlots: false, canManageSemesterSetup: false, canViewSectionTable: true, canCustomizeTheme: false, canDragAndDrop: false, canViewSlotHistory: true },
    programManagementAccess: { canAddProgram: false, canEditProgram: false },
    notificationAccess: { canGetNotification: true, canApproveSlots: true },
  },
  {
    id: 'user-5', name: 'Teacher User', email: 'teacher@rbrms.com', role: 'teacher', password_plaintext: '500001', avatar: '🧑‍🏫', employeeId: '500001', designation: 'Lecturer', makeupSlotBookingAccess: 'own', bulkAssignAccess: 'none',
    roomEditAccess: { canManageRoomManagement: false, canAddBuilding: false, canAddRoom: false, canDeleteRoom: false, canViewRoomDetail: false, canEditAssignToProgram: false, canEditShareWithPrograms: false, canEditDetailsTab: false, canEditSlotsTab: false },
    dashboardAccess: { canViewCourseList: false, canViewSectionList: false, canViewRoomList: false, canViewTeacherList: true, canViewSlotRequirement: false, canAutoAssign: false, canManageVersions: false, canViewSlotUsage: false, canViewMakeupSchedule: true, classMonitoringAccess: 'own', canManageProgramSetup: false, canManageDefaultSlots: false, canManageSemesterSetup: false, canViewSectionTable: false, canCustomizeTheme: false, canDragAndDrop: false, canViewSlotHistory: true },
    programManagementAccess: { canAddProgram: false, canEditProgram: false },
    notificationAccess: { canGetNotification: false, canApproveSlots: false },
  },
  {
    id: 'user-6', name: 'Regular User', email: 'user@rbrms.com', role: 'user', password_plaintext: '600001', avatar: '👤', employeeId: '600001', designation: 'Staff', makeupSlotBookingAccess: 'none', bulkAssignAccess: 'none',
    roomEditAccess: { canManageRoomManagement: false, canAddBuilding: false, canAddRoom: false, canDeleteRoom: false, canViewRoomDetail: false, canEditAssignToProgram: false, canEditShareWithPrograms: false, canEditDetailsTab: false, canEditSlotsTab: false },
    dashboardAccess: { canViewCourseList: false, canViewSectionList: false, canViewRoomList: false, canViewTeacherList: false, canViewSlotRequirement: false, canAutoAssign: false, canManageVersions: false, canViewSlotUsage: false, canViewMakeupSchedule: false, canEditCourseSectionDetails: false, canImportCourseData: false, canExportCourseData: false, classMonitoringAccess: 'none', canManageProgramSetup: false, canManageDefaultSlots: false, canManageSemesterSetup: false, canViewSectionTable: false, canCustomizeTheme: false, canDragAndDrop: false, canViewSlotHistory: false },
    programManagementAccess: { canAddProgram: false, canEditProgram: false },
    notificationAccess: { canGetNotification: false, canApproveSlots: false },
  },
  {
    id: 'user-7', name: 'Student User', email: 'student@rbrms.com', role: 'student', password_plaintext: '700001', avatar: '🎓', employeeId: '700001', designation: 'Student', makeupSlotBookingAccess: 'none', bulkAssignAccess: 'none',
    roomEditAccess: { canManageRoomManagement: false, canAddBuilding: false, canAddRoom: false, canDeleteRoom: false, canViewRoomDetail: false, canEditAssignToProgram: false, canEditShareWithPrograms: false, canEditDetailsTab: false, canEditSlotsTab: false },
    dashboardAccess: { canViewCourseList: false, canViewSectionList: false, canViewRoomList: false, canViewTeacherList: false, canViewSlotRequirement: false, canAutoAssign: false, canManageVersions: false, canViewSlotUsage: false, canViewMakeupSchedule: false, canEditCourseSectionDetails: false, canImportCourseData: false, canExportCourseData: false, classMonitoringAccess: 'none', canManageProgramSetup: false, canManageDefaultSlots: false, canManageSemesterSetup: false, canViewSectionTable: false, canCustomizeTheme: false, canDragAndDrop: false, canViewSlotHistory: false },
    programManagementAccess: { canAddProgram: false, canEditProgram: false },
    notificationAccess: { canGetNotification: false, canApproveSlots: false },
  }
];

// A simple type for the sync function argument
interface TeacherInfo {
    employeeId: string;
    teacherName: string;
    email: string;
    designation: string;
}

interface AuthContextType {
  user: User | null;
  users: User[]; // All mock users for management panel
  loading: boolean;
  login: (email: string, password_plaintext: string) => Promise<void>;
  signup: (data: SignupData, autoLogin?: boolean) => Promise<void>;
  logout: () => void;
  updateUser: (updatedUserData: User) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  syncTeachersAsUsers: (teachers: TeacherInfo[]) => void;
  changePassword: (userId: string, current: string, newPass: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const RBRMS_AUTH_USER_KEY = 'rbrms-auth-user';
const RBRMS_MOCK_USERS_KEY = 'rbrms-mock-users'; // Key to persist all users

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  // The single source of truth for all users, including passwords. Persisted to localStorage.
  const [allUsersWithPasswords, setAllUsersWithPasswords] = useState<(User & { password_plaintext: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const { getPermissionsForRole } = useRolePermissions();

  const defaultRoomEditAccess: RoomEditAccess = {
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
    canViewSlotHistory: false,
  };
  const defaultProgramManagementAccess: ProgramManagementAccess = {
    canAddProgram: false,
    canEditProgram: false,
  };
  const defaultNotificationAccess: NotificationAccess = {
    canGetNotification: false,
    canApproveSlots: false,
  };

  // Initial load from localStorage
  useEffect(() => {
    try {
      // Always start with no user logged in to force login screen.
      localStorage.removeItem(RBRMS_AUTH_USER_KEY);
      setUser(null);

      // Load the list of all users, including any created during signup
      const savedAllUsersJson = localStorage.getItem(RBRMS_MOCK_USERS_KEY);

      if (savedAllUsersJson) {
        const parsedUsers = JSON.parse(savedAllUsersJson);
         // Ensure all users from storage have the new property, default to false if missing
        const usersWithDefaults = parsedUsers.map((u: any) => {
          const migratedUser = { ...u };
          // Migrate single dayOff to array dayOffs
          if (migratedUser.dayOff && !migratedUser.dayOffs) {
            migratedUser.dayOffs = [migratedUser.dayOff];
          }
          delete migratedUser.dayOff;

          // New migration from boolean to enum for scheduling permissions
          if ('canBookMakeupSlots' in migratedUser) {
              if (migratedUser.canBookMakeupSlots) {
                  const privilegedRoles: UserRole[] = ['admin', 'moderator', 'routine-organizer', 'coordination-officer'];
                  migratedUser.makeupSlotBookingAccess = (migratedUser.role === 'teacher') ? 'own' : (privilegedRoles.includes(migratedUser.role) ? 'full' : 'none');
              } else {
                  migratedUser.makeupSlotBookingAccess = 'none';
              }
              delete migratedUser.canBookMakeupSlots;
          }
          
          if ('canBulkAssign' in migratedUser) {
              if (migratedUser.canBulkAssign) {
                  const privilegedRoles: UserRole[] = ['admin', 'routine-organizer'];
                  migratedUser.bulkAssignAccess = (migratedUser.role === 'teacher') ? 'own' : (privilegedRoles.includes(migratedUser.role) ? 'full' : 'none');
              } else {
                  migratedUser.bulkAssignAccess = 'none';
              }
              delete migratedUser.canBulkAssign;
          }
          
          const existingRoomAccess = migratedUser.roomEditAccess || {};
          const migratedRoomAccess = {
              ...defaultRoomEditAccess,
              ...existingRoomAccess,
              canViewRoomDetail: existingRoomAccess.canViewRoomDetail ?? (
                  existingRoomAccess.canEditAssignToProgram || 
                  existingRoomAccess.canEditShareWithPrograms || 
                  existingRoomAccess.canEditDetailsTab || 
                  existingRoomAccess.canEditSlotsTab || 
                  false
              ),
          };
          
          const existingDashboardAccess = migratedUser.dashboardAccess || {};
          const migratedDashboardAccess = { ...defaultDashboardAccess, ...existingDashboardAccess };

          // New migration: logAttendanceAccess -> classMonitoringAccess
          if ('logAttendanceAccess' in migratedDashboardAccess) {
            migratedDashboardAccess.classMonitoringAccess = (migratedDashboardAccess as any).logAttendanceAccess;
            delete (migratedDashboardAccess as any).logAttendanceAccess;
          }
          
          // Old migration for backwards compatibility
          if ('canLogAttendance' in existingDashboardAccess) {
              migratedDashboardAccess.classMonitoringAccess = existingDashboardAccess.canLogAttendance ? 'full' : 'none';
              if(migratedUser.role === 'teacher' && existingDashboardAccess.canLogAttendance) {
                  migratedDashboardAccess.classMonitoringAccess = 'own';
              }
              delete (migratedDashboardAccess as any).canLogAttendance;
          }

          const finalUser = {
            ...migratedUser,
            makeupSlotBookingAccess: migratedUser.makeupSlotBookingAccess ?? 'none',
            bulkAssignAccess: migratedUser.bulkAssignAccess ?? 'none',
            accessibleProgramPIds: migratedUser.accessibleProgramPIds ?? [],
            roomEditAccess: migratedRoomAccess,
            dashboardAccess: migratedDashboardAccess,
            programManagementAccess: migratedUser.programManagementAccess ? { ...defaultProgramManagementAccess, ...migratedUser.programManagementAccess } : defaultProgramManagementAccess,
            notificationAccess: migratedUser.notificationAccess ? { ...defaultNotificationAccess, ...migratedUser.notificationAccess } : defaultNotificationAccess,
          };

          // Migrate canManageCourseData
          if (finalUser.dashboardAccess && 'canManageCourseData' in finalUser.dashboardAccess) {
              const canManage = (finalUser.dashboardAccess as any).canManageCourseData;
              finalUser.dashboardAccess.canEditCourseSectionDetails = canManage;
              finalUser.dashboardAccess.canImportCourseData = canManage;
              finalUser.dashboardAccess.canExportCourseData = canManage;
              delete (finalUser.dashboardAccess as any).canManageCourseData;
          }

          // FIX: If the user is an admin, override their permissions with the correct full permissions from the seed data.
          // This prevents issues with outdated admin accounts in localStorage.
          if (finalUser.role === 'admin') {
            const adminSeed = SEED_USERS.find(seed => seed.role === 'admin');
            if (adminSeed) {
                finalUser.roomEditAccess = adminSeed.roomEditAccess;
                finalUser.dashboardAccess = adminSeed.dashboardAccess;
                finalUser.makeupSlotBookingAccess = adminSeed.makeupSlotBookingAccess;
                finalUser.bulkAssignAccess = adminSeed.bulkAssignAccess;
                finalUser.programManagementAccess = adminSeed.programManagementAccess;
                finalUser.notificationAccess = adminSeed.notificationAccess;
            }
          }

          return finalUser;
        });
        setAllUsersWithPasswords(usersWithDefaults);
      } else {
        // If nothing in storage, seed the data
        setAllUsersWithPasswords(SEED_USERS);
      }
    } catch (e) {
      console.error("Failed to load auth data from localStorage", e);
      setUser(null);
      setAllUsersWithPasswords(SEED_USERS); // Fallback to seed
    } finally {
      setLoading(false);
    }
  }, []);

  // Persist the full user list whenever it changes
  useEffect(() => {
    if (!loading) {
      try {
        localStorage.setItem(RBRMS_MOCK_USERS_KEY, JSON.stringify(allUsersWithPasswords));
      } catch (e) {
        console.error("Failed to save user list to localStorage:", e);
        alert("Could not save user list. Your browser storage might be full.");
      }
    }
  }, [allUsersWithPasswords, loading]);

  // The public `users` array, without passwords
  const users = useMemo(() => allUsersWithPasswords.map(({ password_plaintext, ...rest }) => rest), [allUsersWithPasswords]);

  const login = useCallback(async (email: string, password_plaintext: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      setTimeout(() => { // Simulate network delay
        const foundUser = allUsersWithPasswords.find(
          u => u.email.toLowerCase() === email.toLowerCase() && u.password_plaintext === password_plaintext
        );

        if (foundUser) {
          const { password_plaintext: _, ...userToSave } = foundUser;
          setUser(userToSave);
          try {
            localStorage.setItem(RBRMS_AUTH_USER_KEY, JSON.stringify(userToSave));
          } catch(e) {
            // Non-critical error, login succeeded but session might not persist across reloads.
            console.error("Failed to persist user session to localStorage:", e);
          }
          resolve();
        } else {
          reject(new Error("Invalid email or password."));
        }
      }, 500);
    });
  }, [allUsersWithPasswords]);
  
  const signup = useCallback(async (data: SignupData, autoLogin: boolean = true): Promise<void> => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (allUsersWithPasswords.some(u => u.email.toLowerCase() === data.email.toLowerCase())) {
          reject(new Error("An account with this email already exists."));
          return;
        }
        if (data.employeeId && data.employeeId.trim() && allUsersWithPasswords.some(u => u.employeeId === data.employeeId)) {
          reject(new Error("An account with this Employee ID already exists."));
          return;
        }

        const newUser: User & { password_plaintext: string } = {
          id: `user-${Date.now()}`,
          name: data.name,
          email: data.email,
          password_plaintext: data.password_plaintext,
          role: data.role || 'user', // Default to 'user'
          avatar: data.avatar || '👤',
          employeeId: data.employeeId,
          designation: data.designation,
          makeupSlotBookingAccess: data.makeupSlotBookingAccess || 'none',
          bulkAssignAccess: data.bulkAssignAccess || 'none',
          dayOffs: [],
          accessibleProgramPIds: data.accessibleProgramPIds || [],
          roomEditAccess: data.roomEditAccess || defaultRoomEditAccess,
          dashboardAccess: data.dashboardAccess || defaultDashboardAccess,
          programManagementAccess: data.programManagementAccess || defaultProgramManagementAccess,
          notificationAccess: data.notificationAccess || defaultNotificationAccess,
        };

        setAllUsersWithPasswords(prev => [...prev, newUser]);
        
        if (autoLogin) {
          const { password_plaintext: _, ...userToSave } = newUser;
          setUser(userToSave);
          try {
            localStorage.setItem(RBRMS_AUTH_USER_KEY, JSON.stringify(userToSave));
          } catch (e) {
             // Non-critical error
            console.error("Failed to persist user session after signup:", e);
          }
        }
        resolve();
      }, 500);
    });
  }, [allUsersWithPasswords, defaultDashboardAccess, defaultNotificationAccess, defaultProgramManagementAccess, defaultRoomEditAccess]);
  
  const updateUser = useCallback(async (updatedUserData: User): Promise<void> => {
    return new Promise((resolve) => {
        setAllUsersWithPasswords(prev =>
            prev.map(u => {
                if (u.id === updatedUserData.id) {
                    const originalPassword = prev.find(p => p.id === updatedUserData.id)?.password_plaintext || '';
                    return { ...updatedUserData, password_plaintext: originalPassword };
                }
                return u;
            })
        );
        if (user?.id === updatedUserData.id) {
            setUser(updatedUserData);
            try {
              localStorage.setItem(RBRMS_AUTH_USER_KEY, JSON.stringify(updatedUserData));
            } catch (e) {
              console.error("Failed to update user session in storage:", e);
            }
        }
        resolve();
    });
  }, [user]);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(RBRMS_AUTH_USER_KEY);
  }, []);
  
  const deleteUser = useCallback(async (userId: string): Promise<void> => {
      return new Promise((resolve) => {
        setAllUsersWithPasswords(prev => prev.filter(u => u.id !== userId));
        resolve();
      });
  }, []);

  const syncTeachersAsUsers = useCallback((teachers: TeacherInfo[]) => {
      const teacherPermissionsTemplate = getPermissionsForRole('teacher');
      if (!teacherPermissionsTemplate) {
          console.error("Could not sync teachers: 'teacher' role permissions template not found.");
          return;
      }

      setAllUsersWithPasswords(prevUsers => {
          const newUsersToAdd: (User & { password_plaintext: string })[] = [];
          const existingEmployeeIds = new Set(prevUsers.map(u => u.employeeId).filter(Boolean));

          teachers.forEach(teacher => {
              if (teacher.employeeId && !existingEmployeeIds.has(teacher.employeeId)) {
                  const newUser: User & { password_plaintext: string } = {
                      id: `user-T-${teacher.employeeId}`,
                      name: teacher.teacherName,
                      email: teacher.email,
                      password_plaintext: teacher.employeeId,
                      avatar: '🧑‍🏫',
                      employeeId: teacher.employeeId,
                      designation: teacher.designation,
                      dayOffs: [],
                      accessibleProgramPIds: [],
                      ...teacherPermissionsTemplate,
                  };
                  newUsersToAdd.push(newUser);
                  existingEmployeeIds.add(teacher.employeeId);
              }
          });

          if (newUsersToAdd.length > 0) {
              return [...prevUsers, ...newUsersToAdd];
          }
          return prevUsers;
      });
  }, [getPermissionsForRole]);

  const changePassword = useCallback(async (userId: string, currentPassword_plaintext: string, newPassword_plaintext: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => { // Simulate network delay
            const userIndex = allUsersWithPasswords.findIndex(u => u.id === userId);
            if (userIndex === -1) {
                reject(new Error("User not found. This should not happen."));
                return;
            }
            const userToUpdate = allUsersWithPasswords[userIndex];
            if (userToUpdate.password_plaintext !== currentPassword_plaintext) {
                reject(new Error("Incorrect current password."));
                return;
            }
            if (!newPassword_plaintext || newPassword_plaintext.length < 1) {
                reject(new Error("New password cannot be empty."));
                return;
            }

            const updatedUser = { ...userToUpdate, password_plaintext: newPassword_plaintext };
            const newAllUsers = [...allUsersWithPasswords];
            newAllUsers[userIndex] = updatedUser;
            setAllUsersWithPasswords(newAllUsers);
            resolve();
        }, 500);
    });
  }, [allUsersWithPasswords]);

  return (
    <AuthContext.Provider value={{ user, users, loading, login, signup, logout, updateUser, deleteUser, syncTeachersAsUsers, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};