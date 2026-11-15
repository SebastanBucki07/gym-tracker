import { Injectable } from '@angular/core';
import { LocalProgressPhotoRepository } from '../../data-access/local/local-progress-photo.repository';
import { ProgressPhoto } from '../../data-access/contracts/progress-photo.model';

@Injectable({
  providedIn: 'root'
})
export class ProgressPhotosService {
  private photoRepo = new LocalProgressPhotoRepository();

  async getPhotos(userId: string): Promise<ProgressPhoto[]> {
    const photos = await this.photoRepo.getAll(userId);
    return photos.sort((a, b) => new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime());
  }

  async uploadPhoto(userId: string, file: File, takenAt: Date, notes?: string): Promise<string> {
    const id = 'photo_' + crypto.randomUUID();
    const photo: ProgressPhoto = {
      id,
      userId,
      imageBlob: file,
      takenAt,
      notes
    };
    await this.photoRepo.create(photo);
    return id;
  }

  async deletePhoto(id: string): Promise<void> {
    await this.photoRepo.delete(id);
  }
}
