import { describe, it, expect } from 'vitest';
import { buildCommandVars } from '../var-builders.mjs';

describe('buildCommandVars — Phase 2 skill metadata fields', () => {
  it('defaults disableModelInvocation to false when the field is absent', () => {
    const result = buildCommandVars({ name: 'foo', description: 'd' }, {});
    expect(result.disableModelInvocation).toBe(false);
  });

  it('defaults disableModelInvocation to false when the field is not strictly true', () => {
    const result = buildCommandVars(
      { name: 'foo', description: 'd', disableModelInvocation: 'true' },
      {}
    );
    expect(result.disableModelInvocation).toBe(false);
  });

  it('passes disableModelInvocation through when set to true', () => {
    const result = buildCommandVars(
      { name: 'zoom-out', description: 'd', disableModelInvocation: true },
      {}
    );
    expect(result.disableModelInvocation).toBe(true);
  });

  it('defaults commandCategory to "meta" when the field is absent', () => {
    const result = buildCommandVars({ name: 'foo', description: 'd' }, {});
    expect(result.commandCategory).toBe('meta');
  });

  it('defaults commandCategory to "meta" when the field is the empty string', () => {
    const result = buildCommandVars({ name: 'foo', description: 'd', category: '' }, {});
    expect(result.commandCategory).toBe('meta');
  });

  it('passes commandCategory through when explicitly declared', () => {
    const result = buildCommandVars({ name: 'tdd', description: 'd', category: 'engineering' }, {});
    expect(result.commandCategory).toBe('engineering');
  });

  it('preserves all existing variables alongside the new fields', () => {
    const result = buildCommandVars(
      {
        name: 'foo',
        description: '  trim me  ',
        disableModelInvocation: true,
        category: 'productivity',
      },
      { commandPrefix: 'mycmd', otherVar: 42 }
    );
    expect(result).toMatchObject({
      commandName: 'foo',
      commandPrefixedName: 'mycmd-foo',
      commandDescription: 'trim me',
      disableModelInvocation: true,
      commandCategory: 'productivity',
      otherVar: 42,
    });
  });
});
