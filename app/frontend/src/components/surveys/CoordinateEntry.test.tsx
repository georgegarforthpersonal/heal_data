/**
 * Interaction tests for structured coordinate entry.
 *
 * The point of the structured fields over a free-text box is that a bad entry
 * is caught in the box it belongs to and nothing is added until it resolves,
 * so that is what these cover.
 */

import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import CoordinateEntry, { type CoordinateFormat } from './CoordinateEntry';

function Harness({
  onAdd = () => {},
  initialFormat = 'gridref' as CoordinateFormat,
  nearLat,
  nearLng,
}: {
  onAdd?: (lat: number, lng: number) => void;
  initialFormat?: CoordinateFormat;
  nearLat?: number;
  nearLng?: number;
}) {
  const [format, setFormat] = useState<CoordinateFormat>(initialFormat);
  return (
    <CoordinateEntry
      format={format}
      onFormatChange={setFormat}
      onAdd={onAdd}
      nearLat={nearLat}
      nearLng={nearLng}
    />
  );
}

const field = (name: string) => screen.getByLabelText(name) as HTMLInputElement;
const addButton = () => screen.getByRole('button', { name: /Add point/i });
const type = (name: string, value: string) =>
  fireEvent.change(field(name), { target: { value } });

describe('CoordinateEntry grid reference mode', () => {
  it('adds the resolved position from a reference as printed', () => {
    const onAdd = vi.fn();
    render(<Harness onAdd={onAdd} />);

    type('Grid reference', 'ST734400');
    fireEvent.click(addButton());

    expect(onAdd).toHaveBeenCalledTimes(1);
    const [lat, lng] = onAdd.mock.calls[0];
    expect(lat).toBeCloseTo(51.15908, 4);
    expect(lng).toBeCloseTo(-2.381038, 4);
  });

  it('echoes the resolved position before it is added', () => {
    render(<Harness />);
    type('Grid reference', 'ST734400');
    expect(screen.getByText(/51\.15908, -2\.38104/)).toBeInTheDocument();
  });

  it('seeds the square from a nearby point so only figures need typing', () => {
    render(<Harness nearLat={51.15908} nearLng={-2.381038} />);
    expect(field('Grid reference').value).toBe('ST');
  });

  it('keeps the square but clears the figures after adding', () => {
    render(<Harness />);
    type('Grid reference', 'ST734400');
    fireEvent.click(addButton());

    // Square kept, figures cleared: the next stop is nearly always the same square.
    expect(field('Grid reference').value).toBe('ST');
  });

  it('refuses prose, so a pasted sentence cannot become a coordinate', () => {
    render(<Harness />);
    type('Grid reference', 'Start from the office');
    expect(field('Grid reference').value).toBe('');
  });

  it('uppercases the reference as it is typed', () => {
    render(<Harness />);
    type('Grid reference', 'st734400');
    expect(field('Grid reference').value).toBe('ST734400');
  });

  it('accepts the spaced form as well as the compact one', () => {
    const onAdd = vi.fn();
    render(<Harness onAdd={onAdd} />);
    type('Grid reference', 'ST 734 400');
    fireEvent.click(addButton());
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('adds nothing and explains when the figures are lopsided', () => {
    const onAdd = vi.fn();
    render(<Harness onAdd={onAdd} />);

    // 7 digits can't split evenly into an easting and a northing.
    type('Grid reference', 'ST7345400');
    fireEvent.click(addButton());

    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.getByText(/even number of digits/i)).toBeInTheDocument();
  });

  it('adds nothing when the square is missing', () => {
    const onAdd = vi.fn();
    render(<Harness onAdd={onAdd} />);
    type('Grid reference', '734400');
    fireEvent.click(addButton());

    expect(onAdd).not.toHaveBeenCalled();
  });

  it('adds on Enter without reaching for the button', () => {
    const onAdd = vi.fn();
    render(<Harness onAdd={onAdd} />);
    type('Grid reference', 'ST734400');
    fireEvent.keyDown(field('Grid reference'), { key: 'Enter' });
    expect(onAdd).toHaveBeenCalledTimes(1);
  });
});

describe('CoordinateEntry lat/long mode', () => {
  const switchToLatLng = () =>
    fireEvent.click(screen.getByRole('button', { name: /Lat \/ Long/i }));

  it('swaps the fields when the format changes', () => {
    render(<Harness />);
    switchToLatLng();
    expect(screen.getByLabelText('Latitude')).toBeInTheDocument();
    expect(screen.queryByLabelText('Grid reference')).not.toBeInTheDocument();
  });

  it('adds the entered degrees unchanged', () => {
    const onAdd = vi.fn();
    render(<Harness onAdd={onAdd} />);
    switchToLatLng();
    type('Latitude', '51.15908');
    type('Longitude', '-2.381038');
    fireEvent.click(addButton());
    expect(onAdd).toHaveBeenCalledWith(51.15908, -2.381038);
  });

  it('echoes the equivalent grid reference, so both formats are visible', () => {
    render(<Harness />);
    switchToLatLng();
    type('Latitude', '51.15908');
    type('Longitude', '-2.381038');
    expect(screen.getByText('ST734400')).toBeInTheDocument();
  });

  it('rejects an out-of-range latitude', () => {
    const onAdd = vi.fn();
    render(<Harness onAdd={onAdd} />);
    switchToLatLng();
    type('Latitude', '91');
    type('Longitude', '0');
    fireEvent.click(addButton());
    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.getByText(/Latitude must be between/i)).toBeInTheDocument();
  });

  it('adds nothing when only one of the two is filled in', () => {
    const onAdd = vi.fn();
    render(<Harness onAdd={onAdd} />);
    switchToLatLng();
    type('Latitude', '51.15908');
    fireEvent.click(addButton());
    expect(onAdd).not.toHaveBeenCalled();
  });
});

describe('the Heal dragonfly survey sheet', () => {
  // Every reference printed on "Heal Somerset - DRAGONFLY survey route v2.pdf",
  // entered exactly as written there.
  const SHEET = [
    'ST734400', 'ST734399', 'ST733399', 'ST734399', 'ST734395', 'ST738393',
    'ST740394', 'ST739395', 'ST738397', 'ST739398', 'ST736401', 'ST737401',
    'ST735401',
  ];

  it('accepts all 13 stops as printed', () => {
    for (const ref of SHEET) {
      const onAdd = vi.fn();
      const { unmount } = render(<Harness onAdd={onAdd} />);
      type('Grid reference', ref);
      fireEvent.click(addButton());

      expect(onAdd, `${ref} should be accepted`).toHaveBeenCalledTimes(1);
      const [lat, lng] = onAdd.mock.calls[0];
      // All 13 sit on the Heal Somerset site.
      expect(lat).toBeGreaterThan(51.15);
      expect(lat).toBeLessThan(51.17);
      expect(lng).toBeGreaterThan(-2.39);
      expect(lng).toBeLessThan(-2.36);
      unmount();
    }
  });
});
