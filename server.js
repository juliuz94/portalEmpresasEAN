require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
let ejs = require("ejs");
const app = express();
const fs = require("fs");
const lodash = require("lodash");
const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const bcrypt = require("bcrypt");
const passport = require("passport");
const flash = require("express-flash");
const session = require("express-session");
const formidable = require("formidable");
const Storage = require('@google-cloud/storage');

const storageGCP = new Storage.Storage({
  projectId: process.env.PROJECT_ID,
  keyFilename: process.env.FIREBASE_FILE  
}); 

const bucket = storageGCP.bucket(process.env.STORAGE_BUCKET)

app.use(
  bodyParser.urlencoded({
    extended: true
  })
);
app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(flash());
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
  })
);

mongoose.connect("mongodb://localhost:27017/adminEmpresasDB", {
  useUnifiedTopology: true
});

const productSchema = new mongoose.Schema({
  title: String,
  description: String,
  sku: String,
  category: String,
  price: Number,
  refPrice: Number,
  maxPerson: Number,
  stock: Number,
  image: String
});

const companySchema = new mongoose.Schema({
  title: String,
  category: String,
  image: String,
  description: String,
  contactName: String,
  phone: Number,
  email: String,
  website: String,
  instagram: String,
  facebook: String,
  linkedin: String,
  twitter: String,
  products: {
    type: [productSchema],
    default: undefined
  }
});

const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  companyId: {
    type: Schema.Types.ObjectId,
    ref: "Company"
  },
  type: String,
  accepterTerms: String
});

const Company = mongoose.model("Company", companySchema);
const User = mongoose.model("User", userSchema);

const company1 = new Company({
  title: "Starbucks",
  category: "Alimentos",
  image: "images/logo-empresa.png",
  description:
    "Empresa de café al triple del precio de la competencia; decoramos tu vaso con tu nombre y un mensaje random",
  contactName: "Don Bucks",
  phone: "1234567890",
  email: "star@bucks.com",
  website: "www.star.bucks",
  instagram: "@starbucks",
  facebook: "/starbucksFB",
  linkedin: "/starbucksLI",
  twitter: "starbucksTT",
  products: []
});

const company2 = new Company({
  title: "Apple",
  category: "Tecnología",
  image: "images/logo-empresa.png",
  description:
    "Empresa de tecnología con los mejores equipos a precios demasiado altos",
  contactName: "Steve Bucks",
  phone: "1234567890",
  email: "steve@bucks.com",
  website: "www.apple.com",
  instagram: "@aplpe",
  facebook: "/appleFB",
  linkedin: "/appleLI",
  twitter: "appleTT",
  products: []
});

const defaultCompanies = [company1, company2];

/* Company.insertMany(defaultCompanies, (err) => {
  if (err) {
    console.log(err);
  } else {
    console.log('success');
  }
}); */

const initializePassport = require("./public/js/passport");
initializePassport(passport, User);

app.use(passport.initialize());
app.use(passport.session());

/******** LOGIN ROUTES **********/

app.get("/login", checkAuthenticated, (req, res) => {
  res.render("login");
});

app.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/login",
    failureFlash: true
  })
);

app.get("/logout", function(req, res) {
  req.logOut();
  res.redirect("/login");
});

/******** END ROUTES **********/

/******** ROUTES **********/

app.get("/", checkAuthentication, async (req, res) => {
  const userId = req.session.passport.user;
  const user = await User.findById(userId);
  const companyId = user.companyId;
  const company = await Company.findOne(
    { _id: companyId },
    (err, foundCompany) => {
      return foundCompany;
    }
  );
  const products = company.products;

  res.render("index", {
    companyId: companyId,
    products: products,
    user: user,
    userId: userId
  });
});

const createPublicFileURL = (newFile) => {
  return 'https://storage.googleapis.com/' + process.env.GCS_BUCKET + '/' + encodeURIComponent(newFile.name);
};

app.post("/new-product", (req, res) => {
  var form = new formidable.IncomingForm();
  // Note the changes here
  form.parse(req, (error, fields, files) => {
    let file = files[0];
    bucket.upload('/Users/JulianLozano/Downloads/EAN-Admin-Empresas/uploads/Screen Shot 2020-01-29 at 9.39.05 AM.png',
    {
    destination: `${files.upload.name}`,
    public: true,
    metadata: { contentType: files.upload.type }}, (
      err, resultFile) => {
      if (err) {
        console.log(err);
        throw (err);
        return;
      }
      resultFile
        .makePublic()
        .then(() => {
          console.log({
            url: createPublicFileURL(resultFile),
            id: resultFile.id
          })
          resolve({});
        })
        .catch((err) => {
          reject(err);
        });
    }
  );
    console.log(files.upload);
  });

  form.on("fileBegin", function(name, file) {
    file.path = __dirname + "/uploads/" + file.name;
  });
  form.on("file", function(name, file) {
    // console.log("Uploaded " + file.name);
  });

  /* const companyId = req.body.companyID;

  const newProduct = {
    title: req.body.productTitle,
    description: req.body.productDescription,
    sku: req.body.productSKU,
    category: req.body.productCategory,
    price: req.body.price,
    refPrice: req.body.referencePrice,
    maxPerson: req.body.maxUser,
    stock: req.body.productStock,
    image: "product-default.png"
  };

  Company.findOne(
    {
      _id: companyId
    },
    (err, foundCompany) => {
      foundCompany.products.push(newProduct);
      // foundCompany.save();
    }
  );
 */

  res.redirect("/");
});

/******** ADMIN ROUTES **********/

app.get("/admin", checkAdmin, async (req, res) => {
  const users = await User.find({});

  Company.find({}, (err, foundCompanies) => {
    res.render("admin.ejs", { companies: foundCompanies, users: users });
  });
});

app.post("/update-terms", (req, res) => {
  const ip =req.header('x-forwarded-for') || req.connection.remoteAddress; 
  const userId = req.body.userId;
  console.log(ip);
  console.log(userId);

  User.updateOne({
    _id: userId
  }, {
    accepterTerms: ip
  }, (err) => {
    if (!err) {
      return res.redirect("/");
    } else {
      console.log(err);
    }
  });

});

app.post("/new-company", (req, res) => {
  const newCompany = new Company({
    title: req.body.companyTitle,
    category: req.body.companyCategory,
    image: "images/logo-empresa.png",
    description: "",
    contactName: "",
    phone: "",
    email: "",
    website: "",
    instagram: "",
    facebook: "",
    linkedin: "",
    twitter: "",
    products: []
  });
  newCompany.save();
  res.redirect("/admin");
});

app.post("/new-user", async (req, res) => {
  try {
    const hashedPassword = await bcrypt.hash(req.body.userPassword, 10);
    const newUser = new User({
      name: req.body.userName,
      email: req.body.userEmail,
      password: hashedPassword,
      companyId: req.body.companyId,
      type: req.body.userType,
      accepterTerms: 'false'
    });
    newUser.save();
    res.redirect("/admin");
  } catch {
    res.redirect("/admin");
  }
});

/*********************************************/
/******* Authentication Verification *********/
/*********************************************/

function checkAuthentication(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  } else {
    res.redirect("/login");
  }
}

function checkAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    res.redirect("/");
  } else {
    return next();
  }
}

async function checkAdmin(req, res, next) {
  try {
    const userId = req.session.passport.user;
    const user = await User.findById(userId);

    if (user.type === "admin") {
      return next();
    } else {
      res.redirect("/login");
    }
  } catch {
    return res.redirect("/");
  }
}

app.listen(3000, () => {
  console.log("App running on port 3000");
});
