import { useState, useEffect } from 'react';
import { getTables, getTableSchema, getTableData, getTableCount, resetDatabase, type Column, type TableRow } from '../services/databaseOperations';

interface DatabaseBrowserProps {
  refreshTrigger?: number;
}

export function DatabaseBrowser({ refreshTrigger = 0 }: DatabaseBrowserProps) {
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableSchema, setTableSchema] = useState<Column[]>([]);
  const [tableData, setTableData] = useState<TableRow[]>([]);
  const [tableCount, setTableCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load tables on component mount and when refresh is triggered
  useEffect(() => {
    loadTables();
  }, [refreshTrigger]);

  // Refresh selected table data when refresh is triggered
  useEffect(() => {
    if (selectedTable && refreshTrigger > 0) {
      handleTableSelect(selectedTable);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger]); // Intentionally excluding selectedTable and handleTableSelect to avoid infinite loops

  const loadTables = async () => {
    try {
      setError(null);
      const tableNames = await getTables();
      setTables(tableNames);
    } catch (err) {
      setError('Failed to load tables');
      console.error('Error loading tables:', err);
    }
  };

  const handleTableSelect = async (tableName: string) => {
    setSelectedTable(tableName);
    setLoading(true);
    setError(null);
    
    try {
      // Load schema and data in parallel
      const [schema, data, count] = await Promise.all([
        getTableSchema(tableName),
        getTableData(tableName, 100),
        getTableCount(tableName)
      ]);
      
      setTableSchema(schema);
      setTableData(data);
      setTableCount(count);
    } catch (err) {
      setError('Failed to load table data');
      console.error('Error loading table data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleResetDatabase = async () => {
    if (confirm('Are you sure you want to reset the database? This will delete all tables and data.')) {
      try {
        setError(null);
        setLoading(true);
        await resetDatabase();
        
        // Clear local state
        setTables([]);
        setSelectedTable(null);
        setTableSchema([]);
        setTableData([]);
        setTableCount(0);
        
        // Reload tables (should be empty now)
        await loadTables();
      } catch (err) {
        setError('Failed to reset database');
        console.error('Error resetting database:', err);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="database-browser">
      <div className="db-header">
        <h3>Database Browser</h3>
        <div className="db-header-actions">
          {error && <div className="error-message">{error}</div>}
          <button className="header-button reset-button" onClick={handleResetDatabase}>
            Reset DB
          </button>
        </div>
      </div>
      
      <div className="db-content">
        <div className="tables-list">
          <h4>Tables ({tables.length})</h4>
          <div className="table-items">
            {tables.map(tableName => (
              <div
                key={tableName}
                className={`table-item ${selectedTable === tableName ? 'selected' : ''}`}
                onClick={() => handleTableSelect(tableName)}
              >
                {tableName}
              </div>
            ))}
            {tables.length === 0 && (
              <div className="empty-tables">No tables found. Run some Django code to create tables.</div>
            )}
          </div>
        </div>

        <div className="table-details">
          {selectedTable ? (
            <>
              <div className="schema-section">
                <h4>Schema: {selectedTable}</h4>
                <div className="schema-table">
                  <div className="schema-header">
                    <span>Column</span>
                    <span>Type</span>
                    <span>Nullable</span>
                    <span>Primary Key</span>
                  </div>
                  {tableSchema.map(column => (
                    <div key={column.name} className="schema-row">
                      <span>{column.name}</span>
                      <span>{column.type}</span>
                      <span>{column.nullable ? 'YES' : 'NO'}</span>
                      <span>{column.primaryKey ? 'YES' : 'NO'}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="data-section">
                <h4>Data ({tableCount} total rows, showing {tableData.length})</h4>
                {loading ? (
                  <div className="loading">Loading...</div>
                ) : (
                  <div className="data-table">
                    {tableData.length > 0 ? (
                      <>
                        <div className="data-header">
                          {Object.keys(tableData[0]).map(key => (
                            <span key={key}>{key}</span>
                          ))}
                        </div>
                        {tableData.map((row, index) => (
                          <div key={index} className="data-row">
                            {Object.values(row).map((value, cellIndex) => (
                              <span key={cellIndex}>{value === null ? 'NULL' : String(value)}</span>
                            ))}
                          </div>
                        ))}
                      </>
                    ) : (
                      <div className="empty-data">No data available</div>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="no-table-selected">
              Select a table to view its schema and data
            </div>
          )}
        </div>
      </div>
    </div>
  );
}