/**
 * Self sign-up as an instant, optimistic toggle — no confirmation dialog.
 * The button flips the moment it's clicked (the request settles in the
 * background), and both directions offer Undo in their toast, so a mis-tap
 * on touch — where the whole button withdraws — costs one tap to reverse.
 * Signed up it reads "✓ Signed up ×"; the trailing × (removable-chip
 * pattern) is what makes tap-to-withdraw discoverable on touch. Hovering
 * (desktop) flips the whole button to a red "Withdraw" (GitHub-unfollow
 * style).
 *
 * The optimistic state also persists through a failed surveyor-list refresh
 * after a first-time sign-up (which mints a new surveyor row): the server
 * accepted, so the button must keep saying "Signed up" even while the
 * lookup can't yet resolve the new surveyor id to this user.
 */
import { useState } from 'react';
import { Button } from '@mui/material';
import { Check, Close, PersonAddAlt1 } from '@mui/icons-material';
import { scheduledSurveysAPI, type ScheduledSurvey, type Surveyor } from '../../services/api';
import { usePermissions } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { groupColors } from '../../pages/groups/groupsTokens';
import { formatSurveyDate } from '../../pages/groups/surveyState';

interface SelfSignupButtonProps {
  slot: ScheduledSurvey;
  /** The surveyors currently signed up to this slot. */
  assigned: Surveyor[];
  /** Called after a successful change with the slot's new surveyor ids. */
  onSaved: (slotId: number, surveyorIds: number[]) => void;
}

const withdrawRed = '#c62828';

export default function SelfSignupButton({ slot, assigned, onSaved }: SelfSignupButtonProps) {
  const toast = useToast();
  const { user } = usePermissions();
  const [inFlight, setInFlight] = useState(false);
  const [hover, setHover] = useState(false);
  // Optimistic/persistent signed-up state. null = trust the derived value;
  // set after a click and kept after success (see docstring).
  const [local, setLocal] = useState<boolean | null>(null);

  // Signing up requires an account to link the surveyor to.
  if (!user) return null;

  const serverSignedUp = assigned.some((s) => s.user_id != null && s.user_id === user.id);
  const isSignedUp = local ?? serverSignedUp;
  // The red withdraw treatment shows while hovering the signed-up state.
  // Hover is cleared after every action, so a fresh sign-up reads
  // "✓ Signed up ×" even though the pointer is still on the button.
  const showWithdraw = isSignedUp && hover && !inFlight;

  const perform = async (withdrawing: boolean, isUndo: boolean) => {
    if (inFlight) return;
    setInFlight(true);
    setLocal(!withdrawing); // flip immediately — the request settles behind it
    try {
      const result = withdrawing
        ? await scheduledSurveysAPI.withdraw(slot.id)
        : await scheduledSurveysAPI.signUp(slot.id);
      onSaved(slot.id, result.surveyor_ids);
      const undo: () => void = () => void perform(!withdrawing, true);
      // isUndo names the state the undo produced — a withdraw-as-undo has
      // just REMOVED the sign-up, so it must never read as restoring one.
      if (withdrawing) {
        toast.success(
          isUndo ? 'Sign-up undone — you’re not on this survey' : 'You’ve withdrawn from this survey',
          isUndo ? undefined : { label: 'Undo', onClick: undo },
        );
      } else {
        toast.success(
          isUndo ? 'Withdrawal undone — you’re signed up' : 'You’re signed up',
          isUndo ? undefined : { label: 'Undo', onClick: undo },
        );
      }
    } catch {
      setLocal(withdrawing); // roll the optimistic flip back
      toast.error(withdrawing ? 'Couldn’t withdraw — try again' : 'Couldn’t sign up — try again');
    } finally {
      setInFlight(false);
      setHover(false);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    // Some rows navigate on click — this button must never trigger that.
    e.stopPropagation();
    void perform(isSignedUp, false);
  };

  return (
    <Button
      variant="outlined"
      onClick={handleClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      disabled={inFlight}
      aria-label={
        isSignedUp
          ? `Withdraw from the survey ${formatSurveyDate(slot)}`
          : `Sign up for the survey ${formatSurveyDate(slot)}`
      }
      startIcon={
        showWithdraw ? (
          <Close sx={{ fontSize: 17 }} />
        ) : isSignedUp ? (
          <Check sx={{ fontSize: 17 }} />
        ) : (
          <PersonAddAlt1 sx={{ fontSize: 17 }} />
        )
      }
      endIcon={
        isSignedUp && !showWithdraw ? (
          <Close sx={{ fontSize: 15, opacity: 0.6 }} />
        ) : undefined
      }
      sx={{
        flexShrink: 0,
        borderRadius: '7px',
        textTransform: 'none',
        fontSize: 13,
        px: 1.5,
        py: 0.5,
        minWidth: 112,
        minHeight: { xs: 44, sm: 32 },
        // Colour is driven by the same state as the label (not CSS :hover),
        // so text and treatment can never disagree.
        ...(showWithdraw
          ? {
              color: withdrawRed,
              borderColor: withdrawRed,
              bgcolor: 'rgba(198,40,40,0.04)',
              '&:hover': { borderColor: withdrawRed, bgcolor: 'rgba(198,40,40,0.08)' },
              '&.Mui-disabled': { color: withdrawRed, borderColor: 'rgba(198,40,40,0.4)' },
            }
          : isSignedUp
            ? {
                color: groupColors.brandDark,
                borderColor: groupColors.brand,
                bgcolor: 'rgba(61,139,86,0.06)',
                '&:hover': { borderColor: groupColors.brandDark, bgcolor: 'rgba(61,139,86,0.06)' },
                '&.Mui-disabled': { color: groupColors.brandDark, borderColor: groupColors.brand },
              }
            : {
                color: groupColors.brandDark,
                borderColor: groupColors.brand,
                '&:hover': { borderColor: groupColors.brandDark, bgcolor: 'rgba(61,139,86,0.04)' },
                '&.Mui-disabled': { color: groupColors.brandDark, borderColor: groupColors.brand },
              }),
      }}
    >
      {showWithdraw ? 'Withdraw' : isSignedUp ? 'Signed up' : 'Sign up'}
    </Button>
  );
}
