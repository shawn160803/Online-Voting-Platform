"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Option extends Model {
    /**
     * using Helper method for defining a associations(group of linkd).
     * This method we using is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically you don't need to write.
     */
    static associate(models) {
      // defining association here
      Option.belongsTo(models.question, {
        foreignKey: "questionID",
      });
    }
//adding a question value in option
    static async add(value, questionID) {
      const res = await Option.create({
        value: value,
        questionID: questionID,
      });
      return res;
    }
// editing a option
    static async edit(newValue, id) {
      const res = await Option.update(
        {
          value: newValue,
        },
        
        
        
        {
          where: {
            id: id,
          },
        }
      );
      return res;
    }
  }
  
  Option.init(
    {
      value: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notNull: true,
        },
      },
    },
    // here sequelize the function option
    {
      sequelize,
      modelName: "Option",
    }
  );
  
  return Option;
  
};
