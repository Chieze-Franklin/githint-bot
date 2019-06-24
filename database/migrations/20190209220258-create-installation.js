module.exports = {
  up: (queryInterface, Sequelize) => queryInterface.createTable('Installations', {
      id: {
        allowNull: false,
        autoIncrement: false,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      accessTokenUrl: {
        allowNull: false,
        type: Sequelize.STRING
      },
      accountName: {
        allowNull: false,
        type: Sequelize.STRING
      },
      accountType: {
        allowNull: false,
        type: Sequelize.STRING
      },
      accountUrl: {
        allowNull: false,
        type: Sequelize.STRING
      },
      targetId: {
        allowNull: false,
        type: Sequelize.INTEGER
      },
      targetType: {
        allowNull: false,
        type: Sequelize.STRING
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('NOW()')
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('NOW()')
      }
    }),
  down: (queryInterface, Sequelize) => queryInterface.dropTable('Installations')
};
