const express = require("express");
const app = express();

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const path = require("path");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

let db = null;
app.use(express.json());

const initializeDbAndServer = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log("Server is running on port http://localhost:3000");
    });
  } catch (e) {
    console.log(`Db Error:${e.message}`);
    process.exit(1);
  }
};
initializeDbAndServer();

//api1
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `
    SELECT *
    FROM user
    WHERE username='${username}';`;
  const responseUser = await db.get(selectUserQuery);
  if (responseUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(
      password,
      responseUser.password
    );
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "Secret_key");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});
//authentication token
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "Secret_key", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};
//api 2
const convertToCamelCase = (result) => {
  return {
    stateId: result.state_id,
    stateName: result.state_name,
    population: result.population,
  };
};
app.get("/states/", authenticateToken, async (request, response) => {
  const getStatesRequest = `
    SELECT * 
    FROM state;`;
  const getStateResponse = await db.all(getStatesRequest);
  response.send(
    getStateResponse.map((eachState) => convertToCamelCase(eachState))
  );
});
//api3
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateIdRequest = `
    SELECT *
    FROM state 
    WHERE state_id=${stateId};`;
  const getStateIdResponse = await db.get(getStateIdRequest);
  response.send(convertToCamelCase(getStateIdResponse));
});
//api4
app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const createRequest = `INSERT INTO district(district_name,state_id,cases,cured,active,deaths) 
    VALUES ('${districtName}',${stateId},${cases},${cured},${active},${deaths});`;
  const districtResponse = await db.run(createRequest);
  response.send("District Successfully Added");
});

//api5
const getDistrictCase = (district) => {
  return {
    districtId: district.district_id,
    districtName: district.district_name,
    stateId: district.state_id,
    cases: district.cases,
    cured: district.cured,
    active: district.active,
    deaths: district.deaths,
  };
};
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictRequest = `
    SELECT *
    FROM district 
    WHERE district_id=${districtId};`;
    const getDistrictResponse = await db.get(getDistrictRequest);
    response.send(getDistrictCase(getDistrictResponse));
  }
);
//api6
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteRequest = `DELETE 
    FROM district 
    WHERE district_id=${districtId};`;
    const deleteResponse = await db.run(deleteRequest);
    response.send(`District Removed`);
  }
);
//api7
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistrictRequest = `UPDATE district SET 
    district_name='${districtName}',
    state_id=${stateId},
    cases=${cases},
    cured=${cured},
    active=${active},
    deaths=${deaths} WHERE district_id=${districtId};`;
    const updateDistrictResponse = await db.run(updateDistrictRequest);
    response.send(`District Details Updated`);
  }
);
//api8
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStatsRequest = `SELECT sum(cases) as totalCases ,sum(cured) as totalCured,
    sum(active) as totalActive ,sum(deaths) as totalDeaths
    FROM district 
    WHERE state_id=${stateId};`;
    const getStatsResponse = await db.get(getStatsRequest);
    response.send(getStatsResponse);
  }
);
module.exports = app;
