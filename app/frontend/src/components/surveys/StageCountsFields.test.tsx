/**
 * Interaction tests for the compact stage-count steppers.
 *
 * Every count defaults to 0 — the UI treats "not recorded" and "saw none" as
 * the same thing — so these cover stepping, typed entry, the adult-total caps
 * (both the hard stop and the stranded over-cap error), and the disclosure
 * behaviour that keeps the panel out of the way until there is evidence.
 */

import { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

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

const plusFor = (label: string) =>
  screen.getByRole('button', { name: new RegExp(`Add one to ${label}`, 'i') });

const minusFor = (label: string) =>
  screen.getByRole('button', { name: new RegExp(`Subtract one from ${label}`, 'i') });

const inputFor = (label: string) => screen.getByRole('textbox', { name: label });

const header = () => screen.getByRole('button', { name: /Life stage/i });

/**
 * The panel is collapsed unless something positive is recorded, so render it
 * open: these tests are about the controls inside.
 */
const renderPanel = (props: Parameters<typeof Harness>[0] = {}) => {
  const result = render(<Harness {...props} />);
  const collapsed = screen.queryByRole('button', { expanded: false, name: /Life stage/i });
  if (collapsed) fireEvent.click(collapsed);
  return result;
};

describe('StageCountsFields steppers', () => {
  it('shows every category resting at zero — no not-recorded state', () => {
    renderPanel();
    // value||'' keeps the input emptyable while typing; the placeholder 0 is
    // the resting display, so the stored value is what we assert on.
    expect(inputFor('Larvae')).toHaveValue('');
    expect(inputFor('Larvae')).toHaveAttribute('placeholder', '0');
  });

  it('steps up and back down, never below zero', () => {
    renderPanel({ adultTotal: 10 });
    fireEvent.click(plusFor('Larvae'));
    fireEvent.click(plusFor('Larvae'));
    expect(inputFor('Larvae')).toHaveValue('2');
    fireEvent.click(minusFor('Larvae'));
    fireEvent.click(minusFor('Larvae'));
    expect(inputFor('Larvae')).toHaveValue('');
    expect(minusFor('Larvae')).toBeDisabled();
  });

  it('accepts typed entry and ignores non-numeric input', () => {
    renderPanel({ adultTotal: 50 });
    fireEvent.change(inputFor('Exuviae'), { target: { value: '23' } });
    expect(inputFor('Exuviae')).toHaveValue('23');
    fireEvent.change(inputFor('Exuviae'), { target: { value: '2x' } });
    expect(inputFor('Exuviae')).toHaveValue('23');
  });

  it('leaves the other categories untouched while counting one', () => {
    renderPanel({ adultTotal: 10 });
    fireEvent.click(plusFor('Ovipositing females'));
    expect(inputFor('Ovipositing females')).toHaveValue('1');
    expect(inputFor('Larvae')).toHaveValue('');
    expect(inputFor('Exuviae')).toHaveValue('');
  });
});

describe('StageCountsFields caps', () => {
  it('stops counting at the cap the adult total implies, and says why', () => {
    renderPanel({ adultTotal: 4 });
    fireEvent.click(plusFor('Copulating pairs'));
    fireEvent.click(plusFor('Copulating pairs'));
    expect(inputFor('Copulating pairs')).toHaveValue('2');
    expect(plusFor('Copulating pairs')).toBeDisabled();
    expect(screen.getByText(/Capped at 2/)).toBeInTheDocument();
  });

  it('a single adult cannot be a pair: + is dead from the start, with the reason', () => {
    renderPanel({ adultTotal: 1 });
    expect(plusFor('Copulating pairs')).toBeDisabled();
    expect(screen.getByText(/Capped at 0/)).toBeInTheDocument();
  });

  it('clamps typed entry to the cap rather than accepting the impossible', () => {
    renderPanel({ adultTotal: 4 });
    fireEvent.change(inputFor('Ovipositing females'), { target: { value: '9' } });
    expect(inputFor('Ovipositing females')).toHaveValue('4');
  });

  it('renders a blocking error when a stranded count exceeds its cap', () => {
    // Reachable by lowering the adult total after counts were entered.
    render(<Harness initial={{ copulating_pairs: 3 }} adultTotal={4} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/Copulating pairs can't be 3/);
  });

  it('shows no error when the totals are consistent', () => {
    render(<Harness initial={{ copulating_pairs: 2 }} adultTotal={4} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('StageCountsFields disclosure', () => {
  it('is collapsed on a fresh sighting, so the total stays the prominent field', () => {
    render(<Harness />);
    expect(header()).toHaveAttribute('aria-expanded', 'false');
  });

  it('says it is optional while nothing positive is recorded', () => {
    render(<Harness initial={{ larvae: 0, exuviae: 0 }} />);
    expect(header()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Optional — breeding evidence')).toBeInTheDocument();
  });

  it('starts open when a sighting already has evidence, so an edit hides nothing', () => {
    render(<Harness initial={{ ovipositing_females: 2 }} />);
    expect(header()).toHaveAttribute('aria-expanded', 'true');
  });

  it('summarises the positive counts while closed', () => {
    render(<Harness initial={{ ovipositing_females: 2, larvae: 1 }} />);
    fireEvent.click(header()); // starts open; close it
    expect(screen.getByText(/2 ovipositing females, 1 larva/i)).toBeInTheDocument();
  });

  it('opens on tap and closes again', () => {
    render(<Harness />);
    fireEvent.click(header());
    expect(header()).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(header());
    expect(header()).toHaveAttribute('aria-expanded', 'false');
  });
});
