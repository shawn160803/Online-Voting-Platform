/* eslint-disable no-undef */
const express = require("express");
const app = express();
const path = require("path");
const { Admin, Election, question, Option, Voter } = require("./models");
const bcrypt = require("bcrypt");
var cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const connectEnsureLogin = require("connect-ensure-login");
const session = require("express-session");
const localStrategy = require("passport-local");
const passport = require("passport");
const flash = require("connect-flash");
const csrf = require("tiny-csrf");

const saltRounds = 10;

app.use(flash());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser("ssh! some secret string!"));
app.use(csrf("This_Should_Be_32_Character_Long", ["POST", "PUT", "DELETE"]));

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    secret: "my-super-secret-key-2178172615261562",
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

app.use(function (request, response, next) {
  response.locals.messages = request.flash();
  next();
});

app.use(passport.initialize());
app.use(passport.session());

// here we using admin ID passport session
passport.use(
  "user-local",
  new localStrategy(
    {
      usernameField: "email",
      passwordField: "password",
    },
    (username, password, done) => {
      Admin.findOne({ where: { email: username } })
        .then(async (user) => {
          const result = await bcrypt.compare(password, user.password);
          if (result) {
            return done(null, user);
          } else {
            return done(null, false, { message: "this is wrong password" });
          }
        })
        .catch((error) => {
          console.log(error);
          return done(null, false, {
            message: "Email you write not registered",
          });
        });
    }
  )
);

// now going for  voter ID passport session
passport.use(
  "voter-local",
  new localStrategy(
    {
      usernameField: "voterID",
      passwordField: "password",
      passReqToCallback: true,
    },
    (request, username, password, done) => {
      Voter.findOne({
        where: { voterID: username, electionID: request.params.id },
      })
        .then(async (voter) => {
          const result = await bcrypt.compare(password, voter.password);
          if (result) {
            return done(null, voter);
          } else {
            return done(null, false, { message: "this is wrong  password" });
          }
        })
        .catch((error) => {
          console.log(error);
          return done(null, false, {
            message: "This voter is not registered for an election",
          });
        });
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((obj, done) => {
  done(null, obj);
});

// creating an home page
app.get("/", (request, response) => {
  response.render("home");
});

// requesting sign up page 
app.get("/signup", (request, response) => {
  response.render("signup", { csrf: request.csrfToken() });
});

// requesting login page
app.get("/login", (request, response) => {
  if (request.user && request.user.id) {
    return response.redirect("/home");
  }
  response.render("login", { csrf: request.csrfToken() });
});

// admin home page frontend
app.get("/home",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const loggedInAdminID = request.user.id;
    const admin = await Admin.findByPk(loggedInAdminID);

    const elections = await Election.findAll({
      where: { adminID: request.user.id },
    });

    response.render("adminHome", {
      username: admin.name,
      elections: elections,
      csrf: request.csrfToken(),
    });
  }
);

app.get(
  "/election", connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const loggedInAdminID = request.user.id;
    const elections = await Election.findAll({
      where: { adminID: loggedInAdminID },
    });

    return response.json({ elections });
  }
);

// making an  election home page
app.get(
  "/election/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const loggedInAdminID = request.user.id;
    const admin = await Admin.findByPk(loggedInAdminID);
    const elections = await Election.findByPk(request.params.id);

    if (loggedInAdminID !== elections.adminID) {
      return response.render("error", {
        errorMessage: "You are not registered to view this page",
      });
    }

    const questions = await question.findAll({
      where: { electionID: request.params.id },
    });

    const voters = await Voter.findAll({
      where: { electionID: request.params.id },
    });
// election home
    response.render("electionHome", {
      election: elections,
      username: admin.name,
      questions: questions,
      voters: voters,
      csrf: request.csrfToken(),
    });
  }
);

