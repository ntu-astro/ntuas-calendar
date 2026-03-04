const fs = require('fs');

const COORDS = {
    NORTH_SPINE: "1.3473;103.6803",
    SOUTH_SPINE: "1.3428;103.6824",
    THE_HIVE: "1.3436;103.6823",
    THE_ARC: "1.3461;103.6802",
    WKWSCI: "1.3438;103.6818"
};

const venues = [
    // Major Lecture Theatres
    { name: "LT1 (Von Lee Yong Miang) - North Spine", geo: COORDS.NORTH_SPINE },
    { name: "TCT-LT (LT2) - North Spine", geo: COORDS.NORTH_SPINE },
    { name: "LT3 - North Spine", geo: COORDS.NORTH_SPINE },
    { name: "LT4 - North Spine", geo: COORDS.NORTH_SPINE },
    { name: "LT5 - North Spine", geo: COORDS.NORTH_SPINE },
    { name: "LT6 - North Spine", geo: COORDS.NORTH_SPINE },
    { name: "LT7 - North Spine", geo: COORDS.NORTH_SPINE },
    { name: "LT8 - North Spine", geo: COORDS.NORTH_SPINE },
    { name: "LT9 - North Spine", geo: COORDS.NORTH_SPINE },
    { name: "LT10 - North Spine", geo: COORDS.NORTH_SPINE },
    { name: "LT11 - North Spine", geo: COORDS.NORTH_SPINE },
    { name: "LT12 - North Spine", geo: COORDS.NORTH_SPINE },
    { name: "LT13 - North Spine", geo: COORDS.NORTH_SPINE },
    { name: "LT14 - North Spine", geo: COORDS.NORTH_SPINE },
    { name: "LT15 - North Spine", geo: COORDS.NORTH_SPINE },
    { name: "LT16 - North Spine", geo: COORDS.NORTH_SPINE },
    { name: "LT17 - North Spine", geo: COORDS.NORTH_SPINE },
    { name: "LT18 - North Spine", geo: COORDS.NORTH_SPINE },
    { name: "LT19 - North Spine", geo: COORDS.NORTH_SPINE },
    { name: "LT19A - North Spine", geo: COORDS.NORTH_SPINE },
    { name: "LT1A - North Spine", geo: COORDS.NORTH_SPINE },
    { name: "LT20 - North Spine", geo: COORDS.NORTH_SPINE },
    { name: "LT2A - North Spine", geo: COORDS.NORTH_SPINE },
    { name: "LHSLT- - The Hive", geo: COORDS.THE_HIVE },
    { name: "LT22 - South Spine", geo: COORDS.SOUTH_SPINE },
    { name: "LT23 - South Spine", geo: COORDS.SOUTH_SPINE },
    { name: "LT24 - South Spine", geo: COORDS.SOUTH_SPINE },
    { name: "LT25 - South Spine", geo: COORDS.SOUTH_SPINE },
    { name: "LT26 - South Spine", geo: COORDS.SOUTH_SPINE },
    { name: "LT27 - South Spine", geo: COORDS.SOUTH_SPINE },
    { name: "LT28 - South Spine", geo: COORDS.SOUTH_SPINE },
    { name: "LT29 - South Spine", geo: COORDS.SOUTH_SPINE },
    { name: "LKC-LT (Lee Kong Chian) - South Spine", geo: COORDS.SOUTH_SPINE },
    { name: "LF-LT (Lee Foundation) - WKWSCI", geo: COORDS.WKWSCI },
    { name: "LHNLT- - The Arc", geo: COORDS.THE_ARC },
    
    // South Spine Special/Misc Rooms
    { name: "RECEP RM - South Spine", geo: COORDS.SOUTH_SPINE },
    { name: "FOYER - South Spine", geo: COORDS.SOUTH_SPINE },
    { name: "EXHIB GALY - South Spine", geo: COORDS.SOUTH_SPINE },
    { name: "FN RM - South Spine", geo: COORDS.SOUTH_SPINE },
    { name: "S3.2 ESR4 - South Spine", geo: COORDS.SOUTH_SPINE },
    { name: "S3.2 ESR3 - South Spine", geo: COORDS.SOUTH_SPINE },
    { name: "TRX122 - South Spine", geo: COORDS.SOUTH_SPINE },
    { name: "ICC-LAB1 ICC CoILAB 1 - South Spine", geo: COORDS.SOUTH_SPINE },
    { name: "ICC-LAB2 ICC CoILAB 2 - South Spine", geo: COORDS.SOUTH_SPINE },

    // North Spine Special/Misc Rooms
    { name: "TRX43 - North Spine", geo: COORDS.NORTH_SPINE },
    { name: "TRX44 - North Spine", geo: COORDS.NORTH_SPINE }
];

// North Spine TRs (Corrected to skip non-existent rooms)
const nsTrs = [1,2,3,4,5,6,7,8,9,15,16,17,18,19,20,21,22,23,29,30,31,32,33,34,35,36,37];
nsTrs.forEach(num => venues.push({ name: `TR+${num} - North Spine`, geo: COORDS.NORTH_SPINE }));

// Science Building (WKWSCI) TRs
for (let i = 7; i <= 9; i++) venues.push({ name: `CS-TR+${i} - WKWSCI`, geo: COORDS.WKWSCI });

// South Spine TRs
const ssTrs = [61,62,63,64,65,66,67,68,69,77,78,79,80,87,88,89,90,91,92,93,94,95,96,102,103,106,107,108,109,110,111,112,113,114,120,121,151,152,153,154,159,160,165,166];
ssTrs.forEach(num => venues.push({ name: `TR+${num} - South Spine`, geo: COORDS.SOUTH_SPINE }));

// The Hive TRs
for (let i = 1; i <= 56; i++) venues.push({ name: `LHS-TR+${i} - The Hive`, geo: COORDS.THE_HIVE });

// The Arc TRs
for (let i = 1; i <= 56; i++) venues.push({ name: `LHN-TR+${i < 10 ? '0'+i : i} - The Arc`, geo: COORDS.THE_ARC });

// Write to JSON
fs.writeFileSync('venues.json', JSON.stringify(venues, null, 2));
console.log(`venues.json generated with ${venues.length} locations!`);