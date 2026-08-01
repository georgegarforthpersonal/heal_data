/**
 * Sighting records: the in-app view of a group's flat record table — one row
 * per sighting (species, count, date, location), most recent first. The same
 * rows as the Excel export, which stays available from the header button for
 * anyone who wants the spreadsheet.
 *
 * On phones the date and location fold into a second line under the species
 * name; the four-column layout with a header row appears from sm up.
 */
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Alert, Box, Button, CircularProgress, Paper, Typography } from '@mui/material';
import { Download } from '@mui/icons-material';
import {
  ApiError,
  exportAPI,
  surveyTypesAPI,
  type SightingRecord,
  type SurveyTypeWithDetails,
} from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { groupCardSx, groupColors } from './groupsTokens';
import { resolveGroupTypeId } from './groupMeta';
import { formatRecordedDate } from './surveyState';
import GroupBreadcrumb from '../../components/groups/GroupBreadcrumb';

const PAGE_SIZE = 50;

// Species | Count | Date | Location. The xs variant folds date and location
// into a full-width second line instead.
const rowGridSx = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr auto', sm: '2.2fr 0.7fr 1.5fr 1.6fr' },
  alignItems: 'center',
  columnGap: 1.75,
  px: 2.25,
} as const;

export default function GroupRecordsPage() {
  const { typeId } = useParams<{ typeId: string }>();
  const toast = useToast();

  const [surveyType, setSurveyType] = useState<SurveyTypeWithDetails | null>(null);
  const [records, setRecords] = useState<SightingRecord[]>([]);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!typeId) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    let active = true;
    // Route param changes re-render in place — don't carry one group's
    // "Show more" depth into the next group's table.
    setVisible(PAGE_SIZE);
    (async () => {
      try {
        // The route param is a name slug (or a legacy numeric id) — resolve it
        // to the survey type id before anything else can be fetched.
        const surveyTypeId = await resolveGroupTypeId(typeId);
        if (!active) return;
        if (surveyTypeId == null) {
          setNotFound(true);
          return;
        }
        const [details, rows] = await Promise.all([
          surveyTypesAPI.getById(surveyTypeId),
          exportAPI.getRecordsBySurveyType(surveyTypeId),
        ]);
        if (!active) return;
        setSurveyType(details);
        setRecords(rows);
      } catch (err) {
        // Only a 404 means the group doesn't exist; anything else is a fault.
        if (active) {
          if (err instanceof ApiError && err.status === 404) setNotFound(true);
          else setError(true);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [typeId]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ maxWidth: 900, mx: 'auto', px: { xs: 2, sm: 4 }, py: 4 }}>
        <GroupBreadcrumb crumbs={[{ label: 'Surveys', to: '/groups' }, { label: 'Error' }]} />
        <Alert severity="error">Failed to load sighting records. Please try again.</Alert>
      </Box>
    );
  }

  if (notFound || !surveyType) {
    return (
      <Box sx={{ maxWidth: 900, mx: 'auto', px: { xs: 2, sm: 4 }, py: 4 }}>
        <GroupBreadcrumb crumbs={[{ label: 'Surveys', to: '/groups' }, { label: 'Not found' }]} />
        <Typography sx={{ color: groupColors.textSecondary }}>
          This group could not be found.
        </Typography>
      </Box>
    );
  }

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await exportAPI.downloadRecordsBySurveyType(surveyType.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setDownloading(false);
    }
  };

  const shown = records.slice(0, visible);

  return (
    <Box sx={{ bgcolor: groupColors.page, minHeight: '100%', px: { xs: 2, sm: 4 }, py: { xs: 2, sm: 3 } }}>
      <Box sx={{ maxWidth: 900, mx: 'auto' }}>
        <GroupBreadcrumb
          crumbs={[
            { label: 'Surveys', to: '/groups' },
            { label: surveyType.name, to: `/groups/${typeId}` },
            { label: 'Sighting records' },
          ]}
        />

        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
          <Box sx={{ flex: 1, minWidth: 200 }}>
            <Typography sx={{ fontSize: 24, fontWeight: 600, color: groupColors.textPrimary }}>
              Sighting records
            </Typography>
            <Typography sx={{ fontSize: 13.5, color: '#888' }}>
              {surveyType.name} · {records.length} sighting{records.length === 1 ? '' : 's'}, most recent first
            </Typography>
          </Box>
          {records.length > 0 && (
            <Button
              variant="outlined"
              onClick={handleDownload}
              disabled={downloading}
              startIcon={downloading ? <CircularProgress size={14} /> : <Download sx={{ fontSize: 18 }} />}
              sx={{
                textTransform: 'none',
                fontSize: 13,
                borderRadius: '7px',
                color: groupColors.brand,
                borderColor: groupColors.brand,
                flexShrink: 0,
                mt: 0.5,
              }}
            >
              Download Excel (.xlsx)
            </Button>
          )}
        </Box>

        <Paper sx={groupCardSx}>
          {records.length === 0 ? (
            <Box sx={{ px: 2.25, py: 3 }}>
              <Typography sx={{ fontSize: 13.5, color: groupColors.textMuted }}>
                No sightings recorded yet.
              </Typography>
            </Box>
          ) : (
            <>
              <Box
                sx={{
                  ...rowGridSx,
                  display: { xs: 'none', sm: 'grid' },
                  py: 1,
                  borderBottom: `1px solid ${groupColors.divider}`,
                }}
              >
                {['Species', 'Count', 'Date', 'Location'].map((h) => (
                  <Typography
                    key={h}
                    sx={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.4px', textTransform: 'uppercase', color: groupColors.textMuted }}
                  >
                    {h}
                  </Typography>
                ))}
              </Box>

              {shown.map((record, idx) => (
                <Box
                  key={idx}
                  sx={{
                    ...rowGridSx,
                    py: 1.3,
                    rowGap: 0.3,
                    borderTop: idx === 0 ? 'none' : `1px solid ${groupColors.dividerInner}`,
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: 14, fontWeight: 600, color: groupColors.textPrimary }} noWrap>
                      {record.common_name || record.scientific_name || 'Unknown species'}
                    </Typography>
                    {record.common_name && record.scientific_name && (
                      <Typography sx={{ fontSize: 12, fontStyle: 'italic', color: groupColors.textMuted }} noWrap>
                        {record.scientific_name}
                      </Typography>
                    )}
                  </Box>
                  <Typography sx={{ fontSize: 14, fontWeight: 600, color: groupColors.textPrimary, textAlign: { xs: 'right', sm: 'left' } }}>
                    {record.count}
                  </Typography>
                  <Typography sx={{ display: { xs: 'none', sm: 'block' }, fontSize: 13.5, color: groupColors.textSecondary }} noWrap>
                    {formatRecordedDate(record.date)}
                  </Typography>
                  <Typography sx={{ display: { xs: 'none', sm: 'block' }, fontSize: 13.5, color: groupColors.textSecondary }} noWrap>
                    {record.location ?? '—'}
                  </Typography>
                  {/* Phones: date · location fold into one muted line. */}
                  <Typography
                    sx={{ display: { xs: 'block', sm: 'none' }, gridColumn: '1 / -1', fontSize: 12.5, color: groupColors.textMuted }}
                    noWrap
                  >
                    {formatRecordedDate(record.date)}
                    {record.location ? ` · ${record.location}` : ''}
                  </Typography>
                </Box>
              ))}

              {visible < records.length && (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 1.5, borderTop: `1px solid ${groupColors.dividerInner}` }}>
                  <Button
                    onClick={() => setVisible((v) => v + PAGE_SIZE)}
                    sx={{ textTransform: 'none', color: groupColors.brand }}
                  >
                    Show more
                  </Button>
                </Box>
              )}
            </>
          )}
        </Paper>
      </Box>
    </Box>
  );
}
