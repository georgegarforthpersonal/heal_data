/**
 * Interaction tests for the tally-mode stage count controls.
 *
 * These cover the behaviour that is easy to get subtly wrong: the null / 0 /
 * N distinction, stepping back down through zero to not-recorded, and the
 * bulk "none seen" action.
 */

import { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

import StageCountsFields from './StageCountsFields';
import type { StageCountKey, StageCounts } from '../../config/stageCounts';

/** Wrapper holding state, so the component is exercised as it is used. */
function Harness({
  initial = {},
  adultTotal,
}: {
  initial?: StageCounts;
  adultTotal?: number | null;
}) {
  const [counts, setCounts] = useState<StageCounts>(initial);
  return (
    <StageCountsFields
      value={counts}
      adultTotal={adultTotal}
      onChange={(key: StageCountKey, next) => setCounts((prev) => ({ ...prev, [key]: next }))}
    />
  );
}

/** The increment target for a category, found via its accessible name. */
const chip = (label: string) => screen.getByRole('button', { name: new RegExp(`^${label}:`) });

const minusFor = (label: string) =>
  screen.getByRole('button', { name: new RegExp(`Subtract one from ${label}`, 'i') });

const valueOf = (label: string) => (chip(label).textContent ?? '').replace(label, '').trim();

const tapTimes = (label: string, times: number) => {
  for (let i = 0; i < times; i++) fireEvent.click(chip(label));
};

describe('StageCountsFields tally mode', () => {
  it('starts every category as not recorded, not zero', () => {
    render(<Harness />);
    expect(valueOf('Larvae')).toBe('—');
    expect(valueOf('Exuviae')).toBe('—');
  });

  it('counts up one per tap', () => {
    render(<Harness />);
    tapTimes('Copulating pairs', 1);
    expect(valueOf('Copulating pairs')).toBe('1');
    tapTimes('Copulating pairs', 2);
    expect(valueOf('Copulating pairs')).toBe('3');
  });

  it('leaves the other categories untouched while counting one', () => {
    render(<Harness />);
    tapTimes('Larvae', 1);
    expect(valueOf('Larvae')).toBe('1');
    expect(valueOf('Exuviae')).toBe('—');
  });

  it('steps back down to zero, then to not recorded', () => {
    render(<Harness initial={{ exuviae: 2 }} />);

    fireEvent.click(minusFor('Exuviae'));
    expect(valueOf('Exuviae')).toBe('1');

    fireEvent.click(minusFor('Exuviae'));
    // Zero is a real observation ("looked, saw none"), not an empty state.
    expect(valueOf('Exuviae')).toBe('0');

    fireEvent.click(minusFor('Exuviae'));
    expect(valueOf('Exuviae')).toBe('—');
  });

  it('disables subtract while a category is unrecorded', () => {
    render(<Harness />);
    expect(minusFor('Larvae')).toBeDisabled();
  });

  it('marks only the unrecorded categories as none seen', () => {
    render(<Harness initial={{ copulating_pairs: 3 }} />);

    fireEvent.click(screen.getByRole('button', { name: /Mark the rest as none seen/i }));

    expect(valueOf('Copulating pairs')).toBe('3'); // untouched
    expect(valueOf('Larvae')).toBe('0');
    expect(valueOf('Exuviae')).toBe('0');
    expect(valueOf('Emerging adults')).toBe('0');
  });

  it('clears everything back to not recorded', () => {
    render(<Harness initial={{ copulating_pairs: 2, larvae: 0 }} />);

    fireEvent.click(screen.getByRole('button', { name: /^Clear$/i }));

    expect(valueOf('Copulating pairs')).toBe('—');
    expect(valueOf('Larvae')).toBe('—');
  });

  it('announces the current value to screen readers', () => {
    render(<Harness />);
    expect(chip('Larvae')).toHaveAccessibleName(/not recorded/i);

    tapTimes('Larvae', 1);
    expect(chip('Larvae')).toHaveAccessibleName(/Larvae: 1/);
  });
});

describe('StageCountsFields validation', () => {
  it('adds one via the + button', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /Add one to Larvae/i }));
    expect(valueOf('Larvae')).toBe('1');
  });

  it('stops counting at the cap the adult total implies, and says why', () => {
    render(<Harness adultTotal={5} />);
    tapTimes('Copulating pairs', 4);
    // floor(5 / 2) = 2: the third and fourth taps are refused.
    expect(valueOf('Copulating pairs')).toBe('2');
    expect(screen.getByRole('button', { name: /Add one to Copulating pairs/i })).toBeDisabled();
    expect(screen.getByText(/Capped at 2/i)).toBeInTheDocument();
  });

  it('a single adult cannot be a pair: + is dead from the start, with the reason', () => {
    render(<Harness adultTotal={1} />);
    tapTimes('Copulating pairs', 1);
    expect(valueOf('Copulating pairs')).toBe('—');
    expect(screen.getByText(/Capped at 0/i)).toBeInTheDocument();
  });

  it('renders a blocking error when a recorded count exceeds its cap', () => {
    // Reachable by lowering the adult total after counts were entered.
    render(<Harness initial={{ ovipositing_females: 2 }} adultTotal={1} />);
    const alert = screen.getByRole('alert');
    expect(within(alert).getByText(/can't be 2/i)).toBeInTheDocument();
  });

  it('shows no error when the totals are consistent', () => {
    render(<Harness adultTotal={8} />);
    tapTimes('Copulating pairs', 4);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('StageCountsFields type mode', () => {
  const switchTo = (mode: 'Tap' | 'Type') =>
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${mode}$`, 'i') }));

  it('switches to numeric inputs carrying the current values', () => {
    render(<Harness initial={{ larvae: 7 }} />);
    switchTo('Type');

    const input = screen.getByLabelText('Larvae') as HTMLInputElement;
    expect(input.value).toBe('7');
    // GOV.UK markup: type=number drops letters silently and ignores maxlength.
    expect(input).toHaveAttribute('inputmode', 'numeric');
    expect(input).not.toHaveAttribute('type', 'number');
  });

  it('ignores non-numeric and over-long input', () => {
    render(<Harness initial={{ larvae: 12 }} />);
    switchTo('Type');
    const input = screen.getByLabelText('Larvae') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'abc' } });
    expect(input.value).toBe('12');

    fireEvent.change(input, { target: { value: '-3' } });
    expect(input.value).toBe('12');

    fireEvent.change(input, { target: { value: '12345' } });
    expect(input.value).toBe('12');

    fireEvent.change(input, { target: { value: '1234' } });
    expect(input.value).toBe('1234');
  });

  it('treats an emptied field as not recorded rather than zero', () => {
    render(<Harness initial={{ larvae: 4 }} />);
    switchTo('Type');

    fireEvent.change(screen.getByLabelText('Larvae'), { target: { value: '' } });

    switchTo('Tap');
    expect(valueOf('Larvae')).toBe('—');
  });
});
