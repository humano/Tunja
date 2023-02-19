/**
 * Nomenclator: one who gives names to or invents names for things
 */

const fs = require("fs");
const turf = require("@turf/turf");
const sm = require("statistical-methods");
const stats = require("stats-lite");
const arraySort = require("array-sort");

const Vias = JSON.parse(fs.readFileSync("../data/Vias_rurales_Tunja.geojson"));
const pts = JSON.parse(fs.readFileSync("../output/w-pts.geojson"));

const names = {};
const p_names = {};

pts.features.forEach(function (item) {
  way_id = item.properties.way_id;
  dir = item.properties.direccion_;
  weight = item.properties.weight;

  p_name = dir.split(" VDA ")[0];
  // console.log(p_name);

  if (!(way_id in names)) {
    names[way_id] = {
      name: p_name,
      weight: weight,
    };
    p_names[way_id] = p_name;
  } else {
    if (names[way_id]["weight"] < weight) {
      names[way_id]["name"] = p_name;
      names[way_id]["weight"] = weight;
      p_names[way_id] = p_name;
    }
  }
});

// console.dir(p_names, { depth: null });
fs.writeFileSync("../output/p-names.json", JSON.stringify(p_names));

Vias.features.map((a) => {
  let osm_id = a.properties.osm_id;
  let p_name = p_names[osm_id] || "";
  a.properties.p_name = p_name;
});

console.dir(Vias, { depth: null });

fs.writeFileSync(
  "../output/p-names-ways.geojson",
  JSON.stringify(turf.truncate(Vias))
);

// fs.writeFileSync("../output/w-pts.geojson", JSON.stringify(turf.truncate(pts)));

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
