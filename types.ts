
export type TimeSlot =
  | '08:30 AM - 10:00 AM'
  | '10:00 AM - 11:30 AM'
  | '11:30 AM - 01:00 PM'
  | '01:00 PM - 02:30 PM'
  | '02:30 PM - 04:00 PM'
  | '04:00 PM - 05:30 PM';

export type DayOfWeek =
  | 'Saturday'
  | 'Sunday'
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday';

export interface ClassDetail {
  courseCode: string;
  courseName: string;
  teacher: string;
  section: string;
  color?: string; // e.g., 'bg-blue-200'
  pId?: string;
  classTaken?: number;
  levelTerm?: string;
}

export interface RoutineEntry {
  room: string;
  timeSlot: TimeSlot;
  day: DayOfWeek;
  classInfo?: ClassDetail;
}

export type DailyRoutineData = {
  // Key is room number (string)
  [room: string]: {
    // Key is TimeSlot
    [slot in TimeSlot]?: ClassDetail;
  };
};

export type FullRoutineData = {
  // Key is DayOfWeek
  [day in DayOfWeek]?: DailyRoutineData;
};

export type ScheduleOverrides = {
  // Key is room number
  [roomNumber: string]: {
    // Key is Slot String e.g., "08:30 AM - 10:00 AM"
    [slotString: string]: {
      // Key is Date ISO String e.g., "2025-07-26"
      [dateISO: string]: ClassDetail | null; // null means it's explicitly set to be free
    };
  };
};

// Updated type for schedule change history to support default routine changes
export interface ScheduleLogEntry {
  logId: string;
  timestamp: string; // ISO string of when the log was created
  userId: string;
  userName: string;
  userAvatar?: string;
  
  // Context of the change
  roomNumber: string;
  slotString: string;
  semesterId: string;
  day: DayOfWeek; // Day of the week this change applies to

  // Type of change
  isOverride: boolean; // true for specific date overrides, false for default routine changes
  dateISO?: string;    // The specific date for an override change

  // The actual change
  from: ClassDetail | null;
  to: ClassDetail | null;
}


export type AttendanceStatus =
  | 'Class is going'
  | 'Student and Teacher both are absent'
  | 'Students present but teacher absent'
  | 'Teacher present but students are absent';

// New type for Makeup Class Details
export interface MakeupClassDetails {
    date: string; // ISO YYYY-MM-DD
    timeSlot: string; // "HH:MM AM - HH:MM PM"
    roomNumber: string;
}

// New type for Attendance Log
export interface AttendanceLogEntry {
  id: string;
  timestamp: string; // ISO string of when it was logged
  date: string; // ISO date string "YYYY-MM-DD" of the class
  timeSlot: string; // Formatted time slot "HH:MM AM - HH:MM PM"
  roomNumber: string;
  buildingName: string;
  courseCode: string;
  courseTitle: string;
  section: string;
  status: AttendanceStatus;
  teacherId: string;
  teacherName: string;
  teacherDesignation: string;
  pId: string;
  makeupInfo?: MakeupClassDetails;
  makeupCompleted?: boolean;
  teacherMobile?: string;
  teacherEmail?: string;
  semester?: string;
  remark?: string;
}


// New type for Smart Scheduler suggestions
export interface SuggestedClassEntry {
  day: DayOfWeek;
  timeSlot: TimeSlot;
  room: string;
  classInfo: Omit<ClassDetail, 'color' | 'levelTerm'>; // Color and levelTerm will not be part of AI suggestion for now
}

// Types for Program Setup
export type ProgramType = 'Undergraduate' | 'Postgraduate' | 'Doctoral' | 'Diploma' | 'Certificate' | 'Other';

export type SemesterSystem = 'Tri-Semester' | 'Bi-Semester';

// Interface for Default Time Slots (moved from DefaultTimeSlotManager.tsx)
export interface DefaultTimeSlot {
  id: string;
  type: 'Theory' | 'Lab';
  startTime: string; // HH:MM (24-hour format for storage and calculation)
  endTime: string;   // HH:MM (24-hour format for storage and calculation)
}

export interface ProgramEntry {
  id: string; // Internal unique ID
  faculty: string; // e.g., "Faculty of Science & Information Technology"
  pId: string; // User-defined Program ID (e.g., "CSE_UG_DAY") - should be unique per program
  fullName: string;
  shortName: string;
  type: ProgramType;
  semesterSystem: SemesterSystem;
  programSpecificSlots?: DefaultTimeSlot[]; // Added for program-specific time slots
  activeDays?: DayOfWeek[]; // New field for active days
}

