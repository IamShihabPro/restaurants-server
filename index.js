const express = require('express')
const cors = require('cors')
const app = express()
require('dotenv').config()
const { MongoClient, ServerApiVersion } = require('mongodb');
const port = process.env.PORT || 5000

// middleware
app.use(cors())
app.use(express.json())



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.lgdhrpf.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    
    const usersCollection = client.db('foodie').collection('users')
    const menuCollection = client.db('foodie').collection('menu')
    const cartCollection = client.db('foodie').collection('carts')


    // users collection
    app.post('/users', async(req, res)=>{
      const user = req.body
      const query = {email: user.email}
      const exitUser = await usersCollection.findOne(query)
      console.log(exitUser);
      if(exitUser){
        return res.send({message: 'user already exits'})
      }
      const result = await usersCollection.insertOne(user)
      res.send(result)
    })

    // menu collection
    app.get('/menu', async(req, res)=>{
        const result = await menuCollection.find().toArray()
        res.send(result)
    })

    // cart collection
    app.get('/carts', async(req, res)=>{
      const email = req.query.email
      if(!email){
        res.send([])
      }
      const query = {email: email}
      const result = await cartCollection.find(query).toArray()
      res.send(result) 
    })

    app.post('/carts', async(req, res) =>{
      const item = req.body
      console.log(item)
      const result = await cartCollection.insertOne(item)
      res.send(result)
    })



    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);





app.get('/', (req, res)=>{
    res.send('Restaurant project')
})

app.listen(port, ()=>{
    console.log(`Restaurant project port ${port}`);
})
