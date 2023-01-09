/* eslint-disable no-undef */
const request = require("supertest");
var cheerio = require("cheerio");

const db = require("../models/index");
const app = require("../app");

const { response } = require("../app");
let server, agent;

function extractCsrfToken(res) {
  var $ = cheerio.load(res.text);
  return $("[name=_csrf]").val();
}
// Login 
const login = async (agent, username, password) => {
  let res = await agent.get("/login");
  let csrfToken =  extractCsrfToken(res);
    res = await agent.post("/session").send({ 
      email: "test@user.com", 
      password: "12345678",
       _csrf: csrfToken,
    });
};

describe("first", () => {
  beforeAll(async () => {
    await db.sequelize.sync({ force: true });
    server = app.listen(6000, () => {});
    agent = request.agent(server);
  });

  afterAll(async () => {
    await db.sequelize.close();
    server.close();
  });

  test(" should test suite", () => {
    expect(1).toBe(1);
  });
// login as a user
  test("login as a user required ", async () => {
    const res = await agent.get("/home");
    expect(res.statusCode).toBe(302);
  });
// admin authenticating page
  test("admin authenticating page works", async () => {
    const res = await agent.get("/signup");
    expect(res.statusCode).toBe(200);
    const login = await agent.get("/login");
    expect(login.statusCode).toBe(200);
  });
// sign up as a admin
  test("sign up as admin", async () => {
    const signupPage = await agent.get("/signup");
    const token = extractCsrfToken(signupPage);
    const res = await agent.post("/users").send({
      name: "admin",
      email: "test@user.com",
      password: "12345678",
      _csrf: token,
    });
    expect(res.statusCode).toBe(302);
  });
// now creating an election 
  test("Create an Election", async () => {
    let count, newCount;
    const addElection = await agent.get("/elections/new");
    const token = extractCsrfToken(addElection);
    const response = await agent.get("/election");
    count = response.body.elections.length;

    await agent.post("/election").send({
      elecName: "tcommunity election",
      publicurl: "abc.gs",
      _csrf: token,
    });

    await agent.get("/election").then((data) => {
      newCount = data.body.elections.length;
    });
    expect(newCount).toBe(count + 1);
  });
// ending an election
  test("end an election", async () => {
    let count, newCount;
    const addElection = await agent.get("/elections/new");
    const token = extractCsrfToken(addElection);
    const response = await agent.get("/election");
    count = response.body.elections.length;

    const electionID = response.body.elections[count - 1].id;

    await agent.post("/election").send({
      elecName: "tcommunity election launch",
      publicurl: "abc.gs"
      _csrf: token,
    });

    await agent.get("/election").then((data) => {
      newCount = data.body.elections.length;
    });
    expect(newCount).toBe(count + 1);

    const res2 = await agent.get(`/election/${electionID}`);
    const token2 = extractCsrfToken(res2);

    const result2 = await agent.get(`/election/${electionID}/launch`).send({
      _csrf: token2,
    });

    expect(result2.statusCode).toBe(302);

    const res = await agent.get(`/election/${electionID}`);
    const token3 = extractCsrfToken(res);

    const result = await agent.put(`/election/${electionID}/end`).send({
      _csrf: token3,
    });

    expect(result.ok).toBe(true);
  });
// if wanna delete an election
  test("deleting an  election", async () => {
    let count;
    const response = await agent.get("/election");
    count = response.body.elections.length;

    const electionID = response.body.elections[count - 1].id;

    const electionPage = await agent.get(`/election/${electionID}`);
    const token = extractCsrfToken(electionPage);
    const res = await agent.delete(`/election/${electionID}`).send({
      _csrf: token,
    });

    expect(res.ok).toBe(true);
  });
// editing an election 
  test("editing an  election", async () => {
    const res = await agent.get("/elections/new");
    const token = extractCsrfToken(res);
    await agent.post("/election").send({
      elecName: "updating an  election",
      _csrf: token,
    });
    let count;
    let response = await agent.get("/election");
    count = response.body.elections.length;

    const electionID = response.body.elections[count - 1].id;

    const electionPage = await agent.get(`/election/${electionID}`);
    const newToken = extractCsrfToken(electionPage);
    await agent
      .post(`/election/${electionID}`)
      .send({ name: "Election 1", _csrf: newToken });

    response = await agent.get("/election");
    expect(response.body.elections[count - 1].name).toBe("Election 1");
  });
// now we gonna add question for an election 
  test("adding a question for an election", async () => {
    let count;
    const response = await agent.get("/election");
    count = response.body.elections.length;

    const electionID = response.body.elections[count - 1].id;
    const res = await agent.get(`/election/${electionID}`);
    const token = extractCsrfToken(res);

    const result = await agent
      .post(`/election/${electionID}/questions/add`)
      .send({
        title: "Question number 1",
        description: "This is a description of this",
        _csrf: token,
      });

    expect(result.statusCode).toBe(302);
  });
// we gonna edit an question now
  test("editing a question for election", async () => {
    let count;
    const response = await agent.get("/election");
    count = response.body.elections.length;

    const electionID = response.body.elections[count - 1].id;

    const questions = await agent.get(`/election/${electionID}/questions`);
    const questionID = questions._body[0].id;

    const res = await agent.get(`/election/${electionID}`);
    const token = extractCsrfToken(res);

    const result = await agent.post(`/election/${electionID}/question/${questionID}/update`).send({
        title: "Question number 1",
        description: "This is a edited description of this",
        _csrf: token,
      });

    expect(result.statusCode).toBe(302);
  });
// deleting a question for an election
  test("deleting an  question for an election", async () => {
    let count;
    const response = await agent.get("/election");
    count = response.body.elections.length;

    const electionID = response.body.elections[count - 1].id;

    const addRes = await agent.get(`/election/${electionID}`);
    const addToken = extractCsrfToken(addRes);

    await agent.post(`/election/${electionID}/questions/add`).send({
      title: "Question number 3",
      description: "This is a description of this",
      _csrf: addToken,
    });

    const questions = await agent.get(`/election/${electionID}/questions`);
    const questionID = questions._body[0].id;

    const res = await agent.get(`/election/${electionID}`);
    const token = extractCsrfToken(res);

    const result = await agent
      .delete(`/election/${electionID}/question/${questionID}`)
      .send({
        _csrf: token,
      });

    expect(result.statusCode).toBe(200);
  });
// adding an option to question for an election 
  test("adding an  option to question for an election", async () => {
    let count;
    const response = await agent.get("/election");
    count = response.body.elections.length;

    const electionID = response.body.elections[count - 1].id;

    const questions = await agent.get(`/election/${electionID}/questions`);
    const questionID = questions._body[0].id;

    const res = await agent.get(`/election/${electionID}`);
    const token = extractCsrfToken(res);

    const result = await agent.post(`/election/${electionID}/question/${questionID}/options/add`)
      .send({
        option: "Option 1",
        _csrf: token,
      });

    // adding 2nd option
    const res2 = await agent.get(`/election/${electionID}`);
    const token2 = extractCsrfToken(res2);

    await agent
      .post(`/election/${electionID}/question/${questionID}/options/add`)
      .send({
        option: "Option 1",
        _csrf: token2,
      });

    expect(result.statusCode).toBe(302);
  });
// now we will gonna edit an option 
  test("edit option", async () => {
    let count;
    const response = await agent.get("/election");
    count = response.body.elections.length;

    const electionID = response.body.elections[count - 1].id;

    const questions = await agent.get(`/election/${electionID}/questions`);
    const questionCount = questions._body.length;
    const questionID = questions._body[questionCount - 1].id;

    const optionsRes = await agent.get(
      `/election/${electionID}/question/${questionID}/options`
    );
    const options = optionsRes._body;
    const optionCount = options.length;
    const optionID = options[optionCount - 1].id;

    const res2 = await agent.get(
      `/election/${electionID}/question/${questionID}/option/${optionID}/edit`
    );
    const token2 = extractCsrfToken(res2);

    const updateRes = await agent
      .post(
        `/election/${electionID}/question/${questionID}/option/${optionID}/update`
      )
      .send({
        value: "Edited A New Option 1",
        _csrf: token2,
      });

    expect(updateRes.statusCode).toBe(302);
  });
// else deleting option 
  test("delete option", async () => {
    let count;
    const response = await agent.get("/election");
    count = response.body.elections.length;

    const electionID = response.body.elections[count - 1].id;

    const questions = await agent.get(`/election/${electionID}/questions`);
    const questionID = questions._body[0].id;

    const res2 = await agent.get(`/election/${electionID}`);
    const token2 = extractCsrfToken(res2);

    await agent
      .post(`/election/${electionID}/question/${questionID}/options/add`)
      .send({
        option: "Option 1",
        _csrf: token2,
      });

    const res = await agent.get(`/election/${electionID}`);
    const token = extractCsrfToken(res);

    const result = await agent
      .delete(`/election/${electionID}/question/${questionID}/option/1`)
      .send({
        _csrf: token,
      });

    expect(result.statusCode).toBe(200);
  });
// adding a voter to an election 
  test("adding a voter to an election", async () => {
    let count;
    const response = await agent.get("/election");
    count = response.body.elections.length;
    const electionID = response.body.elections[count - 1].id;
    const res = await agent.get(`/election/${electionID}`);
    const token = extractCsrfToken(res);

    const result = await agent.post(`/election/${electionID}/voters/add`).send({
      voterID: "Student A",
      password: "12345678",
      _csrf: token,
    });

    expect(result.statusCode).toBe(302);
  });
// launch an election 
  test("launching an  election", async () => {
    let count;
    const response = await agent.get("/election");
    count = response.body.elections.length;

    const electionID = response.body.elections[count - 1].id;

    const res = await agent.get(`/election/${electionID}`);
    const token = extractCsrfToken(res);

    const result = await agent.get(`/election/${electionID}/launch`).send({
      _csrf: token,
    });

    expect(result.statusCode).toBe(302);
  });
// voter login
  test("voter login", async () => {
    let count;
    const response = await agent.get("/election");
    count = response.body.elections.length;

    const electionID = response.body.elections[count - 1].id;

    await agent.get("/signout");

    const votePage = await agent.get(`/election/${electionID}/vote`);
    const token = extractCsrfToken(votePage);
    const res = await agent.post(`/election/${electionID}/vote`).send({
      voterID: "Student A",
      password: "12345678",
      _csrf: token,
    });

    expect(res.statusCode).toBe(302);
  });
// finally end an election and see the results 
  test("end an election and check the results of the page", async () => {
    login();
    let count;
    const response = await agent.get("/election");
    count = response.body.elections.length;

    const electionID = response.body.elections[count - 1].id;

    // end the election
    const res = await agent.get(`/election/${electionID}`);
    const token3 = extractCsrfToken(res);

    const endRes = await agent.put(`/election/${electionID}/end`).send({
      _csrf: token3,
    });
    expect(endRes.ok).toBe(true);

    // logout as admin
    await agent.get("/signout");

    // voting  page redirected to results page
    const result = await agent.get(`/election/${electionID}/vote`);
    expect(result.statusCode).toBe(302);
  });

  test("sign out as a admin", async () => {
    login();
    await agent.get("/signout");
    const res = await agent.get("/home");
    expect(res.statusCode).toBe(302);
  });
});
