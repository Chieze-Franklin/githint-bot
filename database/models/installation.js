// https://developer.github.com/v3/activity/events/types/#installationevent

'use strict';
module.exports = function(sequelize, DataTypes) {
  var Installation = sequelize.define('Installation', {
    id: {
      allowNull: false,
      autoIncrement: false,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    accessTokenUrl: {
      allowNull: false,
      type: DataTypes.STRING
    },
    accountName: {
      allowNull: false,
      type: DataTypes.STRING
    },
    accountType: {
      allowNull: false,
      type: DataTypes.STRING
    },
    accountUrl: {
      allowNull: false,
      type: DataTypes.STRING
    },
    targetId: {
      allowNull: false,
      type: DataTypes.INTEGER
    },
    targetType: {
      allowNull: false,
      type: DataTypes.STRING
    },
  }, 
  // {
  //   classMethods: {
  //     associate: function(models) {
  //       // associations can be defined here
  //     }
  //   }
  // }
  );

  Installation.associate = (models) => {
    Installation.hasMany(models.Repository, {
      as: 'repositories',
      foreignKey: 'installationId',
    });
  };

  return Installation;
};