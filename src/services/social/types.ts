export type SocialPlatform = 'twitter' | 'linkedin';

export interface TwitterCredentials {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessSecret: string;
  handle?: string;
}

export interface LinkedInCredentials {
  accessToken: string;
  personUrn: string;
}

export interface SocialCredentials {
  twitter?: TwitterCredentials;
  linkedin?: LinkedInCredentials;
}
