const fs = require("fs");
const turf = require("@turf/turf");

const Pts = JSON.parse(
  fs.readFileSync("../data/Ptos_Vereda_Trasdelalto.geojson")
);
const CNPV = JSON.parse(
  fs.readFileSync("../data/CNPV_Vereda_Trasdelalto.geojson")
);
const NRP = JSON.parse(
  fs.readFileSync("../data/NRP_Vereda_Trasdelalto.geojson")
);
const SU = JSON.parse(fs.readFileSync("../output/sampling-units.geojson"));

/**
 * CNPV: Censo Nacional de Población y Vivienda
 * flatten = MultiPoint to Point
 */
const flatCNPV = turf.flatten(CNPV);

/**
 * NRP: Nomenclatura Rural de Predios
 * type: MultiPolygon
 * Collecting CNPV in NRP
 * CNPV.PERSONAS -> nrpWithPersonas.personas
 * CNPV.HOGARES -> nrpWithPersonasAndHogares.hogares
 */

var nrp = turf.collect(NRP, flatCNPV, "PERSONAS", "personas");
var nrp = turf.collect(nrp, flatCNPV, "HOGARES", "hogares");
var nrp = turf.collect(nrp, flatCNPV, "VIVIENDAS", "viviendas");

/**
 * Adding personas and hogares to Pts
 */

var pts = turf.tag(Pts, nrp, "personas", "personas");
var pts = turf.tag(pts, nrp, "hogares", "hogares");
var pts = turf.tag(pts, nrp, "viviendas", "viviendas");

/**
 * Adding data to the Sampling Units
 */

var su = turf.collect(SU, pts, "personas", "personas");
var su = turf.collect(SU, pts, "hogares", "hogares");
var su = turf.collect(SU, pts, "viviendas", "viviendas");
var su = turf.collect(SU, pts, "AREA_M2", "area");
var su = turf.collect(SU, pts, "DIRECC_NOR", "dir");
var su = turf.collect(SU, pts, "fid", "fid");

function Sum(array) {
  flatten = array.flat(Infinity);
  return flatten.length > 0 ? flatten.reduce((a, b) => a + b) : 0;
}

su.features.map((a) => {
  a.properties.ppl = Sum(a.properties.personas);
  delete a.properties.personas;
  a.properties.fam = Sum(a.properties.hogares);
  delete a.properties.hogares;
  a.properties.houses = Sum(a.properties.viviendas);
  delete a.properties.viviendas;
  a.properties.t_area = Math.round(Sum(a.properties.area));
  delete a.properties.area;
  a.properties.addrs = a.properties.fid.length;
  delete a.properties.fid;
});

console.dir(su, { depth: null });