// deleting an election election
app.delete(
  "/election/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const adminID = request.user.id;
    const election = await Election.findByPk(request.params.id);

    if (adminID !== election.adminID) {
      console.log("You are not applicable to perform this action");
      return response.redirect("/home");
    }

    // you can get all questions of that election
    const questions = await question.findAll({
      where: { electionID: request.params.id },
    });

    // you can  delete all options and then questions of that election
    questions.forEach(async (Question) => {
      const options = await Option.findAll({
        where: { questionID: Question.id },
      });
      options.forEach(async (option) => {
        await Option.destroy({ where: { id: option.id } });
      });
      await question.destroy({ where: { id: Question.id } });
    });

    
    // deleting a  voters of the an election
    
    
    const voters = await Voter.findAll({
      where: { electionID: request.params.id },
    });
    voters.forEach(async (voter) => {
      await Voter.destroy({ where: { id: voter.id } });
    });

    try {
      await Election.destroy({ where: { id: request.params.id } });
      return response.json({ ok: true });
    } 
    catch (error) {
      console.log(error);
      response.send(error);
    }
  }
);

// creating a new election  new election
app.post(
  "/election",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.body.name.trim().length === 0) {
      request.flash("Error", " You can't left Election name empty");
      return response.redirect("/elections/new");
    }

    const loggedInAdminID = request.user.id;

    // checking validation 
    const election = await Election.findOne({
      where: { adminID: loggedInAdminID, name: request.body.name },
    });
    if (election) {
      request.flash("Error", " this lection name is  already used, pick another");
      return response.redirect("/elections/new");
    }

    try {
      await Election.add(loggedInAdminID, request.body.name);
      response.redirect("/home");
    } catch (error) {
      console.log(error);
      response.send(error);
    }
  }
);

// creating a  new election 
app.get(
  "/elections/new",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const loggedInAdminID = request.user.id;
    const admin = await Admin.findByPk(loggedInAdminID);

    response.render("newElection", {
      username: admin.name,
      csrf: request.csrfToken(),
    });
  }
);

// now editing an election frontend
app.get(
  "/election/:id/edit",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const loggedInAdminID = request.user.id;
    const election = await Election.findByPk(request.params.id);
    const admin = await Admin.findByPk(loggedInAdminID);

    if (loggedInAdminID !== election.adminID) {
      return response.render("error", {errorMessage: "You are not applicable to perform this action",
      });
    }

    response.render("editElection", {election: election, username: admin.name,
      csrf: request.csrfToken(),
    });
  }
);

// updating an  election name
app.post(
  "/election/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const loggedInAdminID = request.user.id;
    const elections = await Election.findByPk(request.params.id);

    if (loggedInAdminID !== elections.adminID) {
      return response.render("Error", { errorMessage: "You are not applicable  to visit this page",
      });
    }

    // checking  validation
    if (request.body.name.trim().length === 0) {
      request.flash("Error", " you can't left Election name be empty");
      return response.redirect(`/election/${request.params.id}/edit`);
    }
    const sameElection = await Election.findOne({
      where: {
        adminID: loggedInAdminID,
        name: request.body.name,
      },
    });

    if (sameElection) {
      if (sameElection.id.toString() !== request.params.id) {
        request.flash("Error", "this Election name is already in  use");
        return response.redirect(`/election/${request.params.id}/edit`);
      } else {
        request.flash("error", "No changes have  made");
        return response.redirect(`/election/${request.params.id}/edit`);
      }
    }

    try {
      await Election.update(
        { name: request.body.name },
        { where: { id: request.params.id } }
      );
      response.redirect(`/election/${request.params.id}`);
    } catch (error) {
      console.log(error);
      return response.send(error);
    }
  }
);

// creating  new admin user election page 
app.post("/users", async (request, response) => {
  
  //  checking validation 
  
  
  if (request.body.email.trim().length === 0) {
    request.flash("error", "email can't be left empty");
    return response.redirect("/signup");
  }

  if (request.body.password.length === 0) {
    request.flash("error", "password can't be left an empty");
    return response.redirect("/signup");
  }

  if (request.body.name.length === 0) {
    request.flash("error", "name can't be left  empty");
    return response.redirect("/signup");
  }

  if (request.body.password.length < 8) {
    request.flash("error", "password must be at least...  8  characters long");
    return response.redirect("/signup");
  }

  // check if an  email already exists then 
  const admin = await Admin.findOne({ where: { email: request.body.email } });
  if (admin) {
    request.flash("error", "email you write already exists");
    return response.redirect("/signup");
  }

  // now we hasing the password
  const hashpwd = await bcrypt.hash(request.body.password, saltRounds); 
  
  // it will take time so add await
  try {
    const user = await Admin.create({
      name: request.body.name,
      email: request.body.email,
      password: hashpwd,
    });
    request.login(user, (err) => {
      if (err) {
        console.log(err);
        response.redirect("/");
      } else {
        request.flash("Success", " your Sign up is successful");
        response.redirect("/home");
      }
    });
  } catch (error) {
    request.flash("error", error.message);
    return response.redirect("/signup");
  }
});

