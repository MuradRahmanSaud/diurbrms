import { ProgramType, SemesterSystem } from '../types';

export const PROGRAM_TYPES: ProgramType[] = ['Undergraduate', 'Postgraduate', 'Doctoral', 'Diploma', 'Certificate', 'Other'];
export const SEMESTER_SYSTEMS: SemesterSystem[] = ['Tri-Semester', 'Bi-Semester'];

// The DEFAULT_PROGRAMS_SEED_DATA has been removed.
// This data should now be managed in the database and fetched via the API.
// See services/api.ts for data fetching logic.
