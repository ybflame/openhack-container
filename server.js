
const express = require('express');
const yaml = require('js-yaml');
const fs = require('fs');
//const k8s = require('@kubernetes/client-node');
const Client = require('kubernetes-client').Client;
const config = require('kubernetes-client').config;


const bodyParser = require('body-parser');
const app = express();
const port =process.env.PORT||3000;

const service_name = "azure-minecraft";

const kubeconfig = yaml.safeLoad(fs.readFileSync("./kubeConfig"));

const k8client = new Client({ config: config.fromKubeconfig(kubeconfig) , version: '1.8'});
//console.log("client ", k8client);

app.use(bodyParser.json());
app.use('/static',express.static('public'));

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

app.get('/servers',(req,res)=>{

    (async function getServers(){

        const services =  await k8client.api.v1.namespaces("default").services.get();
        const serviceName ="azure-minecraft";

        //const filteredSvs = services.body.items.filter(x =>  x.metadata.name.substring(0,16) === serviceName);
        const filteredSvs = services.body.items.filter(x =>  x.status.loadBalancer.ingress);

        console.log("non-filtered:", services);
        console.log("filtered:", filteredSvs);

        const servers = filteredSvs.map(x => {
                let name = x.metadata.name;
                let eip = x.status.loadBalancer.ingress[0].ip;
                let endpoints = {};
                x.spec.ports.forEach(x => {
                    endpoints[x.name] = eip + ":" + x.targetPort;
                });

                console.log("endpoints:", endpoints);

                return {
                    name: name,
                    endpoints: endpoints
                }
        })        

        res.status(200).send(servers);
    })();
})


app.post('/pods/add',(req,res)=>{

    (async function addPod(){
           
        const deployments = await k8client.apis.apps.v1beta1.namespaces("default").deployments("azure-minecraft").get();

        //console.log("deployments:", deployments);
        const replicas = deployments.body.spec.replicas;
        
        // const scale = await k8client.apis.apps.v1beta1.namespaces("default").deployments("azure-minecraft").scale.get();
        // const replicas = scale.body.spec.replicas;

        const body = {
            body: {
                spec: {
                    replicas: replicas + 1
                }
            }    
          }
        try {
          const resp = await k8client.apis.apps.v1beta1.namespaces("default").deployments("azure-minecraft").patch(body);
          res.status(200).send(resp);
        } catch (e) {
            console.log ("error:",e);
            res.status(500).send(e);
        }

    })();
})


app.post('/servers/add',(req,res)=>{

    (async function addServer(){
        
        const name = "azure-minecraft-" + new Date().valueOf();
        const deploymentReq = {
            body: {
                    apiVersion: "apps/v1beta1",
                    kind: "Deployment",
                    metadata: {
                      name: name
                    },
                    spec: {
                      replicas: 1,
                      selector: {
                        matchLabels: {
                          app: name
                        }
                      },
                      template: {
                        metadata: {
                          labels: {
                            app: name
                          }
                        },
                        spec: {
                          containers: [
                            {
                              name: name,
                              image: "openhack/minecraft-server:2.0",
                              env: [{
                                  name: "EULA",
                                  value: "TRUE"
                              }],
                              ports: [
                                {
                                  containerPort: 25565,
                                  name: "minecraft"
                                },
                                {
                                    containerPort: 25575,
                                    name: "rcon"
                                }
                              ]   
                            }
                          ]
                        }
                      }
                    }
                }
        }
        
        try {
            const resp = await k8client.apis.apps.v1beta1.namespaces("default").deployments.post(deploymentReq);
        } catch (e) {
            console.log ("error:",e);
            //res.status(500).send(e);
        }


        const service = {
            body: {
                "kind": "Service",
                "apiVersion": "v1",
                "metadata": {
                  "name": name
                },
                "spec": {
                  "ports": [
                    {
                      "name": "minecraft",
                      "port": 25565,
                      "targetPort": 25565
                    },
                    {
                        "name": "rcon",
                        "port": 25575,
                        "targetPort": 25575
                      }
                    ],
                  "selector": {
                    "app": name
                  },
                  "type": "LoadBalancer",
                },
              }
        }

        console.log("servie body:", service);

        
        try {
            const respSvr = await k8client.api.v1.namespaces("default").services.post(service);
            //res.status(200).send(resp);
        } catch (e) {
            console.log ("error:",e);
            //res.status(500).send(e);
        }

        res.status(200).send(deploymentReq);

    })();
})

app.post('/pods/deleteone',(req,res)=>{

    (async function deletePod(){
           
        
        const pods =  await k8client.api.v1.namespaces("default").pods.get();

        const filteredPods = pods.body.items.filter(x =>  x.metadata.labels.app === service_name);

        //const pod = await k8client.api.v1.namespaces("default").pods(filteredPods[0].metadata.name).get();

        const body = {
            body: {
                    apiVersion: "v1",
                    gracePeriodSeconds: 0,
                    kind: "Pod",
                    preconditions: {
                      uid: filteredPods[0].metadata.uid
                    }
            }
        }
        console.log("body:", body);
        try {
            const resp = await  k8client.api.v1.namespaces("default").pods(filteredPods[0].metadata.name).delete();

            res.status(200).send(resp);
        } catch (e) {
            console.log("error:",e);
            res.status(500).send(e);
           
        }    

    })();
})

app.get('/deployments',(req,res)=>{

    (async function getDeployments(){
           
        const deployments = await k8client.apis.apps.v1beta1.namespaces("default").deployments.get();

        res.status(200).send(deployments);
    })();
})

app.get('/services',(req,res)=>{

    (async function getServices(){

        const services =  await k8client.api.v1.namespaces("default").services.get();
        res.status(200).send(services);
    })();
})


app.post('/users/signup',(req,res)=>{
    var body=req.body;
    res.status(200).send();
})    

console.log('RESTful API server started on: ' + port);


