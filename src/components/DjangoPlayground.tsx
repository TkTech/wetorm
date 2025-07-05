import React, { useState } from 'react';
import { runDjangoCode } from '../services/pyodide';

export const DjangoPlayground: React.FC = () => {
  const [code, setCode] = useState(`from django.db import models

class Person(models.Model):
    name = models.CharField(max_length=100)

    def __str__(self):
        return self.name

def run():
    instance = Person.objects.create(name='John Doe')
    print(f'Created: {instance}')
    
    # Show all persons
    for person in Person.objects.all():
        print(f'Person: {person}')
        
    # Query example
    johns = Person.objects.filter(name__contains='John')
    print(f'Found {johns.count()} people with "John" in their name')
`);
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);

  const runCode = async () => {
    setIsRunning(true);
    setOutput('');

    try {
      const result = await runDjangoCode(code);
      setOutput(result || 'Code executed successfully');
    } catch (error) {
      setOutput(`Error: ${error}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="django-playground">
      <div className="playground-header">
        <h2>Django ORM Playground</h2>
        <button onClick={runCode} disabled={isRunning}>
          {isRunning ? 'Running...' : 'Run Code'}
        </button>
      </div>

      <div className="playground-content">
        <div className="code-editor">
          <h3>Django Code</h3>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            rows={20}
            cols={80}
            placeholder="Enter your Django ORM code here..."
          />
        </div>

        <div className="output-panel">
          <h3>Output</h3>
          <pre className="output">{output}</pre>
        </div>
      </div>
    </div>
  );
};
