const fs = require("fs");
const turf = require("@turf/turf");

const Vias = JSON.parse(
	fs.readFileSync("../data/Vias_Vereda_Trasdelalto.geojson")
);

const WaysSegments = turf.flatten(Vias);
const SmpDistance = 0.075; //expressed in km
const SmpRadius = 0.05;

let smpUnits = turf.featureCollection([]);
turf.featureEach(WaysSegments, function (currentFeature, featureIndex) {
	let length = turf.length(currentFeature);
	let smpUnitsCount = Math.round(length / SmpDistance);
	for (var i = 0; i <= smpUnitsCount; i++) {
		let center = turf.along(currentFeature, SmpDistance * i);
		let smpUnit = turf.circle(center, SmpRadius, {
			steps: 10,
			units: "kilometers",
			// properties: {
			//   line: featureIndex + 1,
			//   index: i + 1,
			//   count: 0,
			// },
		});
		smpUnits.features.push(turf.truncate(smpUnit));
	}
});

console.log("%s Sampling Units", smpUnits.features.length);

const CloserThanN = (unitToMergeWith, currentUnit, nSteps) =>
	Math.abs(unitToMergeWith.properties.index - currentUnit.properties.index) >
		nSteps && unitToMergeWith.properties.line === currentUnit.properties.line
		? false
		: true;

let optmUnits = turf.featureCollection([]);
let smpArea = turf.area(smpUnits.features[0]);

while (smpUnits.features.length > 0) {
	let unitsToBeMerged = [];
	let unitToMergeWith = smpUnits.features[0];
	unitsToBeMerged.push(unitToMergeWith);
	smpUnits.features.shift();
	turf.featureEach(smpUnits, function (currentUnit, index) {
		let currentLabel = currentUnit.properties.unit;
		let sharingShape = turf.intersect(
			unitToMergeWith.geometry,
			currentUnit.geometry
		);
		if (sharingShape) {
			let sharingArea = turf.area(sharingShape);
			if (
				// sharingArea > smpArea * 0.5 &&
				// CloserThanN(unitToMergeWith, currentUnit, 1)
				sharingArea > smpArea * 0.5
			) {
				unitsToBeMerged.push(currentUnit);
				smpUnits.features.splice(index, 1);
			}
		}
	});
	if (unitsToBeMerged.length === 1) {
		mergedUnit = unitsToBeMerged[0];
	} else {
		mergedUnit = turf.circle(
      // turf.centerOfMass(turf.featureCollection([...unitsToBeMerged])).geometry
      turf.center(turf.featureCollection([...unitsToBeMerged])).geometry
        .coordinates,
      SmpRadius,
      {
        steps: 10,
        units: "kilometers",
        // properties: {
        //   line: unitsToBeMerged[0].properties.line,
        //   index: unitsToBeMerged[0].properties.index,
        //   count: 0,
        // },
      }
    );
		mergedUnit = turf.truncate(mergedUnit);
	}
	optmUnits.features.push(mergedUnit);
}
console.log("%s Optimized Units", optmUnits.features.length);


fs.writeFileSync(
	"../output/sampling-units.geojson",
	JSON.stringify(turf.truncate(optmUnits))
);