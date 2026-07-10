# Analyze Route Fixtures

`analyze-payload.fixture.json` is a minimal multipart form-field fixture for a future isolated `/api/analyze` check. It contains only enum-like survey values and an empty current-product list. It does not contain a product display field, user input record, URL, review text, raw image data, or PII.

`test-face-placeholder.png` is a generated 1x1 PNG. It is not a user image and exists only to exercise the route upload MIME/size boundary. It is not evidence that a face-analysis provider will accept the image semantically.

Before Phase 43, the runner must attach the PNG as multipart field `image`, apply every `formFields` entry unchanged, and use the same fixture for flag-off and flag-on requests. The run is prohibited unless the non-production target assertion is safe, a disposable cleanup contract is present, and baseline/flag-on mutation counters can separate existing route writes from shadow-added writes.

Do not serialize this image, its bytes, user images, product display fields, secrets, full response bodies, or database payloads into review artifacts.
