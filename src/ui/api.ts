const BASE = '';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
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
export const getRuns = () => request<Array<{
  id: string; pipelineId: string; brandId: string; status: string; startedAt: string;
  completedAt?: string; metering: { totalTokens: number; totalCostUnits: number };
}>>('/api/runs');

export const getRun = (id: string) => request<any>(`/api/runs/${id}`);

// Usage
export const getUsage = (days?: number) => request<{
  period: string; totalRuns: number; totalTokens: number; totalCostUnits: number;
  byModel: Record<string, { tokens: number; costUnits: number; runs: number }>;
  byPipeline: Record<string, { runs: number; costUnits: number }>;
  byBrand: Record<string, { runs: number; costUnits: number }>;
}>(`/api/usage${days ? `?days=${days}` : ''}`);

export const getCurrentUsage = () => request<any>('/api/usage/current');
