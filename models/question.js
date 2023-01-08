"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class question extends Model {
    /**
     * using Helper method for defining a associations(group of linkd).
     * This method we using is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically you don't need to write.
     */
     
    static associate(models) {
        
      // define association here
      
      question.belongsTo(models.Election, {
        foreignKey:"electionID",
      });
      question.hasMany(models.Option, {
        foreignKey:"questionID",
      });
    }
// we adding title, description, and electionID here 

    static async add(title, description, electionID) {
      const res = await question.create({
          
        title: title,
        description: description,
        electionID: electionID,
        
      });
      return res;
    }
// now we will write  editing function
    static async edit(title, desctiption, questionID) {
      const res = await question.update(
        {
          title: title,
          description: desctiption,
        },
        {
          where: {
            id: questionID,
          },
        }
      );
      return res;
    }
  }
  
  question.init(
    {
      title: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notNull: true,
        },
      },
      description: DataTypes.STRING,
    },
    // sequelizing question here
    {
      sequelize,
      modelName: "question",
    }
  );
  return question;
};
