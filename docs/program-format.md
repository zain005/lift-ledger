# Program file format

A program is a single JSON file. Import it from **Settings → Import a program**. The built-in programs in [`programs/`](../programs) use the same format, so copy one as a starting point.

## Example

```json
{
  "format": 1,
  "id": "my-upper-lower",
  "name": "My Upper / Lower",
  "description": "4 days a week.",
  "schedule": "Upper, Lower, rest, Upper, Lower, 2 rest days.",
  "weeks": 8,
  "phases": [
    { "name": "Foundation", "weeks": [1, 4], "rpe": { "compound": "7 / 8", "isolation": "8 / 9" } },
    { "name": "Build",      "weeks": [5, 8], "rpe": { "compound": "7–8 / 9", "isolation": "9 / 10" } }
  ],
  "days": [
    {
      "name": "Upper A",
      "short": "Upper",
      "exercises": [
        {
          "name": "Barbell Bench Press",
          "sets": 3,
          "reps": "6–8",
          "type": "compound",
          "cue": "Shoulder blades back, feet planted.",
          "alts": ["Dumbbell bench press", "Machine chest press"],
          "video": "https://www.youtube.com/watch?v=..."
        }
      ]
    }
  ]
}
```

## Fields

### Program

| Field | Required | Notes |
|---|---|---|
| `name` | yes | Shown as the title. Up to 40 characters. |
| `id` | no | Letters, numbers and dashes. Defaults to the name. Logs are saved per `id`, so keep it stable when you update a program. |
| `description` | no | One line shown on the program card in Settings. |
| `schedule` | no | Shown at the bottom of the workout screen. |
| `weeks` | no | 1 to 12. Defaults to 8. |
| `phases` | no | Blocks of weeks. Defaults to one phase covering every week. |
| `days` | yes | 1 to 7 workouts that make up one week. |

### Phase

| Field | Required | Notes |
|---|---|---|
| `name` | no | Shown in the header, e.g. "Phase 2 · Build". |
| `weeks` | yes | `[first, last]`, e.g. `[5, 8]`. |
| `rpe` | no | Target effort by exercise `type`, e.g. `{ "compound": "7 / 8" }`. Any type names work. |
| `days` | no | Use different exercises in this phase. Must have the same number of days as the program. |

### Day

| Field | Required | Notes |
|---|---|---|
| `name` | no | e.g. "Upper A". Defaults to "Day 1", "Day 2"… |
| `short` | no | A short label under the day tab, up to 8 characters. |
| `exercises` | yes | 1 to 15 exercises. |

### Exercise

| Field | Required | Notes |
|---|---|---|
| `name` | yes | |
| `sets` | yes | 1 to 10. Each set gets a weight box. |
| `reps` | no | Text such as `"8–10"` or `"12"`. The progress chart uses the first number. |
| `type` | no | Looked up in the phase's `rpe` table. |
| `rpe` | no | Overrides the phase's RPE for this exercise, e.g. `"8"`. |
| `cue` | no | A short form tip. |
| `alts` | no | Up to 8 alternative exercise names offered under "Swap exercise". |
| `video` | no | An `https://` demo link. Without one, the name links to a YouTube search. |

## Notes

- Two-number RPE like `"7–8 / 9"` means early sets at 7–8 and the last set at 9. Write whatever format you like; it's shown as text.
- Re-importing a file with the same `id` replaces the program but keeps its logs. If you change the order of days or exercises, logged weights stay attached to their old positions.
- Only share programs you have the right to share. Don't publish someone else's paid program.
