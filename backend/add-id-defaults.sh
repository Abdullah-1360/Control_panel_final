#!/bin/bash

# Add @default(uuid()) to all id String fields that don't have it
sed -i 's/^\(\s*id\s\+String\s*\)$/\1@id @default(uuid())/g' prisma/schema.prisma
sed -i 's/^\(\s*id\s\+String\s\+\)@id$/\1@id @default(uuid())/g' prisma/schema.prisma

echo "Added @default to id fields"
