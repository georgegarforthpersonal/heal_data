import { useState, useRef, useEffect } from 'react';
import { Box, IconButton, Typography, CircularProgress, Tooltip } from '@mui/material';
import { PlayArrow, Stop } from '@mui/icons-material';
import { audioAPI } from '../../services/api';

interface AudioClipPlayerProps {
  audioRecordingId: number;
  startTime: string; // HH:MM:SS format
  endTime: string;   // HH:MM:SS format
  confidence: number; // 0-1
}

/**
 * Parse time string (HH:MM:SS) to seconds
 */
function parseTimeToSeconds(timeStr: string): number {
  const parts = timeStr.split(':').map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return Number(timeStr) || 0;
}

/**
 * AudioClipPlayer - Plays a specific time range of an audio file
 *
 * Shows a play button with confidence percentage. When clicked, fetches
 * the presigned URL and plays the audio from startTime to endTime.
 */
export function AudioClipPlayer({
  audioRecordingId,
  startTime,
  endTime,
  confidence
}: AudioClipPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const checkIntervalRef = useRef<number | null>(null);

  const startSeconds = parseTimeToSeconds(startTime);
  const endSeconds = parseTimeToSeconds(endTime);
  const confidencePercent = Math.round(confidence * 100);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, []);

  const handlePlay = async () => {
    if (isPlaying) {
      // Stop playback
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      setIsPlaying(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch presigned URL
      const { download_url } = await audioAPI.getDownloadUrl(audioRecordingId);

      // Create audio element
      const audio = new Audio(download_url);
      audioRef.current = audio;

      // Set up event handlers
      audio.oncanplaythrough = () => {
        // Seek to start time and play
        audio.currentTime = startSeconds;
        audio.play();
        setIsLoading(false);
        setIsPlaying(true);

        // Set up interval to check if we've reached end time
        checkIntervalRef.current = window.setInterval(() => {
          if (audio.currentTime >= endSeconds) {
            audio.pause();
            setIsPlaying(false);
            if (checkIntervalRef.current) {
              clearInterval(checkIntervalRef.current);
              checkIntervalRef.current = null;
            }
          }
        }, 100);
      };

      audio.onended = () => {
        setIsPlaying(false);
        if (checkIntervalRef.current) {
          clearInterval(checkIntervalRef.current);
          checkIntervalRef.current = null;
        }
      };

      audio.onerror = () => {
        setError('Failed to load audio');
        setIsLoading(false);
        setIsPlaying(false);
      };

      // Start loading
      audio.load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audio');
      setIsLoading(false);
    }
  };

  return (
    <Tooltip
      title={error || `Play detection clip (${confidencePercent}% confidence)`}
      arrow
    >
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          bgcolor: error ? 'error.light' : isPlaying ? 'primary.light' : 'grey.100',
          borderRadius: 1,
          px: 0.5,
          py: 0.25,
          cursor: 'pointer',
          transition: 'background-color 0.2s',
          '&:hover': {
            bgcolor: error ? 'error.light' : isPlaying ? 'primary.main' : 'grey.200',
          },
        }}
        onClick={handlePlay}
      >
        {isLoading ? (
          <CircularProgress size={18} sx={{ m: 0.5 }} />
        ) : (
          <IconButton
            size="small"
            sx={{
              p: 0.25,
              color: error ? 'error.main' : isPlaying ? 'primary.contrastText' : 'primary.main',
            }}
          >
            {isPlaying ? <Stop fontSize="small" /> : <PlayArrow fontSize="small" />}
          </IconButton>
        )}
        <Typography
          variant="caption"
          sx={{
            fontWeight: 600,
            color: error ? 'error.main' : isPlaying ? 'primary.contrastText' : 'text.primary',
            pr: 0.5,
          }}
        >
          {confidencePercent}%
        </Typography>
      </Box>
    </Tooltip>
  );
}
