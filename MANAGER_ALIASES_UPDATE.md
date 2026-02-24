# Manager Aliases Update

## Overview

This document describes the update to manager aliases in the database. Manager aliases map FPL entry IDs to canonical manager names.

## Update Details

**Date:** 2026-01-27

**Changes:**
- **Patrick:** Entry ID updated to `148669`
- **David:** Entry ID updated to `164475`

## Migration

The migration file `supabase/migrations/20260127_update_manager_aliases.sql` contains the SQL to update these mappings.

## Database Schema

The `manager_aliases` table structure:

```sql
CREATE TABLE manager_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id TEXT NOT NULL UNIQUE,
  manager_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT manager_aliases_manager_name_check CHECK (
    manager_name = ANY (ARRAY[
      'PATRICK','MATT','MARCO','LENNART','CHRIS','IAN','HENRI','DAVID','MAX','BENJI'
    ])
  )
);
```

## Current Mappings

| Manager Name | Entry ID |
|--------------|----------|
| PATRICK      | 148669   |
| DAVID        | 164475   |
| MATT         | (to be set) |
| MARCO        | (to be set) |
| LENNART      | (to be set) |
| CHRIS        | (to be set) |
| IAN          | (to be set) |
| HENRI        | (to be set) |
| MAX          | (to be set) |
| BENJI        | (to be set) |

## Usage

Manager aliases are used to:
1. Map FPL entry IDs to canonical manager names
2. Ensure consistent manager identification across seasons
3. Support legacy data imports where entry IDs may change yearly

## Running the Migration

To apply the update:

```bash
# Using Supabase CLI
supabase db push

# Or manually in Supabase dashboard
# Run the SQL from supabase/migrations/20260127_update_manager_aliases.sql
```

## Verification

After running the migration, verify the updates:

```sql
SELECT entry_id, manager_name, updated_at
FROM manager_aliases
WHERE manager_name IN ('PATRICK', 'DAVID')
ORDER BY manager_name;
```

Expected output:
```
entry_id | manager_name | updated_at
---------|--------------|-------------------
148669   | PATRICK      | 2026-01-27 ...
164475   | DAVID        | 2026-01-27 ...
```
