# Gym Tracker — Supabase Deployment Guide

This guide outlines the step-by-step procedure for manually deploying the finalized Gym Tracker database schema, RLS security policies, and Storage bucket policies to a Supabase project.

---

## Prerequisites
- A Supabase project created in the Supabase Dashboard.
- Access to the Supabase SQL Editor.

---

## Step 1: Execute Schema SQL (`001_schema.sql`)
1. Open the Supabase Dashboard and select your project.
2. Navigate to **SQL Editor**.
3. Create a new query and paste the contents of `docs/supabase/deploy/001_schema.sql`.
4. Click **Run** to create all 14 tables, triggers, helper functions, and indexes.

---

## Step 2: Execute Row Level Security SQL (`002_rls.sql`)
1. In the **SQL Editor**, create a new query.
2. Paste the contents of `docs/supabase/deploy/002_rls.sql`.
3. Click **Run** to enable RLS across all tables and apply granular ownership policies.

---

## Step 3: Create Private Storage Bucket (`progress-photos`)
1. Navigate to **Storage** in the Supabase Dashboard.
2. Create a new bucket named `progress-photos`.
3. Set bucket visibility to **Private** (Public access disabled).

---

## Step 4: Execute Storage Security Policies SQL (`003_storage.sql`)
1. In the **SQL Editor**, create a new query.
2. Paste the contents of `docs/supabase/deploy/003_storage.sql`.
3. Click **Run** to apply secure folder-scoped RLS policies to `storage.objects`.

---

## Step 5: Execute Synchronization Metadata SQL (`004_sync_metadata.sql`)
1. In the **SQL Editor**, create a new query.
2. Paste the contents of `docs/supabase/deploy/004_sync_metadata.sql`.
3. Click **Run** to apply synchronization helper functions and delta sync indexes.
