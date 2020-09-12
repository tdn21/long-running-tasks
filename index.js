const express = require('express');

const uploadRouter = require('./routers/upload');
const teamRouter = require('./routers/team');
const extractRouter = require('./routers/extract');

const app = express();
const port = 8080;

app.use(express.json());

app.use(uploadRouter);
app.use(teamRouter);
app.use(extractRouter);

app.listen(port, () => {console.log(`Server is up on port ${port}`)});