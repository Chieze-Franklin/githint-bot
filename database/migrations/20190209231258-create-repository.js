module.exports = {
  up: (queryInterface, Sequelize) => queryInterface.createTable('Repositories', {
      id: {
        allowNull: false,
        autoIncrement: false,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      fullName: {
        allowNull: false,
        type: Sequelize.STRING
      },
      installationId: {
        type: Sequelize.INTEGER,
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
        type: Sequelize.STRING
      },
      private: {
        allowNull: false,
        type: Sequelize.BOOLEAN
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
  down: (queryInterface, Sequelize) => queryInterface.dropTable('Repositories')
};
