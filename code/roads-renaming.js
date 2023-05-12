/**
 * Proposed Names for Ways
 * store in p_name
 */

const fs = require("fs");
const turf = require("@turf/turf");

const Names = JSON.parse(fs.readFileSync("../output/proposed-road-names.json"));
const Vias = JSON.parse(fs.readFileSync("../data/Vias_rurales_Tunja.geojson"));

// const vias = turf.flatten(Vias);

Vias.features.map((a) => {
  let osm_id = a.properties.osm_id;
  let p_name = Names[osm_id] || "";
  a.properties.p_name = p_name;
});

console.dir(Vias, { depth: null });

fs.writeFileSync(
  "../output/roads-with-proposed-names.geojson",
  JSON.stringify(turf.truncate(Vias))
);
