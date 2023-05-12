const fs = require("fs");
const arraySort = require("array-sort");
const converter = require("json-2-csv");

const pts = JSON.parse(fs.readFileSync("../output/weighted-points.geojson"));

const list = [];
const names = {};
const p_names = {};

const cleanName = (name) => name.split(" VDA ")[0].trim();

pts.features.forEach(function (item) {
  osm_id = item.properties.main_road;
  address = item.properties.direccion_
    ? cleanName(item.properties.direccion_)
    : "";
  weight = (item.properties.weight)?item.properties.weight:0;
  row = {
    osm_id: osm_id,
    dir: address,
    weight: weight,
  };
  list.push(row);

  if (!(osm_id in names)) {
    names[osm_id] = {
      name: address,
      weight: weight,
    };
    p_names[osm_id] = address;
  } else {
    if (names[osm_id]["weight"] < weight) {
      names[osm_id]["name"] = address;
      names[osm_id]["weight"] = weight;
      p_names[osm_id] = address;
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

console.table(table_names);

// console.log(p_names);

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

fs.writeFileSync("../output/names.json", JSON.stringify(names));
fs.writeFileSync("../output/proposed-road-names.json", JSON.stringify(p_names));
