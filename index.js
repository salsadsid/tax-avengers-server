const express = require("express");
const cors = require("cors");
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const app = express();

app.use(express.json());
app.use(cors());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.fr7f4kz.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

function verifyJWT(req, res, next) {
  const authHeader = req.headers?.authorization;
  if (!authHeader) {
    return res.status(403).json({ message: "Unauthorized Access" });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
    if (err) {
      return res.status(403).json({ message: "Forbidden Access" });
    }
    req.decoded = decoded;
    next();
  });
}

async function run() {
  try {
    const appointmentOption = client
      .db("tax-avengers")
      .collection("appointmentOption");
    const bookingCollection = client.db("tax-avengers").collection("booking");
    const userCollection = client.db("tax-avengers").collection("user");
    const membersCollection = client.db("tax-avengers").collection("members");
    

    app.get("/appointmentOption", async (req, res) => {
      const date = req?.query?.date;
      console.log(date);
      const query = {};
      const options = await appointmentOption.find(query).toArray();
      const bookingQuery = { appointmentDate: date };
      const alreadyBooked = await bookingCollection
        .find(bookingQuery)
        .toArray();
      options.forEach((option) => {
        const optionBooked = alreadyBooked.filter(
          (book) => book.service === option.name
        );
        const bookedSlot = optionBooked.map((book) => book.slot);
        const remainingSlot = option.slots.filter(
          (slot) => !bookedSlot.includes(slot)
        );
        option.slots = remainingSlot;
      });
      res.send(options);
    });

    app.get("/apptionmentSpecialty",async(req,res)=>{
      const query={}
      const result = await appointmentOption.find(query).project({name:1}).toArray()
      res.send(result)
    })
    // not working
    // app.get("/v2/appointmentOption", async (req, res) => {
    //   const date = req.query.date;
    //   const options = await appointmentOption.aggregate([
    //     {
    //       $lookup: {
    //         from: "booking",
    //         localField: "name",
    //         foreignField: "service",
    //         pipeline: [
    //             {
    //                 $match:{
    //                     $expr:{
    //                         $eq:['appointmentDate',date]
    //                     }
    //                 }
    //             }
    //         ],
    //         as: "booked",
    //       },
    //     },
    //     {
    //         $project:{
    //             name:1,
    //             des:1,
    //             slots:1,
    //             booked:{
    //                 $map:{
    //                     input:'$booked',
    //                     as:'book',
    //                     in:"$$book.slot"
    //                 }
    //             }
    //         }
    //     },
    //     {
    //         $project:{
    //             name:1,
    //             des:1,
    //             slots:{
    //                 $setDifference:["$slots","$booked"]
    //             }
    //         }
    //     }
    //   ]).toArray();
    //   res.send(options)
    //   console.log(options)
    // });

    app.get("/booking", verifyJWT, async (req, res) => {
      const email = req.query.email;
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).json({ message: "Unauthorized Access" });
      }
      const query = { email };
      const bookings = await bookingCollection.find(query).toArray();
      return res.send(bookings);
    });

    app.post("/booking", async (req, res) => {
      const booking = req.body;
      console.log(booking);
      const query = {
        appointmentDate: booking.appointmentDate,
        email: booking.email,
        service: booking.service,
      };

      const alreadyBooked = await bookingCollection.find(query).toArray();

      if (alreadyBooked.length) {
        const message = `You already booked an appointment on ${booking.appointmentDate}`;
        return res.send({ acknowledged: false, message });
      }
      const result = await bookingCollection.insertOne(booking);
      return res.send(result);
    });

    app.get("/jwt", async (req, res) => {
      const email = req.query.email;
      const query = { email };
      const user = await userCollection.findOne(query);
      if (user) {
        const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, {
          expiresIn: "1d",
        });
        return res.send({ accessToken: token });
      }

      return res.status(403).send({ accessToken: "" });
    });

    app.get("/users", async (req, res) => {
      const query = {};
      const users = await userCollection.find(query).toArray();
      res.send(users);
    });

    app.get("/users/admin/:email",async(req,res)=>{
      const email= req.params.email;
      const query={email}
      const user= await userCollection.findOne(query)
      res.send({isAdmin:user?.role==="admin"})
    })

    app.put("/users/admin/:id",verifyJWT, async (req, res) => {
      const decodedEmail= req.decoded?.email
      const query={email:decodedEmail}
      const user= await userCollection.findOne(query)
      if(user?.role!=="admin"){
        return res.status(403).send({message:{title:"Forbidden Access",des:"You are not an admin"}})
      }
      const id = req.params?.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      return res.send(result);
    });

    app.post("/user", async (req, res) => {
      const user = req.body;
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    app.post("/members",async(req,res)=>{
      const member = req.body;
      console.log(member)
      const result= await membersCollection.insertOne(member);
      res.send(result)
    })

    app.get("/members",async(req,res)=>{
      const query={}
      const members= await membersCollection.find(query).toArray()
      res.send(members)
    })

  } finally {
  }
}
run().catch(console.dir);
app.get("/", (req, res) => {
  res.send("TAX-AVENGER_SERVER_WORKING");
});

app.listen(port, () => {
  console.log(`TAX-AVENGER_SERVER_WORKING ON PORT:${port}`);
});
