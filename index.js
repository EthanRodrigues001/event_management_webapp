const bodyParser = require("body-parser");
const path = require("path");
const ejs = require("ejs");
const mongoose = require("mongoose");
const port = 8080;
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const User = require('./models/user.js');
const Event = require('./models/event.js');


const express = require("express");

const app = express();

// Connect to MongoDB

mongoose.connect(process.env['db'], {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log("MongoDB connected");
})
.catch((error) => {
  console.error("MongoDB connection error:", error);
});

//parse json
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.urlencoded({ extended: true }));

//session
app.use(session({
  secret: "comp_2.0",
  resave: false,
  saveUninitialized: false,
}));
app.use(passport.initialize());
app.use(passport.session());

// Passport configuration
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// ejs
app.engine("html", ejs.renderFile);
app.set("view engine", "ejs");

//static files
app.use(express.static(path.join(__dirname, "public")));


//routes
app.get("/", (req, res) => {
  res.render("index", { user: req.user });
});

app.get("/about", (req, res) => {
  res.render("about", { user: req.user });
});


app.get('/events', async (req, res) => {
  try {
 
    const events = await Event.find({}).populate('createdBy');


    res.render('event', { user: req.user,events });
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).send('Internal Server Error');
  }
});



app.get('/register', (req, res) => {
  res.render('register', { user: req.user });
});

app.post('/register', async (req, res) => {
  try {
    const newUser = await User.register(new User({ username: req.body.username }), req.body.password);

    req.login(newUser, (err) => {
      if (err) throw err;
      res.redirect('/dashboard');
    });
  } catch (err) {
    console.error(err);
    res.redirect('/register'); 
  }
});

app.get('/login', (req, res) => {
  res.render('login', { user: req.user });
});



app.post('/login', passport.authenticate('local', {
  successRedirect: '/dashboard', 
  failureRedirect: '/login', 
}));


app.get('/logout', (req, res) => {
  req.logout(function(err) {
    if (err) {
      console.error(err);
      return next(err);
    }
    res.redirect('/');
  });
});

app.get('/dashboard', async (req, res) => {
  try {
    // Ensure user is authenticated
    if (!req.isAuthenticated()) {
      return res.redirect('/login');
    }

    // Query events created by the authenticated user
    const userEvents = await Event.find({ createdBy: req.user._id });

    // Render the dashboard view and pass user and userEvents to it
    res.render('dashboard', { user: req.user, userEvents });
  } catch (error) {
    console.error('Error fetching user events:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/create-event', async (req, res) => {
  try {
    // Ensure user is authenticated
    if (!req.isAuthenticated()) {
      return res.redirect('/login');
    }

    // Create the event
    const newEvent = new Event({
      eventName: req.body.eventName,
      createdBy: req.user._id // Assuming req.user contains the authenticated user
    });

    // Save the event to the database
    await newEvent.save();

    // Redirect back to the dashboard or any other appropriate route
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).send('Internal Server Error');
  }
});

//listen
app.listen(port, () => {
  console.log(`App listening on port ${port}`);
});
