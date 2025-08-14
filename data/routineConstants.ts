


import { TimeSlot, DayOfWeek, FullRoutineData } from '../types';
import { getLevelTermColor } from './colorConstants';

export const FALLBACK_TIME_SLOTS: TimeSlot[] = [ // Renamed from TIME_SLOTS
  '08:30 AM - 10:00 AM',
  '10:00 AM - 11:30 AM',
  '11:30 AM - 01:00 PM',
  '01:00 PM - 02:30 PM',
  '02:30 PM - 04:00 PM',
  '04:00 PM - 05:30 PM',
];

export const FALLBACK_ROOM_NUMBERS: string[] = [ // Renamed from ROOM_NUMBERS
  'AB1-101', 'AB1-102', 'AB1-103', 'AB1-201', 'AB1-202', 'AB1-203',
  'AB4-301', 'AB4-302', 'AB4-303', 'AB4-401', 'AB4-402', 'AB4-403',
  'CSE-501', 'CSE-502', 'CSE-503', 'CSE-LAB1', 'CSE-LAB2', 'CSE-LAB3',
];

export const DAYS_OF_WEEK: DayOfWeek[] = [
  'Saturday',
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday', // Added Friday
];

export const SAMPLE_ROUTINE_DATA: FullRoutineData = {
  'Saturday': {
    'AB1-101': {
      '08:30 AM - 10:00 AM': { courseCode: 'CSE111', courseName: 'Computer Fundamentals', teacher: 'Mr. Anis', section: 'SA', color: getLevelTermColor('L1T1'), pId: '15', classTaken: 8, levelTerm: 'L1T1' },
      '10:00 AM - 11:30 AM': { courseCode: 'ENG101', courseName: 'Basic English', teacher: 'Ms. Liza', section: 'SB', color: getLevelTermColor('L1T1'), pId: '10', classTaken: 7, levelTerm: 'L1T1' },
    },
    'AB1-102': {
      '11:30 AM - 01:00 PM': { courseCode: 'MAT101', courseName: 'Differential Calculus', teacher: 'Mr. Kabir', section: 'SC', color: getLevelTermColor('L1T2'), pId: '15', classTaken: 9, levelTerm: 'L1T2' },
      '02:30 PM - 04:00 PM': { courseCode: 'PHY101', courseName: 'Physics I', teacher: 'Mr. Barua', section: 'SD', color: getLevelTermColor('L1T2'), pId: '15', classTaken: 6, levelTerm: 'L1T2' },
    },
     'CSE-LAB1': {
      '01:00 PM - 02:30 PM': { courseCode: 'CSE111L', courseName: 'Computer Fundamentals Lab', teacher: 'Mr. Anis', section: 'SL1', color: getLevelTermColor('L1T1'), pId: '15', classTaken: 3, levelTerm: 'L1T1' },
      '04:00 PM - 05:30 PM': { courseCode: 'CSE111L', courseName: 'Computer Fundamentals Lab', teacher: 'Mr. Anis', section: 'SL2', color: getLevelTermColor('L1T1'), pId: '15', classTaken: 4, levelTerm: 'L1T1' },
    }
  },
  'Sunday': {
    'AB1-101': {
      '08:30 AM - 10:00 AM': { courseCode: 'CSE121', courseName: 'Structured Programming', teacher: 'Dr. Hasan', section: 'A1', color: getLevelTermColor('L1T2'), pId: '15', classTaken: 11, levelTerm: 'L1T2' },
      '10:00 AM - 11:30 AM': { courseCode: 'MAT121', courseName: 'Integral Calculus', teacher: 'Dr. Zoya', section: 'B1', color: getLevelTermColor('L1T2'), pId: '15', classTaken: 10, levelTerm: 'L1T2' },
    },
    'AB4-301': {
      '11:30 AM - 01:00 PM': { courseCode: 'PHY121', courseName: 'Physics II', teacher: 'Dr. Alam', section: 'C1', color: getLevelTermColor('L1T2'), pId: '19', classTaken: 8, levelTerm: 'L1T2' },
    },
    'CSE-LAB2': {
      '02:30 PM - 04:00 PM': { courseCode: 'CSE121L', courseName: 'Structured Programming Lab', teacher: 'Mr. David', section: 'L1A', color: getLevelTermColor('L1T2'), pId: '15', classTaken: 5, levelTerm: 'L1T2' },
      '04:00 PM - 05:30 PM': { courseCode: 'CSE121L', courseName: 'Structured Programming Lab', teacher: 'Mr. David', section: 'L1B', color: getLevelTermColor('L1T2'), pId: '15', classTaken: 5, levelTerm: 'L1T2' },
    }
  },
   'Monday': {
    'AB1-201': {
      '10:00 AM - 11:30 AM': { courseCode: 'CSE211', courseName: 'OOP', teacher: 'Ms. Farhana', section: 'M1', color: getLevelTermColor('L2T1'), pId: '35', classTaken: 12, levelTerm: 'L2T1' },
      '01:00 PM - 02:30 PM': { courseCode: 'GED101', courseName: 'Bangladesh Studies', teacher: 'Mr. Rofiq', section: 'M2', color: getLevelTermColor('L1T1'), pId: '10', classTaken: 6, levelTerm: 'L1T1' },
    },
    'CSE-501': {
      '08:30 AM - 10:00 AM': { courseCode: 'EEE101', courseName: 'Basic Electrical Engg.', teacher: 'Mr. Papon', section: 'M3', color: getLevelTermColor('L1T3'), pId: '19', classTaken: 10, levelTerm: 'L1T3' },
    }
  },
  // You can add data for 'Tuesday', 'Wednesday', 'Thursday', 'Friday' here if needed
  // For example:
  // 'Friday': {
  //   'AB1-101': {
  //     '10:00 AM - 11:30 AM': { courseCode: 'SOC101', courseName: 'Sociology', teacher: 'Ms. Dina', section: 'SF', color: 'bg-sky-100' },
  //   }
  // }
};