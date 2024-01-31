const express = require("express");
const cors = require("cors");
const app = express();
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.SECRET_KEY);

const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

// verify jwt
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: "Unauthorize access" });
  }
  // bearer token
  const token = authorization.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "Unauthorize access" });
    }
    req.decoded = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.lgdhrpf.mongodb.net/?retryWrites=true&w=majority`;

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
    const usersCollection = client.db("foodie").collection("users");
    const menuCollection = client.db("foodie").collection("menu");
    const cartCollection = client.db("foodie").collection("carts");
    const paymentCollection = client.db("foodie").collection("payments");
    const reviewCollection = client.db('foodie').collection('reviews')

    // jwt
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // verify admin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "Forbidden Access" });
      }
      next();
    };

    // users collection
    app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const exitUser = await usersCollection.findOne(query);
      console.log(exitUser);
      if (exitUser) {
        return res.send({ message: "user already exits" });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        return res.send({ admin: false });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === "admin" };
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

      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.delete("/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    });

    // menu collection
    app.get("/menu", async (req, res) => {
      const result = await menuCollection.find().sort({ _id: -1 }).toArray();
      res.send(result);
    });

    app.post("/menu", verifyJWT, verifyAdmin, async (req, res) => {
      const item = req.body;
      const result = await menuCollection.insertOne(item);
      res.send(result);
    });

    app.delete("/menu/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menuCollection.deleteOne(query);
      res.send(result);
    });

    app.get("/menu/:id", async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await menuCollection.findOne(query);
      res.send(result);
    });

    app.put('/menu/:id', verifyJWT, verifyAdmin, async(req, res)=>{
      const id = req.params.id
      const filter = {_id: new ObjectId(id)}
      const options = {upsert: true}
      const updateFood = req.body
      const course = {
        $set: {
          name: updateFood.name, 
          category:  updateFood.category, 
          price:  updateFood.price, 
          image:  updateFood.image, 
          recipe:  updateFood.recipe
        }
      }
      const result = await menuCollection.updateOne(filter, course, options)
      res.send(result)
    })

    // cart collection
    app.get("/carts", verifyJWT, async (req, res) => {
      const email = req.query.email;
      // console.log(email);
      if (!email) {
        res.send([]);
      }
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }
      const query = { email: email };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/carts", async (req, res) => {
      const item = req.body;
      console.log(item);
      const result = await cartCollection.insertOne(item);
      res.send(result);
    });

    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });

     //review collection
     app.get('/reviews', async(req, res)=>{
      const result = await reviewCollection.find().sort({_id: -1}).toArray()
      res.send(result)
    })

     // reviews collection
     app.post('/reviews', async(req, res)=>{
      const item = req.body
      const result = await reviewCollection.insertOne(item)
      res.send(result)
     })



    // create payment intent
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      try {
        const { overallTotal } = req.body;
        const amount = Math.round(overallTotal * 100); // Convert to cents
        // console.log(amount);
    
        if (amount < 1) {
          throw new Error('Amount must be greater than or equal to 1 cent.');
        }
    
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: "usd",
          payment_method_types: ['card']
        });
    
        res.send({
          clientSecret: paymentIntent.client_secret,
        });
      } catch (error) {
        console.error('Error creating payment intent:', error);
        res.status(500).send({ error: 'Internal Server Error' });
      }
    });
    
    

    app.post('/payments', verifyJWT, async(req, res) => {
      const payment = req.body
      const insertResult = await paymentCollection.insertOne(payment)

      const query = {_id: {$in: payment.cartItems.map(id => new ObjectId(id))}}
      const deleteResult = await cartCollection.deleteMany(query)

      res.send({insertResult, deleteResult})
    })


    // admin-stats
    app.get('/admin-stats', verifyJWT, verifyAdmin, async(req, res) =>{
      const users = await usersCollection.estimatedDocumentCount()
      const foodItem = await menuCollection.estimatedDocumentCount()
      const orders = await paymentCollection.estimatedDocumentCount()
      const payments = await paymentCollection.find().toArray()
      const revenue = payments.reduce((sum, payment) => sum + payment.totalAmount, 0)

      res.send({users, foodItem, orders, revenue})
    })

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Restaurant project");
});

app.listen(port, () => {
  console.log(`Restaurant project port ${port}`);
});
