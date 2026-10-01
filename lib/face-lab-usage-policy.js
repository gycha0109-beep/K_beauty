export const FACE_LAB_PRODUCTION_DAILY_LIMIT = 5;

export const FACE_LAB_USAGE_POLICY = Object.freeze({
  production: Object.freeze({
    mode: "production",
    guardEndpoint: "face-reading",
    consumesProductionQuota: true,
    requireIdempotency: false,
    dailyDisplayLimit: FACE_LAB_PRODUCTION_DAILY_LIMIT,
    limits: Object.freeze({
      user: Object.freeze({ perHour: 3, perDay: FACE_LAB_PRODUCTION_DAILY_LIMIT }),
      anonymous: Object.freeze({ perHour: 3, perDay: FACE_LAB_PRODUCTION_DAILY_LIMIT }),
      ip: Object.freeze({ perHour: 6, perDay: 12 })
    })
  }),
  test: Object.freeze({
    mode: "test",
    guardEndpoint: "face-reading-test",
    consumesProductionQuota: false,
    requireIdempotency: false,
    dailyDisplayLimit: null,
    limits: Object.freeze({
      user: Object.freeze({ perHour: 20, perDay: 50 }),
      anonymous: Object.freeze({ perHour: 20, perDay: 50 }),
      ip: Object.freeze({ perHour: 40, perDay: 100 })
    })
  }),
  simulationTest: Object.freeze({
    mode: "simulation-test",
    guardEndpoint: "face-lab-simulation-test",
    consumesProductionQuota: false,
    requireIdempotency: true,
    dailyDisplayLimit: null,
    limits: Object.freeze({
      user: Object.freeze({ perHour: 5, perDay: 20 }),
      anonymous: Object.freeze({ perHour: 3, perDay: 10 }),
      ip: Object.freeze({ perHour: 8, perDay: 30 })
    })
  })
});

export function getFaceLabUsagePolicy(mode = "production") {
  if (mode === "simulation-test") {
    return FACE_LAB_USAGE_POLICY.simulationTest;
  }

  return mode === "test"
    ? FACE_LAB_USAGE_POLICY.test
    : FACE_LAB_USAGE_POLICY.production;
}
