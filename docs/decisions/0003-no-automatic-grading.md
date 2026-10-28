# 0003: Evidence citation instead of automatic grading

**Status:** Accepted

## Context
Grading free-text reasoning automatically is unreliable without a model, and a model grader would be hard to validate and easy to game.

## Decision
A case is complete when the learner picks the authored supported cause, has inspected and cited the required evidence, and writes 40–4,000 characters of reasoning. The meaning of the reasoning is not graded; instead the debrief shows supporting facts and counter-evidence, and a transfer case with a different cause tests whether the reasoning carries over.

## Consequences
- The product never claims grading, certification or measured learning gains.
- Quality depends on authored cases, so each needs practitioner review and versioned changes.
- A future reviewer or rubric (human or model) would be a separate, validated feature.
