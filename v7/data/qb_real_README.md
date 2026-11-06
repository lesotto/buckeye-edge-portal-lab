# qb_real.json — real QB transfer dataset (CollegeFootballData.com)

Built by `scripts/build_qb_real.py` (fetcher: `scripts/cfbd_fetch.py`). Raw responses are cached in `data/cfbd_raw/<endpoint>_<params>.json`; reruns reuse the cache (`--offline` builds without any network). Upstream calls used: 42 of a 150 budget (portal and FBS team lists partly reused from `data/cfbd_cache`).

Data provided by CollegeFootballData.com.

## Scope
One row per portal entry with `position == "QB"` whose `destination` is an FBS school in season Y (portal class Y = the season played at the new school). Classes 2022–2026. Entries with no destination or a non-FBS destination are excluded (counted in `coverage.portal_qb_entries`).

| Class | Portal QB entries | FBS destination (rows) | Pre stats matched | Post1 stats matched |
|---|---|---|---|---|
| 2022 | 192 | 95 | 66 (69%) | 75 (79%) |
| 2023 | 188 | 100 | 77 (77%) | 85 (85%) |
| 2024 | 251 | 148 | 109 (74%) | 109 (74%) |
| 2025 | 310 | 161 | 116 (72%) | 123 (76%) |
| 2026 | 267 | 172 | 140 (81%) | 139 (81%) (partial season) |
| Total | 1,208 | 676 | 508 (75%) | 531 (79%) |

430 rows have both pre and post1 stats.

## Fields
- `name`, `cycle` (Y), `origin`, `dest`, `transfer_date`, `portal_rating`, `stars`, `eligibility`: from `/player/portal?year=Y`.
- `origin_conf` / `dest_conf`: conference from `/teams/fbs` for Y-1 (origin) and Y (dest); null if not FBS that season.
- `origin_tier` / `dest_tier`: `P4` = SEC, Big Ten, Big 12, ACC, plus Pac-12 when cycle ≤ 2024, plus Notre Dame; other FBS = `G5`; not in that season's FBS list = `FCS` (which includes D2/D3/NAIA/JUCO origins).
- `origin_rating`, `dest_rating`: SP+ overall (`/ratings/sp`) for season Y-1; `rating_gap` = dest − origin.
- `origin_talent`, `dest_talent`: 247 team talent composite (`/talent`) for Y-1.
- `pre` (season Y-1 at origin), `post1` (season Y at dest): `season, team, games, pass_att, cmp_pct, ypa, pass_yds, pass_td, pass_int, usage_overall, usage_pass, ppa_all, ppa_pass, ppa_rush, ppa_rush_total, ppa_total, ppa_plays_est, wepa_pass, match`. Null when the player has no record in any of PPA, usage, or passing stats for that team-season. A null `post1` means he logged no stats at the destination in season one. That is an outcome (did not play), not missing data.
  - `ppa_*` = average PPA (EPA-style) per play from `/ppa/players/season?position=QB`; `ppa_rush_total` and `ppa_total` are season totals; `ppa_plays_est` = total/average (approximate countable plays).
  - `usage_*` from `/player/usage`: the player's share of the team's plays (overall, and pass plays) that involved him. This is not snap share.
  - Passing counts from `/stats/player/season?category=passing`.
  - `games` is always null because the bulk season endpoints do not return games played.
  - `wepa_pass` is always null (see Unavailable).
  - `match`: `name+team` (exact normalized name), or `fuzzy_first+team` (same team, same last name, first names share a 3-letter prefix, e.g. Cam/Cameron Ward, Gio/Giovanni Lopez, Steve/Steven Angeli; 14 of 1,039 matched blocks).
- `post2_same_team`: true if the player has any PPA, usage, or passing record for `dest` in Y+1. Null for 2026. For 2025 it is based on the 2026 season so far (in progress).
- `reentered_portal_2y`: the player (normalized name) appears in portal class Y+1 or Y+2 with `origin == dest`. true/false for 2022–2024. For 2025 it is true if found in class 2026 and null otherwise, because class 2027 is not yet observable. Null for 2026.
- `dest_hc_change` / `origin_hc_change`: the primary head coach (most games coached, from `/coaches`) in Y differs from Y-1. Null if either season has no coach record, e.g. programs moving up to FBS.
- `dest_returning_ppa`, `dest_returning_pass_ppa`: `percentPPA` and `percentPassingPPA` from `/player/returning?year=Y` (FBS only).
- `dest_qb_transfers_in_same_cycle`: number of QB portal entries in class Y with this destination, including the player himself.
- `origin_churn`: count of all portal entries (all positions) from the origin in class Y. This is a raw count, not a share, because roster size was not fetched.

## Matching rules
Names are normalized: ASCII-folded, lowercased, punctuation stripped, hyphens turned into spaces, and suffixes Jr/Sr/II/III/IV/V removed. A stats block must match on name plus team: origin for `pre`, dest for `post1` and `post2`. There is no name-only fallback across teams; testing showed it mostly produced false matches against other schools.

## Unavailable
- `/wepa/players/passing` returned HTTP 401 ("requires a Patreon subscription at Tier 1 or higher"). It was probed once (2024) and not retried. `/wepa/players/rushing` is assumed to be on the same tier and was not called.
- `/roster` was not used, to stay within the call budget. Retention is inferred from stats appearances.

## Caveats
- An unmatched `pre` mostly means the player recorded no plays in Y-1 (backup or redshirt, or a JUCO/D2 origin outside CFBD coverage). It can also come from rare name variants the rules cannot reconcile, or a portal `origin` that differs from where he last played.
- `post2_same_team = false` means "no recorded stats at dest in Y+1". A player who stayed on the roster but did not play counts as false.
- Re-entry matching needs `origin == dest` in the later class, so a re-entry recorded under a different school name would be missed. Name collisions are possible but unlikely within one school.
- PPA and usage cover only plays credited to the QB position list. Usage measures involvement, not snaps.
- 2026 `post1` stats cover a partial season (through early November 2026). Portal class 2026 records may still be updated.
- Pac-12 is counted as P4 for every cycle up to 2024, which includes the two-team 2024 Pac-12 (Oregon State, Washington State) on the destination side.
- SP+ and talent are null for teams without FBS ratings in Y-1 (FCS origins and FBS newcomers). 6 rows have no destination SP+ rating, coach-change flag, or returning-production value.
