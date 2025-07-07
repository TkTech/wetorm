import { useContext } from 'react';
import {
  PyodideContext,
  type PyodideContextType,
} from '../contexts/PyodideContext';

export function usePyodide(): PyodideContextType {
  const context = useContext(PyodideContext);
  if (context === undefined) {
    throw new Error('usePyodide must be used within a PyodideProvider');
  }
  return context;
}
