const Sequelize = require("sequelize");

const database = "todo_db";
const username = "shawn";
const password = "avinash";
const sequelize = new Sequelize(database, username, password, {
  host: "localhost",
  dialect: "postgres",
});

const connect = async () => {
  return sequelize.authenticate();
};

module.exports = {
  connect,
  sequelize,
};
