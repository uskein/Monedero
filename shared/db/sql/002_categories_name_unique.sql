-- 002_categories_name_unique.sql — HU-10: nombre de categoría único sin
-- distinguir mayúsculas/minúsculas (COLLATE NOCASE), solo entre activas:
-- archivar (deleted_at) libera el nombre, igual que las cuentas (001).
CREATE UNIQUE INDEX ux_categories_name
  ON categories(name COLLATE NOCASE) WHERE deleted_at IS NULL;
