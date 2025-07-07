import { createContext } from 'react';

export type Theme = 'light' | 'dark' | 'system';

export interface SettingsState {
  theme: Theme;
  effectiveTheme: 'light' | 'dark';
}

export interface SettingsActions {
  setTheme: (theme: Theme) => void;
}

export interface SettingsContextType extends SettingsState, SettingsActions {}

export const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined
);
