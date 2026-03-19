/**
 * Formatters Utility Tests
 */

import { describe, it, expect } from 'vitest';
import {
  getSurveyorName,
  getInitials,
  formatDate,
  formatTime,
  formatNumber,
} from './formatters';

describe('getSurveyorName', () => {
  const surveyors = [
    { id: 1, first_name: 'John', last_name: 'Smith', is_active: true },
    { id: 2, first_name: 'Jane', last_name: null, is_active: true },
    { id: 3, first_name: 'Bob', last_name: 'Jones', is_active: true },
  ];

  it('should return full name for surveyor with last name', () => {
    expect(getSurveyorName(1, surveyors)).toBe('John Smith');
  });

  it('should return first name only when no last name', () => {
    expect(getSurveyorName(2, surveyors)).toBe('Jane');
  });

  it('should return "Unknown" for non-existent surveyor', () => {
    expect(getSurveyorName(999, surveyors)).toBe('Unknown');
  });

  it('should return "Unknown" for empty surveyors list', () => {
    expect(getSurveyorName(1, [])).toBe('Unknown');
  });
});

describe('getInitials', () => {
  it('should extract initials from two-word name', () => {
    expect(getInitials('John Smith')).toBe('JS');
  });

  it('should extract initials from single word name', () => {
    expect(getInitials('Jane')).toBe('J');
  });

  it('should handle multiple spaces', () => {
    expect(getInitials('John  Smith')).toBe('JS');
  });

  it('should handle leading/trailing spaces', () => {
    expect(getInitials('  John Smith  ')).toBe('JS');
  });

  it('should return "?" for empty string', () => {
    expect(getInitials('')).toBe('?');
  });

  it('should return "?" for whitespace-only string', () => {
    expect(getInitials('   ')).toBe('?');
  });

  it('should uppercase initials', () => {
    expect(getInitials('john smith')).toBe('JS');
  });

  it('should only use first two names for initials', () => {
    expect(getInitials('John Michael Smith')).toBe('JM');
  });
});

describe('formatDate', () => {
  it('should format ISO date to readable format', () => {
    // Note: This will use en-US locale
    const result = formatDate('2024-01-15');
    expect(result).toContain('Jan');
    expect(result).toContain('15');
    expect(result).toContain('2024');
  });

  it('should handle different months', () => {
    const result = formatDate('2024-12-25');
    expect(result).toContain('Dec');
    expect(result).toContain('25');
  });
});

describe('formatTime', () => {
  it('should format morning time to 12-hour', () => {
    expect(formatTime('09:30:00')).toBe('9:30 AM');
  });

  it('should format afternoon time to 12-hour', () => {
    expect(formatTime('14:45:00')).toBe('2:45 PM');
  });

  it('should format noon correctly', () => {
    expect(formatTime('12:00:00')).toBe('12:00 PM');
  });

  it('should format midnight correctly', () => {
    expect(formatTime('00:00:00')).toBe('12:00 AM');
  });

  it('should handle time without seconds', () => {
    expect(formatTime('09:30')).toBe('9:30 AM');
  });

  it('should return empty string for null', () => {
    expect(formatTime(null)).toBe('');
  });

  it('should return empty string for undefined', () => {
    expect(formatTime(undefined)).toBe('');
  });
});

describe('formatNumber', () => {
  it('should add thousands separators', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
  });

  it('should handle small numbers without separators', () => {
    expect(formatNumber(123)).toBe('123');
  });

  it('should handle zero', () => {
    expect(formatNumber(0)).toBe('0');
  });
});
