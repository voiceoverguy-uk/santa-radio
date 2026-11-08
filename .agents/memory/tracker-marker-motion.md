---
name: Tracker marker motion
description: Keep Santa aligned with route coordinates during accelerated playback and camera transitions.
---
Do not animate Santa's position independently of the route coordinates. Smooth camera movement is safe when it transforms Santa and the route together.

**Why:** The owner saw Santa detach from the route at 300× preview speed. A separate position tween continually lagged behind incoming coordinates; tests using reduced motion hid the problem.

**How to apply:** Check painted marker alignment with normal motion enabled during accelerated travel, stop arrivals and camera switches. Keep route timing unchanged rather than slowing the simulation to disguise visual lag.
