"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Voter extends Model {
    /**
     * using Helper method for defining a associations(group of linkd).
     * This method we using is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically you don't need to write.
     */
     
    static associate(models) {
      // defining association here
      Voter.belongsTo(models.Election, {
        foreignKey: "electionID",
      });
    }
// addding some functions
    static async add(voterID, password, electionID) {
      const res = await Voter.create({
        voterID: voterID,
        password: password,
        electionID: electionID,
        voted: false,
        responses: [],
      });
      return res;
    }
// deleting voter voterID

    static async delete(voterID) {
      const res = await Voter.destroy({
        where: {
          id: voterID,
        },
      });
      return res;
    }
// marking vote
    static async markVoted(id) {
      const res = await Voter.update(
        {
          voted: true,
        },
        {
          where: {
            id: id,
          },
        }
      );
      return res;
    }
// updating voter id 
    static async addResponse(id, response) {
      const res = await Voter.update(
        {
          responses: response,
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
  
  Voter.init(
    {
        
      voterID: DataTypes.STRING,
      password: DataTypes.STRING,
      voted: DataTypes.BOOLEAN,
      responses: DataTypes.ARRAY(DataTypes.INTEGER),
      
    },
    
    // sequelizing voter 
    {
      sequelize,
      modelName: "Voter",
    }
  );
  
  return Voter;
};
