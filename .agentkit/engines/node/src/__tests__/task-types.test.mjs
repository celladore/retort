import { describe, expect, it } from 'vitest';
import { VALID_TASK_TYPES } from '../task-types.mjs';

describe('VALID_TASK_TYPES', () => {
  it('contains the expected core task types', () => {
    expect(VALID_TASK_TYPES).toContain('implement');
    expect(VALID_TASK_TYPES).toContain('review');
    expect(VALID_TASK_TYPES).toContain('plan');
    expect(VALID_TASK_TYPES).toContain('investigate');
    expect(VALID_TASK_TYPES).toContain('test');
    expect(VALID_TASK_TYPES).toContain('document');
  });

  it('contains exactly the expected set of task types', () => {
    const expected = ['implement', 'review', 'plan', 'investigate', 'test', 'document'];
    expect(VALID_TASK_TYPES).toHaveLength(expected.length);
    expect(VALID_TASK_TYPES).toEqual(expect.arrayContaining(expected));
  });

  it('is frozen to prevent accidental modification', () => {
    expect(Object.isFrozen(VALID_TASK_TYPES)).toBe(true);
  });

  it('throws an error when trying to mutate the array', () => {
    expect(() => {
      // @ts-expect-error - testing invalid mutation
      VALID_TASK_TYPES.push('new-task');
    }).toThrow(TypeError);

    expect(() => {
      // @ts-expect-error - testing invalid mutation
      VALID_TASK_TYPES[0] = 'modified';
    }).toThrow(TypeError);
  });
});