// getting  questions of an election
app.get(
  "/election/:id/questions",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const allQuestions = await question.findAll({
      where: { electionID: request.params.id },
    });

    return response.send(allQuestions);
  }
);

// adding a  question to election
app.post(
  "/election/:id/questions/add",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const loggedInAdminID = request.user.id;

    const election = await Election.findByPk(request.params.id);

    if (loggedInAdminID !== election.adminID) {
      return response.render("error", {
        errorMessage: "You are not applicable  to visit this page",
      });
    }
// launching an election 
    
    
    if (election.launched) {
      console.log("Election already launched");
      return response.render("error", {
        errorMessage:
          "You can't edit the election now, coz this election is already launched",
      });
    }

    // checking  validation
    if (request.body.title.trim().length === 0) {
      request.flash("error", " your Question title can't be left empty");
      return response.redirect(`/election/${request.params.id}`);
    }

    const sameQuestion = await question.findOne({
      where: { electionID: request.params.id, title: request.body.title },
    });
    if (sameQuestion) {
      request.flash("error", "This Question title you used  already in used");
      return response.redirect(`/election/${request.params.id}`);
    }

    try {
      await question.add(
        request.body.title,
        request.body.description,
        request.params.id
      );
      response.redirect(`/election/${request.params.id}`);
    } catch (error) {
      console.log(error);
      return response.send(error);
    }
  }
);

// deleimg an  option for question
app.delete(
  "/election/:electionID/question/:questionID/option/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const adminID = request.user.id;
    const election = await Election.findByPk(request.params.electionID);

    if (election.adminID !== adminID) {
      return response.render("error", {
        errorMessage: "You are not applicable to view this page",
      });
    }

    const Question = await question.findByPk(request.params.questionID);

    if (!Question) {
      console.log("sorry, Question not found");
      return response.render("error", { errorMessage: "sorry, Question not found" });
    }

    try {
      await Option.destroy({ where: { id: request.params.id } });
      return response.json({ ok: true });
    } catch (error) {
      console.log(error);
      return response.send(error);
    }
  }
);

// delete question
app.delete(
  "/election/:id/question/:questiondID",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const adminID = request.user.id;
    const election = await Election.findByPk(request.params.id);

    if (election.adminID !== adminID) {
      return response.render("error", {
        errorMessage: "You are not applicable to view this page",
      });
    }

    try {
      // we deleting all options of that question
      
      await Option.destroy({
        where: { questionID: request.params.questiondID },
      });

      // deleting a  question
      
      await question.destroy({ where: { id: request.params.questiondID } });
      return response.json({ ok: true });
    } catch (error) {
      console.log(error);
      return response.send(error);
    }
  }
);

// question home page with all of the options
app.get(
  "/election/:id/question/:questiondID",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const adminID = request.user.id;
    const admin = await Admin.findByPk(adminID);
    const election = await Election.findByPk(request.params.id);

    if (election.adminID !== adminID) {
      return response.render("error", {
        errorMessage: "You are not applicable to view this page",
      });
    }

    const Question = await question.findByPk(request.params.questiondID);

    const options = await Option.findAll({
      where: { questionID: request.params.questiondID },
    });

    response.render("questionHome", {
      username: admin.name,
      question: Question,
      election: election,
      options: options,
      csrf: request.csrfToken(),
    });
  }
);

// getting an options
app.get(
  "/election/:electionID/question/:questionID/options",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    
    const options = await Option.findAll({
      where: { questionID: request.params.questionID },
    });
    return response.send(options);
  }
);

