import React, { useRef } from 'react';
import { python } from '@codemirror/lang-python';
import { indentUnit } from '@codemirror/language';
import { EditorView, keymap } from '@codemirror/view';
import type { Extension } from '@codemirror/state';
import { history, historyKeymap } from '@codemirror/commands';
import { oneDark } from '@codemirror/theme-one-dark';
import CodeMirror from '@uiw/react-codemirror';
import { useSettings } from '../hooks/useSettings';
import './TabbedCodeEditor.css';

interface Tab {
  id: string;
  label: string;
  content: string;
  language?: string;
}

interface TabbedCodeEditorProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  onContentChange: (tabId: string, content: string) => void;
  onCreateEditor?: (tabId: string, view: EditorView) => void;
  extensions?: Extension[];
  className?: string;
}

interface TabEditorProps {
  tab: Tab;
  isActive: boolean;
  onContentChange: (content: string) => void;
  onCreateEditor?: (view: EditorView) => void;
  extensions?: Extension[];
}

const TabEditor: React.FC<TabEditorProps> = ({
  tab,
  isActive,
  onContentChange,
  onCreateEditor,
  extensions = [],
}) => {
  const editorRef = useRef<EditorView | null>(null);
  const { effectiveTheme } = useSettings();

  const getLanguageExtension = (language?: string) => {
    switch (language) {
      case 'python':
        return python();
      case 'text':
        return [];
      default:
        return python();
    }
  };

  const allExtensions = [
    getLanguageExtension(tab.language),
    indentUnit.of('    '),
    history(),
    keymap.of(historyKeymap),
    EditorView.theme({
      '&': { height: '100%' },
      '.cm-scroller': {
        fontFamily:
          "'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace",
      },
    }),
    EditorView.lineWrapping,
    ...(effectiveTheme === 'dark' ? [oneDark] : []),
    ...extensions,
  ];

  return (
    <div
      className="tab-editor"
      style={{ display: isActive ? 'block' : 'none', height: '100%' }}
    >
      <CodeMirror
        value={tab.content}
        height="100%"
        extensions={allExtensions}
        onChange={(value) => onContentChange(value)}
        onCreateEditor={(view) => {
          editorRef.current = view;
          if (onCreateEditor) {
            onCreateEditor(view);
          }
        }}
        theme={effectiveTheme === 'dark' ? oneDark : undefined}
      />
    </div>
  );
};

export const TabbedCodeEditor: React.FC<TabbedCodeEditorProps> = ({
  tabs,
  activeTab,
  onTabChange,
  onContentChange,
  onCreateEditor,
  extensions = [],
  className = '',
}) => {
  return (
    <div className={`tabbed-editor ${className}`}>
      <div className="tab-bar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab ${tab.id === activeTab ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="editor-container">
        {tabs.map((tab) => (
          <TabEditor
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeTab}
            onContentChange={(content) => onContentChange(tab.id, content)}
            onCreateEditor={
              onCreateEditor
                ? (view) => onCreateEditor(tab.id, view)
                : undefined
            }
            extensions={extensions}
          />
        ))}
      </div>
    </div>
  );
};
