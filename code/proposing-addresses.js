/**
 * Proposed Addresses for Points
 * store in p_address
 */

const fs = require("fs");
const converter = require("json-2-csv");

const Names = JSON.parse(fs.readFileSync("../output/proposed-road-names.json"));
const Points = JSON.parse(fs.readFileSync("../output/weighted-points.geojson"));

const cleanName = (name) => name.split(" VDA ")[0].trim();

addresses = "";

Points.features.map((a, index) => {
  let code = a.properties.codigo;
  let vereda = a.properties.vereda;
  let address = a.properties.direccion_;
  let main_road = Names[a.properties.main_road] || "";
  let secondary_road = Names[a.properties.secondary_road] || "";
  let predio = address && address.length > 2 ? cleanName(address) : code;
  a.properties.p_addres =
    vereda + "|" + main_road + "|" + secondary_road + "|" + predio;

  addresses += a.properties.p_addres + "\n";

  if (predio.length > 5) console.log(a.properties.p_addres);
});

fs.writeFile("../output/proposed-addresses.txt", addresses, function (err) {
  if (err) {
    console.log("oe eto también se jodió" + err);
  }
});

fs.writeFileSync(
  "../output/points-with-proposed-addresses.geojson",
  JSON.stringify(Points)
);
