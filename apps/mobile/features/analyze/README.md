# Analyze feature boundary

MOBILE-7 owns the native survey, final-photo multipart transport, and free-result presentation client.

Authority stays server-side:

- `/api/analyze` remains the canonical analysis endpoint.
- Recommendation, Product Fact / Product Decision Axis, Face Lab, and Premium engines are not imported or reimplemented in `apps/mobile`.
- The native client reuses the MOBILE-4 shared survey normalizer and the existing `EXPO_PUBLIC_API_BASE_URL` boundary.
- Only the final `NativeCameraPhoto` JPEG from MOBILE-5 is eligible for upload. MOBILE-6 guidance samples stay local and are deleted after detection.
- A signed-in native user may send the existing Supabase Bearer access token. Anonymous analysis continues to use the server's existing anonymous analysis-guard authority.
- Multipart `Content-Type` is not set manually so the native fetch implementation owns the boundary value.
- MOBILE-7 renders the server's free result in memory. Premium purchase/session UX, save/share expansion, and deep-link work remain MOBILE-8+.
