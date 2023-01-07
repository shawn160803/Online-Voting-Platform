"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
   
    await queryInterface.addColumn("questions", "electionID", {
      type: Sequelize.DataTypes.INTEGER,
    });
    
    await queryInterface.addConstraint("questions, {
      fields: ["electionID"],type: "foreign key",references: { table: "Elections", field: "id" },
    });
  },

  async down(queryInterface, Sequelize) {
   
    await queryInterface.removeColumn("questions", "electionID");
  },
};
