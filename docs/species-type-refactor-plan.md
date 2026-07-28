# Species-type refactor: 19 → 12 groups

Reworking the `species_type` reference table from today's 19 types into a
target set of 12. Based on a full review of the **staging** database
(43,553 species, 4,858 sightings across Heal + Cannwood) and a complete
code-impact map.

**Decisions confirmed:** Group 5 is named **"Other invertebrates"** (holds
spiders and woodlice honestly alongside insects). **Bees = true bees only**
(~278, Anthophila by genus); wasps/ants/sawflies go to Other invertebrates.

## Target groups (your list) vs. what's in the DB

| # | Target group | Comes from (current type → count in DB) | Notes |
|---|---|---|---|
| 1 | Butterfly | `butterfly` (69) | clean rename |
| 2 | Moths | `moth` (2,656) | clean rename |
| 3 | Bees | **split** from `bee-wasp-ant` (~278 of 8,134) | ⚠️ see "Bees problem" |
| 4 | Dragonflies | `dragonfly-damselfly` (47) | includes damselflies |
| 5 | Other insects / **invertebrates** | `beetle` (2,294), `bug` (846), `fly` (7,408), `grasshopper-cricket` (29), `insect` (412), `gall` (0), residual `bee-wasp-ant` (~7,855), **+ `spider` (3,193), `woodlouse` (270), `mite` (0)** | ⚠️ see "Non-insect problem" |
| 6 | Mammals | `mammal` (40) | clean rename |
| 7 | Bats | `bat` (17) | kept separate from mammals (as you listed) |
| 8 | Birds | `bird` (494) | **keep slug `bird`** — BirdNET/audio pipeline hardcodes it |
| 9 | Reptiles | `reptile` (8) | clean rename |
| 10 | Amphibians | `amphibian` (7) | clean rename |
| 11 | Fungi | `fungus` (17,629) | clean rename |
| 12 | Plants | — (0) | **brand-new, empty group** |

Nine clean renames (rows 1, 2, 4, 6, 7, 8, 9, 10, 11) carry no ambiguity.
The two hard problems are Bees and the non-insect invertebrates.

## Problem 1 — "Bees" is a thin slice of a mislabelled pile

`bee-wasp-ant` is **not** bees — it's the entire order Hymenoptera, dominated
by parasitic wasps (Ichneumonidae, Braconidae, Platygastridae) and sawflies
(Euura, Pristiphora, Dolerus). Of 8,134 species, only **~278 are true bees**
(clade Anthophila).

Good news for the split: **every species has a scientific name + NBN GUID**, and
British bees are a well-bounded ~270 species across ~28 genera — so a
genus-list match classifies them reliably. The ~278 we get already matches the
known British bee fauna, which is a strong signal the approach is sound.

- **Bees** = Anthophila genera: Andrena, Anthidium, Anthophora, Apis, Bombus,
  Ceratina, Chelostoma, Coelioxys, Colletes, Dasypoda, Dufourea, Epeolus,
  Eucera, Halictus, Heriades, Hoplitis, Hylaeus, Lasioglossum, Macropis,
  Megachile, Melecta, Melitta, Nomada, Osmia, Panurgus, Sphecodes, Stelis,
  Xylocopa (+ any stragglers found on a spot-check).
- **Everything else** in `bee-wasp-ant` (wasps, ants — Lasius/Myrmica/Formica
  etc. — and sawflies) → Other invertebrates.

Heal already runs a **Bumblebee** survey type, so surfacing bees on their own is
clearly wanted.

## Problem 2 — three of your source types are not insects

`spider` (3,193), `woodlouse` (270), and `mite` (0) are arachnids and
crustaceans, not insects. Filing them under a group literally named "Other
**insects**" is the exact taxonomic inaccuracy you were worried about.

