import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InitialDataImportService, ImportPreviewResult, ImportProgress } from '../../core/sync/initial-data-import.service';
import { SupabaseAuthService } from '../../core/auth/supabase-auth.service';

@Component({
  selector: 'app-initial-import-wizard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="initial-import-wizard card">
      <h2>Kreator migracji danych do chmury (Initial Import)</h2>
      <p class="subtitle">Przenieś swoje dotychczasowe rekordy treningowe z lokalnego urządzenia (Dexie) do konta Supabase.</p>

      @if (currentUser()) {
        <div class="user-info">
          <strong>Zalogowany użytkownik chmury:</strong> {{ currentUser()?.email }}
        </div>
      } @else {
        <div class="warning-box">
          Brak aktywnej sesji Supabase Auth. Zaloguj się, aby wykonać import.
        </div>
      }

      @if (status() === 'idle') {
        <button class="btn btn-primary" (click)="loadPreview()" [disabled]="!currentUser()">
          Podgląd danych lokalnych
        </button>
      }

      @if (status() === 'previewing' || previewResult()) {
        <div class="preview-section">
          <h3>Podgląd lokalnych danych</h3>
          @if (previewResult(); as preview) {
            <ul class="counts-list">
              <li>Ustawienia aplikacji: <strong>{{ preview.tableCounts['app_settings'] || 0 }}</strong></li>
              <li>Własne ćwiczenia: <strong>{{ preview.tableCounts['exercises'] || 0 }}</strong></li>
              <li>Typy pomiarów: <strong>{{ preview.tableCounts['measurement_types'] || 0 }}</strong></li>
              <li>Treningi: <strong>{{ preview.tableCounts['workouts'] || 0 }}</strong></li>
              <li>Serie treningowe: <strong>{{ preview.tableCounts['workout_sets'] || 0 }}</strong></li>
              <li>Plany treningowe: <strong>{{ preview.tableCounts['workout_plans'] || 0 }}</strong></li>
              <li>Pomiary ciała: <strong>{{ preview.tableCounts['body_measurements'] || 0 }}</strong></li>
              <li>Aktywności cardio: <strong>{{ preview.tableCounts['cardio_activities'] || 0 }}</strong></li>
              <li>Dzienne kroki: <strong>{{ preview.tableCounts['daily_steps'] || 0 }}</strong></li>
              <li>Zdjęcia sylwetki (metadane): <strong>{{ preview.tableCounts['progress_photos'] || 0 }}</strong></li>
            </ul>
            <p><strong>Łącznie rekordów do importu:</strong> {{ preview.totalRecords }}</p>

            @if (preview.hasAmbiguousOwnership) {
              <div class="warning-box">
                Wykryto rekordy powiązane z domyślnym profilem lokalnym (user_jan_1). Zaznacz poniższą opcję, aby je przypisać do aktualnego konta Supabase.
                <label class="checkbox-label">
                  <input type="checkbox" [checked]="allowOverride()" (change)="toggleOverride($event)" />
                  Zezwól na import danych z profilu domyślnego
                </label>
              </div>
            }

            <button class="btn btn-success" (click)="startImport()" [disabled]="preview.totalRecords === 0 || (preview.hasAmbiguousOwnership && !allowOverride())">
              Rozpocznij bezpieczny import do chmury
            </button>
          }
        </div>
      }

      @if (status() === 'importing') {
        <div class="progress-section">
          <h3>Trwa import danych...</h3>
          <p>Aktualna tabela: <strong>{{ progress()?.currentTable }}</strong></p>
          <p>Przetworzono tabel: {{ progress()?.processedTables }} / {{ progress()?.totalTables }}</p>
          <p>Zaimportowano rekordów: {{ progress()?.importedRecords }} / {{ progress()?.totalRecords }}</p>
        </div>
      }

      @if (status() === 'completed') {
        <div class="success-box">
          <h3>Import zakończony pomyślnie!</h3>
          <p>Wszystkie dane zostały bezpiecznie zsynchronizowane z chmurą Supabase. Twoje lokalne rekordy zostały zachowane w Dexie.</p>
          @if (progress()?.errors?.length) {
            <div class="errors-list">
              <h4>Napotkane ostrzeżenia/błędy:</h4>
              <ul>
                @for (err of progress()?.errors; track err) {
                  <li>{{ err }}</li>
                }
              </ul>
            </div>
          }
        </div>
      }

      @if (status() === 'error') {
        <div class="error-box">
          <h3>Wystąpił błąd podczas importu</h3>
          <ul>
            @for (err of progress()?.errors; track err) {
              <li>{{ err }}</li>
            }
          </ul>
          <button class="btn btn-secondary" (click)="loadPreview()">Spróbuj ponownie</button>
        </div>
      }
    </div>
  `,
  styles: [`
    .initial-import-wizard { padding: 1.5rem; max-width: 600px; margin: 1rem auto; background: var(--card-bg, #fff); border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .subtitle { color: var(--text-muted, #666); margin-bottom: 1rem; }
    .user-info, .warning-box, .success-box, .error-box { padding: 1rem; border-radius: 6px; margin: 1rem 0; }
    .user-info { background: #e8f4fd; color: #0d6efd; }
    .warning-box { background: #fff3cd; color: #856404; }
    .success-box { background: #d1e7dd; color: #0f5132; }
    .error-box { background: #f8d7da; color: #842029; }
    .counts-list { list-style: none; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin: 1rem 0; }
    .counts-list li { background: var(--bg-subtle, #f8f9fa); padding: 0.5rem; border-radius: 4px; }
    .checkbox-label { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.5rem; font-weight: 500; cursor: pointer; }
    .btn { padding: 0.75rem 1.5rem; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; }
    .btn-primary { background: #0d6efd; color: #fff; }
    .btn-success { background: #198754; color: #fff; }
    .btn-secondary { background: #6c757d; color: #fff; }
    .btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .errors-list { margin-top: 1rem; font-size: 0.9rem; color: #842029; }
  `]
})
export class InitialImportWizardComponent {
  private importService = inject(InitialDataImportService);
  private supabaseAuth = inject(SupabaseAuthService);

  readonly status = this.importService.status;
  readonly progress = this.importService.progress;
  readonly currentUser = this.supabaseAuth.currentUser;

  previewResult = signal<ImportPreviewResult | null>(null);
  allowOverride = signal<boolean>(false);

  async loadPreview() {
    try {
      const res = await this.importService.previewLocalData();
      this.previewResult.set(res);
    } catch (err: any) {
      alert(err.message || 'Błąd podczas podglądu danych');
    }
  }

  toggleOverride(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    this.allowOverride.set(checked);
  }

  async startImport() {
    try {
      await this.importService.executeImport(this.allowOverride());
    } catch (err: any) {
      alert(err.message || 'Błąd podczas wykonywania importu');
    }
  }
}
