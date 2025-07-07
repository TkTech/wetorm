import { loadPyodide, type PyodideInterface } from 'pyodide';
import defaultBootstrapCode from '../python/bootstrap.py?raw';
import djangoRunnerCode from '../python/django_runner.py?raw';

interface DjangoQuery {
  sql: string;
  time: string;
  params?: unknown[];
  line_number?: number;
  source_context?: string;
}

interface DjangoQueryResult {
  output: string;
  queries: DjangoQuery[];
}

export async function initializePyodide(
  bootstrapCode?: string
): Promise<PyodideInterface> {
  const pyodide = await loadPyodide({
    indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.28.0/full/',
  });

  await pyodide.loadPackage(['micropip', 'sqlite3']);
  await pyodide.runPythonAsync(`
    import micropip
    await micropip.install('django')
  `);

  // Use custom bootstrap code if provided, otherwise use default
  pyodide.runPython(bootstrapCode || defaultBootstrapCode);

  return pyodide;
}

export function getDefaultBootstrap(): string {
  return defaultBootstrapCode;
}

export async function runDjangoCode(
  code: string,
  pyodideInstance?: PyodideInterface
): Promise<string | null> {
  const pyodide = pyodideInstance || (await initializePyodide());

  // Set the code as a Python variable first to avoid string escaping issues
  pyodide.globals.set('user_code', code);

  // Set up captured queries array and return both output and queries
  pyodide.globals.set('captured_queries', []);

  // Run Django code in synchronous mode with automatic setup and query capture
  const result = pyodide.runPython(djangoRunnerCode);

  // Extract queries and send them to the query capture system
  const queryResult = result as DjangoQueryResult;
  if (queryResult && queryResult.queries) {
    const { queryCapture } = await import('./queryCapture');
    queryResult.queries.forEach((query: DjangoQuery, index: number) => {
      // Determine query type
      const sql = query.sql.trim().toUpperCase();
      let queryType: 'DDL' | 'DML' = 'DML'; // Data Manipulation Language (SELECT, INSERT, UPDATE, DELETE)
      if (
        sql.startsWith('CREATE') ||
        sql.startsWith('ALTER') ||
        sql.startsWith('DROP')
      ) {
        queryType = 'DDL'; // Data Definition Language
      }

      queryCapture.captureQuery({
        id: `query-${Date.now()}-${index}`,
        query: query.sql,
        database: 'sqlite',
        timestamp: Date.now(),
        executionTime: parseFloat(query.time) * 1000, // Convert to milliseconds
        parameters: query.params || [],
        queryType: queryType,
        sourceLineNumber: query.line_number,
        sourceContext: query.source_context,
      });
    });
  }

  return queryResult?.output || null;
}
