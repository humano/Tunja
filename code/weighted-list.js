const fs = require("fs");
const arraySort = require("array-sort");
const converter = require("json-2-csv");

const SU = JSON.parse(
  fs.readFileSync("../output/weighted-named-sampling-units.geojson")
);

const list = [];

SU.features.forEach(function (item) {
  row = {
    osm_id: item.properties.osm_id,
    dir: item.properties.dir,
    weight: item.properties.weight,
  };
  list.push(row);
});

console.log(list.length);

var unique = Array.from(new Set(list.map(JSON.stringify))).map(JSON.parse);

var table = arraySort(unique, ["osm_id", "weight", "name"], { reverse: true });

console.table(table);

converter.json2csv(table, function (err, csv) {
  if (err) {
    console.log("oe eto se jodió" + err);
  }
  fs.writeFile("../output/weighted-list.csv", csv, function (err) {
    if (err) {
      console.log("oe eto también se jodió" + err);
    }
  });
});
