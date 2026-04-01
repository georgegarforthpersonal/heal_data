import { SaveStep as SharedSaveStep } from '../wizard';
import type { AudioWizardState } from '../../hooks/useAudioWizard';

interface SaveStepProps {
  wizard: AudioWizardState;
}

export function SaveStep({ wizard }: SaveStepProps) {
  return <SharedSaveStep wizard={wizard} />;
}
