import { useState, useEffect, useCallback } from 'react';
import { Decoration, EditorView } from '@codemirror/view';
import { StateField, StateEffect } from '@codemirror/state';
import { runDjangoCode } from './services/pyodide';
import { QueryViewer } from './components/QueryViewer';
import { DatabaseBrowser } from './components/DatabaseBrowser';
import { PythonRepl } from './components/PythonRepl';
import { TabbedCodeEditor } from './components/TabbedCodeEditor';
import { PyodideProvider } from './contexts/PyodideProvider';
import { usePyodide } from './hooks/usePyodideContext';
import { getGistIdFromUrl, fetchGistContent } from './utils/gist';
import './App.css';

const DEFAULT_CODE = `from django.db import models

class Person(models.Model):
    name = models.CharField(max_length=100)

    def __str__(self):
        return self.name

def run():
    instance = Person.objects.create(name='John Doe')
    print(f'Created: {instance}')
    
    for person in Person.objects.all():
        print(f'Person: {person}')
        
    johns = Person.objects.filter(name__contains='John')
    print(f'Found {johns.count()} people with "John" in their name')
`;

// Create line highlighting extension
const highlightLineEffect = StateEffect.define<number | null>();

const highlightLineField = StateField.define({
  create() {
    return Decoration.none;
  },
  update(decorations, tr) {
    decorations = decorations.map(tr.changes);

    for (const effect of tr.effects) {
      if (effect.is(highlightLineEffect)) {
        if (effect.value === null) {
          decorations = Decoration.none;
        } else {
          const lineNumber = effect.value;
          const line = tr.state.doc.line(lineNumber);
          const decoration = Decoration.line({
            attributes: { class: 'highlighted-line' },
          });
          decorations = Decoration.set([decoration.range(line.from)]);
        }
      }
    }

    return decorations;
  },
  provide: (f) => EditorView.decorations.from(f),
});

const STORAGE_KEY_CODE = 'wetorm-editor-content';

function AppContent() {
  const { bootstrapCode, setBootstrapCode, getPyodideInstance } = usePyodide();
  
  const handleCommandExecuted = useCallback(() => {
    setDbRefreshTrigger((prev) => prev + 1);
  }, []);
  const [code, setCode] = useState(() => {
    // Only load from localStorage if no gist is being loaded
    const gistId = getGistIdFromUrl();
    if (!gistId) {
      const saved = localStorage.getItem(STORAGE_KEY_CODE);
      return saved || DEFAULT_CODE;
    }
    return DEFAULT_CODE;
  });

  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [gistError, setGistError] = useState<string | null>(null);
  const [editorViews, setEditorViews] = useState<Map<string, EditorView>>(
    new Map()
  );
  const [dbRefreshTrigger, setDbRefreshTrigger] = useState<number>(0);
  const [showRepl, setShowRepl] = useState(false);
  const [activeTab, setActiveTab] = useState('code.py');

  // Load gist content on mount if URL contains gist parameter
  useEffect(() => {
    const loadGist = async () => {
      const gistId = getGistIdFromUrl();
      if (gistId) {
        try {
          setGistError(null);
          const gistContent = await fetchGistContent(gistId);
          setCode(gistContent);
        } catch (error) {
          setGistError(
            error instanceof Error ? error.message : 'Failed to load gist'
          );
        }
      }
    };

    loadGist();
  }, []);

  // Save to localStorage when code changes (but not when loading from gist)
  useEffect(() => {
    const gistId = getGistIdFromUrl();
    if (!gistId && code !== DEFAULT_CODE) {
      localStorage.setItem(STORAGE_KEY_CODE, code);
    }
  }, [code]);

  const runCode = async () => {
    setIsRunning(true);
    setOutput('');

    try {
      // Get the pyodide instance (will use current bootstrap from context)
      const pyodideInstance = await getPyodideInstance();

      const result = await runDjangoCode(code, pyodideInstance);
      setOutput(
        result || '(code executed successfully, but there was no output)'
      );
      // Trigger database refresh after successful code execution
      setDbRefreshTrigger((prev) => prev + 1);
    } catch (error) {
      setOutput(`Error: ${error}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleLineHighlight = (lineNumber: number | null) => {
    // Highlight line in the currently active editor (code.py for Django queries)
    const activeEditorView = editorViews.get('code.py');
    if (activeEditorView) {
      activeEditorView.dispatch({
        effects: highlightLineEffect.of(lineNumber),
      });
    }
  };

  const tabs = [
    {
      id: 'code.py',
      label: 'code.py',
      content: code,
      language: 'python',
    },
    {
      id: 'settings.py',
      label: 'settings.py',
      content: bootstrapCode,
      language: 'python',
    },
  ];

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
  };

  const handleContentChange = (tabId: string, content: string) => {
    if (tabId === 'code.py') {
      setCode(content);
    } else if (tabId === 'settings.py') {
      setBootstrapCode(content);
    }
  };

  return (
    <div className="app">
      <main className="main-layout">
        <div className="code-panel">
          <div className="code-section">
            <div className="code-header">
              <div className="header-title">
                <img
                  src="/wetorm/logo_small.png"
                  alt="WetORM Logo"
                  className="header-logo"
                />
                <h3>WetORM</h3>
              </div>
              <div className="code-header-actions">
                {gistError && <div className="gist-error">⚠️ {gistError}</div>}
                <div className="header-actions">
                  <a
                    href="https://github.com/tktech/wetorm"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="header-button github-button"
                  >
                    GitHub
                  </a>
                  <button
                    className="header-button run-button"
                    onClick={runCode}
                    disabled={isRunning}
                  >
                    {isRunning ? 'Running...' : 'Run'}
                  </button>
                </div>
              </div>
            </div>
            <TabbedCodeEditor
              tabs={tabs}
              activeTab={activeTab}
              onTabChange={handleTabChange}
              onContentChange={handleContentChange}
              onCreateEditor={(tabId, view) => {
                setEditorViews((prev) => new Map(prev).set(tabId, view));
              }}
              extensions={[highlightLineField]}
              className="code-editor"
            />
          </div>
          <div className="database-section">
            <DatabaseBrowser refreshTrigger={dbRefreshTrigger} />
          </div>
        </div>

        <div className="results-panel">
          <div className="output-section">
            <div className="output-header">
              <h3>{showRepl ? 'Python REPL' : 'Output'}</h3>
              <button
                className="header-button toggle-button"
                onClick={() => setShowRepl(!showRepl)}
              >
                {showRepl ? 'Show Output' : 'Show REPL'}
              </button>
            </div>
            {showRepl ? (
              <PythonRepl
                onCommandExecuted={handleCommandExecuted}
              />
            ) : (
              <pre className="output">{output}</pre>
            )}
          </div>
          <QueryViewer onLineHighlight={handleLineHighlight} />
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <PyodideProvider>
      <AppContent />
    </PyodideProvider>
  );
}

export default App;
