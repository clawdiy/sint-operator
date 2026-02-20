# Deliverable 4: Error Messages Map

## Format
```
ERROR_CODE | Where Shown | User Message | Action Text | Technical Detail (logs only)
```

---

## Authentication Errors

| Code | Location | Message | Action | Log Detail |
|------|----------|---------|--------|------------|
| `AUTH_NO_KEY` | Dashboard, Pipeline Runner | `No API key configured. Add one to start generating content.` | `Add API Key →` | Missing OPENAI_API_KEY and ANTHROPIC_API_KEY |
| `AUTH_INVALID_KEY` | Settings, Pipeline Runner | `This API key isn't working. Check that it's correct and has credits.` | `Update API Key` | 401 from provider: {provider} |
| `AUTH_EXPIRED_KEY` | Pipeline Runner | `Your API key has expired. Generate a new one from your provider dashboard.` | `Go to OpenAI ↗` / `Go to Anthropic ↗` | 401 with expiry indicator |
| `AUTH_QUOTA_EXCEEDED` | Pipeline Runner | `You've hit your API usage limit. Check your provider billing or wait for it to reset.` | `Check Usage ↗` | 429 from provider |
| `AUTH_LOGIN_FAILED` | Login | `Wrong email or password.` | — | bcrypt compare failed for {email} |
| `AUTH_SESSION_EXPIRED` | Any page | `Your session expired. Log in again to continue.` | `Log In` | JWT expired at {timestamp} |

## Pipeline Errors

| Code | Location | Message | Action | Log Detail |
|------|----------|---------|--------|------------|
| `PIPELINE_NOT_FOUND` | Pipeline Runner | `This pipeline doesn't exist or was removed.` | `View All Pipelines` | Pipeline ID {id} not in registry |
| `PIPELINE_INPUT_MISSING` | Pipeline Runner | `Missing required field: {fieldName}.` | Focus the field | Validation: {field} required but empty |
| `PIPELINE_INPUT_TOO_SHORT` | Pipeline Runner | `Your content is too short to repurpose. Paste at least a few paragraphs.` | Focus the field | Input length {len} < minimum {min} |
| `PIPELINE_TIMEOUT` | Results | `This pipeline took too long and was stopped. Try with shorter content or fewer platforms.` | `Retry` | Timeout after {seconds}s on step {step} |
| `PIPELINE_STEP_FAILED` | Results | `Something went wrong at the "{stepName}" step. The earlier steps worked — partial results are saved.` | `View Partial Results` | Step {step} threw: {error} |
| `PIPELINE_CANCELLED` | Results | `Pipeline cancelled.` | `Run Again` | User cancelled run {runId} |

## LLM Errors

| Code | Location | Message | Action | Log Detail |
|------|----------|---------|--------|------------|
| `LLM_PARSE_FAILED` | Results | `The AI returned an unexpected format. Retrying usually fixes this.` | `Retry` | JSON parse failed: {parseError}, raw: {first500chars} |
| `LLM_EMPTY_RESPONSE` | Results | `The AI returned an empty response. This sometimes happens with very short inputs — try adding more context.` | `Retry` | Empty completion from {model} |
| `LLM_RATE_LIMITED` | Pipeline Runner | `Too many requests — the AI provider is throttling us. Retrying in {seconds} seconds...` | Auto-retry indicator | 429 from {provider}, retry-after: {seconds} |
| `LLM_OVERLOADED` | Pipeline Runner | `The AI provider is experiencing high demand. Your request is queued.` | Spinner | 503/529 from {provider} |
| `LLM_CONTEXT_TOO_LONG` | Pipeline Runner | `Your content is too long for a single pass. Try splitting it or pasting a shorter excerpt.` | Focus input field | Context length {tokens} exceeds {maxTokens} for {model} |
| `LLM_NETWORK_ERROR` | Pipeline Runner | `Can't reach the AI provider. Check your internet connection.` | `Retry` | ECONNREFUSED / ETIMEDOUT to {provider_url} |

