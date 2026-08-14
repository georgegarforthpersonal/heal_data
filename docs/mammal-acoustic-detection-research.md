# Acoustic detection of pine marten & wildcat — research findings and recommendation

*Research date: 2026-08-13. Question: can we extend the BirdNET audio pipeline
(`services/bird_audio.py`) to detect pine marten (Martes martes) and European
wildcat (Felis silvestris), both known present on site?*

## TL;DR

**Passive acoustic monitoring (PAM) cannot be the primary detection method for
either species** — they are largely silent mammals, the science is thin to
non-existent, and (for wildcat) an acoustic hit can never be attributed to
species level. **The proven method for both is camera trapping — which we
already run** (MegaDetector + EVA02/iNat21). Audio can still play a useful
*secondary* role, and there is a surprisingly cheap way to add it: **Google's
Perch 2.0 model already has `Martes martes`, `Felis silvestris` and
`Felis catus` output classes and is loadable through our existing `birdnet`
dependency** (`birdnet.load_perch_v2("CPU")`). Nobody has published a test of
those classes; testing them against the ~40 archival clips that exist costs an
afternoon and settles feasibility empirically.

## Why BirdNET can't do this

Verified against the actual v2.4 label file (6,522 classes,
[mirror](https://huggingface.co/justinchuby/BirdNET-onnx/blob/refs%2Fpr%2F1/BirdNET_GLOBAL_6K_V2.4_Labels.txt)):
the only mammals are coyote, gray wolf, white-tailed deer, eastern gray
squirrel, red squirrel, eastern chipmunk — all North American. There is a
`Dog` class but no cat of any kind, no mustelids, no European mammals. Any
marten/cat sound in our recordings today is being absorbed into `Noise`,
`Dog`, `Environmental`, or misread as a bird.

## Species feasibility

### Pine marten — marginal, untested, worth a cheap seasonal pilot

- **Essentially unstudied acoustically.** No peer-reviewed quantitative
  bioacoustic description of *M. martes* exists (Europe PMC sweep: 241 hits on
  the species, none on vocalisation; no published frequency/duration data —
  Kvalheim 1982 names 8 call types in Norwegian thesis literature but gives no
  measurements). Nearest anchors: *M. americana* (Belan et al. 1978,
  J. Mammalogy 59:871 — 7 call types) and stone marten (*M. foina*,
  Simeonovska-Nikolova 2016 — mating calls, all energy < 2.2 kHz). Only 12 of
  60 mustelid species have any published adult repertoire at all (Mumm &
  Knörnschild 2018, [Mustelid Communication](https://doi.org/10.1007/978-3-319-47829-6_1191-1)).
- **Recorder bandwidth caveat: sample at 96 kHz+ if possible.** Stoats were
  recently shown to produce true ultrasonic calls concentrated at ~21–28 kHz,
  ~3× more often than audible calls (Barzegartabrizi et al. 2026,
  [NZ J Ecol 50:3640](https://doi.org/10.20417/nzjecol.50.3640), CC BY; open
  dataset on Kaggle) — and classic mustelid studies used gear that physically
  couldn't record ultrasound, so "mustelids are quiet" is partly a bandwidth
  artefact. No marten ultrasound is reported anywhere, so 48 kHz is probably
  fine for *Martes*, but an AudioMoth at 96 kHz+ hedges cheaply. (Note Perch
  ingests at 32 kHz — a USV pilot would need a separate analysis path, e.g.
  the BTO Pipeline's ultrasonic classifiers as precedent.) **Co-benefit:** the
  same ultrasonic-capable recordings can be run through the BTO Acoustic
  Pipeline's proven classifiers (~26 small terrestrial mammals + bats — the
  approach behind e.g. the Exeter/Jersey shrew-survey project,
  [BBC 2026](https://www.bbc.co.uk/news/articles/crmprw2mmrwo)), giving a
  validated survey of the martens'/wildcats' prey base for free alongside the
  speculative detection work.
- **Mating-season periodicity has one mustelid precedent:** male European
  badgers churr almost exclusively Jan–Mar (Charlton et al. 2020,
  [Mamm Biol 100:429](https://doi.org/10.1007/s42991-020-00033-x)) — the only
  published demonstration of breeding-season vocal periodicity in any
  mustelid. It supports, by analogy, the untested Jul–Aug pine marten
  calling-peak hypothesis.
- **Rarely vocal outside the Jul–Aug mating season** ("usually the only time
  pine martens make any noise" — multiple UK sources). Repertoire: chuckles,
  growls, screams, "kekking", a cat-like yowl.
- **No PAM study exists for any mustelid**, and the BTO Acoustic Pipeline —
  trained on >90k curated UK recordings — covers bats, 26 small mammals and
  bush-crickets but deliberately no mustelids or felids.
- **Global training data: ~60–70 recordings, only ~35–45 downloadable, and
  perhaps 10–15 independent recording events** once duplication by
  recordist/session is accounted for. Verified per source: iNaturalist 19
  audio obs (8 research-grade; an earlier count of 111 was a fuzzy-name-match
  artefact), xeno-canto 9 (via its GBIF land-mammal mirror), Tierstimmenarchiv
  Berlin 8 (7.5 min total, CC BY-SA, 7 of 8 captive-zoo recordings by Günter
  Tembrock; one wild mating call), British Library ~24 catalogue items but
  **zero digitally accessible** post-cyber-attack (largest tranche: Lawrence
  Shove, Scotland 1969), Macaulay 0, Freesound ~0, Zenodo/Dryad 0 datasets.
  Openly licensed audio totals ~20–40 minutes. Supervised classifier training
  from public data is **not feasible**; few-shot embedding retrieval is the
  only public-data route. Useful adjacent corpora: stone marten *M. foina*
  (~140 min Tierstimmenarchiv + 57 iNat clips) as the closest acoustic
  analogue, and the stoat dataset from Barzegartabrizi et al. 2026 (Kaggle
  `mabiran/stoat-vocalisations`) — the only labelled mustelid corpus in
  existence. No mustelid class exists in AudioSet/FSD50K/ESC-50, so there is
  no off-the-shelf confusion set either.
- **Best data lead:** Dan Bagur's *Pine Marten: The Secret Life of Martes
  martes* (Pelagic, 2025) contains "the most comprehensive pine marten sound
  library yet published" — he holds the largest collection in existence.

### Wildcat — not viable at species level from audio, full stop

- Free-ranging cats **rarely vocalise**; meows are short-range contact calls.
  The only loud call (caterwaul) is confined to the **Jan–Mar** mating window.
- The definitive systematic review (Prager et al. 2026, *Bioacoustics*,
  [10.1080/09524622.2026.2648721](https://www.tandfonline.com/doi/full/10.1080/09524622.2026.2648721)):
  51 publications ever across all 40 wild felid species; no field PAM study
  on any small felid. **~13 genuine *F. silvestris* recordings exist across
  xeno-canto + Macaulay + iNat combined.**
- **The domestic-cat problem is terminal.** The one study separating European
  wildcat from domestic meows (Schnaider et al. 2025, *Sci Rep*, 93.3% for
  *F. silvestris*) used 6 archival captive wildcats vs 4 Berlin house cats —
  channel confounds unexcluded, no field validation, silent on hybrids. Wild
  populations are a **hybrid swarm** (NatureScot): if 35 SNPs + 7-point pelage
  scoring are jointly equivocal, audio has no chance. And near Bath the base
  rate means essentially every acoustic "cat" is a domestic/feral cat.
- **Data trap:** of 48 GBIF `Felis silvestris` sound records, 30 are
  `Felis_silvestris_f_domestica` — domestic cats under the obsolete name.
  82% of Tierstimmenarchiv's "Felis silvestris" rows are house cats. Any
  scrape-by-scientific-name builds a domestic-cat classifier. Perch 2.0
  ingested this archive, so its `Felis silvestris` class should be treated as
  **"cat sp."** until proven otherwise.
- **What every wildcat programme actually uses:** camera traps at ≤1.5 km
  spacing, 60-day winter surveys, **valerian-root scent lures**, hair traps →
  genetics, GPS collars on released animals (Saving Wildcats; Scottish
  Wildcat Action protocol; Kilshaw et al., *Oryx*). The Devon Wildlife
  Trust / Derek Gow South West feasibility report (~90k words) mentions
  acoustics **zero times**.

### The comparative evidence

Hoefer et al. 2025 (*Methods Ecol Evol* 16:2603, 317k audio-hours) ranked
methods for terrestrial mammal communities: **observers > camera traps > PAM**.
The only terrestrial-carnivore BirdNET extension published (wolf/coyote,
Sossover et al. 2024, *Mammal Research*) had low real-world precision for
wolves — a loud, frequently-howling species. Our targets are far harder.

## Recommendation

### 1. Lead with the camera-trap pipeline (proven, already built)

- Verify `Martes martes` and `Felis silvestris`/`catus` coverage in our
  EVA02/iNat21 classifier labels (both species are in iNat21's 10k species
  with high probability — check `services/camera_trap.py` label set).
- Field-side: valerian lures + hair-trap posts for wildcat (Jan–Mar peak),
  camera placement informed by any audio flags. Species-level wildcat ID
  ultimately needs pelage scoring / genetics, not any classifier.

### 2. Audio pilot: test Perch 2.0's native classes first (an afternoon)

```python
import birdnet
model = birdnet.load_perch_v2("CPU")   # needs TF >= 2.20 — already satisfied
preds = model.predict(
    clip,
    custom_species_list=["Martes martes", "Felis silvestris", "Felis catus"],
    apply_sigmoid=True, default_confidence_threshold=0.0, top_k=None,
)
```

Score the archival marten clips (Tierstimmenarchiv CC BY-SA, iNat, XC) plus a
domestic-cat set and our own recordings. Expect the marten class to be weak
and the wildcat class to behave as a domestic-cat detector — but nobody has
published this test, and it's the cheapest possible go/no-go.

Perch 2.0 facts: EfficientNet-B3, 5 s @ 32 kHz windows, 1536-d embeddings,
14,795 classes, **Apache 2.0** (vs BirdNET models' CC BY-NC-SA — source Perch
weights directly from HuggingFace if commercial use ever matters). Est.
CPU cost 5–10× BirdNET ≈ $0.02–0.04 per audio-hour on Modal (~$20–40/month
per 1,000 h) — compute is not the constraint. No public CPU benchmark exists;
measure before committing.

### 3. If the pilot shows signal: embeddings + linear probe, not a new model

The credible architecture (validated for mammals by Wood & Kahl 2024,
*Frontiers Ecol Evol*; Ghani et al. 2023, *Sci Rep* — usable probes from as
few as 4–16 examples/class):

- Embed all audio once with the **headless Perch2 ONNX embedder** (45 MB, no
  TF — `bioacoustics-model-zoo` `Perch2ONNX(headless=True)`); store 1536-d
  vectors in Postgres via **pgvector**.
- Nearest-neighbour search seeded from archival clips → label top hits →
  logistic-regression probe → repeat (agile-modelling loop; OpenSoundscape
  0.13 `SongSpace` implements exactly this).
- **Domestic cat as an explicit hard-negative class** (415 iNat + ~8k
  Freesound clips available).
- Validate on **held-out sites/days**, never random clip splits.
- Target listening windows: **marten Jul–Aug, cat Jan–Mar**.

### 4. Product framing

Never surface a species-level "Wildcat" audio detection. Honest outputs:
"pine marten (candidate — verify)" and **"cat vocalisation — species
indeterminate; confirm by camera/genetics"**, both routed to human review and
used to prioritise camera placement.

### Pipeline integration notes

- `services/processing.py` filters detection matches to
  `SpeciesType.name == "bird"` — mammal detections need that relaxed.
- The geo-model location filter is bird-only; mammal classes run outside it.
- Perch's 5 s @ 32 kHz grid ≠ BirdNET's 3 s @ 48 kHz — store Perch detections
  with their own offsets (or run with 2 s overlap to align hops).
- Perch labels are bare scientific names, so
  `get_db_scientific_name`'s `split("_", 1)[0]` passes them through unchanged.

### Data actions worth more than any modelling

1. **Email Stuart Newson (BTO Acoustic Pipeline)** — he can say authoritatively
   whether pine marten is detectable at ARU range; could save months.
2. **Email Dan Bagur** re. his pine marten sound library.
3. Harvest **Tierstimmenarchiv** (CC BY-SA; request full-length files) —
   filtering out `f. domestica` rows.
4. Register a **xeno-canto API v3 key** (v2 is dead; GBIF mirror is stale).
5. Consider **captive recording** (RZSS, Wildwood, VWT) plus own-site ARUs in
   the Jul–Aug marten mating window — the only route from ~40 clips to a
   usable corpus. Nearly every existing recording of both species was made in
   a zoo.
6. For augmentation/pretraining, harvest the **stone marten** corpus
   (Tierstimmenarchiv, ~140 min) and the **stoat Kaggle dataset** — the
   closest labelled mustelid audio that actually exists.

## Key sources

- Prager et al. 2026, felid acoustics systematic review — [Bioacoustics](https://www.tandfonline.com/doi/full/10.1080/09524622.2026.2648721)
- Schnaider et al. 2025, felid meow discrimination — [Sci Rep](https://www.nature.com/articles/s41598-025-31536-7)
- Wood & Kahl 2024, BirdNET embeddings for novel classes — [Frontiers](https://www.frontiersin.org/journals/ecology-and-evolution/articles/10.3389/fevo.2024.1409407/full)
- Ghani et al. 2023, few-shot probes on bioacoustic embeddings — [Sci Rep](https://www.nature.com/articles/s41598-023-49989-z)
- Perch 2.0 — [paper](https://arxiv.org/abs/2508.04665) · [model (Apache 2.0)](https://huggingface.co/cgeorgiaw/Perch)
- Hoefer et al. 2025, sensors vs surveyors — [MEE](https://doi.org/10.1111/2041-210X.70169)
- Sossover et al. 2024, BirdNET wolf/coyote — [Mammal Research](https://doi.org/10.1007/s13364-023-00725-y)
- Scottish Wildcat Action monitoring protocol — [NatureScot](https://www.nature.scot/doc/scottish-wildcat-action-swa-specialist-report-monitoring-and-surveys)
- South West Wildcat feasibility — [Devon Wildlife Trust](https://www.devonwildlifetrust.org/south-west-wildcat-project)
- BTO Acoustic Pipeline species scope — [BTO](https://www.bto.org/data/tools-products/acoustic-pipeline/ultrasonic-classifiers/species-scope-coverage)
- Community BirdNET custom classifier for European mammals (incl. lynx, fox) — [birdnet-go-classifiers](https://github.com/tphakala/birdnet-go-classifiers)
- OpenSoundscape SongSpace agile modelling — [tutorial](https://opensoundscape.org/en/latest/tutorials/songspace_agile_modeling.html)
