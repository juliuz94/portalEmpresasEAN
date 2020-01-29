const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');


function initialize(passport, User) {
    const authenticateUser = async (email, password, done) => {

        const user = await User.findOne({email: email});
        
        if (user == null) {
            return done(null, false, {message: "No existe un usuario con ese correo"});
        }

        try {
            if (await bcrypt.compare(password, user.password)) {
                return done(null, user);
            } else {
                return done(null, false, {message: 'Contraseña incorrecta'});
            }
            
        } catch (e) {
            return done("application error " + e.stack);
        }
    }

    passport.use(new LocalStrategy({ usernameField: 'email'}, authenticateUser));
    passport.serializeUser((user, done) => done(null, user._id));    
    passport.deserializeUser((id, done) => {
        const userId = User.findOne({id: id}, function (err, user) {});
        return done(null, userId);
    });
}

module.exports = initialize;