import { ProgressPhotoRepository } from '../contracts/repository.contracts';
import { ProgressPhoto } from '../contracts/progress-photo.model';
import { db } from './app-database';

export class LocalProgressPhotoRepository implements ProgressPhotoRepository {
  async getById(id: string): Promise<ProgressPhoto | undefined> {
    return await db.progressPhotos.get(id);
  }

  async getAll(userId: string): Promise<ProgressPhoto[]> {
    return await db.progressPhotos.where('userId').equals(userId).toArray();
  }

  async create(item: ProgressPhoto): Promise<string> {
    await db.progressPhotos.add(item);
    return item.id;
  }

  async update(id: string, changes: Partial<ProgressPhoto>): Promise<void> {
    await db.progressPhotos.update(id, changes);
  }

  async delete(id: string): Promise<void> {
    await db.progressPhotos.delete(id);
  }
}
