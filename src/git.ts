import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface LineDiff {
  added: number;
  deleted: number;
}

export interface TrackedFile {
  basename: string;
  fullPath: string;
  type: 'modified' | 'added' | 'deleted';
  lineDiff?: LineDiff;
}

export interface FileStats {
  modified: number;
  added: number;
  deleted: number;
  untracked: number;
  trackedFiles: TrackedFile[];
}

export interface GitStatus {
  branch: string;
  isDirty: boolean;
  ahead: number;
  behind: number;
  fileStats?: FileStats;
  lineDiff?: LineDiff;
  branchUrl?: string; // GitHub/GitLab URL for the current branch
}

export async function getGitBranch(cwd?: string): Promise<string | null> {
  if (!cwd) return null;

  try {
    const { stdout } = await execFileAsync(
      'git',
      ['rev-parse', '--abbrev-ref', 'HEAD'],
      { cwd, timeout: 1000, encoding: 'utf8' }
    );
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

export async function getGitStatus(cwd?: string): Promise<GitStatus | null> {
  if (!cwd) return null;

  try {
    // Get branch name
    const { stdout: branchOut } = await execFileAsync(
      'git',
      ['rev-parse', '--abbrev-ref', 'HEAD'],
      { cwd, timeout: 1000, encoding: 'utf8' }
    );
    const branch = branchOut.trim();
    if (!branch) return null;

    // Check for dirty state and parse file stats
    let isDirty = false;
    let fileStats: FileStats | undefined;
    let lineDiff: LineDiff | undefined;
    try {
      const { stdout: statusOut } = await execFileAsync(
        'git',
        ['--no-optional-locks', 'status', '--porcelain'],
        { cwd, timeout: 1000, encoding: 'utf8' }
      );
      const trimmed = statusOut.trim();
      isDirty = trimmed.length > 0;
      if (isDirty) {
        fileStats = parseFileStats(trimmed);
      }
    } catch {
      // Ignore errors, assume clean
    }

    // Get per-file and total line diff stats
    if (isDirty) {
      try {
        const { stdout: numstatOut } = await execFileAsync(
          'git',
          ['diff', '--numstat', 'HEAD'],
          { cwd, timeout: 1000, encoding: 'utf8' }
        );
        let linesAdded = 0;
        let linesDeleted = 0;
        const fileLineDiffs = new Map<string, LineDiff>();
        for (const line of numstatOut.trim().split('\n').filter(Boolean)) {
          const parts = line.split('\t');
          if (parts.length >= 3) {
            const la = parseInt(parts[0], 10) || 0;
            const ld = parseInt(parts[1], 10) || 0;
            const fp = parts[2];
            linesAdded += la;
            linesDeleted += ld;
            if (la > 0 || ld > 0) fileLineDiffs.set(fp, { added: la, deleted: ld });
          }
        }
        if (linesAdded > 0 || linesDeleted > 0) {
          lineDiff = { added: linesAdded, deleted: linesDeleted };
        }
        // Attach per-file line diffs to tracked files
        if (fileStats) {
          for (const tf of fileStats.trackedFiles) {
            tf.lineDiff = fileLineDiffs.get(tf.fullPath);
          }
        }
      } catch {
        // Ignore errors
      }
    }

    // Get ahead/behind counts
    let ahead = 0;
    let behind = 0;
    try {
      const { stdout: revOut } = await execFileAsync(
        'git',
        ['rev-list', '--left-right', '--count', '@{upstream}...HEAD'],
        { cwd, timeout: 1000, encoding: 'utf8' }
      );
      const parts = revOut.trim().split(/\s+/);
      if (parts.length === 2) {
        behind = parseInt(parts[0], 10) || 0;
        ahead = parseInt(parts[1], 10) || 0;
      }
    } catch {
      // No upstream or error, keep 0/0
    }

    // Get remote URL and build branch URL
    let branchUrl: string | undefined;
    try {
      const { stdout: remoteOut } = await execFileAsync(
        'git', ['remote', 'get-url', 'origin'],
        { cwd, timeout: 1000, encoding: 'utf8' }
      );
      const remote = remoteOut.trim();
      // Convert SSH or HTTPS remote to a browser URL for the branch
      const httpsBase = remote
        .replace(/^git@([^:]+):/, 'https://$1/')
        .replace(/\.git$/, '');
      if (httpsBase.startsWith('https://')) {
        branchUrl = `${httpsBase}/tree/${branch}`;
      }
    } catch {
      // No remote or error — skip
    }

    return { branch, isDirty, ahead, behind, fileStats, lineDiff, branchUrl };
  } catch {
    return null;
  }
}

/**
 * Parse git status --porcelain output and count file stats (Starship-compatible format)
 * Status codes: M=modified, A=added, D=deleted, ??=untracked
 */
function parseFileStats(porcelainOutput: string): FileStats {
  const stats: FileStats = { modified: 0, added: 0, deleted: 0, untracked: 0, trackedFiles: [] };
  const lines = porcelainOutput.split('\n').filter(Boolean);

  for (const line of lines) {
    if (line.length < 2) continue;

    const index = line[0];    // staged status
    const worktree = line[1]; // unstaged status
    // Porcelain format: "XY PATH" or "XY ORIG -> PATH" for renames.
    // Skip 2-char status code then trim separator whitespace (handles
    // staged-only files where Y=" " collapses with the separator space).
    const fullPath = (line.slice(2).trimStart().split(' -> ').pop() ?? '');
    const basename = fullPath.split('/').pop() ?? fullPath;

    if (line.startsWith('??')) {
      stats.untracked++;
    } else if (index === 'A') {
      stats.added++;
      stats.trackedFiles.push({ basename, fullPath, type: 'added' });
    } else if (index === 'D' || worktree === 'D') {
      stats.deleted++;
      stats.trackedFiles.push({ basename, fullPath, type: 'deleted' });
    } else if (index === 'M' || worktree === 'M' || index === 'R' || index === 'C') {
      stats.modified++;
      stats.trackedFiles.push({ basename, fullPath, type: 'modified' });
    }
  }

  return stats;
}
