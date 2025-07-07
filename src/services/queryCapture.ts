export interface QueryInfo {
  id: string;
  query: string;
  database: 'postgresql' | 'sqlite';
  timestamp: number;
  executionTime?: number;
  parameters?: unknown[];
  result?: unknown;
  error?: string;
  queryType?: 'DDL' | 'DML';
  sourceLineNumber?: number;
  sourceContext?: string;
  tag?: string;
}

class QueryCapture {
  private queries: QueryInfo[] = [];
  private listeners: ((query: QueryInfo) => void)[] = [];

  captureQuery(query: QueryInfo): void {
    this.queries.push(query);
    this.listeners.forEach((listener) => listener(query));
  }

  getQueries(): QueryInfo[] {
    return [...this.queries];
  }

  clearQueries(): void {
    this.queries = [];
  }

  onQuery(listener: (query: QueryInfo) => void): void {
    this.listeners.push(listener);
  }

  removeListener(listener: (query: QueryInfo) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }
}

export const queryCapture = new QueryCapture();
