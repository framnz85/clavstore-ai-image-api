const estoreid1 = [
  "613216389261e003d696cc65",
  "66dd4ca828a6ce0ba1a696e0",
  "67361b540754cc426e7162c6",
  "6745503c1b6db62f0e7e9d94",
  "675403abc7a3632df514d5fc",
  "677b30364223a4c3cec394dc",
  "67d8cdd3391083e7c0c4960d",
  "684dc805b98789f0c822e3c3",
  "6875a3c5902a0707bba5dba2",
  "694a86259f15cb170a7ba7bc",
];

const estoreid2 = [
  "66180257fd06884019423dbe",
  "67262902fc9b3d9326cd9e63",
  "684e323cb98789f0c8245be1",
  "686623867ec6ae28ef6f5b98",
  "68f5291d80f12838274f79f7",
  "69081136afaed8cee0961838",
];

const estoreid3 = ["68674af77ec6ae28ef74cf67"];

const estoreid = [
  {
    estore: estoreid1,
    database: process.env.RESELLER_DATABASE1,
    extension: process.env.DATABASE_EXTENSION,
  },
  {
    estore: estoreid2,
    database: process.env.RESELLER_DATABASE2,
    extension: process.env.DATABASE_EXTENSION,
  },
  {
    estore: estoreid3,
    database: process.env.RESELLER_DATABASE3,
    extension: process.env.DATABASE_EXTENSION,
  },
];

module.exports = estoreid;
