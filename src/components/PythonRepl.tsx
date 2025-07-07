import { useRef, useEffect } from 'react';
import { usePyodide } from '../hooks/usePyodideContext';

declare global {
  interface Window {
    executeInPyodide: (code: string) => {
      success: boolean;
      output: string;
      result?: unknown;
      error?: string;
    };
  }
}

interface PythonReplProps {
  onCommandExecuted?: () => void;
}

export function PythonRepl({ onCommandExecuted }: PythonReplProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const { getPyodideInstance } = usePyodide();

  useEffect(() => {
    const initializeRepl = async () => {
      if (!terminalRef.current) return;

      try {
        const pyodide = await getPyodideInstance();

        // Let's try a simpler approach - just use runPython directly for now
        let outputBuffer = '';

        // Set up output capture
        pyodide.setStdout({
          batched: (msg) => {
            outputBuffer += msg;
          },
        });

        pyodide.setStderr({
          batched: (msg) => {
            outputBuffer += msg;
          },
        });

        // Simple command execution function that uses the same namespace as main code
        window.executeInPyodide = (code) => {
          outputBuffer = ''; // Clear buffer
          try {
            // Execute in the same global namespace where models are defined
            const result = pyodide.runPython(code, {
              globals: pyodide.globals,
            });
            return {
              success: true,
              output: outputBuffer,
              result: result,
            };
          } catch (error) {
            return {
              success: false,
              output: outputBuffer,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        };

        // Create a simple terminal interface
        const terminal = terminalRef.current;
        terminal.innerHTML = `
          <div class="pyodide-terminal">
            <div class="terminal-content" id="terminal-content"></div>
            <div class="terminal-input-line">
              <span class="terminal-prompt" id="terminal-prompt">>>> </span>
              <input type="text" class="terminal-input" id="terminal-input" autofocus />
            </div>
          </div>
        `;

        const content = terminal.querySelector(
          '#terminal-content'
        ) as HTMLElement;
        const input = terminal.querySelector(
          '#terminal-input'
        ) as HTMLInputElement;

        if (!content || !input) {
          throw new Error('Failed to find terminal elements');
        }

        const appendToTerminal = (text: string, className: string = '') => {
          const div = document.createElement('div');
          if (className) div.className = className;
          div.textContent = text;
          content.appendChild(div);
          content.scrollTop = content.scrollHeight;
        };

        const executeCommand = (command: string) => {
          // Display the command
          appendToTerminal(`>>> ${command}`, 'terminal-input-echo');

          // For now, just execute single commands (no multiline support)
          try {
            const result = window.executeInPyodide?.(command);
            if (!result) {
              appendToTerminal('Error: REPL not initialized', 'terminal-error');
              return;
            }

            if (result.success) {
              // Show output if any
              if (result.output) {
                appendToTerminal(result.output, 'terminal-output');
              }
              // Show result if it's not None/undefined
              if (result.result !== undefined && result.result !== null) {
                appendToTerminal(String(result.result), 'terminal-output');
              }
            } else {
              // Show error
              if (result.output) {
                appendToTerminal(result.output, 'terminal-output');
              }
              appendToTerminal(
                result.error || 'Unknown error',
                'terminal-error'
              );
            }

            // Trigger database refresh after any command execution
            onCommandExecuted?.();
          } catch (error) {
            appendToTerminal(`Error: ${error}`, 'terminal-error');
            // Also trigger refresh on error in case partial changes were made
            onCommandExecuted?.();
          }
        };

        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            const command = input.value.trim();
            input.value = '';

            if (command) {
              executeCommand(command);
            }
          }
        });
      } catch (error) {
        console.error('Failed to initialize Pyodide REPL:', error);
        if (terminalRef.current) {
          terminalRef.current.innerHTML = `<div class="repl-error">Failed to initialize Python REPL: ${error}</div>`;
        }
      }
    };

    initializeRepl();
  }, [getPyodideInstance, onCommandExecuted]);

  return (
    <div className="python-repl">
      <div ref={terminalRef} className="repl-terminal-container"></div>
    </div>
  );
}
