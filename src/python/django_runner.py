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
        
        for name, obj in namespace.items():
            if isinstance(obj, type) and hasattr(obj, '_meta'):
                if not hasattr(obj._meta, 'app_label') or obj._meta.app_label is None:
                    obj._meta.app_label = 'wetorm'
        
        # Clear existing queries and enable query logging
        connection.queries_log.clear()
        
        # Patch cursor for line tracking
        query_logger.patch_cursor()
        
        from django.db.migrations.autodetector import MigrationAutodetector
        from django.db.migrations.executor import MigrationExecutor
        from django.db.migrations.loader import MigrationLoader
        from django.db.migrations.state import ProjectState, ModelState
        from django.db.migrations.questioner import MigrationQuestioner
        from django.apps import apps
        
        loader = MigrationLoader(connection)
        current_state = loader.project_state()
        new_state = ProjectState.from_apps(apps)
        
        detector = MigrationAutodetector(
            current_state,
            new_state,
            questioner=MigrationQuestioner(specified_apps={'wetorm'}),
        )
        
        changes = detector.changes(graph=loader.graph, convert_apps={'wetorm'})
        
        executor = MigrationExecutor(connection)
        for app_label, migrations_list in changes.items():
            for migration in migrations_list:
                executor.loader.graph.add_node(
                    (app_label, migration.name),
                    migration
                )
                
        # Build target plan
        targets = [
            (app_label, migration.name)
            for app_label, migrations_list in changes.items()
            for migration in migrations_list
        ]

        # Apply migrations
        executor.migrate(targets)

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