// adding an  option to questions

app.post(
  "/election/:electionID/question/:questionID/options/add",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const adminID = request.user.id;

    const election = await Election.findByPk(request.params.electionID);

    if (election.adminID !== adminID) {
      console.log("You do not have any access to edit this election");
      return response.render("error", {
        errorMessage: "You are not applicable to view this page",
      });
    }

    if (election.launched) {
      console.log(" this Election already launched");
      return response.render("error", {
        errorMessage: " thsi Election is already launched",
      });
    }

    //  checking validation checks
    if (request.body.option.trim().length === 0) {
      request.flash("error", "you ccan't left Option be empty");
      return response.redirect(
        `/election/${request.params.electionID}/question/${request.params.questionID}`
      );
    }

    const sameOption = await Option.findOne({
      where: {
        questionID: request.params.questionID,
        value: request.body.option,
      },
    });
    
    if (sameOption) {
      request.flash("error", "Option already exists");
      return response.redirect(
        `/election/${request.params.electionID}/question/${request.params.questionID}`
      );
    }

    try {
      await Option.add(request.body.option, request.params.questionID);
      response.redirect(
        `/election/${request.params.electionID}/question/${request.params.questionID}`
      );
    } catch (error) {
      console.log(error);
      return response.send(error);
    }
  }
);

// launching an  election
app.get(
  "/election/:id/launch",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    console.log("launch initiaited");
    const adminID = request.user.id;
    const election = await Election.findByPk(request.params.id);

    // ensure that admin has access rights
    if (election.adminID !== adminID) {
      console.log("You do not  have any access to edit this election");
      return response.render("error", {
        errorMessage: "You are not applicable to view this page",
      });
    }

    // we have to ensure that there must be  atleast 1 question in the election
    
    const questions = await question.findAll({
      where: { electionID: request.params.id },
    });
    if (questions.length === 0) {
      request.flash("launch", "Please Add at least 1 Question");
      return response.redirect(`/election/${request.params.id}`);
    }

    // ensure that each question has alteast 2 options
    for (let i = 0; i < questions.length; i++) {
      const options = await Option.findAll({
        where: { questionID: questions[i].id },
      });
      if (options.length < 1) {
        request.flash(
          "launch",
          "Please ADD at least 2 options for each Question"
        );
        return response.redirect(`/election/${request.params.id}`);
      }
    }

    // and also ensure that there is atleast 1 voter in an election 
    
    const voters = await Voter.findAll({
      where: { electionID: request.params.id },
    });
    if (voters.length === 0) {
      request.flash("launch", "Please at least add  1 voter");
      return response.redirect(`/election/${request.params.id}`);
    }

    try {
      await Election.launch(request.params.id);
      return response.redirect(`/election/${request.params.id}`);
    } catch (error) {
      console.log(error);
      return response.send(error);
    }
  }
);

// ending an  election
app.put(
  "/election/:id/end",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const adminID = request.user.id;
    const election = await Election.findByPk(request.params.id);

    // ensure that admin has access rights
    if (election.adminID !== adminID) {
      console.log("You do not have any access to edit this election");
      return response.render("error", {
        errorMessage: "You are not applicable to view this page",
      });
    }

    if (election.ended === true || election.launched === false) {
      console.log("Election not launched");
      return response.render("error", {
        errorMessage: "your Request is invalid",
      });
    }

    try {
      await Election.end(request.params.id);
      return response.json({ ok: true });
    } catch (error) {
      console.log(error);
      return response.send(error);
    }
  }
);

// preview of election 

app.get(
  "/election/:id/preview",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const adminID = request.user.id;
    const election = await Election.findByPk(request.params.id);

    if (election.adminID !== adminID) {
      console.log("You do not have any access to edit this election");
      return response.render("error", {
        errorMessage: "You are not applicable to view this page",
      });
    }

    const questions = await question.findAll({
      where: { electionID: request.params.id },
    });

    const options = [];

    for (let i = 0; i < questions.length; i++) {
      const allOption = await Option.findAll({
        where: { questionID: questions[i].id },
      });
      options.push(allOption);
    }

    response.render("preview", {
      election: election,
      questions: questions,
      options: options,
    });
  }
);

