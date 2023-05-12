-- see: https://github.com/digital-guard/preserv/blob/main/src/optim-step1-ini.sql
CREATE VIEW optim.vw01full_jurisdiction_geom AS
    SELECT j.*, g.geom
    FROM optim.jurisdiction j
    LEFT JOIN optim.jurisdiction_geom g
    ON j.osm_id = g.osm_id
;
COMMENT ON VIEW optim.vw01full_jurisdiction_geom
  IS 'Add geom to optim.jurisdiction.'
;

-- see: https://github.com/osm-codes/GGeohash/blob/main/src/step03def-lib.sql
CREATE or replace FUNCTION osmc.extract_L0bits(
  p_x   varbit,
  p_iso text
) RETURNS varbit AS $wrap$
  SELECT
    CASE
    WHEN p_iso IN ('BR','UY','EC') THEN (p_x<<10)::bit(8) -- Retorna 8 bits
    WHEN p_iso IN ('CO')           THEN (p_x<<10)::bit(4) -- Retorna 4 bits
    END
    ;
$wrap$ LANGUAGE SQL IMMUTABLE;
COMMENT ON FUNCTION osmc.extract_L0bits(varbit,text)
  IS 'Return bits L0 from id cell.'
;

CREATE or replace FUNCTION osmc.extract_cellbits(
  p_x  varbit
) RETURNS varbit AS $f$
  SELECT substring(p_x from 11);
$f$ LANGUAGE SQL IMMUTABLE;
COMMENT ON FUNCTION osmc.extract_cellbits(varbit)
  IS 'Return cell bits. Discard jurisdiction bits.'
;

CREATE or replace FUNCTION osmc.vbit_from_16h_to_vbit_b32nvu(
  p_x  varbit,
  p_iso int
) RETURNS varbit AS $wrap$
  SELECT
    CASE
    WHEN p_iso IN (76,868,218) THEN substring(p_x from 4) -- 8bits MSb viram 5
    WHEN p_iso IN (170)        THEN b'0' || substring(p_x,1,4) || b'00' || substring(p_x from 5) -- 4bits MSb viram 5. eg.: xxxxxxxx -> 0xxxx00xxxx
    END
    ;
$wrap$ LANGUAGE SQL IMMUTABLE;
COMMENT ON FUNCTION osmc.vbit_from_16h_to_vbit_b32nvu(varbit,int)
  IS 'Convert 4-bit L0 to 5-bit L0.'
;

CREATE or replace FUNCTION osmc.vbit_withoutL0(
  p_x  varbit,
  p_iso text,
  p_base int DEFAULT 16
) RETURNS varbit AS $wrap$
  SELECT
    CASE
    WHEN p_iso IN ('BR','UY','EC') AND p_base <> 32 THEN substring(p_x from 9) -- Remove 8 bits MSb
    WHEN p_iso IN ('CO')           AND p_base <> 32 THEN substring(p_x from 5) -- Remove 4 bits MSb
    WHEN p_base = 32                                THEN substring(p_x from 6) -- Remove 5 bits MSb
    END
    ;
$wrap$ LANGUAGE SQL IMMUTABLE;
COMMENT ON FUNCTION osmc.vbit_withoutL0(varbit,text,int)
  IS 'Remove 4-bit or 8-bit L0.'
;

-- see: https://github.com/osm-codes/NaturalCodes/blob/main/src/step01def-lib_NatCod.sql
CREATE FUNCTION varbit_to_int( b varbit, blen int DEFAULT NULL) RETURNS int AS $f$
  -- slower  SELECT (  (b'0'::bit(32) || b) << COALESCE(blen,length(b))   )::bit(32)::int
  -- !loss information about varbit zeros and empty varbit
  SELECT overlay( b'0'::bit(32) PLACING b FROM 33-COALESCE(blen,length(b)) )::int
$f$ LANGUAGE SQL IMMUTABLE;
-- select b'010101'::bit(32) left_copy, varbit_to_int(b'010101')::bit(32) right_copy;
COMMENT ON FUNCTION varbit_to_int
  IS 'Fast and lossy convertion, from varbit to integer. Loss of empty and leading zeros.'
