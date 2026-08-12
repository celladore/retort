import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Return runtime dependencies declared by .agentkit/package.json that are not installed.
 */
export function findMissingRuntimeDependencies(agentkitRoot) {
  const pkgPath = resolve(agentkitRoot, 'package.json');
  if (!existsSync(pkgPath)) return [];

  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  return Object.keys(pkg.dependencies || {}).filter(
    (name) => !existsSync(resolve(agentkitRoot, 'node_modules', name, 'package.json'))
  );
}
