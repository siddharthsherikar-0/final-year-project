import { describe, it, expect } from 'vitest';
import { cn } from '@/utils/cn';

describe('cn', () => {
  it('joins multiple class strings in order', () => {
    expect(cn('rounded-md', 'bg-surface')).toBe('rounded-md bg-surface');
  });

  it('drops falsy values', () => {
    expect(cn('a', null, undefined, false, '', 'b')).toBe('a b');
    expect(cn()).toBe('');
  });

  it('flattens nested arrays', () => {
    expect(cn(['a', ['b', ['c']]])).toBe('a b c');
  });

  it('includes object keys only when truthy', () => {
    expect(
      cn({
        'bg-accent': true,
        'bg-surface': false,
        'text-ink': true,
        'text-danger': null,
        'border-line': undefined,
      }),
    ).toBe('bg-accent text-ink');
  });

  it('mixes strings, arrays, and objects', () => {
    expect(
      cn('base', ['rounded-md', { 'bg-surface': true, 'bg-elevated': false }], {
        'text-sm': true,
      }),
    ).toBe('base rounded-md bg-surface text-sm');
  });

  it('trims whitespace and ignores numeric falsy zero', () => {
    expect(cn('  p-2  ', 0, 'm-1')).toBe('p-2 m-1');
    expect(cn(1)).toBe('1');
  });
});
