const fs = require("fs");
const turf = require("@turf/turf");
const sm = require("statistical-methods");
const stats = require("stats-lite");

const Cons = JSON.parse(
  fs.readFileSync("../data/Consolidado_total_rural_2023.geojson")
);
const Pts = JSON.parse(
  fs.readFileSync("../data/Ptos_Vereda_Trasdelalto.geojson")
);
const CNPV = JSON.parse(
  fs.readFileSync("../data/CNPV_Vereda_Trasdelalto.geojson")
);
const NRP = JSON.parse(
  fs.readFileSync("../data/NRP_Vereda_Trasdelalto.geojson")
);
const Vias = JSON.parse(
  fs.readFileSync("../data/Vias_Vereda_Trasdelalto.geojson")
);
const SU = JSON.parse(fs.readFileSync("../output/sampling-units.geojson"));

/**
 * Filter Consolidado features where VEREDA_V1 = "TRAS DEL ALTO" && VEREDA_V2 = "TRAS DEL ALTO"
 */

Cons.features = Cons.features.filter((a)=>(a.properties.VEREDA_V1 == "TRAS DEL ALTO" && a.properties.VEREDA_V2 == "TRAS DEL ALTO"));

// console.dir(Cons, { depth: null });
console.log(Cons.features.length);

Cons.features.map((a) => {
  let dir = a.properties.direccion_;
  if (dir != null) {
    dir = dir.replace(" VDA TRAS DEL ALTO", "");
    dir = dir.replace(" TRAS DEL ALTO", "");
    dir = dir.replace(" A VDA TRAS DEL A", "");
    dir = dir.replace(" VDA TRAS", "");
    dir = dir.replace(" VDA TARS DEL ALTO", "");
    dir = dir.replace(" VDA LA ESPERANZA", "");
  } else {
    dir = "";
  }
  a.properties.direccion_ = dir;
  // console.log(a.properties.direccion_);
});

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
flatNRP.features.map((a) => (a.properties.area = turf.area(a.geometry)));

var nrp = turf.collect(flatNRP, flatCNPV, "PERSONAS", "personas");
var nrp = turf.collect(nrp, flatCNPV, "HOGARES", "hogares");
var nrp = turf.collect(nrp, flatCNPV, "VIVIENDAS", "viviendas");

/**
 * Adding personas and hogares to Pts
 */

var pts = turf.tag(Cons, nrp, "personas", "personas");
var pts = turf.tag(pts, nrp, "hogares", "hogares");
var pts = turf.tag(pts, nrp, "viviendas", "viviendas");
var pts = turf.tag(pts, nrp, "area", "area");

// console.dir(pts, { depth: null });

/**
 * Adding data to the Sampling Units
*/

var su = turf.collect(SU, pts, "personas", "personas");
var su = turf.collect(SU, pts, "hogares", "hogares");
var su = turf.collect(SU, pts, "viviendas", "viviendas");
// var su = turf.collect(SU, pts, "COD_MPIO", "mpio");
var su = turf.collect(SU, pts, "area", "area");
var su = turf.collect(SU, pts, "direccion_", "dir");
var su = turf.collect(SU, pts, "OBJECTID", "fid");

su.features.map((a) => {
  a.properties.ppl = sm.sum(a.properties.personas.flat(Infinity));
  delete a.properties.personas;
  a.properties.fam = sm.sum(a.properties.hogares.flat(Infinity));
  delete a.properties.hogares;
  a.properties.houses = sm.sum(a.properties.viviendas.flat(Infinity));
  delete a.properties.viviendas;
  a.properties.t_area = Math.round(sm.sum(a.properties.area.flat(Infinity)));
  delete a.properties.area;
  a.properties.addrs = a.properties.fid.length;
  delete a.properties.fid;
});

console.log("%s sampling units", su.features.length);

su.features = su.features.filter((a) => a.properties.addrs > 0);
// console.dir(su, { depth: null });
console.log("%s sampling units with doors", su.features.length);

/**
 * Normalization
 * variation = (range[1] - range [0]) / (max - min)
 * valN = (range[0] + (val - min) * variation)
*/ 

const range = [1, 10];
const dec = 3;
const Normalize = (range, min, max, val) =>
  range[0] + ((val - min) * (range[1] - range[0])) / (max - min);

var pplMax = sm.max(su.features.map((a) => a.properties.ppl));
var pplMin = sm.min(su.features.map((a) => a.properties.ppl));

// var famMax = sm.max(su.features.map((a) => a.properties.fam));
// var famMin = sm.min(su.features.map((a) => a.properties.fam));

// var housesMax = sm.max(su.features.map((a) => a.properties.houses));
// var housesMin = sm.min(su.features.map((a) => a.properties.houses));

var t_areaMax = sm.max(su.features.map((a) => a.properties.t_area));
var t_areaMin = sm.min(su.features.map((a) => a.properties.t_area));

var addrsMax = sm.max(su.features.map((a) => a.properties.addrs));
var addrsMin = sm.min(su.features.map((a) => a.properties.addrs));

console.log("max number of doors in a sampling unit %s", addrsMax);

su.features.map((a) => {
  pplNorm = Normalize(range, pplMin, pplMax, a.properties.ppl);
  areaNorm = Normalize(range, t_areaMin, t_areaMax, a.properties.t_area);
  addrsNorm = Normalize(range, addrsMin, addrsMax, a.properties.addrs);
  a.properties.weight = +((pplNorm + areaNorm + addrsNorm) / 3).toFixed(dec);
});

console.log(
  "histogram:",
  stats.histogram(su.features.map((a) => a.properties.weight, 10))
);

var su_single_name = turf.featureCollection([]);
turf.featureEach(su, function (currentFeature, featureIndex) {
  var dir = currentFeature.properties.dir;
  // console.log(dir);
  if (Array.isArray(dir)) {
    dir.forEach(function (item) {
      if (item.length > 5) {
        tempFeature = currentFeature;
        tempFeature.properties.dir = item;
        su_single_name.features.push(tempFeature);
      }
    });
  } else {
    su_single_name.features.push(currentFeature);
  }
});

console.log(su.features.length);
console.log(su_single_name.features.length);

const flatVias = turf.flatten(Vias);
turf.featureEach(su_single_name, function (currentSamplingUnit) {
  turf.featureEach(flatVias, function (currentVia) {
    if (turf.booleanIntersects(currentSamplingUnit, currentVia))
      currentSamplingUnit.properties.osm_id = currentVia.properties.osm_id;
      currentSamplingUnit.properties.name = currentVia.properties.name;
  })
})

fs.writeFileSync(
  "../output/consolidated-sampling-units.geojson",
  JSON.stringify(turf.truncate(su_single_name))
);

