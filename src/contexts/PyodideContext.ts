import { createContext } from 'react';
import type { PyodideInterface } from 'pyodide';

export interface PyodideContextType {
  bootstrapCode: string;
  setBootstrapCode: (code: string) => void;
  getPyodideInstance: () => Promise<PyodideInterface>;
  isInitialized: boolean;
  resetPyodide: () => void;
}

export const PyodideContext = createContext<PyodideContextType | undefined>(
  undefined
);
