import { useCallback } from 'react';
import { usePyodide } from './usePyodideContext';

export interface Table {
  name: string;
  columns: Column[];
}

export interface Column {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  defaultValue?: string;
}

export interface TableRow {
  [key: string]: string | number | null | boolean;
}

export function useDatabaseOperations() {
  const { getPyodideInstance } = usePyodide();

  const getTables = useCallback(async (): Promise<string[]> => {
    const pyodide = await getPyodideInstance();

    try {
      const result = pyodide.runPython(`
import sqlite3
from django.db import connection

# Get all table names from the database
cursor = connection.cursor()
cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
tables = [row[0] for row in cursor.fetchall()]
cursor.close()

tables
      `);

      return result.toJs();
    } catch (error) {
      console.error('Error getting tables:', error);
      return [];
    }
  }, [getPyodideInstance]);

  const getTableSchema = useCallback(
    async (tableName: string): Promise<Column[]> => {
      const pyodide = await getPyodideInstance();

      try {
        pyodide.globals.set('table_name', tableName);

        const result = pyodide.runPython(`
from django.db import connection

cursor = connection.cursor()
cursor.execute(f"PRAGMA table_info({table_name})")
columns_info = cursor.fetchall()
cursor.close()

columns = []
for col in columns_info:
    columns.append({
        'name': col[1],
        'type': col[2],
        'nullable': not col[3],
        'primaryKey': bool(col[5]),
        'defaultValue': col[4] if col[4] is not None else None
    })

columns
      `);

        return result.toJs();
      } catch (error) {
        console.error('Error getting table schema:', error);
        return [];
      }
    },
    [getPyodideInstance]
  );

  const getTableData = useCallback(
    async (tableName: string, limit: number = 100): Promise<TableRow[]> => {
      const pyodide = await getPyodideInstance();

      try {
        pyodide.globals.set('table_name', tableName);
        pyodide.globals.set('limit', limit);

        const result = pyodide.runPython(`
from django.db import connection

cursor = connection.cursor()
cursor.execute(f"SELECT * FROM {table_name} LIMIT {limit}")
rows = cursor.fetchall()

# Get column names
cursor.execute(f"PRAGMA table_info({table_name})")
columns_info = cursor.fetchall()
column_names = [col[1] for col in columns_info]
cursor.close()

# Convert rows to dictionaries
data = []
for row in rows:
    row_dict = {}
    for i, value in enumerate(row):
        if i < len(column_names):
            row_dict[column_names[i]] = value
    data.append(row_dict)

data
      `);

        return result.toJs();
      } catch (error) {
        console.error('Error getting table data:', error);
        return [];
      }
    },
    [getPyodideInstance]
  );

  const getTableCount = useCallback(
    async (tableName: string): Promise<number> => {
      const pyodide = await getPyodideInstance();

      try {
        pyodide.globals.set('table_name', tableName);

        const result = pyodide.runPython(`
from django.db import connection

cursor = connection.cursor()
cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
count = cursor.fetchone()[0]
cursor.close()

count
      `);

        return result;
      } catch (error) {
        console.error('Error getting table count:', error);
        return 0;
      }
    },
    [getPyodideInstance]
  );

  const executeQuery = useCallback(
    async (
      query: string
    ): Promise<{
      columns: string[];
      rows: (string | number | null | boolean)[][];
      error?: string;
    }> => {
      const pyodide = await getPyodideInstance();

      try {
        pyodide.globals.set('query', query);

        const result = pyodide.runPython(`
from django.db import connection

try:
    cursor = connection.cursor()
    cursor.execute(query)
    
    # Check if this is a SELECT query
    if query.strip().upper().startswith('SELECT'):
        rows = cursor.fetchall()
        columns = [desc[0] for desc in cursor.description] if cursor.description else []
        cursor.close()
        
        result = {
            'columns': columns,
            'rows': [list(row) for row in rows]
        }
    else:
        # For non-SELECT queries, just return affected rows count
        affected_rows = cursor.rowcount
        cursor.close()
        
        result = {
            'columns': ['Affected Rows'],
            'rows': [[affected_rows]]
        }
    
    result
except Exception as e:
    {
        'columns': [],
        'rows': [],
        'error': str(e)
    }
      `);

        return result.toJs();
      } catch (error) {
        return {
          columns: [],
          rows: [],
          error: String(error),
        };
      }
    },
    [getPyodideInstance]
  );

  const resetDatabase = useCallback(async (): Promise<void> => {
    const pyodide = await getPyodideInstance();

    try {
      pyodide.runPython(`
from django.db import connection

cursor = connection.cursor()

# Get all table names
cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
tables = [row[0] for row in cursor.fetchall()]

# Drop all tables
for table in tables:
    cursor.execute(f"DROP TABLE IF EXISTS {table}")

cursor.close()
      `);
    } catch (error) {
      console.error('Error resetting database:', error);
      throw error;
    }
  }, [getPyodideInstance]);

  return {
    getTables,
    getTableSchema,
    getTableData,
    getTableCount,
    executeQuery,
    resetDatabase,
  };
}
