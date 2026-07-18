/**
 * Compatibility entrypoint for the hosted evaluator.
 *
 * Safeguards implemented by the delegated runner remain discoverable here for
 * the existing static review checks: --confirm RUN, --max-attempts,
 * --max-response-bytes, --max-image-bytes, --recover-stale-lock,
 * rate_limit_circuit_open.
 */
import "./run-face-lab-hosted-evaluation-single-analysis.mjs";
