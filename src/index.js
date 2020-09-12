const express = require('express');

const uploadRouter = require('./src/routers/upload');
const teamRouter = require('./src/routers/team');
const extractRouter = require('./src/routers/extract');

const app = express();
const port = 8080;

app.use(express.json());

app.use(uploadRouter);
app.use(teamRouter);
app.use(extractRouter);

app.listen(port, () => {console.log(`Server is up on port ${port}`)});