// Helper type for slot filtering in ProgramSetup's embedded manager
export type ProgramSlotFilterType = 'All' | 'Theory' | 'Lab';
// Helper type for slot filtering in Room Detail's embedded manager (can be the same)
export type RoomDetailSlotFilterType = 'All' | 'Theory' | 'Lab';


export type CourseType = 'Theory' | 'Lab' | 'Thesis' | 'Project' | 'Internship' | 'Viva' | 'Others' | 'N/A';

// New type for Course Enrollment Data
export interface EnrollmentEntry {
  semester: string;
  pId: string; // Program ID
  sectionId: string; // Section ID from data
  courseCode: string;
  courseTitle: string;
  section: string; // Section Name (e.g., 69_A)
  credit: number;
  type: string; // Course category (e.g., GED, Core)
  levelTerm: string; // e.g., "L1T1"
  studentCount: number; // "Student" column
  teacherId: string;
  teacherName: string;
  designation: string;
  teacherMobile: string;
  teacherEmail: string;
  classTaken: number; // "Class Taken" column
  weeklyClass?: number; // New field for weekly classes, now optional
  courseType?: CourseType;
  mergedWithSectionId?: string;
}

// New type for Building/Campus Information
export interface BuildingEntry {
  id: string; // Internal unique ID
  campusName: string;
  buildingName: string;
  buildingShortName: string;
  address: string;
  thumbnailUrl: string; // Base64 data URL for the image
  squareFeet?: number;
}

// Main application view types
export type MainViewType = 'routine' | 'smartScheduler' | 'buildingRooms' | 'programDetail' | 'semesterDetail' | 'userDetail' | 'sectionList' | 'courseList' | 'roomList' | 'teacherList' | 'attendanceLog';

// For Building Rooms Setup
export interface FloorEntry {
  id: string; // Internal unique ID
  buildingId: string; // Foreign key to BuildingEntry
  floorName: string; // e.g., "Ground Floor", "1st Floor", "Level 5"
}

export interface RoomCategoryEntry {
  id: string; // Internal unique ID
  categoryName: string; // e.g., "Classroom", "Lab", "Office", "Meeting Room"
}

export interface RoomTypeEntry {
  id: string; // Internal unique ID
  // categoryId: string; // Foreign key to RoomCategoryEntry - Can be added later for filtering
  typeName: string; // e.g., "Standard Classroom", "Physics Lab", "Faculty Office"
}

export interface RoomEntry {
  id: string; // Internal unique ID
  buildingId: string;
  floorId: string; 
  categoryId: string; 
  typeId: string; 
  roomNumber: string; // e.g., "101", "A-203", "Lab-C"
  capacity: number;
  assignedToPId?: string; // Program ID (from ProgramEntry.pId) this room is primarily assigned to
  sharedWithPIds: string[]; // Array of Program IDs this room can be shared with
  roomSpecificSlots?: DefaultTimeSlot[]; // Added for room-specific time slots
  semesterId?: string; // Stores the selected semester name/ID
}

export type RoutineViewMode = 'roomCentric' | 'dayCentric';

// Prop type for RoutineGrid (though defined in RoutineGrid.tsx, can be here for reference)
// interface RoutineGridProps {
//   routineData: FullRoutineData;
//   selectedDayForRoomCentricView: DayOfWeek;
//   roomEntries: RoomEntry[];
//   headerSlotObjects: DefaultTimeSlot[]; 
//   systemDefaultSlots: DefaultTimeSlot[]; 
//   onRoomHeaderClick: (room: RoomEntry) => void;
//   onDayTimeCellClick: (day: DayOfWeek, slotObject: DefaultTimeSlot) => void; // Changed from timeSlotString
//   onSlotCellClick: (room: RoomEntry, slot: DefaultTimeSlot, day: DayOfWeek) => void;
//   routineViewMode: RoutineViewMode;
// }

export type OverlayViewType = 'settings' | 'notifications' | 'community' | 'userManagement';
export type RoomTypeFilter = 'Theory' | 'Lab' | null;

// New Types for Semester Configuration
export interface SemesterTypeConfig {
  id: number;
  type: SemesterSystem;
  startDate: string;
  endDate: string;
}

export interface SemesterCloneInfo {
  targetSemester: string;
  sourceSemester: string;
  typeConfigs: SemesterTypeConfig[];
}

// ---- New types for versioned routine ----
export interface RoutineVersion {
    versionId: string;
    createdAt: string; // ISO string
    routine: FullRoutineData;
}

export interface SemesterRoutineData {
    versions: RoutineVersion[];
    activeVersionId: string | null;
    publishedVersionId?: string | null;
}

