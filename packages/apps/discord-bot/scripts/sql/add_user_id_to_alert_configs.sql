-- Add user_id column to alert_configs table
-- This is required for scheduled tasks to access user's MCP tools

-- Step 1: Add the column (nullable first, since we need to populate it)
ALTER TABLE public.alert_configs 
ADD COLUMN IF NOT EXISTS user_id TEXT;

-- Step 2: Populate user_id from user_tasks table where IDs match
UPDATE public.alert_configs ac
SET user_id = ut.user_id
FROM public.user_tasks ut
WHERE ac.id = ut.id AND ac.user_id IS NULL;

-- Step 3: For any remaining NULL values, try to extract from old composite IDs
-- Format was: userId_timestamp_random
UPDATE public.alert_configs
SET user_id = split_part(id, '_', 1)
WHERE user_id IS NULL AND id LIKE '%_%_%';

-- Step 4: Log any alerts that still don't have user_id
DO $$ 
DECLARE
    null_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO null_count FROM public.alert_configs WHERE user_id IS NULL;
    IF null_count > 0 THEN
        RAISE NOTICE 'Warning: % alert(s) still have NULL user_id - these may need manual cleanup', null_count;
    END IF;
END $$;

-- Step 5: Make the column NOT NULL after population
-- (Commented out for safety - uncomment after verifying all alerts have user_id)
-- ALTER TABLE public.alert_configs 
-- ALTER COLUMN user_id SET NOT NULL;

-- Create index for efficient userId lookups
CREATE INDEX IF NOT EXISTS idx_alert_configs_user_id ON public.alert_configs(user_id);

-- Grant permissions
GRANT ALL ON public.alert_configs TO service_role;
