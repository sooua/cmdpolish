/**
 * Repair heredoc closing delimiters so the output is copy-paste runnable.
 *
 * Bash requires the closing delimiter of a heredoc to sit at column 0
 * (no leading whitespace) — unless the `<<-` form is used, which only strips
 * leading *tabs*. When content is pasted from an indented context (docs,
 * Markdown, chat), the closing `EOF` often inherits that indentation, which
 * silently breaks the command: the indented delimiter is read as body text and
 * the heredoc never terminates.
 *
 * This pass is conservative: for each heredoc it first looks for a delimiter
 * line that is already valid. Only when none exists does it strip the leading
 * whitespace off a line whose trimmed text equals the delimiter, so heredocs
 * that legitimately contain an indented delimiter as body data are left alone.
 */

// Matches an opener like  <<EOF  <<-EOF  <<'EOF'  << "EOF"  <<-"EOF"
const OPENER = /<<(-?)\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\2/g;

interface Pending {
  delim: string;
  /** `<<-` form: the closing delimiter may be preceded by tabs. */
  dashed: boolean;
}

export function normalizeHeredocTerminators(text: string): string {
  const lines = text.split("\n");
  let i = 0;

  while (i < lines.length) {
    // Collect every heredoc opened on this line, in order (FIFO bodies follow).
    const pending: Pending[] = [];
    OPENER.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = OPENER.exec(lines[i])) !== null) {
      pending.push({ delim: m[3], dashed: m[1] === "-" });
    }
    i += 1;

    // Resolve each heredoc body against the lines that follow.
    for (const { delim, dashed } of pending) {
      let fixIdx = -1; // first repairable (indented) terminator candidate
      let j = i;
      for (; j < lines.length; j += 1) {
        const line = lines[j];
        if (isValidTerminator(line, delim, dashed)) {
          break; // already correct — nothing to repair
        }
        if (fixIdx === -1 && line.trim() === delim) {
          fixIdx = j; // remember the first indented match as a fallback
        }
      }

      if (j >= lines.length && fixIdx !== -1) {
        // No valid terminator found, but an indented one exists: repair it.
        lines[fixIdx] = delim;
        j = fixIdx;
      }

      // Continue scanning after this heredoc's terminator for the next body.
      i = Math.min(lines.length, j + 1);
    }
  }

  return lines.join("\n");
}

function isValidTerminator(line: string, delim: string, dashed: boolean): boolean {
  // `<<-` allows leading tabs only; plain form requires column 0.
  return dashed ? line.replace(/^\t+/, "") === delim : line === delim;
}
