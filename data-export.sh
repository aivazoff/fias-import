#!/usr/bin/env bash

docker exec -i fias-db psql -U fias -d fias -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" \
    && cat structur.sql | docker exec -i fias-db psql -U fias -d fias \
    && docker cp ./types.sql fias-db:/types.sql \
    && docker exec -i fias-db psql -U fias -d fias -a -f /types.sql