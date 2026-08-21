/**
 * Guards the template corpus against a silent, self-inflicted corruption:
 * Prettier formats fenced code blocks inside Markdown, and a `{{var}}` sitting
 * in a ```yaml block parses as nested flow mappings. It rewrites it to
 * `{ { var } }`, which no longer matches the interpolation pattern — so the
 * variable stops substituting and the placeholder ships verbatim.
 *
 * This is not hypothetical. `claude/rules/pr-base-branch.md` shipped
 * `defaultBranch: { { defaultBranch } }` to every consuming repo: a rule whose
 * entire job is to tell agents which branch to target, displaying a mangled
 * placeholder instead of the branch name.
 *
 * The fix is a `<!-- prettier-ignore -->` before any fenced block holding an
 * interpolation. This test is what stops the next `prettier --write` from
 * quietly undoing it.
 */
import { readFileSync } from 'fs';
import { dirname, relative, resolve } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import { walkDir } from '../fs-utils.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENTKIT_ROOT = resolve(__dirname, '..', '..', '..', '..');
const TEMPLATES_DIR = resolve(AGENTKIT_ROOT, 'templates');

/**
 * Prettier's rewrite of `{{var}}`: an opening brace, whitespace, another brace,
 * an identifier, then the mirror image. Matching the identifier keeps this from
 * firing on legitimate nested YAML/JSON flow mappings such as `{ {} }`.
 */
const MANGLED_INTERPOLATION = /\{ \{ *[A-Za-z_][\w.]* *\} \}/;

async function collectTemplateFiles() {
  const files = [];
  for await (const file of walkDir(TEMPLATES_DIR)) {
    files.push(file);
  }
  return files;
}

describe('template interpolation integrity', () => {
  it('should find template files to check', async () => {
    // A silent empty glob would make every assertion below vacuously pass
    expect((await collectTemplateFiles()).length).toBeGreaterThan(0);
  });

  it('should contain no Prettier-mangled interpolation in any template', async () => {
    const offenders = [];

    for (const file of await collectTemplateFiles()) {
      let content;
      try {
        content = readFileSync(file, 'utf-8');
      } catch {
        continue; // unreadable/binary — nothing to interpolate
      }
      const lines = content.split(/\r?\n/);
      lines.forEach((line, i) => {
        if (MANGLED_INTERPOLATION.test(line)) {
          offenders.push(`${relative(AGENTKIT_ROOT, file)}:${i + 1}: ${line.trim()}`);
        }
      });
    }

    expect(
      offenders,
      `Prettier has rewritten {{var}} as { { var } } — the variable will ship unsubstituted.\n` +
        `Restore the braces and add <!-- prettier-ignore --> above the fenced block:\n` +
        offenders.join('\n')
    ).toEqual([]);
  });
});
