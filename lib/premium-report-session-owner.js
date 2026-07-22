import { createHmac, timingSafeEqual } from "crypto";

function getOwnerBinding(userId, secret) {
  if (typeof userId !== "string" || !userId || typeof secret !== "string" || !secret) {
    return null;
  }

  return createHmac("sha256", secret)
    .update(`premium-report-owner:${userId}`)
    .digest("base64url");
}

export function createPremiumReportOwnerBinding(userId, secret) {
  return getOwnerBinding(userId, secret);
}

export function matchesPremiumReportOwnerBinding(binding, userId, secret) {
  const expected = getOwnerBinding(userId, secret);
  if (!expected || typeof binding !== "string") return false;

  const receivedBuffer = Buffer.from(binding, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");

  return receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer);
}