// editing a question
app.post(
  "/election/:electionID/question/:questionID/update",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    console.log("found");
    const adminID = request.user.id;
    const election = await Election.findByPk(request.params.electionID);

    if (election.adminID !== adminID) {
      console.log("You do not have any access to edit this election");
      return response.render("error", {
        errorMessage: "You are not applicable to view this page",
      });
    }

    if (election.launched) {
      console.log(" this Election already launched");
      return response.render("error", {
        errorMessage: "this request is invalid , election is already launched",
      });
    }

    // validation checks
    if (request.body.title.trim().length === 0) {
      request.flash("error", "Question name cannot be left empty");
      return response.redirect(
        `/election/${request.params.electionID}/question/${request.params.questionID}/edit`
      );
    }
    const sameQuestion = await question.findOne({
      where: {
        title: request.body.title,
        description: request.body.description,
        electionID: request.params.electionID,
      },
    });
    if (sameQuestion) {
      if (sameQuestion.id.toString() === request.params.questionID) {
        request.flash("error", "you used Question name as same as before");
        return response.redirect(
          `/election/${request.params.electionID}/question/${request.params.questionID}/edit`
        );
      } else {
        request.flash("error", " this question name already used");
        return response.redirect(
          `/election/${request.params.electionID}/question/${request.params.questionID}/edit`
        );
      }
    }

    try {
      await question.edit(
        request.body.title,
        request.body.description,
        request.params.questionID
      );
      response.redirect(
        `/election/${request.params.electionID}/question/${request.params.questionID}`
      );
    } catch (error) {
      console.log(error);
      return;
    }
  }
);

// editing  question frontend
app.get(
  "/election/:electionID/question/:questionID/edit",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const adminID = request.user.id;
    const admin = await Admin.findByPk(adminID);
    const election = await Election.findByPk(request.params.electionID);

    if (election.adminID !== adminID) {
      console.log("You do not have any access to edit this election");
      return response.render("error", {
        errorMessage: "You are not applicable to view this page",
      });
    }

    if (election.launched) {
      console.log("Election already launched");
      return response.render("error", {
        errorMessage: "this request is invalid, election is already launched",
      });
    }

    const Question = await question.findByPk(request.params.questionID);
    response.render("editQuestion", {
      username: admin.name,
      election: election,
      question: Question,
      csrf: request.csrfToken(),
    });
  }
);

// adding a  voter
app.post(
  "/election/:id/voters/add",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const adminID = request.user.id;
    const election = await Election.findByPk(request.params.id);

    if (election.adminID !== adminID) {
      console.log("You do not have any access to edit this election");
      return response.render("error", {
        errorMessage: "You are not applicable to view this page",
      });
    }

    if (election.ended) {
      return response.render("error", {
        errorMessage: "Invalid request, election is ended",
      });
    }

    // validation checks
    if (request.body.voterID.trim().length === 0) {
      request.flash("voterError", "Voter ID can't be empty");
      return response.redirect(`/election/${request.params.id}`);
    }

    if (request.body.password.length === 0) {
      request.flash("voterError", "password can't be left empty");
      return response.redirect(`/election/${request.params.id}`);
    }

    if (request.body.password.length < 5) {
      request.flash("voterError", "password must be of at least 8 character long");
      return response.redirect(`/election/${request.params.id}`);
    }

    const sameVoter = await Voter.findOne({
      where: { electionID: request.params.id, voterID: request.body.voterID },
    });
    if (sameVoter) {
      request.flash("voterError", " this Voter ID already used, select another one ");
      return response.redirect(`/election/${request.params.id}`);
    }

    try {
      // hashing the password
      const hashpwd = await bcrypt.hash(request.body.password, saltRounds);

      await Voter.add(request.body.voterID, hashpwd, request.params.id);
      response.redirect(`/election/${request.params.id}`);
    } catch (error) {
      console.log(error);
      return response.send(error);
    }
  }
);

