const bodyParser = require("body-parser");
const path = require("path");
const ejs = require("ejs");
const mongoose = require("mongoose");
const port = 8080;
const session = require("express-session");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const User = require("./models/user.js");
const Event = require("./models/event.js");

const express = require("express");

const app = express();

// Connect to MongoDB

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

//parse json
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.urlencoded({ extended: true }));

app.set("views", path.join(__dirname, "views"));

//session
app.use(
  session({
    secret: "comp_2.0",
    resave: false,
    saveUninitialized: false,
  }),
);
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

//admin Auth
const auth = require('basic-auth');
const authenticateAdmin = (req, res, next) => {
  const user = auth(req);

  // Check if the user exists and has the correct credentials
  if (user && user.name === 'adminn' && user.pass === 'password') {
    return next(); // Continue to the next middleware or route handler
  }

  // If authentication fails, send a 401 Unauthorized response
  res.set('WWW-Authenticate', 'Basic realm="Admin Area"');
  res.status(401).send('Authentication required');
};

//routes
app.get('/admin', authenticateAdmin, async (req, res) => {
  try {
    const users = await User.find({}).populate("events");
    res.render('admin', { users ,user: req.user });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

// Define a route to toggle a user's admin status
app.post('/admin/toggle-admin/:userId', authenticateAdmin, async (req, res) => {
  try {
    // Get the user ID from the URL parameters
    const userId = req.params.userId;

    // Find the user by ID
    const user = await User.findById(userId);

    // Ensure the user exists
    if (!user) {
      return res.status(404).send('User not found');
    }

    // Toggle the admin status
    user.admin = !user.admin;

    // Save the updated user
    await user.save();

    // Redirect back to the admin page
    res.redirect('/admin');
  } catch (error) {
    console.error('Error toggling admin status:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Define a route to delete a user by their ID
app.post("/admin/delete-user/:userId", authenticateAdmin, async (req, res) => {
  try {
    // Get the user ID from the URL parameters
    const userId = req.params.userId;

    // Find the user by ID
    const user = await User.findById(userId);

    // Ensure the user exists
    if (!user) {
      return res.status(404).send("User not found");
    }

    // Delete the events owned by the user
    await Event.deleteMany({ createdBy: userId });

    // Delete the user
    await User.deleteOne({ _id: userId });

    // Redirect back to the admin page or any other appropriate route
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

    // Render the events view and pass the populated events and the user to it
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
  res.render("register", { user: req.user });
});

app.post("/register", async (req, res) => {
  try {
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
    // Ensure user is authenticated
    if (!req.isAuthenticated()) {
      return res.redirect("/login");
    }

    // Query events created by the authenticated user
    const userEvents = await Event.find({ createdBy: req.user._id });

    // Render the dashboard view and pass user and userEvents to it
    res.render("dashboard", { user: req.user, userEvents });
  } catch (error) {
    console.error("Error fetching user events:", error);
    res.status(500).send("Internal Server Error");
  }
});

//event create and delete

// Define a route to create a new event
app.post("/create-event", async (req, res) => {
  try {
    // Ensure user is authenticated
    if (!req.isAuthenticated()) {
      return res.redirect("/login");
    }

    // Create the event
    const newEvent = new Event({
      eventName: req.body.eventName,
      eventDescription: req.body.eventDesc,
      createdBy: req.user._id, // Assuming req.user contains the authenticated user
    });

    // Save the event to the database
    await newEvent.save();

    // Add the event to the user's events array
    req.user.events.push(newEvent);
    await req.user.save();

    // Redirect back to the dashboard or any other appropriate route
    res.redirect("/dashboard");
  } catch (error) {
    console.error("Error creating event:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Define a route to delete an event by its ID
app.post("/delete-event/:eventId", async (req, res) => {
  try {
    // Ensure user is authenticated
    if (!req.isAuthenticated()) {
      return res.redirect("/login");
    }

    // Get the event ID from the URL parameters
    const eventId = req.params.eventId;

    // Find the event by ID
    const event = await Event.findById(eventId);

    // Ensure the event exists
    if (!event) {
      return res.status(404).send("Event not found");
    }

    // Ensure the authenticated user is the creator of the event
    if (event.createdBy.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .send("You are not authorized to delete this event");
    }

    // Delete the event
    await Event.deleteOne({ _id: eventId });

    // Remove the event from the user's events array
    req.user.events.pull(eventId);
    await req.user.save();

    // Redirect back to the dashboard or any other appropriate route
    res.redirect("/dashboard");
  } catch (error) {
    console.error("Error deleting event:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Define a route to approve or disapprove an event
app.post('/events/:eventId/approve', async (req, res) => {
    try {
        // Ensure user is authenticated and is an admin
        if (!req.isAuthenticated() || !req.user.admin) {
            return res.status(403).send('Unauthorized');
        }

        // Get the event ID from the URL parameters
        const eventId = req.params.eventId;

        // Find the event by ID
        const event = await Event.findById(eventId);

        // Ensure the event exists
        if (!event) {
            return res.status(404).send('Event not found');
        }

        // Update the event based on the action
        if (req.body.action === 'approve') {
            event.approved = true;
            event.pending = false;
        } else if (req.body.action === 'disapprove') {
            event.approved = false;
            event.pending = false;
        }

        // Save the updated event
        await event.save();

        // Redirect back to the events page or any other appropriate route
        res.redirect('/events');
    } catch (error) {
        console.error('Error approving/disapproving event:', error);
        res.status(500).send('Internal Server Error');
    }
});


//listen
app.listen(port, () => {
  console.log(`App listening on port ${port}`);
});