;

CREATE FUNCTION natcod.vbit_to_strstd(
  p_val varbit,  -- input
  p_base text DEFAULT '4js' -- selecting base2js? base4js, etc. with no leading zeros.
) RETURNS text AS $f$
DECLARE
    vlen int;
    pos0 int;
    ret text := '';
    blk varbit;
    blk_n int;
    bits_per_digit int;
    trtypes JSONb := '{
      "4js":[0,1,2],"8js":[0,1,3],"16js":[0,1,4],
      "32ghs":[1,4,5],"32hex":[1,1,5],"32nvu":[1,2,5],"32rfc":[1,3,5],
      "64url":[2,8,6]
    }'::JSONb; -- var,pos,bits
    base0 "char"[] := array[
      '[0:15]={0,1,2,3,4,5,6,7,8,9,a,b,c,d,e,f}'::"char"[] --1. 4,5,16 js
    ];
    base1 "char"[] := array[
       '[0:31]={0,1,2,3,4,5,6,7,8,9,a,b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t,u,v}'::"char"[] --1=32hex
      ,'[0:31]={0,1,2,3,4,5,6,7,8,9,B,C,D,F,G,H,J,K,L,M,N,P,Q,R,S,T,U,V,W,X,Y,Z}'::"char"[] --2=32nvu
      ,'[0:31]={A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z,2,3,4,5,6,7}'::"char"[] --3=32rfc
      ,'[0:31]={0,1,2,3,4,5,6,7,8,9,b,c,d,e,f,g,h,j,k,m,n,p,q,r,s,t,u,v,w,x,y,z}'::"char"[] --4=32ghs
    ];
    -- "64url": "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
    tr_selected JSONb;
    trbase "char"[];
BEGIN
  vlen := bit_length(p_val);
  tr_selected := trtypes->(p_base::text);-- [1=var,2=pos,3=bits]
  IF p_val IS NULL OR tr_selected IS NULL OR vlen=0 THEN
    RETURN NULL; -- or  p_retnull;
  END IF;
  IF p_base='2' THEN
     -- need to strip leading zeros
    RETURN $1::text; --- direct bit string as string
  END IF;
  bits_per_digit := (tr_selected->>2)::int;
  IF vlen % bits_per_digit != 0 THEN
    RETURN NULL;  -- trigging ERROR
  END IF;
  blk_n := vlen/bits_per_digit;
  pos0 = (tr_selected->>1)::int;
  -- trbase := CASE tr_selected->>0 WHEN '0' THEN base0[pos0] ELSE base1[pos0] END; -- NULL! pgBUG?
  trbase := CASE tr_selected->>0 WHEN '0' THEN base0 ELSE base1 END;
  --RAISE NOTICE 'HELLO: %; % % -- %',pos0,blk_n,trbase,trbase[pos0][1];
  FOR counter IN 1..blk_n LOOP
      blk := substring(p_val FROM 1 FOR bits_per_digit);
      ret := ret || trbase[pos0][ varbit_to_int(blk,bits_per_digit) ];
      p_val := substring(p_val FROM bits_per_digit+1);
  END LOOP;
  vlen := bit_length(p_val);
  -- IF p_val!=b'' THEN ERROR
  RETURN ret;
END
$f$ LANGUAGE PLpgSQL IMMUTABLE;
COMMENT ON FUNCTION natcod.vbit_to_strstd
 IS 'Converts bit string to text, using standard numeric bases (base4js, base32ghs, etc.).'
;

-- see: https://github.com/osm-codes/GGeohash/blob/main/src/step02def-libGGeohash.sql
CREATE or replace FUNCTION ggeohash.decode_box2(
   code  varbit,
   min_x  int   default -90.,
   min_y  int   default -180.,
   max_x  int   default 90.,
   max_y  int   default 180.,
   lonlat boolean default false -- false: latLon, true: lonLat
) RETURNS int[] as $f$
DECLARE
  mid float;
  bit int;
  i   int;
  j   int := 0;
