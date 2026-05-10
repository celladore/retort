import { describe, it, expect } from 'vitest';
import { threeWayMerge, normalizeForComparison } from '../scaffold-merge.mjs';

// ---------------------------------------------------------------------------
// threeWayMerge — exercises the git merge-file wrapper across all 3 outcomes.
// ---------------------------------------------------------------------------

describe('threeWayMerge', () => {
  it('returns merged content with hasConflicts:false on a clean merge', () => {
    const base = 'line A\nline B\nline C\n';
    // ours adds a header line, theirs appends a footer — non-overlapping edits
    const ours = 'HEADER\nline A\nline B\nline C\n';
    const theirs = 'line A\nline B\nline C\nFOOTER\n';

    const result = threeWayMerge(ours, base, theirs);

    expect(result).not.toBeNull();
    expect(result.hasConflicts).toBe(false);
    expect(result.merged).toContain('HEADER');
    expect(result.merged).toContain('FOOTER');
    expect(result.merged).toContain('line B');
  });

  it('returns hasConflicts:true with conflict markers on conflicting edits', () => {
    const base = 'line A\nline B\nline C\n';
    const ours = 'line A\nMINE\nline C\n';
    const theirs = 'line A\nTHEIRS\nline C\n';

    const result = threeWayMerge(ours, base, theirs);

    expect(result).not.toBeNull();
    expect(result.hasConflicts).toBe(true);
    // Conflict block should mention both sides via the labels passed to git
    expect(result.merged).toContain('YOUR_EDITS');
    expect(result.merged).toContain('NEW_TEMPLATE');
    // Either MINE or THEIRS (or both) must survive in the conflict block
    expect(result.merged).toMatch(/MINE|THEIRS/);
  });

  it('returns identity when ours == base == theirs (no-op merge)', () => {
    const content = 'unchanged\nunchanged\n';

    const result = threeWayMerge(content, content, content);

    expect(result).not.toBeNull();
    expect(result.hasConflicts).toBe(false);
    expect(result.merged).toBe(content);
  });

  it('returns the user version when only ours changed', () => {
    const base = 'a\nb\n';
    const ours = 'a\nUSER\n';
    const theirs = 'a\nb\n';

    const result = threeWayMerge(ours, base, theirs);

    expect(result).not.toBeNull();
    expect(result.hasConflicts).toBe(false);
    expect(result.merged).toBe(ours);
  });

  it('returns the template version when only theirs changed', () => {
    const base = 'a\nb\n';
    const ours = 'a\nb\n';
    const theirs = 'a\nTEMPLATE\n';

    const result = threeWayMerge(ours, base, theirs);

    expect(result).not.toBeNull();
    expect(result.hasConflicts).toBe(false);
    expect(result.merged).toBe(theirs);
  });
});

// ---------------------------------------------------------------------------
// normalizeForComparison — table-padding & trailing-whitespace canonicalisation
// ---------------------------------------------------------------------------

describe('normalizeForComparison', () => {
  it('strips trailing whitespace from every line', () => {
    const input = 'foo   \nbar\t \nbaz\n';
    const output = normalizeForComparison(input);

    expect(output).toBe('foo\nbar\nbaz');
  });

  it('trims trailing whitespace at end-of-document', () => {
    expect(normalizeForComparison('hello\n\n\n')).toBe('hello');
  });

  it('canonicalises a wide table separator row', () => {
    const input = '| col |  col2  |\n| --- | ------ |\n| a   |  b     |';
    const output = normalizeForComparison(input);

    // Separator collapses to |---| canonical form per column
    expect(output.split('\n')[1]).toBe('|-|-|');
  });

  it('preserves alignment markers (:--- / ---: / :---:) in separator rows', () => {
    const input = '| a | b | c |\n| :--- | ---: | :---: |\n| 1 | 2 | 3 |';
    const output = normalizeForComparison(input);

    // After collapsing dashes the alignment colons must remain.
    expect(output.split('\n')[1]).toBe('|:-|-:|:-:|');
  });

  it('normalises data-row cell padding to a single space either side', () => {
    const input = '|alpha|beta|\n|   tightly  packed   |   another   |';
    const output = normalizeForComparison(input);

    // Both rows should end up with " value " padding for inner cells.
    const rows = output.split('\n');
    expect(rows[0]).toBe('| alpha | beta |');
    expect(rows[1]).toBe('| tightly  packed | another |');
  });

  it('leaves non-table lines untouched apart from trailing whitespace', () => {
    const input = '# Heading\n\nA paragraph with two trailing spaces.  \n\nMore text.';
    const output = normalizeForComparison(input);

    expect(output).toBe('# Heading\n\nA paragraph with two trailing spaces.\n\nMore text.');
  });

  it('canonicalises a Prettier-padded table the same as a compact table', () => {
    const padded = '| Name  | Age |\n| ----- | --- |\n| Alice |  30 |\n| Bob   |  25 |';
    const compact = '|Name|Age|\n|---|---|\n|Alice|30|\n|Bob|25|';

    expect(normalizeForComparison(padded)).toBe(normalizeForComparison(compact));
  });

  it('does not break lines that contain pipes but are not table rows', () => {
    const line = 'echo "a | b | c"';
    expect(normalizeForComparison(line)).toBe(line);
  });

  it('handles empty string input', () => {
    expect(normalizeForComparison('')).toBe('');
  });

  it('handles single-line input', () => {
    expect(normalizeForComparison('only one line')).toBe('only one line');
  });

  it('handles input with only whitespace lines', () => {
    expect(normalizeForComparison('   \n\t\n')).toBe('');
  });
});
