const bodyParser = require("body-parser");
const path = require("path");
const ejs = require("ejs");
const mongoose = require("mongoose");
const port = 8080;
const session = require('express-session');
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const User = require("./models/user.js");
const Event = require("./models/event.js");

const express = require("express");

const app = express();

mongoose
  .connect(process.env["db"], {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("MongoDB connected");
  })
  .catch((error) => {
    console.error("MongoDB connection error:", error);
  });

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.urlencoded({ extended: true }));

app.set("views", path.join(__dirname, "views"));

app.use(
  session({
    secret: "comp_2.0",
    resave: false,
    saveUninitialized: false,
  }),
);

app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.engine("html", ejs.renderFile);
app.set("view engine", "ejs");

app.use(express.static(path.join(__dirname, "public")));

const auth = require('basic-auth');
const authenticateAdmin = (req, res, next) => {
  const user = auth(req);
  if (user && user.name === process.env['username'] && user.pass === process.env['password']) {
    return next();
  }
  res.set('WWW-Authenticate', 'Basic realm="Admin Area"');
  res.status(401).send('Authentication required');
};

app.get('/admin', authenticateAdmin, async (req, res) => {
  try {
    const users = await User.find({}).populate("events");
    res.render('admin', { users ,user: req.user });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/admin/toggle-admin/:userId', authenticateAdmin, async (req, res) => {
  try {
    const userId = req.params.userId;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).send('User not found');
    }
    user.admin = !user.admin;
    await user.save();
    res.redirect('/admin');
  } catch (error) {
    console.error('Error toggling admin status:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.post("/admin/delete-user/:userId", authenticateAdmin, async (req, res) => {
  try {
    const userId = req.params.userId;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).send("User not found");
    }
    await Event.deleteMany({ createdBy: userId });
    await User.deleteOne({ _id: userId });
    res.redirect("/admin");
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/", (req, res) => {
  res.render("index", { user: req.user });
});

app.get("/about", (req, res) => {
  res.render("about", { user: req.user });
});

app.get("/events", async (req, res) => {
  try {
    const events = await Event.find({}).populate("createdBy");
    res.render("event", { user: req.user, events });
  } catch (error) {
    console.error("Error fetching events:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/events/:eventName", async (req, res) => {
  try {
    const eventName = req.params.eventName;
    const event = await Event.findOne({ eventName }).populate("createdBy");
    if (!event) {
      return res.status(404).send("Event not found");
    }
    res.render("eventname", { event, user: req.user });
  } catch (error) {
    console.error("Error fetching event:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/register", (req, res) => {
  res.render("register", { user: req.user, error: null });
});

app.post("/register", async (req, res) => {
  try {
    const existingUser = await User.findOne({ username: req.body.username });
    if (existingUser) {
      return res.render("register", { user: req.user,error: "Username already exists." });
    }
    if (req.body.password.includes('\u0000')) {
      return res.render("register", { user: req.user,error: "Password cannot contain null characters." });
    }
    const newUser = await User.register(
      new User({ username: req.body.username }),
      req.body.password,
    );
    req.login(newUser, (err) => {
      if (err) throw err;
      res.redirect("/dashboard");
    });
  } catch (err) {
    console.error(err);
    res.redirect("/register");
  }
});

app.get("/login", (req, res) => {
  res.render("login", { user: req.user });
});

app.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/dashboard",
    failureRedirect: "/login",
  }),
);

app.get("/logout", (req, res) => {
  req.logout(function (err) {
    if (err) {
      console.error(err);
      return next(err);
    }
    res.redirect("/");
  });
});

app.get("/dashboard", async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.redirect("/login");
    }
    const userEvents = await Event.find({ createdBy: req.user._id });
    res.render("dashboard", { user: req.user, userEvents });
  } catch (error) {
    console.error("Error fetching user events:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/create-event", async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.redirect("/login");
    }
    const newEvent = new Event({
      eventName: req.body.eventName,
      eventDescription: req.body.eventDesc,
      createdBy: req.user._id,
    });
    await newEvent.save();
    req.user.events.push(newEvent);
    await req.user.save();
    res.redirect("/dashboard");
  } catch (error) {
    console.error("Error creating event:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/delete-event/:eventId", async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.redirect("/login");
    }
    const eventId = req.params.eventId;
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).send("Event not found");
    }
    if (event.createdBy.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .send("You are not authorized to delete this event");
    }
    await Event.deleteOne({ _id: eventId });
    req.user.events.pull(eventId);
    await req.user.save();
    res.redirect("/dashboard");
  } catch (error) {
    console.error("Error deleting event:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.post('/events/:eventId/approve', async (req, res) => {
    try {
        if (!req.isAuthenticated() || !req.user.admin) {
            return res.status(403).send('Unauthorized');
        }
        const eventId = req.params.eventId;
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).send('Event not found');
        }
        event.approved = true;
        event.pending = false;
        await event.save();
        res.redirect('/events');
    } catch (error) {
        console.error('Error approving/disapproving event:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.post('/events/:eventId/disapprove', async (req, res) => {
    try {
        if (!req.isAuthenticated() || !req.user.admin) {
            return res.status(403).send('Unauthorized');
        }
        const eventId = req.params.eventId;
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).send('Event not found');
        }
        event.approved = false;
        event.pending = false;
        await event.save();
        res.redirect('/events');
    } catch (error) {
        console.error('Error approving/disapproving event:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.listen(port, () => {
  console.log(`App listening on port ${port}`);
});

process.on('unhandledRejection', (reason, p) => {
  console.log(' [antiCrash] :: Unhandled Rejection/Catch');
  console.log(reason, p);
});
process.on('uncaughtException', (err, origin) => {
  console.log(' [antiCrash] :: Uncaught Exception/Catch');
  console.log(err, origin);
});
process.on('uncaughtExceptionMonitor', (err, origin) => {
  console.log(' [antiCrash] :: Uncaught Exception/Catch (MONITOR)');
  console.log(err, origin);
});
process.on('multipleResolves', (type, promise, reason) => {
  console.log(' [antiCrash] :: Multiple Resolves');
  console.log(type, promise, reason);
});
