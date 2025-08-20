import { DayOfWeek } from '../types';

// Hardcoded data has been removed.
// All routine, room, and time slot data should now be fetched from the backend API.
// The services/api.ts file is the new source of truth for data fetching logic.

export const DAYS_OF_WEEK: DayOfWeek[] = [
  'Saturday',
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
];