// deleting a  voter
app.post(
  "/election/:electionID/voter/:voterID/delete",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const adminID = request.user.id;
    const election = await Election.findByPk(request.params.electionID);

    if (election.adminID !== adminID) {
      console.log("You do not have any access to edit this election");
      return response.render("error", {
        errorMessage: "You are not applicable to view this page",
      });
    }

    if (election.ended) {
      return response.render("error", {
        errorMessage: "this request is invalid , election is ended",
      });
    }

    const voter = await Voter.findByPk(request.params.voterID);

    if (voter.voted) {
      return response.render("error", {
        errorMessage: "this request is invalid, voter has already voted",
      });
    }

    try {
      await Voter.delete(request.params.voterID);
      return response.json({ ok: true });
    } catch (error) {
      console.log(error);
      return response.send(error);
    }
  }
);

// editing option frontend
app.get(
  "/election/:electionID/question/:questionID/option/:optionID/edit",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const adminID = request.user.id;
    const admin = await Admin.findByPk(adminID);
    const election = await Election.findByPk(request.params.electionID);

    if (election.adminID !== adminID) {
      return response.render("error", {
        errorMessage: "You are not applicable to view this page",
      });
    }

    if (election.launched) {
      console.log("Election already launched");
      return response.render("error", {
        errorMessage: "this request is invalid, election is already launched",
      });
    }

    const Question = await question.findByPk(request.params.questionID);
    const option = await Option.findByPk(request.params.optionID);
    response.render("editOption", {
      username: admin.name,
      election: election,
      question: Question,
      option: option,
      csrf: request.csrfToken(),
    });
  }
);

// edit option
app.post(
  "/election/:electionID/question/:questionID/option/:optionID/update",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const adminID = request.user.id;
    const election = await Election.findByPk(request.params.electionID);

    if (election.adminID !== adminID) {
      console.log("You do not have any access to edit this election");
      return response.render("error", {
        errorMessage: "You are not applicable to view this page",
      });
    }

    if (election.launched) {
      console.log("Election already launched");
      return response.render("error", {
        errorMessage: "this request is invalid, election is already launched",
      });
    }

    // checking validation checks
    if (request.body.value.trim().length === 0) {
      request.flash("error", "Option can't be left empty");
      return response.redirect(
        `/election/${request.params.electionID}/question/${request.params.questionID}/option/${request.params.optionID}/edit`
      );
    }

    const sameOption = await Option.findOne({
      where: {
        questionID: request.params.questionID,
        value: request.body.value,
      },
    });

    if (sameOption) {
      if (sameOption.id.toString() !== request.params.optionID) {
        request.flash("error", " this Option already exists");
        return response.redirect(
          `/election/${request.params.electionID}/question/${request.params.questionID}/option/${request.params.optionID}/edit`
        );
      } else {
        request.flash("error", "there is No changes made");
        return response.redirect(
          `/election/${request.params.electionID}/question/${request.params.questionID}/option/${request.params.optionID}/edit`
        );
      }
    }

    try {
      await Option.edit(request.body.value, request.params.optionID);
      response.redirect(
        `/election/${request.params.electionID}/question/${request.params.questionID}`
      );
    } catch (error) {
      console.log(error);
      return;
    }
  }
);

// casting a  vote frontend
app.get("/election/:id/vote", async (request, response) => {
  const election = await Election.findByPk(request.params.id);

  if (election.launched === false) {
    console.log("Election not launched");
    return response.render("error", {
      errorMessage: "woah! this Election not launched yet",
    });
  }

  // redirecting to thev to results page if election is over
  if (election.ended === true) {
    console.log("Election is ended");
    return response.redirect(`/election/${request.params.id}/result`);
  }

  const questions = await question.findAll({
    where: {
      electionID: request.params.id,
    },
  });
  const options = [];

  for (let i = 0; i < questions.length; i++) {
    const allOption = await Option.findAll({
      where: { questionID: questions[i].id },
    });
    options.push(allOption);
  }

  // voter is  logged in
  if (request.user && request.user.id && request.user.voterID) {
    const voter = await Voter.findByPk(request.user.id);

    response.render("vote", {
      election: election,
      questions: questions,
      options: options,
      verified: true,
      submitted: voter.voted,
      voter: voter,
      csrf: request.csrfToken(),
    });
  } else {
    response.render("vote", {
      election: election,
      questions: [],
      options: [],
      verified: false,
      submitted: false,
      csrf: request.csrfToken(),
    });
  }
});

