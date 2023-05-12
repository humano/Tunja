/**
 * Nomenclator: one who gives names to or invents names for things
 */

const fs = require("fs");
const turf = require("@turf/turf");
const sm = require("statistical-methods");
const stats = require("stats-lite");

const NRP = JSON.parse(fs.readFileSync("../data/NRP_Tunja_Rural.geojson"));
const CNPV = JSON.parse(fs.readFileSync("../data/CNPV_Tunja_Rural.geojson"));
const Vias = JSON.parse(fs.readFileSync("../data/Vias_rurales_Tunja.geojson"));
const Veredas = JSON.parse(fs.readFileSync("../data/Veredas_Tunja.geojson"));
const Pts = JSON.parse(fs.readFileSync("../data/tunjafinal.geojson"));

// "properties": { "OBJECTID_1": 1, "OBJECTID": 828, "COD_MPIO": "15001", "X_LONG": -73.310858452155799, "Y_LAT": 5.5678753933347593, "direccion_": "EL ARRAYAN VDA PIRGUA", "DIRECC_NOR": " ", "VEREDA_V2": "PIRGUA", "codigo": "150010001000000021045000000000", "codigo_ant": "15001000100021045000", "Criterio_ubicacion": "Acceso ubicado en vía" },
Pts.features.map((a) => {
  delete a.properties.OBJECTID_1;
  delete a.properties.OBJECTID;
  delete a.properties.COD_MPIO;
  delete a.properties.X_LONG;
  delete a.properties.Y_LAT;
  delete a.properties.DIRECC_NOR;
  delete a.properties.VEREDA_V2;
  a.properties.codigo = a.properties.codigo_ant.substring(12, 17);
  a.properties.main_road = "";
  a.properties.secondary_road = "";
  // console.log(a.properties.codigo_ant + " - " + a.properties.codigo);
  delete a.properties.codigo_ant;
});

var pts = turf.truncate(Pts);

/**
 * CNPV: Censo Nacional de Población y Vivienda
 * flatten = MultiPoint to Point
 */
const flatCNPV = turf.flatten(CNPV);

/**
 * NRP: Nomenclatura Rural de Predios
 * type: MultiPolygon
 * Adding area to NRP
 * Collecting CNPV in NRP
 */

const flatNRP = turf.flatten(NRP);
flatNRP.features.map(
  (a) => (a.properties.area = Math.round(turf.area(a.geometry)))
);

var nrp = turf.collect(flatNRP, flatCNPV, "PERSONAS", "personas");
var nrp = turf.collect(nrp, flatCNPV, "HOGARES", "hogares");
var nrp = turf.collect(nrp, flatCNPV, "VIVIENDAS", "viviendas");

nrp.features.map((a) => {
  a.properties.personas = stats.sum(a.properties.personas);
  a.properties.hogares = stats.sum(a.properties.hogares);
  a.properties.viviendas = stats.sum(a.properties.viviendas);
  delete a.properties.codigo_cat;
});

/**
 * Normalization
 * variation = (range[1] - range [0]) / (max - min)
 * valN = (range[0] + (val - min) * variation)
 */

const range = [1, 10];
const dec = 3;
const Normalize = (range, min, max, val) =>
  range[0] + ((val - min) * (range[1] - range[0])) / (max - min);

var personasMax = sm.max(nrp.features.map((a) => a.properties.personas));
var personasMin = sm.min(nrp.features.map((a) => a.properties.personas));

var areaMax = sm.max(nrp.features.map((a) => a.properties.area));
var areaMin = sm.min(nrp.features.map((a) => a.properties.area));

nrp.features.map((a) => {
  personasNorm = Normalize(
    range,
    personasMin,
    personasMax,
    a.properties.personas
  );
  areaNorm = Normalize(range, areaMin, areaMax, a.properties.area);
  a.properties.weight = +(personasNorm + areaNorm).toFixed(dec);
});

fs.writeFileSync("../output/weighted-nrp.geojson", JSON.stringify(turf.truncate(nrp)));

/**
 * Adding weight to Pts
 */

var pts = turf.tag(pts, nrp, "weight", "weight");

/**
 * Adding Veredas to Pts
 */

var pts = turf.tag(pts, Veredas, "nombre", "vereda");

/**
 * Adding ways to Pts
 */

const flatVias = turf.flatten(Vias);
const totalPoints = pts.features.length;
var count = 0;
var bufferSize = 15; // meters
var n = 1;

while (count < totalPoints) {
  console.log("round: " + n + " buffer size: " + bufferSize);
  turf.featureEach(pts, function (currentPoint) {
    if (
      !currentPoint.properties.main_road ||
      !currentPoint.properties.secondary_road
    ) {
      var buffered = turf.buffer(currentPoint, bufferSize, { units: "meters" });
      turf.featureEach(flatVias, function (currentVia) {
        if (turf.booleanIntersects(buffered, currentVia)) {
          road = currentVia.properties.osm_id;
          if (!currentPoint.properties.main_road) {
            currentPoint.properties.main_road = road;
          } else {
            if (currentPoint.properties.main_road != road) {
              currentPoint.properties.secondary_road = road;
              // -----------------------------------------------------
              count++;
              console.log(count + "/" + totalPoints);
              console.dir(currentPoint, { depth: null });
            }
          }
        }
      });
    } else if (
      currentPoint.properties.main_road &&
      currentPoint.properties.secondary_road
    ) {
      // count++;
      // console.log(count + "/" + totalPoints);
      // console.dir(currentPoint, { depth: null });
    }
  });
  n++;
  bufferSize += 5;
};

fs.writeFileSync(
  "../output/weighted-points.geojson",
  JSON.stringify(turf.truncate(pts))
);