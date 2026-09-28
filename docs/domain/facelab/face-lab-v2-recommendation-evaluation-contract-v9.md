# Face Lab V2 Recommendation Evaluation Contract v9

> Track: Face Lab 16K / Face Responsiveness & Personalization
> Status: deterministic face-observation authority gate
> Supersedes: recommendation evaluation contract v8 for current suite semantics
> Authority ceiling: synthetic structured-face evaluation only

## 1. Question

This stage asks whether Face Lab recommendations actually respond to the current face where the engine claims face-specific recommendation authority, while remaining stable for observation values that are currently descriptive only.

The evaluation direction is:

~~~text
same Target
+ same Styling Scope
+ same Constraints
+ same controlled face fixture
+ exactly one observation value changed
→ CurrentFaceProfile
→ Style Delta face modifier
→ Route action
~~~

Synthetic structured observations are regression evidence only. They are not real-user calibration authority.

## 2. Current recommendation authority inventory

The current observation contract exposes 22 fields.

They are frozen into three roles for this evaluator:

~~~text
recommendation_modifier            4
profile_only                       15
observed_not_profile_consumed       3
total                              22
~~~

Recommendation modifier fields:

- eyes.eyeDirection
- visualLanguage.featureContrast
- visualLanguage.contourDefinition
- visualLanguage.straightCurveBalance

These four fields are the only current observation values that directly alter Style Delta action semantics through applyFaceModifiers().

Profile-only fields are preserved in CurrentFaceProfile but do not currently alter Style Delta actions.

The three colorAppearance fields are observed by the upstream contract but are not currently consumed by CurrentFaceProfile.

Any new observation field that is not explicitly classified must fail the evaluator until this inventory is reviewed and versioned.

## 3. Controlled pair design

The evaluator creates one pair for every observation field: 22 pairs total.

For every pair:

- Target is identical.
- Styling Scope is identical.
- Constraints are identical.
- Presentation preference is identical.
- The raw face fixture differs in exactly one observation value.
- Quality and evidence strings remain identical.

The four recommendation-modifier pairs use target/scope combinations that exercise the owning modifier contract.

### 3.1 eyeDirection

~~~text
Target: chic
Scope: makeup
level
→ outerEyeEmphasis / increase / moderate

upturned
→ eyeDefinition / increase / light
→ reason: face_modifier_eye_direction_already_upturned
~~~

### 3.2 featureContrast

~~~text
Target: statement_glam
Scope: makeup
medium
→ selectedFeatureContrast / increase / strong

high
→ selectedFeatureContrast / increase / light
→ reason: face_modifier_existing_feature_contrast_high
~~~

### 3.3 contourDefinition

~~~text
Target: chic
Scope: hair
moderate
→ outlineDefinition / increase / strong

defined
→ outlineDefinition / maintain / light
→ reason: face_modifier_contour_already_defined
~~~

### 3.4 straightCurveBalance

~~~text
Target: soft
Scope: hair
balanced
→ curvature / increase / moderate

curved
→ curvature / maintain / light
→ reason: face_modifier_line_already_curved
~~~

## 4. Hard gates

The following are hard failures.

### E7 controlled mutation

Each pair must differ in exactly one raw observation field.

### E7 target invariance

A face-only mutation must not alter Target Style authority.

### E7 modifier contract

Each of the four modifier-backed fields must produce the exact expected Style Delta action semantics, reason, and face evidence.

### E7 route responsiveness

Each modifier-backed field must change the selected route action signature under its controlled target/scope fixture.

### E7 non-authority leakage

The 18 fields that do not currently own recommendation-modifier authority must not change active Style Delta action semantics or selected route action semantics when only their value changes.

This is a current-authority boundary, not a claim that these fields should never influence recommendations. Adding a legitimate new modifier requires a reviewed contract version update.

## 5. Diagnostics

The report records:

- observation inventory and role
- pair count
- CurrentFaceProfile change count
- Style Delta change count
- selected route change count
- per-field baseline/variant values
- per-field target and scope
- per-pair signatures
- hard failures

Initial expected structural counts:

~~~text
pairs = 22
modifier pairs = 4
non-authority pairs = 18
profile-only pairs = 15
observed-not-profile pairs = 3
~~~

No concentration or population interpretation may be derived from these counts.

## 6. Manual execution

Face responsiveness only:

~~~bash
FACE_LAB_EVAL_COHORT=face-responsiveness npm run eval:face-lab-v2
~~~

Full deterministic suite:

~~~bash
FACE_LAB_EVAL_COHORT=all npm run eval:face-lab-v2
~~~

## 7. Interpretation boundary

A clean run means:

- the four current face modifiers are live end-to-end,
- their exact action contracts are preserved,
- face-only mutations do not alter Target/Scope/Constraint authority,
- observation values without current recommendation authority do not silently leak into action semantics.

It does not establish:

- aesthetic correctness,
- image-analysis accuracy,
- real-user preference,
- population representativeness,
- fairness,
- production calibration.
