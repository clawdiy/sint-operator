export const API_BASE = '/v1';
const BASE = API_BASE;

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('sint_auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function setAuthToken(token: string) {
  localStorage.setItem('sint_auth_token', token);
}

export function clearAuthToken() {
  localStorage.removeItem('sint_auth_token');
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders(), ...options?.headers },
    ...options,
  });
  if (res.status === 401) {
    clearAuthToken();
    throw new Error('Unauthorized – please log in again');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

const TERMINAL_RUN_STATES = new Set(['completed', 'failed']);
const IN_PROGRESS_RUN_STATES = new Set(['queued', 'running']);

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function isAsyncRunStart(value: unknown): value is { runId: string; status: string } {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.runId === 'string' && typeof v.status === 'string';
}

export function isRunInProgress(status: unknown): boolean {
  return typeof status === 'string' && IN_PROGRESS_RUN_STATES.has(status);
}

export function normalizeRunPayload(run: any): any {
  if (!run || typeof run !== 'object') return run;

  const nested = run.result && typeof run.result === 'object' ? run.result as Record<string, any> : null;
  const outputs = Array.isArray(run.outputs)
    ? run.outputs
    : Array.isArray(nested?.outputs)
      ? nested.outputs
      : [];
  const steps = Array.isArray(run.steps)
    ? run.steps
    : Array.isArray(nested?.steps)
      ? nested.steps
      : [];

  return {
    ...run,
    pipelineId: run.pipelineId ?? nested?.pipelineId,
    brandId: run.brandId ?? nested?.brandId,
    startedAt: run.startedAt ?? nested?.startedAt,
    completedAt: run.completedAt ?? nested?.completedAt,
    status: run.status ?? nested?.status,
    error: run.error ?? nested?.error,
    outputs,
    steps,
    metering: run.metering ?? nested?.metering,
  };
}

// Health
export const getHealth = () => request<{
  status: string; version: string; skills: number; brands: number; pipelines: number;
}>('/health');

// Pipelines
export const getPipelines = () => request<Array<{
  id: string; name: string; description: string; version: string; inputs: Array<{
    name: string; type: string; description?: string; required?: boolean; default?: unknown;
  }>;
}>>('/api/pipelines');

export const getPipeline = (id: string) => request<any>(`/api/pipelines/${id}`);

export const runPipeline = (id: string, brandId: string, inputs: Record<string, unknown>) =>
  request<any>(`/api/pipelines/${id}/run`, {
    method: 'POST',
    body: JSON.stringify({ brandId, inputs }),
  });

export interface RunPollOptions {
  intervalMs?: number;
  timeoutMs?: number;
  onStatus?: (status: string) => void;
}

export async function waitForRun(runId: string, options: RunPollOptions = {}): Promise<any> {
  const intervalMs = options.intervalMs ?? 1500;
  const timeoutMs = options.timeoutMs ?? 5 * 60_000;
  const deadline = Date.now() + timeoutMs;
  let latest: any = null;

  while (Date.now() <= deadline) {
    try {
      latest = await getRun(runId);
    } catch {
      await sleep(intervalMs);
      continue;
    }

    const status = typeof latest?.status === 'string' ? latest.status : 'unknown';
    options.onStatus?.(status);

    if (TERMINAL_RUN_STATES.has(status)) {
      const normalized = normalizeRunPayload(latest);
      if (status === 'failed') {
        throw new Error(normalized?.error || 'Pipeline execution failed');
      }
      return normalized;
    }

    await sleep(intervalMs);
  }

  throw new Error('Pipeline timed out while waiting for completion');
}

export async function runPipelineAndWait(
  id: string,
  brandId: string,
  inputs: Record<string, unknown>,
  options: RunPollOptions = {}
): Promise<any> {
  const started = await runPipeline(id, brandId, inputs);
  if (isAsyncRunStart(started)) {
    options.onStatus?.(started.status);
    return waitForRun(started.runId, options);
  }
  return normalizeRunPayload(started);
}

// Quick Actions
export const repurposeContent = (brandId: string, content: string, platforms: string[]) =>
  request<any>('/api/repurpose', {
    method: 'POST',
    body: JSON.stringify({ brandId, content, platforms }),
  });

export const generateBlog = (brandId: string, topic: string, keywords: string[]) =>
  request<any>('/api/blog', {
    method: 'POST',
    body: JSON.stringify({ brandId, topic, keywords }),
  });

export const generateCalendar = (brandId: string, days: number, themes: string[]) =>
  request<any>('/api/calendar', {
    method: 'POST',
    body: JSON.stringify({ brandId, days, themes }),
  });

// Brands
export const getBrands = () => request<Array<{
  id: string; name: string; voice: { tone: string[]; style: string }; keywords: string[];
}>>('/api/brands');

export const getBrand = (id: string) => request<any>(`/api/brands/${id}`);

export const createBrand = (data: Record<string, unknown>) =>
  request<any>('/api/brands', { method: 'POST', body: JSON.stringify(data) });

// Assets
export const getAssets = () => request<Array<{
  id: string; type: string; originalName: string; mimeType: string; size: number; createdAt: string;
}>>('/api/assets');

export const uploadAsset = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${BASE}/api/assets/upload`, { method: 'POST', body: formData });
  if (!res.ok) throw new Error('Upload failed');
  return res.json();
};

// Skills
export const getSkills = () => request<Array<{
  name: string; description: string; version: string; costUnits: number; level: string;
}>>('/api/skills');

// Runs
export const getRuns = (filters?: { status?: string; pipelineId?: string; brandId?: string; limit?: number }) => {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.pipelineId) params.set('pipelineId', filters.pipelineId);
  if (filters?.brandId) params.set('brandId', filters.brandId);
  if (typeof filters?.limit === 'number') params.set('limit', String(filters.limit));
  const query = params.toString();
  return request<Array<{
  id: string; pipelineId: string; brandId: string; status: string; startedAt: string;
  completedAt?: string; metering: { totalTokens: number; totalCostUnits: number };
}>>(query ? `/api/runs?${query}` : '/api/runs');
};

export const getRun = (id: string) => request<any>(`/api/runs/${id}`);

export const cancelRun = async (id: string) => {
  const res = await request<{ status: string; message: string; run: any }>(`/api/runs/${id}/cancel`, { method: 'POST' });
  return normalizeRunPayload(res.run);
};

// Usage
export const getUsage = (days?: number) => request<{
  period: string; totalRuns: number; totalTokens: number; totalCostUnits: number;
  byModel: Record<string, { tokens: number; costUnits: number; runs: number }>;
  byPipeline: Record<string, { runs: number; costUnits: number }>;
  byBrand: Record<string, { runs: number; costUnits: number }>;
}>(`/api/usage${days ? `?days=${days}` : ''}`);

export const getCurrentUsage = () => request<any>('/api/usage/current');

// Notifications
export const getNotifications = (unreadOnly?: boolean) =>
  request<Array<{id: string; type: string; title: string; message: string; read: boolean; createdAt: string; runId?: string}>>(
    `/api/notifications${unreadOnly ? '?unread=true' : ''}`
  );
export const markNotificationRead = (id: string) => request<any>(`/api/notifications/${id}/read`, { method: 'POST' });
export const markAllNotificationsRead = () => request<any>('/api/notifications/read-all', { method: 'POST' });

// SSE Run Streaming
export function streamRun(runId: string, handlers: {
  onStep?: (step: any) => void;
  onComplete?: (result: any) => void;
  onError?: (error: string) => void;
}): () => void {
  const token = localStorage.getItem('sint_auth_token');
  const query = token ? `?token=${encodeURIComponent(token)}` : '';
  const source = new EventSource(`${BASE}/api/runs/${runId}/stream${query}`);
  source.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'step_start' || data.type === 'step_complete') handlers.onStep?.(data);
    if (data.type === 'complete') { handlers.onComplete?.(data.data); source.close(); }
    if (data.type === 'error') { handlers.onError?.(data.data?.error || 'Unknown error'); source.close(); }
  };
  source.onerror = () => { source.close(); };
  return () => source.close();
}

// Onboarding
export const getOnboardingStatus = () => request<{needsSetup: boolean; hasApiKey: boolean; hasBrand: boolean}>('/api/onboarding/status');
export const completeOnboarding = (data: {openaiApiKey: string; brandName: string; brandUrl?: string; brandTone?: string[]}) =>
  request<any>('/api/onboarding/setup', { method: 'POST', body: JSON.stringify(data) });

// Social Account Connection
export const getSocialStatus = () => request<{
  twitter: {configured: boolean; handle?: string};
  linkedin: {configured: boolean; personUrn?: string};
}>('/api/settings/social/status');

export const connectSocial = (platform: string, credentials: Record<string, string>) =>
  request<{ok: boolean}>(\`/api/settings/social/\${platform}\`, {
    method: 'POST',
    body: JSON.stringify(credentials),
  });

// Publishing
export const publishContent = (platform: string, content: string, hashtags?: string[]) =>
  request<{success: boolean; postUrl?: string; error?: string}>('/api/publish', {
    method: 'POST',
    body: JSON.stringify({ platform, content, hashtags }),
  });

export const getPublishStatus = () =>
  request<{platforms: Record<string, {configured: boolean; handle?: string}>}>('/api/publish/status');
