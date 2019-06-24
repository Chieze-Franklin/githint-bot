require('dotenv').config();

module.exports = {
  development: {
    database: process.env.DATABASE_DEV,
    dialect: 'postgres',
    host: '127.0.0.1',
    operatorsAliases: false,
    password: process.env.DATABASE_DEV_PASSWORD,
    username: process.env.DATABASE_DEV_USERNAME,
    url: process.env.DATABASE_DEV_URL
  },
  test: {
    database: process.env.DATABASE_TEST,
    dialect: 'postgres',
    host: '127.0.0.1',
    operatorsAliases: false,
    password: process.env.DATABASE_TEST_PASSWORD,
    username: process.env.DATABASE_TEST_USERNAME,
    url: process.env.DATABASE_TEST_URL
  },
  production: {
    dialect: 'postgres',
    url: process.env.DATABASE_URL,
    operatorsAliases: false,
  }
}
