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

// Raw data for initial seed/dummy default time slots, without IDs.
// IDs will be generated when these are used to initialize state or appended.
const rawSeedData: Omit<DefaultTimeSlot, 'id'>[] = [
  // Theory Slots (1.5 hours each)
  { type: 'Theory', startTime: '08:30', endTime: '10:00' },
  { type: 'Theory', startTime: '10:00', endTime: '11:30' },
  { type: 'Theory', startTime: '11:30', endTime: '13:00' },
  { type: 'Theory', startTime: '13:00', endTime: '14:30' },
  { type: 'Theory', startTime: '14:30', endTime: '16:00' },
  { type: 'Theory', startTime: '16:00', endTime: '17:30' },
  // Lab Slots (3 hours each)
  { type: 'Lab', startTime: '08:30', endTime: '11:30' },
  { type: 'Lab', startTime: '11:30', endTime: '14:30' },
  { type: 'Lab', startTime: '14:30', endTime: '17:30' },
];

// Export the raw seed data, pre-sorted for convenience.
// Consumers of this data will be responsible for adding unique IDs.
export const SEED_DEFAULT_SLOTS_DATA: Omit<DefaultTimeSlot, 'id'>[] = 
    [...rawSeedData].sort((a,b) => sortSlotsByTypeThenTime(a as DefaultTimeSlot, b as DefaultTimeSlot));
