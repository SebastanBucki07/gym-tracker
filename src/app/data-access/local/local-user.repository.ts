import { UserRepository } from '../contracts/repository.contracts';
import { User } from '../contracts/user.model';
import { db } from './app-database';

export class LocalUserRepository implements UserRepository {
  async getById(id: string): Promise<User | undefined> {
    return await db.users.get(id);
  }

  async getAll(_userId: string): Promise<User[]> {
    return await db.users.toArray();
  }

  async create(item: User): Promise<string> {
    await db.users.add(item);
    return item.id;
  }

  async update(id: string, changes: Partial<User>): Promise<void> {
    await db.users.update(id, { ...changes, updatedAt: new Date() });
  }

  async delete(id: string): Promise<void> {
    await db.users.delete(id);
  }

  async getByEmail(email: string): Promise<User | undefined> {
    return await db.users.where('email').equals(email).first();
  }
}