**Recommendation: name group 5 "Other invertebrates"** (slug stays `insect`
under the hood to minimise code churn, display name becomes "Other
invertebrates"). It then honestly holds beetles, flies, bugs, spiders,
woodlice, and the wasp/ant/sawfly residue. The alternative — keep "Other
insects" strict and add a 13th "Arachnids & other invertebrates" group — is
also defensible but adds a group you didn't ask for.

## Plants

No plant species exist in the DB (the apparent "grass/oak/orchid" matches are
host-plant names embedded in moth and fungus common names). Group 12 is created
empty, ready for future recording. Needs a new icon (or reuse the existing
LeafIcon, currently used by the soon-to-be-removed `gall` type).

---

## Proposed slug strategy (minimise churn)

Keep existing slugs wherever a group maps 1:1, so the frontend config,
hardcoded runtime checks, and icons mostly survive. Net: 11 slugs kept, 2 added
(`bee`, `plant`), 9 removed.

| Final slug | display_name | Action |
|---|---|---|
| `butterfly` | Butterflies | keep |
| `moth` | Moths | keep |
| `bee` | Bees | **new**; reclassified from `bee-wasp-ant` (BeeIcon already exists) |
| `dragonfly-damselfly` | Dragonflies | keep (display trimmed) |
| `insect` | Other invertebrates | keep slug, **rename display**; absorbs the merges |
| `mammal` | Mammals | keep |
| `bat` | Bats | keep |
| `bird` | Birds | keep — **do not rename** (BirdNET) |
| `reptile` | Reptiles | keep |
| `amphibian` | Amphibians | keep |
| `fungus` | Fungi | keep |
| `plant` | Plants | **new**, empty (LeafIcon or new icon) |
| ~~`bee-wasp-ant`~~ | — | split → `bee` + `insect`, then delete |
| ~~`beetle`, `bug`, `fly`, `grasshopper-cricket`, `gall`~~ | — | merge → `insect`, then delete |
| ~~`spider`, `mite`, `woodlouse`~~ | — | merge → `insect`, then delete |

Not lossy long-term: `species.scientific_name` is retained, so a beetle vs fly
distinction is always recoverable from taxonomy if you later want to re-split.

---

## Data migration (shipped as `scripts/refactor_species_types.py`, not Alembic;
## run on staging — applied 24 Jul 2026 — then prod after merge)

1. Insert `bee` and `plant` into `species_type`.
2. Reclassify `bee-wasp-ant`: `UPDATE species SET species_type_id = <bee>`
   where genus ∈ bee list; the rest get `species_type_id = <insect>`.
3. Merge `beetle, bug, fly, grasshopper-cricket, gall, spider, mite,
   woodlouse` → `insect` (`UPDATE species …`). Sightings follow automatically
   (they FK to `species`, not `species_type`).
4. Rewrite `survey_type_species_type` links to the surviving type ids, then
   **dedup** — the table has `UNIQUE(survey_type_id, species_type_id)` and
   e.g. Jenny has 10 old insect-type links collapsing to one. Insert-distinct
   then delete the dead-type links.
5. `UPDATE species_type SET display_name = …` for renames (esp. `insect` →
   "Other invertebrates").
6. `DELETE FROM species_type` for the 9 emptied slugs.
7. Downgrade note: the reverse can recreate the rows but **cannot** perfectly
   restore which species were beetles vs flies without re-running the
   taxonomy classifier — document this as a forward-only-in-practice migration.

## Frontend changes

- **`config/speciesTypes.ts`** — the single richest coupling point (keyed by all
  19 slugs). Rekey to the 12 final slugs: drop the 9 removed, add `bee`
  (BeeIcon) and `plant`, change `insect`'s display strings to "Other
  invertebrate / Other invertebrates". `getSpeciesIcon`/`formatSpeciesCount`/
  `getSpeciesDisplayName` all read from here, so this fixes most call sites for
  free. EarwigIcon stays the unknown-type fallback.
- **Add a Plant icon** to `components/icons/WildlifeIcons.tsx` (or point `plant`
  at the existing LeafIcon).
- **`groupMeta.ts` L131** — `primarySpeciesType` fallback `'butterfly'` still
  valid.
- Component fallbacks that hardcode `'bird'`/`'insect'` (MarkerPopupContent,
  SightingsEditor, AddSightingModal, LocationModal, DashboardsPage default)
  still resolve — both slugs survive.

## Backend / scripts to audit (mostly safe because `bird` & `insect` survive)

- **Runtime, must stay working:** `routers/audio.py` L118 and
  `services/processing.py` L68 (`SpeciesType.name == "bird"`) — safe, `bird`
  kept. `routers/dashboard.py` slug filters — safe.
- **Seed migration** `m1n2o3…seed_initial_survey_types.py` L74/L105
  (`name IN ('bird','mammal')`) — safe.
- **One-off scripts** referencing removed slugs (`migrate_species.py`,
  `cleanup_duplicate_insects.py`, `import_galls.py`, etc.) — historical, not on
  the runtime path; update only if we expect to re-run them.
- **Tests**: backend `tests/conftest.py`, `test_species.py`, `test_dashboard.py`,
  `test_survey_types.py`, `test_export.py` and frontend `groupMeta.test.ts`,
  `cumulativeSeries.test.ts` seed species types by slug — audit fixtures for the
  removed slugs before the rename lands.

## Rollout order

1. Land the bee-genus classifier + data script; run on **staging**,
   eyeball the Bees group and the Other-invertebrates totals. (Done 24 Jul 2026.)
2. Ship the frontend config rekey + Plant icon in the same PR (config must match
   the new slugs or icons fall back).
3. After merge, run the script on **prod** (`./run prod refactor_species_types.py --no-dry-run`).
