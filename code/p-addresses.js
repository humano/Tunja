/**
 * Proposed Addresses
 * Asign a p_address to each point (gate)
 * way -> proposed name of the road/way based on weight
 * address -> address
 * d -> distance in m from the start of the road/way
 * p_address = way + address + d
 */

const fs = require("fs");
const turf = require("@turf/turf");

const SU = JSON.parse(fs.readFileSync("../output/sampling-units.geojson"));
const Pts = JSON.parse(
  fs.readFileSync("../output/consolidated-points.geojson")
);
const Names = JSON.parse(
  fs.readFileSync("../output/p-consolidated-names.json")
);
const Vias = JSON.parse(
  fs.readFileSync("../data/Vias_Vereda_Trasdelalto.geojson")
);
const vias = turf.flatten(Vias);

var pts = turf.tag(Pts, SU, "way", "way");

pts.features.map((a) => {
  let osm_id = a.properties.way;
  let way = Names[osm_id] || "S/N";
  let address = a.properties.direccion_ || "S/N";
  let line = vias.features.filter((f) => f.properties.osm_id == osm_id)[0];
  if (line) {
    let pt = a.geometry;
    let start = turf.along(line.geometry, 0);
    let snapped = turf.nearestPointOnLine(line, pt);
    var split = turf.lineSplit(line, snapped);
    var length = turf.length(split.features[0], { units: "meters" });
    // console.log(Math.floor(length));
  }
  d = length ? " | " + Math.floor(length) : "";
  a.n_way = way;
  // a.properties.p_address =
  //   (way != address && way != "S/N" ? address + " | " + way : address || way) +
  //   d;
  a.properties.p_address =
    (way != "S/N" ? address + " | " + way : address || way) + d;
});

console.dir(pts, { depth: null });

fs.writeFileSync(
  "../output/p-addresses.geojson",
  JSON.stringify(turf.truncate(pts))
);
