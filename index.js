const express = require("express");
const app = express();
require("dotenv").config();
const cors = require("cors");
//const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const port = process.env.PORT || 5000;
// middleware
const corsOptions = {
  origin: ["http://localhost:5173", "http://localhost:5174"],
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));
// app.use(cookieParser());
app.use(express.json());

//=============================================================================

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_User}:${process.env.DB_Pass}@cluster0.p5jkrsj.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const mealcolection = client.db("hostalDB").collection("meals");
    const usercol = client.db("hostalDB").collection("users");
    const upcommingmealcol = client.db("hostalDB").collection("upcommingmeal");
    // auth related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "5h",
      });
      res.send({ token });
    });
    // Logout
    // app.get("/logout", async (req, res) => {
    //   try {
    //     res
    //       .clearCookie("token", {
    //         maxAge: 0,
    //         secure: process.env.NODE_ENV === "production",
    //         sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
    //       })
    //       .send({ success: true });
    //   } catch (err) {
    //     res.status(500).send(err);
    //   }
    // });

    //======================================================
    // Verify Token Middleware
    const verifyToken = async (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "unauthorized access" });
        }
        req.decoded = decoded;
        next();
      });
    };
    //veryfy admin
    const veryfiAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usercol.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbennen akcess" });
      }
      next();
    };

    //==========================user collection=================================

    app.get("/users", verifyToken, async (req, res) => {
      const result = await usercol.find().toArray();
      res.send(result);
    });

    app.get("/user/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "unauthorize" });
      }
      const query = { email: email };
      const user = await usercol.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });
    app.get("/useron/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await usercol.findOne(query);
      res.send(result);
    });

    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };

      const updateDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await usercol.updateOne(filter, updateDoc);
      res.send(result);
    });

    //save a user
    app.post("/user", async (req, res) => {
      const user = req.body;
      const query = { email: user?.email };
      // cheack if user alrady
      const isExist = await usercol.findOne(query);
      if (isExist) return res.send(isExist);

      const result = await usercol.insertOne(user);
      res.send(result);
    });

    //==========================meals===========================================
    app.get("/meals", async (req, res) => {
      const result = await mealcolection.find().toArray();
      res.send(result);
    });

    app.post("/addmeals", verifyToken, veryfiAdmin, async (req, res) => {
      const item = req.body;
      const result = await mealcolection.insertOne(item);
      res.send(result);
    });

    app.get("/meal/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await mealcolection.findOne(query);
      res.send(result);
    });

    // =======================upcomming meaks================
    app.get("/upcommingmeals", async (req, res) => {
      const result = await upcommingmealcol.find().toArray();
      res.send(result);
    });

    app.post("/upcommingmeals", verifyToken, veryfiAdmin, async (req, res) => {
      const item = req.body;
      const result = await upcommingmealcol.insertOne(item);
      res.send(result);
    });

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    //await client.close();
  }
}
run().catch(console.dir);

//==============================================================================
app.get("/", (req, res) => {
  res.send("Hello from hostel managment  Server..");
});

app.listen(port, () => {
  console.log(`sms is running on port ${port}`);
});
