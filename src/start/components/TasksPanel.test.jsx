import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import TasksPanel from './TasksPanel.jsx';

// Mock the lib module so tests never touch the filesystem
vi.mock('../lib/tasks.js', () => ({
  getActiveTasks: vi.fn(),
}));

import { getActiveTasks } from '../lib/tasks.js';

beforeEach(() => {
  vi.resetAllMocks();
});

/** Convenience factory for TaskInfo objects */
function makeTask(overrides = {}) {
  return {
    id: 'task-001',
    title: 'Do something',
    status: 'working',
    priority: 'P2',
    assignees: ['BACKEND'],
    type: 'implement',
    ...overrides,
  };
}

describe('TasksPanel', () => {
  it('should render nothing when there are no active tasks', () => {
    getActiveTasks.mockReturnValue([]);

    const { lastFrame } = render(React.createElement(TasksPanel, {}));
    expect(lastFrame()).toBe('');
  });

  it('should show the section heading when tasks are present', () => {
    getActiveTasks.mockReturnValue([makeTask()]);

    const { lastFrame } = render(React.createElement(TasksPanel, {}));
    expect(lastFrame()).toContain('Active tasks');
  });

  it('should display the task title', () => {
    getActiveTasks.mockReturnValue([makeTask({ title: 'Add pagination endpoint' })]);

    const { lastFrame } = render(React.createElement(TasksPanel, {}));
    expect(lastFrame()).toContain('Add pagination endpoint');
  });

  it('should show working status label for working tasks', () => {
    getActiveTasks.mockReturnValue([makeTask({ status: 'working' })]);

    const { lastFrame } = render(React.createElement(TasksPanel, {}));
    expect(lastFrame()).toContain('working');
  });

  it('should show input-required status label', () => {
    getActiveTasks.mockReturnValue([makeTask({ status: 'input-required', title: 'Blocked task' })]);

    const { lastFrame } = render(React.createElement(TasksPanel, {}));
    expect(lastFrame()).toContain('input');
    expect(lastFrame()).toContain('Blocked task');
  });

  it('should show submitted status label', () => {
    getActiveTasks.mockReturnValue([makeTask({ status: 'submitted', title: 'Pending task' })]);

    const { lastFrame } = render(React.createElement(TasksPanel, {}));
    expect(lastFrame()).toContain('submitted');
  });

  it('should display the priority badge', () => {
    getActiveTasks.mockReturnValue([makeTask({ priority: 'P0' })]);

    const { lastFrame } = render(React.createElement(TasksPanel, {}));
    expect(lastFrame()).toContain('P0');
  });

  it('should display the first assignee', () => {
    getActiveTasks.mockReturnValue([makeTask({ assignees: ['TESTING'] })]);

    const { lastFrame } = render(React.createElement(TasksPanel, {}));
    expect(lastFrame()).toContain('TESTING');
  });

  it('should not show assignee when assignees list is empty', () => {
    getActiveTasks.mockReturnValue([makeTask({ assignees: [], title: 'Unassigned task' })]);

    const { lastFrame } = render(React.createElement(TasksPanel, {}));
    expect(lastFrame()).toContain('Unassigned task');
    // Arrow separator should not appear without an assignee
    expect(lastFrame()).not.toContain('→');
  });

  it('should render multiple tasks', () => {
    getActiveTasks.mockReturnValue([
      makeTask({ id: 'task-1', title: 'Task Alpha', status: 'working' }),
      makeTask({ id: 'task-2', title: 'Task Beta', status: 'submitted' }),
    ]);

    const { lastFrame } = render(React.createElement(TasksPanel, {}));
    const frame = lastFrame();
    expect(frame).toContain('Task Alpha');
    expect(frame).toContain('Task Beta');
  });

  it('should pass the cwd prop through to getActiveTasks', () => {
    getActiveTasks.mockReturnValue([]);

    render(React.createElement(TasksPanel, { cwd: '/custom/root' }));
    expect(getActiveTasks).toHaveBeenCalledWith('/custom/root');
  });

  it('should show all active tasks simultaneously', () => {
    getActiveTasks.mockReturnValue([
      makeTask({ id: 't-1', title: 'Feature A', status: 'working', priority: 'P1' }),
      makeTask({ id: 't-2', title: 'Feature B', status: 'input-required', priority: 'P2' }),
      makeTask({ id: 't-3', title: 'Feature C', status: 'submitted', priority: 'P3' }),
    ]);

    const { lastFrame } = render(React.createElement(TasksPanel, {}));
    const frame = lastFrame();
    expect(frame).toContain('Feature A');
    expect(frame).toContain('Feature B');
    expect(frame).toContain('Feature C');
    expect(frame).toContain('P1');
    expect(frame).toContain('P2');
    expect(frame).toContain('P3');
  });
});
