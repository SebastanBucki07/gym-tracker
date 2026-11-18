# Gym Tracker — Stage 13C Implementation Roadmap

This document outlines the phased roadmap for implementing cloud synchronization, initial data import, and Supabase-only authentication in Gym Tracker.

---

## Roadmap Phases
- **Stage 13C.2**: Cloud schema deployment preparation (Executing proposed SQL scripts in Supabase Dashboard).
- **Stage 13C.3**: Supabase database repository implementations and mappers (`SupabaseWorkoutRepository`, etc.).
- **Stage 13C.4**: Safe local-to-cloud initial import workflow and wizard UI.
- **Stage 13C.5**: Bidirectional synchronization engine (`SyncService`) with conflict resolution.
- **Stage 13C.6**: Supabase Storage integration for progress photos.
- **Stage 13C.7**: Supabase-only login UI and removal of legacy local login mode.
- **Stage 13C.8**: Multi-device, offline, and security verification.
