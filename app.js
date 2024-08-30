const { exec } = require('child_process');
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const { Builder } = require('selenium-webdriver');


const app = express();

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
    secret: 'tu_secreto',
    resave: false,
    saveUninitialized: true
}));

app.use(passport.initialize());
app.use(passport.session());

// Simulación de base de datos
const users = []; 

passport.use(new LocalStrategy(
    (username, password, done) => {
        const user = users.find(user => user.username === username);
        if (!user) {
            return done(null, false, { message: 'Usuario no encontrado' });
        }
        bcrypt.compare(password, user.password, (err, res) => {
            if (res) {
                return done(null, user);
            } else {
                return done(null, false, { message: 'Contraseña incorrecta' });
            }
        });
    }
));

passport.serializeUser((user, done) => {
    done(null, user.username);
});

passport.deserializeUser((username, done) => {
    const user = users.find(user => user.username === username);
    done(null, user);
});

// Ruta de login
app.post('/login', passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/login'
}));

// Ruta de registro
app.post('/register', (req, res) => {
    const { username, password } = req.body;
    const hash = bcrypt.hashSync(password, 10);
    users.push({ username, password: hash });
    res.redirect('/login');
});

// Crear y gestionar el contenedor Docker
app.get('/', (req, res) => {
    if (req.isAuthenticated()) {
        res.send(`Hola, ${req.user.username}`);
    } else {
        res.send('Por favor inicia sesión');
    }
});



app.get('/login', (req, res) => {
    res.send('<form method="post" action="/login">Usuario: <input type="text" name="username"/><br>Contraseña: <input type="password" name="password"/><br><button type="submit">Iniciar sesión</button></form>');
});

app.get('/register', (req, res) => {
    res.send('<form method="post" action="/register">Usuario: <input type="text" name="username"/><br>Contraseña: <input type="password" name="password"/><br><button type="submit">Registrar</button></form>');
});
// Eliminar el contenedor al cerrar la sesión
app.get('/logout', (req, res) => {
    if (req.isAuthenticated()) {
        exec(`docker stop browser_${req.user.username}`, (err, stdout, stderr) => {
            if (err) {
                console.error(`Error al detener el contenedor: ${err}`);
                return res.send('Error al detener el navegador');
            }
            console.log(`Contenedor detenido: ${stdout}`);
            req.logout();
            res.send('Sesión cerrada y contenedor eliminado');
        });
    } else {
        res.redirect('/login');
    }
});

app.get('/start-browser', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.redirect('/login');
    }

let driver = new Builder().forBrowser('chrome').usingServer('http://selenium-chrome:4444/wd/hub').build();

    try {
        await driver.get('https://www.google.com');
        res.send(`Navegador iniciado para ${req.user.username}`);
    } catch (err) {
        res.status(500).send(`Error al iniciar el navegador: ${err}`);
    }
});

app.listen(8080, () => {
    console.log('App running on port 8080');
});
