import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import dayjs from 'dayjs';
import type { EcotopiaDevice } from '../../services/api';

// react-leaflet renders nothing useful under jsdom, so the map layer is stubbed
// down to the props we assert on — the pin's icon HTML and its hover title.
const fakeMap = {
  on: vi.fn(),
  off: vi.fn(),
  getZoom: () => 15,
  setView: vi.fn(),
  fitBounds: vi.fn(),
  panTo: vi.fn(),
  flyTo: vi.fn(),
  invalidateSize: vi.fn(),
  stop: vi.fn(),
  getPane: () => undefined,
};

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  TileLayer: () => null,
  AttributionControl: () => null,
  Polyline: () => null,
  CircleMarker: () => null,
  Marker: ({ icon, title }: { icon: { options: { html: string } }; title?: string }) => (
    <div data-testid="pin" title={title} dangerouslySetInnerHTML={{ __html: icon.options.html }} />
  ),
  useMap: () => fakeMap,
  useMapEvents: () => null,
}));

vi.mock('../../services/api', () => ({
  ecotopiaAPI: { getDevices: vi.fn(), getGpsHistory: vi.fn().mockResolvedValue([]) },
}));

import { ecotopiaAPI } from '../../services/api';
import { DeviceTrackerMap } from './DeviceTrackerMap';

// Latitudes are spread a whole degree apart so co-located pins never merge into
// a cluster at the default zoom — grouping isn't what these tests are about.
let nextLat = 51;
const device = (uuid: string, daysAgo: number): EcotopiaDevice => ({
  id: `id-${uuid}`,
  uuid,
  latitude: nextLat++,
  longitude: -2.377,
  gps_timestamp: dayjs().subtract(daysAgo, 'day').toISOString(),
  track_colour: '#2B5F86',
  sex: 'male',
  ring_number: '1/2',
  ring_colour: 'black',
  description: null,
  device_type: 4864,
  survive: 1,
  battery_voltage: 3.78,
});

const renderWith = async (devices: EcotopiaDevice[]) => {
  vi.mocked(ecotopiaAPI.getDevices).mockResolvedValue(devices);
  render(<DeviceTrackerMap />);
  await waitFor(() => expect(screen.getAllByTestId('pin').length).toBe(devices.length));
};

describe('DeviceTrackerMap staleness', () => {
  beforeEach(() => vi.clearAllMocks());

  it('says nothing about staleness while every tag is reporting', async () => {
    await renderWith([device('1300002404', 0), device('1300002405', 1)]);
    expect(screen.queryByText(/stopped reporting/)).toBeNull();
    expect(screen.getAllByText('Reporting')).toHaveLength(2);
  });

  it('labels a quiet tag and a long-silent tag with their real age', async () => {
    await renderWith([device('1300002408', 5), device('1300002407', 32)]);
    expect(screen.getByText('Silent 5 days')).toBeTruthy();
    expect(screen.getByText('Silent 32 days')).toBeTruthy();
  });

  it('warns above the map, counting only the tags that have gone quiet', async () => {
    await renderWith([device('1300002404', 0), device('1300002407', 32), device('1300002402', 25)]);
    expect(screen.getByText(/2 tags have stopped reporting/)).toBeTruthy();
  });

  it('draws a silent tag hollow and a reporting tag filled', async () => {
    await renderWith([device('1300002404', 0), device('1300002407', 32)]);
    const pins = screen.getAllByTestId('pin').map((p) => p.innerHTML);
    const live = pins.find((h) => h.includes('2404'))!;
    const dead = pins.find((h) => h.includes('2407'))!;
    expect(live).toContain('background:#2B5F86');
    expect(dead).toContain('background:#fff');
    expect(dead).toContain('border:2px solid #2B5F86');
  });

  it('puts the silence in the pin hover text', async () => {
    await renderWith([device('1300002407', 32)]);
    expect(screen.getByTestId('pin').getAttribute('title')).toContain('silent 32 days');
  });
});
