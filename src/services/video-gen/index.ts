/**
 * Video Generation Service
 * 
 * Providers: Runway ML, Banana.dev (NanoBanana)
 * Async job pattern: submit → poll/webhook for results.
 */

export interface VideoGenRequest {
  prompt?: string;
  imageUrl?: string;
  duration?: number; // seconds
  webhookUrl?: string;
}

export interface VideoGenJob {
  jobId: string;
  provider: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  resultUrl?: string;
  error?: string;
  createdAt: string;
}

export interface VideoGenProvider {
  submit(req: VideoGenRequest): Promise<VideoGenJob>;
  checkStatus(jobId: string): Promise<VideoGenJob>;
}

// --- Runway ML ---

class RunwayVideoGen implements VideoGenProvider {
  private apiKey: string;
  private baseUrl = 'https://api.runwayml.com/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async submit(req: VideoGenRequest): Promise<VideoGenJob> {
    const res = await fetch(`${this.baseUrl}/image_to_video`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: req.prompt,
        image_url: req.imageUrl,
        duration: req.duration ?? 4,
        ...(req.webhookUrl ? { webhook_url: req.webhookUrl } : {}),
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Runway API error ${res.status}: ${text}`);
    }

    const data = (await res.json()) as { id: string; status: string };
    return {
      jobId: data.id,
      provider: 'runway',
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
  }

  async checkStatus(jobId: string): Promise<VideoGenJob> {
    const res = await fetch(`${this.baseUrl}/tasks/${jobId}`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });

    if (!res.ok) {
      throw new Error(`Runway status check failed: ${res.status}`);
    }

    const data = (await res.json()) as { id: string; status: string; output?: { video_url: string }; error?: string };
    const statusMap: Record<string, VideoGenJob['status']> = {
      PENDING: 'pending',
      RUNNING: 'processing',
      SUCCEEDED: 'completed',
      FAILED: 'failed',
    };

    return {
      jobId: data.id,
      provider: 'runway',
      status: statusMap[data.status] ?? 'processing',
      resultUrl: data.output?.video_url,
      error: data.error,
      createdAt: new Date().toISOString(),
    };
  }
}

// --- Banana.dev (NanoBanana) ---

class BananaVideoGen implements VideoGenProvider {
  private apiKey: string;
  private baseUrl = 'https://api.banana.dev';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async submit(req: VideoGenRequest): Promise<VideoGenJob> {
    const res = await fetch(`${this.baseUrl}/start/v4`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        apiKey: this.apiKey,
        modelKey: 'video-gen',
        modelInputs: {
          prompt: req.prompt,
          image_url: req.imageUrl,
          duration: req.duration ?? 4,
        },
        ...(req.webhookUrl ? { startOnly: true, webhookUrl: req.webhookUrl } : {}),
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Banana API error ${res.status}: ${text}`);
    }

    const data = (await res.json()) as { callID: string };
    return {
      jobId: data.callID,
      provider: 'banana',
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
  }

  async checkStatus(jobId: string): Promise<VideoGenJob> {
    const res = await fetch(`${this.baseUrl}/check/v4`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: this.apiKey, callID: jobId }),
    });

    if (!res.ok) {
      throw new Error(`Banana status check failed: ${res.status}`);
    }

    const data = (await res.json()) as { message: string; modelOutputs?: Array<{ video_url: string }> };
    const completed = data.modelOutputs && data.modelOutputs.length > 0;

    return {
      jobId,
      provider: 'banana',
      status: completed ? 'completed' : 'processing',
      resultUrl: completed ? data.modelOutputs![0].video_url : undefined,
      createdAt: new Date().toISOString(),
    };
  }
}

// --- Factory ---

export type VideoGenProviderType = 'runway' | 'banana';

export function createVideoGen(provider: VideoGenProviderType, apiKey: string): VideoGenProvider {
  switch (provider) {
    case 'runway':
      return new RunwayVideoGen(apiKey);
    case 'banana':
      return new BananaVideoGen(apiKey);
    default:
      throw new Error(`Unknown video gen provider: ${provider}`);
  }
}

/** Convenience: use env-configured Runway by default */
export function getVideoGen(provider: VideoGenProviderType = 'runway'): VideoGenProvider {
  const keyMap: Record<string, string> = {
    runway: 'RUNWAY_API_KEY',
    banana: 'BANANA_API_KEY',
  };
  const key = process.env[keyMap[provider]];
  if (!key) throw new Error(`${keyMap[provider]} not configured`);
  return createVideoGen(provider, key);
}
