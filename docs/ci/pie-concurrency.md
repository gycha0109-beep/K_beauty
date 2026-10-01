# PIE execution cancellation

PIE retains every existing trigger, including PR body edits, its pinned reusable
workflow revision and its profile/configuration inputs. The wrapper now cancels
superseded execution of the same PR with a workflow-and-PR concurrency group.
It does not cancel another PR or share evidence across different heads.

This change reduces duplicate in-flight PIE requests. It does not introduce a
global runner budget, change Current Main Health delegation, or move required
validation after merge. Whole-run failure propagation and an enforced integration
gate are not implemented for this repository by this change.
