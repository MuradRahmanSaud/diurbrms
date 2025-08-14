import React from 'react';
import Modal from '../Modal';
import { useTheme, ThemeColors } from '../../contexts/ThemeContext';

interface ThemeCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ColorPickerInput = ({
  label,
  colorKey,
  theme,
  setThemeColor,
}: {
  label: string;
  colorKey: keyof ThemeColors;
  theme: ThemeColors;
  setThemeColor: (key: keyof ThemeColors, value: string) => void;
}) => {
  const colorValue = theme[colorKey];
  return (
    <div className="flex items-center justify-between p-2 bg-gray-100 rounded-md">
      <label htmlFor={colorKey} className="text-sm font-medium text-gray-700">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <span className="text-sm font-mono text-gray-500">{colorValue}</span>
        <input
          id={colorKey}
          type="color"
          value={colorValue}
          onChange={(e) => setThemeColor(colorKey, e.target.value)}
          className="w-8 h-8 p-0 border-none rounded-md cursor-pointer bg-transparent"
          style={{ backgroundColor: colorValue }}
        />
      </div>
    </div>
  );
};


const ThemeCustomizerModal: React.FC<ThemeCustomizerModalProps> = ({ isOpen, onClose }) => {
    const { theme, setThemeColor, saveTheme, resetTheme } = useTheme();

    const themeOptions: { label: string; key: keyof ThemeColors }[] = [
        { label: 'Primary Accent (e.g., buttons)', key: '--color-primary-500' },
        { label: 'Primary Dark (e.g., header)', key: '--color-primary-700' },
        { label: 'Primary Darkest (e.g., sidebar)', key: '--color-primary-900' },
        { label: 'Primary Light (e.g., hovers)', key: '--color-primary-100' },
        { label: 'Page Background', key: '--color-bg-base' },
        { label: 'Panel Background', key: '--color-bg-panel' },
        { label: 'Main Text', key: '--color-text-base' },
        { label: 'Muted Text', key: '--color-text-muted' },
        { label: 'Highlight Color (Yellow)', key: '--color-accent-yellow-400' },
    ];
    
    const footerContent = (
        <div className="flex justify-between items-center w-full">
            <button
                onClick={resetTheme}
                className="px-4 py-2 text-sm font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-md border border-red-200"
            >
                Reset to Defaults
            </button>
            <div className="flex gap-2">
                <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-md">
                    Cancel
                </button>
                 <button onClick={saveTheme} className="px-4 py-2 text-sm font-medium text-white bg-[var(--color-primary-600)] hover:bg-[var(--color-primary-700)] rounded-md">
                    Save Theme
                </button>
            </div>
        </div>
    );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Customize Theme"
      subTitle="Changes are applied live. Press 'Save Theme' to persist."
      footerContent={footerContent}
      maxWidthClass="max-w-lg"
    >
      <div className="space-y-3">
        {themeOptions.map(opt => (
            <ColorPickerInput
                key={opt.key}
                label={opt.label}
                colorKey={opt.key}
                theme={theme}
                setThemeColor={setThemeColor}
            />
        ))}
      </div>
    </Modal>
  );
};

export default ThemeCustomizerModal;
