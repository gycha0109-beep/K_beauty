const DOI = "10.6084/m9.figshare.5047666.v5";
const PROVENANCE_REF = "https://doi.org/" + DOI;
const SPLITS = new Set(["reference", "holdout"]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function pathMatches(path, subjectId, suffix) {
  return (
    nonEmpty(path) &&
    path.replaceAll("\\", "/").endsWith("/" + subjectId + "_" + suffix + ".jpg")
  );
}

export function buildLondonSetV5FrontScaffoldSpecs(intake = {}) {
  if (
    !isObject(intake) ||
    intake.schemaVersion !== "face-lab-london-set-v5-front-intake-v0" ||
    !Array.isArray(intake.records) ||
    intake.records.length !== 102
  ) {
    throw new Error("london_set_v5_front_intake_invalid");
  }

  const subjectIds = new Set();
  const splitCounts = { reference: 0, holdout: 0 };

  const records = intake.records.map((record) => {
    if (
      !isObject(record) ||
      !/^[0-9]{3}$/.test(record.subjectId || "") ||
      !SPLITS.has(record.split) ||
      !nonEmpty(record.qualityStatus) ||
      !pathMatches(record.neutralFrontPath, record.subjectId, "03") ||
      !pathMatches(record.smilingFrontPath, record.subjectId, "08")
    ) {
      throw new Error("london_set_v5_front_record_invalid");
    }
    if (subjectIds.has(record.subjectId)) {
      throw new Error("london_set_v5_subject_duplicate:" + record.subjectId);
    }
    subjectIds.add(record.subjectId);
    splitCounts[record.split] += 1;
    return record;
  });

  if (splitCounts.reference === 0 || splitCounts.holdout === 0) {
    throw new Error("london_set_v5_subject_split_missing");
  }

  return {
    schemaVersion: "face-lab-london-set-v5-front-scaffold-specs-v0",
    source: {
      doi: DOI,
      provenanceRef: PROVENANCE_REF,
      subjectCount: 102,
      automaticSplitSelection: false
    },
    referenceCorpusSpec: {
      schemaVersion: "face-space-reference-corpus-source-scaffold-spec-v0",
      samplingFrame: {
        kind: "licensed_general_face_corpus",
        provenanceRef: PROVENANCE_REF
      },
      subjectGrouping: {
        method: "dataset_subject_id",
        evidenceRef: PROVENANCE_REF
      },
      records: records.map((record) => ({
        sampleId: "london_v5_" + record.subjectId + "_neutral_front",
        subjectGroupId: "london_v5_subject_" + record.subjectId,
        nearDuplicateFamilyId: "london_v5_subject_" + record.subjectId,
        provenanceRef:
          PROVENANCE_REF + "#subject-" + record.subjectId + "-neutral-front",
        split: record.split,
        qualityStatus: record.qualityStatus,
        path: record.neutralFrontPath
      }))
    },
    expressionStabilitySpec: {
      schemaVersion: "face-lab-real-photo-stability-scaffold-spec-v0",
      sourceSet: {
        kind: "licensed_same_subject_photo_set",
        provenanceRef: PROVENANCE_REF
      },
      pairs: records.map((record) => ({
        pairGroupId: "london_v5_expression_" + record.subjectId,
        nuisanceClass: "expression",
        subjectLinkage: {
          method: "dataset_same_subject_provenance",
          evidenceRef:
            PROVENANCE_REF + "#subject-" + record.subjectId
        },
        reference: {
          sampleId: "london_v5_" + record.subjectId + "_neutral_front",
          path: record.neutralFrontPath
        },
        candidate: {
          sampleId: "london_v5_" + record.subjectId + "_smiling_front",
          path: record.smilingFrontPath
        }
      }))
    },
    unsupportedByFrontMirror: {
      headYaw: true,
      headPitch: true,
      headRoll: true
    },
    authority: {
      productionAuthority: false,
      normalizationAuthority: false,
      thresholdAuthority: false,
      adequacyDecisionAuthority: false
    }
  };
}
