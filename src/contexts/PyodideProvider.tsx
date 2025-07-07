import React, { useState, useCallback } from 'react';
import { initializePyodide, getDefaultBootstrap } from '../services/pyodide';
import type { PyodideInterface } from 'pyodide';
import { PyodideContext, type PyodideContextType } from './PyodideContext';

interface PyodideProviderProps {
  children: React.ReactNode;
}

export function PyodideProvider({ children }: PyodideProviderProps) {
  const [bootstrapCode, setBootstrapCodeState] = useState(() => {
    const saved = localStorage.getItem('wetorm-settings-content');
    return saved || getDefaultBootstrap();
  });

  const [pyodideInstance, setPyodideInstance] =
    useState<PyodideInterface | null>(null);
  const [lastBootstrapCode, setLastBootstrapCode] = useState<string>('');

  const setBootstrapCode = useCallback((code: string) => {
    setBootstrapCodeState(code);
    localStorage.setItem('wetorm-settings-content', code);
    // Force pyodide reset when bootstrap changes
    setPyodideInstance(null);
    setLastBootstrapCode('');
  }, []);

  const getPyodideInstance =
    useCallback(async (): Promise<PyodideInterface> => {
      // If we have a cached instance and bootstrap hasn't changed, return it
      if (pyodideInstance && lastBootstrapCode === bootstrapCode) {
        return pyodideInstance;
      }

      // Create new instance with current bootstrap
      const instance = await initializePyodide(bootstrapCode);
      setPyodideInstance(instance);
      setLastBootstrapCode(bootstrapCode);
      return instance;
    }, [pyodideInstance, lastBootstrapCode, bootstrapCode]);

  const resetPyodide = useCallback(() => {
    setPyodideInstance(null);
    setLastBootstrapCode('');
  }, []);

  const value: PyodideContextType = {
    bootstrapCode,
    setBootstrapCode,
    getPyodideInstance,
    isInitialized: !!pyodideInstance,
    resetPyodide,
  };

  return (
    <PyodideContext.Provider value={value}>{children}</PyodideContext.Provider>
  );
}
