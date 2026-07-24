export interface SignedUrl {
  url: string;
  expires_at: string;
}

export interface IMapStorage {
  readonly name: string;
  /** Return a signed download URL for a region bundle artifact. */
  getSignedUrl(regionId: string, version: number, artifact: string): SignedUrl;
}
