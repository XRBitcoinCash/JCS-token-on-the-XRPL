# Prayer Map: human souls, population and sacred imagery

Prepared 8 October 2026, based on release `5e4268f73b3d8c1d8194f492a790625a2e677c1e`.

## What the scene represents

Blue clusters provide population context across six continents. They grow and shrink with the population estimates for the selected year. The dots are bounded illustrative groups, not individual people. Their fixed land anchors do not claim the locations of settlements, births, deaths, migration or prayer signers.

Changes in population stock are **net change**. They combine births, deaths, migration and source revisions. They cannot supply gross birth or death counts or prove the impact of a particular atrocity. None of those quantities is invented here.

The Heaven, Hell and Purgatory paths form a separate, unquantified devotional layer. They begin at an unlocated Earth halo. They never classify a person, country, genocide victim or historical event by eternal destiny. Counts and percentages for salvation or condemnation are not calculated. The interface states this directly and provides independent display controls.

Prayer NFTs remain validated ledger records with their existing privacy rules. Their counts are displayed separately. The older random falling NFT lights have been removed to avoid confusing them with human populations.

## Population sources and method

`data/population-history.json` preserves the source values for 254 time anchors, six continental groups and an independent world total. Linear interpolation connects adjacent anchors; AD 1 uses the source's year 0 and year 100 values. The opening years before AD 1 hold this context and identify that limitation.

- Before 1800: HYDE 3.3 historical estimates.
- 1800–1949: Gapminder v7 historical estimates.
- 1950–2023: United Nations World Population Prospects 2024 estimates.
- 2024–2026: UN medium projections, labeled as projections even on a present-day timeline.

The data is distributed and processed by [Our World in Data](https://ourworldindata.org/grapher/population-regions-with-projections). The JSON retains attribution, source URLs, the downloaded CSV hash and methodological limits. OWID processing is CC BY 4.0; original providers retain their respective terms. Source transitions can introduce breaks; early values have substantial uncertainty. North America includes Central America and the Caribbean. These are not the overlapping public-prayer regions.

Additional source references: [HYDE 3.3 dataset](https://doi.org/10.24416/UU01-AEZZIT), [Gapminder population documentation](https://www.gapminder.org/data/documentation/gd003/), [UN World Population Prospects](https://population.un.org/wpp/), [UN 2024 methodology](https://population.un.org/wpp/assets/Files/WPP2024_Methodology-Report_Final.pdf).

## Sacred artwork and interpretation

The three SVG files in `assets/sacred/` are original lightweight vector illustrations. There are no depictions of God, angels, human bodies or torture.

- **Heaven, upper corners:** pearl gates, crystal/jasper walls, transparent gold and jeweled foundations. These motifs come from [Revelation 21:11–25](https://bible.usccb.org/bible/revelation/21). The image is symbolic architecture, not a literal map or a cathedral claimed as Heaven's temple.
- **Hell, lower left:** restrained crimson fire and a dark chasm symbolize separation from God. See [Catechism 1033–1037](https://www.vatican.va/content/catechism/en/part_one/section_two/chapter_three/article_12/iv_hell.html).
- **Purgatory, lower right:** amber refining light becomes white and rises toward Heaven. This is an artistic color scheme, not a scriptural color code. Catholic teaching describes purification of those assured of salvation, distinct from damnation: [Catechism 1030–1032](https://www.vatican.va/content/catechism/en/part_one/section_two/chapter_three/article_12/iii_the_final_purification,_or_purgatory.html).

[Luke 13:1–5](https://bible.usccb.org/bible/luke/13) rejects treating victims of violence or disaster as worse sinners. [Catechism 1857–1861](https://www.vatican.va/content/catechism/en/part_three/section_one/chapter_one/article_8/iv_the_gravity_of_sin_mortal_and_venial_sin.html) distinguishes grave acts from personal culpability and entrusts judgment of persons to God. Historical statistics therefore cannot establish spiritual destinations.

The blue population lights appear on Earth; they do not depict pre-existing souls arriving from space. The visual layer is named **Angels**, with its Enoch tradition identified in the controls and explanation. Enoch's spoken/source wording remains unchanged. The historical landing associations remain artistic parallels, not claims that an angel caused an event or that its fall is historically dated. See the contextual notes to [Jude](https://bible.usccb.org/bible/jude/1).

## Rendering and continuity

The old globe selected only eight flights and favored newer flights, hiding arrivals. The repair draws every flight marker while limiting only expensive detail. Dense visual windows shorten deterministically without changing the assigned landing year. Landed markers persist; far-side markers are dim dashed rings at the true projected position. The globe uses a steady orbit instead of chasing competing destinations.

Population and devotional animation derive from the existing timeline position. Pause and rewind remain deterministic. The module has no separate animation clock and cannot authorize wallet actions or change narration. Seventy-two small cluster dots and one bead per symbolic path bound the new particle workload. Reduced motion suppresses moving journey beads.

The focused validation record is `prayer-map-validation.txt`. Live appearance and listening review remain for the next user-requested session; deployment success is evidenced by the release PR and Pages run. Stop immediately after deployment succeeds, under the established checkpoint protocol.
