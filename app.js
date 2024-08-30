const express = require("express");
const session = require("express-session");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const bcrypt = require("bcryptjs");
const puppeteer = require("puppeteer");
const puppeteerStream = require("puppeteer-stream");
const { Server } = require("socket.io");
const http = require("http");

// Crea una instancia de Express
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: "KSdmmdomqod203122Kmd91ir21wq0d01293121{q",
    resave: false,
    saveUninitialized: true,
  })
);

app.use(passport.initialize());
app.use(passport.session());

// Simulación de base de datos
const users = [];

passport.use(
  new LocalStrategy((username, password, done) => {
    const user = users.find((user) => user.username === username);
    if (!user) {
      return done(null, false, { message: "Usuario no encontrado" });
    }
    bcrypt.compare(password, user.password, (err, res) => {
      if (res) {
        return done(null, user);
      } else {
        return done(null, false, { message: "Contraseña incorrecta" });
      }
    });
  })
);

passport.serializeUser((user, done) => {
  done(null, user.username);
});

passport.deserializeUser((username, done) => {
  const user = users.find((user) => user.username === username);
  done(null, user);
});

// Almacena las sesiones de navegador
const browserSessions = {};

app.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/browser",
    failureRedirect: "/login",
  })
);

app.post("/register", (req, res) => {
  const { username, password } = req.body;
  const hash = bcrypt.hashSync(password, 10);
  users.push({ username, password: hash });
  res.redirect("/login");
});

app.get("/", (req, res) => {
  res.send("Bienvenido a la aplicación");
});

app.get("/login", (req, res) => {
  res.send(
    '<form method="post" action="/login">Usuario: <input type="text" name="username"/><br>Contraseña: <input type="password" name="password"/><br><button type="submit">Iniciar sesión</button></form>'
  );
});

app.get("/register", (req, res) => {
  res.send(
    '<form method="post" action="/register">Usuario: <input type="text" name="username"/><br>Contraseña: <input type="password" name="password"/><br><button type="submit">Registrar</button></form>'
  );
});

app.get("/browser", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/login");
  }

  const username = req.user.username;
  let browser = browserSessions[username];

  if (!browser) {
    browser = await puppeteer.launch({
      headless: true,
    });
    browserSessions[username] = browser;
  }

  const page = await browser.newPage();
  await page.goto("https://www.google.com");

  res.sendFile(__dirname + "/browser.html");
});

io.on("connection", async (socket) => {
  const username = socket.handshake.query.username;
  const browser = browserSessions[username];

  if (!browser) return;

  const page = (await browser.pages())[0];
  const stream = await puppeteerStream(page);

  stream.pipe(socket);

  socket.on("input", (data) => {
    // Maneja las entradas del usuario
  });

  socket.on("disconnect", () => {
    stream.destroy();
  });
});

server.listen(8080, () => {
  console.log("App running on port 8080");
});