## Brand Errors

| Code | Location | Message | Action | Log Detail |
|------|----------|---------|--------|------------|
| `BRAND_NOT_FOUND` | Brands, Pipeline Runner | `This brand was deleted or doesn't exist.` | `Create New Brand` | Brand ID {id} not found |
| `BRAND_DUPLICATE_ID` | Brand Create | `A brand with this ID already exists. Pick a different one.` | Focus ID field | Duplicate key: {id} |
| `BRAND_VALIDATION` | Brand Create/Edit | `{specific field} is required.` | Focus the field | Validation: {field} failed: {reason} |
| `BRAND_DELETE_IN_USE` | Brands | `This brand is used by {count} scheduled runs. Remove those first, or force delete.` | `Force Delete` / `Cancel` | Brand {id} referenced by runs: {runIds} |

## File / Asset Errors

| Code | Location | Message | Action | Log Detail |
|------|----------|---------|--------|------------|
| `ASSET_TOO_LARGE` | Asset Upload | `This file is too large. Max size: {maxMB}MB.` | — | File {name}: {size}MB > {maxMB}MB |
| `ASSET_UNSUPPORTED` | Asset Upload | `This file type isn't supported. Try: MP4, MP3, PDF, TXT, JPG, PNG.` | — | Unsupported MIME: {mimeType} |
| `ASSET_UPLOAD_FAILED` | Asset Upload | `Upload failed. Try again or use a different file.` | `Retry` | Write error: {fsError} |
| `TRANSCRIPTION_FAILED` | Pipeline Runner | `Couldn't transcribe this audio. Make sure the file isn't corrupted and has clear speech.` | `Try Different File` | Whisper error: {error} |

## Network / Server Errors

| Code | Location | Message | Action | Log Detail |
|------|----------|---------|--------|------------|
| `SERVER_ERROR` | Any | `Something went wrong on our end. Try again in a moment.` | `Retry` | 500: {stack} |
| `SERVER_STARTING` | Any | `The server is starting up. Give it a few seconds.` | Auto-retry | Health check returned starting state |
| `NETWORK_OFFLINE` | Any | `You appear to be offline. Check your connection.` | — | fetch failed: NetworkError |
| `API_UNREACHABLE` | Dashboard | `Can't connect to the API server. Is it running?` | `Check server status` | fetch to /api/health failed |

## Social Publishing Errors (Future — Lane 3)

| Code | Location | Message | Action | Log Detail |
|------|----------|---------|--------|------------|
| `PUBLISH_AUTH_MISSING` | Publish | `Connect your {platform} account first.` | `Connect {Platform} →` | No token for {platform} |
| `PUBLISH_FAILED` | Publish | `Couldn't post to {platform}: {platformError}` | `Retry` / `Copy to Clipboard` | {platform} API: {statusCode} {body} |
| `PUBLISH_RATE_LIMITED` | Publish | `{platform} is rate-limiting posts. Scheduled for {time}.` | — | 429 from {platform} API |
| `PUBLISH_CONTENT_REJECTED` | Publish | `{platform} rejected this content: {reason}. Edit and try again.` | `Edit Content` | {platform} content policy: {code} |

---

## Implementation: Toast Component Props

```typescript
interface ErrorToast {
  code: string;           // ERROR_CODE from above
  message: string;        // User-facing message
  action?: {
    label: string;        // Button text
    onClick: () => void;  // Navigation or retry
  };
  severity: 'error' | 'warning' | 'info';
  autoDismiss?: number;   // ms, default: errors=none, warnings=8000, info=5000
}
```

## Implementation: Error Boundary Fallback

```tsx
// For full-page crashes
<div className="error-fallback">
  <h2>Something broke</h2>
  <p>This page hit an unexpected error. Your data is safe.</p>
  <button onClick={reload}>Reload Page</button>
  <button onClick={goHome}>Go to Dashboard</button>
  <details>
    <summary>Technical details</summary>
    <pre>{error.message}</pre>
  </details>
</div>
```
