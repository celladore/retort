import { describe, it, expect } from 'vitest';
import { TREE } from './conversation-tree.js';

describe('TREE', () => {
  it('should have a root node', () => {
    expect(TREE.root).toBeDefined();
    expect(TREE.root.question).toBeTruthy();
  });

  it('should have options on every node', () => {
    for (const [id, node] of Object.entries(TREE)) {
      expect(node.options.length).toBeGreaterThan(0);
    }
  });

  it('should have valid next references', () => {
    for (const [id, node] of Object.entries(TREE)) {
      for (const option of node.options) {
        if (option.next) {
          expect(TREE[option.next]).toBeDefined();
        }
      }
    }
  });

  it('should have a command or next on every option', () => {
    for (const [id, node] of Object.entries(TREE)) {
      for (const option of node.options) {
        const hasTarget = option.command || option.next;
        expect(hasTarget).toBeTruthy();
      }
    }
  });

  it('should have unique values per node', () => {
    for (const [id, node] of Object.entries(TREE)) {
      const values = node.options.map((o) => o.value);
      expect(new Set(values).size).toBe(values.length);
    }
  });

  it('all leaf nodes should have commands starting with /', () => {
    for (const [id, node] of Object.entries(TREE)) {
      for (const option of node.options) {
        if (option.command) {
          expect(option.command.startsWith('/')).toBe(true);
        }
      }
    }
  });

  it('all leaf nodes should have hint text', () => {
    for (const [id, node] of Object.entries(TREE)) {
      for (const option of node.options) {
        if (option.command) {
          expect(option.hint).toBeTruthy();
        }
      }
    }
  });
});
