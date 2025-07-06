import { initializePyodide } from './pyodide';

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

export async function getTables(): Promise<string[]> {
  const pyodide = await initializePyodide();

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
}

export async function getTableSchema(tableName: string): Promise<Column[]> {
  const pyodide = await initializePyodide();

  try {
    pyodide.globals.set('table_name', tableName);

    const result = pyodide.runPython(`
from django.db import connection

cursor = connection.cursor()
cursor.execute(f"PRAGMA table_info({table_name})")
columns_info = cursor.fetchall()
cursor.close()

# Convert to our column format
columns = []
for col_info in columns_info:
    cid, name, type_name, not_null, default_value, pk = col_info
    columns.append({
        'name': name,
        'type': type_name,
        'nullable': not not_null,
        'primaryKey': bool(pk),
        'defaultValue': default_value
    })

columns
    `);

    return result.toJs();
  } catch (error) {
    console.error('Error getting table schema:', error);
    return [];
  }
}

export async function getTableData(
  tableName: string,
  limit: number = 100
): Promise<TableRow[]> {
  const pyodide = await initializePyodide();

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
}

export async function getTableCount(tableName: string): Promise<number> {
  const pyodide = await initializePyodide();

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
}

export async function executeQuery(
  query: string
): Promise<{
  columns: string[];
  rows: (string | number | null | boolean)[][];
  error?: string;
}> {
  const pyodide = await initializePyodide();

  try {
    pyodide.globals.set('query', query);

    const result = pyodide.runPython(`
from django.db import connection

try:
    cursor = connection.cursor()
    cursor.execute(query)
    
    # For SELECT queries, get results
    if query.strip().upper().startswith('SELECT'):
        rows = cursor.fetchall()
        columns = [desc[0] for desc in cursor.description] if cursor.description else []
        result = {
            'columns': columns,
            'rows': rows,
        }
    else:
        # For other queries (INSERT, UPDATE, DELETE), just return row count
        result = {
            'columns': ['rows_affected'],
            'rows': [[cursor.rowcount]],
        }
    
    cursor.close()
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
}

export async function resetDatabase(): Promise<void> {
  const pyodide = await initializePyodide();

  try {
    pyodide.runPython(`
from django.db import connection

# Get all user tables (excluding Django system tables)
cursor = connection.cursor()
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
}
