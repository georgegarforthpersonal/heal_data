import { SaveStep as SharedSaveStep } from '../wizard';
import type { CameraTrapWizardState } from '../../hooks/useCameraTrapWizard';

interface SaveStepProps {
  wizard: CameraTrapWizardState;
}

export function SaveStep({ wizard }: SaveStepProps) {
  return <SharedSaveStep wizard={wizard} />;
}
