import { SetupStep as SharedSetupStep } from '../wizard';
import type { AudioWizardState } from '../../hooks/useAudioWizard';

interface SetupStepProps {
  wizard: AudioWizardState;
}

export function SetupStep({ wizard }: SetupStepProps) {
  return (
    <SharedSetupStep
      wizard={wizard}
      noDevicesText="No audio recorder devices found. Add one in Admin > Devices."
    />
  );
}
