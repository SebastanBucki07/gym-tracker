# Gym Tracker — Live Supabase Auth Verification (Stage 13B.1)

Ten dokument opisuje procedurę konfiguracji lokalnej oraz instrukcję krok po kroku do przeprowadzenia rzeczywistej weryfikacji Supabase Auth z prawdziwym projektem Supabase.

---

## 1. Bezpieczna konfiguracja lokalna
Aby połączyć lokalną aplikację z Twoim projektem w Supabase bez ryzyka wycieku kluczy do systemu kontroli wersji:
1. W plikach `src/environments/environment.ts` oraz `src/environments/environment.development.ts` wpisz swoje dane:
   ```typescript
   export const environment = {
     production: false,
     supabaseUrl: 'https://TWOJ_PROJEKT.supabase.co',
     supabaseKey: 'TWÓJ_PUBLICZNY_ANON_KEY'
   };
   ```
2. **Ochrona przed commitowaniem (Git)**:
   Aby Git ignorował lokalne zmiany w pliku z konfiguracją, wykonaj w terminalu:
   ```bash
   git update-index --assume-unchanged src/environments/environment.ts
   git update-index --assume-unchanged src/environments/environment.development.ts
   ```
   *(W razie potrzeby przywrócenia śledzenia: `git update-index --no-assume-unchanged src/environments/environment.ts`)*.

---

## 2. Konfiguracja w Dashboardzie Supabase
W panelu Supabase (`Authentication > URL Configuration`):
- **Site URL**: `http://localhost:4200`
- **Redirect URLs**:
  - `http://localhost:4200/`
  - `http://localhost:4200/login`
  - `http://localhost:4200/dashboard`

---

## 3. Instrukcja weryfikacji krok po kroku (Live Verification)

1. **Uruchomienie aplikacji**:
   ```bash
   npm start
   ```
   Otwórz przeglądarkę pod adresem `http://localhost:4200`.

2. **Rejestracja testowego konta**:
   - Przejdź do `/register`.
   - Wybierz zakładkę **Supabase Cloud Auth**.
   - Podaj nazwę użytkownika, swój prawdziwy testowy e-mail oraz hasło (min. 6 znaków).
   - Kliknij **Zarejestruj w Supabase**.

3. **Potwierdzenie e-maila**:
   - Otwórz swoją skrzynkę pocztową i kliknij link potwierdzający (zgodnie z konfiguracją providera Email w Supabase).

4. **Logowanie**:
   - Przejdź do `/login`.
   - Wybierz zakładkę **Supabase Cloud Auth**.
   - Wpisz potwierdzony e-mail i hasło, kliknij **Zaloguj przez Supabase**.
   - Sprawdź poprawność przekierowania do `/dashboard` oraz widoczność nagłówka globalnego z Twoim loginem.

5. **Przywracanie sesji (Session Persistence)**:
   - Odśwież stronę (F5) — sesja powinna zostać automatycznie przywrócona przez klient Supabase.

6. **Wylogowanie**:
   - Kliknij przycisk **Wyloguj** w prawym górnym rogu paska nawigacyjnego — sesja zostanie zakończona, a aplikacja przekieruje Cię do ekranu logowania.

7. **Integralność Local-First**:
   - Sprawdź, że lokalne dane w IndexedDB (treningi, kroki, pomiary) pozostają nienaruszone i dostępne niezależnie od stanu logowania w Supabase Auth.
