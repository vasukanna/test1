//deployed Argocd

import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import * as eks from "@pulumi/eks";
import * as k8s from "@pulumi/kubernetes";
import { Server } from "@pulumi/aws/transfer";
const vpc = new aws.ec2.Vpc("argocd-vpc", {
    cidrBlock: "10.0.0.0/16",
    enableDnsHostnames: true,
    enableDnsSupport: true,
    tags: { Name: "argocd-vpc"},
});

//subnets
const subnet1 = new aws.ec2.Subnet("subnet-1", {
    vpcId: vpc.id,
    cidrBlock: "10.0.1.0/24",
    availabilityZone: "us-east-1a",
    tags: { Name: "subnet-1" },
});

const subnet2 = new aws.ec2.Subnet("subnet-2", {
    vpcId: vpc.id,
    cidrBlock: "10.0.2.0/24",
    availabilityZone: "us-east-1b",
    tags: { Name: "subnet-2" },
});

// an internet gateway
const internetGateway = new aws.ec2.InternetGateway("argocd-igw", {
    vpcId: vpc.id,
    tags: { Name: "argo-cd-igw" },
});

//Route tables
const routeTable = new aws.ec2.RouteTable("route-table", {
    vpcId: vpc.id,
    routes: [{ cidrBlock: "0.0.0.0/0", gatewayId: internetGateway.id }],
    tags: { Name: "argocd-route-table" },
});

//Associate the Route table with subnets

new aws.ec2.RouteTableAssociation("rta-1", { routeTableId: routeTable.id, subnetId: subnet1.id });
new aws.ec2.RouteTableAssociation("rta-2", { routeTableId: routeTable.id, subnetId: subnet2.id });

//security group

const securityGroup = new aws.ec2.SecurityGroup("custom-sg", {
    vpcId: vpc.id,
    description: "allow all trafic for kubernetes",
    ingress: [{ protocol: "tcp",fromPort: 22, toPort: 22, cidrBlocks: ["0.0.0.0/0"] }],
    egress: [{ protocol: "tcp",fromPort: 80, toPort: 80, cidrBlocks: ["0.0.0.0/0"] }],
    tags: { Name: "argocd-sg" },
});

//cluster
const cluster = new eks.Cluster("cluster-1", {
    vpcId: vpc.id,
    subnetIds: [subnet1.id, subnet2.id],
    instanceType: "t3.medium",
    desiredCapacity: 2,
    minSize: 1,
    maxSize: 3,
    clusterSecurityGroup: securityGroup,
    providerCredentialOpts: { profileName: "default" },
});

//Argocd namespace
const argoNamespace = new k8s.core.v1.Namespace("argocd", {
    metadata: { name: "argocd" },
}, { provider: cluster.provider });

// Deploy ArgoCD
const argoDeployment = new k8s.yaml.ConfigFile("argo-cd", {
    file: "https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml",    
}, {provider: cluster.provider });

export const kubeconfig = cluster.kubeconfig;
export const vpcId = vpc.id;
export const public_subnetId = subnet1.id;
export const private_subnetId = subnet2.id;

