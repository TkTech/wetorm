import { loadPyodide, type PyodideInterface } from 'pyodide';

interface DjangoQuery {
  sql: string;
  time: string;
  params?: unknown[];
}

interface DjangoQueryResult {
  output: string;
  queries: DjangoQuery[];
}

let pyodide: PyodideInterface | null = null;

export async function initializePyodide(): Promise<PyodideInterface> {
  if (pyodide) return pyodide;

  pyodide = await loadPyodide({
    indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.28.0/full/',
  });

  await pyodide.loadPackage(['micropip', 'sqlite3']);
  await pyodide.runPythonAsync(`
    import micropip
    await micropip.install('django')
  `);

  pyodide.runPython(`
    import os
    import sys
    import types
    
    os.environ.setdefault('DJANGO_ALLOW_ASYNC_UNSAFE', 'true')
    
    # Create a fake wetorm module
    wetorm_module = types.ModuleType('wetorm')
    wetorm_module.__file__ = '<wetorm>'
    wetorm_module.__path__ = []
    sys.modules['wetorm'] = wetorm_module
    
    # Set up Django configuration
    from django.conf import settings
    
    if not settings.configured:
        settings.configure(
            DATABASES={
                'default': {
                    'ENGINE': 'django.db.backends.sqlite3',
                    'NAME': ':memory:',
                }
            },
            INSTALLED_APPS=[
                'django.contrib.contenttypes',
                'django.contrib.auth',
                'wetorm',
            ],
            SECRET_KEY='wetorm-development-key',
            DEBUG=True,
            USE_TZ=False,
            LOGGING={
                'version': 1,
                'disable_existing_loggers': False,
                'handlers': {
                    'console': {
                        'class': 'logging.StreamHandler',
                    },
                },
                'loggers': {
                    'django.db.backends': {
                        'handlers': ['console'],
                        'level': 'DEBUG',
                    },
                },
            }
        )
        
        import django
        django.setup()
  `);

  return pyodide;
}

export async function runDjangoCode(code: string): Promise<string> {
  if (!pyodide) {
    await initializePyodide();
  }

  // Set the code as a Python variable first to avoid string escaping issues
  pyodide!.globals.set('user_code', code);

  // Set up captured queries array and return both output and queries
  pyodide!.globals.set('captured_queries', []);

  // Run Django code in synchronous mode with automatic setup and query capture
  const result = pyodide!.runPython(`
import sys
import io
import time
from contextlib import redirect_stdout
from django.db import connection

# Capture stdout
captured_output = io.StringIO()

try:
    with redirect_stdout(captured_output):
        # Execute user code in a clean namespace with wetorm app context
        namespace = {'__name__': 'wetorm.models'}
        exec(user_code, namespace)
        
        # Auto-create tables for any models defined
        models_to_create = []
        for name, obj in namespace.items():
            if (hasattr(obj, '__mro__') and 
                any(base.__name__ == 'Model' and base.__module__ == 'django.db.models.base' 
                    for base in obj.__mro__[1:])):
                # Auto-set app_label if not explicitly set
                if not hasattr(obj._meta, 'app_label') or obj._meta.app_label is None:
                    obj._meta.app_label = 'wetorm'
                models_to_create.append(obj)
        
        # Clear existing queries and enable query logging
        connection.queries_log.clear()
        
        # Create tables for the models (this will generate DDL queries that get captured)
        if models_to_create:
            with connection.schema_editor() as schema_editor:
                for model in models_to_create:
                    try:
                        schema_editor.create_model(model)
                    except Exception as e:
                        # Table might already exist, ignore
                        pass
        
        # Run the 'run' function if it exists
        if 'run' in namespace and callable(namespace['run']):
            namespace['run']()
    
    result = captured_output.getvalue()
except Exception as e:
    result = f"Error: {str(e)}"

# Return both output and captured queries
{
    'output': result,
    'queries': list(connection.queries_log)
}
  `);

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
      });
    });
  }

  return queryResult?.output || (result as string);
}

export function getPyodideInstance(): PyodideInterface | null {
  return pyodide;
}
