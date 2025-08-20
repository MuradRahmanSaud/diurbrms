/**
 * @file This file acts as the single source of truth for all API calls.
 * It provides a layer of abstraction between the application's components/contexts
 * and the actual data fetching logic.
 *
 * For now, it returns empty data or throws errors to simulate a disconnected
 * backend, making the app fully API-dependent.
 *
 * The backend team should implement the endpoints corresponding to these functions.
 * Once the backend is ready, these functions should be updated to make real `fetch`
 * calls to the API endpoints.
 */

import {
  User,
  SignupData,
  ProgramEntry,
  BuildingEntry,
  FloorEntry,
  RoomCategoryEntry,
  RoomTypeEntry,
  RoomEntry,
  EnrollmentEntry,
  DefaultTimeSlot,
  SemesterCloneInfo,
  FullRoutineData,
  ScheduleOverrides,
  ScheduleLogEntry,
  AttendanceLogEntry,
  PendingChange,
  Notification,
  SemesterRoutineData,
  RolePermissions,
} from '../types';

// --- Placeholder Data & Mocks (Remove when connecting to a real backend) ---
// We return empty arrays to simulate an initial state before the database is populated.
const MOCK_DB = {
  users: [],
  programs: [],
  buildings: [],
  floors: [],
  roomCategories: [],
  roomTypes: [],
  rooms: [],
  enrollments: [],
  defaultSlots: [],
  semesterConfigs: [],
  routines: {},
  overrides: {},
  history: [],
  attendance: [],
  pendingChanges: [],
  notifications: [],
  rolePermissions: {},
};


// --- API Service Functions ---

