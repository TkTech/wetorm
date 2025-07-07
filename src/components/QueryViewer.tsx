import React, { useState, useEffect } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { python } from '@codemirror/lang-python';
import { format } from 'sql-formatter';
import { queryCapture, type QueryInfo } from '../services/queryCapture';
import { Pane } from './Pane';

interface QueryViewerProps {
  onLineHighlight?: (lineNumber: number | null) => void;
}

export const QueryViewer: React.FC<QueryViewerProps> = ({
  onLineHighlight,
}) => {
  const [queries, setQueries] = useState<QueryInfo[]>([]);
  const [selectedQuery, setSelectedQuery] = useState<QueryInfo | null>(null);

  useEffect(() => {
    setQueries(queryCapture.getQueries().reverse());

    const handleNewQuery = (query: QueryInfo) => {
      setQueries((prev) => [query, ...prev]);
    };

    queryCapture.onQuery(handleNewQuery);

    return () => {
      queryCapture.removeListener(handleNewQuery);
    };
  }, []);

  const clearQueries = () => {
    queryCapture.clearQueries();
    setQueries([]);
    setSelectedQuery(null);
    onLineHighlight?.(null);
  };

  const selectQuery = (query: QueryInfo) => {
    setSelectedQuery(query);
    onLineHighlight?.(query.sourceLineNumber || null);
  };

  const formatSQL = (sql: string) => {
    try {
      return format(sql, {
        language: 'sqlite',
        tabWidth: 2,
        useTabs: false,
        keywordCase: 'upper',
        identifierCase: 'lower',
        functionCase: 'upper',
        // We need to support %s-style parameters used by the Django ORM
        paramTypes: {
          custom: [{ regex: '%s' }],
        },
      });
    } catch (error) {
      console.error('Error formatting SQL:', error);
      return sql;
    }
  };

  return (
    <Pane
      title="Captured Queries"
      defaultCollapsed={false}
      actions={
        <button className="header-button clear-button" onClick={clearQueries}>
          Clear All
        </button>
      }
    >
      <div className="query-layout">
        <div className="query-list">
          {queries.map((query) => (
            <div
              key={query.id}
              className={`query-item ${selectedQuery?.id === query.id ? 'selected' : ''}`}
              onClick={() => selectQuery(query)}
            >
              <div className="query-meta">
                <span className="database-badge">{query.database}</span>
                {query.queryType && (
                  <span
                    className={`query-type-badge ${query.queryType.toLowerCase()}`}
                  >
                    {query.queryType}
                  </span>
                )}
                {query.sourceLineNumber && (
                  <span className="source-line-badge">
                    Line {query.sourceLineNumber}
                  </span>
                )}
                <span className="timestamp">
                  {new Date(query.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <div className="query-preview">
                {query.query.substring(0, 50)}...
              </div>
            </div>
          ))}
        </div>

        <div className="query-details">
          {selectedQuery && (
            <div>
              <div className="query-info">
                {selectedQuery.executionTime ? (
                  <p>
                    <strong>Execution Time:</strong>{' '}
                    {selectedQuery.executionTime}ms
                  </p>
                ) : null}
              </div>
              <div className="query-sql">
                <h4>Query</h4>
                <CodeMirror
                  value={formatSQL(selectedQuery.query)}
                  extensions={[sql()]}
                  editable={false}
                  basicSetup={{
                    lineNumbers: false,
                    foldGutter: false,
                    dropCursor: false,
                    allowMultipleSelections: false,
                    searchKeymap: false,
                    autocompletion: false,
                    highlightSelectionMatches: false,
                  }}
                  className="sql-viewer"
                />
              </div>
              {selectedQuery.parameters && (
                <div className="query-params">
                  <h4>Parameters</h4>
                  <pre>{JSON.stringify(selectedQuery.parameters, null, 2)}</pre>
                </div>
              )}
              {selectedQuery.sourceContext && (
                <div className="query-source-context">
                  <h4>Source Context</h4>
                  <CodeMirror
                    value={selectedQuery.sourceContext}
                    extensions={[python()]}
                    editable={false}
                    basicSetup={{
                      lineNumbers: false,
                      foldGutter: false,
                      dropCursor: false,
                      allowMultipleSelections: false,
                      searchKeymap: false,
                      autocompletion: false,
                      highlightSelectionMatches: false,
                    }}
                    className="source-context-viewer"
                  />
                </div>
              )}
              {selectedQuery.result ? (
                <div className="query-result">
                  <h4>Result</h4>
                  <pre>{JSON.stringify(selectedQuery.result, null, 2)}</pre>
                </div>
              ) : null}
              {selectedQuery.error && (
                <div className="query-error">
                  <h4>Error</h4>
                  <pre>{selectedQuery.error}</pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Pane>
  );
};
