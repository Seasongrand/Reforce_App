-- Extensões exigidas pela especificação (§3.2). As migrações do apêndice
-- repetem CREATE EXTENSION IF NOT EXISTS, que aqui vira operação vazia.
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;
CREATE EXTENSION IF NOT EXISTS unaccent;
