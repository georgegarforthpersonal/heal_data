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
  it('adds the resolved position from the three parts', () => {
    const onAdd = vi.fn();
    render(<Harness onAdd={onAdd} />);

    type('Grid square', 'ST');
    type('Easting', '734');
    type('Northing', '400');
    fireEvent.click(addButton());

    expect(onAdd).toHaveBeenCalledTimes(1);
    const [lat, lng] = onAdd.mock.calls[0];
    expect(lat).toBeCloseTo(51.15908, 4);
    expect(lng).toBeCloseTo(-2.381038, 4);
  });

  it('echoes the resolved position before it is added', () => {
    render(<Harness />);
    type('Grid square', 'ST');
    type('Easting', '734');
    type('Northing', '400');
    expect(screen.getByText(/51\.15908, -2\.38104/)).toBeInTheDocument();
  });

  it('seeds the square from a nearby point so only figures need typing', () => {
    render(<Harness nearLat={51.15908} nearLng={-2.381038} />);
    expect(field('Grid square').value).toBe('ST');
  });

  it('keeps the square but clears the figures after adding', () => {
    render(<Harness />);
    type('Grid square', 'ST');
    type('Easting', '734');
    type('Northing', '400');
    fireEvent.click(addButton());

    expect(field('Grid square').value).toBe('ST');
    expect(field('Easting').value).toBe('');
    expect(field('Northing').value).toBe('');
  });

  it('refuses letters in the figure boxes as they are typed', () => {
    render(<Harness />);
    type('Easting', '7a4');
    expect(field('Easting').value).toBe('');
  });

  it('uppercases the square as it is typed', () => {
    render(<Harness />);
    type('Grid square', 'st');
    expect(field('Grid square').value).toBe('ST');
  });

  it('adds nothing and explains when the figure counts differ', () => {
    const onAdd = vi.fn();
    render(<Harness onAdd={onAdd} />);

    type('Grid square', 'ST');
    type('Easting', '7345');
    type('Northing', '400');
    fireEvent.click(addButton());

    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.getByText(/same number of digits/i)).toBeInTheDocument();
  });

  it('adds nothing when the square is missing', () => {
    const onAdd = vi.fn();
    render(<Harness onAdd={onAdd} />);
    type('Easting', '734');
    type('Northing', '400');
    fireEvent.click(addButton());

    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.getByText(/two-letter grid square/i)).toBeInTheDocument();
  });

  it('adds on Enter without reaching for the button', () => {
    const onAdd = vi.fn();
    render(<Harness onAdd={onAdd} />);
    type('Grid square', 'ST');
    type('Easting', '734');
    type('Northing', '400');
    fireEvent.keyDown(field('Northing'), { key: 'Enter' });
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
    expect(screen.queryByLabelText('Grid square')).not.toBeInTheDocument();
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
