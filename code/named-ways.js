/**
 * Proposed Names for Ways
 * store in p_name
 */

const fs = require("fs");
const turf = require("@turf/turf");

const Names = JSON.parse(
  fs.readFileSync("../output/p-consolidated-names.json")
);
const Vias = JSON.parse(
  fs.readFileSync("../data/Vias_Vereda_Trasdelalto.geojson")
);
// const vias = turf.flatten(Vias);

Vias.features.map((a) => {
  let osm_id = a.properties.osm_id;
  let p_name = Names[osm_id] || "";
  a.p_name = p_name;
});

console.dir(Vias, { depth: null });

fs.writeFileSync(
  "../output/p-names-ways.geojson",
  JSON.stringify(turf.truncate(Vias))
);
