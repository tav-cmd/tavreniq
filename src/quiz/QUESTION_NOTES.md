# Question-bank maintenance

The bank contains 150 authored questions, 10 in each of 15 categories. In source,
`options[0]` is correct; `selectQuestions` shuffles options and moves the answer
index with them. The source file never goes to Discord as a payload.

Content review: prompts and all four options were reviewed for one intended
answer. Date-sensitive winners name the event/year; geography distinguishes hot
deserts from all deserts and summit elevation from base-to-peak height. Science
specifies standard pressure, Euclidean geometry and twelve-tone tuning where
needed. Calculations were checked directly. Avoid subjective superlatives,
current officeholders, future events, and disputed geographical measurements.
Difficulty is an editorial label, not a calibrated measure of player ability.

Selected primary-source fact checks used during review:

- SI luminous intensity (q010): https://www.bipm.org/en/si-base-units/candela
- Saturn's largest moon (q019): https://science.nasa.gov/saturn/moons/titan/facts/
- Electrical resistance (q037): https://www.nist.gov/pml/owm/si-units-electric-current
- Marathon distance (q089): https://worldathletics.org/disciplines/race-walks/marathon
- 2020 Best Picture (q100): https://www.oscars.org/oscars/ceremonies/2020/S
- Original Tetris creator/year (q109): https://tetris.com/about
- 1986 literature Nobel (q120): https://www.nobelprize.org/prizes/literature/1986/summary/
- Feldspar abundance (q139): https://pubs.usgs.gov/publication/70045904

These are selected external spot checks, not an assertion that every question has
an individual web citation. Automated tests verify count, uniqueness, four distinct
choices, answer-index integrity after shuffling, and rendering; they cannot prove
factual correctness. Re-review wording and distractors whenever a fact changes.
