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
  const [lastRequirements, setLastRequirements] = useState<string>('');

  const setBootstrapCode = useCallback((code: string) => {
    setBootstrapCodeState(code);
    localStorage.setItem('wetorm-settings-content', code);
    // Force pyodide reset when bootstrap changes
    setPyodideInstance(null);
    setLastBootstrapCode('');
  }, []);

  const getPyodideInstance = useCallback(
    async (requirements?: string): Promise<PyodideInterface> => {
      // Use provided requirements, or fall back to last used requirements, or empty string
      const currentRequirements =
        requirements !== undefined ? requirements : lastRequirements || '';

      // If we have a cached instance and nothing has changed, return it
      if (
        pyodideInstance &&
        lastBootstrapCode === bootstrapCode &&
        lastRequirements === currentRequirements
      ) {
        return pyodideInstance;
      }

      // Create new instance with current bootstrap and requirements
      const instance = await initializePyodide(
        bootstrapCode,
        currentRequirements
      );
      setPyodideInstance(instance);
      setLastBootstrapCode(bootstrapCode);
      setLastRequirements(currentRequirements);
      return instance;
    },
    [pyodideInstance, lastBootstrapCode, bootstrapCode, lastRequirements]
  );

  const resetPyodide = useCallback(() => {
    setPyodideInstance(null);
    setLastBootstrapCode('');
    setLastRequirements('');
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
