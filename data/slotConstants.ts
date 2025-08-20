import { DefaultTimeSlot } from '../types';

/**
 * Sorts an array of DefaultTimeSlot objects.
 * Primary sort: 'Theory' slots appear before 'Lab' slots.
 * Secondary sort: Within each type, slots are sorted by their start time.
 * @param a - The first DefaultTimeSlot object to compare.
 * @param b - The second DefaultTimeSlot object to compare.
 * @returns A negative value if a < b, a positive value if a > b, or 0 if a === b.
 */
export const sortSlotsByTypeThenTime = (a: DefaultTimeSlot, b: DefaultTimeSlot): number => {
  const typeOrder = (type: 'Theory' | 'Lab') => (type === 'Theory' ? 0 : 1);
  const typeDiff = typeOrder(a.type) - typeOrder(b.type);
  if (typeDiff !== 0) return typeDiff;
  return a.startTime.localeCompare(b.startTime);
};


// The SEED_DEFAULT_SLOTS_DATA has been removed.
// This data should now be managed in the database and fetched via the API.
// See services/api.ts for data fetching logic.
