import { SetupStep as SharedSetupStep } from '../wizard';
import type { CameraTrapWizardState } from '../../hooks/useCameraTrapWizard';

interface SetupStepProps {
  wizard: CameraTrapWizardState;
}

export function SetupStep({ wizard }: SetupStepProps) {
  return (
    <SharedSetupStep
      wizard={wizard}
      noDevicesText="No camera trap devices found. Add one in Admin > Devices."
    />
  );
}
