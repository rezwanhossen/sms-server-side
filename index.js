const express = require("express");
const app = express();
require("dotenv").config();
const cors = require("cors");
const stripe = require("stripe")(process.env.STRIP_KEY);

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
    const requstmealcol = client.db("hostalDB").collection("requstmeal");
    const badgecol = client.db("hostalDB").collection("badge");
    const paymentcol = client.db("hostalDB").collection("payment");
    const reviewscol = client.db("hostalDB").collection("reviews");
    // auth related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "5h",
      });
      res.send({ token });
    });

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

    // ===================pyment =======================

    app.post("/create-payment-intent", verifyToken, async (req, res) => {
      const price = req.body.price; //paymentIntent { client_secret }
      const amount = parseInt(price) * 100;
      if (!price || amount < 1) return;
      const { client_secret } = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        automatic_payment_methods: { enabled: true },
        // payment_method_types: ["card"],
      });
      res.send({ clientSecret: client_secret }); //clientSecret: paymentIntent.clint_secret,
    });

    // payment collection in badge
    app.get("/payment", async (req, res) => {
      const result = await paymentcol.find().toArray();
      res.send(result);
    });

    app.get("/payment/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await paymentcol.findOne(query);
      res.send(result);
    });
    app.get("/payments", verifyToken, async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await paymentcol.find(query).toArray();
      res.send(result);
    });

    app.post("/payment", verifyToken, async (req, res) => {
      const item = req.body;
      const result = await paymentcol.insertOne(item);
      res.send(result);
    });

    //=====================reviews=======================
    app.get("/reviews", verifyToken, async (req, res) => {
      const result = await reviewscol.find().toArray();
      res.send(result);
    });

    app.get("/reviews/:mealid", async (req, res) => {
      const mealid = req.params.mealid;
      const query = { mealid: mealid };
      const result = await reviewscol.find(query).toArray();
      res.send(result);
    });

    app.get("/myreviews/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await reviewscol.find(query).toArray();
      res.send(result);
    });

    app.patch("/reviewLike/:id", async (req, res) => {
      const id = req.params.id;
      const likes = req.body;
      const query = { _id: new ObjectId(id) };
      const updetdoc = {
        $set: likes,
      };
      const result = await reviewscol.updateOne(query, updetdoc);
      res.send(result);
    });

    app.post("/reviews", async (req, res) => {
      const item = req.body;
      const result = await reviewscol.insertOne(item);
      res.send(result);
    });

    app.delete("/review/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await reviewscol.deleteOne(query);
      res.send(result);
    });

    //======================badge=========================
    app.get("/badge", async (req, res) => {
      const result = await badgecol.find().toArray();
      res.send(result);
    });

    app.get("/badge/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await badgecol.findOne(query);
      res.send(result);
    });

    //======================meal request collecto==================================

    app.get("/allrequstmeal", verifyToken, veryfiAdmin, async (req, res) => {
      const result = await requstmealcol.find().toArray();
      res.send(result);
    });

    app.get("/requstmeals/:userEmail", verifyToken, async (req, res) => {
      const userEmail = req.params.userEmail;
      const query = { userEmail: userEmail };
      const result = await requstmealcol.find(query).toArray();
      res.send(result);
    });

    app.get("/all-requstmeals", verifyToken, veryfiAdmin, async (req, res) => {
      const search = req.query.search;
      let query = {
        $or: [
          { user: { $regex: search, $options: "i" } },
          { userEmail: { $regex: search, $options: "i" } },
        ],
      };
      const result = await requstmealcol.find(query).toArray();
      res.send(result);
    });

    app.patch("/requstmealsata/:id", async (req, res) => {
      const id = req.params.id;
      const status = req.body;
      const query = { _id: new ObjectId(id) };
      const updetdoc = {
        $set: status,
      };
      const result = await requstmealcol.updateOne(query, updetdoc);
      res.send(result);
    });

    app.post("/requstmeal", async (req, res) => {
      const item = req.body;
      const result = await requstmealcol.insertOne(item);
      res.send(result);
    });

    app.delete("/requstmeal/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await requstmealcol.deleteOne(query);
      res.send(result);
    });

    //==========================user collection=================================

    app.get("/users", verifyToken, async (req, res) => {
      const result = await usercol.find().toArray();
      res.send(result);
    });

    app.get("/all-users", verifyToken, async (req, res) => {
      const search = req.query.search;
      let query = {
        $or: [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ],
      };
      const result = await usercol.find(query).toArray();
      res.send(result);
    });

    app.get("/useron/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await usercol.findOne(query);
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

    app.get("/all-meals", async (req, res) => {
      const filter = req.query.filter;
      const search = req.query.search;
      let query = {
        title: { $regex: search, $options: "i" },
      };
      if (filter) query.catagory = filter;
      const result = await mealcolection.find(query).toArray();

      res.send(result);
    });

    app.patch("/reviusCount/:id", async (req, res) => {
      const id = req.params.id;
      const reviecCount = req.body;
      const query = { _id: new ObjectId(id) };
      const updetdoc = {
        $set: reviecCount,
      };
      const result = await requstmealcol.updateOne(query, updetdoc);
      res.send(result);
    });

    app.get("/admeals", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await mealcolection.find(query).toArray();
      res.send(result);
    });

    app.patch("/meals/:id", async (req, res) => {
      const id = req.params.id;
      const likes = req.body;
      const query = { _id: new ObjectId(id) };
      const updetdoc = {
        $set: likes,
      };
      const result = await mealcolection.updateOne(query, updetdoc);
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

    app.delete("/mealdelet/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await mealcolection.deleteOne(query);
      res.send(result);
    });

    // =======================upcomming meaks================
    app.get("/upcommingmeals", async (req, res) => {
      const result = await upcommingmealcol.find().toArray();
      res.send(result);
    });

    app.patch("/upcommingm/:id", async (req, res) => {
      const id = req.params.id;
      const likes = req.body;
      const query = { _id: new ObjectId(id) };
      const updetdoc = {
        $set: likes,
      };
      const result = await upcommingmealcol.updateOne(query, updetdoc);
      res.send(result);
    });

    app.post("/upcommingmeals", verifyToken, veryfiAdmin, async (req, res) => {
      const item = req.body;
      const result = await upcommingmealcol.insertOne(item);
      res.send(result);
    });
    app.delete("/upcommingmeals/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await upcommingmealcol.deleteOne(query);
      res.send(result);
    });

    app.get("/admin-state", verifyToken, veryfiAdmin, async (req, res) => {
      const users = await usercol.estimatedDocumentCount();
      const review = await reviewscol.estimatedDocumentCount();
      const totalmeals = await mealcolection.estimatedDocumentCount();
      const suscribMember = await paymentcol.estimatedDocumentCount();
      const Orders = await requstmealcol.estimatedDocumentCount();
      // const payment = await paymentcol.find().toArray();
      // const revenue = payment.reduce((total, pymen) => total + pymen.price, 0);
      const result = await paymentcol
        .aggregate([
          {
            $group: {
              _id: null,
              totrevenue: { $sum: "$price" },
            },
          },
        ])
        .toArray();
      const revenue = result.length > 0 ? result[0].totrevenue : 0;
      res.send({
        users,
        review,
        totalmeals,
        suscribMember,
        Orders,
        revenue,
      });
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
