/**
 * Regression tests for the mobile sightings flow: the Add/Edit Sighting modal
 * must hand the BDS stage counts back to the editor. This is exactly the seam
 * that silently dropped them (the modal collected counts, handleModalSave
 * copied every field but those five), so these tests walk the real modal on
 * the mobile card path rather than unit-testing either side alone.
 */

import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

import { SightingsEditor, type DraftSighting } from './SightingsEditor';
import type { Species } from '../../services/api';

// The mobile card + modal branch is what regressed; force it regardless of
// the jsdom viewport.
vi.mock('../../hooks/useResponsive', () => ({
  useResponsive: () => ({ isMobile: true, isDesktop: false }),
}));

// A single dragonfly species: the modal preselects it (fixed-species mode),
// so the tests need no autocomplete driving.
const dragonfly = [
  {
    id: 1,
    name: 'Common Darter',
    scientific_name: 'Sympetrum striolatum',
    type: 'dragonfly-damselfly',
  },
] as unknown as Species[];

function Harness({ initial = [] }: { initial?: DraftSighting[] }) {
  const [sightings, setSightings] = useState<DraftSighting[]>(
    initial.length > 0 ? initial : [{ tempId: 'seed', species_id: null, count: 1 }],
  );
  return (
    <SightingsEditor
      sightings={sightings}
      species={dragonfly}
      onSightingsChange={setSightings}
      allowGeolocation={false}
    />
  );
}

/** The open modal (the newest dialog, in case an old one is mid-exit). */
const dialog = () => {
  const dialogs = screen.getAllByRole('dialog');
  return within(dialogs[dialogs.length - 1]);
};

const openAddModal = () => fireEvent.click(screen.getByRole('button', { name: 'Add' }));

const expandStagePanel = () => {
  const header = dialog().queryByRole('button', { expanded: false, name: /Life stage/i });
  if (header) fireEvent.click(header);
};

describe('mobile modal stage-count handoff', () => {
  it('keeps counts tapped in the modal when the sighting is added', () => {
    render(<Harness />);
    openAddModal();
    expandStagePanel();

    fireEvent.click(dialog().getByRole('button', { name: /^Ovipositing females:/ }));
    fireEvent.click(dialog().getByRole('button', { name: 'Add' }));

    // The card confirms what was recorded — summary line and Adults wording.
    expect(screen.getByText('1 ovipositing female')).toBeInTheDocument();
    expect(screen.getByText('Adults: 1')).toBeInTheDocument();
  });

  it('shows existing counts when a sighting is reopened for editing', () => {
    render(
      <Harness
        initial={[
          {
            tempId: 'existing',
            species_id: 1,
            count: 12,
            copulating_pairs: 2,
            ovipositing_females: 1,
          },
        ]}
      />,
    );

    // Card already summarises the evidence…
    expect(screen.getByText('2 copulating pairs, 1 ovipositing female')).toBeInTheDocument();

    // …and the modal opens carrying it (panel auto-expands on existing data).
    const editIcon = document.querySelector('[data-testid="EditIcon"]');
    expect(editIcon).not.toBeNull();
    fireEvent.click(editIcon!);
    expect(dialog().getByRole('button', { name: /^Copulating pairs: 2/ })).toBeInTheDocument();
  });

  it('does not resurrect counts from a cancelled sighting', () => {
    render(<Harness />);
    openAddModal();
    expandStagePanel();
    fireEvent.click(dialog().getByRole('button', { name: /^Larvae:/ }));
    expect(dialog().getByRole('button', { name: /^Larvae: 1/ })).toBeInTheDocument();

    fireEvent.click(dialog().getByRole('button', { name: 'Cancel' }));
    openAddModal();
    expandStagePanel();
    expect(dialog().getByRole('button', { name: /^Larvae: not recorded/ })).toBeInTheDocument();
  });
});
