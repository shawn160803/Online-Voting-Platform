"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Election extends Model {
    /**
     *we use Helper method for defining a associations.
     * method we using is not a part of Sequelize lifecycle.
     * we don't need to put any command`models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Election.belongsTo(models.Admin, {
        foreignKey: "adminID",
      });
      Election.hasMany(models.question, {
        foreignKey: "electionID",
      });
      Election.hasMany(models.Voter, {
        foreignKey: "electionID",
      });
    }
// creating an adminID
    static async add(adminID, name) {
      const res = await Election.create({
        adminID: adminID,
        name: name,
        launched: false,
        ended: false,
      });
      return res;
    }
// launching Election
    static async launch(id) {
      const res = await Election.update(
        { launched: true },
        {
          where: {
            id: id,
          },
        }
      );
      return res;
    }
//ending the Election
    static async end(id) {
      const res = await Election.update(
        { ended: true },
        {
          where: {
            id: id,
          },
        }
      );
      return res;
    }
  }
  // validation 
  Election.init(
    {
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notNull: true,
        },
      },
      launched: DataTypes.BOOLEAN,
      ended: DataTypes.BOOLEAN,
    },
    {
      sequelize,
      modelName: "Election",
    }
  );
  return Election;
};
