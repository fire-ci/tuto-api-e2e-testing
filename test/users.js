const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const chai = require("chai");
const chaiHttp = require("chai-http");
const should = chai.should();

const config = require("../config");

const SERVER_URL = process.env.APP_URL || "http://localhost:8000";
const MOCK_SERVER_PORT = process.env.MOCK_SERVER_PORT || 8002;

chai.use(chaiHttp);

const redis = require("redis").createClient({
  host: config.redis.host,
  port: config.redis.port
});

const TEST_USER = {
  email: "john@doe.com",
  firstname: "John"
};

let createdUserId;

const mock = {
  app: express(),
  server: null,
  requests: [],
  status: 404,
  responseBody: {}
};

const setupMock = (status, body) => {
  mock.status = status;
  mock.responseBody = body;
};

const initMock = async () => {
  mock.app.use(bodyParser.urlencoded({ extended: false }));
  mock.app.use(bodyParser.json());
  mock.app.use(cors());
  mock.app.get("*", (req, res) => {
    mock.requests.push(req);
    res.status(mock.status).send(mock.responseBody);
  });

  mock.server = await mock.app.listen(MOCK_SERVER_PORT);
  console.log(`Mock server started on port: ${MOCK_SERVER_PORT}`);
};

const teardownMock = () => {
  if (mock.server) {
    mock.server.close();
    delete mock.server;
  }
};

describe("Users", () => {
  before(async () => await initMock());

  after(() => {
    redis.quit();
    teardownMock();
  });

  beforeEach(() => (mock.requests = []));

  it("should create a new user", done => {
    setupMock(200, { result: "valid" });

    chai
      .request(SERVER_URL)
      .post("/api/users")
      .send(TEST_USER)
      .end((err, res) => {
        if (err) {
          done(err);
        } else {
          res.should.have.status(201);
          res.should.be.json;
          res.body.should.be.a("object");
          res.body.should.have.property("id");
          res.body.should.have.property("email");
          res.body.should.have.property("firstname");
          res.body.id.should.not.be.null;
          res.body.email.should.equal(TEST_USER.email);
          res.body.firstname.should.equal(TEST_USER.firstname);
          createdUserId = res.body.id;

          mock.requests.length.should.equal(1);
          mock.requests[0].path.should.equal("/api/validate");
          mock.requests[0].query.should.have.property("email");
          mock.requests[0].query.email.should.equal(TEST_USER.email);

          redis.get(createdUserId, (err, cacheData) => {
            if (err) throw err;
            cacheData = JSON.parse(cacheData);
            cacheData.should.have.property("email");
            cacheData.should.have.property("firstname");
            cacheData.email.should.equal(TEST_USER.email);
            cacheData.firstname.should.equal(TEST_USER.firstname);

            done();
          });
        }
      });
  });

  it("should get the created user", done => {
    chai
      .request(SERVER_URL)
      .get("/api/users")
      .end((err, res) => {
        if (err) {
          done(err);
        } else {
          res.should.have.status(200);
          res.body.should.be.a("array");

          const user = res.body.pop();
          user.id.should.equal(createdUserId);
          user.email.should.equal(TEST_USER.email);
          user.firstname.should.equal(TEST_USER.firstname);
          done();
        }
      });
  });

  it("should not create user if mail is spammy", done => {
    setupMock(200, { result: "invalid" });

    chai
      .request(SERVER_URL)
      .post("/api/users")
      .send(TEST_USER)
      .end((err, res) => {
        res.should.have.status(403);
        done();
      });
  });

  it("should not create user if spammy mail API is down", done => {
    setupMock(404, { result: "invalid" });

    chai
      .request(SERVER_URL)
      .post("/api/users")
      .send(TEST_USER)
      .end((err, res) => {
        res.should.have.status(403);
        done();
      });
  });
});
