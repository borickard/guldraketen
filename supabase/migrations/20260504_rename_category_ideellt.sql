-- Rename "Offentlig sektor & ideell" -> "Offentlig sektor & ideellt"
UPDATE accounts
SET category = 'Offentlig sektor & ideellt'
WHERE category = 'Offentlig sektor & ideell';
