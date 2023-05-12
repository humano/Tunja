#!/bin/bash

# Database
pgdb='gridtunja'
pguser='postgres'
pgpass='postgres'
pghost='localhost'

pgroot="postgres://${pguser}@${pghost}"
pguri="${pgroot}/${pgdb}"

# DROP/CREATE Database
psql $pgroot -c "DROP DATABASE IF EXISTS ${pgdb};"
psql $pgroot -c "CREATE DATABASE ${pgdb};"

# CREATE schemas
psql $pguri -c "CREATE EXTENSION postgis; CREATE SCHEMA optim; CREATE SCHEMA osmc; CREATE SCHEMA ggeohash; CREATE SCHEMA natcod; CREATE SCHEMA gridstunja;"

# Load jurisdiction Tunja and cover base
psql $pguri < dump_data.sql

# Load required functions
psql $pguri < functions.sql

# Create tables with grids for base coverage, L9, L11.5, L14, L16.5 levels
psql $pguri < table_grids.sql

# Create shapefile for base coverage
file_basename='tunjacover0'
if pgsql2shp -k -f ${file_basename}.shp -h ${pghost} -u ${pguser} -P ${pgpass} ${pgdb} "SELECT gid, jurisd_base_id, isolabel_ext, kx_prefix, cindex, geom FROM gridstunja.cover0;"
then
  mkdir ${file_basename}
  mv ${file_basename}.{shp,cpg,dbf,prj,shx} ${file_basename}
  zip -r ${file_basename}.zip ${file_basename}
  rm -rf ${file_basename}
fi

# Create shapefile for L9, L11.5, L14, L16.5 levels
for i in $(seq 1 1 4)
do
    file_basename='tunjacover'${i}
    if pgsql2shp -k -f ${file_basename}.shp -h ${pghost} -u ${pguser} -P ${pgpass} ${pgdb} "SELECT gid, jurisd_base_id, isolabel_ext, code, prefix, suffix, geom  FROM gridstunja.cover${i};"
    then
      mkdir ${file_basename}
      mv ${file_basename}.{shp,cpg,dbf,prj,shx} ${file_basename}
      zip -r ${file_basename}.zip ${file_basename}
      rm -rf ${file_basename}
    fi
done