BEGIN
    IF lonlat THEN
      j := 1;
    END IF;
   FOR i IN 0..(bit_length(code)-1) LOOP
      bit = get_bit(code,i);
      IF i % 2 = j THEN
        mid = (max_y + min_y)::float / 2.0;
        IF bit = 1 THEN
          min_y := mid;
        ELSE
          max_y := mid;
        END IF;
      ELSE
        mid = (max_x + min_x)::float / 2.0;
        IF bit =1 THEN
          min_x = mid;
        ELSE
          max_x = mid;
        END IF;
      END IF;
   END LOOP;
   RETURN array[min_x, min_y, max_x, max_y];
END
$f$ LANGUAGE PLpgSQL IMMUTABLE;
COMMENT ON FUNCTION ggeohash.decode_box2(varbit, int, int, int, int, boolean)
  IS 'Decodes string of a Generalized Geohash into a bounding Box that matches it. Returns a four-element array: [minlat, minlon, maxlat, maxlon]. Algorithm adapted from https://github.com/ppKrauss/node-geohash/blob/master/main.js'
;

CREATE or replace FUNCTION ggeohash.decode_box2(
   code varbit,
   bbox int[],
   lonlat boolean default false
) RETURNS int[] as $wrap$
  SELECT ggeohash.decode_box2($1, bbox[1], bbox[2], bbox[3], bbox[4],lonlat)
$wrap$ LANGUAGE sql IMMUTABLE;
COMMENT ON FUNCTION ggeohash.decode_box2(varbit, int[],boolean)
  IS 'Wrap for ggeohash.decode_box2(varbit, int, int, int, int, boolean).'
;

CREATE or replace FUNCTION ggeohash.draw_cell_bybox(
  b int[],  -- bbox [min_x, min_y, max_x, max_y]
  p_translate boolean DEFAULT false, -- true para converter em LatLong (WGS84 sem projeção)
  p_srid int DEFAULT 4326            -- WGS84
) RETURNS geometry AS $f$
SELECT CASE WHEN p_translate THEN ST_Transform(geom,4326) ELSE geom END
FROM (
  SELECT ST_GeomFromText( format(
    'POLYGON((%s %s,%s %s,%s %s,%s %s,%s %s))',
    b[1],b[2], b[1],b[4], b[3],b[4], b[3],b[2], b[1],b[2]
    -- min_x,min_y, min_x,max_y, max_x,max_y, max_x,min_y, min_x,min_y
  ), p_srid) AS geom
) t
$f$ LANGUAGE SQL IMMUTABLE;
COMMENT ON FUNCTION ggeohash.draw_cell_bybox(int[],boolean,int)
  IS 'Draws a square-cell from BBOX.'
;

-- see: https://github.com/AddressForAll/pg_pubLib-v1/blob/main/src/pubLib05pgis-extraSRID.sql
INSERT INTO spatial_ref_sys (srid, auth_name, auth_srid, proj4text, srtext) VALUES
( -- Grid of Colombia, IGAC MAGNA-SIRGAS / Origen-Nacional:
  9377, -- official EPSG number
  'CO:IGAC',
  9377,
  '+proj=tmerc +lat_0=4.0 +lon_0=-73.0 +k=0.9992 +x_0=5000000 +y_0=2000000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
  $$PROJCS[
    "MAGNA-SIRGAS / Origen-Nacional",
    GEOGCS[
      "MAGNA-SIRGAS",
      DATUM[
        "Marco_Geocentrico_Nacional_de_Referencia",
        SPHEROID["GRS 1980",6378137,298.257222101,AUTHORITY["EPSG","7019"]],
        TOWGS84[0,0,0,0,0,0,0],
        AUTHORITY["EPSG","6686"]
      ],
      PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],
      UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],
      AUTHORITY["EPSG","4686"]
    ],
    PROJECTION["Transverse_Mercator"],
    PARAMETER["latitude_of_origin",4.0],
    PARAMETER["central_meridian",-73.0],
    PARAMETER["scale_factor",0.9992],
    PARAMETER["false_easting",5000000],
    PARAMETER["false_northing",2000000],
    UNIT["metre",1,AUTHORITY["EPSG","9001"]],
    AUTHORITY["EPSG","9377"]
  ]$$
)
ON CONFLICT DO NOTHING;
