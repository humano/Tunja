const fs = require("fs");
const arraySort = require("array-sort");
const converter = require("json-2-csv");

const SU = JSON.parse(
  fs.readFileSync("../output/weighted-named-sampling-units.geojson")
);

const list = [];
const names = {};
const p_names = {};

SU.features.forEach(function (item) {
  osm_id = item.properties.osm_id;
  dir = item.properties.dir;
  weight = item.properties.weight;
  row = {
    osm_id: osm_id,
    dir: dir,
    weight: weight,
    name: item.properties.name,
  };
  list.push(row);

  if (!(osm_id in names)) {
    names[osm_id] = {
      name: dir,
      weight: weight,
    };
    p_names[osm_id] = dir;
  } else {
    if (names[osm_id]["weight"] < weight) {
      names[osm_id]["name"] = dir;
      names[osm_id]["weight"] = weight;
      p_names[osm_id] = dir;
    }
  }
});

console.log(list.length);

// console.log(names);

var unique = Array.from(new Set(list.map(JSON.stringify))).map(JSON.parse);

var table = arraySort(unique, ["osm_id", "weight", "name"], { reverse: true });

// console.table(names);

var table_names = Object.entries(names).map(([key, value]) => ({
  osm_id: key,
  name: value.name,
  weight: value.weight,
}));

// console.table(table_names);

console.log(p_names);

converter.json2csv(
  table_names,
  function (err, csv) {
    if (err) {
      console.log("oe eto se jodió" + err);
    }
    fs.writeFile("../output/names-list.csv", csv, function (err) {
      if (err) {
        console.log("oe eto también se jodió" + err);
      }
    });
  },
  {
    expandArrayObjects: true,
  }
);

fs.writeFileSync("../output/names.geojson", JSON.stringify(names));
fs.writeFileSync("../output/p-names.geojson", JSON.stringify(p_names));