export const api = {
  // --- Auth & Users ---
  async login(email: string, password_plaintext: string): Promise<User> {
    console.log('[API Mock] Attempting login for:', email);
    // In a real app, this would be:
    // const response = await fetch('/api/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    // if (!response.ok) throw new Error('Login failed');
    // return response.json();
    throw new Error("API not connected. Login functionality is disabled.");
  },

  async fetchAllUsers(): Promise<(User & { password_plaintext: string })[]> {
    console.log('[API Mock] Fetching all users...');
    return MOCK_DB.users;
  },

  async signup(data: SignupData): Promise<User> {
    console.log('[API Mock] Signing up user:', data.email);
    throw new Error("API not connected. Signup functionality is disabled.");
  },

  async updateUser(updatedUserData: User): Promise<User> {
     console.log('[API Mock] Updating user:', updatedUserData.id);
    throw new Error("API not connected. User updates are disabled.");
  },
  
  async deleteUser(userId: string): Promise<void> {
    console.log('[API Mock] Deleting user:', userId);
    throw new Error("API not connected. User deletion is disabled.");
  },
  
  async changePassword(userId: string, current: string, newPass: string): Promise<void> {
    console.log('[API Mock] Changing password for user:', userId);
    throw new Error("API not connected. Password changes are disabled.");
  },
  
  // --- Role Permissions ---
  async fetchRolePermissions(): Promise<RolePermissions> {
    console.log('[API Mock] Fetching role permissions...');
    return MOCK_DB.rolePermissions;
  },
  
  async updateRolePermissions(permissions: RolePermissions): Promise<void> {
     console.log('[API Mock] Updating role permissions...');
     throw new Error("API not connected. Role permission updates are disabled.");
  },

  // --- Core Data Fetching ---
  async fetchPrograms(): Promise<ProgramEntry[]> {
    console.log('[API Mock] Fetching programs...');
    return MOCK_DB.programs;
  },
  
  async fetchBuildings(): Promise<BuildingEntry[]> {
    console.log('[API Mock] Fetching buildings...');
    return MOCK_DB.buildings;
  },

  async fetchFloors(): Promise<FloorEntry[]> {
    console.log('[API Mock] Fetching floors...');
    return MOCK_DB.floors;
  },
  
  async fetchRoomCategories(): Promise<RoomCategoryEntry[]> {
     console.log('[API Mock] Fetching room categories...');
    return MOCK_DB.roomCategories;
  },
  
  async fetchRoomTypes(): Promise<RoomTypeEntry[]> {
    console.log('[API Mock] Fetching room types...');
    return MOCK_DB.roomTypes;
  },
  
  async fetchRooms(): Promise<RoomEntry[]> {
    console.log('[API Mock] Fetching rooms...');
    return MOCK_DB.rooms;
  },

  async fetchEnrollments(): Promise<EnrollmentEntry[]> {
    console.log('[API Mock] Fetching enrollments...');
    return MOCK_DB.enrollments;
  },

  async fetchDefaultSlots(): Promise<DefaultTimeSlot[]> {
    console.log('[API Mock] Fetching default slots...');
    return MOCK_DB.defaultSlots;
  },

  async fetchSemesterConfigs(): Promise<SemesterCloneInfo[]> {
    console.log('[API Mock] Fetching semester configurations...');
    return MOCK_DB.semesterConfigs;
  },
  
  async fetchRoutines(): Promise<{ [semesterId: string]: SemesterRoutineData }> {
    console.log('[API Mock] Fetching all routines...');
    return MOCK_DB.routines;
  },
  
  async fetchOverrides(): Promise<ScheduleOverrides> {
    console.log('[API Mock] Fetching schedule overrides...');
    return MOCK_DB.overrides;
  },

  async fetchHistory(): Promise<ScheduleLogEntry[]> {
    console.log('[API Mock] Fetching schedule history...');
    return MOCK_DB.history;
  },

  async fetchAttendance(): Promise<AttendanceLogEntry[]> {
    console.log('[API Mock] Fetching attendance log...');
    return MOCK_DB.attendance;
  },

  async fetchPendingChanges(): Promise<PendingChange[]> {
    console.log('[API Mock] Fetching pending changes...');
    return MOCK_DB.pendingChanges;
  },

  async fetchNotifications(): Promise<Notification[]> {
    console.log('[API Mock] Fetching notifications...');
    return MOCK_DB.notifications;
  },

  /**
   * It's often more efficient to fetch all initial data in one go.
   * The backend should provide an endpoint that bundles this data.
   */
  async fetchInitialData() {
    console.log('[API Mock] Fetching all initial application data...');
    // In a real app, this would be a single API call:
    // const response = await fetch('/api/initial-data');
    // return response.json();
    
    // For the mock, we call individual functions.
    return Promise.all([
      this.fetchPrograms(),
      this.fetchBuildings(),
      this.fetchFloors(),
      this.fetchRoomCategories(),
      this.fetchRoomTypes(),
      this.fetchRooms(),
      this.fetchEnrollments(),
      this.fetchDefaultSlots(),
      this.fetchSemesterConfigs(),
      this.fetchRoutines(),
      this.fetchOverrides(),
      this.fetchHistory(),
      this.fetchAttendance(),
      this.fetchPendingChanges(),
      this.fetchNotifications(),
      this.fetchAllUsers(),
      this.fetchRolePermissions(),
    ]).then(([
      programs, buildings, floors, roomCategories, roomTypes, rooms, 
      enrollments, defaultSlots, semesterConfigs, routines, overrides, 
      history, attendance, pendingChanges, notifications, users, rolePermissions
    ]) => ({
      programs, buildings, floors, roomCategories, roomTypes, rooms, 
      coursesData: enrollments, 
      systemDefaultTimeSlots: defaultSlots,
      allSemesterConfigurations: semesterConfigs,
      routineData: routines,
      scheduleOverrides: overrides,
      scheduleHistory: history,
      attendanceLog: attendance,
      pendingChanges,
      notifications,
      users,
      rolePermissions
    }));
  },

  // --- Data Mutation Functions ---
  // These would call POST, PUT, DELETE endpoints in a real app.
  // For the mock, they just log and throw an error.
  
  async saveAllData(data: any): Promise<void> {
    console.log('[API Mock] Saving all data to backend...', data);
    throw new Error("API not connected. Data saving is disabled.");
  }
};
