const express = require("express");
const path=require("path");
const dotenv =require("dotenv");

const Redis=require("ioredis");
const {Server}=require("socket.io");

const { generateSlug } = require("random-word-slugs");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const { ECSClient, RunTaskCommand } = require("@aws-sdk/client-ecs");
const { channel } = require("diagnostics_channel");

const PORT = 9000;
const app = express();
app.use(express.json());

const ecsclient = new ECSClient({
    region:process.env.region,
    credentials: {
        accessKeyId: process.env.accessKeyId,
        secretAccessKey: process.env.secretAccessKey,
    }
})

const subscriber = new Redis(process.env.REDIS_URL, {
  tls: {
    rejectUnauthorized: false 
  }
});

const io = new Server({
  cors: {
    origin: "*",  
    methods: ["GET", "POST"]
  }
});

io.listen(9001,()=>{
    console.log("Socket Server started")
})

io.on('connection',socket =>{
    socket.on("subscribe",channel=>{
        socket.join(channel);
        socket.emit('message',`joined ${channel}`);
    })
})

const config={
    CLUSTER:process.env.cluster_ARN,
    TASK:process.env.Task_ARN
}

app.post("/api/project", async (req, res) => {
    const { gitUrl } = req.body;
    const ProjectId = generateSlug();

    // RUN The Container
    const command=new RunTaskCommand({
        cluster:config.CLUSTER,
        taskDefinition:config.TASK,
        launchType:"FARGATE",
        count:1,
        networkConfiguration:{
            awsvpcConfiguration:{
                assignPublicIp:"ENABLED",
                subnets:["","",""],
                securityGroups:[""]
            }
        },
        overrides:{
            containerOverrides:[
                {
                    name:"vercel-build-server",
                    environment:[
                        {name:"GIT_REPOSITORY_URL",value:gitUrl},
                        {name:"PROJECT_ID",value:ProjectId},
                        {name:"accessKeyId",value:process.env.accessKeyId},
                        {name:"secretAccessKey",value:process.env.secretAccessKey},

                    ]
                }

            ]  
        }
    })
    await ecsclient.send(command);
        
    res.json({status:"queued",data:{Project_id:ProjectId}})
})

async function RedisMessage(){
    subscriber.psubscribe('logs:*')
    subscriber.on('pmessage',(pattern,channel,message)=>{
        io.to(channel).emit('message',message);
    })
}
RedisMessage();
app.listen(PORT, () => {
    console.log("Server is Started");
})