// login voter
app.post(
  "/election/:id/vote",
  passport.authenticate("voter-local", {
    failureRedirect: "back",
    failureFlash: true,
  }),
  function (request, response) {
    return response.redirect(`/election/${request.params.id}/vote`);
  }
);

// submiting  voter response
app.post(
  "/election/:electionID/voter/:id/submit",
  async (request, response) => {
    const election = await Election.findByPk(request.params.electionID);

    // validation checks
    if (election.launched === false) {
      console.log("Election not launched");
      return response.render("error", {
        errorMessage: "Election is not launched yet",
      });
    }

    if (election.ended === true) {
      console.log("Election ended");
      return response.render("error", {
        errorMessage: " this Election has ended",
      });
    }

    try {
      const questions = await question.findAll({
        where: {
          electionID: request.params.electionID,
        },
      });

      let responses = [];

      for (let i = 0; i < questions.length; i++) {
        const responseID = Number(request.body[`question-${questions[i].id}`]);
        responses.push(responseID);
      }

      // add responses of voter
      await Voter.addResponse(request.params.id, responses);

      // mark the voter as voted
      await Voter.markVoted(request.params.id);

      // sending  render thank you message
      return response.redirect(`/election/${election.id}/vote`);
    } catch (error) {
      console.log(error);
      return response.send(error);
    }
  }
);

// election results frontend
app.get(
  "/election/:id/result",
  // connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    // fetching and calculating all results
    const questions = await question.findAll({
      where: {
        electionID: request.params.id,
      },
    });

    const voters = await Voter.findAll({
      where: {
        electionID: request.params.id,
      },
    });

    let votesCast = 0;
    voters.forEach((voter) => {
      if (voter.voted) {
        votesCast++;
      }
    });

    const totalVoters = voters.length;

    let optionPercentage = [];

    for (let i = 0; i < questions.length; i++) {
      // specific question
      let array = [];

      // all options of that question
      const allOption = await Option.findAll({
        where: { questionID: questions[i].id },
      });

      allOption.forEach((option) => {
        // count for specific option
        let count = 0;

        voters.forEach((voter) => {
          if (voter.responses.includes(option.id)) {
            count++;
          }
        });

        const percent = (count * 100) / totalVoters;

        // adding the percentage for that specific option of specific question
        array.push(percent.toFixed(2));
      });

      optionPercentage.push(array);
    }

    const options = [];

    for (let i = 0; i < questions.length; i++) {
      const allOption = await Option.findAll({
        where: { questionID: questions[i].id },
      });
      options.push(allOption);
    }

    const election = await Election.findByPk(request.params.id);

    // if admin logged in and not voter logged in
    if (request.user && request.user.id && !request.user.voterID) {
      const adminID = request.user.id;
      const admin = await Admin.findByPk(adminID);

      if (adminID !== election.adminID && !election.ended) {
        return response.send("You are not applicable to view this page");
      }

      response.render("result", {
        admin: true,
        username: admin.name,
        election: election,
        questions: questions,
        options: options,
        data: optionPercentage,
        votesCast: votesCast,
        totalVoters: totalVoters,
      });
    } else {
      // if not admin and election not ended
      if (!election.ended) {
        return response.render("error", {
          errorMessage: "You are not applicable to view this page",
        });
      }

      // getting the admin username
      const admin = await Admin.findByPk(election.adminID);
      return response.render("result", {
        admin: false,
        username: admin.name,
        election: election,
        questions: questions,
        options: options,
        data: optionPercentage,
        votesCast: votesCast,
        totalVoters: totalVoters,
      });
    }
  }
);

// signout admin
app.get("/signout", (request, response) => {
  request.logout((err) => {
    if (err) {
      return next(err);
    } else {
      response.redirect("/");
    }
  });
});

app.post(
  "/session",
  passport.authenticate("user-local", {
    failureRedirect: "/login",
    failureFlash: true,
  }),
  function (request, response) {
    response.redirect("/home");
  }
);

module.exports = app;
