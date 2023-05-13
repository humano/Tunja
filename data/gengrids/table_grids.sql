DROP VIEW IF EXISTS gridstunja.jurisd;
CREATE VIEW gridstunja.jurisd AS
  SELECT 1 AS gid, ST_Transform(z.geom,9377) AS geom_transformed
  FROM optim.vw01full_jurisdiction_geom z
  WHERE isolabel_ext = 'CO-BOY-Tunja'
;

-- Base coverage
DROP TABLE IF EXISTS gridstunja.cover0;
CREATE TABLE gridstunja.cover0 AS
  SELECT ROW_NUMBER() OVER (ORDER BY cindex) AS gid, a.cbits, (a.cbits::bit(10))::int AS jurisd_base_id, a.isolabel_ext, a.kx_prefix, a.cindex, a.is_contained, osmc.extract_cellbits(a.cbits) AS codebits,
        ST_SRID(a.geom) AS srid, osmc.extract_L0bits(b.cbits,b.isolabel_ext) AS l0code, b.bbox, a.geom
  FROM osmc.coverage a,
  LATERAL
  (
      SELECT bbox, cbits, isolabel_ext

      FROM osmc.coverage
      WHERE isolabel_ext = split_part('CO-BOY-Tunja','-',1) -- cobertura nacional apenas
      AND
        CASE
        WHEN isolabel_ext = 'CO' THEN ( ( osmc.extract_L0bits(cbits,'CO')         # osmc.extract_cellbits(a.cbits)::bit(4) ) = 0::bit(4) ) -- 1 dígitos base16h
        ELSE                          ( ( osmc.extract_L0bits(cbits,isolabel_ext) # osmc.extract_cellbits(a.cbits)::bit(8) ) = 0::bit(8) ) -- 2 dígitos base16h
        END
  ) b
  WHERE a.is_overlay IS FALSE AND a.isolabel_ext='CO-BOY-Tunja'
  ORDER BY cindex
;

-- Grid L9 (1km)
DROP TABLE IF EXISTS gridstunja.cover1;
CREATE TABLE gridstunja.cover1 AS
  SELECT ROW_NUMBER() OVER (ORDER BY code) AS gid, jurisd_base_id, isolabel_ext, kx_prefix, cindex, code, substring(code,1,length(code)-1) AS prefix, substring(code FROM length(code)) AS suffix, codebits, srid, bbox, geom
  FROM
  (
    SELECT jurisd_base_id, kx_prefix, regexp_replace(code,'^'||kx_prefix,cindex) AS code, codebits || la AS codebits, srid, bbox, isolabel_ext, cindex,
      ST_Intersection(geom,
          (
              SELECT ST_Transform(z.geom,e.srid) AS geom_transformed
              FROM optim.vw01full_jurisdiction_geom z
              WHERE isolabel_ext = e.isolabel_ext
          )
      ) AS geom
    FROM
    (
      SELECT z.bbox, z.srid, z.jurisd_base_id, z.codebits, z.la, z.isolabel_ext, z.code, z.geom,
          CASE
          WHEN x.kx_prefix IS NULL THEN z.kx_prefix
          ELSE x.kx_prefix
          END AS kx_prefix,
          CASE
          WHEN x.cindex IS NULL THEN z.cindex
          ELSE x.cindex
          END AS cindex
      FROM
      (
        SELECT bbox, srid, jurisd_base_id, kx_prefix, cindex, codebits, la, isolabel_ext,
                natcod.vbit_to_strstd( osmc.vbit_from_16h_to_vbit_b32nvu((codebits || la),jurisd_base_id),'32nvu') AS code,
                ggeohash.draw_cell_bybox(ggeohash.decode_box2(osmc.vbit_withoutL0(codebits,'CO') || la,bbox,false),false,srid) AS geom
        FROM gridstunja.cover0 c,
        unnest('{00000,00001,00010,00011,00100,00101,00110,00111,01000,01001,01010,01011,01100,01101,01110,01111,10000,10001,10010,10011,10100,10101,10110,10111,11000,11001,11010,11011,11100,11101,11110,11111}'::varbit[]) d(la)
      ) z
      LEFT JOIN (SELECT * FROM osmc.coverage  WHERE isolabel_ext = 'CO-BOY-Tunja' AND is_overlay IS TRUE) x
      ON z.code = x.kx_prefix
    ) e
    WHERE
        ST_Intersects(
            (
                SELECT ST_Transform(z.geom,e.srid) AS geom_transformed
                FROM optim.vw01full_jurisdiction_geom z
                WHERE isolabel_ext = e.isolabel_ext
            )
        ,e.geom)
  ) f
  ORDER BY code
;

-- Grid L11.5 (181m)
DROP TABLE IF EXISTS gridstunja.cover2;
CREATE TABLE gridstunja.cover2 AS
  SELECT ROW_NUMBER() OVER (ORDER BY code) AS gid, jurisd_base_id, isolabel_ext, kx_prefix, cindex, code,
  CASE WHEN length(code) =1 THEN code ELSE substring(code,1,length(code)-1) END AS prefix,
  CASE WHEN length(code) =1 THEN ''   ELSE substring(code FROM length(code)) END AS suffix, codebits, srid, bbox, geom
  FROM
  (
    SELECT jurisd_base_id, kx_prefix, regexp_replace(code,'^'||kx_prefix,cindex) AS code, codebits || la AS codebits, srid, bbox, isolabel_ext, cindex,
      ST_Intersection(geom,
          (
              SELECT ST_Transform(z.geom,e.srid) AS geom_transformed
              FROM optim.vw01full_jurisdiction_geom z
              WHERE isolabel_ext = e.isolabel_ext
          )
      ) AS geom
    FROM
    (
      SELECT bbox, srid, jurisd_base_id, kx_prefix, cindex, codebits, la, isolabel_ext,
              natcod.vbit_to_strstd( osmc.vbit_from_16h_to_vbit_b32nvu((codebits || la),jurisd_base_id),'32nvu') AS code,
              ggeohash.draw_cell_bybox(ggeohash.decode_box2(osmc.vbit_withoutL0(codebits,'CO') || la,bbox,false),false,srid) AS geom
      FROM gridstunja.cover1 c,
      unnest('{00000,00001,00010,00011,00100,00101,00110,00111,01000,01001,01010,01011,01100,01101,01110,01111,10000,10001,10010,10011,10100,10101,10110,10111,11000,11001,11010,11011,11100,11101,11110,11111}'::varbit[]) d(la)
    ) e
    WHERE
        ST_Intersects(
            (
                SELECT ST_Transform(z.geom,e.srid) AS geom_transformed
                FROM optim.vw01full_jurisdiction_geom z
                WHERE isolabel_ext = e.isolabel_ext
            )
        ,e.geom)
  ) f
  ORDER BY code
;

-- Grid L14 (32m)
DROP TABLE IF EXISTS gridstunja.cover3;
CREATE TABLE gridstunja.cover3 AS
  SELECT ROW_NUMBER() OVER (ORDER BY code) AS gid, jurisd_base_id, isolabel_ext, kx_prefix, cindex, code, substring(code,1,length(code)-1) AS prefix, substring(code FROM length(code)) AS suffix, codebits, srid, bbox, geom
  FROM
  (
    SELECT jurisd_base_id, kx_prefix, regexp_replace(code,'^'||kx_prefix,cindex) AS code, codebits || la AS codebits, srid, bbox, isolabel_ext, cindex,
      ST_Intersection(geom,
          (
              SELECT ST_Transform(z.geom,e.srid) AS geom_transformed
              FROM optim.vw01full_jurisdiction_geom z
              WHERE isolabel_ext = e.isolabel_ext
          )
      ) AS geom
    FROM
    (
      SELECT bbox, srid, jurisd_base_id, kx_prefix, cindex, codebits, la, isolabel_ext,
              natcod.vbit_to_strstd( osmc.vbit_from_16h_to_vbit_b32nvu((codebits || la),jurisd_base_id),'32nvu') AS code,
              ggeohash.draw_cell_bybox(ggeohash.decode_box2(osmc.vbit_withoutL0(codebits,'CO') || la,bbox,false),false,srid) AS geom
      FROM gridstunja.cover2 c,
      unnest('{00000,00001,00010,00011,00100,00101,00110,00111,01000,01001,01010,01011,01100,01101,01110,01111,10000,10001,10010,10011,10100,10101,10110,10111,11000,11001,11010,11011,11100,11101,11110,11111}'::varbit[]) d(la)
    ) e
    WHERE
        ST_Intersects(
            (
                SELECT ST_Transform(z.geom,e.srid) AS geom_transformed
                FROM optim.vw01full_jurisdiction_geom z
                WHERE isolabel_ext = e.isolabel_ext
            )
        ,e.geom)
  ) f
  ORDER BY code
;

-- Grid L16.5 (5.7m)
DROP TABLE IF EXISTS gridstunja.cover4;
CREATE TABLE gridstunja.cover4 AS
  SELECT ROW_NUMBER() OVER (ORDER BY code) AS gid, jurisd_base_id, isolabel_ext, kx_prefix, cindex, code, substring(code,1,length(code)-1) AS prefix, substring(code FROM length(code)) AS suffix, codebits, srid, bbox, geom
  FROM
  (
    SELECT jurisd_base_id, kx_prefix, regexp_replace(code,'^'||kx_prefix,cindex) AS code, codebits || la AS codebits, srid, bbox, isolabel_ext, cindex,
      ST_Intersection(geom,
          (
              SELECT ST_Transform(z.geom,e.srid) AS geom_transformed
              FROM optim.vw01full_jurisdiction_geom z
              WHERE isolabel_ext = e.isolabel_ext
          )
      ) AS geom
    FROM
    (
      SELECT bbox, srid, jurisd_base_id, kx_prefix, cindex, codebits, la, isolabel_ext,
              natcod.vbit_to_strstd( osmc.vbit_from_16h_to_vbit_b32nvu((codebits || la),jurisd_base_id),'32nvu') AS code,
              ggeohash.draw_cell_bybox(ggeohash.decode_box2(osmc.vbit_withoutL0(codebits,'CO') || la,bbox,false),false,srid) AS geom
      FROM gridstunja.cover3 c,
      unnest('{00000,00001,00010,00011,00100,00101,00110,00111,01000,01001,01010,01011,01100,01101,01110,01111,10000,10001,10010,10011,10100,10101,10110,10111,11000,11001,11010,11011,11100,11101,11110,11111}'::varbit[]) d(la)
    ) e
    WHERE
        ST_Intersects(
            (
                SELECT ST_Transform(z.geom,e.srid) AS geom_transformed
                FROM optim.vw01full_jurisdiction_geom z
                WHERE isolabel_ext = e.isolabel_ext
            )
        ,e.geom)
  ) f
  ORDER BY code
;
