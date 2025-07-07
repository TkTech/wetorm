import { loadPyodide, type PyodideInterface } from 'pyodide';

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
  pyodide.runPython(bootstrapCode || getDefaultBootstrap());

  return pyodide;
}

export function getDefaultBootstrap(): string {
  return `import os
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
        USE_I18N=True,
        USE_L10N=True,
        TIME_ZONE='UTC',
        TEMPLATES=[
            {
                'BACKEND': 'django.template.backends.django.DjangoTemplates',
                'DIRS': [],
                'APP_DIRS': True,
                'OPTIONS': {
                    'context_processors': [
                        'django.template.context_processors.debug',
                        'django.template.context_processors.request',
                        'django.contrib.auth.context_processors.auth',
                        'django.contrib.messages.context_processors.messages',
                    ],
                },
            },
        ],
        DEFAULT_AUTO_FIELD='django.db.models.BigAutoField',
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
    django.setup()`;
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
  const result = pyodide.runPython(`
import sys
import io
import time
import inspect
import traceback
from contextlib import redirect_stdout
from django.db import connection
from django.db.backends.signals import connection_created

# Capture stdout
captured_output = io.StringIO()

# Store the original user code for line tracing
user_code_lines = user_code.splitlines()

# Custom query logger to capture line numbers
class LineAwareQueryLogger:
    def __init__(self):
        self.queries = []
        self.original_execute = None
        self.original_executemany = None
    
    def patch_cursor(self):
        # Patch the connection's cursor creation to wrap execute methods
        original_cursor = connection.cursor
        
        def create_cursor_with_line_tracking(*args, **kwargs):
            cursor = original_cursor(*args, **kwargs)
            
            # Store original methods
            original_execute = cursor.execute
            original_executemany = cursor.executemany
            
            def execute_with_line_tracking(sql, params=None):
                line_info = self.get_user_code_line()
                start_time = time.time()
                try:
                    result = original_execute(sql, params)
                    execution_time = time.time() - start_time
                    
                    # Store enhanced query info
                    query_info = {
                        'sql': sql,
                        'time': f"{execution_time:.6f}",
                        'params': params,
                        'line_number': line_info.get('line_number'),
                        'source_context': line_info.get('source_context')
                    }
                    self.queries.append(query_info)
                    return result
                except Exception as e:
                    execution_time = time.time() - start_time
                    query_info = {
                        'sql': sql,
                        'time': f"{execution_time:.6f}",
                        'params': params,
                        'line_number': line_info.get('line_number'),
                        'source_context': line_info.get('source_context')
                    }
                    self.queries.append(query_info)
                    raise
            
            def executemany_with_line_tracking(sql, param_list):
                line_info = self.get_user_code_line()
                start_time = time.time()
                try:
                    result = original_executemany(sql, param_list)
                    execution_time = time.time() - start_time
                    
                    query_info = {
                        'sql': sql,
                        'time': f"{execution_time:.6f}",
                        'params': param_list,
                        'line_number': line_info.get('line_number'),
                        'source_context': line_info.get('source_context')
                    }
                    self.queries.append(query_info)
                    return result
                except Exception as e:
                    execution_time = time.time() - start_time
                    query_info = {
                        'sql': sql,
                        'time': f"{execution_time:.6f}",
                        'params': param_list,
                        'line_number': line_info.get('line_number'),
                        'source_context': line_info.get('source_context')
                    }
                    self.queries.append(query_info)
                    raise
            
            # Patch the cursor methods
            cursor.execute = execute_with_line_tracking
            cursor.executemany = executemany_with_line_tracking
            
            return cursor
        
        # Monkey patch connection cursor creation
        connection.cursor = create_cursor_with_line_tracking
    
    def get_user_code_line(self):
        """Extract line number and context from user code in the stack trace"""
        try:
            stack = inspect.stack()
            for frame_info in stack:
                # Look for frames that are executing user code
                if frame_info.filename == '<string>' and frame_info.function == '<module>':
                    line_number = frame_info.lineno
                    if 1 <= line_number <= len(user_code_lines):
                        return {
                            'line_number': line_number,
                            'source_context': user_code_lines[line_number - 1].strip()
                        }
                # Also check for frames in the 'run' function
                elif frame_info.filename == '<string>' and frame_info.function == 'run':
                    line_number = frame_info.lineno
                    if 1 <= line_number <= len(user_code_lines):
                        return {
                            'line_number': line_number,
                            'source_context': user_code_lines[line_number - 1].strip()
                        }
        except Exception:
            pass
        return {}

# Initialize line-aware query logger
query_logger = LineAwareQueryLogger()

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
        
        # Patch cursor for line tracking
        query_logger.patch_cursor()
        
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
        
        # Copy models and other important definitions to global namespace for REPL access
        for name, obj in namespace.items():
            if not name.startswith('__'):  # Skip special variables
                # Copy models, functions, and other user-defined objects to globals
                if (hasattr(obj, '__mro__') and 
                    any(base.__name__ == 'Model' and base.__module__ == 'django.db.models.base' 
                        for base in obj.__mro__[1:])) or callable(obj):
                    globals()[name] = obj
    
    result = captured_output.getvalue()
except Exception as e:
    result = f"Error: {str(e)}"

# Return both output and captured queries with line information
{
    'output': result,
    'queries': query_logger.queries
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
        sourceLineNumber: query.line_number,
        sourceContext: query.source_context,
      });
    });
  }

  return queryResult?.output || null;
}
