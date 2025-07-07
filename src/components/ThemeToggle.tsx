import React from 'react';
import { useSettings } from '../hooks/useSettings';
import type { Theme } from '../contexts/SettingsContext';

export const ThemeToggle: React.FC = () => {
  const { theme, effectiveTheme, setTheme } = useSettings();

  const handleThemeChange = () => {
    const themes: Theme[] = ['light', 'dark', 'system'];
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
  };

  const getThemeIcon = () => {
    switch (theme) {
      case 'light':
        return '☀️';
      case 'dark':
        return '🌙';
      case 'system':
        return '⚙️';
      default:
        return '⚙️';
    }
  };

  const getThemeLabel = () => {
    switch (theme) {
      case 'light':
        return 'Light';
      case 'dark':
        return 'Dark';
      case 'system':
        return `System (${effectiveTheme})`;
      default:
        return 'System';
    }
  };

  return (
    <button
      className="header-button theme-button"
      onClick={handleThemeChange}
      title={`Current theme: ${getThemeLabel()}. Click to change.`}
      aria-label={`Switch theme. Current: ${getThemeLabel()}`}
    >
      <span className="theme-icon">{getThemeIcon()}</span>
      <span className="theme-label">{theme === 'system' ? 'Auto' : theme}</span>
    </button>
  );
};
