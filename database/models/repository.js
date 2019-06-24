// https://developer.github.com/v3/activity/events/types/#events-api-payload-14

'use strict';
module.exports = function(sequelize, DataTypes) {
  var Repository = sequelize.define('Repository', {
    id: {
      allowNull: false,
      autoIncrement: false,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    fullName: {
      allowNull: false,
      type: DataTypes.STRING
    },
    installationId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      onDelete: 'CASCADE',
      references: {
        model: 'Installations',
        key: 'id',
        as: 'installationId',
      },
    },
    name: {
      allowNull: false,
      type: DataTypes.STRING
    },
    private: {
      allowNull: false,
      type: DataTypes.BOOLEAN
    }
  }, 
  {
    // classMethods: {
    //   associate: function(models) {
    //     // associations can be defined here
    //   }
    // },

    // define the table's name
    tableName: 'Repositories',

    // Sequelize instance
    sequelize,
  }
  );

  Repository.associate = (models) => {
    Repository.belongsTo(models.Installation, {
      as: 'installation',
      foreignKey: 'installationId',
      onDelete: 'CASCADE'
    });
  };

  return Repository;
};