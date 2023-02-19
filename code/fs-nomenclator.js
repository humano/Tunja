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
const Pts = JSON.parse(
  fs.readFileSync("../data/Consolidado_total_rural_2023.geojson")
);

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

fs.writeFileSync("../output/w-nrp.geojson", JSON.stringify(turf.truncate(nrp)));

/**
 * Adding weight to Pts
 */

var pts = turf.tag(Pts, nrp, "weight", "weight");

/**
 * Adding Veredas to Pts
 */

var pts = turf.tag(pts, Veredas, "nombre", "vereda");

/**
 * Adding ways to Pts
 */

const flatVias = turf.flatten(Vias);
var count = 0;
const totalPoints = pts.features.length;
turf.featureEach(pts, function (currentPoint) {
  turf.featureEach(flatVias, function (currentVia) {
    var buffered = turf.buffer(currentPoint, 15, { units: "meters" });
    if (turf.booleanIntersects(buffered, currentVia)) {
      currentPoint.properties.way_id = currentVia.properties.osm_id;
      currentPoint.properties.way_name = currentVia.properties.name;
      count++
      console.log(count + "/" + totalPoints);
      console.dir(currentPoint, { depth: null });
    }
  });
});

fs.writeFileSync("../output/w-pts.geojson", JSON.stringify(turf.truncate(pts)));

// console.dir(pts, { depth: null });

/**
 * Naming ways
 */

// const ways = turf.flatten(Vias);

// Vias.features.map((a) => {
// if (a.properties.name != null) {
//   console.log(a.properties.name);
// }
// var buffered = turf.buffer(a, 50, { units: "meters" });
// console.dir(buffered, { depth: null });
// });
