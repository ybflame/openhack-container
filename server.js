
const express = require('express');
//const k8s = require('@kubernetes/client-node');
const Client = require('kubernetes-client').Client;
const config = require('kubernetes-client').config;


const bodyParser = require('body-parser');
const app = express();
const port =process.env.PORT||3000;

const service_name = "azure-minecraft";

const k8client = new Client({ config: config.fromKubeconfig(), version: '1.9' });
console.log("client ", k8client);

app.use(bodyParser.json());

app.listen(port);


app.get('/users/data',(req,res)=>{
    
    res.status(200).send(JSON.stringify({user:'liuyc'},undefined,2))
})

// app.get('/k8s',(req,res)=>{

//     var k8sApi = k8s.Config.defaultClient();
//     k8sApi.listNamespacedPod('default')
//         .then((resp) => {
//             console.log("K8s response",resp.body);
//             res.send(resp.body);
//         });
// })

app.get('/pods',(req,res)=>{

    (async function getService(){

        const namespaces =  await k8client.api.v1.namespaces.get();
        console.log('Namespaces: ', namespaces);

        const service =  await k8client.api.v1.namespaces("default").services(service_name).get();
        //console.log('Service: ', service);
        const eip = service.body.status.loadBalancer.ingress[0].ip;
        console.log("eip: ", eip);

        const sname = service.body.metadata.name;

        // const ports = service.body.spec.ports.map( x => {x.name: 
        //     return {
        //         x.name: eip + ":" + x.targetPort
        //         "minecraft": "128.124.90.15:25565",
        //         "rcon": "128.124.90.15:25575"
        //       }
        // })

        const pods =  await k8client.api.v1.namespaces("default").pods.get();
        // const filteredPods = pods.body.items.find(x =>  x.metadata.labels.app === service_name)
        // console.log('pod: ', filteredPods);

        const filteredPods = pods.body.items.filter(x =>  x.metadata.labels.app === service_name);
        const servers = filteredPods.map(x => {
                let name = x.metadata.name;
                let podIp = x.status.podIP;
                let endpoints = {};
                x.spec.containers[0].ports.forEach(x => {
                    endpoints[x.name] = podIp + ":" + x.containerPort;
                });

                console.log("endpoints:", endpoints);

                return {
                    name: name,
                    endpoints: endpoints
                }

            })

        console.log("servers:", servers)

        // const resp = services.items.map(x =>{
        //     let ip = x.    
        //     x.
        //     return ({
        //         "name": x.metadata.name,
        //         "endpoints": 
        //     }}
        // }) ;

        // items.map()
        // [
        //     {
        //       "name": "<some arbitrary name>",
        //       "endpoints": {
        //         "minecraft": "<publicly available IP:port>",
        //         "rcon": "<publicly available IP:port>"
        //       }
        //     }
        //   ]

    
        res.status(200).send(servers);
    })();
})


app.post('/pods/add',(req,res)=>{

    (async function addPod(){

        const replCtrl = await k8client.api.v1.namespaces("default").replicationcontrollers.scale.get();

        console.log("replica Controller:", replCtrl);

    
        res.status(200).send(replCtrl);
    })();
})



app.post('/users/signup',(req,res)=>{
    var body=req.body;
    res.status(200).send();
})    

console.log('todo list RESTful API server started on: ' + port);


