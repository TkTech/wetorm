interface GistFile {
  filename: string;
  content: string;
  raw_url: string;
}

interface GistResponse {
  files: Record<string, GistFile>;
  description: string;
}

export function getGistIdFromUrl(): string | null {
  const urlParams = new URLSearchParams(window.location.search);
  const gistParam = urlParams.get('gist');

  if (!gistParam) return null;

  // Handle different gist URL formats:
  // - https://gist.github.com/username/gist_id
  // - gist_id (just the ID)
  const gistIdMatch = gistParam.match(
    /(?:gist\.github\.com\/[^/]+\/)?([a-f0-9]+)/
  );
  return gistIdMatch ? gistIdMatch[1] : null;
}

export async function fetchGistContent(gistId: string): Promise<string> {
  try {
    const response = await fetch(`https://api.github.com/gists/${gistId}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch gist: ${response.status}`);
    }

    const gistData: GistResponse = await response.json();

    // Get the first file's content (or look for a Python file)
    const files = Object.values(gistData.files);
    const pythonFile = files.find(
      (file) =>
        file.filename.endsWith('.py') || file.filename.endsWith('.python')
    );

    const targetFile = pythonFile || files[0];

    if (!targetFile) {
      throw new Error('No files found in gist');
    }

    return targetFile.content;
  } catch (error) {
    console.error('Error fetching gist:', error);
    throw new Error(
      `Failed to load gist: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export function createGistUrl(gistId: string): string {
  const currentUrl = new URL(window.location.href);
  currentUrl.searchParams.set('gist', gistId);
  return currentUrl.toString();
}
