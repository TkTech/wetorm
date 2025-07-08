interface GistFile {
  filename: string;
  content: string;
  raw_url: string;
}

interface GistResponse {
  files: Record<string, GistFile>;
  description: string;
}

export type GistContents = Record<string, string>;

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

export async function fetchGistContent(gistId: string): Promise<GistContents> {
  try {
    const response = await fetch(`https://api.github.com/gists/${gistId}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch gist: ${response.status}`);
    }

    const gistData: GistResponse = await response.json();

    const result: GistContents = {};

    // Convert all files to filename -> content mapping
    Object.values(gistData.files).forEach((file) => {
      result[file.filename] = file.content;
    });

    return result;
  } catch (error) {
    console.error('Error fetching gist:', error);
    throw new Error(
      `Failed to load gist: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
