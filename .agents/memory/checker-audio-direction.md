---
name: Checker audio direction
description: Page-specific recordings and reveal timing preserve each clip's ending.
---

On the dedicated checker page, use the supplied checking-nice or checking-naughty
recording according to the ten answers. Reveal the result and matching
certificate 1.2 seconds before that recording ends, and let it finish. Do not add
the old separate Nice ping or naughty-list recording, or restore Replay sound.

On the homepage, keep its separate checking recording, reveal the preliminary
result 0.3 seconds before its end, and wait until half a second into playback
before showing the checking panel. Do not show Cancel check during the brief
name-form launch state; it overlapped the disabled Check button.
Sound starts enabled on both checker pages, but playback still follows a visitor
action, never page load. A replacement requested for one page does not
automatically replace the other page's recording.

**Why:** The owner wants the ending to accompany the reveal, subsequently
supplied two outcome-specific recordings for the full checker, requested a
1.2-second certificate reveal lead, and removed Replay sound and the old
naughty-list effect. The homepage's recording and result timing remain separate;
the owner subsequently shortened its panel entrance to half a second and removed
the launch-state Cancel check control because it overlapped. The owner later
shortened only the homepage result's reveal lead to 0.3 seconds.

**How to apply:** Follow actual media position rather than wall time when sound
plays, with the matching silent/blocked fallback. Retain immediate stop on
restart, navigation or an explicit sound-off action.
