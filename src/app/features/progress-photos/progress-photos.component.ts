import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { AuthService } from '../../core/auth/auth.service';
import { ProgressPhotosService } from './progress-photos.service';
import { ProgressPhoto } from '../../data-access/contracts/progress-photo.model';

export interface DisplayPhoto extends ProgressPhoto {
  safeUrl: SafeUrl;
}

@Component({
  selector: 'app-progress-photos',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './progress-photos.component.html',
  styleUrl: './progress-photos.component.scss'
})
export class ProgressPhotosComponent implements OnInit {
  private photoService = inject(ProgressPhotosService);
  private authService = inject(AuthService);
  private sanitizer = inject(DomSanitizer);

  private getLocalDateString(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  photos = signal<DisplayPhoto[]>([]);
  loading = signal<boolean>(true);

  // Upload form state
  selectedFile = signal<File | null>(null);
  photoDate = signal<string>(this.getLocalDateString());
  photoNotes = signal<string>('');

  // Comparison state
  comparePhoto1 = signal<DisplayPhoto | null>(null);
  comparePhoto2 = signal<DisplayPhoto | null>(null);
  isComparing = signal<boolean>(false);

  async ngOnInit() {
    await this.loadPhotos();
  }

  async loadPhotos() {
    const userId = this.authService.getCurrentUserId();

    this.loading.set(true);
    try {
      const rawPhotos = await this.photoService.getPhotos(userId);
      const displayPhotos: DisplayPhoto[] = rawPhotos.map(p => ({
        ...p,
        safeUrl: this.sanitizer.bypassSecurityTrustUrl(URL.createObjectURL(p.imageBlob))
      }));
      this.photos.set(displayPhotos);
    } catch (err) {
      console.error('Error loading progress photos:', err);
    } finally {
      this.loading.set(false);
    }
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile.set(file);
    }
  }

  async uploadPhoto(event: Event) {
    event.preventDefault();
    const userId = this.authService.getCurrentUserId();
    const file = this.selectedFile();
    if (!file) return;

    try {
      await this.photoService.uploadPhoto(
        userId,
        file,
        new Date(this.photoDate()),
        this.photoNotes()
      );
      this.selectedFile.set(null);
      this.photoNotes.set('');
      this.photoDate.set(this.getLocalDateString());
      await this.loadPhotos();
    } catch (err) {
      console.error('Error uploading photo:', err);
    }
  }

  async deletePhoto(id: string) {
    if (!confirm('Czy na pewno chcesz usunąć to zdjęcie?')) return;

    try {
      await this.photoService.deletePhoto(id);
      await this.loadPhotos();
    } catch (err) {
      console.error('Error deleting photo:', err);
    }
  }

  startComparison() {
    const list = this.photos();
    if (list.length >= 2) {
      this.comparePhoto1.set(list[list.length - 1]); // oldest
      this.comparePhoto2.set(list[0]); // newest
      this.isComparing.set(true);
    } else {
      alert('Dodaj co najmniej 2 zdjęcia, aby włączyć porównanie.');
    }
  }

  closeComparison() {
    this.isComparing.set(false);
  }

  formatDate(date: Date | string): string {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  }
}
