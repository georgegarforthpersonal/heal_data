import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Stack,
  Button,
  Alert,
  CircularProgress,
  Autocomplete,
  TextField,
  Stepper,
  Step,
  StepLabel,
  Checkbox,
  LinearProgress,
  IconButton,
  Chip,
} from '@mui/material';
import {
  ArrowBack,
  ArrowForward,
  Save,
  Cancel,
  CloudUpload,
  PhotoCamera,
  CheckCircle,
  FilterList,
  Restore,
  RemoveCircleOutline,
  ExpandMore,
  ExpandLess,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs, { Dayjs } from 'dayjs';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  surveysAPI,
  surveyorsAPI,
  speciesAPI,
  surveyTypesAPI,
  devicesAPI,
  imagesAPI,
} from '../services/api';
import type {
  Surveyor,
  Species,
  SurveyType,
  Device,
  CameraTrapImage,
  ImageFilterResult,
} from '../services/api';
import { PageHeader } from '../components/layout/PageHeader';
import exifr from 'exifr';

// ============================================================================
// Types
// ============================================================================

interface ImageFile {
  file: File;
  objectUrl: string;
  exifDate: Date | null;
  filename: string;
}

interface Classification {
  speciesId: number;
  speciesName: string;
}

const WIZARD_STEPS = ['Setup', 'Upload', 'Filter', 'Classify', 'Review', 'Save'];

const UPLOAD_BATCH_SIZE = 10;

// ============================================================================
// Component
// ============================================================================

export function NewCameraTrapSurveyPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  // ---- Wizard step ----
  const [activeStep, setActiveStep] = useState(0);

  // ---- Step 1: Setup ----
  const [surveyTypes, setSurveyTypes] = useState<SurveyType[]>([]);
  const [selectedSurveyType, setSelectedSurveyType] = useState<SurveyType | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [date, setDate] = useState<Dayjs | null>(dayjs());
  const [surveyors, setSurveyors] = useState<Surveyor[]>([]);
  const [selectedSurveyors, setSelectedSurveyors] = useState<Surveyor[]>([]);

  // ---- Step 2: Upload ----
  const [imageFiles, setImageFiles] = useState<ImageFile[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---- Step 3: Filter ----
  const [filterResults, setFilterResults] = useState<Map<number, ImageFilterResult>>(new Map());
  const [filtering, setFiltering] = useState(false);
  const [filterProgress, setFilterProgress] = useState({ processed: 0, total: 0 });
  const [falsePositiveOverrides, setFalsePositiveOverrides] = useState<Set<number>>(new Set());
  const [restoredImages, setRestoredImages] = useState<Set<number>>(new Set());
  const [filterError, setFilterError] = useState<string | null>(null);
  const [showAnimalImages, setShowAnimalImages] = useState(false);
  const [filterViewIndex, setFilterViewIndex] = useState(0);
  const filterImageRef = useRef<HTMLImageElement>(null);
  const filterThumbnailStripRef = useRef<HTMLDivElement>(null);

  // ---- Step 4: Classify ----
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [classifications, setClassifications] = useState<Map<number, Classification[]>>(new Map());
  const [viewedImages, setViewedImages] = useState<Set<number>>(new Set());
  const [species, setSpecies] = useState<Species[]>([]);
  const [speciesSearchValue, setSpeciesSearchValue] = useState('');
  const speciesInputRef = useRef<HTMLInputElement>(null);
  const thumbnailStripRef = useRef<HTMLDivElement>(null);

  // ---- Step 5: Review ----
  const [deselectedImages, setDeselectedImages] = useState<Set<string>>(new Set()); // "speciesId-imageIndex"

  // ---- Step 6: Save ----
  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState({ step: '', percent: 0 });

  // ---- Shared ----
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // ============================================================================
  // Data fetching
  // ============================================================================

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [allSurveyTypes, allSurveyors, allDevices] = await Promise.all([
          surveyTypesAPI.getAll(),
          surveyorsAPI.getAll(),
          devicesAPI.getAll(false, 'camera_trap'),
        ]);
        const cameraTrapTypes = allSurveyTypes.filter((st) => st.allow_image_upload && st.is_active);
        setSurveyTypes(cameraTrapTypes);
        setSurveyors(allSurveyors);
        setDevices(allDevices);

        // Pre-select survey type from URL param
        const typeId = searchParams.get('type');
        if (typeId) {
          const preselected = cameraTrapTypes.find((st) => st.id === Number(typeId));
          if (preselected) setSelectedSurveyType(preselected);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, []);

  // Load species when survey type changes
  useEffect(() => {
    if (!selectedSurveyType) {
      setSpecies([]);
      return;
    }
    speciesAPI.getBySurveyType(selectedSurveyType.id).then(setSpecies).catch(() => {
      setError('Failed to load species');
    });
  }, [selectedSurveyType]);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      imageFiles.forEach((img) => URL.revokeObjectURL(img.objectUrl));
    };
  }, [imageFiles]);

  // ============================================================================
  // Step 2: File selection & EXIF extraction
  // ============================================================================

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setLoadingImages(true);
    setError(null);

    try {
      // Filter to image files only
      const imageFileList = Array.from(files).filter((f) => {
        const ext = f.name.toLowerCase().split('.').pop();
        return ['jpg', 'jpeg', 'png'].includes(ext || '');
      });

      if (imageFileList.length === 0) {
        setError('No valid image files found. Accepted formats: JPG, JPEG, PNG');
        setLoadingImages(false);
        return;
      }

      // Process in batches for EXIF extraction
      const processed: ImageFile[] = [];
      const batchSize = 20;

      for (let i = 0; i < imageFileList.length; i += batchSize) {
        const batch = imageFileList.slice(i, i + batchSize);
        const results = await Promise.all(
          batch.map(async (file) => {
            let exifDate: Date | null = null;
            try {
              const exif = await exifr.parse(file, ['DateTimeOriginal', 'CreateDate']);
              exifDate = exif?.DateTimeOriginal || exif?.CreateDate || null;
            } catch {
              // No EXIF data - that's fine
            }
            return {
              file,
              objectUrl: URL.createObjectURL(file),
              exifDate,
              filename: file.name,
            };
          })
        );
        processed.push(...results);
      }

      // Sort by EXIF date (images without dates go to the end)
      processed.sort((a, b) => {
        if (!a.exifDate && !b.exifDate) return a.filename.localeCompare(b.filename);
        if (!a.exifDate) return 1;
        if (!b.exifDate) return -1;
        return a.exifDate.getTime() - b.exifDate.getTime();
      });

      setImageFiles(processed);
      setClassifications(new Map());
      setViewedImages(new Set());
      setCurrentImageIndex(0);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to process images');
    } finally {
      setLoadingImages(false);
    }
  }, []);

  // ============================================================================
  // Step 3: Filter logic
  // ============================================================================

  const FILTER_BATCH_SIZE = 5;

  const runFiltering = useCallback(async () => {
    if (imageFiles.length === 0) return;

    setFiltering(true);
    setFilterError(null);
    setFilterResults(new Map());
    setFalsePositiveOverrides(new Set());
    setRestoredImages(new Set());
    setFilterProgress({ processed: 0, total: imageFiles.length });

    try {
      const results = new Map<number, ImageFilterResult>();

      for (let i = 0; i < imageFiles.length; i += FILTER_BATCH_SIZE) {
        const batch = imageFiles.slice(i, i + FILTER_BATCH_SIZE);
        const batchFiles = batch.map((img) => img.file);

        const response = await imagesAPI.filterImages(batchFiles);

        response.results.forEach((result: ImageFilterResult, batchIdx: number) => {
          results.set(i + batchIdx, result);
        });

        setFilterProgress({
          processed: Math.min(i + FILTER_BATCH_SIZE, imageFiles.length),
          total: imageFiles.length,
        });
        setFilterResults(new Map(results));
      }
    } catch (err: unknown) {
      setFilterError(err instanceof Error ? err.message : 'Failed to filter images');
    } finally {
      setFiltering(false);
    }
  }, [imageFiles]);

  // Start filtering when entering the Filter step
  useEffect(() => {
    if (activeStep === 2 && filterResults.size === 0 && !filtering && !filterError && imageFiles.length > 0) {
      runFiltering();
    }
  }, [activeStep, filterResults.size, filtering, filterError, imageFiles.length, runFiltering]);

  // Compute which images pass the filter for the Classify step
  const filteredImageFiles = useMemo(() => {
    if (filterResults.size === 0) return imageFiles;
    return imageFiles.filter((_, idx) => {
      const result = filterResults.get(idx);
      if (!result) return true; // No result = include (safe default)
      if (falsePositiveOverrides.has(idx)) return false; // User manually excluded
      if (restoredImages.has(idx)) return true; // User manually restored
      return result.has_animal;
    });
  }, [imageFiles, filterResults, falsePositiveOverrides, restoredImages]);

  // Index mapping: filteredImageFiles index -> original imageFiles index
  const filteredToOriginalIndex = useMemo(() => {
    if (filterResults.size === 0) {
      return imageFiles.map((_, idx) => idx);
    }
    const mapping: number[] = [];
    imageFiles.forEach((_, idx) => {
      const result = filterResults.get(idx);
      if (!result) { mapping.push(idx); return; }
      if (falsePositiveOverrides.has(idx)) return;
      if (restoredImages.has(idx)) { mapping.push(idx); return; }
      if (result.has_animal) mapping.push(idx);
    });
    return mapping;
  }, [imageFiles, filterResults, falsePositiveOverrides, restoredImages]);

  // Filter summary counts
  const filterSummary = useMemo(() => {
    let animalCount = 0;
    let emptyCount = 0;
    let personCount = 0;
    filterResults.forEach((result, idx) => {
      const isOverriddenFP = falsePositiveOverrides.has(idx);
      const isRestored = restoredImages.has(idx);
      const effectiveHasAnimal = isOverriddenFP ? false : (isRestored ? true : result.has_animal);
      if (effectiveHasAnimal) animalCount++;
      else emptyCount++;
      if (result.categories.includes('person')) personCount++;
    });
    return { animalCount, emptyCount, personCount };
  }, [filterResults, falsePositiveOverrides, restoredImages]);

  // Scroll filter thumbnail strip when viewer index changes
  useEffect(() => {
    if (activeStep === 2 && filterThumbnailStripRef.current) {
      const container = filterThumbnailStripRef.current;
      const thumbWidth = 56 + 4;
      const scrollTarget = filterViewIndex * thumbWidth - container.clientWidth / 2 + thumbWidth / 2;
      container.scrollTo({ left: scrollTarget, behavior: 'smooth' });
    }
  }, [filterViewIndex, activeStep]);

  // Keyboard navigation for filter step
  useEffect(() => {
    if (activeStep !== 2 || filtering || filterResults.size === 0) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); setFilterViewIndex((prev) => Math.min(imageFiles.length - 1, prev + 1)); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); setFilterViewIndex((prev) => Math.max(0, prev - 1)); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeStep, filtering, filterResults.size, imageFiles.length]);

  // ============================================================================
  // Step 4: Classification helpers
  // ============================================================================

  // Scroll thumbnail strip to keep current image centred
  useEffect(() => {
    if (activeStep === 3 && thumbnailStripRef.current) {
      const container = thumbnailStripRef.current;
      const thumbWidth = 56 + 4; // width + gap
      const scrollTarget = currentImageIndex * thumbWidth - container.clientWidth / 2 + thumbWidth / 2;
      container.scrollTo({ left: scrollTarget, behavior: 'smooth' });
    }
  }, [currentImageIndex, activeStep]);

  // Focus species input when image changes
  useEffect(() => {
    if (activeStep === 3) {
      // Small delay to let the DOM settle after image change
      const timer = setTimeout(() => speciesInputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [currentImageIndex, activeStep]);

  // Mark current image as viewed when it changes
  useEffect(() => {
    if (activeStep === 3 && filteredImageFiles.length > 0) {
      setViewedImages((prev) => {
        if (prev.has(currentImageIndex)) return prev;
        const next = new Set(prev);
        next.add(currentImageIndex);
        return next;
      });
    }
  }, [currentImageIndex, activeStep, imageFiles.length]);

  const findNextUnviewed = useCallback((fromIndex: number): number | null => {
    for (let i = fromIndex + 1; i < filteredImageFiles.length; i++) {
      if (!viewedImages.has(i)) return i;
    }
    for (let i = 0; i < fromIndex; i++) {
      if (!viewedImages.has(i)) return i;
    }
    return null;
  }, [viewedImages, filteredImageFiles.length]);

  const classifyImage = useCallback(
    (speciesId: number, speciesName: string) => {
      const originalIndex = filteredToOriginalIndex[currentImageIndex];
      setClassifications((prev) => {
        const next = new Map(prev);
        const existing = next.get(originalIndex) || [];
        // Don't add duplicate species
        if (existing.some((c) => c.speciesId === speciesId)) return prev;
        next.set(originalIndex, [...existing, { speciesId, speciesName }]);
        return next;
      });
      setSpeciesSearchValue('');
    },
    [currentImageIndex, filteredToOriginalIndex]
  );

  const goToPrev = useCallback(() => {
    setCurrentImageIndex((prev) => Math.max(0, prev - 1));
    setSpeciesSearchValue('');
  }, []);

  const goToNext = useCallback(() => {
    setCurrentImageIndex((prev) => Math.min(filteredImageFiles.length - 1, prev + 1));
    setSpeciesSearchValue('');
  }, [filteredImageFiles.length]);

  const goToNextUnviewed = useCallback(() => {
    const next = findNextUnviewed(currentImageIndex);
    if (next !== null) {
      setCurrentImageIndex(next);
      setSpeciesSearchValue('');
    }
  }, [currentImageIndex, findNextUnviewed]);

  // Keyboard navigation for classify step
  useEffect(() => {
    if (activeStep !== 3) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      // Allow arrow navigation when species input is empty (no active search)
      const isInSpeciesInput = e.target === speciesInputRef.current;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (!isInSpeciesInput) return;
        // Only intercept arrows when species input is empty
        if (speciesSearchValue) return;
      }
      if (e.key === 'ArrowRight') { e.preventDefault(); goToNext(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); goToPrev(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeStep, goToNext, goToPrev, speciesSearchValue]);

  // ============================================================================
  // Step 4: Review computed data
  // ============================================================================

  const reviewData = useMemo(() => {
    const speciesMap = new Map<number, { speciesName: string; imageIndices: number[] }>();

    classifications.forEach((speciesList, imageIndex) => {
      speciesList.forEach((value) => {
        const existing = speciesMap.get(value.speciesId);
        if (existing) {
          if (!existing.imageIndices.includes(imageIndex)) {
            existing.imageIndices.push(imageIndex);
          }
        } else {
          speciesMap.set(value.speciesId, {
            speciesName: value.speciesName,
            imageIndices: [imageIndex],
          });
        }
      });
    });

    return Array.from(speciesMap.entries()).map(([speciesId, data]) => ({
      speciesId,
      speciesName: data.speciesName,
      imageIndices: data.imageIndices,
    }));
  }, [classifications]);

  const selectedImageCount = useMemo(() => {
    let count = 0;
    reviewData.forEach(({ speciesId, imageIndices }) => {
      imageIndices.forEach((idx) => {
        const key = `${speciesId}-${idx}`;
        if (!deselectedImages.has(key)) count++;
      });
    });
    return count;
  }, [reviewData, deselectedImages]);

  const toggleImageSelection = (speciesId: number, imageIndex: number) => {
    const key = `${speciesId}-${imageIndex}`;
    setDeselectedImages((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // ============================================================================
  // Step 5: Save
  // ============================================================================

  const handleSave = async () => {
    if (!selectedSurveyType || !selectedDevice || !date) return;

    setSaving(true);
    setError(null);

    try {
      // 1. Create survey
      setSaveProgress({ step: 'Creating survey...', percent: 5 });
      let survey;
      try {
        survey = await surveysAPI.create({
          date: date.format('YYYY-MM-DD'),
          survey_type_id: selectedSurveyType.id,
          device_id: selectedDevice.id,
          surveyor_ids: selectedSurveyors.map((s) => s.id),
        });
      } catch (createErr: unknown) {
        throw new Error(`Failed to create survey: ${createErr instanceof Error ? createErr.message : String(createErr)}`);
      }

      // 2. Build set of unique image indices to upload (across all species)
      const imageIndicesToUpload = new Set<number>();

      reviewData.forEach(({ speciesId, imageIndices }) => {
        imageIndices.forEach((idx) => {
          const key = `${speciesId}-${idx}`;
          if (!deselectedImages.has(key)) {
            imageIndicesToUpload.add(idx);
          }
        });
      });

      const imagesToUpload = Array.from(imageIndicesToUpload).map((idx) => ({
        idx,
        file: imageFiles[idx].file,
        exifDate: imageFiles[idx].exifDate,
      }));

      const totalFiles = imagesToUpload.length;

      // 3. Upload in batches
      setSaveProgress({ step: `Uploading ${totalFiles} images...`, percent: 10 });
      const uploadedImages = new Map<number, CameraTrapImage>(); // imageIndex -> CameraTrapImage

      for (let i = 0; i < imagesToUpload.length; i += UPLOAD_BATCH_SIZE) {
        const batch = imagesToUpload.slice(i, i + UPLOAD_BATCH_SIZE);
        const batchFiles = batch.map((entry) => entry.file);

        // Build timestamps metadata
        const timestamps: Record<string, string> = {};
        batch.forEach((entry) => {
          if (entry.exifDate) {
            timestamps[entry.file.name] = entry.exifDate.toISOString();
          }
        });

        let result;
        try {
          result = await imagesAPI.uploadFilesWithMetadata(
            survey.id,
            batchFiles,
            Object.keys(timestamps).length > 0 ? timestamps : undefined,
            true // skip processing
          );
        } catch (uploadErr: unknown) {
          throw new Error(`Failed to upload images (batch ${Math.floor(i / UPLOAD_BATCH_SIZE) + 1}): ${uploadErr instanceof Error ? uploadErr.message : String(uploadErr)}`);
        }

        // Map uploaded images back to their indices
        batch.forEach((entry, batchIdx) => {
          if (result[batchIdx]) {
            uploadedImages.set(entry.idx, result[batchIdx]);
          }
        });

        const uploadPercent = 10 + Math.round(((i + batch.length) / totalFiles) * 60);
        setSaveProgress({ step: `Uploaded ${Math.min(i + UPLOAD_BATCH_SIZE, totalFiles)} of ${totalFiles} images...`, percent: uploadPercent });
      }

      // 4. Create sightings per species
      setSaveProgress({ step: 'Creating sightings...', percent: 75 });

      for (const { speciesId, imageIndices } of reviewData) {
        const selectedIndices = imageIndices.filter(
          (idx) => !deselectedImages.has(`${speciesId}-${idx}`)
        );
        if (selectedIndices.length === 0) continue;

        const individuals = selectedIndices
          .map((idx) => {
            const uploaded = uploadedImages.get(idx);
            if (!uploaded) return null;
            return {
              latitude: selectedDevice.latitude!,
              longitude: selectedDevice.longitude!,
              count: 1,
              camera_trap_image_id: uploaded.id,
            };
          })
          .filter((ind): ind is NonNullable<typeof ind> => ind !== null);

        if (individuals.length === 0) continue;

        await surveysAPI.addSighting(survey.id, {
          species_id: speciesId,
          count: individuals.length,
          individuals,
        });
      }

      setSaveProgress({ step: 'Done!', percent: 100 });

      // Navigate to survey detail
      navigate(`/surveys/${survey.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save survey');
      setSaving(false);
    }
  };

  // ============================================================================
  // Step validation
  // ============================================================================

  const classifiedCount = classifications.size;
  const uniqueSpeciesCount = new Set(Array.from(classifications.values()).flatMap((list) => list.map((c) => c.speciesId))).size;
  const viewedCount = viewedImages.size;
  const remainingCount = filteredImageFiles.length - viewedCount;

  const canProceed = (step: number): boolean => {
    switch (step) {
      case 0: // Setup
        return !!selectedSurveyType && !!selectedDevice && !!date && selectedSurveyors.length > 0;
      case 1: // Upload
        return imageFiles.length > 0;
      case 2: // Filter
        return !filtering && filterResults.size === imageFiles.length && filteredImageFiles.length > 0;
      case 3: // Classify
        return classifiedCount > 0;
      case 4: // Review
        return selectedImageCount > 0;
      default:
        return false;
    }
  };

  // ============================================================================
  // Auth guard
  // ============================================================================

  if (authLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <Alert severity="warning">Please sign in to create a camera trap survey.</Alert>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <Box sx={{ p: 4 }}>
      <PageHeader
        backButton={{ href: '/surveys' }}
        actions={
          <Button
            variant="outlined"
            startIcon={<Cancel />}
            onClick={() => navigate('/surveys')}
            sx={{ textTransform: 'none' }}
          >
            Cancel
          </Button>
        }
      />

      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {WIZARD_STEPS.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* ================================================================ */}
      {/* Step 1: Setup                                                     */}
      {/* ================================================================ */}
      {activeStep === 0 && (
        <>
          <Paper sx={{ p: 3, mb: 3, boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              Survey Type
            </Typography>
            <Autocomplete
              options={surveyTypes}
              getOptionLabel={(option) => option.name}
              value={selectedSurveyType}
              onChange={(_, value) => setSelectedSurveyType(value)}
              renderInput={(params) => (
                <TextField {...params} label="Survey Type" required />
              )}
            />
          </Paper>

          {selectedSurveyType && (
            <Paper sx={{ p: 3, boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                Survey Details
              </Typography>
              <Stack spacing={3}>
                <Autocomplete
                  options={devices}
                  getOptionLabel={(option) =>
                    option.name ? `${option.name} (${option.device_id})` : option.device_id
                  }
                  value={selectedDevice}
                  onChange={(_, value) => setSelectedDevice(value)}
                  renderInput={(params) => (
                    <TextField {...params} label="Device" required />
                  )}
                  noOptionsText="No camera trap devices found. Add one in Admin > Devices."
                />
                {selectedDevice && !selectedDevice.latitude && (
                  <Alert severity="warning">
                    This device has no GPS coordinates set. Sightings will not have location data.
                  </Alert>
                )}
                <DatePicker
                  label="Date"
                  value={date}
                  onChange={setDate}
                  slotProps={{ textField: { required: true, fullWidth: true } }}
                />
                <Autocomplete
                  multiple
                  options={surveyors}
                  getOptionLabel={(option) => option.last_name ? `${option.first_name} ${option.last_name}` : option.first_name}
                  value={selectedSurveyors}
                  onChange={(_, value) => setSelectedSurveyors(value)}
                  disableCloseOnSelect
                  renderInput={(params) => (
                    <TextField {...params} label="Surveyors" required />
                  )}
                />
              </Stack>
              <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="contained"
                  endIcon={<ArrowForward />}
                  disabled={!canProceed(0)}
                  onClick={() => setActiveStep(1)}
                  sx={{ textTransform: 'none' }}
                >
                  Next
                </Button>
              </Box>
            </Paper>
          )}
        </>
      )}

      {/* ================================================================ */}
      {/* Step 2: Upload                                                    */}
      {/* ================================================================ */}
      {activeStep === 1 && (
        <Paper sx={{ p: 3, boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            Select Images
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select the image files from your camera trap. Images will be sorted by date.
          </Typography>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".jpg,.jpeg,.png"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />

          <Button
            variant="outlined"
            startIcon={loadingImages ? <CircularProgress size={20} /> : <CloudUpload />}
            onClick={() => fileInputRef.current?.click()}
            disabled={loadingImages}
            sx={{ textTransform: 'none', mb: 2 }}
          >
            {loadingImages ? 'Processing...' : 'Select Images'}
          </Button>

          {imageFiles.length > 0 && (
            <>
              <Typography variant="body2" sx={{ mb: 2 }}>
                <strong>{imageFiles.length}</strong> images loaded
                {imageFiles[0]?.exifDate && (
                  <> &mdash; {dayjs(imageFiles[0].exifDate).format('DD/MM/YYYY')} to {dayjs(imageFiles[imageFiles.length - 1]?.exifDate).format('DD/MM/YYYY')}</>
                )}
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                  gap: 1,
                  maxHeight: 400,
                  overflow: 'auto',
                }}
              >
                {imageFiles.slice(0, 100).map((img, idx) => (
                  <Box key={idx} sx={{ position: 'relative' }}>
                    <img
                      src={img.objectUrl}
                      alt={img.filename}
                      loading="lazy"
                      style={{
                        width: '100%',
                        height: 100,
                        objectFit: 'cover',
                        borderRadius: 4,
                      }}
                    />
                    {img.exifDate && (
                      <Typography
                        variant="caption"
                        sx={{
                          position: 'absolute',
                          bottom: 2,
                          left: 2,
                          bgcolor: 'rgba(0,0,0,0.6)',
                          color: 'white',
                          px: 0.5,
                          borderRadius: 0.5,
                          fontSize: '0.65rem',
                        }}
                      >
                        {dayjs(img.exifDate).format('DD/MM HH:mm')}
                      </Typography>
                    )}
                  </Box>
                ))}
                {imageFiles.length > 100 && (
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: 100,
                      bgcolor: 'action.hover',
                      borderRadius: 1,
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      +{imageFiles.length - 100} more
                    </Typography>
                  </Box>
                )}
              </Box>
            </>
          )}

          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between' }}>
            <Button
              startIcon={<ArrowBack />}
              onClick={() => setActiveStep(0)}
              sx={{ textTransform: 'none' }}
            >
              Back
            </Button>
            <Button
              variant="contained"
              endIcon={<ArrowForward />}
              disabled={!canProceed(1)}
              onClick={() => setActiveStep(2)}
              sx={{ textTransform: 'none' }}
            >
              Next: Filter Images
            </Button>
          </Box>
        </Paper>
      )}

      {/* ================================================================ */}
      {/* Step 3: Filter                                                    */}
      {/* ================================================================ */}
      {activeStep === 2 && imageFiles.length > 0 && (
        <Paper sx={{ p: 3, boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            <FilterList sx={{ mr: 1, verticalAlign: 'middle' }} />
            Filter False Positives
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            AI is analysing your images to identify and remove empty frames (false positives triggered by wind, vegetation, etc.).
          </Typography>

          {/* Progress during filtering */}
          {filtering && (
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="body2" color="text.secondary">
                  Filtering image {filterProgress.processed} of {filterProgress.total}...
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {filterProgress.total > 0
                    ? `${Math.round((filterProgress.processed / filterProgress.total) * 100)}%`
                    : '0%'}
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={
                  filterProgress.total > 0
                    ? (filterProgress.processed / filterProgress.total) * 100
                    : 0
                }
                sx={{ height: 6, borderRadius: 3 }}
              />
            </Box>
          )}

          {/* Filter error */}
          {filterError && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {filterError}
              <Button
                size="small"
                onClick={() => { setFilterError(null); runFiltering(); }}
                sx={{ ml: 1, textTransform: 'none' }}
              >
                Retry
              </Button>
            </Alert>
          )}

          {/* Results */}
          {!filtering && filterResults.size > 0 && (() => {
            const currentResult = filterResults.get(filterViewIndex);
            const currentImg = imageFiles[filterViewIndex];
            const isRestored = restoredImages.has(filterViewIndex);
            const isOverriddenFP = falsePositiveOverrides.has(filterViewIndex);
            const isIncluded = isOverriddenFP ? false : (isRestored || (currentResult?.has_animal ?? true));

            // Helper to compute inclusion for any image index
            const isImageIncluded = (idx: number) => {
              const r = filterResults.get(idx);
              if (falsePositiveOverrides.has(idx)) return false;
              if (restoredImages.has(idx)) return true;
              return r?.has_animal ?? true;
            };

            // Build the two groups
            const animalIndices: number[] = [];
            const emptyIndices: number[] = [];
            imageFiles.forEach((_, idx) => {
              if (filterResults.has(idx)) {
                if (isImageIncluded(idx)) animalIndices.push(idx);
                else emptyIndices.push(idx);
              }
            });

            return (
              <>
                {/* Summary */}
                <Alert
                  severity={filterSummary.emptyCount > 0 ? 'success' : 'info'}
                  sx={{ mb: 2 }}
                >
                  {filterSummary.emptyCount > 0 ? (
                    <>
                      Found <strong>{filterSummary.animalCount}</strong> images with animals and{' '}
                      <strong>{filterSummary.emptyCount}</strong> empty/false positive images
                      {filterSummary.personCount > 0 && (
                        <> ({filterSummary.personCount} with people)</>
                      )}
                      . Empty images will be excluded from classification.
                    </>
                  ) : (
                    <>All {filterSummary.animalCount} images appear to contain animals.</>
                  )}
                </Alert>

                {/* Full-size image viewer */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                  <Typography variant="body2" color="text.secondary">
                    {currentImg?.filename}
                    {currentImg?.exifDate && (
                      <> &mdash; {dayjs(currentImg.exifDate).format('DD/MM/YYYY HH:mm:ss')}</>
                    )}
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip
                      label={isIncluded ? 'Included' : 'Excluded'}
                      size="small"
                      color={isIncluded ? 'success' : 'default'}
                      variant={isIncluded ? 'filled' : 'outlined'}
                    />
                    {isIncluded ? (
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        startIcon={<RemoveCircleOutline />}
                        onClick={() => {
                          if (isRestored) {
                            setRestoredImages((prev) => { const next = new Set(prev); next.delete(filterViewIndex); return next; });
                          } else {
                            setFalsePositiveOverrides((prev) => { const next = new Set(prev); next.add(filterViewIndex); return next; });
                          }
                        }}
                        sx={{ textTransform: 'none' }}
                      >
                        Exclude
                      </Button>
                    ) : (
                      <Button
                        size="small"
                        variant="outlined"
                        color="success"
                        startIcon={<Restore />}
                        onClick={() => {
                          if (isOverriddenFP) {
                            setFalsePositiveOverrides((prev) => { const next = new Set(prev); next.delete(filterViewIndex); return next; });
                          } else {
                            setRestoredImages((prev) => { const next = new Set(prev); next.add(filterViewIndex); return next; });
                          }
                        }}
                        sx={{ textTransform: 'none' }}
                      >
                        Restore
                      </Button>
                    )}
                  </Stack>
                </Box>

                <Box
                  sx={{
                    position: 'relative',
                    display: 'flex',
                    justifyContent: 'center',
                    bgcolor: 'black',
                    borderRadius: 1,
                    overflow: 'hidden',
                    mb: 2,
                    maxHeight: '50vh',
                    opacity: isIncluded ? 1 : 0.5,
                  }}
                >
                  <img
                    ref={filterImageRef}
                    src={currentImg?.objectUrl}
                    alt={currentImg?.filename}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '50vh',
                      objectFit: 'contain',
                    }}
                  />
                  {/* Bounding box overlays */}
                  {currentResult?.detections?.map((det, detIdx) => (
                    <Box
                      key={detIdx}
                      sx={{
                        position: 'absolute',
                        left: `${det.x * 100}%`,
                        top: `${det.y * 100}%`,
                        width: `${det.w * 100}%`,
                        height: `${det.h * 100}%`,
                        border: '2.5px solid',
                        borderColor: det.category === 'animal' ? '#f44336' : det.category === 'person' ? '#ff9800' : '#2196f3',
                        pointerEvents: 'none',
                        '&::after': {
                          content: `"${det.category} ${(det.confidence * 100).toFixed(0)}%"`,
                          position: 'absolute',
                          top: -18,
                          left: -2,
                          bgcolor: det.category === 'animal' ? '#f44336' : det.category === 'person' ? '#ff9800' : '#2196f3',
                          color: 'white',
                          fontSize: '0.65rem',
                          fontWeight: 600,
                          px: 0.5,
                          py: 0.1,
                          borderRadius: '2px 2px 0 0',
                          whiteSpace: 'nowrap',
                        },
                      }}
                    />
                  ))}
                </Box>

                {/* Image info below viewer */}
                <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                  {currentResult ? (
                    <>
                      Confidence: {(currentResult.max_confidence * 100).toFixed(0)}%
                      {currentResult.detections?.length > 0 && (
                        <> &middot; {currentResult.detections.length} detection{currentResult.detections.length !== 1 ? 's' : ''}</>
                      )}
                      {currentResult.detections?.length === 0 && !currentResult.has_animal && (
                        <> &middot; No animals detected</>
                      )}
                    </>
                  ) : 'No result'}
                </Typography>

                {/* Navigation arrows */}
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 3 }}>
                  <IconButton
                    onClick={() => setFilterViewIndex((prev) => Math.max(0, prev - 1))}
                    disabled={filterViewIndex === 0}
                  >
                    <ArrowBack />
                  </IconButton>
                  <IconButton
                    onClick={() => setFilterViewIndex((prev) => Math.min(imageFiles.length - 1, prev + 1))}
                    disabled={filterViewIndex === imageFiles.length - 1}
                  >
                    <ArrowForward />
                  </IconButton>
                </Stack>

                {/* Two-group thumbnail sections */}
                {emptyIndices.length > 0 && (
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                      Empty / No Animal Detected ({emptyIndices.length})
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      These images will be excluded. Click to review, then Restore any the AI got wrong.
                    </Typography>
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                        gap: 0.5,
                        maxHeight: 300,
                        overflow: 'auto',
                      }}
                    >
                      {emptyIndices.map((idx) => (
                        <Box
                          key={idx}
                          onClick={() => setFilterViewIndex(idx)}
                          sx={{
                            cursor: 'pointer',
                            borderRadius: 0.5,
                            overflow: 'hidden',
                            opacity: 0.6,
                            border: '2px solid',
                            borderColor: idx === filterViewIndex ? 'primary.main' : 'transparent',
                            transition: 'opacity 0.15s',
                            '&:hover': { opacity: 0.9 },
                          }}
                        >
                          <img
                            src={imageFiles[idx].objectUrl}
                            alt={imageFiles[idx].filename}
                            loading="lazy"
                            style={{ width: '100%', height: 75, objectFit: 'cover' }}
                          />
                        </Box>
                      ))}
                    </Box>
                  </Box>
                )}

                <Box sx={{ mb: 2 }}>
                  <Button
                    onClick={() => setShowAnimalImages(!showAnimalImages)}
                    startIcon={showAnimalImages ? <ExpandLess /> : <ExpandMore />}
                    sx={{ textTransform: 'none', mb: 1, color: 'text.primary', p: 0 }}
                  >
                    <Typography variant="subtitle2" fontWeight={600}>
                      Images with Animals ({animalIndices.length})
                    </Typography>
                  </Button>
                  {showAnimalImages && (
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                        gap: 0.5,
                        maxHeight: 300,
                        overflow: 'auto',
                      }}
                    >
                      {animalIndices.map((idx) => (
                        <Box
                          key={idx}
                          onClick={() => setFilterViewIndex(idx)}
                          sx={{
                            cursor: 'pointer',
                            borderRadius: 0.5,
                            overflow: 'hidden',
                            border: '2px solid',
                            borderColor: idx === filterViewIndex ? 'primary.main' : 'transparent',
                            '&:hover': { opacity: 0.8 },
                          }}
                        >
                          <img
                            src={imageFiles[idx].objectUrl}
                            alt={imageFiles[idx].filename}
                            loading="lazy"
                            style={{ width: '100%', height: 75, objectFit: 'cover' }}
                          />
                        </Box>
                      ))}
                    </Box>
                  )}
                </Box>
              </>
            );
          })()}

          {/* Navigation */}
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between' }}>
            <Button
              startIcon={<ArrowBack />}
              onClick={() => {
                setActiveStep(1);
                // Clear filter state when going back to upload
                setFilterResults(new Map());
                setFalsePositiveOverrides(new Set());
                setRestoredImages(new Set());
                setFilterError(null);
              }}
              sx={{ textTransform: 'none' }}
            >
              Back
            </Button>
            <Stack direction="row" spacing={1}>
              {filterError && (
                <Button
                  variant="outlined"
                  onClick={() => {
                    setFilterError(null);
                    setActiveStep(3);
                  }}
                  sx={{ textTransform: 'none' }}
                >
                  Skip Filtering
                </Button>
              )}
              <Button
                variant="contained"
                endIcon={<ArrowForward />}
                disabled={!canProceed(2)}
                onClick={() => {
                  setCurrentImageIndex(0);
                  setClassifications(new Map());
                  setViewedImages(new Set());
                  setActiveStep(3);
                }}
                sx={{ textTransform: 'none' }}
              >
                Next: Classify ({filteredImageFiles.length} images)
              </Button>
            </Stack>
          </Box>
        </Paper>
      )}

      {/* ================================================================ */}
      {/* Step 4: Classify                                                  */}
      {/* ================================================================ */}
      {activeStep === 3 && filteredImageFiles.length > 0 && (
        <Paper sx={{ p: 3, boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
          {/* Progress bar */}
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="body2" color="text.secondary">
                Image {currentImageIndex + 1} of {filteredImageFiles.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Viewed {viewedCount} of {filteredImageFiles.length} · {uniqueSpeciesCount} species identified
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={(viewedCount / filteredImageFiles.length) * 100}
              sx={{ height: 6, borderRadius: 3 }}
            />
          </Box>

          {/* Current classification indicator */}
          {(classifications.get(currentImageIndex)?.length ?? 0) > 0 && (
            <Stack direction="row" spacing={0.5} sx={{ mb: 1, flexWrap: 'wrap', gap: 0.5 }}>
              {classifications.get(currentImageIndex)!.map((cls) => (
                <Chip
                  key={cls.speciesId}
                  label={cls.speciesName}
                  size="small"
                  color="primary"
                  onDelete={() => {
                    setClassifications((prev) => {
                      const next = new Map(prev);
                      const existing = next.get(currentImageIndex) || [];
                      const filtered = existing.filter((c) => c.speciesId !== cls.speciesId);
                      if (filtered.length === 0) {
                        next.delete(currentImageIndex);
                      } else {
                        next.set(currentImageIndex, filtered);
                      }
                      return next;
                    });
                  }}
                />
              ))}
            </Stack>
          )}

          {/* Main image */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              bgcolor: 'black',
              borderRadius: 1,
              overflow: 'hidden',
              mb: 2,
              maxHeight: '50vh',
            }}
          >
            <img
              src={filteredImageFiles[currentImageIndex].objectUrl}
              alt={filteredImageFiles[currentImageIndex].filename}
              style={{
                maxWidth: '100%',
                maxHeight: '50vh',
                objectFit: 'contain',
              }}
            />
          </Box>

          {/* Image info */}
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            {filteredImageFiles[currentImageIndex].filename}
            {filteredImageFiles[currentImageIndex].exifDate && (
              <> &mdash; {dayjs(filteredImageFiles[currentImageIndex].exifDate).format('DD/MM/YYYY HH:mm:ss')}</>
            )}
          </Typography>

          {/* Species selection */}
          <Autocomplete
            options={species}
            getOptionLabel={(option) =>
              option.name ? `${option.name} (${option.scientific_name || ''})` : option.scientific_name || ''
            }
            value={null}
            inputValue={speciesSearchValue}
            onInputChange={(_, value) => setSpeciesSearchValue(value)}
            onChange={(_, value) => {
              if (value) {
                classifyImage(value.id, value.name || value.scientific_name || 'Unknown');
              }
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                inputRef={speciesInputRef}
                label="Select species"
                placeholder="Type to search..."
                size="small"
              />
            )}
            sx={{ mb: 2 }}
            clearOnBlur={false}
            blurOnSelect
          />

          {/* Navigation */}
          <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <IconButton onClick={goToPrev} disabled={currentImageIndex === 0}>
                <ArrowBack />
              </IconButton>
              <IconButton onClick={goToNext} disabled={currentImageIndex === filteredImageFiles.length - 1}>
                <ArrowForward />
              </IconButton>
            </Stack>
            {remainingCount > 0 && (
              <Button
                size="small"
                onClick={goToNextUnviewed}
                sx={{ textTransform: 'none' }}
              >
                Next unviewed →
              </Button>
            )}
          </Stack>

          {/* Thumbnail strip */}
          <Box
            ref={thumbnailStripRef}
            sx={{
              display: 'flex',
              gap: 0.5,
              overflow: 'auto',
              py: 1,
              '&::-webkit-scrollbar': { height: 6 },
              '&::-webkit-scrollbar-thumb': { bgcolor: 'divider', borderRadius: 3 },
            }}
          >
            {filteredImageFiles.map((img, idx) => {
              const hasClassifications = (classifications.get(idx)?.length ?? 0) > 0;
              const isViewed = viewedImages.has(idx);
              const isCurrent = idx === currentImageIndex;
              return (
                <Box
                  key={idx}
                  onClick={() => { setCurrentImageIndex(idx); setSpeciesSearchValue(''); }}
                  sx={{
                    flexShrink: 0,
                    width: 56,
                    height: 42,
                    borderRadius: 0.5,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    border: isCurrent ? '2px solid' : '2px solid transparent',
                    borderColor: isCurrent ? 'primary.main' : 'transparent',
                    opacity: isViewed ? 1 : 0.35,
                    position: 'relative',
                  }}
                >
                  <img
                    src={img.objectUrl}
                    alt=""
                    loading="lazy"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  {hasClassifications && (
                    <CheckCircle
                      sx={{
                        position: 'absolute',
                        top: 1,
                        right: 1,
                        fontSize: 14,
                        color: 'success.main',
                        bgcolor: 'white',
                        borderRadius: '50%',
                      }}
                    />
                  )}
                </Box>
              );
            })}
          </Box>

          {remainingCount === 0 && (
            <Alert severity="success" sx={{ mt: 2 }}>
              All images reviewed! {uniqueSpeciesCount} species identified.
            </Alert>
          )}

          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between' }}>
            <Button
              startIcon={<ArrowBack />}
              onClick={() => setActiveStep(2)}
              sx={{ textTransform: 'none' }}
            >
              Back
            </Button>
            <Button
              variant="contained"
              endIcon={<ArrowForward />}
              disabled={!canProceed(3)}
              onClick={() => setActiveStep(4)}
              sx={{ textTransform: 'none' }}
            >
              Next: Review ({uniqueSpeciesCount} species identified)
            </Button>
          </Box>
        </Paper>
      )}

      {/* ================================================================ */}
      {/* Step 5: Review                                                    */}
      {/* ================================================================ */}
      {activeStep === 4 && (
        <Paper sx={{ p: 3, boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            Review Classifications
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {reviewData.length} species identified, {selectedImageCount} images to save.
            Deselect any images you don't want to keep.
          </Typography>

          {reviewData.length === 0 && (
            <Alert severity="info" sx={{ mb: 2 }}>
              No species have been classified yet. Go back and classify some images.
            </Alert>
          )}

          <Stack spacing={3}>
            {reviewData.map(({ speciesId, speciesName, imageIndices }) => {
              const selectedCount = imageIndices.filter(
                (idx) => !deselectedImages.has(`${speciesId}-${idx}`)
              ).length;

              return (
                <Box key={speciesId}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <PhotoCamera fontSize="small" color="action" />
                    <Typography variant="subtitle1" fontWeight={600}>
                      {speciesName}
                    </Typography>
                    <Chip
                      label={`${selectedCount} of ${imageIndices.length} images`}
                      size="small"
                      color={selectedCount > 0 ? 'primary' : 'default'}
                    />
                  </Box>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                      gap: 1,
                    }}
                  >
                    {imageIndices.map((idx) => {
                      const key = `${speciesId}-${idx}`;
                      const isSelected = !deselectedImages.has(key);
                      return (
                        <Box
                          key={idx}
                          onClick={() => toggleImageSelection(speciesId, idx)}
                          sx={{
                            position: 'relative',
                            cursor: 'pointer',
                            opacity: isSelected ? 1 : 0.4,
                            border: isSelected ? '2px solid' : '2px solid transparent',
                            borderColor: isSelected ? 'primary.main' : 'transparent',
                            borderRadius: 1,
                            overflow: 'hidden',
                            transition: 'opacity 0.15s',
                          }}
                        >
                          <img
                            src={imageFiles[idx].objectUrl}
                            alt={imageFiles[idx].filename}
                            loading="lazy"
                            style={{
                              width: '100%',
                              height: 100,
                              objectFit: 'cover',
                            }}
                          />
                          <Checkbox
                            checked={isSelected}
                            size="small"
                            sx={{
                              position: 'absolute',
                              top: 0,
                              right: 0,
                              bgcolor: 'rgba(255,255,255,0.8)',
                              borderRadius: 0,
                              p: 0.25,
                            }}
                            onClick={(e) => e.stopPropagation()}
                            onChange={() => toggleImageSelection(speciesId, idx)}
                          />
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              );
            })}
          </Stack>

          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between' }}>
            <Button
              startIcon={<ArrowBack />}
              onClick={() => setActiveStep(3)}
              sx={{ textTransform: 'none' }}
            >
              Back to Classify
            </Button>
            <Button
              variant="contained"
              startIcon={<Save />}
              disabled={!canProceed(4)}
              onClick={() => { setActiveStep(5); handleSave(); }}
              sx={{ textTransform: 'none' }}
            >
              Save Survey ({selectedImageCount} images)
            </Button>
          </Box>
        </Paper>
      )}

      {/* ================================================================ */}
      {/* Step 6: Save                                                      */}
      {/* ================================================================ */}
      {activeStep === 5 && (
        <Paper sx={{ p: 3, textAlign: 'center', boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
          {saving ? (
            <>
              <CircularProgress sx={{ mb: 2 }} />
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                {saveProgress.step}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={saveProgress.percent}
                sx={{ height: 8, borderRadius: 4, maxWidth: 400, mx: 'auto' }}
              />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {saveProgress.percent}%
              </Typography>
            </>
          ) : error ? (
            <>
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
              <Button
                variant="contained"
                onClick={() => { setError(null); handleSave(); }}
                sx={{ textTransform: 'none' }}
              >
                Retry
              </Button>
            </>
          ) : (
            <>
              <CheckCircle sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
              <Typography variant="h6">Survey saved successfully!</Typography>
            </>
          )}
        </Paper>
      )}
    </Box>
  );
}
