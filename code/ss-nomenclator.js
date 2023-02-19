/**
 * Nomenclator: one who gives names to or invents names for things
 */

const fs = require("fs");
const turf = require("@turf/turf");
const sm = require("statistical-methods");
const stats = require("stats-lite");

const Vias = JSON.parse(fs.readFileSync("../data/Vias_rurales_Tunja.geojson"));
const pts = JSON.parse(fs.readFileSync("../output/w-pts.geojson"));

// const flatVias = turf.flatten(Vias);
// fs.writeFileSync(
//   "../output/w-ways.geojson",
//   JSON.stringify(turf.truncate(flatVias))
// );

var count = 0;
var missing = 0;
const totalPoints = pts.features.length;
turf.featureEach(pts, function (currentPoint) {
  if (!currentPoint.properties.way_id) {
    missing++;
    turf.featureEach(Vias, function (currentVia)
    {
      var buffered = turf.buffer(currentPoint, 700, { units: "meters" });
      if (turf.booleanIntersects(buffered, currentVia)) {
        currentPoint.properties.way_id = currentVia.properties.osm_id;
        currentPoint.properties.way_name = currentVia.properties.name;
        count++;
        console.log(currentPoint.id + "-" + currentPoint.properties.way_id);
        console.log(count + "/" + totalPoints);
        console.log("----------------");
        // console.dir(currentPoint, { depth: null });
      }
    });
  }
});
console.log(missing - count);
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