// ---- Auth Types ----
export type UserRole = string;

export interface RoomEditAccess {
  canManageRoomManagement: boolean; // Top-level access to the whole settings panel section
  canAddBuilding: boolean;
  canAddRoom: boolean;
  canDeleteRoom?: boolean;
  canViewRoomDetail: boolean;
  // Room Detail Modal Permissions
  canEditAssignToProgram: boolean;
  canEditShareWithPrograms: boolean;
  canEditDetailsTab: boolean;
  canEditSlotsTab: boolean;
  canImportRoomData?: boolean;
  canExportRoomData?: boolean;
}

export interface DashboardAccess {
  canViewCourseList: boolean;
  canViewSectionList: boolean;
  canViewRoomList: boolean;
  canViewTeacherList: boolean;
  canViewSlotRequirement: boolean;
  canAutoAssign: boolean;
  canManageVersions: boolean;
  canViewSlotUsage: boolean;
  canViewMakeupSchedule: boolean;
  canViewTotalSlots?: boolean;
  canEditCourseSectionDetails?: boolean;
  canImportCourseData?: boolean;
  canExportCourseData?: boolean;
  classMonitoringAccess?: AssignAccessLevel;
  canManageProgramSetup?: boolean;
  canManageDefaultSlots?: boolean;
  canManageSemesterSetup?: boolean;
  canViewSectionTable?: boolean;
  canCustomizeTheme?: boolean;
  canDragAndDrop?: boolean;
  canViewSlotHistory?: boolean;
  // New permissions
  canViewEditableRoutine?: boolean;
  canViewPublishedRoutine?: boolean;
  canPublishRoutine?: boolean;
}

export type AssignAccessLevel = 'none' | 'own' | 'full';

export interface ProgramManagementAccess {
  canAddProgram: boolean;
  canEditProgram: boolean;
}

export interface NotificationAccess {
  canGetNotification: boolean;
  canApproveSlots: boolean;
}

// ---- Pending Changes for Approval System ----
export interface PendingChange {
  id: string; // unique id
  requesterId: string;
  requesterName: string;
  timestamp: string; // ISO string
  
  // For 'ASSIGN', this is the new class. For 'CLEAR', this is null.
  requestedClassInfo: ClassDetail | null; 
  
  // Context
  semesterId: string;
  roomNumber: string;
  slotString: string;
  
  // Scope
  isBulkUpdate: boolean; // true for default routine, false for overrides
  day: DayOfWeek; // Always present for context, mandatory for bulk updates
  dates?: string[]; // for specific date overrides
}

// New type for Notifications
export interface Notification {
  id: string;
  timestamp: string; // ISO string
  userId: string; // The user who should receive this notification
  type: 'approval' | 'rejection' | 'info';
  title: string;
  message: string;
  isRead: boolean;
  relatedChangeId?: string; // Link back to the PendingChange
}

export interface User {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  avatar?: string;
  employeeId?: string;
  designation?: string;
  makeupSlotBookingAccess?: AssignAccessLevel;
  bulkAssignAccess?: AssignAccessLevel;
  dayOffs?: DayOfWeek[];
  accessibleProgramPIds?: string[];
  roomEditAccess?: RoomEditAccess;
  dashboardAccess?: DashboardAccess;
  programManagementAccess?: ProgramManagementAccess;
  notificationAccess?: NotificationAccess;
}

export interface SignupData {
  name: string;
  email: string;
  password_plaintext: string;
  employeeId?: string;
  designation?: string;
  avatar?: string;
  role?: UserRole;
  makeupSlotBookingAccess?: AssignAccessLevel;
  bulkAssignAccess?: AssignAccessLevel;
  accessibleProgramPIds?: string[];
  roomEditAccess?: RoomEditAccess;
  dashboardAccess?: DashboardAccess;
  programManagementAccess?: ProgramManagementAccess;
  notificationAccess?: NotificationAccess;
}

// ---- AI Conflict Resolution Types ----
export interface ConflictInfoForModal {
  day: DayOfWeek;
  slotString: string;
  assignments: { room: RoomEntry; classInfo: ClassDetail }[];
  conflictType: 'teacher' | 'section';
  identifier: string; // The teacher name or section identifier
}

export interface AiResolutionSuggestion {
  action: 'MOVE' | 'SWAP';
  description: string;
  source: { day: DayOfWeek; roomNumber: string; slotString: string; };
  target: { day: DayOfWeek; roomNumber: string; slotString: string; };
  // For SWAP, we need to know what's at the target
  targetOriginalClassInfo?: ClassDetail;
}
