import React, { useState, useEffect } from 'react';
import { queryCapture, type QueryInfo } from '../services/queryCapture';

export const QueryViewer: React.FC = () => {
  const [queries, setQueries] = useState<QueryInfo[]>([]);
  const [selectedQuery, setSelectedQuery] = useState<QueryInfo | null>(null);

  useEffect(() => {
    setQueries(queryCapture.getQueries());

    const handleNewQuery = (query: QueryInfo) => {
      setQueries((prev) => [...prev, query]);
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
  };

  return (
    <div className="query-viewer">
      <div className="query-header">
        <h2>Captured Queries</h2>
        <button onClick={clearQueries}>Clear All</button>
      </div>

      <div className="query-layout">
        <div className="query-list">
          {queries.map((query) => (
            <div
              key={query.id}
              className={`query-item ${selectedQuery?.id === query.id ? 'selected' : ''}`}
              onClick={() => setSelectedQuery(query)}
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
              <h3>Query Details</h3>
              <div className="query-info">
                <p>
                  <strong>Database:</strong> {selectedQuery.database}
                </p>
                <p>
                  <strong>Timestamp:</strong>{' '}
                  {new Date(selectedQuery.timestamp).toLocaleString()}
                </p>
                {selectedQuery.executionTime && (
                  <p>
                    <strong>Execution Time:</strong>{' '}
                    {selectedQuery.executionTime}ms
                  </p>
                )}
              </div>
              <div className="query-sql">
                <h4>SQL Query</h4>
                <pre>{selectedQuery.query}</pre>
              </div>
              {selectedQuery.parameters && (
                <div className="query-params">
                  <h4>Parameters</h4>
                  <pre>{JSON.stringify(selectedQuery.parameters, null, 2)}</pre>
                </div>
              )}
              {selectedQuery.result && (
                <div className="query-result">
                  <h4>Result</h4>
                  <pre>{JSON.stringify(selectedQuery.result, null, 2)}</pre>
                </div>
              )}
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
    </div>
  );
};
