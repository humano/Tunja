const fs = require("fs");
const turf = require("@turf/turf");

const Pts = JSON.parse(fs.readFileSync("../data/../data/tunjafinal.geojson"));
const Vias = JSON.parse(fs.readFileSync("../data/Vias_rurales_Tunja.geojson"));

var combined = turf.combine(Vias);

var yes = 0;
var no = 0;
var total = 0;
turf.featureEach(Pts, function (currentFeature, featureIndex) {
  total++;
  var center = currentFeature;
  var radius = 0.05;
  var options = { steps: 10, units: "kilometers" };
  var circle = turf.circle(center, radius, options);
  console.log(total);
  if (turf.booleanIntersects(combined, circle)) {
    yes++;
  } else {
    no++;
  }
});

console.log(total + " " + yes + " " + no);
