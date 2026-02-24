-- Update Manager Aliases
-- Patrick: 148669
-- David: 164475

-- Update or insert Patrick's alias
INSERT INTO manager_aliases (entry_id, manager_name)
VALUES ('148669', 'PATRICK')
ON CONFLICT (entry_id) 
DO UPDATE SET 
  manager_name = 'PATRICK',
  updated_at = NOW();

-- Update or insert David's alias
INSERT INTO manager_aliases (entry_id, manager_name)
VALUES ('164475', 'DAVID')
ON CONFLICT (entry_id) 
DO UPDATE SET 
  manager_name = 'DAVID',
  updated_at = NOW();

-- Verify the updates
SELECT entry_id, manager_name, updated_at
FROM manager_aliases
WHERE manager_name IN ('PATRICK', 'DAVID')
ORDER BY manager_name;
