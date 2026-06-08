export interface StoredObject {
  key: string;
  contentType: string;
  sizeBytes: number;
}

export interface StorageProvider {
  putObject(input: {
    key: string;
    contentType: string;
    body: ArrayBuffer;
  }): Promise<StoredObject>;
  getSignedReadUrl(key: string, expiresInSeconds: number): Promise<string>;
  deleteObject(key: string): Promise<void>;
}
