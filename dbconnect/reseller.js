const mongoose = require("mongoose");
const estoreid = require("./estoreid");

let conn = [];

estoreid.forEach((id) => {
  for (let i = 0; i < id.estore.length; i++) {
    try {
      conn[id.estore[i]] = mongoose.createConnection(
        `${id.database}/estore-${id.estore[i]}`
      );
      console.log(
        `DB CONNECTED TO ${id.database}/estore-${id.estore[i]}${id.extension}`
      );
    } catch (err) {
      console.log(`DB CONNECTION ERR ${err}`);
    }
  }
});

module.exports = conn;
