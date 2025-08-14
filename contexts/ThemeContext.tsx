import React, { createContext, useState, useEffect, useCallback, useContext, ReactNode } from 'react';

// Define the shape of the theme object
export interface ThemeColors {
  '--color-primary-100': string;
  '--color-primary-500': string;
  '--color-primary-700': string;
  '--color-primary-900': string;
  '--color-bg-base': string;
  '--color-bg-panel': string;
  '--color-text-base': string;
  '--color-text-muted': string;
  '--color-accent-yellow-400': string;
}

// Define the default theme based on the CSS :root variables
export const defaultTheme: ThemeColors = {
  '--color-primary-100': '#ccfbf1', // teal-100
  '--color-primary-500': '#14b8a6', // teal-500
  '--color-primary-700': '#0f766e', // teal-700
  '--color-primary-900': '#134e4a', // teal-900
  '--color-bg-base': '#f3f4f6',      // gray-100
  '--color-bg-panel': '#ffffff',     // white
  '--color-text-base': '#1f2937',    // gray-800
  '--color-text-muted': '#6b7280',   // gray-500
  '--color-accent-yellow-400': '#facc15', // yellow-400
};

// Define the shape of the context
interface ThemeContextType {
  theme: ThemeColors;
  setThemeColor: (key: keyof ThemeColors, value: string) => void;
  saveTheme: () => void;
  resetTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const RBRMS_THEME_KEY = 'rbrms-custom-theme';

// Helper to apply theme to the document
const applyTheme = (theme: ThemeColors) => {
  for (const [key, value] of Object.entries(theme)) {
    document.documentElement.style.setProperty(key, value);
  }
};

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<ThemeColors>(() => {
    try {
      const savedThemeJson = localStorage.getItem(RBRMS_THEME_KEY);
      if (savedThemeJson) {
        // Merge saved theme with defaults to ensure all keys are present
        return { ...defaultTheme, ...JSON.parse(savedThemeJson) };
      }
    } catch (e) {
      console.error("Failed to parse theme from localStorage", e);
    }
    return defaultTheme;
  });

  // Apply theme on initial load and whenever it changes
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setThemeColor = (key: keyof ThemeColors, value: string) => {
    setTheme(prevTheme => ({
      ...prevTheme,
      [key]: value,
    }));
  };

  const saveTheme = () => {
    try {
      localStorage.setItem(RBRMS_THEME_KEY, JSON.stringify(theme));
      alert("Theme saved!");
    } catch (e) {
      console.error("Failed to save theme to localStorage:", e);
      alert("Could not save theme. Your browser storage might be full.");
    }
  };

  const resetTheme = () => {
    localStorage.removeItem(RBRMS_THEME_KEY);
    setTheme(defaultTheme); // Revert to the default state
    // The useEffect will automatically re-apply the default theme
    alert("Theme has been reset to default.");
  };

  return (
    <ThemeContext.Provider value={{ theme, setThemeColor, saveTheme, resetTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
