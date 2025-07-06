import { useState, useEffect } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';
import { oneDark } from '@codemirror/theme-one-dark';
import { indentUnit } from '@codemirror/language';
import { Decoration, EditorView } from '@codemirror/view';
import { StateField, StateEffect } from '@codemirror/state';
import { runDjangoCode } from './services/pyodide';
import { QueryViewer } from './components/QueryViewer';
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
            attributes: { class: 'highlighted-line' }
          });
          decorations = Decoration.set([decoration.range(line.from)]);
        }
      }
    }
    
    return decorations;
  },
  provide: f => EditorView.decorations.from(f)
});

function App() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [gistError, setGistError] = useState<string | null>(null);
  const [editorView, setEditorView] = useState<EditorView | null>(null);

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
          setGistError(error instanceof Error ? error.message : 'Failed to load gist');
        }
      }
    };

    loadGist();
  }, []);

  const runCode = async () => {
    setIsRunning(true);
    setOutput('');

    try {
      const result = await runDjangoCode(code);
      setOutput(result || '(code executed successfully, but there was no output)');
    } catch (error) {
      setOutput(`Error: ${error}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleLineHighlight = (lineNumber: number | null) => {
    if (editorView) {
      editorView.dispatch({
        effects: highlightLineEffect.of(lineNumber)
      });
    }
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-title">
          <img src="/wetorm/logo_small.png" alt="WetORM Logo" className="header-logo" />
          <h1>WetORM</h1>
        </div>
        {gistError && (
          <div className="gist-error">
            ⚠️ {gistError}
          </div>
        )}
        <div className="header-actions">
          <a 
            href="https://github.com/tktech/wetorm" 
            target="_blank" 
            rel="noopener noreferrer"
            className="button github-link"
          >
            GitHub
          </a>
          <button className="button run-button" onClick={runCode} disabled={isRunning}>
            {isRunning ? 'Running...' : 'Run'}
          </button>
        </div>
      </header>

      <main className="main-layout">
        <div className="code-panel">
          <CodeMirror
            value={code}
            onChange={(value) => setCode(value)}
            extensions={[python(), oneDark, indentUnit.of("    "), highlightLineField]}
            theme={oneDark}
            className="code-editor"
            basicSetup={{
              lineNumbers: true,
              foldGutter: true,
              dropCursor: false,
              allowMultipleSelections: false,
              indentOnInput: true,
              bracketMatching: true,
              closeBrackets: true,
              autocompletion: true,
              highlightSelectionMatches: false,
            }}
            onCreateEditor={(view) => setEditorView(view)}
          />
        </div>

        <div className="results-panel">
          <div className="output-section">
            <h3>Output</h3>
            <pre className="output">{output}</pre>
          </div>
          <QueryViewer onLineHighlight={handleLineHighlight} />
        </div>
      </main>
    </div>
  );
}

export default App;
