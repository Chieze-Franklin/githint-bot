import 'babel-polyfill' // eslint-disable-line
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import bodyParser from 'body-parser';

import request from 'request-promise-native';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const app = new express();
app.use(cors());
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

app.get('/', async (req, res) => {
  res.status(200).send("Hello World!<br /><br />Welcome to PRLint.");
});

app.post('/github/hooks/pr', async (req, res) => {
  res.status(200).send();

  // get the PR
  console.log(req.body);
  // let treeResponse = await request({
  //   url: tree + '?recursive=1',
  //   method: 'GET',
  //   headers: {
  //     'Authorization': `token ${process.env.GITHUB_USER_TOKEN}`,
  //     'Accept': 'application/vnd.github.squirrel-girl-preview',
  //     'Content-Type': 'application/json',
  //     'User-Agent': 'Chieze-Franklin'
  //   },
  //   json: true,
  //   resolveWithFullResponse: true
  // });
});

let server = app.listen(process.env.PORT || 5000, () => {
  let port = server.address().port;
  console.log(`Server started on port ${port}`)
})
