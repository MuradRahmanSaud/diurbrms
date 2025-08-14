
export const LEVEL_TERM_COLORS: { [key: string]: string } = {
    'L1T1': 'bg-sky-100',
    'L1T2': 'bg-lime-100',
    'L1T3': 'bg-amber-100',
    'L2T1': 'bg-rose-100',
    'L2T2': 'bg-teal-100',
    'L2T3': 'bg-blue-100',
    'L3T1': 'bg-green-100',
    'L3T2': 'bg-yellow-100',
    'L3T3': 'bg-purple-100',
    'L4T1': 'bg-pink-100',
    'L4T2': 'bg-orange-100',
    'L4T3': 'bg-cyan-100',
    'N/A': 'bg-gray-100',
};

export const getLevelTermColor = (levelTerm?: string): string => {
    if (levelTerm && LEVEL_TERM_COLORS[levelTerm]) {
        return LEVEL_TERM_COLORS[levelTerm];
    }
    return 'bg-gray-100'; // Default color for unknown level-terms
};

export const ACCENT_COLOR_MAPPING: { [key: string]: string } = {
  'bg-sky-100': 'bg-sky-500',
  'bg-lime-100': 'bg-lime-500',
  'bg-amber-100': 'bg-amber-500',
  'bg-rose-100': 'bg-rose-500',
  'bg-teal-100': 'bg-teal-500',
  'bg-blue-100': 'bg-blue-500',
  'bg-green-100': 'bg-green-500',
  'bg-yellow-100': 'bg-yellow-500',
  'bg-purple-100': 'bg-purple-500',
  'bg-pink-100': 'bg-pink-500',
  'bg-orange-100': 'bg-orange-500',
  'bg-cyan-100': 'bg-cyan-500',
  'bg-gray-100': 'bg-gray-400',
};

export const getAccentColor = (baseColor?: string): string => {
  if (baseColor && ACCENT_COLOR_MAPPING[baseColor]) {
    return ACCENT_COLOR_MAPPING[baseColor];
  }
  return 'bg-gray-400';
};
