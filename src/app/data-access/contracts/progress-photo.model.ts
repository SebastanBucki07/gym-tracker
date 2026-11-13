export interface ProgressPhoto {
  id: string;
  userId: string;
  imageBlob: Blob;
  takenAt: Date;
  notes?: string;
}
